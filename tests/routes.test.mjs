import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHttpHandler } from '../src/index.js';
import { setup,http,input,until } from './helpers.mjs';
async function api(t){
  let handler;const server=createServer((req,res)=>handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${server.address().port}`;t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));
  const {host}=await setup(t,{origin});handler=createHttpHandler(host,{parentOrigin:origin,authenticate:req=>req.headers.authorization==='Bearer test-owner'?{principalId:'alice'}:req.headers.authorization==='Bearer test-other'?{principalId:'bob'}:null,authorize:()=>true});
  const headers={'content-type':'application/json',origin,'x-hanamesh-client':'workspace-v1',authorization:'Bearer test-owner'};
  return{origin,host,headers,post:(path,body,overrides={})=>http(origin+path,{method:'POST',headers:{...headers,...overrides},body:JSON.stringify(body)})};
}
test('H14: every browser command/env/cwd/path/url override is rejected before spawn',async t=>{
  const a=await api(t);for(const [key,value] of Object.entries({command:'/bin/sh',args:['-c','touch /tmp/forbidden'],env:{DSH_TOKEN:'x'},cwd:'/tmp',dataDir:'/tmp',url:'http://example.invalid',pid:1,principalId:'other'})){
    const r=await a.post('/apps/open',{...input('malicious'),[key]:value});assert.equal(r.status,400,key);assert.equal(r.json.error.code,'UNKNOWN_FIELDS');
  }assert.equal(a.host.instanceList().length,0);
  assert.equal((await a.post('/apps/open',{...input(),appId:'../escape'})).status,400);
  assert.equal((await a.post('/apps/open',input('v','not-registered'))).status,404);
});
test('H14: control routes require authentication, CSRF header, exact origin and host',async t=>{
  const a=await api(t);assert.equal((await a.post('/apps/open',input(),{authorization:'wrong'})).status,401);
  assert.equal((await a.post('/apps/open',input(),{origin:'http://attacker.invalid'})).status,403);
  assert.equal((await a.post('/apps/open',input(),{'x-hanamesh-client':'wrong'})).status,403);
  assert.equal((await a.post('/apps/open',input(),{host:'attacker.invalid'})).status,403);
  assert.equal((await a.post('/apps/open',input(),{'sec-fetch-dest':'iframe'})).status,403);
  assert.equal((await http(a.origin+'/apps/open',{headers:a.headers})).status,405);
  assert.equal(a.host.instanceList().length,0);
});
test('AH routes: startup receipt can be cancelled and tokens are not leaked through list/events',async t=>{
  const a=await api(t);const r=await a.post('/apps/open',input('http-view'));assert.equal(r.status,200);assert(r.json.leaseToken);assert(!('pid'in r.json.instance));assert(!('dataDir'in r.json.instance));
  const lease={viewId:r.json.lease.viewId,leaseToken:r.json.leaseToken};
  const wrong=await a.post('/apps/close',lease,{authorization:'Bearer test-other'});assert.equal(wrong.status,403);
  for(const path of ['/hanamesh/apps','/apps/events']){const list=await http(a.origin+path,{headers:a.headers});assert.equal(list.status,200);assert(!list.body.includes(r.json.leaseToken));assert(!list.body.includes('tokenHash'));}
  assert.equal((await a.post('/apps/close',lease)).status,200);assert.equal(a.host.instance(r.json.instance.id,'alice').status,'stopped');
});
