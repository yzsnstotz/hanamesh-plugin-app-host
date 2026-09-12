import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { connect } from 'node:net';
import { randomBytes } from 'node:crypto';
import { FixedGateway } from '../src/index.js';
import { external,http,parentOrigin } from './helpers.mjs';
async function gateway(t){
  const {origin:upstream}=await external(t);const active=new Set(['alice:view-a','alice:view-b']);
  const g=new FixedGateway({upstream,parentOrigin,isLeaseActive:key=>active.has(key),cookieAllowlist:['app_session','app_pref']});
  await g.start();t.after(()=>g.close());
  const ticket=g.issue('alice:view-a');const response=await http(ticket,{headers:{referer:parentOrigin+'/workspace','sec-fetch-dest':'iframe'}});
  assert.equal(response.status,303);const cookie=response.headers['set-cookie'][0].split(';')[0];
  return{g,active,upstream,ticket,cookie};
}
test('H13: fixed gateway changes only XFO/frame-ancestors; preserves HTML, gzip and application headers',async t=>{
  const {g,upstream,cookie}=await gateway(t);
  for(const path of ['/','/gzip']){
    const a=await http(upstream+path),b=await http(g.origin+path,{headers:{cookie}});
    assert.equal(b.status,a.status);assert.deepEqual(b.body,a.body);assert(!b.headers['x-frame-options']);
    assert(b.headers['content-security-policy'].includes(`frame-ancestors ${parentOrigin}`));
    for(const [name,value] of Object.entries(a.headers))if(!['x-frame-options','content-security-policy','connection','keep-alive','date'].includes(name))assert.deepEqual(b.headers[name],value,name);
    if(path==='/')assert.equal(b.headers['content-security-policy'],`default-src 'self'; script-src 'self' 'sha256-fixture'; frame-ancestors ${parentOrigin}; object-src 'none'`);
  }
});
test('H14: gateway requires live capability; denies foreign origins, top navigation, arbitrary targets and ticket reuse',async t=>{
  const {g,active,ticket,cookie}=await gateway(t);
  assert.equal((await http(g.origin)).status,403);
  assert.equal((await http(ticket,{headers:{referer:parentOrigin,'sec-fetch-dest':'iframe'}})).status,403);
  for(const headers of [{cookie,origin:'https://attacker.invalid'},{cookie,'sec-fetch-dest':'document'},{cookie,host:'attacker.invalid'}])assert.equal((await http(g.origin,{headers})).status,403);
  const absolute=await new Promise((resolve,reject)=>{
    const req=request(g.origin,{path:'http://example.invalid:80/internal',headers:{cookie}},res=>{res.resume();res.once('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();
  });assert.equal(absolute,403);
  active.delete('alice:view-a');assert.equal((await http(g.origin,{headers:{cookie}})).status,403);
});
test('H14: gateway strips DSH credentials, control headers and unregistered cookies',async t=>{
  const {g,cookie}=await gateway(t);const r=await http(g.origin+'/headers',{headers:{cookie:cookie+'; DSH_AUTH=secret; app_session=one; random=two',authorization:'Bearer host-secret','x-dsh-session':'secret','x-hanamesh-client':'workspace-v1'}});
  assert.equal(r.status,200);assert.equal(r.json.cookie,'app_session=one');assert(!r.json.authorization);assert(!r.json['x-dsh-session']);assert(!r.json['x-hanamesh-client']);assert(!r.body.includes('host-secret'));
});
test('AH gateway: uploads, SSE, relative application paths and redirects retain transport semantics',async t=>{
  const {g,cookie}=await gateway(t);const payload=randomBytes(128*1024);
  const upload=await http(g.origin+'/echo',{method:'POST',headers:{cookie,'content-type':'application/octet-stream'},body:payload});assert.deepEqual(upload.body,payload);
  const sse=await new Promise((resolve,reject)=>{
    const chunks=[];const req=request(g.origin+'/sse',{headers:{cookie}},res=>{res.on('data',d=>chunks.push(d.toString()));res.on('end',()=>resolve(chunks));});req.on('error',reject);req.end();
  });assert.deepEqual(sse,['data: one\n\n','data: two\n\n']);
  assert((await http(g.origin+'/second',{headers:{cookie}})).body.includes('Second'));
  const redir=await http(g.origin+'/redirect',{headers:{cookie}});assert.equal(redir.status,302);assert.equal(redir.headers.location,'http://example.invalid/never-followed');
});
test('AH gateway: real WebSocket upgrade preserves frame bytes',async t=>{
  const {g,cookie}=await gateway(t);const u=new URL(g.origin);
  const raw=await new Promise((resolve,reject)=>{
    const socket=connect(Number(u.port),u.hostname);let data=Buffer.alloc(0);const timer=setTimeout(()=>{socket.destroy();reject(new Error('WebSocket timeout'));},3000);
    socket.on('connect',()=>socket.write(`GET /socket HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\nCookie: ${cookie}\r\nOrigin: ${g.origin}\r\n\r\n`));
    socket.on('data',chunk=>{data=Buffer.concat([data,chunk]);const at=data.indexOf('\r\n\r\n');if(at>=0&&data.length>=at+8){clearTimeout(timer);socket.destroy();resolve({headers:data.subarray(0,at).toString(),frame:data.subarray(at+4)});}});
    socket.on('error',reject);
  });assert(raw.headers.startsWith('HTTP/1.1 101'));assert.deepEqual(raw.frame,Buffer.from([0x81,2,0x4f,0x4b]));
});
