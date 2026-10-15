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

async function boot(t) {
  const root = await scratch('handoff-integration-'), profile = join(root, 'profile');
  await mkdir(profile, { recursive: true });
  await writeFile(join(profile, 'package.json'), JSON.stringify({ name: 'profile', dependencies: {}, dsh: { profile: { bundles: [] } } }));
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
  await ctx.start?.();
  await until(() => ctx.get('webServer')?.port > 0);
  const origin = `http://127.0.0.1:${ctx.get('webServer').port}`, port = await freePort();
  ctx.plugin(appHost, { dataRoot: join(root, 'app-data'), applications: [], library: {
    profileDir: profile, profileName: 'desktop', fixture: catalogFixture, registry: `http://127.0.0.1:${registry.address().port}`,
    handoff: { enabled: true, ports: [port], allowedOrigins: [SITE] } } });
  await until(() => ctx.get('hanameshApps') !== undefined);
  t.after(async () => { await ctx.fiber?.dispose?.(); });
  const headers = { origin, authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', 'x-hanamesh-client': 'workspace-v1' };
  return { ctx, manager, port, listener: `http://127.0.0.1:${port}`,
    post: (path, body) => http(origin + path, { method: 'POST', headers, body: JSON.stringify(body) }),
    get: path => http(origin + path, { headers }) };
}
const site = (url, init = {}) => fetch(url, { ...init, headers: { origin: SITE, ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers } });

test('AH-HO01: the real plugin starts the listener, the window confirms, the install is loaded live and the website sees installed', async t => {
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
  assert.equal(open.json.pollMs, 1500); assert.equal(open.json.listener.port, h.port); assert.equal(open.json.live, true);
  assert.equal((await h.post('/hanamesh/library/handoffs/state', { handoffId, state: 'shown' })).json.state, 'shown');
  // The person confirms: the market's normal install route.
  const started = await h.post('/hanamesh/library/install', item);
  assert.equal(started.status, 202, JSON.stringify(started.json));
  const read = async () => (await site(h.listener + '/hanamesh/library/handoff?id=' + handoffId)).json();
  // Waiting is only for the background operation; the assertion below is the check.
  await until(async () => (await read()).state === 'installed').catch(() => {});
  assert.equal((await read()).state, 'installed', 'library install events reach the handoff');
  assert.deepEqual((await read()).result, { status: 'applied' });
  assert.deepEqual(h.manager.calls, [['install', '@hanamesh/utility-plugin@1.0.0', { saveExact: true }]]);
  const done = (await h.get('/hanamesh/library/events?after=0')).json.events.find(event => event.type === 'library.install-done' && event.operationId);
  assert.deepEqual(done.result.restartBaseline, { updated: true }, 'the installed list no longer waits for a restart');
  const plugins = (await h.get('/hanamesh/library/installedPlugins')).json.plugins;
  assert.equal(plugins.find(row => row.packageName === item.packageName)?.state, 'installed');
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
