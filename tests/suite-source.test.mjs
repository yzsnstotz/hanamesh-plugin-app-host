import test from 'node:test';
import assert from 'node:assert/strict';
import {readSuiteSourceState,createCoreSuiteAdapter} from '../src/library/suite.js';
import {createLibraryService} from '../src/library/service.js';
import {declaration,core,registry} from './fixtures/core-suite-declaration.mjs';
const ready=()=>({protocolVersion:'1',status:'ready',selection:'custom',registry,archiveCount:3,lastError:null});
test('B17 configured selection preserves registry and ignores absent Core source; core selection uses current public source',async()=>{
 let mode='configured',service;const requests=[];
 // Stable Core service identity is part of its existing public contract.
 const stable=core(declaration());stable.getSuiteDeclaration=async input=>{requests.push(input);return declaration();};
 const plan=createCoreSuiteAdapter({core:()=>stable,registry,suiteSourceMode:()=>mode,suiteSourceService:()=>service});
 await plan();assert.deepEqual(requests.pop(),{registry});mode='core';await assert.rejects(plan(),{code:'CORE_SUITE_SOURCE_MISSING'});
 service={protocolVersion:'1',getState:ready};await plan();assert.deepEqual(requests.pop(),{registry});
});
test('B17 core source unavailable states and replacement during declaration never grant a plan',async()=>{
 for(const status of ['disabled','failed','disposed']){const get=createCoreSuiteAdapter({core:()=>stable,registry,suiteSourceMode:()=> 'core',suiteSourceService:()=>({protocolVersion:'1',getState:()=>({...ready(),status,registry:null})})});const stable=core(declaration());await assert.rejects(get(),{code:'CORE_SUITE_SOURCE_NOT_READY'});}
 let source={protocolVersion:'1',getState:ready};const stable=core(declaration());stable.getSuiteDeclaration=async()=>{source={protocolVersion:'1',getState:ready};return declaration();};
 await assert.rejects(createCoreSuiteAdapter({core:()=>stable,registry,suiteSourceMode:()=> 'core',suiteSourceService:()=>source})(),{code:'SUITE_PLAN_CHANGED'});
});
test('B17 owned selection persists, rejects unknown fields and preserves catalogs and previous selection on failed save',async()=>{
 const initial={schema:1,revision:7,sources:[],handoff:{enabled:false,ports:[],allowedOrigins:[],ttlMs:1,pollMs:22}};let state=structuredClone(initial),fail=false;
 const domain={global:{get:async()=>structuredClone(state),set:async v=>{if(fail)throw new Error('refused');state=structuredClone(v);}},close:async()=>{}};
 const open=()=>createLibraryService({domain,host:{instanceList:()=>[]},config:{registry:'https://custom.example/'}}).init();let library=await open();
 assert.equal(library.suiteSourceSettings().mode,'configured');await assert.rejects(library.replaceSuiteSourceSettings({mode:'core',registry:'https://wrong.example/'}),{code:'INVALID_SUITE_SOURCE_SETTINGS'});
 await library.replaceSuiteSourceSettings({mode:'core'});assert.deepEqual(state.sources,[]);assert.deepEqual(state.handoff,initial.handoff);library=await open();assert.equal(library.suiteSourceSettings().mode,'core');fail=true;await assert.rejects(library.replaceSuiteSourceSettings({mode:'configured'}),{code:'SUITE_SOURCE_SAVE_FAILED'});assert.equal(library.suiteSourceSettings().mode,'core');assert.equal(state.suiteSource.mode,'core');
});

test('B17 strict owned HTTP settings require auth, origin, exact JSON and no query; current source is observable only',async t=>{
 const {createServer}=await import('node:http');const {createLibraryHttpHandler}=await import('../src/library/routes.js');let state={schema:1,revision:0,sources:[]};let source;
 const library=await createLibraryService({domain:{global:{get:async()=>state,set:async v=>{state=v;}},close:async()=>{}},host:{instanceList:()=>[]},suiteSourceService:()=>source}).init();
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));const origin=`http://127.0.0.1:${server.address().port}`;
 server.on('request',createLibraryHttpHandler(library,{parentOrigin:origin,authenticate:async req=>req.headers['x-denied']?null:{principalId:'test'},authorize:async()=>true}));
 const path='/hanamesh/library/suite-source';const send=(body,headers={},query='')=>fetch(origin+path+query,{method:'POST',headers:{origin,'content-type':'application/json','x-hanamesh-client':'workspace-v1',...headers},body:JSON.stringify(body)});
 let response=await fetch(origin+path);assert.equal(response.status,200);let value=await response.json();assert.equal(value.mode,'configured');assert.deepEqual(value.observation,{observable:false,code:'CORE_SUITE_SOURCE_MISSING'});assert.equal(response.headers.get('cache-control'),'no-store');
 for(const [body,headers,query,status] of [[{mode:'core',extra:true},{},'',400],[{mode:'core'},{},'?extra=1',400],[{mode:'core'},{origin:'https://foreign.example'},'',403],[{mode:'core'},{'x-denied':'yes'},'',401]]){response=await send(body,headers,query);assert.equal(response.status,status);assert.equal(state.suiteSource,undefined);}
 source={protocolVersion:'1',getState:ready};response=await send({mode:'core'});assert.equal(response.status,200);value=await response.json();assert.equal(value.mode,'core');assert.deepEqual(value.observation,{observable:true,state:ready()});assert.equal((await fetch(origin+path+'?unknown=1')).status,400);
});

test('B17 saved choice, source selection/url/loss/replacement after preview invalidate exact confirmation without CLI',async()=>{
 const {mkdir,writeFile}=await import('node:fs/promises');const {join}=await import('node:path');const {scratch}=await import('./helpers.mjs');const {createLibraryInstaller}=await import('../src/library/install.js');const {names,versions}=await import('./fixtures/core-suite-declaration.mjs');
 for(const change of ['mode','selection','registry','disabled','failed','disposed','missing','replace']){
  const root=await scratch('b17-confirm-');for(const [i,name] of names.entries()){await mkdir(join(root,'node_modules',name),{recursive:true});await writeFile(join(root,'node_modules',name,'package.json'),JSON.stringify({name,version:versions[i]}));}await writeFile(join(root,'package.json'),JSON.stringify({dependencies:Object.fromEntries(names.map((name,i)=>[name,versions[i]])),dsh:{profile:{bundles:names}}}));
  let mode='core',state=ready(),source={protocolVersion:'1',getState:()=>state},writes=0;const stable=core(declaration());const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.js'),registry,coreService:()=>stable,suiteSourceMode:()=>mode,suiteSourceService:()=>source,spawn:async()=>{writes++;return{code:0};}});
  const plan=await installer.prepareSuiteUpgrade();if(change==='mode')mode='configured';else if(change==='selection')state={...state,selection:'configured'};else if(change==='registry')state={...state,registry:'https://changed.example/'};else if(change==='missing')source=undefined;else if(change==='replace')source={protocolVersion:'1',getState:()=>state};else state={...state,status:change,registry:null};
  await assert.rejects(installer.upgradeSuite({planId:plan.planId}));assert.equal(writes,0,change);await assert.rejects(installer.upgradeSuite({planId:plan.planId}),{code:'SUITE_PLAN_CHANGED'});
 }
});

test('B17 source settings page names separate registry choice, live unavailable state and failed save without changing saved mode',async t=>{
 const {clientHarness,settle}=await import('./fixtures/client-ui-harness.mjs');let mode='configured',fail=false,posts=0;
 const h=await clientHarness({component:'SuiteSourceSettingsSection',fetch:async(_path,input)=>{if(input?.method==='POST'){posts++;if(fail)return{ok:false,json:async()=>({error:{code:'SUITE_SOURCE_SAVE_FAILED',message:'原选择保持'}})};mode=JSON.parse(input.body).mode;}
 return{ok:true,json:async()=>({mode,configuredRegistry:'https://custom.example/',observation:{observable:false,code:'CORE_SUITE_SOURCE_MISSING'}})};}});t.after(()=>h.unmount());await settle();
 assert.match(JSON.stringify(h.tree),/套件安装包来源/);assert.match(JSON.stringify(h.tree),/CORE_SUITE_SOURCE_MISSING/);assert.match(JSON.stringify(h.tree),/https:\/\/custom.example\//);assert.match(JSON.stringify(h.tree),/目录/);assert.equal(posts,0);
 h.find(n=>n.type==='select').props.onChange({target:{value:'core'}});await settle();await h.click('保存套件安装包来源');assert.equal(mode,'core');fail=true;h.find(n=>n.type==='select').props.onChange({target:{value:'configured'}});await settle();await h.click('保存套件安装包来源');assert.equal(mode,'core');assert.match(JSON.stringify(h.tree),/原选择保持/);
});

test('B17 concurrent saves serialize one whole AppHost snapshot',async()=>{
 let state={schema:1,revision:3,sources:[]},first=true,release,entered;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);const writes=[];
 const library=await createLibraryService({domain:{global:{get:async()=>state,set:async next=>{if(first){first=false;entered();await gate;}writes.push(structuredClone(next));state=structuredClone(next);}},close:async()=>{}},host:{instanceList:()=>[]}}).init();
 const saveSource=library.replaceSuiteSourceSettings({mode:'core'});await started;const saveCatalog=library.replaceSources({sources:[{manifestUrl:'https://catalog.example/source.json',enabled:true}]});const saveHandoff=library.replaceHandoffSettings({enabled:false});release();await Promise.all([saveSource,saveCatalog,saveHandoff]);
 assert.equal(state.suiteSource.mode,'core');assert.deepEqual(state.sources,[{manifestUrl:'https://catalog.example/source.json',enabled:true}]);assert.equal(state.handoff.enabled,false);assert.deepEqual(writes.map(w=>w.revision),[4,5,6]);
});

test('B17 execution re-reads the public source and declaration after confirmation and refuses a concurrent source change',async()=>{
 const {mkdir,writeFile}=await import('node:fs/promises');const {join}=await import('node:path');const {scratch}=await import('./helpers.mjs');const {createLibraryInstaller}=await import('../src/library/install.js');const {names,versions}=await import('./fixtures/core-suite-declaration.mjs');
 const root=await scratch('b17-execute-');for(const [i,name] of names.entries()){await mkdir(join(root,'node_modules',name),{recursive:true});await writeFile(join(root,'node_modules',name,'package.json'),JSON.stringify({name,version:versions[i]}));}await writeFile(join(root,'package.json'),JSON.stringify({dependencies:Object.fromEntries(names.map((name,i)=>[name,versions[i]])),dsh:{profile:{bundles:names}}}));
 let declarations=0,state=ready(),writes=0;const source={protocolVersion:'1',getState:()=>state},stable={protocolVersion:'1',getSuiteDeclaration:async()=>{if(++declarations===3)state={...state,status:'disposed',registry:null};return declaration();}};
 const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.js'),registry,coreService:()=>stable,suiteSourceMode:()=> 'core',suiteSourceService:()=>source,spawn:async()=>{writes++;return{code:0};}});
 const plan=await installer.prepareSuiteUpgrade();await assert.rejects(installer.upgradeSuite({planId:plan.planId}),{code:'CORE_SUITE_SOURCE_NOT_READY'});assert.equal(declarations,3);assert.equal(writes,0);
});

test('B17 malformed public sources fail explicitly without falling back to configured registry',async()=>{
 const stable=core(declaration());
 for(const state of [undefined,{...ready(),protocolVersion:1},{...ready(),status:'starting'},{...ready(),archiveCount:-1},{...ready(),registry:'file:///private/source'},{...ready(),registry:'https://user:secret@example.test/'},{...ready(),lastError:42}]){
 const get=createCoreSuiteAdapter({core:()=>stable,registry,suiteSourceMode:()=> 'core',suiteSourceService:()=>({protocolVersion:'1',getState:()=>state})});await assert.rejects(get(),{code:'CORE_SUITE_SOURCE_INVALID'});
 }
 await assert.rejects(createCoreSuiteAdapter({core:()=>stable,registry,suiteSourceMode:()=> 'core',suiteSourceService:()=>({protocolVersion:'1',getState:()=>{throw new Error('private path not surfaced');}})})(),e=>e.code==='CORE_SUITE_SOURCE_INVALID'&&!e.message.includes('private path'));
});

test('B17 failed queued source save preserves previous selection and the next catalog save still succeeds',async()=>{
 let state={schema:1,revision:2,sources:[],suiteSource:{mode:'configured'}},refuse=true;
 const library=await createLibraryService({domain:{global:{get:async()=>state,set:async next=>{if(refuse){refuse=false;throw new Error('disk refused');}state=structuredClone(next);}},close:async()=>{}},host:{instanceList:()=>[]}}).init();
 const source=library.replaceSuiteSourceSettings({mode:'core'});const catalog=library.replaceSources({sources:[{manifestUrl:'https://catalog.example/source.json',enabled:true}]});await assert.rejects(source,{code:'SUITE_SOURCE_SAVE_FAILED'});await catalog;assert.equal(state.suiteSource.mode,'configured');assert.equal(state.revision,3);assert.equal(state.sources.length,1);
});

test('C-B17-AH-L01 absent source is missing but incompatible public service is invalid',async()=>{
 for(const service of [undefined,null]) assert.throws(()=>readSuiteSourceState(service),{code:'CORE_SUITE_SOURCE_MISSING'});
 for(const service of [{protocolVersion:'0',getState:()=>assert.fail('old protocol must not be called')},{protocolVersion:1,getState:ready},{protocolVersion:'1'},{protocolVersion:'1',getState:42}]){
  assert.throws(()=>readSuiteSourceState(service),{code:'CORE_SUITE_SOURCE_INVALID'});
  const stable=core(declaration());let reads=0;stable.getSuiteDeclaration=async()=>{reads++;return declaration();};
  await assert.rejects(createCoreSuiteAdapter({core:()=>stable,registry,suiteSourceMode:()=> 'core',suiteSourceService:()=>service})(),{code:'CORE_SUITE_SOURCE_INVALID'});assert.equal(reads,0);
 }
});
