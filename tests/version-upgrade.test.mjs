import test from 'node:test';
import assert from 'node:assert/strict';
import {createNpmVersionCatalog} from '../src/library/versions.js';
import {readSuiteStatus} from '../src/library/suite.js';
import {writeSuiteProfile,names,versions} from './fixtures/core-suite-declaration.mjs';
import {scratch} from './helpers.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
const name='fixture-plugin';
const row=version=>({name,version,engines:{node:'>=24'},dsh:{bundle:{patch:'./patch.yml'}},peerDependencies:{react:'^18'}});
const data={name,'dist-tags':{latest:'2.0.0'},versions:{'1.0.0':row('1.0.0'),'1.1.0':row('1.1.0'),'2.0.0':{...row('2.0.0'),engines:{node:'>=25'}}}};
const response=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
test('VR1 version listing compares exact releases, defaults to latest compatible and retains history',async()=>{
 const calls=[];const catalog=createNpmVersionCatalog({fetchImpl:async(url,options)=>{calls.push({url,options});return response(data)},peerVersion:async()=> '18.3.1',nodeVersion:'24.13.1'});
 const result=await catalog.read(name);assert.equal(result.latestVersion,'1.1.0');assert.deepEqual(result.versions.map(r=>[r.version,r.compatible]),[['2.0.0',false],['1.1.0',true],['1.0.0',true]]);
 assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.redirect,'error');
 assert.equal((await catalog.select(name,'1.0.0')).version,'1.0.0');
 await assert.rejects(catalog.select(name,'2.0.0'),{code:'PLUGIN_VERSION_INCOMPATIBLE'});
 await assert.rejects(catalog.select(name,'^1.0.0'),{code:'INVALID_INPUT'});
 await assert.rejects(catalog.read('../escape'),{code:'INVALID_INPUT'});
});
test('VR1 registry failure and missing peer facts remain visible and never select a version',async()=>{
 const catalog=createNpmVersionCatalog({fetchImpl:async()=>response(data),peerVersion:async()=>null,nodeVersion:'24.13.1'});
 assert.equal((await catalog.read(name)).latestVersion,null);
 await assert.rejects(catalog.select(name,'1.0.0'),{code:'PLUGIN_VERSION_INCOMPATIBLE'});
 await assert.rejects(createNpmVersionCatalog({fetchImpl:async()=>{throw Error('offline')}}).read(name),{code:'PLUGIN_VERSIONS_UNAVAILABLE'});
});
test('VR1 physical suite readback accepts installed versions inside compatible bundle ranges',async()=>{
 const root=await scratch('version-suite-');await writeSuiteProfile(root,versions);
 for(const [i,name]of names.entries()){const dir=join(root,'node_modules',name);await mkdir(dir,{recursive:true});await writeFile(join(dir,'package.json'),JSON.stringify({name,version:versions[i]}));}
 const path=join(root,'node_modules/@hanamesh/hanamesh/package.json'),bundle=JSON.parse(await readFile(path,'utf8'));bundle.dependencies=Object.fromEntries(names.map((name,i)=>[name,'^'+versions[i]]));await writeFile(path,JSON.stringify(bundle));
 assert.equal((await readSuiteStatus(root)).status,'installed');
});

test('VR1 history selection uses the catalog identity and cannot weaken the public install protocol',async t=>{
 const {createLibraryService}=await import('../src/library/service.js');let state={schema:1,revision:0,sources:[]};const calls=[];
 const service=await createLibraryService({domain:{global:{get:async()=>state,set:async value=>{state=value}},close:async()=>{}},host:{list:()=>({apps:[]})},config:{fixture:join(import.meta.dirname,'fixtures/catalog/reviewed-page.json')},versionCatalog:{select:async(name,version)=>{calls.push({name,version});if(version==='9.0.0')throw Object.assign(Error('incompatible'),{code:'PLUGIN_VERSION_INCOMPATIBLE'});}},installer:{ready:true,install:async item=>{calls.push({item});return{status:'restart-required',version:item.installTarget.version}}}}).init();t.after(()=>service.close());
 const input={itemId:'com.hanamesh.utility-plugin',version:'0.9.0'};
 await assert.rejects(service.resolveTarget(input),{code:'INVALID_INPUT'});
 await assert.rejects(service.install(input),{code:'INVALID_INPUT'});
 const target=await service.resolveVersionTarget(input);assert.equal(target.item.installTarget.version,'0.9.0');assert.equal(target.item.selectedVersion,'0.9.0');
 await assert.rejects(service.resolveVersionTarget({...input,version:'9.0.0'}),{code:'PLUGIN_VERSION_INCOMPATIBLE'});
 const started=await service.installVersion({...input,installTarget:target.item.installTarget});
 await service.close();assert(service.events().events.some(event=>event.operationId===started.operationId&&event.type==='library.install-done'));
 assert.equal(calls.find(row=>row.item).item.installTarget.version,'0.9.0');
});

test('VR1 failed suite replacement restores the original bundle and physical members before reporting failure',async()=>{
 const {createLibraryInstaller}=await import('../src/library/install.js');const {installation}=await import('./fixtures/core-suite-declaration.mjs');
 const root=await scratch('version-restore-');const before=Object.fromEntries(names.map((name,i)=>[name,versions[i]])),after=Object.fromEntries(names.map(name=>[name,'9.0.0']));
 const write=async(memberVersions,bundleVersion)=>{await writeSuiteProfile(root,memberVersions,bundleVersion);for(const name of names){await mkdir(join(root,'node_modules',name),{recursive:true});await writeFile(join(root,'node_modules',name,'package.json'),JSON.stringify({name,version:memberVersions[name]}));}await writeFile(join(root,'pnpm-lock.yaml'),JSON.stringify({bundleVersion,memberVersions}));};
 await write(before,'0.1.0');let calls=0;
 const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'official.js'),coreSuitePlan:async()=>({available:true,bundle:{name:'@hanamesh/hanamesh',from:'0.1.0',to:'0.1.1'},installation,installCommand:null,components:names.map(name=>({name,from:before[name],to:after[name]}))}),spawn:async(_command,args)=>{calls++;if(args.at(-1)==='@hanamesh/hanamesh@0.1.1'){await write(after,'0.1.1');return{code:1,stderr:'fixture replacement failure'};}assert.equal(args.at(-1),'@hanamesh/hanamesh@0.1.0');await write(before,'0.1.0');return{code:0};}});
 const plan=await installer.prepareSuiteUpgrade();await assert.rejects(installer.upgradeSuite({planId:plan.planId}),error=>error.code==='DSH_PLUGIN_FAILED'&&error.recovery.status==='restored');
 assert.equal(calls,2);const status=await readSuiteStatus(root);assert.equal(status.version,'0.1.0');assert.deepEqual(status.components.map(row=>row.version),versions);
});

 test('VR1 engine-only DSH requirements cannot become the default compatible version',async()=>{
 const data={name,'dist-tags':{latest:'2.0.0'},versions:{'1.0.0':row('1.0.0'),'2.0.0':{...row('2.0.0'),engines:{dsh:'>=0.9.0'}}}};
 const catalog=createNpmVersionCatalog({fetchImpl:async()=>response(data),nodeVersion:'24.13.1',anchor:new URL('../package.json',import.meta.url),peerVersion:async name=>name==='@deepseek-ai/dsh'?'0.2.2-rc.1':'18.3.1'});
 const result=await catalog.read(name);assert.equal(result.latestVersion,'1.0.0');assert.equal(result.versions[0].reason,'PLUGIN_PEER_INCOMPATIBLE');
 });
