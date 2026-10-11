import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkspaceAppClient} from '../src/client.js';
import * as descriptor from '../src/descriptor.js';
const {loopbackOrigin}=descriptor;
const workspaceOrigin=(...args)=>descriptor.workspaceOrigin(...args);
import {FixedGateway, ancestorOrigin} from '../src/gateway.js';
import {setup, definition, input, external, http} from './helpers.mjs';
import {createHttpHandler} from '../src/routes.js';
import {createLibraryHttpHandler} from '../src/library/routes.js';
import {createRouterHttpHandler} from '../src/router/routes.js';
import {createServer} from 'node:http';

test('AH-D01: Desktop workspace exact origin works in SDK; application targets stay HTTP loopback', async()=>{
  assert.equal(typeof descriptor.workspaceOrigin,'function');
  assert.equal(workspaceOrigin('dsh-app://app'),'dsh-app://app');
  assert.equal(ancestorOrigin('dsh-app://app'),'dsh-app://app');
  let fetched;
  const sdk=new WorkspaceAppClient({origin:'dsh-app://app',fetch:async(url)=>{fetched=url;return{ok:true,json:async()=>({apps:[]})};}});
  await sdk.list();assert.equal(fetched,'dsh-app://app/hanamesh/apps');
  for(const origin of ['dsh-app://shell','dsh-app://app:12','dsh-app://user@app','dsh-app://app/','dsh-app://app/path','dsh-app://app?x','null','https://app','http://evil:12']){
    assert.throws(()=>workspaceOrigin(origin),{code:'INVALID_ORIGIN'});
    assert.throws(()=>new WorkspaceAppClient({origin}));
  }
  assert.throws(()=>loopbackOrigin('dsh-app://app'),{code:'INVALID_ORIGIN'});
  assert.throws(()=>new FixedGateway({upstream:'dsh-app://app',parentOrigin:'dsh-app://app',isLeaseActive:()=>true}),{code:'INVALID_ORIGIN'});
});

test('AH-D02: Desktop gateway serves unchanged app document after exact parent bootstrap and revokes old lease', async t=>{
  const {origin}=await external(t);let active=true;
  const g=new FixedGateway({upstream:origin,parentOrigin:'dsh-app://app',isLeaseActive:()=>active});await g.start();t.after(()=>g.close());
  const url=g.issue('view');
  assert.equal((await http(url,{headers:{'sec-fetch-dest':'iframe',referer:'dsh-app://shell/'}})).status,403);
  const grant=await http(url,{headers:{'sec-fetch-dest':'iframe',referer:'dsh-app://app/'}});assert.equal(grant.status,303);
  const cookie=grant.headers['set-cookie'][0].split(';')[0];
  const result=await http(g.origin+'/',{headers:{cookie,'sec-fetch-dest':'iframe'}});
  assert.equal(result.status,200);assert.deepEqual(result.body,(await http(origin+'/')).body);
  assert.match(result.headers['content-security-policy'],/frame-ancestors dsh-app:\/\/app/);
  active=false;assert.equal((await http(g.origin+'/',{headers:{cookie}})).status,403);
});

test('AH-D03: app, market and router accept authenticated Desktop forwarding on exact transport only', async t=>{
  const {host}=await setup(t,{origin:'dsh-app://app',def:definition({embedding:'gateway'})});
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const transportOrigin=`http://127.0.0.1:${server.address().port}`;
  const auth={parentOrigin:'dsh-app://app',transportOrigin,authenticate:async req=>req.headers.authorization==='Bearer fixture'?{principalId:'fixture'}:null,authorize:async()=>true};
  const apps=createHttpHandler(host,auth),market=createLibraryHttpHandler({install:async()=>({status:'already-installed'}),installedSnapshot:async()=>({plugins:[]})},auth),router=createRouterHttpHandler({enableGateway:async()=>({})},auth);
  server.on('request',(req,res)=>(req.url.startsWith('/hanamesh/library')?market:req.url.startsWith('/hanamesh/router')?router:apps)(req,res));
  const headers={authorization:'Bearer fixture','x-hanamesh-client':'workspace-v1','content-type':'application/json'};
  for(const [path,body] of [['/apps/open',input('desktop-view')],['/hanamesh/library/install',{itemId:'fixture'}],['/hanamesh/router/gateway',{enabled:false}]]){
    const result=await http(transportOrigin+path,{method:'POST',headers,body:JSON.stringify(body)});assert.equal(result.status,200,JSON.stringify(result.json));
    for(const extra of [{authorization:''},{host:'app'},{origin:'dsh-app://shell'},{'sec-fetch-dest':'iframe'},{'x-hanamesh-client':''}])assert.ok((await http(transportOrigin+path,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)})).status>=400);
  }
  const receipt=(await http(transportOrigin+'/apps/resume',{method:'POST',headers,body:JSON.stringify({viewId:'desktop-view',leaseToken:host.list('fixture').leases?.[0]?.leaseToken})}));
  assert.ok(receipt.status>=400); // public list never exposes a lease token
});

test('AH-D08: ordinary HTTP writes still reject missing Origin in all three control planes',async()=>{
  const auth={parentOrigin:'http://127.0.0.1:49123',authenticate:async()=>({principalId:'fixture'}),authorize:async()=>true};
  for(const [handler,path] of [[createHttpHandler({},auth),'/apps/open'],[createLibraryHttpHandler({},auth),'/hanamesh/library/install'],[createRouterHttpHandler({},auth),'/hanamesh/router/gateway']]){
    let status,body;
    await handler({headers:{host:'127.0.0.1:49123','x-hanamesh-client':'workspace-v1','content-type':'application/json'},url:path,method:'POST'}, {writeHead:value=>{status=value;},end:value=>{body=JSON.parse(value);}});
    assert.equal(status,403);assert.equal(body.error.code,'CSRF_DENIED');
  }
});
