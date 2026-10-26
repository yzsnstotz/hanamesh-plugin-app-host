/**
 * Website handoff through the REAL plugin entry (src/dsh.js) on a real Cordis root with the pinned DSH storage and web
 * server: dsh.js starts the listener from library.handoff settings, wires the authenticated client routes and links the
 * library's install events to the handoff. Stand-ins: `connection` (one bearer), `pluginManager` (writes the profile
 * files upstream would) and a loopback npm registry. Ports are free random ones, never 39317….
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as storageJson from '@deepseek-ai/dsh-storage-json';
import * as storageDomain from '@deepseek-ai/dsh-storage-domain';
import WebServer from '@deepseek-ai/dsh-host-webserver';
import * as appHost from '../src/dsh.js';
import { scratch, http, until } from './helpers.mjs';

const cliFixture=new URL('./fixtures/profile-cli.mjs',import.meta.url).pathname;
const SITE = 'https://market.hanamesh.com', TOKEN = 'browser-session';
const catalogFixture = resolve(import.meta.dirname, 'fixtures/catalog/provider-page.json');
const item = { itemId: 'com.hanamesh.utility-plugin', packageName: '@hanamesh/utility-plugin' };
async function freePort() {
  const server = createNetServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const { port } = server.address(); await new Promise(r => server.close(r)); return port;
}
function pluginManager(profile) {
  const calls = [];
  return { calls, value: {
    async registries(){return{registry:null,fallbackRegistries:[],resolved:null};},
    async installBundle(spec, options) {
      calls.push(['install', spec, options]);
      const at = spec.lastIndexOf('@'), name = spec.slice(0, at), version = spec.slice(at + 1);
      const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'));
      manifest.dependencies[name] = version; await writeFile(join(profile, 'package.json'), JSON.stringify(manifest));
      await mkdir(join(profile, 'node_modules', name), { recursive: true });
      await writeFile(join(profile, 'node_modules', name, 'package.json'), JSON.stringify({ name, version, dsh: { bundle: { patch: './p.yml' } } }));
      return { changed: true, application: 'applied', stage: 'enable', target: name, bundle: name, version };
    },
    async removeBundle(name) { calls.push(['remove', name]); return { changed: true, application: 'applied', stage: 'remove', target: name }; },
  } };
}

async function boot(t, options = {}) {
  const root = options.root ?? await scratch('handoff-integration-'), profile = join(root, 'profile');
  await mkdir(profile, { recursive: true });
  await writeFile(join(profile, 'package.json'), JSON.stringify({ name: 'profile', dependencies: {}, dsh: { profile: { bundles: [] } } }));
  const managerPackage=join(profile,'node_modules/@deepseek-ai/dsh-plugin-manager');
  await mkdir(managerPackage,{recursive:true});await writeFile(join(managerPackage,'package.json'),JSON.stringify({name:'@deepseek-ai/dsh-plugin-manager',version:'0.2.1-alpha.2'}));
  const registry = createServer((req, res) => {
    const known = req.url === '/' + encodeURIComponent(item.packageName) + '/latest';
    res.writeHead(known ? 200 : 404, { 'content-type': 'application/json' }); res.end(JSON.stringify(known ? { version: '1.0.0' } : {}));
  });
  await new Promise(r => registry.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => registry.close(r)));
  const ctx = new Context(), manager = pluginManager(profile);
  ctx.plugin(Storage); ctx.plugin(storageJson, { root: join(root, 'storages') }); ctx.plugin(storageDomain, { backend: 'json' });
  ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 });
  ctx.provide('connection', { requestRejection: request => request.headers?.authorization === `Bearer ${TOKEN}` ? undefined : { status: 401 } });
  ctx.provide('pluginManager', manager.value);
  if(options.core)ctx.provide('hanameshCore',options.core);
  if(options.suiteSource)ctx.provide('hanameshSuiteSource',options.suiteSource);
  await ctx.start?.();
  await until(() => ctx.get('webServer')?.port > 0);
  const origin = `http://127.0.0.1:${ctx.get('webServer').port}`, port = await freePort();
  ctx.plugin(appHost, { nodeBinary:process.execPath,dataRoot: join(root, 'app-data'), applications: [], library: {
    profileDir: profile, profileName: 'desktop',dshBin:cliFixture, fixture: catalogFixture, registry: `http://127.0.0.1:${registry.address().port}`,
    handoff: { enabled: true, ports: [port], allowedOrigins: [SITE] } } });
  await until(() => ctx.get('hanameshApps') !== undefined);
  t.after(async () => { await ctx.fiber?.dispose?.(); });
  const headers = { origin, authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', 'x-hanamesh-client': 'workspace-v1' };
  return { ctx, manager, port, origin, root, listener: `http://127.0.0.1:${port}`,
    post: (path, body) => http(origin + path, { method: 'POST', headers, body: JSON.stringify(body) }),
    get: path => http(origin + path, { headers }) };
}
const site = (url, init = {}) => fetch(url, { ...init, headers: { origin: SITE, ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers } });

test('AH-HO01: the real plugin starts the listener, the window confirms, the guarded CLI installs and the website sees restart-required', async t => {
  const h = await boot(t);
  const before = (await h.get('/hanamesh/library/handoffs')).json.listener;
  assert.deepEqual([before.status, before.port], ['listening', h.port], 'dsh.js started the listener on the configured port');
  const probe = await (await site(h.listener + '/hanamesh/library/install-target')).json();
  assert.equal(probe.client, 'dsh'); assert.equal(probe.ready, true, JSON.stringify(probe));
  const posted = await site(h.listener + '/hanamesh/library/handoff', { method: 'POST', body: JSON.stringify({ ...item, contractVersion: '1' }) });
  assert.equal(posted.status, 202);
  const { handoffId } = await posted.json();
  assert.equal(h.manager.calls.length, 0, 'a handoff alone installs nothing');
  // The client window (authenticated DSH routes): what to show, how often to look.
  const open = await h.get('/hanamesh/library/handoffs');
  assert.equal(open.status, 200, JSON.stringify(open.json));
  assert.deepEqual(open.json.handoffs.map(row => [row.handoffId, row.state, row.packageName]), [[handoffId, 'pending', item.packageName]]);
  assert.equal(open.json.pollMs, 1500); assert.equal(open.json.listener.port, h.port); assert.equal(open.json.live, false);
  assert.equal((await h.post('/hanamesh/library/handoffs/state', { handoffId, state: 'shown' })).json.state, 'shown');
  // The person confirms: the market's normal install route.
  const started = await h.post('/hanamesh/library/install', item);
  assert.equal(started.status, 202, JSON.stringify(started.json));
  const read = async () => (await site(h.listener + '/hanamesh/library/handoff?id=' + handoffId)).json();
  // Waiting is only for the background operation; the assertion below is the check.
  await until(async () => (await read()).state === 'installed').catch(() => {});
  assert.equal((await read()).state, 'installed', 'library install events reach the handoff');
  assert.deepEqual((await read()).result, { status: 'restart-required' });
  assert.deepEqual(h.manager.calls, [],'in-process manager is never called');
  const done = (await h.get('/hanamesh/library/events?after=0')).json.events.find(event => event.type === 'library.install-done' && event.operationId);
  assert.equal(done.result.status,'restart-required');
  const plugins = (await h.get('/hanamesh/library/installedPlugins')).json.plugins;
  assert.equal(plugins.find(row => row.packageName === item.packageName)?.state, 'installed-not-loaded');
});

test('AH-HO02: settings page shows defaults, names and fixed rules; saving re-binds the listener; unload closes it', async t => {
  const h = await boot(t);
  const settings = await h.get('/hanamesh/library/handoff-settings');
  assert.equal(settings.status, 200);
  assert.deepEqual(settings.json.defaults, { enabled: true, ports: [39317, 39318, 39319], allowedOrigins: [SITE], ttlMs: 600000, pollMs: 1500 });
  assert.equal(settings.json.names.pollMs, 'library.handoff.pollMs');
  assert.ok(settings.json.rules.length >= 5 && settings.json.rules.every(row => row.rule && row.why));
  assert.deepEqual(settings.json.settings.ports, [h.port]);
  const next = await freePort();
  const saved = await h.post('/hanamesh/library/handoff-settings', { ...settings.json.settings, ports: [next], pollMs: 900 });
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  assert.deepEqual([saved.json.listener.status, saved.json.listener.port], ['listening', next]);
  assert.equal((await h.get('/hanamesh/library/handoffs')).json.pollMs, 900);
  await assert.rejects(fetch(h.listener + '/hanamesh/library/install-target'), 'the old port is closed');
  assert.equal((await site(`http://127.0.0.1:${next}/hanamesh/library/install-target`)).status, 200);
  const refused = await h.post('/hanamesh/library/handoff-settings', { ...settings.json.settings, ttlMs: 100, pollMs: 900 });
  assert.equal(refused.status, 400); assert.equal(refused.json.error.code, 'INVALID_HANDOFF_SETTINGS');
  await h.ctx.fiber.dispose();
  await assert.rejects(fetch(`http://127.0.0.1:${next}/hanamesh/library/install-target`), 'unload closes the listener');
});


test('N16-6: both discovery listeners use the current website allowlist without exposing capabilities to other origins', async t => {
  const h = await boot(t), path = '/hanamesh/library/install-target';
  for (const base of [h.origin, h.listener]) {
    const denied = await site(base + path, {headers: {origin: 'https://unapproved.example'}});
    assert.equal(denied.status, 403);assert.equal(denied.headers.get('access-control-allow-origin'), null);
    const body = await denied.json();assert.equal(body.client, undefined);assert.equal(body.ready, undefined);assert.equal(body.installTarget, undefined);
    const deniedPreflight = await site(base + path, {method:'OPTIONS',headers:{origin:'https://unapproved.example'}});assert.equal(deniedPreflight.status,403);assert.equal(deniedPreflight.headers.get('access-control-allow-origin'),null);
    assert.equal((await fetch(base + path)).status,200,'non-browser local discovery remains available');
    const invalid = await site(base + path + '?unknown=1');assert.equal(invalid.status,400);assert.equal(invalid.headers.get('access-control-allow-origin'),SITE);
    const allowed = await site(base + path);assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('access-control-allow-origin'), SITE);assert.equal(allowed.headers.get('vary'), 'Origin');
    const preflight = await site(base + path, {method: 'OPTIONS'});assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), SITE);
  }
  const settings = (await h.get('/hanamesh/library/handoff-settings')).json.settings;
  assert.equal((await h.post('/hanamesh/library/handoff-settings', {...settings, allowedOrigins: ['https://approved.example']})).status, 200);
  for (const base of [h.origin, h.listener]) {
    assert.equal((await site(base + path)).status, 403);
    const allowed = await site(base + path, {headers: {origin: 'https://approved.example'}});assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://approved.example');
  }
  assert.equal((await h.get(path)).status, 200, 'the same-origin authenticated workspace keeps its discovery entry');
});

test('N16-7: real DSH JSON storage preserves pollMs after unloading and reopening the plugin', async t => {
  const first = await boot(t), settings = (await first.get('/hanamesh/library/handoff-settings')).json.settings;
  assert.equal((await first.post('/hanamesh/library/handoff-settings', {...settings, pollMs: 900})).status, 200);
  await first.ctx.fiber.dispose();
  const second = await boot(t, {root: first.root});
  assert.equal((await second.get('/hanamesh/library/handoff-settings')).json.settings.pollMs, 900);
  assert.equal((await second.get('/hanamesh/library/handoffs')).json.pollMs, 900);
  await second.ctx.fiber.dispose();
  const file=join(first.root,'storages/hanamesh_library.json'),legacy=JSON.parse(await readFile(file,'utf8'));let removed=0;
  function removePoll(value){if(!value||typeof value!=='object')return;if(Object.hasOwn(value,'pollMs')){delete value.pollMs;removed++;}for(const child of Object.values(value))removePoll(child);}
  removePoll(legacy);assert.equal(removed,1,'seed the actual legacy saved-handoff shape without pollMs');await writeFile(file,JSON.stringify(legacy));
  const third=await boot(t,{root:first.root});assert.equal((await third.get('/hanamesh/library/handoffs')).json.pollMs,1500,'old saved settings reopen with the documented default');
});

test('IS-CORDIS: the real plugin advertises a consented fresh Core reader on both listeners without install auth or side effects',async t=>{
 const{declaration}=await import('./fixtures/core-suite-declaration.mjs');let value=declaration(),calls=0;
 const service={protocolVersion:'1',getSuiteDeclaration:async(...args)=>{assert.deepEqual(args,[],'status facts never request a registry plan');calls++;return value}};
 const h=await boot(t,{core:service});const before=calls;
 for(const base of [h.listener,h.origin]){
  const probe=await(await site(base+'/hanamesh/library/install-target')).json();assert.equal(probe.installationStatus?.contract,'hanamesh.installation-status','real DSH entry wires the advertised bridge');assert.equal(calls,before);
 }
 for(const base of [h.listener,h.origin]){
  const res=await site(base+'/hanamesh/library/installation-status',{method:'POST',body:JSON.stringify({contractVersion:'1',consent:'read-installations'})});assert.equal(res.status,200);
  const status=await res.json();assert.equal(status.observations.find(x=>x.channel==='dsh').status,'installed');assert.equal(status.observations.find(x=>x.channel==='hanamesh').status,'unknown');
 }
 assert.equal(calls,before+2);assert.deepEqual(h.manager.calls,[]);
 value={...value,completeness:'unknown',blocked:[{code:'CORE_SUITE_PEER_UNKNOWN'}]};const detect=async()=>(await(await site(h.listener+'/hanamesh/library/installation-status',{method:'POST',body:JSON.stringify({contractVersion:'1',consent:'read-installations'})})).json()).observations.find(x=>x.channel==='dsh');
 assert.equal((await detect()).status,'unknown');delete service.getSuiteDeclaration;assert.equal((await detect()).reason.code,'CORE_SUITE_DECLARATION_MISSING');
});

test('B17-CORDIS: source setting persists through real JSON domain reopen, catalogs/handoff survive, optional source arrives and disappears',async t=>{
 const first=await boot(t);const path='/hanamesh/library/suite-source';const original=(await first.get('/hanamesh/library/handoff-settings')).json.settings;
 assert.equal((await first.get(path)).json.mode,'configured');assert.equal((await first.post('/hanamesh/library/sources',{sources:[]})).status,200);
 assert.equal((await first.post('/hanamesh/library/handoff-settings',{...original,pollMs:923})).status,200);
 assert.equal((await first.post(path,{mode:'core'})).status,200);assert.equal((await first.get(path)).json.observation.code,'CORE_SUITE_SOURCE_MISSING');
 let state={protocolVersion:'1',status:'ready',selection:'custom',registry:'http://127.0.0.1:43123/',archiveCount:3,lastError:null};
 const sourceFork=first.ctx.plugin(ctx=>{ctx.provide('hanameshSuiteSource',{protocolVersion:'1',getState:()=>state});});
 await until(async()=>(await first.get(path)).json.observation.observable===true);assert.deepEqual((await first.get(path)).json.observation.state,state);
 state={...state,status:'disposed',registry:null};assert.equal((await first.get(path)).json.observation.state.status,'disposed');await sourceFork.dispose();await until(async()=>(await first.get(path)).json.observation.code==='CORE_SUITE_SOURCE_MISSING');
 await first.ctx.fiber.dispose();const second=await boot(t,{root:first.root});assert.equal((await second.get(path)).json.mode,'core');assert.deepEqual((await second.get('/hanamesh/library/sources')).json.sources,[]);assert.equal((await second.get('/hanamesh/library/handoff-settings')).json.settings.pollMs,923);
});
