import http from 'node:http';
import {createHash} from 'node:crypto';
const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/api/force-error')){req.socket.destroy();return;}
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({url:req.url,headers:req.headers}));
});
server.on('upgrade',(req,socket)=>{
  const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  socket.on('error',()=>{});
  socket.on('data',data=>{if((data[0]&15)===8)socket.end(Buffer.from([0x88,0]));});
});
server.listen(4321,'0.0.0.0');
