// Servidor sin dependencias: archivos estáticos + salas en tiempo real (SSE)
const http=require("http"),fs=require("fs"),path=require("path");
const PORT=process.env.PORT||3000,PUB=path.join(__dirname,"public"),rooms=new Map();
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".png":"image/png",".svg":"image/svg+xml",".ico":"image/x-icon",".txt":"text/plain",".xml":"application/xml"};
const newCode=()=>{const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let c;do{c=Array.from({length:5},()=>a[Math.random()*a.length|0]).join("")}while(rooms.has(c));return c};
const readBody=req=>new Promise(ok=>{let d="";req.on("data",c=>{d+=c;if(d.length>20000)req.destroy()});req.on("end",()=>{try{ok(JSON.parse(d||"{}"))}catch{ok({})}})});
const json=(res,o,s=200)=>{res.writeHead(s,{"Content-Type":"application/json"});res.end(JSON.stringify(o))};
const bc=(r,m,except)=>{const d="data: "+JSON.stringify(m)+"\n\n";r.c.forEach((res,id)=>{if(id!==except)res.write(d)})};
http.createServer(async(req,res)=>{
 const u=new URL(req.url,"http://x"),p=u.pathname;
 if(p=="/api/create"&&req.method=="POST"){const c=newCode();rooms.set(c,{c:new Map(),p:{},t:Date.now()});return json(res,{code:c})}
 if(p=="/api/room"){const r=rooms.get((u.searchParams.get("code")||"").toUpperCase());return json(res,{ok:!!r&&r.c.size<12})}
 if(p=="/api/presence"&&req.method=="POST"){
  const b=await readBody(req),r=rooms.get(b.room);
  if(!r||!r.p[b.id]||!b.patch||typeof b.patch!="object")return json(res,{ok:false},404);
  const o=r.p[b.id];for(const k in b.patch){if(b.patch[k]===null)delete o[k];else o[k]=b.patch[k]}
  bc(r,{t:"p",id:b.id,patch:b.patch},b.id);return json(res,{ok:true});
 }
 if(p=="/api/events"){
  const r=rooms.get((u.searchParams.get("room")||"").toUpperCase()),id=(u.searchParams.get("id")||"").slice(0,24);
  if(!r||!id||r.c.size>=12&&!r.c.has(id)){res.writeHead(404);return res.end()}
  res.writeHead(200,{"Content-Type":"text/event-stream","Cache-Control":"no-cache","Connection":"keep-alive","X-Accel-Buffering":"no"});
  r.c.set(id,res);r.p[id]=r.p[id]||{};res.write("data: "+JSON.stringify({t:"s",peers:r.p})+"\n\n");
  req.on("close",()=>{if(r.c.get(id)===res){r.c.delete(id);delete r.p[id];bc(r,{t:"l",id});r.t=Date.now()}});
  return;
 }
 let f=path.join(PUB,p=="/"?"index.html":p);
 if(!f.startsWith(PUB)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end("No encontrado")}
 res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream","Cache-Control":"no-cache"});fs.createReadStream(f).pipe(res);
}).listen(PORT,()=>console.log("Camaleón Online en http://localhost:"+PORT));
setInterval(()=>{rooms.forEach((r,c)=>{r.c.forEach(res=>res.write(": ping\n\n"));if(!r.c.size&&Date.now()-r.t>600000)rooms.delete(c)})},20000);
