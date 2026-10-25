import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import * as suite from '../src/library/suite.js';
import {createLibraryInstaller} from '../src/library/install.js';
import {createLibraryService} from '../src/library/service.js';
import {scratch} from './helpers.mjs';
import {declaration,core,registry,names,versions} from './fixtures/core-suite-declaration.mjs';
import {clientHarness,settle} from './fixtures/client-ui-harness.mjs';
const missing='Core 未提供套件声明';
const provider=value=>{const service=core(value);return()=>service;};
function adapter(options){assert.equal(typeof suite.createCoreSuiteAdapter,'function','public Core adapter is available');return suite.createCoreSuiteAdapter(options);}
async function profile(){const root=await scratch('public-core-suite-');for(const [i,name] of names.entries()){await mkdir(join(root,'node_modules',name),{recursive:true});await writeFile(join(root,'node_modules',name,'package.json'),JSON.stringify({name,version:versions[i]}));}await writeFile(join(root,'package.json'),JSON.stringify({dependencies:Object.fromEntries(names.map((name,i)=>[name,versions[i]])),dsh:{profile:{bundles:names}}}));return root;}
test('public adapter sends only actual registry for candidates, zero request for facts, and preserves Core tuple identities',async()=>{
  const value=declaration(),requests=[];const service={protocolVersion:'1',getSuiteDeclaration:async(...args)=>{requests.push(args);return value;}};
  const get=adapter({core:()=>service,registry:registry.slice(0,-1)});const facts=await get.readFacts();assert.deepEqual(requests,[[]]);assert.equal(facts.completeness,'complete');assert.equal(facts.components[0].requiredRange,'0.3.12');assert.equal(facts.components[0].actualVersion,versions[0]);
  const plan=await get();assert.deepEqual(requests[1],[{registry:registry.slice(0,-1)}]);assert.equal(plan.registry,registry);assert.equal(plan.declarationId,value.declarationId);assert.deepEqual(plan.selectedUpgrade,value.upgrades[0]);assert.deepEqual(plan.physicalBaseline,value.installed);assert.deepEqual(plan.components.map(c=>c.to),value.upgrades[0].targets.map(c=>c.version));plan.selectedUpgrade.targets[0].repository='changed';assert.notEqual(value.upgrades[0].targets[0].repository,'changed');
});
test('public adapter observes absent, old, arriving, and removed optional method without getHealth fallback',async()=>{
  let service;const get=adapter({core:()=>service,registry});for(const next of [undefined,{protocolVersion:'1',getHealth:()=>assert.fail('no health fallback')},{protocolVersion:1,getSuiteDeclaration:()=>declaration()}]){service=next;assert.equal(get.unavailable,missing);await assert.rejects(get(),{code:'CORE_SUITE_DECLARATION_MISSING',message:missing});}
  service=core(declaration());assert.equal(get.unavailable,null);assert.equal((await get()).available,true);delete service.getSuiteDeclaration;assert.equal(get.unavailable,missing);await assert.rejects(get(),{code:'CORE_SUITE_DECLARATION_MISSING'});
});
test('public adapter refuses malformed DTOs instead of interpreting unknown as complete',async()=>{
  for(const mutate of [v=>{v.schemaVersion=2;},v=>{delete v.manifest;},v=>{v.completeness='ready';},v=>{v.installed.pop();},v=>{v.upgrades[0].targets[0].version='latest';},v=>{delete v.upgrades[0].targets[0].metadataDigest;},v=>{v.upgrades[0].targets[1].moduleName='foreign';},v=>{delete v.peerFacts;}]){const value=declaration();mutate(value);await assert.rejects(adapter({core:provider(value),registry})(),{code:'CORE_SUITE_DECLARATION_INVALID'});}
});
test('Core completeness and named blocked facts control refusal; blocked other candidates do not veto a valid tuple',async()=>{
  const value=declaration();value.blocked=[{code:'CORE_SUITE_METADATA_TIMEOUT',coreVersion:'99.0.0'}];assert.equal((await adapter({core:provider(value),registry})()).available,true);
  for(const completeness of ['incomplete','unknown']){value.completeness=completeness;const get=adapter({core:provider(value),registry});assert.equal((await get.readFacts()).completeness,completeness);await assert.rejects(get(),e=>e.code==='CORE_SUITE_CURRENT_INCOMPLETE'&&e.details.blocked[0].code==='CORE_SUITE_METADATA_TIMEOUT');}
  value.completeness='complete';value.upgrades=[];await assert.rejects(adapter({core:provider(value),registry})(),{code:'CORE_SUITE_NO_COMPATIBLE_TUPLE'});
});
test('registry and tuple source fields remain bound to Core declaration without a local compatibility policy',async()=>{
  for(const mutate of [v=>{v.registry='https://other.example/';},v=>{v.registry=null;},v=>{v.upgrades[0].registry='https://other.example/';}]){const value=declaration();mutate(value);await assert.rejects(adapter({core:provider(value),registry})(),{code:'CORE_SUITE_SOURCE_MISMATCH'});}
  const value=declaration();value.upgrades[0].targets[0].repository='https://public-core-approved.example/core';assert.equal((await adapter({core:provider(value),registry})()).selectedUpgrade.targets[0].repository,'https://public-core-approved.example/core');
});
test('confirmation binds declaration, registry, tuple identities/digests/sources and physical baseline, excluding checkedAt',async()=>{
  for(const mutate of [v=>{v.declarationId='c'.repeat(64);},v=>{v.upgrades[0].manifestDigest='c'.repeat(64);},v=>{v.upgrades[0].targets[0].metadataDigest='c'.repeat(64);},v=>{v.upgrades[0].targets[0].repository='https://changed.example/';},v=>{v.installed[0].actualRepository='https://changed.example/';}]){const root=await profile();let value=declaration(),writes=0;const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.js'),registry,coreService:provider(value),spawn:async()=>{writes++;return{code:0};}});const plan=await installer.prepareSuiteUpgrade();mutate(value);await assert.rejects(installer.upgradeSuite({planId:plan.planId}),{code:'SUITE_PLAN_CHANGED'});assert.equal(writes,0);}
  const root=await profile();let value=declaration(),writes=0;const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.js'),registry,coreService:provider(value),spawn:async()=>{writes++;return{code:0};}});const plan=await installer.prepareSuiteUpgrade();value.checkedAt='2026-10-16T01:00:00.000Z';await assert.rejects(installer.upgradeSuite({planId:plan.planId}),{code:'INSTALL_READBACK_MISMATCH'});assert.equal(writes,1);
});
test('a physical change or Core removal after preview prevents CLI',async()=>{
  for(const change of ['physical','activation','unload']){const root=await profile();let service=core(declaration()),writes=0;const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.js'),registry,coreService:()=>service,spawn:async()=>{writes++;return{code:0};}});const plan=await installer.prepareSuiteUpgrade();if(change==='unload')service=undefined;else if(change==='activation')await writeFile(join(root,'package.json'),JSON.stringify({dependencies:Object.fromEntries(names.map((name,i)=>[name,versions[i]])),dsh:{profile:{bundles:[]}}}));else await writeFile(join(root,'node_modules/@hanamesh/core/package.json'),JSON.stringify({name:names[0],version:'0.3.11'}));await assert.rejects(installer.upgradeSuite({planId:plan.planId}),{code:change==='unload'?'CORE_SUITE_DECLARATION_MISSING':'SUITE_PLAN_CHANGED'});assert.equal(writes,0);}
});
test('a getter timeout remains unknown with its named error and never grants an execution plan',async()=>{
  const root=await profile(),error=Object.assign(new Error('timeout'),{code:'CORE_SUITE_METADATA_TIMEOUT'});const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.js'),registry,coreService:()=>({protocolVersion:'1',getSuiteDeclaration:async()=>{throw error;}}),spawn:async()=>assert.fail('no CLI')});const facts=await installer.suiteFacts();assert.equal(facts.completeness,'unknown');assert.equal(facts.blocked[0].code,error.code);await assert.rejects(installer.prepareSuiteUpgrade(),e=>e===error);
});
test('library facts refresh Core arrival/unload and show incomplete even with physically installed packages',async t=>{
  const root=await profile();let service,state={schema:1,revision:0,sources:[]};const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.js'),registry,coreService:()=>service});const library=await createLibraryService({domain:{global:{get:async()=>state,set:async v=>{state=v;}},close:async()=>{}},host:{instanceList:()=>[],list:()=>({apps:[]})},dataRoot:root,installer,config:{profileDir:root,fixture:join(import.meta.dirname,'fixtures/catalog/provider-page.json')}}).init();t.after(()=>library.close());const item=async()=>(await library.list({category:''})).items.find(i=>i.kind==='suite');assert.equal((await item()).suiteUpgradeUnavailable,missing);const value=declaration();value.completeness='incomplete';value.blocked=[{code:'CORE_SUITE_RUNNING_PHYSICAL_MISMATCH',moduleName:names[0]}];service=core(value);const row=await item();assert.equal(row.suite.completeness,'incomplete');assert.equal(row.suite.status,'incomplete');assert.equal(row.suite.components[0].requiredRange,'0.3.12');assert.deepEqual(row.suite.blocked,value.blocked);service=undefined;assert.equal((await item()).suiteUpgradeUnavailable,missing);
});
test('market renders Core required and actual versions, completeness and named block reasons',async t=>{
  const value=declaration();const h=await clientHarness({fetch:async()=>({ok:true,json:async()=>({items:[{id:'hanamesh:suite',kind:'suite',suite:{status:'incomplete',completeness:'incomplete',version:versions[0],components:value.installed.map(c=>({...c,name:c.moduleName,label:c.id,version:c.actualVersion})),blocked:[{code:'CORE_SUITE_PEER_UNKNOWN',moduleName:names[0]}]}}],installed:[],plugins:[],page:{}})})});t.after(()=>h.unmount());await settle();const text=JSON.stringify(h.tree);assert.match(text,/CORE_SUITE_PEER_UNKNOWN/);assert.match(text,/要求/);assert.match(text,/实际/);assert.match(text,/incomplete/);
});
test('suite confirmation displays the selected canonical registry and other candidate blocked facts',async t=>{
  const value=declaration(),plan={available:true,planId:'fixture',registry,components:value.upgrades[0].targets.map((row,i)=>({name:row.moduleName,label:row.id,from:versions[i],to:row.version})),blocked:[{code:'CORE_SUITE_METADATA_TIMEOUT',coreVersion:'99.0.0'}]};
  const h=await clientHarness({fetch:async path=>({ok:true,json:async()=>path.startsWith('/hanamesh/library/target?')?{source:{kind:'suite'},item:{id:'hanamesh:suite-upgrade',kind:'suite-upgrade',displayName:'HanaMesh 套件',package:{name:names[0]},upgradeAvailable:true,suiteUpgrade:plan}}:{items:[],installed:[],plugins:[],page:{}}})});t.after(()=>h.unmount());await h.module.openInstallTarget({itemId:'hanamesh:suite-upgrade'});await settle();const text=JSON.stringify(h.tree);assert.ok(text.includes(registry));assert.match(text,/CORE_SUITE_METADATA_TIMEOUT/);assert.match(text,/99.0.0/);assert.ok(h.find(n=>n.type==='button'&&n.children.includes('确认安装')));
});
test('a rejected candidate lookup exposes the Core named blocked facts in the existing target failure view',async t=>{
  const h=await clientHarness({fetch:async path=>path.startsWith('/hanamesh/library/target?')?{ok:false,json:async()=>({error:{code:'CORE_SUITE_NO_COMPATIBLE_TUPLE',details:{blocked:[{code:'CORE_SUITE_METADATA_TIMEOUT',moduleName:names[0]}]}}})}:{ok:true,json:async()=>({items:[],installed:[],plugins:[],page:{}})}});t.after(()=>h.unmount());await assert.rejects(h.module.openInstallTarget({itemId:'hanamesh:suite-upgrade'}));await settle();const text=JSON.stringify(h.tree);assert.match(text,/CORE_SUITE_METADATA_TIMEOUT/);assert.ok(text.includes(names[0]));assert.doesNotMatch(text,/部分组件可能已改变/);
});

test('scoped suite names keep repository and component ids, reject old npm declarations and use the exact repair tuple',async()=>{
  assert.deepEqual(suite.SUITE_PACKAGES.map(p=>p.name),['@hanamesh/core','@hanamesh/usage','@hanamesh/dsh-app-host']);
  assert.deepEqual(suite.SUITE_PACKAGES.map(p=>p.repo),['hanamesh-core','hanamesh-usage','hanamesh-plugin-app-host']);
  assert.equal(suite.SUITE_INSTALL_COMMAND,"dsh plugin --profile desktop add --save-exact '@hanamesh/core@0.3.21' '@hanamesh/usage@0.3.0-rc.6' '@hanamesh/dsh-app-host@0.6.13'");
  const value=declaration();
  value.manifest.core.name='hanamesh-core';
  await assert.rejects(adapter({core:provider(value),registry}).readFacts(),{code:'CORE_SUITE_DECLARATION_INVALID'});
  const oldUsage=declaration();oldUsage.manifest.components[0].moduleName='hanamesh-usage';
  await assert.rejects(adapter({core:provider(oldUsage),registry}).readFacts(),{code:'CORE_SUITE_DECLARATION_INVALID'});
  assert.deepEqual(declaration().installed.map(row=>row.id),['core','usage','app-host']);
});
