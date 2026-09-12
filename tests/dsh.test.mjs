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
async function boot(t, { token = 'browser-session', withPlugin = true, applications = [definition()] } = {}) {
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
    fiber = ctx.plugin(appHost, { dataRoot: join(root, 'app-data'), applications });
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
