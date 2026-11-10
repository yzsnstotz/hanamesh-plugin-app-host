import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {scratch} from './helpers.mjs';
import {createLibraryService} from '../src/library/service.js';
import {createLibraryInstaller} from '../src/library/install.js';
import {declaration,registry,names,versions,writeSuiteProfile} from './fixtures/core-suite-declaration.mjs';

// Real service + installer + public Core adapter share one confirmation slot.
// Only the external Core declaration, npm metadata, and CLI process are controlled doubles.
async function race(t,{cancel=false,history=false}={}){
 const root=await scratch('r168-confirmation-'),baseline='0.1.1',latest='0.1.2',registryLatest='0.1.3',selected=history?'0.1.0':latest;
 let installedBundle=baseline;
 const write=async version=>{
  installedBundle=version;
  await writeSuiteProfile(root,versions,version);
  for(const [i,name]of names.entries()){
   await mkdir(join(root,'node_modules',name),{recursive:true});
   await writeFile(join(root,'node_modules',name,'package.json'),JSON.stringify({name,version:versions[i]}));
  }
  await writeFile(join(root,'pnpm-lock.yaml'),JSON.stringify({version,members:versions}));
 };
 await write(baseline);
 const metadata=Promise.withResolvers(),metadataEntered=Promise.withResolvers(),coreEntered=Promise.withResolvers(),coreReleased=Promise.withResolvers();
 let holdNextCandidate=false;const requests=[],spawned=[];
 const core={protocolVersion:'1',async getSuiteDeclaration(request){
  const value=declaration(),target=request?.bundleVersion??latest;
  value.bundleVersion=installedBundle;
  const tuple=value.upgrades[0];tuple.bundle.version=target;
  tuple.installation={...tuple.installation,version:target,args:tuple.installation.args.map(arg=>arg.replace('@hanamesh/hanamesh@0.1.1','@hanamesh/hanamesh@'+target))};
  tuple.targets.forEach((row,i)=>{row.version=versions[i];});
  requests.push(request??null);
  if(request&&holdNextCandidate){holdNextCandidate=false;coreEntered.resolve();await coreReleased.promise;}
  return value;
 }};
 const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'official-dsh.js'),registry,coreService:()=>core,spawn:async(command,args)=>{
  spawned.push({command,args});
  assert.deepEqual(args,[join(root,'official-dsh.js'),'plugin','--profile','desktop','add','--save-exact','--registry='+registry,'@hanamesh/hanamesh@'+selected]);
  await write(selected);return{code:0};
 }});
 let state={schema:1,revision:0,sources:[]};
 const library=await createLibraryService({domain:{global:{get:async()=>state,set:async next=>{state=next;}},close:async()=>{}},host:{instanceList:()=>[],list:()=>({apps:[]})},dataRoot:root,config:{profileDir:root,registry,fixture:join(import.meta.dirname,'fixtures/catalog/provider-page.json')},installer,
  versionCatalog:{async read(){metadataEntered.resolve();return metadata.promise;},async select(name,version){assert.equal(name,'@hanamesh/hanamesh');assert.equal(version,selected);return{version,compatible:true};}},logger:{warn(){}}}).init();
 t.after(()=>{metadata.resolve({latestVersion:registryLatest,versions:[]});coreReleased.resolve();return library.close();});
 const controller=new AbortController(),background=library.versions({itemId:'hanamesh:suite'},{signal:controller.signal});
 background.catch(()=>{});await metadataEntered.promise;
 const target=await (history?library.resolveVersionTarget({itemId:'hanamesh:suite-upgrade',version:selected}):library.resolveTarget({itemId:'hanamesh:suite-upgrade'}));
 const confirmed=target.item.suiteUpgrade;
 assert.equal(confirmed.bundle.to,selected);assert.equal(typeof confirmed.planId,'string');
 holdNextCandidate=true;metadata.resolve({latestVersion:registryLatest,versions:[{version:registryLatest,compatible:true},{version:latest,compatible:true},{version:'0.1.0',compatible:true}]});
 await coreEntered.promise;
 if(cancel)controller.abort();coreReleased.resolve();
 if(cancel)await assert.rejects(background,{name:'AbortError'});
 else {const result=await background;assert.equal(result.latestVersion,latest);assert.equal(result.upgradeAvailable,true);}
 assert.equal(spawned.length,0,'background discovery never starts a CLI');
 assert(requests.some(request=>request?.registry===registry),'background uses the actual public Core composition query');
 const operation=await library.upgradeSuite({planId:confirmed.planId});await library.close();
 const terminal=library.events().events.find(event=>event.operationId===operation.operationId&&['library.install-done','library.install-failed'].includes(event.type));
 assert.equal(terminal?.type,'library.install-done','R168: background discovery must preserve the explicit confirmation plan; actual='+terminal?.code);
 assert.equal(terminal.result.version,selected);assert.equal(spawned.length,1);
 const saved=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
 assert.equal(saved.dependencies['@hanamesh/hanamesh'],selected,'the originally confirmed exact target is the one executed');
 await assert.rejects(installer.upgradeSuite({planId:confirmed.planId}),{code:'SUITE_PLAN_CHANGED'});
 assert.equal(spawned.length,1,'the confirmation remains single-use');
}

test('R168-F01 background suite metadata completion preserves an open latest confirmation',async t=>race(t));
test('R168-F01 cancellation after entering Core cannot replace the open confirmation',async t=>race(t,{cancel:true}));
test('R168-F01 background default latest completion preserves an explicit historical target',async t=>race(t,{history:true}));
