/**
 * REAL Cordis root with the PINNED DSH service stack: dsh-storage + storage-json backend +
 * storage-domain, host-webserver on an OS port, jsonl session persistence. Only `connection` is a
 * stand-in (AUTH_DOUBLE): the real service exists only inside the web profile composition, which the
 * H01 profile run in docs/acceptance/ exercises. Evidence class: REAL_HOST for storage/web/session.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as storageJson from '@deepseek-ai/dsh-storage-json';
import * as storageDomain from '@deepseek-ai/dsh-storage-domain';
import WebServer from '@deepseek-ai/dsh-host-webserver';
import SessionStore from '@deepseek-ai/dsh-session';
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection';
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl';
import * as appHost from '../src/dsh.js';
import { definition, temporary, http, until, pidAlive } from './helpers.mjs';

/** AUTH_DOUBLE for ctx.connection: accepts exactly one bearer, rejects everything else. */
function connectionDouble(token) {
  return { requestRejection: request => request.headers?.authorization === `Bearer ${token}` ? undefined : { status: 401 } };
}
async function boot(t, { token = 'browser-session', withPlugin = true, applications = [definition()], config = {} } = {}) {
  const root = await temporary();
  const ctx = new Context();
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
    fiber = ctx.plugin(appHost, { dataRoot: join(root, 'app-data'), applications, ...config });
    await until(() => ctx.get('hanameshApps') !== undefined);
  }
  const headers = { origin, authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-hanamesh-client': 'workspace-v1' };
  const merge = overrides => Object.fromEntries(Object.entries({ ...headers, ...overrides }).filter(([, v]) => v !== undefined));
  t.after(async () => { await ctx.fiber?.dispose?.(); await rm(root, { recursive: true, force: true }); });
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
  assert.equal(opened.status, 200, JSON.stringify(opened.json));
  const ready = await until(async () => (await h.get('/hanamesh/apps')).json.instances.find(i => i.status === 'ready'));
  assert.equal(ready.appId, 'example');
  // (1) sidecar: the whole snapshot is ONE storage-domain global in the json backend's unit file.
  const files = await readdir(join(h.root, 'storages'));
  const unit = files.find(f => f.startsWith('hanamesh_app_host'));
  assert.ok(unit, `storage-domain unit missing among ${files}`);
  const stored = JSON.parse(await readFile(join(h.root, 'storages', unit), 'utf8'));
  const snapshot = stored.global ?? stored;
  assert.equal(snapshot.instances.length, 1); assert.equal(snapshot.leases.length, 1);
  assert.equal(snapshot.leases[0].viewId, 'view-h11'); assert.ok(!('leaseToken' in snapshot.leases[0]));
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
  assert.equal(opened.status, 200);
  const host = h.ctx.get('hanameshApps');
  const inst = await until(() => host.instanceList(appHost.BROWSER_PRINCIPAL).find(i => i.status === 'ready'));
  assert.ok(pidAlive(inst.pid));
  await h.fiber.dispose();
  await until(() => !pidAlive(inst.pid));
  assert.equal(h.ctx.get('hanameshApps'), undefined);
  assert.equal((await h.get('/hanamesh/apps')).status, 404, 'route must be gone after unload');
  // The domain is closed: a fresh plugin instance can open it again (single-open per name).
  h.fiber = h.ctx.plugin(appHost, { dataRoot: join(h.root, 'app-data'), applications: [definition()] });
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
  ctx.plugin(appHost, { dataRoot: join(root, 'app-data'), applications: [definition()] });
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
  assert.equal(opened.status, 200);
  const host = h.ctx.get('hanameshApps');
  const inst = await until(() => host.instanceList(appHost.BROWSER_PRINCIPAL).find(i => i.status === 'ready'));
  assert.ok(pidAlive(inst.pid));
  await h.ctx.fiber.dispose();
  await until(() => !pidAlive(inst.pid), { timeout: 8_000 });
});

test('AH-L07 (plugin): an unconfigured library seeds the HanaMesh catalog source through the real Config schema; an explicit [] does not', async t => {
  const plain = await boot(t, { withPlugin: false });
  const logged = [];
  plain.ctx.logger.exporter({ export: message => logged.push(message) });
  plain.fiber = plain.ctx.plugin(appHost, { dataRoot: join(plain.root, 'app-data'), applications: [definition()] });
  await until(() => plain.ctx.get('hanameshApps') !== undefined);
  const seeded = await plain.get('/hanamesh/library/sources');
  assert.equal(seeded.status, 200, JSON.stringify(seeded.json));
  assert.deepEqual(seeded.json.sources, [{ manifestUrl: 'https://market.hanamesh.com/catalog-source.json', enabled: true }]);
  const none = await boot(t, { config: { library: { sources: [] } } });
  const empty = await none.get('/hanamesh/library/sources');
  assert.equal(empty.status, 200, JSON.stringify(empty.json));
  assert.deepEqual(empty.json.sources, []);
  // One structured line names exactly what was inferred (this checkout has no profile above it, so no profileDir/dshBin).
  const line = logged.find(message => message.type === 'info' && String(message.args[0]).startsWith('hanamesh-app-host library: inferred'));
  assert.ok(line, JSON.stringify(logged.map(m => m.args[0])));
  assert.deepEqual(JSON.parse(line.args[1]), { nodeBinary: process.execPath, sources: ['https://market.hanamesh.com/catalog-source.json'] });
  // Plain DSH without a profile above this checkout: the installer stays unavailable, nothing is guessed from cwd or ~/.dsh.
  const install = await plain.post('/hanamesh/library/install', { itemId: 'x' });
  assert.equal(install.status, 503); assert.equal(install.json.error.code, 'LIBRARY_INSTALL_UNAVAILABLE');
});

test('AH-U07 (plugin): usage evidence reaches ctx.hanameshUsage.record when that sibling is provided — before or after this plugin — and its absence changes nothing', async t => {
  const seat = { calls: [], record: async input => { seat.calls.push(structuredClone(input)); return { disposition: 'recorded', eventId: input.idempotencyKey }; } };
  const app = { ...definition({ embedding: 'gateway' }), packageName: '@hanamesh/app-example' };
  // (1) Seat provided first (the usage plugin loaded earlier in the profile).
  const first = await boot(t, { withPlugin: false });
  first.ctx.provide('hanameshUsage', seat);
  first.fiber = first.ctx.plugin(appHost, { dataRoot: join(first.root, 'app-data'), applications: [app] });
  await until(() => first.ctx.get('hanameshApps') !== undefined);
  const opened = await first.post('/apps/open', { appId: 'example', deploymentId: 'local', viewId: 'view-u07' });
  assert.equal(opened.status, 200, JSON.stringify(opened.json));
  const ready = await until(async () => (await first.get('/hanamesh/apps')).json.instances.find(i => i.status === 'ready'));
  await until(() => seat.calls.some(c => c.action === 'open'));
  assert.deepEqual(seat.calls.filter(c => c.action === 'open').map(c => ({ ...c, occurredAt: undefined })),
    [{ hanaRef: '@hanamesh/app-example', action: 'open', occurredAt: undefined, idempotencyKey: `open:example:${ready.id}`, sourcePlugin: '@hanamesh/dsh-app-host' }]);
  assert.equal((await first.get('/hanamesh/apps')).json.apps[0].packageName, '@hanamesh/app-example');
  // Real traffic through the gateway (bootstrap ticket → grant cookie → app document) is one `use` for this UTC hour.
  const resumed = await first.post('/apps/resume', { viewId: 'view-u07', leaseToken: opened.json.leaseToken });
  assert.equal(resumed.status, 200, JSON.stringify(resumed.json)); assert.ok(resumed.json.uiUrl);
  const boot303 = await http(resumed.json.uiUrl, { headers: { referer: first.origin + '/', 'sec-fetch-dest': 'iframe' } });
  assert.equal(boot303.status, 303);
  const cookie = boot303.headers['set-cookie'][0].split(';')[0], appOrigin = new URL(resumed.json.uiUrl).origin;
  assert.equal((await http(appOrigin + '/', { headers: { cookie } })).status, 200);
  assert.equal((await http(appOrigin + '/second', { headers: { cookie } })).status, 200);
  // T6: the hour's `use` (with the receipt count) is reported when the hour closes or the app's last instance ends.
  // Until then the local receipt ledger already shows the hour: two forwarded requests, no Router route → no provider.
  const localReceipts = await first.get('/hanamesh/router/receipts?appId=example');
  assert.equal(localReceipts.status, 200, JSON.stringify(localReceipts.json));
  assert.deepEqual(localReceipts.json.items.map(i => ({ appId: i.appId, providerId: i.providerId, model: i.model, count: i.count, reported: i.reported })), [{ appId: 'example', providerId: null, model: null, count: 2, reported: false }]);
  assert.equal(seat.calls.filter(c => c.action === 'use').length, 0);
  const closedFirst = await first.post('/apps/close', { viewId: 'view-u07', leaseToken: opened.json.leaseToken });
  assert.equal(closedFirst.status, 200, JSON.stringify(closedFirst.json));
  const stopped = await first.post('/apps/stop', { instanceId: ready.id, confirm: true });
  assert.equal(stopped.status, 200, JSON.stringify(stopped.json));
  await until(() => seat.calls.some(c => c.action === 'use'));
  const uses = seat.calls.filter(c => c.action === 'use');
  assert.equal(uses.length, 1); assert.match(uses[0].idempotencyKey, /^use:example:\d{10}$/); assert.equal(uses[0].hanaRef, '@hanamesh/app-example');
  assert.equal(uses[0].targetRef, 'example'); assert.equal('receipt' in uses[0], false, 'no Router route → no receipt');
  await until(async () => (await first.get('/hanamesh/router/receipts?appId=example')).json.items[0].reported === true);
  // (2) No usage plugin at all: the app opens and serves exactly the same; nothing is recorded anywhere.
  const alone = await boot(t, { applications: [app] });
  const solo = await alone.post('/apps/open', { appId: 'example', deploymentId: 'local', viewId: 'view-u07b' });
  assert.equal(solo.status, 200, JSON.stringify(solo.json));
  await until(async () => (await alone.get('/hanamesh/apps')).json.instances.find(i => i.status === 'ready'));
  // (3) Seat provided AFTER this plugin (usage loaded later): the optional inject picks it up for the next open.
  const late = { calls: [], record: async input => { late.calls.push(input); return { disposition: 'withheld' }; } };
  alone.ctx.provide('hanameshUsage', late);
  await until(() => alone.ctx.get('hanameshUsage') !== undefined);
  const closed = await alone.post('/apps/close', { viewId: 'view-u07b', leaseToken: solo.json.leaseToken });
  assert.equal(closed.status, 200, JSON.stringify(closed.json));
  await until(async () => (await alone.get('/hanamesh/apps')).json.instances.every(i => i.status === 'stopped'));
  const reopened = await alone.post('/apps/open', { appId: 'example', deploymentId: 'local', viewId: 'view-u07c' });
  assert.equal(reopened.status, 200, JSON.stringify(reopened.json));
  await until(() => late.calls.some(c => c.action === 'open'));
  assert.equal(late.calls[0].hanaRef, '@hanamesh/app-example');
});

test('AH-M08 (plugin): rc.28 market routes are registered on the real web server behind the same auth chain; without an installer the plugin seats answer 503, never 500', async t => {
  const plain = await boot(t);
  const anonymous = await plain.get('/hanamesh/library/installedPlugins', { authorization: undefined });
  assert.equal(anonymous.status, 401);
  const list = await plain.get('/hanamesh/library/installedPlugins');
  assert.equal(list.status, 200, JSON.stringify(list.json));
  assert.deepEqual({ plugins: list.json.plugins, apps: list.json.apps, restartRequired: list.json.restartRequired }, { plugins: [], apps: [], restartRequired: false });
  for (const path of ['/hanamesh/library/plugins/install', '/hanamesh/library/plugins/uninstall', '/hanamesh/library/provision', '/hanamesh/library/uninstall']) {
    const response = await plain.post(path, {});
    assert.equal(response.status, 503, `${path}: ${JSON.stringify(response.json)}`); assert.equal(response.json.error.code, 'LIBRARY_INSTALL_UNAVAILABLE');
  }
  const csrf = await plain.post('/hanamesh/library/plugins/install', { packageName: 'dsh-plugin-tether' }, { 'x-hanamesh-client': undefined });
  assert.equal(csrf.status, 403); assert.equal(csrf.json.error.code, 'CSRF_DENIED');
});
