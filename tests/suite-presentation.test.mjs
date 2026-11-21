import test from 'node:test';
import assert from 'node:assert/strict';
import {writeSuiteProfile} from './fixtures/core-suite-declaration.mjs';
import {until} from './helpers.mjs';
import {clientHarness,settle} from './fixtures/client-ui-harness.mjs';

test('a refused upgrade preview says installation has not started and preserves named Core causes',async t=>{
  const h=await clientHarness({fetch:async path=>path.startsWith('/hanamesh/library/target?')?{ok:false,json:async()=>({error:{code:'CORE_SUITE_CURRENT_INCOMPLETE',details:{blocked:[{code:'CORE_SUITE_PEER_UNKNOWN',moduleName:'react'}]}}})}:{ok:true,json:async()=>({items:[],installed:[],plugins:[],page:{}})}});
  t.after(()=>h.unmount());await assert.rejects(h.module.openInstallTarget({itemId:'hanamesh:suite-upgrade'}));await settle();
  const text=JSON.stringify(h.tree);assert.match(text,/尚未执行安装/);assert.match(text,/CORE_SUITE_PEER_UNKNOWN/);assert.doesNotMatch(text,/部分组件可能已改变/);
});
for(const outcome of ['success','partial'])test(`a suite ${outcome} does not promote physical inventory into Core completeness on the next authenticated read`,async t=>{
  const {createLibraryService}=await import('../src/library/service.js');const {scratch}=await import('./helpers.mjs');const {mkdir,writeFile}=await import('node:fs/promises');const {join}=await import('node:path');
  const root=await scratch('suite-core-authority-'),names=['@hanamesh/core','@hanamesh/usage','@hanamesh/dsh-app-host'];
  for(const name of names){await mkdir(join(root,'node_modules',name),{recursive:true});await writeFile(join(root,'node_modules',name,'package.json'),JSON.stringify({name,version:'1.0.0'}));}
  await writeSuiteProfile(root,names.map(()=> '1.0.0'));
  const installer={ready:true,install:async()=>{},suiteFacts:async()=>({status:'unknown',completeness:'unknown',version:'1.0.0',components:[],blocked:[{code:'CORE_SUITE_RUNNING_PHYSICAL_MISMATCH'}]}),upgradeSuite:async()=>{if(outcome==='partial'){const e=new Error('partial');e.code='DSH_PLUGIN_FAILED';e.details={stage:'suite-upgrade'};throw e;}return{status:'restart-required'};}};
  const library=await createLibraryService({domain:{global:{get:async()=>({revision:0,sources:[]})},close:async()=>{}},host:{instanceList:()=>[],list:()=>({apps:[]})},dataRoot:root,config:{profileDir:root,fixture:join(import.meta.dirname,'fixtures/catalog/provider-page.json')},installer}).init();t.after(()=>library.close());
  const {operationId}=await library.upgradeSuite({planId:'fixture'});
  const findResult=()=>library.events().events.find(row=>row.operationId===operationId&&(!row.type.endsWith('-started')));
  await until(findResult);
  const event=findResult();
  assert.ok(event);
  assert.notEqual((await library.list({category:'plugin'})).items.find(row=>row.kind==='suite')?.suite.status,'installed','the authenticated read must retain Core unknown');
  if(outcome==='partial')assert.equal(event.details.actual.status,'installed','physical readback remains diagnostic only');
});
