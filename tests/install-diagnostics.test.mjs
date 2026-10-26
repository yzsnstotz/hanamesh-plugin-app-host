import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {temporary,until} from './helpers.mjs';
import {createLibraryInstaller} from '../src/library/install.js';
import {createLibraryService} from '../src/library/service.js';

test('MP01 stdout-only pnpm rejection survives the installer and asynchronous operation with secrets redacted',async t=>{
 const root=await temporary();t.after(()=>rm(root,{recursive:true,force:true}));
 await writeFile(join(root,'package.json'),'{"dependencies":{}}');
 const raw='\u001b[31m[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION]\u001b[0m @example/plugin@1.2.3 was published within the minimumReleaseAge cutoff\nBearer fake-secret-value\nhttps://fake-user:fake-pass@registry.invalid/file?token=fake-token-value';
 let calls=0;
 const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.mjs'),
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
 const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.mjs'),
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


async function observedInstall(t,{fetchImpl,spawn,error}){
 const root=await temporary();await writeFile(join(root,'package.json'),'{"dependencies":{}}');let fetches=0,spawns=0;const logged=[];
 const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.mjs'),fetchImpl:async(...args)=>{fetches++;return await fetchImpl(...args);},spawn:async(...args)=>{spawns++;return await spawn(...args);}});
 if(error)await assert.rejects(installer.installPlugin({packageName:'fixture-plugin'}),actual=>actual===error,'the original exception must be rethrown unchanged');
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
 assert.equal(result.event.code,'LIBRARY_OPERATION_FAILED');assert.equal(result.event.recovery.stage,'before-add');assert.equal(result.event.recovery.status,'not-needed');
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
 assert.equal(result.event.code,'LIBRARY_OPERATION_FAILED');assert.equal(result.event.recovery.stage,'before-add');assert.match(result.diagnostic,/SyntaxError/);assert.match(result.diagnostic,/Phase: registry readback/);assert.equal(result.fetches,1);assert.equal(result.spawns,0);
});


// Public pluginManager.registries() DTO: the same first source and ordered fallbacks as native DSH.
const registryManager=(registry,fallbackRegistries=[])=>()=>({registries:async()=>({registry,fallbackRegistries,resolved:registry})});
test('MD07 configured reachable registry is used for lookup and the exact CLI install, without querying npmjs',async t=>{
 const root=await temporary();await writeFile(join(root,'package.json'),'{}');const asked=[],commands=[];
 const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.mjs'),pluginManager:registryManager('https://configured.invalid/'),
  fetchImpl:async url=>{asked.push(String(url));if(new URL(url).hostname!=='configured.invalid')throw new TypeError('fixture npmjs unreachable');return Response.json({version:'1.2.3'});},
  spawn:async(_command,args)=>{commands.push(args);const dir=join(root,'node_modules','fixture-plugin');await (await import('node:fs/promises')).mkdir(dir,{recursive:true});await writeFile(join(dir,'package.json'),JSON.stringify({name:'fixture-plugin',version:'1.2.3'}));await writeFile(join(root,'package.json'),JSON.stringify({dependencies:{'fixture-plugin':'1.2.3'}}));return{code:0,stdout:'',stderr:''};}});
 const result=await installer.installPlugin({packageName:'fixture-plugin'});assert.equal(result.version,'1.2.3');assert.deepEqual(asked,['https://configured.invalid/fixture-plugin/latest']);assert(commands[0].includes('--registry=https://configured.invalid/'));
});
test('MD08 configured registry unreachable is a named lookup failure with original cause, safe phase, and no CLI',async t=>{
 const root=await temporary();await writeFile(join(root,'package.json'),'{}');let calls=0;const original=new TypeError('fixture source unreachable',{cause:Object.assign(new Error('fixture DNS'),{code:'ENOTFOUND'})});
 const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.mjs'),pluginManager:registryManager('https://configured.invalid/'),fetchImpl:async()=>{calls++;throw original;},spawn:async()=>assert.fail('no CLI after lookup failure')});
 await assert.rejects(installer.installPlugin({packageName:'fixture-plugin'}),error=>{assert.equal(error.code,'REGISTRY_LOOKUP_FAILED');assert.equal(error.cause,original);return true;});assert.equal(calls,1);
});
