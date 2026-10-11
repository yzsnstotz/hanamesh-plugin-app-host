import test from 'node:test';
import assert from 'node:assert/strict';
import {FixedGateway} from '../src/gateway.js';
import {external,http} from './helpers.mjs';
test('D26: Desktop natural no-Referer iframe receives only controlled bootstrap, never application data',async t=>{
 const {origin}=await external(t); const g=new FixedGateway({upstream:origin,parentOrigin:'dsh-app://app',isLeaseActive:()=>true});await g.start();t.after(()=>g.close());
 const url=await g.issueAsync('view'); const page=await http(url,{headers:{'sec-fetch-dest':'iframe','sec-fetch-site':'cross-site'}});
 assert.equal(page.status,200);assert.match(page.body.toString(),/event.origin/);assert.match(page.body.toString(),/event.source/);
 assert.equal((await http(new URL(url).origin+'/',{headers:{'sec-fetch-site':'same-origin'}})).status,403);
});
test('D26: single-use challenge authorization, scope isolation, expiry and cookie-less data evidence',async t=>{
 const {origin}=await external(t);const active=new Set(['a','b']);
 const g=new FixedGateway({upstream:origin,parentOrigin:'dsh-app://app',isLeaseActive:key=>active.has(key)});await g.start();t.after(()=>g.close());
 const url=await g.issueAsync('a'), other=await g.issueAsync('b'),child=new URL(url).origin,challenge=new URL(url).pathname.split('/').at(-1);
 assert.notEqual(child,new URL(other).origin);
 assert.throws(()=>g.authorizeChallenge('a',child,challenge),{code:'GATEWAY_CHALLENGE_DENIED'});
 const page=await http(url,{headers:{'sec-fetch-dest':'iframe','sec-fetch-site':'cross-site'}});assert.equal(page.status,200);
 for(const [key,at,c] of [['b',child,challenge],['a',new URL(other).origin,challenge],['a',child,'0'.repeat(64)]])assert.throws(()=>g.authorizeChallenge(key,at,c),{code:'GATEWAY_CHALLENGE_DENIED'});
 const {authorization}=g.authorizeChallenge('a',child,challenge);
 assert.throws(()=>g.authorizeChallenge('a',child,challenge),{code:'GATEWAY_CHALLENGE_DENIED'});
 const exchange=extra=>http(child+'/__hanamesh_exchange',{method:'POST',headers:{origin:child,'sec-fetch-site':'same-origin','content-type':'application/json',...extra},body:JSON.stringify({challenge,authorization})});
 assert.equal((await exchange({origin:'null'})).status,403);assert.equal((await exchange({origin:'dsh-app://app'})).status,403);
 assert.equal((await exchange({})).status,204);assert.equal((await exchange({})).status,403);
 const headers={'sec-fetch-site':'same-origin',referer:child+'/'};
 const forwarded=await http(child+'/',{headers});assert.equal(forwarded.status,200);assert.deepEqual(forwarded.body,(await http(origin+'/')).body);
 for(const h of [{},{'sec-fetch-site':'cross-site',referer:child+'/'},{'sec-fetch-site':'same-origin'},{'sec-fetch-site':'same-origin',referer:new URL(other).origin+'/'},{origin:'null',...headers},{origin:'dsh-app://app','sec-fetch-site':'cross-site'}])assert.equal((await http(child+'/',{headers:h})).status,403);
 assert.equal((await http(new URL(other).origin+'/',{headers:{'sec-fetch-site':'same-origin',referer:new URL(other).origin+'/'}})).status,403);
 active.delete('a');assert.equal((await http(child+'/',{headers})).status,403);g.revokeInactive();
});
import {setup,input,leaseInput} from './helpers.mjs';
import {createHttpHandler} from '../src/routes.js';
import {createServer} from 'node:http';
test('D26: connection authentication and full lease ownership precede challenge issuance; generation and close revoke it',async t=>{
 const {host}=await setup(t,{origin:'dsh-app://app',def:(await import('./helpers.mjs')).definition({embedding:'gateway'})});
 const a=await host.open(input('a'),'alice'),b=await host.open(input('b'),'alice');
 const u=new URL(a.uiUrl),challenge=u.pathname.split('/').at(-1);await http(a.uiUrl,{headers:{'sec-fetch-dest':'iframe','sec-fetch-site':'cross-site'}});
 const req={...leaseInput(a),gatewayOrigin:u.origin,challenge};
 await assert.rejects(host.authorizeBootstrap(req,'bob'),{code:'LEASE_NOT_OWNED'});
 await assert.rejects(host.authorizeBootstrap({...req,...leaseInput(b)},'alice'),{code:'GATEWAY_CHALLENGE_DENIED'});
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const transport=`http://127.0.0.1:${server.address().port}`;server.on('request',createHttpHandler(host,{parentOrigin:'dsh-app://app',transportOrigin:transport,
 authenticate:async req=>req.headers.authorization==='Bearer fixture'?{principalId:'alice'}:null,authorize:async()=>true}));
 const post=headers=>http(transport+'/apps/bootstrap-authorize',{method:'POST',headers:{'content-type':'application/json','x-hanamesh-client':'workspace-v1',...headers},body:JSON.stringify(req)});
 assert.equal((await post({})).status,401);assert.equal((await post({authorization:'Bearer fixture',origin:'null'})).status,403);
 const result=await post({authorization:'Bearer fixture'});assert.equal(result.status,200);
 await host.close(leaseInput(a),'alice');
 await assert.rejects(host.authorizeBootstrap(req,'alice'),{code:'LEASE_EXPIRED'});
 assert.equal(host.instance(b.instance.id,'alice').status,'ready'); // another live view does not keep a's authority alive
});
import {connect} from 'node:net';
import {randomBytes} from 'node:crypto';
test('D26: cookie-less WS exact scoped Origin, denied wrong origins and immediate live-socket revocation',async t=>{
 const {origin}=await external(t);const active=new Set(['a','b']);const g=new FixedGateway({upstream:origin,parentOrigin:'dsh-app://app',isLeaseActive:k=>active.has(k)});await g.start();t.after(()=>g.close());
 const url=await g.issueAsync('a'),u=new URL(url),challenge=u.pathname.split('/').at(-1);await g.issueAsync('b');await http(url,{headers:{'sec-fetch-dest':'iframe'}});
 const {authorization}=g.authorizeChallenge('a',u.origin,challenge);assert.equal((await http(u.origin+'/__hanamesh_exchange',{method:'POST',headers:{origin:u.origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify({challenge,authorization})})).status,204);
 const ws=origin=>new Promise((resolve,reject)=>{const socket=connect(Number(u.port),u.hostname);let buf='';const timer=setTimeout(()=>{socket.destroy();reject(Error('WS observation deadline'));},2000);
  socket.once('connect',()=>socket.write(`GET /socket HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\nOrigin: ${origin}\r\n\r\n`));socket.on('data',chunk=>{buf+=chunk;if(buf.includes('\r\n\r\n')){clearTimeout(timer);resolve({socket,status:buf.split('\r\n')[0]});}});socket.once('error',reject);});
 for(const origin of ['null','dsh-app://app',g.origin,'http://127.0.0.1:1']){const result=await ws(origin);assert.match(result.status,/403/);result.socket.destroy();}
 const result=await ws(u.origin);assert.match(result.status,/101/);
 const closed=new Promise(r=>result.socket.once('close',r));active.delete('a');g.revokeInactive();await closed;assert(active.has('b'));
});
test('D26: expired challenge and generation recovery revoke pending exchange while another view is live',async t=>{
 const {host}=await setup(t,{origin:'dsh-app://app',def:(await import('./helpers.mjs')).definition({embedding:'gateway'})});
 const a=await host.open(input('a'),'alice');await host.open(input('b'),'alice');const u=new URL(a.uiUrl),challenge=u.pathname.split('/').at(-1);
 await http(a.uiUrl,{headers:{'sec-fetch-dest':'iframe'}});const auth=await host.authorizeBootstrap({...leaseInput(a),gatewayOrigin:u.origin,challenge},'alice');
 const recovered=await host.recoverView({viewId:'a',instanceId:a.instance.id,confirm:true},'alice');assert.equal(recovered.lease.generation,a.lease.generation+1);
 await assert.rejects(host.authorizeBootstrap({...leaseInput(a),gatewayOrigin:u.origin,challenge},'alice'),{code:'LEASE_NOT_OWNED'});
 await assert.rejects(host.authorizeBootstrap({...leaseInput(recovered),gatewayOrigin:u.origin,challenge},'alice'),{code:'GATEWAY_CHALLENGE_DENIED'});
 await assert.rejects(http(u.origin+'/__hanamesh_exchange',{method:'POST',headers:{origin:u.origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify({challenge,authorization:auth.authorization})}));
 const {origin}=await external(t);const g=new FixedGateway({upstream:origin,parentOrigin:'dsh-app://app',isLeaseActive:()=>true});await g.start();t.after(()=>g.close());
 const expired=await g.issueAsync('e'),c=new URL(expired).pathname.split('/').at(-1),child=g.children.get('e');child.tickets.get(c).expiresAt=Date.now()-1;
 assert.equal((await http(expired,{headers:{'sec-fetch-dest':'iframe'}})).status,403);assert.throws(()=>g.authorizeChallenge('e',child.origin,c),{code:'GATEWAY_CHALLENGE_DENIED'});
});
