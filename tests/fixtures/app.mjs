import { createServer } from 'node:http';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
const args=Object.fromEntries(process.argv.slice(2).map(s=>{const p=s.indexOf('=');return[s.slice(0,p),s.slice(p+1)];}));
const root=args.data;await mkdir(root,{recursive:true});
const evidence={pid:process.pid,runtimeId:args.runtimeId,instanceId:args.instanceId,dataDir:root,home:process.env.HOME,
  inheritedSecret:process.env.DSH_TOKEN??null,
  credentialEnv:{EXAMPLE_API_KEY:process.env.EXAMPLE_API_KEY??null,LANGCHAIN_PROVIDER:process.env.LANGCHAIN_PROVIDER??null,UNDECLARED_KEY:process.env.UNDECLARED_KEY??null},
  homeAuth:await readFile(join(process.env.HOME??'','.codex','auth.json'),'utf8').catch(()=>null),
  dataAuth:await readFile(join(root,'auth','openai-codex.json'),'utf8').catch(()=>null)};
if(process.env.EXAMPLE_API_KEY)console.log('fixture-sees-key '+process.env.EXAMPLE_API_KEY);
await writeFile(join(root,'runtime-evidence.json'),JSON.stringify(evidence));
await writeFile(join(root,`write-${args.runtimeId}.txt`),`Written by runtime ${args.runtimeId}\n`);
if(args.ignoreTerm==='true')process.on('SIGTERM',()=>{});
if(args.descendant==='true'){
  const child=spawn(process.execPath,['-e',`require('node:fs').writeFileSync(${JSON.stringify(join(root,'descendant.pid'))},String(process.pid));process.on('SIGTERM',()=>{});setInterval(()=>{},1000)`],{stdio:'ignore'});
  child.unref();
}
const html=Buffer.from('<!doctype html><html><body>HANAMESH_FIXTURE <a href="/second">Second</a></body></html>\n');
const server=createServer(async(req,res)=>{
  if(req.url==='/health'){
    if(args.neverReady==='true'){res.writeHead(503);res.end('not ready');return;}
    res.writeHead(200,{'x-app-identity':'HANAMESH_FIXTURE'});res.end('HANAMESH_FIXTURE');return;
  }
  if(req.url==='/identity'){res.setHeader('content-type','application/json');res.end(JSON.stringify(evidence));return;}
  if(req.url==='/exit'){res.end('bye');setTimeout(()=>process.exit(7),30);return;}
  if(req.url==='/headers'){res.setHeader('content-type','application/json');res.end(JSON.stringify(req.headers));return;}
  if(req.url==='/echo'){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);res.setHeader('content-type','application/octet-stream');res.end(Buffer.concat(chunks));return;
  }
  if(req.url==='/sse'){
    res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache'});res.write('data: one\n\n');setTimeout(()=>res.end('data: two\n\n'),70);return;
  }
  if(req.url==='/redirect'){res.writeHead(302,{location:'http://example.invalid/never-followed'});res.end();return;}
  if(req.url==='/gzip'){
    const {gzipSync}=await import('node:zlib');res.writeHead(200,{'content-encoding':'gzip','content-type':'text/html'});res.end(gzipSync(html));return;
  }
  if(req.url==='/data'){res.end(await readFile(join(root,`write-${args.runtimeId}.txt`)));return;}
  res.writeHead(200,{'content-type':'text/html','content-length':html.length,'x-frame-options':'DENY',
    'content-security-policy':"default-src 'self'; script-src 'self' 'sha256-fixture'; frame-ancestors 'none'; object-src 'none'",
    'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin',
    'set-cookie':['app_session=one; HttpOnly; Path=/','app_pref=two; Path=/'], 'x-fixture':'unchanged'});
  res.end(html);
});
server.on('upgrade',(req,socket,head)=>{
  const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  // Test transport framing: echo server text frame, no WebSocket dependency.
  socket.write(Buffer.from([0x81,2,0x4f,0x4b]));socket.on('data',()=>{});socket.on('error',()=>{});
});
setTimeout(()=>server.listen(Number(args.port),args.bind??'127.0.0.1',()=>{
  console.log('FIXTURE_READY');console.log('Authorization: Bearer fixture-secret-value');
  console.log('{"token":"json-sensitive-value"}');
}),Number(args.delay??0));
