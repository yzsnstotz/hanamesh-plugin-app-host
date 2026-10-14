// D-213 SOURCE/HTTP fixture, not real Desktop/U2. The actual producer, Loader
// registration, client apply, slots, market seat and HTTP handler are exercised.
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, cp, readFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';
import {createLibraryHttpHandler} from '../src/library/routes.js';
import {registeredClient} from './fixtures/registered-client-harness.mjs';

const moduleRoot = resolve(import.meta.dirname, '..');
const cardRoot = resolve(moduleRoot, '..');
let buildRoot;
const artifacts = {};
before(async () => {
  // Build a fresh copy of this module's own source with its unchanged actual
  // producer. Do not hand-patch a bundle or force verification props in a harness.
  const scratch = resolve(process.env.HANAMESH_APPHOST_RUN_DIR ?? cardRoot, 'tmp');
  assert.ok(scratch.startsWith(cardRoot + '/'), 'build scratch must belong to this card');
  await mkdir(scratch, {recursive: true});
  buildRoot = await mkdtemp(join(scratch, 'verification-entry-'));
  for (const mode of ['release', 'verification']) {
    const root = join(buildRoot, mode);
    await mkdir(join(root, 'scripts'), {recursive: true});
    await cp(join(moduleRoot, 'src'), join(root, 'src'), {recursive: true});
    await cp(join(moduleRoot, 'scripts/build.mjs'), join(root, 'scripts/build.mjs'));
    const command = ['scripts/build.mjs', ...(mode === 'verification' ? ['--verification'] : [])];
    const result = spawnSync(process.execPath, command, {cwd: root, encoding: 'utf8',
      env: {PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, CI: 'true'}});
    assert.equal(result.status, 0, 'PRODUCER_PREPARATION: existing producer must complete\n' + result.stderr);
    artifacts[mode] = join(root, 'dist/client-ui.js');
    console.log(JSON.stringify({case: 'D213_OWN_PRODUCER', mode, command: [process.execPath, ...command],
      exitCode: result.status, sha256: createHash('sha256').update(await readFile(artifacts[mode])).digest('hex')}));
  }
});
after(async () => {if (buildRoot) await rm(buildRoot, {recursive: true, force: true});});

const target = {itemId: 'example.notes', packageName: 'example-notes', contractVersion: '1'};
const calls = ['GET /hanamesh/library/install-target', 'GET /hanamesh/library',
  'GET /hanamesh/library/target', 'POST /hanamesh/library/install',
  'GET /hanamesh/library/events', 'GET /hanamesh/library/installedPlugins',
  'GET /hanamesh/apps', 'POST /apps/open', 'POST /apps/resume',
  'POST /apps/heartbeat', 'POST /apps/close'];

async function setup(t, mode) {
  const traffic = [], replies = [], pending = new Set(), authorized = [], installs = [];
  const source = {kind: 'fixture', path: 'fixture-catalog.json'};
  const item = {id: target.itemId, displayName: 'Notes fixture', package: {registry: 'npm', name: target.packageName},
    latestVersion: '1.2.3', kind: 'application', installed: null, upgradeAvailable: false};
  const library = {
    installTarget: () => ({client: 'dsh', ready: true, installTarget: {contract: 'hanamesh.install-target',
      contractVersion: '1', supported: ['1'], fragmentPrefix: '#hanamesh-install?'}}),
    installedSnapshot: async () => ({plugins: [], apps: [], restartRequired: false}),
    list: async () => ({source, items: [item], categories: ['hanamesh-app'], installed: [], plugins: [],
      restartRequired: false, page: {}}),
    resolveTarget: async input => {assert.deepEqual({contractVersion: '1', ...input}, target); return {contractVersion: '1', source, item};},
    install: async input => {assert.deepEqual({contractVersion: '1', ...input}, target); installs.push(input); return {status: 'started', operationId: 'fixture-operation'};},
    events: after => ({events: [{sequence: after + 1, at: 1700000000000, type: 'library.install-failed',
      operationId: 'fixture-operation', code: 'DSH_PLUGIN_FAILED', recovery: {status: 'failed', mode: 'new-install',
        stage: 'add', previousVersion: null, actions: [], checks: [], residue: [{item: 'fixture', reason: 'NOT_RESTORED'}]}}],
      sequence: after + 1, operations: [], resetRequired: false}),
  };
  let h, origin;
  const server = createServer();
  t.after(async () => {
    h?.dispose();
    await Promise.allSettled([...pending]);
    console.log(JSON.stringify({case: 'D213_REGISTRATION_HTTP', mode,
      traffic: traffic.map(row => ({method: row.method, url: row.url,
        clientHeader: row.headers['x-hanamesh-client']})), replies, installs}));
    server.closeAllConnections();
    await new Promise(done => server.close(done));
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}`;
  const handler = createLibraryHttpHandler(library, {parentOrigin: origin,
    authenticate: async req => req.headers['x-test-auth'] === 'registered-client-fixture' ? {principalId: 'fixture-client'} : null,
    authorize: async (subject, path, input) => {authorized.push({subject, path, input}); return input.after !== '999';}});
  server.on('request', (req, res) => {traffic.push({url: req.url, method: req.method, headers: req.headers}); void handler(req, res);});
  h = await registeredClient({file: artifacts[mode], href: origin + '/?verification=true',
    fetch(path, init = {}) {
      const task = (async () => {
        // Named authentication fixture at the transport boundary. The request
        // still uses the real loopback server and unchanged provider auth/CSRF.
        const response = await fetch(new URL(path, origin), {...init,
          headers: {...init.headers, origin, 'x-test-auth': 'registered-client-fixture'}});
        replies.push({url: path, status: response.status, body: await response.clone().json()});
        return response;
      })();
      pending.add(task); task.then(() => pending.delete(task), () => pending.delete(task)); return task;
    }});
  async function flush() {
    // Drive scheduled effects and completed HTTP, not a wall-clock retry loop.
    for (let i = 0; i < 30; i++) {await Promise.resolve(); if (pending.size) await Promise.all([...pending]);}
  }
  await flush();
  const find = label => h.find(node => node.props?.['aria-label'] === label);
  async function click(label) {
    const button = h.find(node => node.type === 'button' && node.children.includes(label));
    assert.ok(button, 'visible registered-client button: ' + label); button.props.onClick(); await flush();
  }
  async function choose(call, input) {
    const selector = find('合约调用'); assert.ok(selector, 'VERIFICATION_ENTRY_NOT_WIRED: actual registered test client must expose calls');
    selector.props.onChange({target: {value: call}}); await flush();
    const sample = find('合约样例输入'); assert.ok(sample);
    sample.props.onChange({target: {value: JSON.stringify(input)}}); await flush();
    assert.deepEqual(JSON.parse(find('合约样例输入').props.value), input, 'edited input is retained');
  }
  return {h, find, flush, click, choose, traffic, replies, authorized, installs};
}

test('VE01 test packaging reaches verification via actual apply/sidebar and provided market seat', async t => {
  const m = await setup(t, 'verification');
  m.h.mountSidebar(); await m.flush(); await m.click('市场');
  assert.ok(m.h.rendered.some(props => props.verification === true),
    'VERIFICATION_FLAG_NOT_FORWARDED: test packaging must pass true through actual registered overlay');
  assert.ok(m.find('C-MARKET 合约验证'), 'normal sidebar navigation opens the test verification page');
  m.h.mountMarket({preferredSubsectionId: 'installed'}); await m.flush();
  assert.ok(m.find('C-MARKET 合约验证'), 'the provided market seat preserves the test packaging flag');
  assert.ok(m.find('安装目标开发小界面'));
  assert.equal(m.installs.length, 0, 'entering the test page is read-only');
});

test('VE02 registered test client selects/edits calls and displays complete real HTTP success and rejection', async t => {
  const m = await setup(t, 'verification');
  // Existing C-MARKET test-wrapper API through the seat actually registered by
  // apply, not a direct LibraryOverlay call. VE01/VE05 separately forbid using
  // this explicit prop as a substitute for test packaging's normal navigation.
  m.h.mountMarket({verification: true}); await m.flush();
  const selector = m.find('合约调用');
  assert.ok(selector, 'VERIFICATION_ENTRY_NOT_WIRED: test package normal market entry must expose selector');
  assert.deepEqual(selector.children.flat(Infinity).map(option => option.props.value), calls);
  await m.choose('GET /hanamesh/library/events', {after: 37}); await m.click('调用合约');
  const reply = m.replies.find(row => row.url === '/hanamesh/library/events?after=37');
  assert.ok(reply, 'edited input must reach the actual provider HTTP route');
  assert.equal(reply.status, 200);
  assert.deepEqual(JSON.parse(m.find('合约调用输出').children.join('')), reply.body,
    'show every returned field, including nested recovery, original time and traceId');
  assert.equal(m.traffic.find(row => row.url === reply.url).headers['x-hanamesh-client'], 'workspace-v1');
  assert.ok(m.authorized.some(row => row.path === '/hanamesh/library/events' && row.input.after === '37'));
  await m.choose('GET /hanamesh/library/events', {after: 999}); await m.click('调用合约');
  const denied = m.replies.find(row => row.url === '/hanamesh/library/events?after=999');
  assert.equal(denied.status, 403);
  assert.deepEqual(JSON.parse(m.find('合约调用输出').children.join('')), denied.body,
    'provider rejection remains complete and observable, not replaced with a guessed success');
  assert.equal(m.installs.length, 0);
});

test('VE03 test-panel install selection requires normal confirmation; cancel is inert and confirm posts once', async t => {
  const m = await setup(t, 'verification'); m.h.mountMarket({verification: true}); await m.flush();
  await m.choose('POST /hanamesh/library/install', target); await m.click('调用合约');
  assert.equal(m.installs.length, 0, 'calling install in verification only resolves the target');
  assert.ok(m.find('市场安装确认'), 'normal confirmation is still required');
  await m.click('取消'); assert.equal(m.installs.length, 0);
  await m.choose('POST /hanamesh/library/install', target); await m.click('调用合约');
  await m.click('确认安装'); assert.deepEqual(m.installs.map(input => ({contractVersion: '1', ...input})), [target]);
  assert.equal(m.traffic.filter(row => row.method === 'POST' && row.url === '/hanamesh/library/install').length, 1);
});

test('VE04 default production packaging hides verification and target URL cannot turn it on', async t => {
  const m = await setup(t, 'release'); m.h.mountSidebar(); await m.flush(); await m.click('市场');
  assert.equal(m.find('C-MARKET 合约验证'), undefined); assert.equal(m.find('安装目标开发小界面'), undefined);
  m.h.mountMarket(); await m.flush(); assert.equal(m.find('C-MARKET 合约验证'), undefined);
  m.h.hashchange('#hanamesh-install?' + new URLSearchParams({...target, verification: 'true'})); await m.flush();
  assert.equal(m.find('C-MARKET 合约验证'), undefined); assert.equal(m.find('安装目标开发小界面'), undefined);
  assert.match(JSON.stringify(m.h.tree), /INVALID_INPUT/);
  m.h.hashchange('#hanamesh-install?' + new URLSearchParams(target)); await m.flush();
  assert.ok(m.find('市场安装确认'), 'ordinary production target confirmation remains usable');
  assert.equal(m.find('C-MARKET 合约验证'), undefined); await m.click('取消');
  assert.equal(m.installs.length, 0);
});

test('VE05 test packaging enables its normally provided market seat without caller-injected props', async t => {
  const m = await setup(t, 'verification');
  m.h.mountMarket({preferredSubsectionId: 'installed'}); await m.flush();
  assert.ok(m.find('C-MARKET 合约验证'),
    'VERIFICATION_SEAT_NOT_WIRED: test packaging normal market seat must preserve true automatically');
});
