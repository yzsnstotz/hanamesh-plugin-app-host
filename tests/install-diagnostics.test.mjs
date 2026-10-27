import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,rm,mkdir,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {temporary,until} from './helpers.mjs';
import {createLibraryInstaller} from '../src/library/install.js';
import {fixtureRegistryManager,fixtureRegistryRules} from './helpers.mjs';
import {createLibraryService} from '../src/library/service.js';

test('MP01 stdout-only pnpm rejection survives the installer and asynchronous operation with secrets redacted',async t=>{
 const root=await temporary();t.after(()=>rm(root,{recursive:true,force:true}));
 await writeFile(join(root,'package.json'),'{"dependencies":{}}');
 const raw='\u001b[31m[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION]\u001b[0m @example/plugin@1.2.3 was published within the minimumReleaseAge cutoff\nBearer fake-secret-value\nhttps://fake-user:fake-pass@registry.invalid/file?token=fake-token-value';
 let calls=0;
 const installer=createLibraryInstaller({registryRules:fixtureRegistryRules,pluginManager:fixtureRegistryManager,profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.mjs'),
  fetchImpl:async()=>new Response('{"version":"1.2.3"}'),spawn:async()=>{calls++;return{code:1,stdout:raw,stderr:''};}});
 await assert.rejects(installer.installPlugin({packageName:'fixture-plugin'}),error=>{
  assert.equal(error.code,'DSH_PLUGIN_FAILED');assert.equal(error.details.code,1);assert.equal(error.details.stderr,'');
  assert.match(error.details.diagnostic,/ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION/);
  assert.doesNotMatch(error.details.diagnostic,/fake-secret-value|fake-user|fake-pass|fake-token-value|\u001b/);
  return true;
 });
 const service=createLibraryService({domain:{global:{get:()=>({schema:1,revision:0,sources:[]}),set:async()=>{}},close:async()=>{}},host:{list:()=>[]},dataRoot:root,
  config:{profileDir:root,fixture:resolve('tests/fixtures/catalog/provider-page.json')},installer});
 await service.init();t.after(()=>service.close());
 const receipt=await service.install({itemId:'com.hanamesh.utility-plugin',packageName:'@hanamesh/utility-plugin'});
 await until(()=>service.events(0).events.some(e=>e.operationId===receipt.operationId&&e.type==='library.install-failed'));
 const event=service.events(0).events.find(e=>e.operationId===receipt.operationId&&e.type==='library.install-failed');
 assert.match(event.details?.diagnostic??'',/ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION/,'asynchronous event must retain stdout diagnostic');
 assert.doesNotMatch(JSON.stringify(event),/fake-secret-value|fake-user|fake-pass|fake-token-value|\u001b/);
 assert.equal(calls,2,'one call per explicit install; no policy bypass or retries');
 assert.equal(event.recovery.status,'not-needed');
});

test('MP02 stderr failures retain bounded diagnostics and untrusted exceptions stay private',async t=>{
 const root=await temporary();t.after(()=>rm(root,{recursive:true,force:true}));await writeFile(join(root,'package.json'),'{"dependencies":{}}');
 const installer=createLibraryInstaller({registryRules:fixtureRegistryRules,pluginManager:fixtureRegistryManager,profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.mjs'),
  fetchImpl:async()=>new Response('{"version":"1.2.3"}'),spawn:async()=>({code:9,stdout:'x'.repeat(3000),stderr:'[ERR_PNPM_FETCH_404] unavailable'})});
 await assert.rejects(installer.installPlugin({packageName:'fixture-plugin'}),error=>{
  assert.equal(error.details.stderr,'[ERR_PNPM_FETCH_404] unavailable');assert.ok(error.details.diagnostic.length<=4001);return true;
 });
 const error=Object.assign(new Error('plain failure token=fake-error-token'),{details:{diagnostic:'private exception'},stack:'private stack sentinel'});
 const service=createLibraryService({domain:{global:{get:()=>({schema:1,revision:0,sources:[]}),set:async()=>{}},close:async()=>{}},host:{list:()=>[]},dataRoot:root,
  config:{profileDir:root,fixture:resolve('tests/fixtures/catalog/provider-page.json')},installer:{ready:true,install:async()=>{throw error;}}});
 await service.init();t.after(()=>service.close());const receipt=await service.install({itemId:'com.hanamesh.utility-plugin'});
 await until(()=>service.events(0).events.some(e=>e.operationId===receipt.operationId&&e.type==='library.install-failed'));
 const output=JSON.stringify(service.events(0));
 assert.match(output,/plain failure token=\[REDACTED\]/);assert.doesNotMatch(output,/private exception|private stack sentinel|fake-error-token/,'only sanitized error fields, never arbitrary details or stack');
});


async function observedInstall(t,{fetchImpl,spawn,error,pluginManager=fixtureRegistryManager}){
 const root=await temporary();await writeFile(join(root,'package.json'),'{"dependencies":{}}');let fetches=0,spawns=0;const logged=[];
 const installer=createLibraryInstaller({registryRules:fixtureRegistryRules,pluginManager,profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.mjs'),fetchImpl:async(...args)=>{fetches++;return await fetchImpl(...args);},spawn:async(...args)=>{spawns++;return await spawn(...args);}});
 if(error)await assert.rejects(installer.installPlugin({packageName:'fixture-plugin'}),actual=>actual.cause===error,'the native exception remains the named lookup error cause');
 const service=createLibraryService({domain:{global:{get:()=>({schema:1,revision:0,sources:[]}),set:async()=>{}},close:async()=>{}},host:{list:()=>[]},dataRoot:root,config:{profileDir:root,fixture:resolve('tests/fixtures/catalog/provider-page.json')},installer,logger:{warn:(...args)=>logged.push(args)}});
 await service.init();t.after(()=>service.close());const receipt=await service.install({itemId:'com.hanamesh.utility-plugin'});
 await until(()=>service.events(0).events.some(e=>e.operationId===receipt.operationId&&e.type==='library.install-failed'));
 const event=service.events(0).events.find(e=>e.operationId===receipt.operationId&&e.type==='library.install-failed');
 const diagnostic=event.details?.diagnostic;assert.equal(typeof diagnostic,'string','async failure includes a technical diagnostic');assert.ok(diagnostic.length<=4001);assert.ok(logged.some(row=>row.includes(diagnostic)),'the exact safe diagnostic is written to the real host logger');assert.ok(logged.some(row=>row.includes(receipt.operationId)),'host log is correlated to the original operation');
 return{event,diagnostic,logged,fetches,spawns};
}

test('MD01 uncoded registry fetch error retains type/message/cause/phase in technical details and host log',async t=>{
 const cause=Object.assign(new Error('fixture lookup token=fake-cause-token'),{code:'ENOTFOUND'});const error=new TypeError('fetch failed https://fake-user:fake-pass@registry.invalid/latest?token=fake-query-token\nAuthorization: Basic fake-basic\nCookie: sid=fake-cookie',{cause});error.stack='private-stack-sentinel';error.details={diagnostic:'arbitrary-details-sentinel'};
 const result=await observedInstall(t,{error,fetchImpl:async()=>{throw error;},spawn:async()=>assert.fail('registry error must not invoke CLI')});
 assert.equal(result.event.code,'REGISTRY_LOOKUP_FAILED');assert.equal(result.event.recovery.stage,'before-add');assert.equal(result.event.recovery.status,'not-needed');
 for(const wanted of [/TypeError/,/fetch failed/,/registry fetch/,/ENOTFOUND/,/fixture lookup/])assert.match(result.diagnostic,wanted);
 assert.doesNotMatch(JSON.stringify([result.event,result.logged]),/fake-user|fake-pass|fake-query-token|fake-cause-token|fake-basic|fake-cookie|private-stack-sentinel|arbitrary-details-sentinel/);
 assert.equal(result.fetches,2);assert.equal(result.spawns,0,'no retries or CLI changes');
});

test('MD02 CLI nonzero exit keeps code/exit/stderr summary and writes the host diagnostic',async t=>{
 const result=await observedInstall(t,{fetchImpl:async()=>Response.json({version:'1.2.3'}),spawn:async()=>({code:17,signal:null,stdout:'fixture stdout',stderr:'[ERR_PNPM_FIXTURE] exact refusal Bearer fake-cli-secret'})});
 assert.equal(result.event.code,'DSH_PLUGIN_FAILED');assert.equal(result.event.recovery.stage,'add');assert.equal(result.event.recovery.status,'not-needed');
 for(const wanted of [/AppHostError/,/CLI run/,/exit[^\n]*17/i,/stderr[^\n]*ERR_PNPM_FIXTURE/i,/fixture stdout/])assert.match(result.diagnostic,wanted);
 assert.doesNotMatch(JSON.stringify([result.event,result.logged]),/fake-cli-secret/);assert.equal(result.fetches,1);assert.equal(result.spawns,1);
});

test('MD03 registry HTTP failure retains original typed code and status without invoking CLI',async t=>{
 const result=await observedInstall(t,{fetchImpl:async()=>new Response('private response body must not enter diagnostics',{status:503}),spawn:async()=>assert.fail('registry refusal must not invoke CLI')});
 assert.equal(result.event.code,'REGISTRY_LOOKUP_FAILED');assert.equal(result.event.recovery.stage,'before-add');
 for(const wanted of [/AppHostError/,/registry fetch/,/Registry latest lookup failed/,/503/])assert.match(result.diagnostic,wanted);
 assert.doesNotMatch(JSON.stringify([result.event,result.logged]),/private response body/);assert.equal(result.fetches,1);assert.equal(result.spawns,0);
});


test('MD05 profile readback refusal is labelled readback, not registry or CLI failure',async t=>{
 const result=await observedInstall(t,{fetchImpl:async()=>Response.json({version:'1.2.3'}),spawn:async()=>({code:0,stdout:'',stderr:''})});
 assert.equal(result.event.code,'INSTALL_READBACK_MISMATCH');assert.equal(result.event.recovery.stage,'readback');
 assert.match(result.diagnostic,/Phase: profile readback/);assert.match(result.diagnostic,/profile does not resolve the exact version/);assert.equal(result.fetches,1);assert.equal(result.spawns,1);
});


test('MD06 malformed registry JSON keeps the original SyntaxError and registry readback phase',async t=>{
 const result=await observedInstall(t,{fetchImpl:async()=>new Response('<fixture invalid json>'),spawn:async()=>assert.fail('invalid metadata must not invoke CLI')});
 assert.equal(result.event.code,'REGISTRY_LOOKUP_FAILED');assert.equal(result.event.recovery.stage,'before-add');assert.match(result.diagnostic,/SyntaxError/);assert.match(result.diagnostic,/Phase: registry readback/);assert.equal(result.fetches,1);assert.equal(result.spawns,0);
});


// Public pluginManager.registries() DTO: the same first source and ordered fallbacks as native DSH.
const registryManager=(registry,fallbackRegistries=[])=>()=>({registries:async()=>({registry,fallbackRegistries,resolved:registry})});
test('MD07 configured reachable registry is used for lookup and the exact CLI install, without querying npmjs',async t=>{
 const root=await temporary();await writeFile(join(root,'package.json'),'{}');const asked=[],commands=[];
 const installer=createLibraryInstaller({registryRules:fixtureRegistryRules,pluginManager:fixtureRegistryManager,profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.mjs'),pluginManager:registryManager('https://configured.invalid/'),
  fetchImpl:async url=>{asked.push(String(url));if(new URL(url).hostname!=='configured.invalid')throw new TypeError('fixture npmjs unreachable');return Response.json({version:'1.2.3'});},
  spawn:async(_command,args)=>{commands.push(args);const dir=join(root,'node_modules','fixture-plugin');await mkdir(dir,{recursive:true});await writeFile(join(dir,'package.json'),JSON.stringify({name:'fixture-plugin',version:'1.2.3'}));await writeFile(join(root,'package.json'),JSON.stringify({dependencies:{'fixture-plugin':'1.2.3'}}));return{code:0,stdout:'',stderr:''};}});
 const result=await installer.installPlugin({packageName:'fixture-plugin'});assert.equal(result.version,'1.2.3');assert.deepEqual(asked,['https://configured.invalid/fixture-plugin/latest']);assert(commands[0].includes('--registry=https://configured.invalid/'));
});
test('MD08 configured registry unreachable is a named lookup failure with original cause, safe phase, and no CLI',async t=>{
 const root=await temporary();await writeFile(join(root,'package.json'),'{}');let calls=0;const original=new TypeError('fixture source unreachable',{cause:Object.assign(new Error('fixture DNS'),{code:'ENOTFOUND'})});
 const installer=createLibraryInstaller({registryRules:fixtureRegistryRules,pluginManager:fixtureRegistryManager,profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.mjs'),pluginManager:registryManager('https://configured.invalid/'),fetchImpl:async()=>{calls++;throw original;},spawn:async()=>assert.fail('no CLI after lookup failure')});
 await assert.rejects(installer.installPlugin({packageName:'fixture-plugin'}),error=>{assert.equal(error.code,'REGISTRY_LOOKUP_FAILED');assert.equal(error.cause,original);return true;});assert.equal(calls,1);
});

async function sourceFixture(t,{registry='https://first.invalid/',fallbacks=['https://second.invalid/','https://third.invalid/'],override,fetchImpl,manager}={}){
 const root=await temporary();await writeFile(join(root,'package.json'),'{}');const commands=[];
 const installer=createLibraryInstaller({registryRules:fixtureRegistryRules,profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.mjs'),registry:override,pluginManager:manager??registryManager(registry,fallbacks),fetchImpl,
  spawn:async(_command,args)=>{commands.push(args);const dir=join(root,'node_modules','fixture-plugin');await mkdir(dir,{recursive:true});await writeFile(join(dir,'package.json'),JSON.stringify({name:'fixture-plugin',version:'1.2.3'}));await writeFile(join(root,'package.json'),JSON.stringify({dependencies:{'fixture-plugin':'1.2.3'}}));return{code:0,stdout:'',stderr:''};}});
 return{installer,commands};
}
test('MD09 DSH configured fallbacks retain source order, de-duplicate, and pin the answering source for CLI',async t=>{
 const asked=[];const h=await sourceFixture(t,{registry:'https://registry.npmjs.org/',fallbacks:['https://registry.npmjs.org/','https://second.invalid/','https://third.invalid/'],fetchImpl:async url=>{asked.push(new URL(url).origin);if(asked.length===1)throw new TypeError('fixture network failure');if(asked.length===2)return new Response('',{status:404});return Response.json({version:'1.2.3'});}});
 assert.equal((await h.installer.installPlugin({packageName:'fixture-plugin'})).version,'1.2.3');assert.deepEqual(asked,['https://registry.npmjs.org','https://second.invalid','https://third.invalid']);assert(h.commands[0].includes('--registry=https://third.invalid/'));
});
test('MD10 private explicit source never falls through into public configured sources',async t=>{
 const asked=[];const h=await sourceFixture(t,{override:'https://private.invalid/',fetchImpl:async url=>{asked.push(new URL(url).origin);throw new TypeError('fixture private registry unreachable');}});
 await assert.rejects(h.installer.installPlugin({packageName:'fixture-plugin'}),{code:'REGISTRY_LOOKUP_FAILED'});assert.deepEqual(asked,['https://private.invalid']);assert.equal(h.commands.length,0);
});
test('MD11 pnpm-own source is read only through DSH public resolved fact; absent public API fails without any query',async t=>{
 const asked=[];const h=await sourceFixture(t,{manager:()=>({registries:async()=>({registry:null,fallbackRegistries:[],resolved:'https://pnpm-configured.invalid/'})}),fetchImpl:async url=>{asked.push(String(url));return Response.json({version:'1.2.3'});}});
 await h.installer.installPlugin({packageName:'fixture-plugin'});assert.deepEqual(asked,['https://pnpm-configured.invalid/fixture-plugin/latest']);assert.equal(h.commands[0].some(arg=>arg.startsWith('--registry=')),false,'pnpm-own null source must preserve pnpm scope/auth configuration');
 for(const manager of [()=>({}),()=>({registries:async()=>({registry:null,resolved:null,fallbackRegistries:[]})})]){const absent=await sourceFixture(t,{manager,fetchImpl:async()=>assert.fail('must not invent a registry')});await assert.rejects(absent.installer.installPlugin({packageName:'fixture-plugin'}),{code:'REGISTRY_CONFIG_UNAVAILABLE'});assert.equal(absent.commands.length,0);}
});
test('MD12 deadline aborts a hung registry lookup with named diagnostic, no retry or fallback or CLI',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let started,signal;const fetching=new Promise(resolve=>started=resolve);let calls=0;
 const h=await sourceFixture(t,{registry:'https://registry.npmjs.org/',fetchImpl:async(_url,options)=>{calls++;signal=options.signal;started();return await new Promise(()=>{});}});
 const result=h.installer.installPlugin({packageName:'fixture-plugin'});const rejected=assert.rejects(result,error=>{assert.equal(error.code,'REGISTRY_LOOKUP_TIMEOUT');assert.equal(error.status,504);return true;});
 await fetching;t.mock.timers.tick(30000);await rejected;assert.equal(signal.aborted,true);assert.equal(calls,1);assert.equal(h.commands.length,0);
});
test('MD13 configured unreachable source diagnostic reaches both technical details and host log',async t=>{
 const original=new TypeError('fixture configured source failed',{cause:Object.assign(new Error('fixture refusal'),{code:'ECONNRESET'})});
 const result=await observedInstall(t,{pluginManager:registryManager('https://configured.invalid/'),fetchImpl:async()=>{throw original;},spawn:async()=>assert.fail('no CLI')});
 assert.equal(result.event.code,'REGISTRY_LOOKUP_FAILED');assert.match(result.diagnostic,/Phase: registry fetch/);assert.match(result.diagnostic,/TypeError.*fixture configured source failed/);assert.match(result.diagnostic,/ECONNRESET/);assert.equal(result.fetches,1);assert.equal(result.spawns,0);
});

test('MD14 HTTP 503 follows DSH configured network fallback, while 401 never changes source',async t=>{
 for(const status of [503,401]){let calls=0;const h=await sourceFixture(t,{registry:'https://registry.npmjs.org/',fetchImpl:async()=>{calls++;return calls===1?new Response('',{status}):Response.json({version:'1.2.3'});}});
  if(status===503){await h.installer.installPlugin({packageName:'fixture-plugin'});assert.equal(calls,2);assert(h.commands[0].includes('--registry=https://second.invalid/'));}
  else{await assert.rejects(h.installer.installPlugin({packageName:'fixture-plugin'}),{code:'REGISTRY_LOOKUP_FAILED'});assert.equal(calls,1);assert.equal(h.commands.length,0);}
 }
});


test('MIN01 missing or failed host registry rule port is named config-unavailable before any fetch or CLI',async t=>{
 const root=await temporary();await writeFile(join(root,'package.json'),'{}');
 for(const registryRules of [undefined,async()=>({}),async()=>{throw Object.assign(new Error('fixture missing public export'),{code:'ERR_MODULE_NOT_FOUND'});}]){
  const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.mjs'),pluginManager:fixtureRegistryManager,registryRules,fetchImpl:async()=>assert.fail('no query without host rule module'),spawn:async()=>assert.fail('no CLI')});
  await assert.rejects(installer.installPlugin({packageName:'fixture-plugin'}),{code:'REGISTRY_CONFIG_UNAVAILABLE'});
 }
});


test('MIN03 test-only public DSH rc.2 registry rules retain their audited original SHA',async()=>{
 const bytes=await readFile(new URL('./fixtures/dsh-registry-0.2.0-rc.2.js',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'9b8e2a742c989c4741dc4e5a2ba25a00b305d71b5eea90213d24a38ebb53ae5d');
});
