import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createLibraryService } from '../src/library/service.js';
import { createLibraryHttpHandler } from '../src/library/routes.js';
import { http } from './helpers.mjs';

const N200='a'.repeat(200), N201='a'.repeat(201), N214='@aaaaa/'+'a'.repeat(207), N215='a'.repeat(215);
function fixture({catalogFixture}={}){
  let writes=0,fetches=0,installs=0;
  const domain={global:{get:async()=>({schema:1,revision:0,sources:[]}),set:async()=>{writes++;}},close:async()=>{}};
  const service=createLibraryService({domain,host:{instanceList:()=>[]},config:{fixture:catalogFixture,fetchImpl:async()=>{fetches++;throw Error('catalog must not be fetched');}},installer:{install:()=>{installs++;}},dataRoot:'/tmp',ledgerReader:async()=>({})});
  return{service,effects:()=>({writes,fetches,installs})};
}

test('P06A-T01/T02/T03/T05/T06/T07: target validates before support limit, replaces and consumes only exact ID without persistent effects',async()=>{
  const{service,effects}=fixture();await service.init();
  assert.equal(service.pendingTarget(),null);
  const a=service.requestTarget({packageName:'@hanamesh/app-vibe-trading'});
  assert.match(a.targetId,/^[0-9a-f-]{36}$/);assert.equal(a.packageName,'@hanamesh/app-vibe-trading');
  const b=service.requestTarget({packageName:N200});assert.notEqual(a.targetId,b.targetId);
  for(const[name,code,length]of [[N201,'TARGET_SEARCH_UNSUPPORTED',201],[N214,'TARGET_SEARCH_UNSUPPORTED',214],[N215,'INVALID_INPUT',215],['A'.repeat(205),'INVALID_INPUT',205],['../x','INVALID_INPUT'],['@scope/','INVALID_INPUT'],['@a/b/c','INVALID_INPUT'],['%40x','INVALID_INPUT'],[' x','INVALID_INPUT'],['x ','INVALID_INPUT'],['','INVALID_INPUT'],[undefined,'INVALID_INPUT'],[null,'INVALID_INPUT'],[7,'INVALID_INPUT']]){
    assert.throws(()=>service.requestTarget({packageName:name}),error=>error.code===code&&(code!=='TARGET_SEARCH_UNSUPPORTED'||(error.details.maxLength===200&&error.details.length===length)));
    assert.equal(service.pendingTarget().targetId,b.targetId);
  }
  assert.deepEqual(service.consumeTarget({targetId:a.targetId}),{consumed:false});
  assert.equal(service.pendingTarget().targetId,b.targetId);
  assert.deepEqual(service.consumeTarget({targetId:b.targetId}),{consumed:true});
  assert.deepEqual(service.consumeTarget({targetId:b.targetId}),{consumed:false});
  assert.equal(service.pendingTarget(),null);
  service.requestTarget({packageName:'hanamesh-core'});assert.equal(service.pendingTarget().protected,true);
  assert.deepEqual(effects(),{writes:0,fetches:0,installs:0});
  const fresh=fixture().service;await fresh.init();assert.equal(fresh.pendingTarget(),null);
});

test('P06A-T03: N200 passes the existing client search boundary',async()=>{
  const{service}=fixture({catalogFixture:new URL('./fixtures/catalog/provider-page.json',import.meta.url).pathname});await service.init();
  const page=await service.list({q:N200,category:''});assert.ok(Array.isArray(page.items));
});

test('P06A-T01/T04/T05: HTTP target uses existing Host, Origin, frame, CSRF, auth and authorization chain',async t=>{
  const{service}=fixture();await service.init();
  let authenticated=true,authorized=true;
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  server.on('request',createLibraryHttpHandler(service,{parentOrigin:origin,authenticate:async()=>authenticated?{principalId:'p'}:null,authorize:async()=>authorized}));
  const post=async(path,body,headers={})=>{const response=await http(origin+path,{method:'POST',headers:{origin,'x-hanamesh-client':'workspace-v1',...headers},body:JSON.stringify(body)});return{status:response.status,body:response.json};};
  const get=async(path,headers={})=>{const response=await http(origin+path,{headers});return{status:response.status,body:response.json};};
  const path='/hanamesh/library/target',consume=path+'/consume';
  const accepted=await post(path,{packageName:'@hanamesh/app-vibe-trading'});assert.equal(accepted.status,202);assert.equal(typeof accepted.body.traceId,'string');
  const read=await get(path);assert.equal(read.status,200);assert.deepEqual(read.body.target,{targetId:accepted.body.targetId,packageName:accepted.body.packageName,protected:false});
  for(const input of [{},{packageName:'a',extra:1},{packageName:7}]){const response=await post(path,input);assert.equal(response.status,400);assert.equal((await get(path)).body.target.targetId,accepted.body.targetId);}
  for(const [headers,code] of [[{host:'localhost:'+server.address().port},'HOST_DENIED'],[{origin:'https://other.example'},'ORIGIN_DENIED'],[{origin:''},'CSRF_DENIED'],[{'x-hanamesh-client':''},'CSRF_DENIED'],[{'sec-fetch-dest':'iframe'},'FRAME_CONTROL_DENIED']]){const response=await post(path,{packageName:'x'},headers);assert.equal(response.status,403,JSON.stringify({headers,response}));assert.equal(response.body.error.code,code);}
  assert.equal((await get(path,{origin:'https://other.example'})).body.error.code,'ORIGIN_DENIED');
  authenticated=false;assert.equal((await post(path,{packageName:'x'})).status,401);authenticated=true;authorized=false;assert.equal((await post(path,{packageName:'x'})).status,403);authorized=true;
  assert.equal((await post(consume,{targetId:'old'})).body.consumed,false);
  assert.equal((await post(consume,{targetId:accepted.body.targetId})).body.consumed,true);
  assert.equal((await get(path)).body.target,null);
});
