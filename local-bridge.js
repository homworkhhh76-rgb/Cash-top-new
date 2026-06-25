#!/usr/bin/env node
/* Oscar local scanner bridge: run `node local-bridge.js`, then open http://YOUR-PC-IP:8787/cashier.html on the cashier and mobile. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.css':'text/css; charset=utf-8','.md':'text/plain; charset=utf-8'};
const sessions = new Map();
const clients = new Set();
function send(ws, obj){
  if(ws.destroyed) return;
  const data = Buffer.from(JSON.stringify(obj));
  let header;
  if(data.length < 126){ header = Buffer.from([0x81, data.length]); }
  else if(data.length < 65536){ header = Buffer.alloc(4); header[0]=0x81; header[1]=126; header.writeUInt16BE(data.length,2); }
  else { header = Buffer.alloc(10); header[0]=0x81; header[1]=127; header.writeBigUInt64BE(BigInt(data.length),2); }
  ws.write(Buffer.concat([header,data]));
}
function parseFrames(buffer){
  const out=[]; let i=0;
  while(i+2<=buffer.length){
    const b1=buffer[i++], b2=buffer[i++]; let len=b2&127; const masked=!!(b2&128);
    if(len===126){ if(i+2>buffer.length) break; len=buffer.readUInt16BE(i); i+=2; }
    else if(len===127){ if(i+8>buffer.length) break; len=Number(buffer.readBigUInt64BE(i)); i+=8; }
    let mask; if(masked){ if(i+4>buffer.length) break; mask=buffer.slice(i,i+4); i+=4; }
    if(i+len>buffer.length) break;
    let payload=buffer.slice(i,i+len); i+=len;
    if(masked){ payload=Buffer.from(payload.map((v,idx)=>v^mask[idx%4])); }
    if((b1 & 0x0f)===8) out.push({close:true}); else out.push({text:payload.toString('utf8')});
  }
  return out;
}
const server=http.createServer((req,res)=>{
  let url = decodeURIComponent(req.url.split('?')[0]);
  if(url==='/' || url==='') url='/index.html';
  const file=path.normalize(path.join(ROOT,url));
  if(!file.startsWith(ROOT)){ res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file,(err,data)=>{
    if(err){ res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-cache'});
    res.end(data);
  });
});
server.on('upgrade',(req,socket)=>{
  if(!req.url.startsWith('/bridge')) return socket.destroy();
  const key=req.headers['sec-websocket-key'];
  const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  clients.add(socket);
  socket.on('data',buf=>{
    for(const f of parseFrames(buf)){
      if(f.close) return socket.end();
      try{
        const msg=JSON.parse(f.text);
        if(msg.type==='registerCashier'){
          sessions.set(`${msg.code}|${msg.answer}`, socket);
          send(socket,{type:'paired',role:'cashier',ok:true});
        }
        if(msg.type==='barcode'){
          const target=sessions.get(`${msg.code}|${msg.answer}`);
          if(target){ send(target,{type:'barcode',barcode:msg.barcode}); send(socket,{type:'sent',ok:true}); }
          else send(socket,{type:'error',message:'session not found'});
        }
      }catch(e){ send(socket,{type:'error',message:e.message}); }
    }
  });
  socket.on('close',()=>{clients.delete(socket); for(const [k,v] of sessions) if(v===socket) sessions.delete(k);});
  socket.on('error',()=>{});
});
server.listen(PORT,'0.0.0.0',()=>{
  const ips=[]; for(const net of Object.values(os.networkInterfaces())) for(const n of net||[]) if(n.family==='IPv4' && !n.internal) ips.push(n.address);
  console.log('Oscar local bridge running. Open one of these on cashier and phone:');
  ips.forEach(ip=>console.log(`  http://${ip}:${PORT}/login.html`));
  console.log(`  http://localhost:${PORT}/login.html`);
});
