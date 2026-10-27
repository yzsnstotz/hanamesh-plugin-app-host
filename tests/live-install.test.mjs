// Guarded CLI process integration; own profile fixture only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createLibraryInstaller } from '../src/library/install.js';
import {fixtureRegistryManager,fixtureRegistryRules} from './helpers.mjs';
import { detectClient, containingApp } from '../src/library/client-identity.js';
import { temporary } from './helpers.mjs';

async function profile(t) {
  const dir = await temporary(); t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'profile', dependencies: {}, dsh: { profile: { bundles: [] } } }));
  return dir;
}
const registry = version => async () => ({ ok: true, json: async () => ({ version }) });
const item = { id: 'example.notes', package: { registry: 'npm', name: 'example-notes' } };

const cliFixture=new URL('./fixtures/profile-cli.mjs',import.meta.url).pathname;
test('plugin install and remove use a guarded CLI, exact registry version, and restart-required',async t=>{
 const dir=await profile(t),events=[];let managerCalls=0;
 const installer=createLibraryInstaller({registryRules:fixtureRegistryRules,pluginManager:fixtureRegistryManager,profileDir:dir,profileName:'desktop',dataRoot:dir,fetchImpl:registry('1.2.3'),nodeBinary:process.execPath,dshBin:cliFixture,
  pluginManager:()=>({...fixtureRegistryManager(),installBundle(){managerCalls++;},removeBundle(){managerCalls++;}}),emit:e=>events.push(e)});
 assert.equal(installer.ready,true);assert.equal(installer.live,false);
 assert.deepEqual(await installer.install(item),{status:'restart-required',kind:'plugin',packageName:'example-notes',version:'1.2.3'});
 assert.equal(JSON.parse(await readFile(join(dir,'package.json'),'utf8')).dependencies['example-notes'],'1.2.3');
 assert.deepEqual(await installer.uninstallPlugin({packageName:'example-notes'}),{status:'restart-required',kind:'plugin',packageName:'example-notes'});
 assert.equal(managerCalls,0);assert.deepEqual(events.map(e=>e.type),['library.install-started','library.install-done']);
});
test('guarded CLI failure retains its failure and reports compensation status',async t=>{
 const dir=await profile(t),events=[];await writeFile(join(dir,'.fixture-fail'),'own failure');
 const installer=createLibraryInstaller({registryRules:fixtureRegistryRules,pluginManager:fixtureRegistryManager,profileDir:dir,profileName:'desktop',dataRoot:dir,fetchImpl:registry('1.0.0'),nodeBinary:process.execPath,dshBin:cliFixture,emit:e=>events.push(e)});
 await assert.rejects(installer.install(item),error=>error.code==='DSH_PLUGIN_FAILED'&&error.details.code===19&&error.recovery.status==='not-needed');
 assert.equal(events.at(-1).type,'library.install-failed');
});
test('without a public CLI even an exact-save manager refuses with the missing monitored path',async t=>{
 const dir=await profile(t),installer=createLibraryInstaller({registryRules:fixtureRegistryRules,pluginManager:fixtureRegistryManager,profileDir:dir,profileName:'desktop',dataRoot:dir,fetchImpl:registry('1.0.0')});
 assert.equal(installer.ready,false);assert.equal(installer.live,false);
 await assert.rejects(installer.install(item),error=>error.code==='DSH_EXACT_INSTALL_UNAVAILABLE'&&/Git/.test(error.details.need[0].need));
});

test('client identity comes from the containing app bundle id only', async () => {
  assert.equal(containingApp('/Applications/HanaMesh.app/Contents/Resources/app/runtime'), '/Applications/HanaMesh.app');
  assert.equal(containingApp('/opt/dsh/runtime'), undefined);
  assert.deepEqual(await detectClient({}), { client: 'dsh', evidence: 'not-desktop' });
  const desktop = { runtimeDir: '/Applications/HanaMesh.app/Contents/Resources/app/runtime' };
  assert.deepEqual(await detectClient({ desktop, readBundleId: async () => 'com.hanamesh.desktop' }), { client: 'hanamesh', evidence: 'bundle-id:com.hanamesh.desktop' });
  assert.equal((await detectClient({ desktop, readBundleId: async () => 'com.deepseek.harness' })).client, 'dsh');
  const unreadable = await detectClient({ desktop, readBundleId: async () => { throw Object.assign(new Error('x'), { code: 'ENOENT' }); } });
  assert.deepEqual(unreadable, { client: 'dsh', evidence: 'bundle-id-unreadable:ENOENT' });
});

test('live result from an admitted installer updates the service loaded baseline (public service fixture)',async t=>{
 const {createLibraryService}=await import('../src/library/service.js');
 const {until}=await import('./helpers.mjs');const dir=await profile(t);
 const cli=createLibraryInstaller({registryRules:fixtureRegistryRules,pluginManager:fixtureRegistryManager,profileDir:dir,profileName:'desktop',dataRoot:dir,nodeBinary:process.execPath,dshBin:cliFixture,fetchImpl:registry('1.0.0')});
 const library=createLibraryService({domain:{global:{get:()=>({schema:1,revision:0,sources:[]}),set:async()=>{}},close:async()=>{}},host:{instanceList:()=>[],list:()=>[]},dataRoot:dir,
  config:{profileDir:dir,fixture:new URL('./fixtures/catalog/provider-page.json',import.meta.url).pathname},
  // Only the admitted public service port reports applied; this is not the production CLI or a real host reload.
  installer:{install:async item=>({...await cli.install(item),status:'applied'})}});
 await library.init();t.after(()=>library.close());await library.install({packageName:'@hanamesh/utility-plugin'});
 await until(()=>library.events().events.some(event=>event.type==='library.install-done'));
 const done=library.events().events.find(event=>event.type==='library.install-done');assert.deepEqual(done.result.restartBaseline,{updated:true});
 assert.equal((await library.installedPlugins()).find(row=>row.packageName==='@hanamesh/utility-plugin')?.state,'installed');
});
