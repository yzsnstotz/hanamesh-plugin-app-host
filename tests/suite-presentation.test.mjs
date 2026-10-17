import test from 'node:test';
import assert from 'node:assert/strict';
import {clientHarness,settle} from './fixtures/client-ui-harness.mjs';

async function card(t,suite){
  const h=await clientHarness({fetch:async()=>({ok:true,json:async()=>({items:[{id:'hanamesh:suite',kind:'suite',summary:'官方 · 不计分',suite}],installed:[],plugins:[],page:{}})})});
  t.after(()=>h.unmount());await settle();return JSON.stringify(h.tree);
}
test('suite card identifies the displayed version as Core, independently of the agent distribution version',async t=>{
  const text=await card(t,{status:'installed',completeness:'complete',version:'0.3.14',components:[{name:'hanamesh-core',label:'Core',version:'0.3.14'},{name:'hanamesh-usage',label:'使用记录',version:'0.3.0-rc.2'}]});
  assert.match(text,/已安装 · Core 0.3.14/);assert.doesNotMatch(text,/已安装 · 0.3.14/);assert.match(text,/0.3.0-rc.2/);
});
test('unknown suite completeness does not claim missing components and keeps physical versions visible',async t=>{
  const text=await card(t,{status:'unknown',completeness:'unknown',version:'0.3.14',components:[{name:'hanamesh-core',label:'Core',version:'0.3.14',active:true}],blocked:[{code:'CORE_SUITE_PEER_UNKNOWN'}]});
  assert.match(text,/套件状态未知/);assert.doesNotMatch(text,/套件不完整或版本检测不到/);assert.match(text,/CORE_SUITE_PEER_UNKNOWN/);assert.match(text,/0.3.14/);
});
test('a refused upgrade preview says installation has not started and preserves named Core causes',async t=>{
  const h=await clientHarness({fetch:async path=>path.startsWith('/hanamesh/library/target?')?{ok:false,json:async()=>({error:{code:'CORE_SUITE_CURRENT_INCOMPLETE',details:{blocked:[{code:'CORE_SUITE_PEER_UNKNOWN',moduleName:'react'}]}}})}:{ok:true,json:async()=>({items:[],installed:[],plugins:[],page:{}})}});
  t.after(()=>h.unmount());await assert.rejects(h.module.openInstallTarget({itemId:'hanamesh:suite-upgrade'}));await settle();
  const text=JSON.stringify(h.tree);assert.match(text,/尚未执行安装/);assert.match(text,/CORE_SUITE_PEER_UNKNOWN/);assert.doesNotMatch(text,/部分组件可能已改变/);
});
test('the plugin category keeps the single suite card visible',async t=>{
  const h=await clientHarness({fetch:async()=>({ok:true,json:async()=>({items:[{id:'hanamesh:suite',kind:'suite',suite:{status:'unknown',components:[]}}],installed:[],plugins:[],page:{}})})});t.after(()=>h.unmount());
  const select=h.find(n=>n.type==='select'&&n.props['aria-label']==='类别');select.props.onChange({target:{value:'plugin'}});await settle();
  assert.ok(h.find(n=>n.type==='article'&&n.props['data-hanamesh-kind']==='suite'),'suite stays visible in plugin category');
});

for(const outcome of ['success','partial'])test(`a suite ${outcome} does not promote physical inventory into Core completeness on the next direct probe`,async t=>{
  const {createLibraryService}=await import('../src/library/service.js');const {scratch}=await import('./helpers.mjs');const {mkdir,writeFile}=await import('node:fs/promises');const {join}=await import('node:path');
  const root=await scratch('suite-core-authority-'),names=['hanamesh-core','hanamesh-usage','@hanamesh/dsh-app-host'];
  for(const name of names){await mkdir(join(root,'node_modules',name),{recursive:true});await writeFile(join(root,'node_modules',name,'package.json'),JSON.stringify({name,version:'1.0.0'}));}
  await writeFile(join(root,'package.json'),JSON.stringify({dependencies:Object.fromEntries(names.map(name=>[name,'1.0.0'])),dsh:{profile:{bundles:names}}}));
  const installer={ready:true,install:async()=>{},suiteFacts:async()=>({status:'unknown',completeness:'unknown',version:'1.0.0',components:[],blocked:[{code:'CORE_SUITE_RUNNING_PHYSICAL_MISMATCH'}]}),upgradeSuite:async()=>{if(outcome==='partial'){const e=new Error('partial');e.code='DSH_PLUGIN_FAILED';e.details={stage:'suite-upgrade'};throw e;}return{status:'restart-required'};}};
  const library=await createLibraryService({domain:{global:{get:async()=>({revision:0,sources:[]})},close:async()=>{}},host:{instanceList:()=>[]},dataRoot:root,config:{profileDir:root},installer}).init();t.after(()=>library.close());
  const completed=new Promise(resolve=>library.observe(event=>{if(event.type==='library.install-done'||event.type==='library.install-failed')resolve(event);}));
  await library.upgradeSuite({planId:'fixture'});const event=await completed;
  assert.notEqual(library.installTarget().suite?.status,'installed','direct probe must retain Core unknown without list refresh');
  if(outcome==='partial')assert.equal(event.details.actual.status,'installed','physical readback remains diagnostic only');
});
test('Core optional method removal cannot keep the cached complete suite in a direct probe',async t=>{
  const {createLibraryService}=await import('../src/library/service.js');let available=true;
  const installer={ready:true,install:async()=>{},get suiteUpgradeUnavailable(){return available?null:'Core 未提供套件声明';},suiteFacts:async()=>({status:'installed',completeness:'complete',version:'0.3.14',components:[]})};
  const library=await createLibraryService({domain:{global:{get:async()=>({revision:0,sources:[]})},close:async()=>{}},host:{instanceList:()=>[]},dataRoot:'/tmp/unused-fixture',config:{},installer}).init();t.after(()=>library.close());
  assert.equal(library.installTarget().suite.status,'installed');available=false;
  assert.notEqual(library.installTarget().suite?.status,'installed','removed Core cannot authorize cached completeness');
});
