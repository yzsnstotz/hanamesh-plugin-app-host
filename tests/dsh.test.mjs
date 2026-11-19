/**
 * REAL Cordis root with the PINNED DSH service stack: dsh-storage + storage-json backend +
 * storage-domain, host-webserver on an OS port, jsonl session persistence. Only `connection` is a
 * stand-in (AUTH_DOUBLE): the real service exists only inside the web profile composition, which the
 * H01 profile run in docs/acceptance/ exercises. Evidence class: REAL_HOST for storage/web/session.
 */
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, readdir, mkdir, writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as storageJson from '@deepseek-ai/dsh-storage-json';
import * as storageDomain from '@deepseek-ai/dsh-storage-domain';
import WebServer from '@deepseek-ai/dsh-host-webserver';
import SessionStore from '@deepseek-ai/dsh-session';
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection';
import * as JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl';
import * as appHost from '../src/dsh.js';
import { definition, temporary, http, until, pidAlive } from './helpers.mjs';
import {assertOwnedPlatformRejection,verifyOwnedPlatformRejection} from './platform-owned.mjs';
import {declaration as coreDeclaration,core as suiteCore,names as suiteNames,versions as suiteVersions} from './fixtures/core-suite-declaration.mjs';

/** AUTH_DOUBLE for ctx.connection: accepts exactly one bearer, rejects everything else. */
function connectionDouble(token) {
  return { requestRejection: request => request.headers?.authorization === `Bearer ${token}` ? undefined : { status: 401 } };
}
async function boot(t, { token = 'browser-session', withPlugin = true, applications = [definition()], config = {} } = {}) {
  const root = await temporary();
  const ctx = new Context();
  // Register ownership immediately: activation failure must still close the real HTTP listener.
  t.after(async () => { await ctx.fiber?.dispose?.(); await rm(root, { recursive: true, force: true }); });
  const activationErrors=[];ctx.logger.exporter({export:message=>{if(message.type==='error')activationErrors.push(message.args.map(value=>value instanceof Error?{name:value.name,code:value.code,message:value.message}:String(value)).slice(0,4));}});
  ctx.plugin(Storage);
  ctx.plugin(storageJson, { root: join(root, 'storages') });
  ctx.plugin(storageDomain, { backend: 'json' });
  ctx.plugin(SessionStore);
  ctx.plugin(SessionProjectionRegistry);
  ctx.plugin(JsonlSessionPersistence, { root: join(root, 'sessions') });
  ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 });
  ctx.provide('connection', connectionDouble(token));
  await ctx.start?.();
  await until(() => ctx.get('webServer')?.port > 0);
  const origin = `http://127.0.0.1:${ctx.get('webServer').port}`;
  let fiber;
  if (withPlugin) {
    // Tests never bind the real handoff ports (39317…); handoff routes are covered in handoff.test.mjs on random ports.
    fiber = ctx.plugin(appHost, { dataRoot: join(root, 'app-data'), applications, ...config, library: { handoff: { enabled: false }, ...config.library } });
    try{await until(() => ctx.get('hanameshApps') !== undefined);}catch(error){throw new Error('AppHost activation did not provide hanameshApps: '+JSON.stringify(activationErrors).slice(-6000),{cause:error});}
  }
  const headers = { origin, authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-hanamesh-client': 'workspace-v1' };
  const merge = overrides => Object.fromEntries(Object.entries({ ...headers, ...overrides }).filter(([, v]) => v !== undefined));
  return { ctx, root, origin, fiber, headers,
    post: (path, body, overrides = {}) => http(origin + path, { method: 'POST', headers: merge(overrides), body: JSON.stringify(body) }),
    get: (path, overrides = {}) => http(origin + path, { headers: merge(overrides) }) };
}

test('H01 (harness half): the plugin activates on a real Cordis root and provides ctx.hanameshApps', async t => {
  const h = await boot(t);
  const host = h.ctx.get('hanameshApps');
  for (const method of ['register', 'start', 'stop', 'stopAll', 'instance', 'instanceList', 'logTail', 'open', 'close']) assert.equal(typeof host[method], 'function', method);
  assert.deepEqual(host.list().apps.map(a => a.id), ['example']);
  const [types, consistency] = await Promise.all([
    readFile(new URL('../src/index.d.ts', import.meta.url), 'utf8'),
    readFile(new URL('../consistency.json', import.meta.url), 'utf8'),
  ]);
  assert.match(types, /domain:'hanamesh_app_host'/);
  assert.doesNotMatch(types, /domain:'hanamesh-app-host'/);
  assert.equal(consistency.includes('hanamesh-app-host'), false);
  assert.equal(consistency.includes('hanamesh_app_host'), true);
});

test('H11: lease/instance state lands in the storage-domain sidecar and DSH still reads its own session', async t => {
  const h = await boot(t);
  // A DSH session written by DSH itself, before the app-host touches the medium.
  const persistence = h.ctx.get('sessionPersistence');
  const session = h.ctx.get('sessions').create('ses-h11', { meta: { cwd: h.root } });
  const handle = await persistence.create(session.header);
  await handle.flush(); await handle.close?.();
  const opened = await h.post('/apps/open', { appId: 'example', deploymentId: 'local', viewId: 'view-h11' });
  if(process.platform==='win32'){assert.equal(opened.json.error?.code,'PLATFORM_UNSUPPORTED');assert.equal(opened.status,400);}else assert.equal(opened.status, 200, JSON.stringify(opened.json));
  const ready = await until(async () => (await h.get('/hanamesh/apps')).json.instances.find(i => i.status === (process.platform==='win32'?'failed':'ready')));
  assert.equal(ready.appId, 'example');
  // (1) sidecar: the whole snapshot is ONE storage-domain global in the json backend's unit file.
  const files = await readdir(join(h.root, 'storages'));
  const unit = files.find(f => f.startsWith('hanamesh_app_host'));
  assert.ok(unit, `storage-domain unit missing among ${files}`);
  const stored = JSON.parse(await readFile(join(h.root, 'storages', unit), 'utf8'));
  const snapshot = stored.global ?? stored;
  assert.equal(snapshot.instances.length, 1); assert.equal(snapshot.leases.length, 1);
  assert.equal(snapshot.leases[0].viewId, 'view-h11'); assert.ok(!('leaseToken' in snapshot.leases[0]));
  if(process.platform==='win32'){assert.equal(snapshot.instances[0].errorCode,'PLATFORM_UNSUPPORTED');assert.equal(snapshot.instances[0].pid,null);assert.equal(snapshot.instances[0].guardianPid,null);assert.equal(snapshot.leases[0].status,'failed');}
  // (2) DSH reads the session it wrote, after the app-host published into the same storage root.
  const stat = await persistence.stat('ses-h11');
  assert.ok(stat, 'DSH could not read back its own session after the app-host write');
  assert.equal((await readdir(join(h.root, 'sessions'), { recursive: true })).some(f => f.includes('ses-h11')), true);
});

test('H14/AC-07 on the real web server: unauthenticated, wrong origin and iframe callers are refused', async t => {
  const h = await boot(t);
  assert.equal((await h.get('/hanamesh/apps', { authorization: 'Bearer forged' })).status, 401);
  assert.equal((await h.post('/apps/open', { appId: 'example', deploymentId: 'local', viewId: 'v' }, { authorization: undefined })).status, 401);
  assert.equal((await h.post('/apps/open', { appId: 'example', deploymentId: 'local', viewId: 'v' }, { origin: 'http://attacker.invalid' })).status, 403);
  assert.equal((await h.post('/apps/open', { appId: 'example', deploymentId: 'local', viewId: 'v' }, { 'sec-fetch-dest': 'iframe' })).status, 403);
  assert.equal((await h.post('/apps/open', { appId: 'example', deploymentId: 'local', viewId: 'v', command: '/bin/sh' })).status, 400);
  assert.equal(h.ctx.get('hanameshApps').instanceList(appHost.BROWSER_PRINCIPAL).length, 0);
});

test('H09/dispose: unloading the plugin removes its routes, stops owned instances, and closes the domain', async t => {
  const h = await boot(t);
  const opened = await h.post('/apps/open', { appId: 'example', deploymentId: 'local', viewId: 'view-dispose' });
  const host = h.ctx.get('hanameshApps');let inst;
  if(process.platform==='win32'){
    assert.equal(opened.status,400);assert.equal(opened.json.error?.code,'PLATFORM_UNSUPPORTED');
    inst=await verifyOwnedPlatformRejection(host,{appId:'example',deploymentId:'local',viewId:'view-dispose'},{principal:appHost.BROWSER_PRINCIPAL});
  }else{assert.equal(opened.status, 200);inst=await until(() => host.instanceList(appHost.BROWSER_PRINCIPAL).find(i => i.status === 'ready'));assert.ok(pidAlive(inst.pid));}
  await h.fiber.dispose();
  if(process.platform!=='win32')await until(() => !pidAlive(inst.pid));
  assert.equal(h.ctx.get('hanameshApps'), undefined);
  assert.equal((await h.get('/hanamesh/apps')).status, 404, 'route must be gone after unload');
  // The domain is closed: a fresh plugin instance can open it again (single-open per name).
  h.fiber = h.ctx.plugin(appHost, { dataRoot: join(h.root, 'app-data'), applications: [definition()], library: { handoff: { enabled: false } } });
  await until(() => h.ctx.get('hanameshApps') !== undefined);
  assert.equal((await h.get('/hanamesh/apps')).status, 200);
});

test('AC-26 shape: without the connection service the plugin never activates, so no route is public', async t => {
  const root = await temporary();
  const ctx = new Context();
  ctx.plugin(Storage); ctx.plugin(storageJson, { root: join(root, 'storages') }); ctx.plugin(storageDomain, { backend: 'json' });
  ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 });
  await ctx.start?.(); await until(() => ctx.get('webServer')?.port > 0);
  t.after(async () => { await ctx.fiber?.dispose?.(); await rm(root, { recursive: true, force: true }); });
  ctx.plugin(appHost, { dataRoot: join(root, 'app-data'), applications: [definition()], library: { handoff: { enabled: false } } });
  await new Promise(r => setTimeout(r, 300));
  assert.equal(ctx.get('hanameshApps'), undefined);
  assert.equal((await http(`http://127.0.0.1:${ctx.get('webServer').port}/hanamesh/apps`)).status, 404);
});

test('unit: bare apply() cannot masquerade as a loaded plugin', async () => {
  await assert.rejects(appHost.apply(), { code: 'DSH_BINDING_REQUIRED' });
  await assert.rejects(appHost.apply({ get: () => undefined, provide() {}, effect() {} }, { dataRoot: '/x' }), { code: 'DSH_BINDING_REQUIRED' });
});

test('teardown: a whole-root unload (profile shutdown) never orphans an owned process, even though the storage domain closes concurrently', async t => {
  const h = await boot(t);
  const opened = await h.post('/apps/open', { appId: 'example', deploymentId: 'local', viewId: 'view-root-unload' });
  const host = h.ctx.get('hanameshApps');let inst;
  if(process.platform==='win32'){
    assert.equal(opened.status,400);assert.equal(opened.json.error?.code,'PLATFORM_UNSUPPORTED');
    inst=await verifyOwnedPlatformRejection(host,{appId:'example',deploymentId:'local',viewId:'view-root-unload'},{principal:appHost.BROWSER_PRINCIPAL});
  }else{assert.equal(opened.status,200);inst=await until(() => host.instanceList(appHost.BROWSER_PRINCIPAL).find(i => i.status === 'ready'));assert.ok(pidAlive(inst.pid));}
  await h.ctx.fiber.dispose();
  if(process.platform!=='win32')await until(() => !pidAlive(inst.pid), { timeout: 8_000 });
  assert.equal(h.ctx.get('hanameshApps'),undefined);
});

test('AH-U07 (plugin): real Cordis early/absent/late Usage services never turn readiness or traffic into original business facts', async t => {
  // SOURCE/FIXTURE: real Cordis/storage/web/app; connection remains AUTH_DOUBLE.
  const diagnostic = 'USAGE_FACT_UNAVAILABLE: no verified public presentation/success source; runtime readiness, transport and hourly receipts are diagnostics only.';
  const seat = { calls: [], record: async input => { seat.calls.push(structuredClone(input)); return { disposition: 'recorded', eventId: input.idempotencyKey }; } };
  const app = { ...definition({ embedding: 'gateway' }), packageName: '@hanamesh/app-example' };
  // (1) Service present before the actual plugin apply. Observe its normal logger.
  const first = await boot(t, { withPlugin: false });
  const logged = [];
  first.ctx.logger.exporter({ levels: { default: 3 }, export: message => logged.push(message) });
  first.ctx.provide('hanameshUsage', seat);
  first.fiber = first.ctx.plugin(appHost, { dataRoot: join(first.root, 'app-data'), applications: [app], library: { handoff: { enabled: false } } });
  await until(() => first.ctx.get('hanameshApps') !== undefined);
  const diagnosticMessages = logged.filter(message => String(message.args[0]).startsWith('USAGE_FACT_UNAVAILABLE'));
  assert.deepEqual(diagnosticMessages.map(message => message.args), [[diagnostic]], 'fixed bounded source-unavailable diagnostic, without app data or credentials');
  assert.equal(diagnosticMessages[0].type, 'debug');
  const opened = await first.post('/apps/open', { appId: 'example', deploymentId: 'local', viewId: 'view-u07' });
  if(process.platform==='win32'){
    assert.equal(opened.status,400);assert.equal(opened.json.error?.code,'PLATFORM_UNSUPPORTED');
    await verifyOwnedPlatformRejection(first.ctx.get('hanameshApps'),{appId:'example',deploymentId:'local',viewId:'view-u07'},{principal:appHost.BROWSER_PRINCIPAL});
    assert.deepEqual(seat.calls,[],'an unsupported owned launch is never an original usage fact');
    assert.equal((await first.get('/hanamesh/apps')).json.apps[0].packageName,'@hanamesh/app-example');
    assert.deepEqual((await first.get('/hanamesh/router/receipts?appId=example')).json.items,[],'refused launch cannot generate transport receipts');
    const alone=await boot(t,{withPlugin:false});let loggerFailures=0;
    alone.ctx.logger.exporter({levels:{default:3},export:message=>{if(message.args[0]===diagnostic){loggerFailures++;throw new Error('fixture diagnostic sink failure');}}});
    alone.fiber=alone.ctx.plugin(appHost,{dataRoot:join(alone.root,'app-data'),applications:[app],library:{handoff:{enabled:false}}});
    await until(()=>alone.ctx.get('hanameshApps')!==undefined);assert.equal(loggerFailures,1);assert.equal(alone.ctx.get('hanameshUsage'),undefined);
    await assertOwnedPlatformRejection(alone.ctx.get('hanameshApps'),{appId:'example',deploymentId:'local',viewId:'view-u07b'},{principal:appHost.BROWSER_PRINCIPAL});
    const late={calls:[],record:async value=>{late.calls.push(value);return{disposition:'withheld'}}};
    alone.ctx.provide('hanameshUsage',late);await until(()=>alone.ctx.get('hanameshUsage')!==undefined);
    await assertOwnedPlatformRejection(alone.ctx.get('hanameshApps'),{appId:'example',deploymentId:'local',viewId:'view-u07c'},{principal:appHost.BROWSER_PRINCIPAL});
    assert.deepEqual(late.calls,[],'late service cannot manufacture facts after a refused launch');
    assert.deepEqual((await alone.get('/hanamesh/router/receipts?appId=example')).json.items,[]);assert.equal(loggerFailures,1);
    assert.equal((await alone.get('/hanamesh/apps')).json.apps[0].packageName,'@hanamesh/app-example');
    await first.fiber.dispose();await alone.fiber.dispose();
    assert.equal(first.ctx.get('hanameshApps'),undefined);assert.equal(alone.ctx.get('hanameshApps'),undefined);
    t.diagnostic('AH-U07 Windows: real Cordis early/absent/late Usage service and throwing diagnostic sink; owned launches durably fail PLATFORM_UNSUPPORTED before spawn; zero Usage facts and transport receipts.');return;
  }
  assert.equal(opened.status, 200, JSON.stringify(opened.json));
  const ready = await until(async () => (await first.get('/hanamesh/apps')).json.instances.find(i => i.status === 'ready'));
  assert.deepEqual(seat.calls, [], 'ready without actual public presentation facts is not open');
  assert.equal((await first.get('/hanamesh/apps')).json.apps[0].packageName, '@hanamesh/app-example');
  // Keep the genuine authenticated control -> synthetic HTTP-workspace bootstrap -> data path.
  const resumed = await first.post('/apps/resume', { viewId: 'view-u07', leaseToken: opened.json.leaseToken });
  assert.equal(resumed.status, 200, JSON.stringify(resumed.json)); assert.ok(resumed.json.uiUrl);
  const boot303 = await http(resumed.json.uiUrl, { headers: { referer: first.origin + '/', 'sec-fetch-dest': 'iframe' } });
  assert.equal(boot303.status, 303);
  const cookie = boot303.headers['set-cookie'][0].split(';')[0], appOrigin = new URL(resumed.json.uiUrl).origin;
  assert.equal((await http(appOrigin + '/', { headers: { cookie } })).status, 200);
  assert.equal((await http(appOrigin + '/second', { headers: { cookie } })).status, 200);
  const expectedRows = [{ appId: 'example', providerId: null, model: null, count: 2, reported: false }];
  const rows = result => result.json.items.map(i => ({ appId: i.appId, providerId: i.providerId, model: i.model, count: i.count, reported: i.reported }));
  const localReceipts = await first.get('/hanamesh/router/receipts?appId=example');
  assert.equal(localReceipts.status, 200, JSON.stringify(localReceipts.json));
  assert.deepEqual(rows(localReceipts), expectedRows, 'Router transport count is preserved, not a business receipt');
  assert.deepEqual(seat.calls, [], 'two authorized HTTP200 responses do not form successful business operations');
  const closedFirst = await first.post('/apps/close', { viewId: 'view-u07', leaseToken: opened.json.leaseToken });
  assert.equal(closedFirst.status, 200, JSON.stringify(closedFirst.json));
  const stopped = await first.post('/apps/stop', { instanceId: ready.id, confirm: true });
  assert.equal(stopped.status, 200, JSON.stringify(stopped.json));
  const stoppedState = await first.get('/hanamesh/apps');
  assert.equal(stoppedState.status, 200);
  assert.equal(stoppedState.json.instances.find(i => i.id === ready.id).status, 'stopped');
  const afterStop = await first.get('/hanamesh/router/receipts?appId=example');
  assert.equal(afterStop.status, 200, JSON.stringify(afterStop.json));
  assert.deepEqual(rows(afterStop), expectedRows, 'stopping neither sends hourly use nor marks it reported');
  assert.deepEqual(seat.calls, [], 'stop is not a new original open/use fact');

  // (2) Service absent; an actual diagnostic logger failure must not break apply or the app.
  const alone = await boot(t, { withPlugin: false });
  let loggerFailures = 0;
  alone.ctx.logger.exporter({ levels: { default: 3 }, export: message => {
    if (message.args[0] === diagnostic) { loggerFailures++; throw new Error('fixture diagnostic sink failure'); }
  } });
  alone.fiber = alone.ctx.plugin(appHost, { dataRoot: join(alone.root, 'app-data'), applications: [app], library: { handoff: { enabled: false } } });
  await until(() => alone.ctx.get('hanameshApps') !== undefined);
  assert.equal(loggerFailures, 1, 'the throwing sink was actually reached during real plugin apply');
  assert.equal(alone.ctx.get('hanameshUsage'), undefined);
  const solo = await alone.post('/apps/open', { appId: 'example', deploymentId: 'local', viewId: 'view-u07b' });
  assert.equal(solo.status, 200, JSON.stringify(solo.json));
  await until(async () => (await alone.get('/hanamesh/apps')).json.instances.find(i => i.status === 'ready'));
  const serve = async (viewId, receipt) => {
    const result = await alone.post('/apps/resume', { viewId, leaseToken: receipt.leaseToken });
    assert.equal(result.status, 200, JSON.stringify(result.json)); assert.ok(result.json.uiUrl);
    const bootstrap = await http(result.json.uiUrl, { headers: { referer: alone.origin + '/', 'sec-fetch-dest': 'iframe' } });
    assert.equal(bootstrap.status, 303);
    const grant = bootstrap.headers['set-cookie'][0].split(';')[0];
    const document = await http(new URL(result.json.uiUrl).origin + '/', { headers: { cookie: grant } });
    assert.equal(document.status, 200); assert.match(document.body.toString(), /HANAMESH_FIXTURE/);
  };
  await serve('view-u07b', solo.json);
  assert.equal((await alone.get('/hanamesh/apps')).json.apps[0].packageName, '@hanamesh/app-example');

  // (3) The real optional service is provided late; reopening still has no original fact source.
  const late = { calls: [], record: async input => { late.calls.push(structuredClone(input)); return { disposition: 'withheld' }; } };
  alone.ctx.provide('hanameshUsage', late);
  await until(() => alone.ctx.get('hanameshUsage') !== undefined);
  const closed = await alone.post('/apps/close', { viewId: 'view-u07b', leaseToken: solo.json.leaseToken });
  assert.equal(closed.status, 200, JSON.stringify(closed.json));
  await until(async () => (await alone.get('/hanamesh/apps')).json.instances.every(i => i.status === 'stopped'));
  const reopened = await alone.post('/apps/open', { appId: 'example', deploymentId: 'local', viewId: 'view-u07c' });
  assert.equal(reopened.status, 200, JSON.stringify(reopened.json));
  await until(async () => (await alone.get('/hanamesh/apps')).json.instances.some(i => i.status === 'ready'));
  await serve('view-u07c', reopened.json);
  assert.deepEqual(late.calls, [], 'late service, re-ready and traffic do not supply missing source facts');
  assert.equal((await alone.get('/hanamesh/apps')).json.apps[0].packageName, '@hanamesh/app-example');
  const closeLate = await alone.post('/apps/close', { viewId: 'view-u07c', leaseToken: reopened.json.leaseToken });
  assert.equal(closeLate.status, 200, JSON.stringify(closeLate.json));
  await until(async () => (await alone.get('/hanamesh/apps')).json.instances.every(i => i.status === 'stopped'));
  assert.deepEqual(late.calls, [], 'late-service stop never creates a business event');
  assert.equal(loggerFailures, 1, 'no traffic/hourly diagnostic retry is manufactured');
  t.diagnostic('AH-U07 SOURCE/FIXTURE: actual apply; early/absent/late service; 303 and HTTP200 paths; Router count=2/reported=false after stop; zero record; fixed diagnostic and throwing logger exercised. Not native CLIENT/U2.');
});

test('the library entry never pulls a DSH-only peer into a plain consumer import graph', async () => {
  // A plain npm consumer (an application package such as @hanamesh/app-vibe-trading) installs this
  // package without the DSH kernel, so nothing reachable from `dist/index.js` may import @deepseek-ai/*.
  const {readFile}=await import('node:fs/promises');
  const seen=new Set(); const offenders=[];
  const walk=async url=>{
    if(seen.has(url.href))return; seen.add(url.href);
    const source=await readFile(url,'utf8');
    for(const [,specifier] of source.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/gu)){
      if(specifier.startsWith('@deepseek-ai/')){offenders.push(`${url.pathname.split('/dist/')[1]} → ${specifier}`);continue;}
      if(specifier.startsWith('.'))await walk(new URL(specifier,url));
    }
  };
  await walk(new URL('../dist/index.js',import.meta.url));
  assert.deepEqual(offenders,[],'the library entry graph must stay free of DSH-only peers');
  assert.ok(seen.size>5);
});

test('AH-PG01: real Cordis loads the external provision package and preserves authenticated installer input rejection', async t => {
  const h=await boot(t,{withPlugin:false});
  // SOURCE harness only: the DSH command seat is deliberately never executed here.
  // This exercises the actual public provision import and installer binding, not DSH installation.
  h.fiber=h.ctx.plugin(appHost,{dataRoot:join(h.root,'app-data'),applications:[],
    nodeBinary:process.execPath,runtime:{profileDir:join(h.root,'profile')}});
  await until(()=>h.ctx.get('hanameshApps')!==undefined);
  assert.equal((await h.get('/hanamesh/apps/runtime',{authorization:undefined})).status,401);
  const list=await h.get('/hanamesh/apps/runtime');
  assert.equal(list.status,200,JSON.stringify(list.json));
  assert.deepEqual(list.json.apps,[]);
  const rejected=await h.post('/apps/runtime/provision',{});
  assert.equal(rejected.status,400,JSON.stringify(rejected.json));
  assert.equal(rejected.json.error.code,'INVALID_INPUT');
});


test('AH-D05: real Cordis apply infers the Desktop parent and profile without supply configuration', async t => {
  const root=await temporary();t.after(()=>rm(root,{recursive:true,force:true}));
  const runtime=join(root,'runtime'),profile=join(root,'home/profiles/desktop');
  const entry=join(runtime,'node_modules/@deepseek-ai/dsh-desktop-host/lib/index.js');
  for(const [name,file] of [['dsh-desktop-host','index.js'],['dsh','bin.js']]){
    const packageDir=join(runtime,'node_modules/@deepseek-ai',name);await mkdir(join(packageDir,'lib'),{recursive:true});
    await writeFile(join(packageDir,'package.json'),JSON.stringify({name:'@deepseek-ai/'+name}));await writeFile(join(packageDir,'lib',file),'');
  }
  await mkdir(join(profile,'node_modules/@hanamesh'),{recursive:true});
  await symlink(join(import.meta.dirname,'..'),join(profile,'node_modules/@hanamesh/dsh-app-host'));
  await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{'@hanamesh/dsh-app-host':'0.5.1'}}));
  const prior=process.argv;process.argv=[process.execPath,entry,runtime,profile];
  let h;try{h=await boot(t,{applications:[]});}finally{process.argv=prior;}
  assert.equal(h.ctx.get('hanameshApps').parentOrigin,'dsh-app://app');
  assert.deepEqual(h.ctx.get('hanameshApps').frameAncestors,[]);
  const result=await h.get('/hanamesh/apps/runtime',{origin:undefined});
  assert.equal(result.status,200,JSON.stringify(result.json));assert.deepEqual(result.json.apps,[]);assert.equal(h.ctx.get('hanameshAppRuntime').getProfileDir(),profile);
  assert.equal((await h.post('/apps/runtime/provision',{},{origin:undefined})).status,400);
  assert.equal((await h.post('/apps/runtime/provision',{},{origin:'dsh-app://shell'})).status,403);
});


async function installedAppFixture(profileDir, packageName, app, publishedName = packageName) {
  const root = join(profileDir, 'node_modules', packageName);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: publishedName, version: '1.0.0', hanamesh: { app: 'app.json' } }));
  await writeFile(join(root, 'app.json'), JSON.stringify(app));
}

test('R416-F01: a corrupt installed runtime ledger cannot prevent AppHost startup or healthy application use', async t => {
  const h = await boot(t, { withPlugin: false });
  const profileDir = join(h.root, 'profile'), dataRoot = join(h.root, 'app-data');
  const broken = definition({ id: 'broken' }), healthy = definition({ id: 'healthy' });
  // Same valid descriptor shape as AH-P01. The fault is real ledger JSON, not an invalid descriptor.
  delete broken.deployments[0].command;
  broken.deployments[0].runtime = {
    manifest: { schema: 1, sources: [{ id: 'local', kind: 'file', base: 'file:///tmp/' }], items: [{
      id: 'vibe-runtime', version: '0.1.15', kind: 'tar.gz', installTo: 'vibe-runtime',
      platforms: { 'darwin-arm64': { asset: 'vibe.tgz', sha256: 'a'.repeat(64) } },
    }] }, item: 'vibe-runtime', exec: 'bin/vibe',
  };
  await installedAppFixture(profileDir, 'a-broken', broken);
  await installedAppFixture(profileDir, 'z-healthy', healthy);
  await writeFile(join(profileDir, 'package.json'), JSON.stringify({ dependencies: { 'a-broken': '1.0.0', 'z-healthy': '1.0.0' } }));
  const ledgerDir = join(dataRoot, 'runtimes', 'broken', '.provision');
  await mkdir(ledgerDir, { recursive: true });
  const corrupt = '{"schema":1,"items": [PRIVATE_LEDGER_BODY';
  await writeFile(join(ledgerDir, 'ledger.json'), corrupt);
  const { ledger } = await import('@hanamesh/lib-provision');
  await assert.rejects(ledger(join(dataRoot, 'runtimes', 'broken')), { name: 'SyntaxError' });
  const logged = [];
  h.ctx.logger.exporter({ levels: { default: 3 }, export: message => logged.push(message) });
  h.fiber = h.ctx.plugin(appHost, { dataRoot, applications: [broken, healthy], runtime: { profileDir } });
  await until(() => h.ctx.get('hanameshApps') !== undefined);
  const host = h.ctx.get('hanameshApps');
  assert.equal(h.ctx.get('hanameshAppRuntime').protocolVersion, '1');
  assert.equal((await h.get('/hanamesh/apps')).status, 200);
  assert.equal((await h.get('/hanamesh/router/receipts')).status, 200);
  assert.equal((await h.get('/hanamesh/apps/node-runtime')).status, 200);
  const diagnostics = logged.filter(message => String(message.args[0]).startsWith('APPHOST_STARTUP_SCAN_UNAVAILABLE'));
  assert.equal(diagnostics.length, 1, 'one visible named startup scan diagnostic');
  assert.equal(diagnostics[0].type, 'warn');
  assert.ok(diagnostics[0].args.includes('SyntaxError'));
  assert.equal(JSON.stringify(logged).includes('PRIVATE_LEDGER_BODY'), false, 'ledger body must never enter the diagnostic');
  const read = await h.get('/hanamesh/apps/runtime');
  assert.equal(read.status, 500, 'strict inventory still reports failure, never ready or a successful empty list');
  assert.equal(read.json.error.code, 'INTERNAL_ERROR');
  const prepare = await h.post('/apps/runtime/provision', { appId: 'broken', packageName: 'a-broken', runtimeItem: 'vibe-runtime' });
  assert.equal(prepare.status, 500, 'preparing a corrupt runtime cannot silently repair or ignore its ledger');
  assert.equal(await readFile(join(ledgerDir, 'ledger.json'), 'utf8'), corrupt);
  const refused = await h.post('/apps/open', { appId: 'broken', deploymentId: 'local', viewId: 'broken-view' });
  assert.equal(refused.status, process.platform === 'win32' ? 400 : 409);
  assert.equal(refused.json.error.code, process.platform === 'win32' ? 'PLATFORM_UNSUPPORTED' : 'RUNTIME_MISSING');
  assert.equal(host.instanceList(appHost.BROWSER_PRINCIPAL).some(row => row.appId === 'broken' && row.status === 'ready'), false);
  const opened = await h.post('/apps/open', { appId: 'healthy', deploymentId: 'local', viewId: 'healthy-view' });
  if (process.platform === 'win32') {
    assert.equal(opened.status, 400); assert.equal(opened.json.error.code, 'PLATFORM_UNSUPPORTED');
  } else {
    assert.equal(opened.status, 200, JSON.stringify(opened.json));
    const ready = await until(() => host.instanceList(appHost.BROWSER_PRINCIPAL).find(row => row.appId === 'healthy' && row.status === 'ready'));
    assert.ok(pidAlive(ready.pid));
    assert.equal((await h.post('/apps/close', { viewId: 'healthy-view', leaseToken: opened.json.leaseToken })).status, 200);
    assert.equal((await h.post('/apps/stop', { instanceId: ready.id, confirm: true })).status, 200);
    await until(() => !pidAlive(ready.pid));
  }
});

test('R416-F01: one invalid optional package binding leaves subsequent bindings and AppHost services available', async t => {
  const h = await boot(t, { withPlugin: false });
  const profileDir = join(h.root, 'profile'), first = definition({ id: 'first' }), healthy = definition({ id: 'healthy' });
  // Real installed package metadata reaches bindPackageName and is rejected by its npm-name validator.
  await installedAppFixture(profileDir, 'a-invalid-binding', first, 'invalid package');
  await installedAppFixture(profileDir, 'z-healthy', healthy);
  await writeFile(join(profileDir, 'package.json'), JSON.stringify({ dependencies: { 'a-invalid-binding': '1.0.0', 'z-healthy': '1.0.0' } }));
  const logged = [];
  h.ctx.logger.exporter({ levels: { default: 3 }, export: message => logged.push(message) });
  h.fiber = h.ctx.plugin(appHost, { dataRoot: join(h.root, 'app-data'), applications: [first, healthy], runtime: { profileDir } });
  await until(() => h.ctx.get('hanameshApps') !== undefined);
  const host = h.ctx.get('hanameshApps');
  assert.equal(host.packageName('first'), null);
  assert.equal(host.packageName('healthy'), 'z-healthy', 'continue binding after the failed row');
  assert.equal(h.ctx.get('hanameshAppRuntime').protocolVersion, '1');
  assert.equal((await h.get('/hanamesh/apps')).status, 200);
  const diagnostics = logged.filter(message => String(message.args[0]).startsWith('APPHOST_STARTUP_BINDING_FAILED'));
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].type, 'warn');
  assert.deepEqual(diagnostics[0].args.slice(1), ['first', 'invalid package', 'INVALID_PACKAGE_NAME']);
});
