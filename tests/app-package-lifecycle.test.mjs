/**
 * P02-APPHOST-01 · app package contract v2 on a REAL Cordis root with the pinned DSH service stack (same composition as
 * dsh.test.mjs; `connection` is the same AUTH_DOUBLE). The app bundle under test is the contract entry itself
 * (tests/fixtures/app-package/entry-v{1,2}.js, the v2 file is the one docs/APP_PACKAGE.md shows), loaded as a Cordis
 * plugin exactly like the DSH Loader does. The real-DSH boot/remove gate lives in docs/acceptance/p02-apphost-contract/.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as storageJson from '@deepseek-ai/dsh-storage-json';
import * as storageDomain from '@deepseek-ai/dsh-storage-domain';
import WebServer from '@deepseek-ai/dsh-host-webserver';
import * as appHost from '../src/dsh.js';
import { checkAppPackageEntry, APP_PACKAGE_CONTRACT_VERSION, AppHost, AtomicFileStore } from '../src/index.js';
import { definition, temporary, until, pidAlive, delay, parentOrigin } from './helpers.mjs';

const P = appHost.BROWSER_PRINCIPAL;
const FIBER_ACTIVE = 2, FIBER_PENDING = 0;   // same mirrors dsh-app-boot uses to audit Loader entries

async function root(t) {
  const dir = await temporary();
  const ctx = new Context();
  ctx.plugin(Storage); ctx.plugin(storageJson, { root: join(dir, 'storages') }); ctx.plugin(storageDomain, { backend: 'json' });
  ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 });
  ctx.provide('connection', { requestRejection: () => ({ status: 401 }) });
  await ctx.start?.(); await until(() => ctx.get('webServer')?.port > 0);
  const errors = []; ctx.logger.exporter({ export: m => { if (m.type === 'error' || m.type === 'warn') errors.push(m); } });
  t.after(async () => { await ctx.fiber?.dispose?.(); await rm(dir, { recursive: true, force: true }); });
  const host = { fiber: undefined,
    start() { this.fiber = ctx.plugin(appHost, { dataRoot: join(dir, 'app-data'), applications: [], library: { sources: [] } }); return until(() => ctx.get('hanameshApps')); },
    async stop() { await this.fiber.dispose(); assert.equal(ctx.get('hanameshApps'), undefined); } };
  return { ctx, dir, host, errors };
}
/** A copy of the contract entry next to its own app.json, imported from a fresh URL (no module cache sharing). */
async function bundle(dir, contract, app = definition({ id: 'pkg-app' })) {
  const pkg = join(dir, `bundle-${contract}-${Math.random().toString(16).slice(2)}`);
  await (await import('node:fs/promises')).mkdir(pkg);
  await copyFile(new URL(`./fixtures/app-package/entry-${contract}.js`, import.meta.url), join(pkg, 'dsh.js'));
  await writeFile(join(pkg, 'app.json'), JSON.stringify(app));
  return await import(pathToFileURL(join(pkg, 'dsh.js')).href);
}
const ids = ctx => ctx.get('hanameshApps')?.list().apps.map(a => a.id);

test('AH-PK01 (RED shape): a contract v1 bundle without the host stays PENDING — the state the pinned DSH boot audit rejects', async t => {
  const r = await root(t);
  const fiber = r.ctx.plugin(await bundle(r.dir, 'v1'));
  await delay(200);
  assert.equal(fiber.state, FIBER_PENDING);
  assert.deepEqual(Object.keys(fiber.inject), ['hanameshApps']);
});

test('AH-PK02 app before host: a v2 bundle is ACTIVE and inert without the host, then registers exactly once when the host arrives', async t => {
  const r = await root(t);
  const fiber = r.ctx.plugin(await bundle(r.dir, 'v2'));
  await until(() => fiber.state === FIBER_ACTIVE);
  assert.deepEqual(Object.keys(fiber.inject), []);
  await r.host.start();
  await until(() => ids(r.ctx)?.length === 1);
  assert.deepEqual(ids(r.ctx), ['pkg-app']);
  assert.deepEqual(r.errors, []);
});

test('AH-PK03 host before app, host gone, host back: one registration per host life, app never fails, no orphan process', async t => {
  const r = await root(t);
  await r.host.start();
  const fiber = r.ctx.plugin(await bundle(r.dir, 'v2', definition({ id: 'pkg-app', embedding: 'gateway' })));
  await until(() => ids(r.ctx)?.length === 1);
  const first = r.ctx.get('hanameshApps');
  const opened = await first.open({ appId: 'pkg-app', deploymentId: 'local', viewId: 'v-host-gone' }, P);
  assert.ok(pidAlive(opened.instance.pid));
  await r.host.stop();                                   // suite removed / host reloaded
  await until(() => !pidAlive(opened.instance.pid));
  assert.equal(fiber.state, FIBER_ACTIVE, 'the app bundle must stay active while the host is absent');
  await r.host.start();                                  // host restored
  await until(() => ids(r.ctx)?.length === 1);
  const second = r.ctx.get('hanameshApps');
  assert.notEqual(second, first);
  assert.deepEqual(ids(r.ctx), ['pkg-app']);
  // Same persisted instance identity is resumable on the new host; nothing was duplicated.
  const records = second.instanceList(P).filter(i => i.appId === 'pkg-app');
  assert.equal(records.length, 1); assert.equal(records[0].id, opened.instance.id);
  assert.deepEqual(r.errors, []);
});

test('AH-PK04 app uninstalled while the host runs: its definition goes, its owned runtime stops, its record and data stay', async t => {
  const r = await root(t);
  await r.host.start();
  const fiber = r.ctx.plugin(await bundle(r.dir, 'v2'));
  await until(() => ids(r.ctx)?.length === 1);
  const host = r.ctx.get('hanameshApps');
  const opened = await host.open({ appId: 'pkg-app', deploymentId: 'local', viewId: 'v-app-gone' }, P);
  assert.ok(pidAlive(opened.instance.pid));
  await fiber.dispose();
  assert.deepEqual(ids(r.ctx), []);
  assert.equal(pidAlive(opened.instance.pid), false);
  const record = host.instance(opened.instance.id, P);
  assert.equal(record.status, 'stopped');
  await assert.rejects(host.open({ appId: 'pkg-app', deploymentId: 'local', viewId: 'v-after' }, P), { code: 'APP_NOT_REGISTERED' });
  const stoppedEvents = host.eventsSince(0, P).events.filter(e => e.type === 'instance.stopped' && e.instanceId === opened.instance.id);
  assert.equal(stoppedEvents.length, 1);
  // Reinstall: same appId registers again, same single-instance slot and data directory.
  r.ctx.plugin(await bundle(r.dir, 'v2'));
  await until(() => ids(r.ctx)?.length === 1);
  const again = await host.open({ appId: 'pkg-app', deploymentId: 'local', viewId: 'v-again' }, P);
  assert.equal(again.instance.id, opened.instance.id);
  assert.equal(again.instance.dataDir, opened.instance.dataDir);
});

test('AH-PK05 a broken app definition is not swallowed: the registration fails loudly and nothing is registered', async t => {
  const r = await root(t);
  await r.host.start();
  const bad = { ...definition({ id: 'pkg-bad' }), deployments: [{ ...definition().deployments[0], args: [] }] };
  const fiber = r.ctx.plugin(await bundle(r.dir, 'v2', bad));
  await until(() => r.errors.length > 0);
  assert.deepEqual(ids(r.ctx), []);
  assert.match(JSON.stringify(r.errors.map(e => e.args.map(String))), /MISSING_RUNTIME_BINDING|explicitly bind/);
  assert.equal(fiber.state, FIBER_ACTIVE, 'the bundle itself stays loaded so DSH still boots; the failure is the logged scope error');
});

test('AH-PK06 unregister only removes the exact registration and is a no-op while the host closes', async t => {
  const r = await root(t);
  await r.host.start();
  const host = r.ctx.get('hanameshApps');
  const { appId, definitionHash } = host.register(definition({ id: 'direct' }));
  await assert.rejects(host.unregister(appId, 'nothex'), { code: 'INVALID_REQUEST' });
  assert.deepEqual(await host.unregister(appId, 'f'.repeat(64)), { appId, removed: false, reason: 'definition-replaced', stopped: 0 });
  assert.deepEqual(await host.unregister('other', definitionHash), { appId: 'other', removed: false, reason: 'not-registered', stopped: 0 });
  assert.deepEqual(await host.unregister(appId, definitionHash), { appId, removed: true, stopped: 0 });
  const again = host.register(definition({ id: 'direct' }));
  await r.host.stop();
  assert.deepEqual(await host.unregister(appId, again.definitionHash), { appId, removed: false, reason: 'host-closing', stopped: 0 });
});

test('AH-PK07 checkAppPackageEntry: v2 entry passes; a top-level hanameshApps inject (array or map) or a stale contractVersion is refused', async t => {
  const r = await root(t);
  const v2 = await bundle(r.dir, 'v2'), v1 = await bundle(r.dir, 'v1');
  assert.equal(APP_PACKAGE_CONTRACT_VERSION, 2);
  assert.deepEqual(checkAppPackageEntry(v2, { hanamesh: { contractVersion: 2 } }), { contractVersion: 2, hostLifecycle: 'host-optional' });
  assert.throws(() => checkAppPackageEntry(v1, { hanamesh: { contractVersion: 2 } }), { code: 'APP_PACKAGE_HOST_REQUIRED' });
  assert.throws(() => checkAppPackageEntry({ apply() {}, inject: { hanameshApps: {} } }, { hanamesh: { contractVersion: 2 } }), { code: 'APP_PACKAGE_HOST_REQUIRED' });
  assert.throws(() => checkAppPackageEntry(v2, { hanamesh: { contractVersion: 1 } }), { code: 'APP_PACKAGE_CONTRACT_VERSION' });
  assert.throws(() => checkAppPackageEntry({}, {}), { code: 'INVALID_APP_PACKAGE' });
  // The doc's v2 entry is byte-for-byte the fixture (modulo the package name), so the doc cannot drift from what is tested.
  const doc = await readFile(new URL('../docs/APP_PACKAGE.md', import.meta.url), 'utf8');
  const entry = await readFile(new URL('./fixtures/app-package/entry-v2.js', import.meta.url), 'utf8');
  assert.ok(doc.includes('```js\n' + entry + '```'), 'docs/APP_PACKAGE.md must show entry-v2.js verbatim');
});

test('AH-PK08 (SPEC R2) an Open already queued when unregister runs never reserves or launches a runtime for the removed app', async t => {
  const r = await root(t);
  await r.host.start();
  const host = r.ctx.get('hanameshApps');
  const { appId, definitionHash } = host.register(definition({ id: 'race-app' }));
  // Another app's Open occupies the serial queue, so the raced Open has read the definition but not yet reserved
  // when unregister starts (both calls are issued synchronously, before any queued step runs).
  host.register(definition({ id: 'blocker' }));
  const held = host.beginOpen({ appId: 'blocker', deploymentId: 'local', viewId: 'v-blocker' }, P);
  const raced = host.beginOpen({ appId, deploymentId: 'local', viewId: 'v-race' }, P);
  const undone = await host.unregister(appId, definitionHash);
  const outcome = await raced.then(value => ({ value }), error => ({ error }));
  await held;
  assert.equal(undone.removed, true);
  // The queued Open had not reserved yet, so it must be refused — no record, no runtime for the removed app.
  assert.equal(outcome.error?.code, 'APP_NOT_REGISTERED', JSON.stringify(outcome.value?.instance ?? null));
  assert.deepEqual(host.instanceList(P).filter(i => i.appId === appId), [], JSON.stringify(host.instanceList(P)));
});

test('AH-PK09 (SPEC R3) unregistering app A stops only A: app B keeps its live, ready runtime', async t => {
  const r = await root(t);
  await r.host.start();
  const host = r.ctx.get('hanameshApps');
  const a = host.register(definition({ id: 'app-a' })), b = host.register(definition({ id: 'app-b' }));
  const openA = await host.open({ appId: 'app-a', deploymentId: 'local', viewId: 'v-a' }, P);
  const openB = await host.open({ appId: 'app-b', deploymentId: 'local', viewId: 'v-b' }, P);
  assert.ok(pidAlive(openA.instance.pid)); assert.ok(pidAlive(openB.instance.pid));
  assert.deepEqual(await host.unregister(a.appId, a.definitionHash), { appId: 'app-a', removed: true, stopped: 1 });
  assert.equal(pidAlive(openA.instance.pid), false);
  assert.ok(pidAlive(openB.instance.pid), 'B must survive A being unregistered');
  assert.equal(host.instance(openB.instance.id, P).status, 'ready');
  assert.deepEqual(host.list(P).apps.map(x => x.id), ['app-b']);
  void b;
});

test('AH-PK10 (SPEC R2) an Open whose reservation is mid-commit when unregister starts is found and stopped — no orphan runtime', async t => {
  const dir = await temporary();
  // The real file store, with one save held open so unregister lands between "registration checked" and "reservation durable".
  const inner = new AtomicFileStore(join(dir, 'sidecar')); let hold = null;
  const store = { init: () => inner.init(), load: () => inner.load(), close: () => inner.close(),
    save: async snapshot => { if (hold && snapshot.instances.some(i => i.appId === 'held-app')) { const h = hold; hold = null; h.reached(); await h.gate; } return await inner.save(snapshot); } };
  const host = new AppHost({ store, dataRoot: join(dir, 'data'), parentOrigin, sweepIntervalMs: 0 });
  t.after(async () => { await host.dispose(); await rm(dir, { recursive: true, force: true }); });
  const { appId, definitionHash } = host.register(definition({ id: 'held-app' }));
  await host.init();
  let reached, release; const atSave = new Promise(r => { reached = r; }), gate = new Promise(r => { release = r; });
  hold = { reached, gate };
  const opening = host.beginOpen({ appId, deploymentId: 'local', viewId: 'v-held' }, P);
  await atSave;                                         // reservation is being written, not yet in host state
  const undoing = host.unregister(appId, definitionHash);
  release();
  const opened = await opening;                         // it passed the registration check before the delete
  const undone = await undoing;
  assert.deepEqual(undone, { appId, removed: true, stopped: 1 });
  await until(() => !pidAlive(opened.instance.pid ?? host.instance(opened.instance.id, P)?.pid ?? -1));
  assert.equal(host.instance(opened.instance.id, P).status, 'stopped');
  assert.deepEqual(host.list(P).apps, []);
});
