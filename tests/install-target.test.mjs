import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {createLibraryService} from '../src/library/service.js';
import {createLibraryHttpHandler} from '../src/library/routes.js';
import {clientHarness,fakeClock,settle} from './fixtures/client-ui-harness.mjs';

async function library(t,installer){
  let state={schema:1,revision:0,sources:[]};
  const service=await createLibraryService({domain:{global:{get:async()=>state,set:async next=>{state=next;}},close:async()=>{}},host:{list:()=>({apps:[]}),instanceList:()=>[]},config:{fixture:resolve('tests/fixtures/catalog/provider-page.json')},installer}).init();
  t.after(()=>service.close());return service;
}
test('IT01: target resolves package or item against the market catalog; untrusted version/URL and mismatched identities are rejected before installation',async t=>{
  const service=await library(t);
  assert.equal(typeof service.resolveTarget,'function','market exposes its own resolver');
  const result=await service.resolveTarget({packageName:'@hanamesh/utility-plugin'});
  assert.equal(result.item.id,'com.hanamesh.utility-plugin');assert.equal(result.item.latestVersion,'1.0.0');assert.equal(result.item.kind,'plugin');assert.equal(result.source.kind,'fixture');
  assert.equal((await service.resolveTarget({itemId:result.item.id})).item.package.name,'@hanamesh/utility-plugin');
  for(const input of [{},{itemId:result.item.id,packageName:'wrong-package'},{packageName:'../escape'},{packageName:'@hanamesh/utility-plugin',version:'9.0.0'},{itemId:result.item.id,url:'https://evil.example/pkg.tgz'}])await assert.rejects(service.resolveTarget(input));
  assert.equal(service.events().events.length,0);
});
test('IT02: target HTTP reads retain host, origin, non-frame, authentication and authorization checks and cannot start an install',async t=>{
  const service=await library(t);const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const origin='http://127.0.0.1:'+server.address().port;
  server.on('request',createLibraryHttpHandler(service,{parentOrigin:origin,authenticate:async req=>req.headers['x-test-auth']==='yes'?{principalId:'fixture'}:null,authorize:async(_s,_p,input)=>input.packageName!=='forbidden'}));
  const url=origin+'/hanamesh/library/target?packageName=%40hanamesh%2Futility-plugin';
  const headers={'x-test-auth':'yes'};
  const good=await fetch(url,{headers});assert.equal(good.status,200);assert.equal((await good.json()).item.kind,'plugin');
  for(const [extra,status] of [[{origin:'https://foreign.example'},403],[{'sec-fetch-dest':'iframe'},403],[{'x-test-auth':'no'},401]])assert.equal((await fetch(url,{headers:{...headers,...extra}})).status,status);
  assert.equal((await fetch(origin+'/hanamesh/library/target?packageName=forbidden',{headers})).status,403);
  assert.equal((await fetch(url+'&version=9.0.0',{headers})).status,400);
  assert.equal(service.events().events.length,0);
});
test('IT03: repeated confirmed requests share one existing install operation',async t=>{
  let release,calls=0;const gate=new Promise(r=>{release=r;});
  const service=await library(t,{install:async()=>{calls++;await gate;return{kind:'plugin',status:'restart-required'};}});
  const input={itemId:'com.hanamesh.utility-plugin',packageName:'@hanamesh/utility-plugin'};
  const [a,b]=await Promise.all([service.install(input),service.install(input)]);
  release();assert.equal(a.operationId,b.operationId);assert.equal(calls,1);
});
const item={id:'target-plugin',displayName:'Fixture Plugin',kind:'plugin',latestVersion:'1.2.3',package:{registry:'npm',name:'fixture-plugin'},installed:null};
async function ui(t,{denied=false,missingReadback=false}={}){
  const calls=[],clock=fakeClock();let installed=false;
  const harness=await clientHarness({clock,fetch:async(path,init={})=>{
    calls.push({path,init});
    if(path.startsWith('/hanamesh/library/target?'))return{ok:true,json:async()=>({item:{...item,installed:installed&&!missingReadback?{packageName:'fixture-plugin',version:'1.2.3',state:'installed-not-loaded'}:null},source:{kind:'fixture',path:'test catalog'}})};
    if(path==='/hanamesh/library/install'){if(denied)return{ok:false,status:403,json:async()=>({error:{code:'FORBIDDEN'}})};return{ok:true,json:async()=>({operationId:'op-1',status:'started'})};}
    if(path.startsWith('/hanamesh/library/events?')){installed=true;return{ok:true,json:async()=>({sequence:1,events:[{operationId:'op-1',type:'library.install-done'}]})};}
    return{ok:true,json:async()=>({items:[],installed:[],plugins:installed?[{packageName:'fixture-plugin',state:'installed-not-loaded',version:'1.2.3'}]:[],page:{nextCursor:null}})};
  }});t.after(()=>harness.unmount());return{harness,calls,clock};
}
const text=node=>JSON.stringify(node);
test('IT04: public market input shows market-owned four-field confirmation; cancel sends no install',async t=>{
  const {harness,calls}=await ui(t);const seat=harness.module.createMarketSeat();
  assert.equal(typeof seat.openInstallTarget,'function');
  const opened=await seat.openInstallTarget({packageName:'fixture-plugin'});await settle();
  assert.equal(opened.status,'confirmation-required');
  assert.match(text(harness.tree),/Fixture Plugin/);assert.match(text(harness.tree),/fixture-plugin/);assert.match(text(harness.tree),/1.2.3/);assert.match(text(harness.tree),/测试目录/);
  assert.equal(calls.filter(c=>c.path==='/hanamesh/library/install').length,0);
  await harness.click('取消');assert.equal(calls.filter(c=>c.path==='/hanamesh/library/install').length,0);assert.match(text(harness.tree),/已取消/);
});
test('IT05: public input and confirm clicks share one install, show its result and read the installed list',async t=>{
  const {harness,calls,clock}=await ui(t);const seat=harness.module.createMarketSeat();
  assert.equal(typeof seat.openInstallTarget,'function');await seat.openInstallTarget({itemId:item.id,packageName:'fixture-plugin'});await settle();
  const confirm=harness.find(node=>node.type==='button'&&node.children.includes('确认安装'));assert(confirm);confirm.props.onClick();confirm.props.onClick();await settle();
  await seat.openInstallTarget({packageName:'fixture-plugin'});await settle();
  assert.equal(calls.filter(c=>c.path==='/hanamesh/library/install').length,1);await clock.advance(1000);
  assert.match(text(harness.tree),/安装完成/);assert.match(text(harness.tree),/data-hanamesh-installed/);
  const repeated=await seat.openInstallTarget({packageName:'fixture-plugin'});assert.equal(repeated.status,'already-installed');assert.equal(calls.filter(c=>c.path==='/hanamesh/library/install').length,1);
});
test('IT06: authorization failure remains visible; malformed input cannot post an install',async t=>{
  const {harness,calls}=await ui(t,{denied:true});const seat=harness.module.createMarketSeat();assert.equal(typeof seat.openInstallTarget,'function');
  await assert.rejects(seat.openInstallTarget({packageName:'fixture-plugin',version:'evil'}));
  await seat.openInstallTarget({packageName:'fixture-plugin'});await settle();await harness.click('确认安装');
  assert.match(text(harness.tree),/FORBIDDEN/);assert.equal(calls.filter(c=>c.path==='/hanamesh/library/install').length,1);
  assert.equal(calls.find(c=>c.path==='/hanamesh/library/install').init.headers['x-hanamesh-client'],'workspace-v1');
});
test('IT07: an operation done event without an installed readback does not claim the target is installed',async t=>{
  const{harness,clock}=await ui(t,{missingReadback:true});await harness.module.openInstallTarget({packageName:'fixture-plugin'});await settle();await harness.click('确认安装');await clock.advance(1000);
  assert.match(text(harness.tree),/读回失败/);assert.doesNotMatch(text(harness.tree),/安装完成，请查看已安装列表/);
});
test('IT08: normal host URL fragment navigation enters the same confirmation, never installs or accepts duplicate/extra fields',async t=>{
  const{harness,calls}=await ui(t);const disposers=[];
  harness.module.apply({effect:run=>{const dispose=run();disposers.push(dispose);},slots:{inject:(_n,run)=>run(),register:()=>()=>{}},reflect:{get:()=>undefined},provide:()=>()=>{}});
  t.after(()=>{for(const dispose of disposers)dispose?.();});await settle();
  harness.hashchange('#hanamesh-install?packageName=fixture-plugin');await settle();
  assert.match(text(harness.tree),/Fixture Plugin/);assert(harness.find(node=>node.type==='button'&&node.children.includes('确认安装')));
  assert.equal(calls.filter(c=>c.path==='/hanamesh/library/install').length,0);
  harness.hashchange('#hanamesh-install?packageName=fixture-plugin&packageName=evil');await settle();assert.match(text(harness.tree),/INVALID_INPUT/);
  harness.hashchange('#hanamesh-install?packageName=fixture-plugin&url=https%3A%2F%2Fevil.example');await settle();assert.match(text(harness.tree),/INVALID_INPUT/);
  assert.equal(calls.filter(c=>c.path==='/hanamesh/library/install').length,0);
});
