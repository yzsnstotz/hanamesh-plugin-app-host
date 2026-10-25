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
 const error=Object.assign(new Error('private exception'),{details:{diagnostic:'private exception'}});
 const service=createLibraryService({domain:{global:{get:()=>({schema:1,revision:0,sources:[]}),set:async()=>{}},close:async()=>{}},host:{list:()=>[]},dataRoot:root,
  config:{profileDir:root,fixture:resolve('tests/fixtures/catalog/provider-page.json')},installer:{ready:true,install:async()=>{throw error;}}});
 await service.init();t.after(()=>service.close());const receipt=await service.install({itemId:'com.hanamesh.utility-plugin'});
 await until(()=>service.events(0).events.some(e=>e.operationId===receipt.operationId&&e.type==='library.install-failed'));
 assert.doesNotMatch(JSON.stringify(service.events(0)),/private exception/,'do not expose arbitrary exception details');
});
