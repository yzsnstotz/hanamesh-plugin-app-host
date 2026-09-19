import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProviderSources } from '../src/router/sources.js';
import { createRouterHttpHandler, ROUTER_ROUTES } from '../src/router/routes.js';
import { http } from './helpers.mjs';

const apps={list:()=>({apps:[{id:'vibe-trading',deployments:[{mode:'owned',credentialEnv:[{env:'OPENAI_API_KEY',providers:['openai','coding-oauth-gateway']}]}]}]})};
const credentials={describe:async ref=>({configured:ref==='OPENAI_API_KEY',writable:true,source:'file'}),resolve:async()=>({value:'provider-secret'})};

test('AH-R02 dsh-models describes refs without resolving values and adds pinned llm metadata',async()=>{
  let resolves=0;const sources=createProviderSources({credentials:{...credentials,resolve:async()=>{resolves++;return{value:'secret'};}},apps,
    llm:()=>({listProviders:()=>[{id:'openai',name:'OpenAI Catalog'}],listModels:async()=>[{id:'gpt-test'}]}),webOrigin:'http://127.0.0.1:9',fetcher:async()=>new Response('',{status:404})});
  const provider=(await sources.list()).find(row=>row.id==='openai');assert.deepEqual(provider.models,['gpt-test']);assert.equal(provider.displayName,'OpenAI Catalog');assert.equal(provider.state,'configured');assert.equal(resolves,0);
  assert.equal((await sources.resolve({kind:'api-key',ref:'OPENAI_API_KEY'})).value,'secret');assert.equal(resolves,1);
});

test('AH-R03 coding gateway maps 404, off, configured and unreachable without exposing apiKey',async()=>{
  let state='missing';const fetcher=async(url,init={})=>{
    if(state==='missing')return new Response('',{status:404});
    if(state==='unreachable')throw new Error('offline');
    if(url.endsWith('/reveal'))return Response.json({apiKey:'gateway-secret',keyHint:'…cret'});
    if(init.method==='PATCH')return Response.json({enabled:true});
    return Response.json(state==='off'?{enabled:false,running:false,models:[]}:{enabled:true,running:true,port:18080,models:['gpt-test']});
  };
  const sources=createProviderSources({credentials,apps,webOrigin:'http://127.0.0.1:4000',fetcher});
  assert.equal((await sources.list()).some(row=>row.source==='coding-oauth-gateway'),false);
  state='off';assert.equal((await sources.list()).at(-1).state,'gateway-off');
  state='configured';const listed=(await sources.list()).at(-1);assert.equal(listed.state,'configured');assert.deepEqual(listed.models,['gpt-test']);assert(!JSON.stringify(listed).includes('gateway-secret'));
  const resolved=await sources.resolve({kind:'provider',providerId:'coding-oauth-gateway'});assert.equal(resolved.value,'gateway-secret');assert.equal(resolved.provider.baseUrl,'http://127.0.0.1:18080/v1');
  state='unreachable';assert.equal((await sources.list()).at(-1).state,'unreachable');
});

test('AH-R09 file gateway requires mode 0600 and returns the same provider contract',async t=>{
  const home=await mkdtemp(join(tmpdir(),'hm-router-file-'));t.after(()=>rm(home,{recursive:true,force:true}));const path=join(home,'.coding-oauth-gateway.json');
  await writeFile(path,JSON.stringify({enabled:true,port:18081,models:['file-model'],apiKey:'file-secret',keyHint:'…cret'}),{mode:0o600});
  const sources=createProviderSources({credentials,apps,codingOauth:{mode:'file'},dshHome:home,webOrigin:'http://127.0.0.1:9'});
  assert.equal((await sources.list()).at(-1).baseUrl,'http://127.0.0.1:18081/v1');assert.equal((await sources.resolve({kind:'provider',providerId:'coding-oauth-gateway'})).value,'file-secret');
  await chmod(path,0o644);assert.equal((await sources.list()).at(-1).state,'unreachable');
});

test('AH-R08 every router route rejects missing client header, wrong origin, iframe and unauthenticated calls',async t=>{
  const router={providers:async()=>[],plan:async()=>({}),grant:async()=>({}),revoke:async()=>({}),setMode:async()=>{},enableGateway:async()=>({})};
  let handler;const server=createServer((req,res)=>handler(req,res));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  handler=createRouterHttpHandler(router,{parentOrigin:origin,authenticate:req=>req.headers.authorization==='Bearer owner'?{principalId:'owner'}:null,authorize:()=>true});
  for(const path of ROUTER_ROUTES){
    const read=path.endsWith('/providers')||path.endsWith('/plan'),url=origin+path+(path.endsWith('/plan')?'?appId=vibe-trading':'');
    const call=headers=>http(url,{method:read?'GET':'POST',headers:{...(read?{}:{'content-type':'application/json'}),...headers},...(read?{}:{body:JSON.stringify({appId:'vibe-trading',entryId:'env:OPENAI_API_KEY',subject:{kind:'api-key',ref:'OPENAI_API_KEY'},mode:'managed',enabled:true})})});
    assert.equal((await call({origin,authorization:'Bearer owner'})).status,403,path+' client');
    assert.equal((await call({origin:'http://attacker.invalid','x-hanamesh-client':'workspace-v1',authorization:'Bearer owner'})).status,403,path+' origin');
    assert.equal((await call({origin,'x-hanamesh-client':'workspace-v1',authorization:'Bearer owner','sec-fetch-dest':'iframe'})).status,403,path+' iframe');
    assert.equal((await call({origin,'x-hanamesh-client':'workspace-v1'})).status,401,path+' auth');
  }
});
