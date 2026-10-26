import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as storageJson from '@deepseek-ai/dsh-storage-json';
import * as storageDomain from '@deepseek-ai/dsh-storage-domain';
import WebServer from '@deepseek-ai/dsh-host-webserver';
import * as appHost from '../src/dsh.js';
import { AppHost, AtomicFileStore } from '../src/index.js';
import { createLibraryService } from '../src/library/service.js';
import { createLibraryInstaller } from '../src/library/install.js';
import {fixtureRegistryManager} from './helpers.mjs';
import { createLibraryHttpHandler } from '../src/library/routes.js';
import { clientHarness, fakeClock, settle } from './fixtures/client-ui-harness.mjs';
import { definition, http, until } from './helpers.mjs';

// Evidence: SOURCE/FIXTURE plus a real local app process. CLI, catalog and auth are
// named counterparts; this never proves the native Desktop or owner acceptance.
const runRoot = resolve(import.meta.dirname, '../..');
const catalogFixture = resolve('tests/fixtures/catalog/provider-page.json');
const appTarget = { itemId: 'com.hanamesh.vibe-trading', packageName: '@hanamesh/app-vibe-trading', contractVersion: '1' };
const pluginTarget = { itemId: 'com.hanamesh.utility-plugin', packageName: '@hanamesh/utility-plugin', contractVersion: '1' };
const probePath = '/hanamesh/library/install-target';
const fixtureLeaseToken = 'a'.repeat(64);

async function temporary() {
  await mkdir(join(runRoot, 'tmp'), { recursive: true });
  const root = await realpath(await mkdtemp(join(runRoot, 'tmp', 'market-')));
  return root;
}

async function provider(t, { available = true, gate, cliFails = false, readbackVersion = '1.2.3' } = {}) {
  const root = await temporary(), profile = join(root, 'profile'), dataRoot = join(root, 'data');
  let service, host;
  const server = createServer();
  t.after(async () => {
    try {
      await service?.close();
      await host?.dispose();
    } finally {
      server.closeAllConnections();
      await new Promise(r => server.close(r));
      await rm(root, { recursive: true, force: true });
    }
  });
  await mkdir(profile);
  await writeFile(join(profile, 'package.json'), JSON.stringify({ dependencies: {}, dsh: { profile: { bundles: [] } } }));
  const calls = [];
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  host = new AppHost({ store: new AtomicFileStore(join(root, 'sidecar')), dataRoot, parentOrigin: origin, sweepIntervalMs: 0 });
  await host.init();
  // Official CLI counterpart writes a temporary profile; it never invokes dsh,
  // changes DSH_HOME, or installs into the user's profile.
  const installer = available ? createLibraryInstaller({pluginManager:fixtureRegistryManager,
    profileDir: profile, profileName: 'market-contract', dataRoot,
    nodeBinary: process.execPath, dshBin: join(root, 'fixture-dsh-bin.js'),
    fetchImpl: async () => new Response(JSON.stringify({ version: '1.2.3' })),
    ledger: async () => ({ schema: 1, items: {} }),
    spawn: async (command, args, options) => {
      calls.push({ command, args, options });
      if (args[4] === 'add') {
        await gate;
        if (cliFails) return { code: 1, stderr: 'fixture CLI failed before any write' };
        const spec = args.at(-1), name = spec.slice(0, spec.lastIndexOf('@'));
        const pkgRoot = join(profile, 'node_modules', ...name.split('/'));
        await mkdir(pkgRoot, { recursive: true });
        const app = name === appTarget.packageName;
        await writeFile(join(pkgRoot, 'package.json'), JSON.stringify({ name, version: readbackVersion, ...(app ? { hanamesh: { app: 'app.json' } } : {}) }));
        if (app) await writeFile(join(pkgRoot, 'app.json'), JSON.stringify(definition({ id: 'market-example' })));
        const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'));
        manifest.dependencies[name] = '1.2.3';
        await writeFile(join(profile, 'package.json'), JSON.stringify(manifest));
      } else if (args[4] === 'remove') {
        const name = args.at(-1), manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'));
        delete manifest.dependencies[name];
        await writeFile(join(profile, 'package.json'), JSON.stringify(manifest));
        await rm(join(profile, 'node_modules', ...name.split('/')), { recursive: true, force: true });
      }
      return { code: 0, stderr: '' };
    },
    emit: event => service?.emit(event),
  }) : undefined;
  let state = { schema: 1, revision: 0, sources: [] };
  service = await createLibraryService({
    domain: { global: { get: async () => structuredClone(state), set: async value => { state = structuredClone(value); } }, close: async () => {} },
    host, dataRoot, config: { fixture: catalogFixture, profileDir: profile, handoff: {allowedOrigins: ['https://market.example']} },
    ledgerReader: async () => ({ schema: 1, items: {} }), installer,
  }).init();
  server.on('request', createLibraryHttpHandler(service, {
    parentOrigin: origin,
    authenticate: async req => req.headers['x-test-auth'] === 'yes' ? { principalId: 'market-fixture' } : null,
    authorize: async (_subject, _path, input) => input.packageName !== 'forbidden',
  }));
  const headers = { origin, 'x-test-auth': 'yes', 'x-hanamesh-client': 'workspace-v1', 'content-type': 'application/json' };
  const merged = extra => Object.fromEntries(Object.entries({ ...headers, ...extra }).filter(([, value]) => value !== undefined));
  return { root, profile, host, service, calls, origin, headers,
    get: (path, extra = {}) => http(origin + path, { headers: merged(extra) }),
    post: (path, input, extra = {}) => http(origin + path, { method: 'POST', headers: merged(extra), body: JSON.stringify(input) }),
  };
}

for (const available of [true, false]) test(`CM01/${available}: public website discovery reports installation readiness without exposing profile or authentication`, async t => {
  const h = await provider(t, { available });
  for (const hostname of ['127.0.0.1', 'localhost']) {
    const reply = await h.get(probePath, { host: `${hostname}:${new URL(h.origin).port}`, origin: 'https://market.example', 'x-test-auth': undefined });
    assert.equal(reply.status, 200, 'C-MARKET discovery must be a public read on the named loopback host');
    assert.equal(reply.json.client, 'dsh', 'standalone official DSH is not evidence of the HanaMesh Desktop');
    assert.equal(reply.json.ready, available);
    assert.deepEqual(reply.json.installTarget, { contract: 'hanamesh.install-target', contractVersion: '1', supported: ['1'], fragmentPrefix: '#hanamesh-install?' });
    assert.equal(reply.headers['access-control-allow-origin'], 'https://market.example', 'only an approved website can read discovery without credentials');
    assert.equal(reply.headers['access-control-allow-credentials'], undefined);
    assert.equal(reply.headers['set-cookie'], undefined);
    assert.equal(reply.headers['cache-control'], 'no-store');
    assert.equal(reply.json.error?.code, available ? undefined : 'INSTALL_TARGET_UNAVAILABLE');
    assert.equal(reply.json.suite, undefined, 'Core completeness is unknown: public discovery omits the suite instead of inferring it from an empty physical profile');
    assert.deepEqual(Object.keys(reply.json).sort(), (available ? ['client', 'ready', 'installTarget', 'traceId'] : ['client', 'ready', 'installTarget', 'error', 'traceId']).sort());
    assert.ok(!JSON.stringify(reply.json).includes(h.profile));
  }
  assert.equal(h.calls.length, 0);
  assert.deepEqual(h.service.events().events, []);
});

for (const available of [true, false]) test(`CM01-facts/${available}: authenticated suite card preserves physical inventory while Core completeness remains unknown`, async t => {
  const h = await provider(t, { available });
  const names=['@hanamesh/core','@hanamesh/usage','@hanamesh/dsh-app-host'],versions=['0.3.12','0.2.0-rc.34','0.6.5'];
  for(const physicallyInstalled of [false,true]){
    if(physicallyInstalled){for(const [i,name] of names.entries()){await mkdir(join(h.profile,'node_modules',name),{recursive:true});await writeFile(join(h.profile,'node_modules',name,'package.json'),JSON.stringify({name,version:versions[i]}));}await writeFile(join(h.profile,'package.json'),JSON.stringify({dependencies:Object.fromEntries(names.map((name,i)=>[name,versions[i]])),dsh:{profile:{bundles:names}}}));}
    const denied=await h.get('/hanamesh/library?category=',{'x-test-auth':undefined});assert.equal(denied.status,401);
    const reply=await h.get('/hanamesh/library?category=');assert.equal(reply.status,200);
    const item=reply.json.items.find(row=>row.kind==='suite');assert.ok(item);
    assert.equal(item.suite.completeness,'unknown');assert.equal(item.suite.status,'unknown');assert.equal(item.suiteUpgradeUnavailable,'Core 未提供套件声明');assert.equal(item.installed,null);
    assert.deepEqual(item.suite.blocked,[{code:'CORE_SUITE_DECLARATION_MISSING'}]);
    assert.deepEqual(item.suite.components.map(row=>({name:row.name,version:row.version,active:row.active})),names.map((name,i)=>({name,version:physicallyInstalled?versions[i]:null,active:physicallyInstalled})));
    assert.equal(item.suite.version,physicallyInstalled?versions[0]:null);
    const discovery=await h.get(probePath,{origin:'https://market.example','x-test-auth':undefined});assert.equal(discovery.status,200);assert.equal(discovery.json.suite,undefined);assert.deepEqual(Object.keys(discovery.json).sort(),(available?['client','ready','installTarget','traceId']:['client','ready','installTarget','error','traceId']).sort());assert.ok(!JSON.stringify(discovery.json).includes(h.profile));
  }
  assert.equal(h.calls.length,0);assert.deepEqual(h.service.events().events,[]);
});

test('CM02: discovery denies unknown hosts, iframe callers and mutation methods without starting an operation', async t => {
  const h = await provider(t);
  for (const [headers, status, code] of [
    [{ host: 'attacker.invalid' }, 403, 'HOST_DENIED'],
    [{ 'sec-fetch-dest': 'iframe' }, 403, 'FRAME_CONTROL_DENIED'],
  ]) {
    const reply = await h.get(probePath, headers);
    assert.deepEqual([reply.status, reply.json.error?.code], [status, code]);
  }
  const write = await h.post(probePath, appTarget);
  assert.deepEqual([write.status, write.json.error?.code], [405, 'METHOD_NOT_ALLOWED']);
  assert.equal(h.calls.length, 0);
});

test('CM03: public discovery does not make target resolution, installed rows, events or installation public', async t => {
  const h = await provider(t);
  for (const path of ['/hanamesh/library/target?packageName=' + encodeURIComponent(appTarget.packageName), '/hanamesh/library/installedPlugins', '/hanamesh/library/events']) {
    const unauthenticated = await h.get(path, { 'x-test-auth': undefined });
    assert.equal(unauthenticated.status, 401);
    const website = await h.get(path, { origin: 'https://market.example' });
    assert.equal(website.status, 403);
    assert.equal(website.headers['access-control-allow-origin'], undefined);
  }
  for (const extra of [{ origin: 'https://market.example' }, { 'x-hanamesh-client': undefined }, { 'x-test-auth': undefined }, { 'sec-fetch-dest': 'iframe' }]) {
    assert.ok([401, 403].includes((await h.post('/hanamesh/library/install', appTarget, extra)).status));
  }
  assert.equal(h.calls.length, 0);
});

test('CM04: target resolution returns both exact catalog identities, kind and source; mismatches, extra authority and unsupported versions never install', async t => {
  const h = await provider(t);
  const reply = await h.get('/hanamesh/library/target?' + new URLSearchParams(appTarget));
  assert.equal(reply.status, 200);
  assert.deepEqual([reply.json.contractVersion, reply.json.item.id, reply.json.item.package.name, reply.json.item.kind, reply.json.source.kind], ['1', appTarget.itemId, appTarget.packageName, 'application', 'fixture']);
  for (const [input, code] of [
    [{ ...appTarget, packageName: pluginTarget.packageName }, 'CATALOG_ITEM_MISSING'],
    [{ ...appTarget, version: '9.0.0' }, 'INVALID_INPUT'],
    [{ ...appTarget, url: 'https://attacker.invalid/app.tgz' }, 'INVALID_INPUT'],
    [{ ...appTarget, command: '/bin/sh' }, 'INVALID_INPUT'],
    [{ ...appTarget, contractVersion: '2', future: 'field' }, 'CONTRACT_VERSION_UNSUPPORTED'],
  ]) {
    const refusal = await h.post('/hanamesh/library/install', input);
    assert.deepEqual([refusal.status, refusal.json.error?.code], [input.contractVersion === '2' || code === 'INVALID_INPUT' ? 400 : 404, code]);
  }
  assert.equal(h.calls.length, 0);
});

test('CM05: duplicate HTTP identity fields are refused instead of silently taking the last value', async t => {
  const h = await provider(t);
  const reply = await h.get('/hanamesh/library/target?packageName=not-the-target&packageName=' + encodeURIComponent(appTarget.packageName));
  assert.deepEqual([reply.status, reply.json.error?.code], [400, 'INVALID_INPUT']);
  assert.equal(h.calls.length, 0);
});

test('CM06: accepted duplicate requests share one operation, finish with exact profile readback, then ordinary application opens under its own lease', async t => {
  let release;
  const gate = new Promise(r => { release = r; });
  t.after(() => release());
  const h = await provider(t, { gate });
  const [first, second] = await Promise.all([h.post('/hanamesh/library/install', appTarget), h.post('/hanamesh/library/install', appTarget)]);
  release();
  assert.equal(first.status, 202);
  assert.equal(first.json.status, 'started');
  assert.equal(second.json.operationId, first.json.operationId);
  assert.equal(first.json.installed, undefined, 'acceptance is not installation completion');
  await until(() => h.service.events().events.some(e => e.type === 'library.install-done' && e.operationId === first.json.operationId));
  assert.equal(h.calls.filter(c => c.args[4] === 'add').length, 1);
  assert.deepEqual(h.calls[0].args.slice(1), ['plugin', '--profile', 'market-contract', 'add', '--save-exact', '--registry=https://registry.npmjs.org/', appTarget.packageName + '@1.2.3']);
  const feed = await h.get('/hanamesh/library/events?after=0');
  const done = feed.json.events.find(e => e.operationId === first.json.operationId && e.type === 'library.install-done');
  assert.deepEqual([done.result.packageName, done.result.version, done.result.kind], [appTarget.packageName, '1.2.3', 'application']);
  const beforeLoad = await h.get('/hanamesh/library/installedPlugins');
  assert.equal(beforeLoad.json.apps[0].state, 'installed-not-loaded');
  assert.equal(beforeLoad.json.restartRequired, true);
  // The app bundle's registration is a counterpart of the next DSH load, not
  // a claim that this test exercised the official loader or native restart.
  h.host.register(JSON.parse(await readFile(join(h.profile, 'node_modules', ...appTarget.packageName.split('/'), 'app.json'), 'utf8')));
  const readback = await h.get('/hanamesh/library/installedPlugins');
  assert.deepEqual([readback.json.apps[0].packageName, readback.json.apps[0].version, readback.json.apps[0].state], [appTarget.packageName, '1.2.3', 'registered']);
  const repeated = await h.post('/hanamesh/library/install', appTarget);
  assert.deepEqual([repeated.status, repeated.json.status], [200, 'already-installed']);
  const opened = await h.host.open({ appId: readback.json.apps[0].appId, deploymentId: 'local', viewId: 'market-contract-view' }, 'market-fixture');
  assert.equal(opened.instance.status, 'ready');
  const document = await http(opened.uiUrl);
  assert.equal(document.status, 200);
  assert.match(document.body.toString(), /HANAMESH_FIXTURE/);
  await h.host.close({ viewId: opened.lease.viewId, leaseToken: opened.leaseToken }, 'market-fixture');
  assert.equal(h.host.instance(opened.instance.id, 'market-fixture').status, 'stopped');
});

for (const [options, code] of [[{ cliFails: true }, 'DSH_PLUGIN_FAILED'], [{ readbackVersion: '9.9.9' }, 'INSTALL_READBACK_MISMATCH']]) {
  test(`CM07/${code}: an accepted operation can fail; failure and verified compensation never become installed success`, async t => {
    const h = await provider(t, options);
    const accepted = await h.post('/hanamesh/library/install', appTarget);
    assert.equal(accepted.status, 202);
    await until(() => h.service.events().events.some(e => e.type === 'library.install-failed' && e.operationId === accepted.json.operationId));
    const reply = await h.get('/hanamesh/library/events?after=0');
    const failed = reply.json.events.find(e => e.type === 'library.install-failed' && e.operationId === accepted.json.operationId);
    assert.equal(failed.code, code);
    assert.ok(['not-needed', 'restored'].includes(failed.recovery.status));
    assert.ok(failed.recovery.checks.every(row => row.ok));
    assert.equal(reply.json.events.some(e => e.type === 'library.install-done' && e.operationId === accepted.json.operationId), false);
    assert.deepEqual((await h.get('/hanamesh/library/installedPlugins')).json.apps, []);
    assert.equal(h.host.instanceList().length, 0);
  });
}

async function market(t, { failed = false, recoveryStatus = 'failed', version = '1.2.3', registered = false, verification = false, diagnostic, failureCode = 'DSH_PLUGIN_FAILED' } = {}) {
  const clock = fakeClock(), calls = [];
  let complete = false;
  const row = () => complete ? { packageName: appTarget.packageName, appId: 'market-example', name: 'Ordinary fixture app', version, state: registered ? 'registered' : 'installed-not-loaded', definition: definition({ id: 'market-example' }) } : null;
  const item = () => ({ id: appTarget.itemId, package: { registry: 'npm', name: appTarget.packageName }, displayName: 'Ordinary fixture app', latestVersion: '1.2.3', kind: 'application', installed: row(), upgradeAvailable: false });
  const h = await clientHarness({ clock, verification, fetch: async (path, init = {}) => {
    calls.push({ path, input: init.body ? JSON.parse(init.body) : null });
    let value;
    if (path === probePath) value = { client: 'dsh', ready: true, installTarget: { contract: 'hanamesh.install-target', contractVersion: '1', supported: ['1'], fragmentPrefix: '#hanamesh-install?' }, traceId: 'fixture-probe' };
    else if (path.startsWith('/hanamesh/library/target?')) value = { contractVersion: '1', item: item(), source: { kind: 'fixture', path: 'fixture-catalog.json' }, traceId: 'fixture-target' };
    else if (path === '/hanamesh/library/install') value = { operationId: 'fixture-op', status: 'started', traceId: 'fixture-install' };
    else if (path.startsWith('/hanamesh/library/events?')) {
      complete = !failed;
      value = { sequence: 2, operations: [], resetRequired: false, traceId: 'fixture-events', events: [
        { sequence: 1, at: clock.now(), operationId: 'unrelated-op', type: 'library.install-done', result: { status: 'restart-required', kind: 'plugin', packageName: 'unrelated-plugin', version: '0.0.1' } },
        failed ? { sequence: 2, at: clock.now(), operationId: 'fixture-op', type: 'library.install-failed', code: failureCode, ...(diagnostic ? { details: { diagnostic } } : {}), recovery: { status: recoveryStatus, mode: 'new-install', stage: 'add', previousVersion: null, actions: [], checks: [{ item: 'module', expected: null, actual: '1.2.3', ok: false }], residue: [{ item: 'module', reason: 'NOT_RESTORED' }] } }
          : { sequence: 2, at: clock.now(), operationId: 'fixture-op', type: 'library.install-done', result: { status: 'restart-required', kind: 'application', packageName: appTarget.packageName, appId: 'market-example', version: '1.2.3' } },
      ] };
    } else if (path === '/apps/open') value = { instance: { id: 'fixture-instance', appId: 'market-example', deploymentId: 'local', dataId: 'data-v1', mode: 'owned', runtimeId: 'fixture-runtime', status: 'ready' }, lease: { principalId: 'market-fixture', viewId: JSON.parse(init.body).viewId, instanceId: 'fixture-instance', generation: 1, status: 'active', createdAt: clock.now(), expiresAt: clock.now() + 90_000, originalSessionId: null }, leaseToken: fixtureLeaseToken, uiUrl: 'http://127.0.0.1:49201/', originalSessionId: null, traceId: 'fixture-open' };
    else if (path === '/apps/close') value = { instanceId: 'fixture-instance', alreadyClosed: false, instance: { id: 'fixture-instance', appId: 'market-example', deploymentId: 'local', dataId: 'data-v1', mode: 'owned', runtimeId: 'fixture-runtime', status: 'stopped' }, traceId: 'fixture-close' };
    else value = { source: { kind: 'fixture', path: 'fixture-catalog.json' }, items: [item()], categories: ['hanamesh-app'], installed: row() ? [row()] : [], plugins: [], page: { nextCursor: null, total: 1 }, restartRequired: complete && !registered, traceId: 'fixture-library' };
    return { ok: true, json: async () => value };
  } });
  t.after(() => h.unmount());
  return { h, calls, clock, text: () => JSON.stringify(h.tree) };
}

test('CM08: normal navigation shows the market confirmation; cancelling sends neither install nor app open', async t => {
  const m = await market(t), disposers = [];
  m.h.module.apply({ effect: run => { disposers.push(run()); }, slots: { inject: (_n, run) => run(), register: () => () => {} }, reflect: { get: () => undefined }, provide: () => () => {} });
  t.after(() => disposers.forEach(dispose => dispose?.()));
  m.h.hashchange('#hanamesh-install?' + new URLSearchParams(appTarget));
  await settle();
  for (const field of ['Ordinary fixture app', appTarget.packageName, '1.2.3', '测试目录']) assert.ok(m.text().includes(field));
  await m.h.click('取消');
  assert.match(m.text(), /已取消，未安装/);
  assert.equal(m.calls.filter(c => ['/hanamesh/library/install', '/apps/open'].includes(c.path)).length, 0);
});

test('CM09: confirmation posts once, acceptance stays pending, matching completion and readback enable ordinary app open and exact close', async t => {
  const m = await market(t, { registered: true });
  await m.h.module.openInstallTarget(appTarget);
  await settle();
  const confirm = m.h.find(n => n.type === 'button' && n.children.includes('确认安装'));
  confirm.props.onClick(); confirm.props.onClick();
  await settle();
  assert.equal(m.calls.filter(c => c.path === '/hanamesh/library/install').length, 1);
  assert.match(m.text(), /安装中/);
  assert.doesNotMatch(m.text(), /安装完成，请查看已安装列表/);
  await m.clock.advance(1000);
  assert.match(m.text(), /安装完成，请查看已安装列表/);
  assert.ok(m.h.find(n => n.props['data-hanamesh-installed'] === appTarget.packageName));
  await m.h.click('打开');
  assert.equal(m.h.find(n => n.type === 'iframe').props.src, 'http://127.0.0.1:49201/');
  const open = m.calls.find(c => c.path === '/apps/open');
  assert.deepEqual(Object.keys(open.input).sort(), ['appId', 'deploymentId', 'viewId']);
  await m.h.click('关闭视图');
  assert.deepEqual(m.calls.filter(c => c.path === '/apps/close').map(c => c.input), [{ viewId: open.input.viewId, leaseToken: fixtureLeaseToken }]);
});

test('CM10: an operation failure preserves recovery failure and cannot show installation success or an open action', async t => {
  const m = await market(t, { failed: true });
  await m.h.module.openInstallTarget(appTarget); await settle();
  await m.h.click('确认安装'); await m.clock.advance(1000);
  assert.match(m.text(), /DSH_PLUGIN_FAILED/);
  assert.match(m.text(), /恢复失败/);
  assert.doesNotMatch(m.text(), /安装完成，请查看已安装列表/);
  assert.equal(m.h.find(n => n.type === 'button' && n.children.includes('打开')), undefined);
});

test('CM11: wrong installed version is reported as the C-MARKET readback error and cannot enable open', async t => {
  const m = await market(t, { version: '9.9.9', registered: true });
  await m.h.module.openInstallTarget(appTarget); await settle();
  await m.h.click('确认安装'); await m.clock.advance(1000);
  assert.match(m.text(), /INSTALL_READBACK_MISMATCH/, 'the public contract error must survive the client readback check');
  assert.doesNotMatch(m.text(), /安装完成，请查看已安装列表/);
  const dialog = m.h.find(n => n.props['aria-label'] === '市场安装确认');
  assert.ok(dialog);
  assert.doesNotMatch(JSON.stringify(dialog), /"打开"/);
});

test('CM12: the input form for developer verification is absent from a normal client build', async t => {
  const m = await market(t);
  assert.equal(Boolean(m.h.find(n => n.props['aria-label'] === '安装目标开发小界面')), false, 'verification entry belongs only to the test build');
});

test('CM13: pinned Cordis/webserver registers the discovery route and plugin disposal removes it', async t => {
  const root = await temporary(), ctx = new Context();
  t.after(async () => { try { await ctx.fiber.dispose(); } finally { await rm(root, { recursive: true, force: true }); } });
  ctx.plugin(Storage);
  ctx.plugin(storageJson, { root: join(root, 'storage') });
  ctx.plugin(storageDomain, { backend: 'json' });
  ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 });
  ctx.provide('connection', { requestRejection: () => ({ status: 401 }) });
  await ctx.start?.();
  await until(() => ctx.get('webServer')?.port > 0);
  const origin = `http://127.0.0.1:${ctx.get('webServer').port}`;
  const fiber = ctx.plugin(appHost, { dataRoot: join(root, 'apps'), library: { sources: [], handoff: { enabled: false, allowedOrigins: ['https://market.example'] } } });
  await until(() => ctx.get('hanameshApps'));
  const reply = await http(origin + probePath, { headers: { origin: 'https://market.example' } });
  assert.equal(reply.status, 200, 'the real registered route must answer even when no browser session is present');
  assert.equal(reply.json.ready, false);
  assert.equal(reply.json.error?.code, 'INSTALL_TARGET_UNAVAILABLE');
  await fiber.dispose();
  assert.equal((await http(origin + probePath)).status, 404);
});

test('CM14: test-client verification lists every C-MARKET HTTP call with editable sample input and observable output', async t => {
  const m = await market(t, { verification: true });
  const panel = m.h.find(n => n.props['aria-label'] === 'C-MARKET 合约验证');
  assert.ok(panel, 'test build exposes the module-owned contract verification panel');
  for (const path of [probePath, '/hanamesh/library', '/hanamesh/library/target', '/hanamesh/library/install', '/hanamesh/library/events', '/hanamesh/library/installedPlugins', '/hanamesh/apps', '/apps/open', '/apps/resume', '/apps/heartbeat', '/apps/close']) {
    assert.ok(m.text().includes(path), `the verification entry lists ${path}`);
  }
  assert.ok(m.h.find(n => ['textarea', 'input'].includes(n.type) && n.props['aria-label'] === '合约样例输入'));
  assert.ok(m.h.find(n => n.props['aria-label'] === '合约调用输出'));
  const choose = m.h.find(n => n.type === 'select' && n.props['aria-label'] === '合约调用');
  assert.ok(choose, 'a listed call can be selected');
  choose.props.onChange({ target: { value: 'GET ' + probePath } });
  await settle();
  const sample = m.h.find(n => ['textarea', 'input'].includes(n.type) && n.props['aria-label'] === '合约样例输入');
  sample.props.onChange({ target: { value: '{}' } });
  await settle();
  await m.h.click('调用合约');
  assert.equal(m.calls.filter(c => c.path === probePath).length, 1, 'verification calls the normal provider route');
  assert.match(JSON.stringify(m.h.find(n => n.props['aria-label'] === '合约调用输出')), /hanamesh.install-target/);
  assert.equal(m.calls.filter(c => ['/hanamesh/library/install', '/apps/open'].includes(c.path)).length, 0, 'showing verification never installs or opens implicitly');
});

test('CM15: an event cursor from before a provider restart reports loss of operation history explicitly', async t => {
  const h = await provider(t);
  const reply = await h.get('/hanamesh/library/events?after=1000');
  assert.equal(reply.status, 200);
  assert.equal(reply.json.resetRequired, true, 'empty events cannot imply an accepted operation completed, failed, or was cancelled');
  assert.equal(reply.json.sequence, 0);
  assert.deepEqual(reply.json.events, []);
  assert.equal(h.calls.length, 0, 'history loss never retries an installation');
});

test('R1 recovery not-needed preserves original install failure and never reports success',async t=>{
 const m=await market(t,{failed:true,recoveryStatus:'not-needed'});await m.h.module.openInstallTarget(appTarget);await settle();await m.h.click('确认安装');await m.clock.advance(1000);assert.match(m.text(),/DSH_PLUGIN_FAILED/);assert.match(m.text(),/安装前状态未被改动/);assert.doesNotMatch(m.text(),/returnt|安装完成/);
});

test('MP03 market failure shows the release-age cause and DSH upgrade action with original diagnostics',async t=>{
 const diagnostic='[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] 3 lockfile entries failed verification:\n @ai-workbench/connect@0.7.37 was published at 2026-10-25T19:37:31.290Z, within the minimumReleaseAge cutoff (2026-10-24T20:22:43.181Z)\n @ai-workbench/remote-agent@0.8.29 was published within the minimumReleaseAge cutoff\n @ai-workbench/workbench@0.1.3 was published within the minimumReleaseAge cutoff';
 const m=await market(t,{failed:true,recoveryStatus:'not-needed',diagnostic});
 await m.h.module.openInstallTarget(appTarget);await settle();await m.h.click('确认安装');await m.clock.advance(1000);
 assert.match(m.text(),/升级 DSH/,'show an actionable upstream fix');
 assert.match(m.text(),/发布时间检查未通过/,'show the actual failure class');
 const alert=m.h.find(n=>n.props?.role==='alert'&&JSON.stringify(n).includes('ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION'));
 assert.ok(alert,'show the exact pnpm category without opening details');
 const visible=JSON.stringify(alert);for(const spec of ['@ai-workbench/connect@0.7.37','@ai-workbench/remote-agent@0.8.29','@ai-workbench/workbench@0.1.3'])assert.ok(visible.includes(spec),'list affected package '+spec+' in the alert');
 assert.match(visible,/默认.*24 小时/,'explain the default age rule without overriding the actual cutoff');
 assert.match(visible,/DSH 0\.2\.0-rc\.2.*pnpm 11\.7\.0.*同名多条白名单只认第一条/);
 assert.match(visible,/DSH 设置/);assert.match(visible,/等待/);assert.match(visible,/cutoff/);
 const details=m.h.find(n=>n.type==='details'&&n.children.some(child=>child?.type==='pre'&&child.children.includes(diagnostic)));
 assert.ok(details,'retain the original package/version/cutoff diagnostic in expandable details');
 assert.equal(m.calls.filter(c=>c.path==='/hanamesh/library/install').length,1,'never retry a policy rejection');
 assert.doesNotMatch(m.text(),/安装完成/);
});

test('MP04 non-policy install failure retains its actual cause without suggesting a DSH upgrade',async t=>{
 const diagnostic='[ERR_PNPM_FETCH_404] package unavailable';const m=await market(t,{failed:true,diagnostic});
 await m.h.module.openInstallTarget(appTarget);await settle();await m.h.click('确认安装');await m.clock.advance(1000);
 assert.ok(m.h.find(n=>n.type==='details'&&n.children.some(child=>child?.type==='pre'&&child.children.includes(diagnostic))),'generic pnpm diagnostics must also reach the person');
 const alert=m.h.find(n=>n.props?.role==='alert'&&JSON.stringify(n).includes('ERR_PNPM_FETCH_404'));assert.ok(alert,'generic pnpm category must be visible outside folded details');
 assert.doesNotMatch(m.text(),/升级 DSH/);
});


test('MD04 uncoded install failure shows its sanitized original phase/type/message in technical details',async t=>{
 const diagnostic='Phase: registry fetch\nTypeError: fixture fetch failed token=[REDACTED]\nCause: Error [ENOTFOUND]: fixture lookup';
 const m=await market(t,{failed:true,recoveryStatus:'not-needed',diagnostic,failureCode:'LIBRARY_OPERATION_FAILED'});
 await m.h.module.openInstallTarget(appTarget);await settle();await m.h.click('确认安装');await m.clock.advance(1000);
 assert.match(m.text(),/LIBRARY_OPERATION_FAILED/);assert.match(m.text(),/安装前状态未被改动/);
 assert.ok(m.h.find(n=>n.type==='details'&&n.children.some(child=>child?.type==='pre'&&child.children.includes(diagnostic))),'the exact safe failure reaches the existing technical-details surface');
 assert.equal(m.calls.filter(c=>c.path==='/hanamesh/library/install').length,1,'no hidden retries');assert.doesNotMatch(m.text(),/发布时间检查未通过/,'an uncoded exception is not reclassified as a pnpm policy failure');
});
