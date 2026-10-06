// SOURCE / FIXTURE: real Cordis + Connection + AppHost loader + provision code.
// Credentials provider and the application/archive are fresh test fixtures.
// No renderer, product profile, Vibe, OAuth, or model request is exercised here.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as storageJson from '@deepseek-ai/dsh-storage-json';
import * as storageDomain from '@deepseek-ai/dsh-storage-domain';
import WebServer from '@deepseek-ai/dsh-host-webserver';
import * as connectionPlugin from '@deepseek-ai/dsh-client-connection';
import * as appHost from '../../../dist/dsh.js';
import { createLibraryHttpHandler } from '../../../src/library/routes.js';
import { validateDefinition } from '../../../src/descriptor.js';
import { ledger } from '../../../dist/provision/index.js';
import { http, until } from '../../../tests/helpers.mjs';

const output = process.argv[2];
assert.ok(output, 'Pass an absolute JSON evidence output path.');
const root = await realpath(await mkdtemp(join(tmpdir(), 'apphost-contract-')));
const ctx = new Context();
let denyServer;
const receipt = { evidence: ['SOURCE', 'FIXTURE'], root, modelRequests: 0,
  fixtures: ['in-memory credential record provider', 'installed test application', 'local file runtime archive'],
  production: ['Cordis', 'Connection BrowserAuth and admission', 'storage-json/storage-domain',
    'webServer', 'AppHost apply and HTTP routes', 'library service/installer', 'inlined provision rc3'], cases: [] };
try {
  // Only Connection's own generated test signing record is stored here. No env
  // credentials or user records are resolved, copied, or included in output.
  const records = new Map();
  ctx.provide('credentials', {
    async modifyRecord(key, mutate) {
      const next = await mutate(records.get(key));
      if (next !== undefined) records.set(key, next);
      return records.get(key);
    },
    async describe() { return { configured: false, writable: false }; },
    async resolve() { return undefined; },
    async describeRecord() { return { configured: false, writable: false }; },
  });
  ctx.plugin(Storage);
  ctx.plugin(storageJson, { root: join(root, 'storages') });
  ctx.plugin(storageDomain, { backend: 'json' });
  ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 });
  ctx.plugin(connectionPlugin);
  await ctx.start?.();
  await until(() => ctx.get('webServer')?.port > 0 && ctx.get('connection'));
  const origin = `http://127.0.0.1:${ctx.get('webServer').port}`;
  const connection = ctx.get('connection');

  const archiveTree = join(root, 'archive-tree'), archive = join(root, 'runtime.tgz');
  await mkdir(join(archiveTree, 'bin'), { recursive: true });
  const executable = '#!/bin/sh\nexit 0\n';
  await writeFile(join(archiveTree, 'bin', 'fixture'), executable, { mode: 0o755 });
  execFileSync('tar', ['-czf', archive, '-C', archiveTree, 'bin']);
  const archiveSha = createHash('sha256').update(await readFile(archive)).digest('hex');
  const appId = 'request-contract-fixture', packageName = '@hanamesh/app-request-contract-fixture';
  const runtimeItem = 'fixture-runtime', profileDir = join(root, 'profiles', 'contract');
  const dataRoot = join(root, 'app-data');
  const installedDir = join(profileDir, 'node_modules', ...packageName.split('/'));
  await mkdir(installedDir, { recursive: true });
  await writeFile(join(profileDir, 'package.json'), JSON.stringify({ name: 'dsh-profile-contract',
    private: true, dependencies: { [packageName]: '1.0.0' }, dsh: { profile: { bundles: [] } } }));
  await writeFile(join(installedDir, 'package.json'), JSON.stringify({ name: packageName,
    version: '1.0.0', hanamesh: { app: 'app.json' } }));
  const definition = { id: appId, name: 'Request contract fixture', deployments: [{ id: 'local',
    dataId: 'fixture-data', mode: 'owned', args: ['{{port}}', '{{dataDir}}'], env: {}, envAllowlist: [],
    readiness: { path: '/', status: 200, bodyIncludes: 'REQUEST_CONTRACT_FIXTURE' }, runtime: { item: runtimeItem, exec: 'bin/fixture', manifest: {
      schema: 1, sources: [{ id: 'fixture-file', kind: 'file', base: pathToFileURL(root + '/').href }],
      items: [{ id: runtimeItem, version: '1.0.0', kind: 'tar.gz', installTo: 'fixture-runtime',
        platforms: { [`${process.platform}-${process.arch}`]: { asset: 'runtime.tgz', sha256: archiveSha } } }],
    } } }] };
  validateDefinition(definition);
  await writeFile(join(installedDir, 'app.json'), JSON.stringify(definition));
  const fiber = ctx.plugin(appHost, { dataRoot, applications: [definition], nodeBinary: process.execPath,
    library: { profileDir, profileName: 'contract', dshBin: join(root, 'unused-dsh-bin.js'), sources: [] } });
  await until(() => ctx.get('hanameshApps'));

  // Exercise the public token exchange in memory. The process token and cookie
  // stay private to this script; only the redirect status is recorded.
  let exchangeStatus, exchangeHeaders;
  assert.equal(connection.authorizeIndex({ method: 'GET', url: connection.authenticatedUrl(origin + '/'),
    headers: { host: new URL(origin).host } }, {
      writeHead(status, headers) { exchangeStatus = status; exchangeHeaders = headers; }, end() {},
    }), false);
  assert.equal(exchangeStatus, 303);
  const cookie = exchangeHeaders['set-cookie'].split(';')[0];
  receipt.tokenExchangeStatus = exchangeStatus;
  const headers = { origin, cookie, 'content-type': 'application/json', 'x-hanamesh-client': 'workspace-v1' };
  const input = { appId, packageName, runtimeItem };
  const merge = overrides => Object.fromEntries(Object.entries({ ...headers, ...overrides })
    .filter(([, value]) => value !== undefined));
  const getEvents = async () => (await http(origin + '/hanamesh/library/events', { headers })).json.events;
  const before = await http(origin + '/hanamesh/library/installedPlugins', { headers });
  assert.equal(before.status, 200);
  assert.equal(before.json.apps[0].state, 'runtime-missing');
  receipt.installedBefore = before.json.apps[0].state;

  const negativeCases = [
    ['missing-origin', { origin: undefined }, 403, 'CSRF_DENIED', undefined],
    ['custom-scheme-origin', { origin: 'dsh-app://app' }, 403, 'ORIGIN_DENIED', 403],
    ['opaque-origin', { origin: 'null' }, 403, 'ORIGIN_DENIED', 403],
    ['foreign-origin', { origin: 'https://untrusted.example' }, 403, 'ORIGIN_DENIED', 403],
    ['different-loopback-port', { origin: 'http://127.0.0.1:1' }, 403, 'ORIGIN_DENIED', 403],
    ['foreign-host', { host: 'untrusted.example' }, 403, 'HOST_DENIED', 403],
    ['missing-client-marker', { 'x-hanamesh-client': undefined }, 403, 'CSRF_DENIED', undefined],
    ['forged-client-marker', { 'x-hanamesh-client': 'forged' }, 403, 'CSRF_DENIED', undefined],
    ['missing-authentication', { cookie: undefined }, 401, 'UNAUTHENTICATED', 401],
    ['invalid-authentication', { cookie: 'fixture-invalid-cookie=invalid' }, 401, 'UNAUTHENTICATED', 401],
    ['application-frame', { 'sec-fetch-dest': 'iframe' }, 403, 'FRAME_CONTROL_DENIED', undefined],
    ['cross-site-metadata', { 'sec-fetch-site': 'cross-site' }, 401, 'UNAUTHENTICATED', 403],
  ];
  for (const [name, overrides, status, code, connectionRejection] of negativeCases) {
    const requestHeaders = merge(overrides);
    const actualRejection = connection.requestRejection({ headers: { host: new URL(origin).host, ...requestHeaders } });
    assert.equal(actualRejection, connectionRejection, name + ': Connection');
    const response = await http(origin + '/hanamesh/library/provision', {
      method: 'POST', headers: requestHeaders, body: JSON.stringify(input) });
    assert.equal(response.status, status, name);
    assert.equal(response.json.error.code, code, name);
    assert.deepEqual(await getEvents(), [], name + ': operation must not start');
    assert.deepEqual((await ledger(join(dataRoot, 'runtimes', appId))).items, {}, name + ': no ledger');
    receipt.cases.push({ name, status, code, connectionRejection: actualRejection ?? 'admitted', operationsStarted: 0 });
  }
  // Per-operation authorization remains an independent mandatory route seam.
  // This denial callback is a fixture; it is not a claim of multi-user DSH auth.
  let provisionCalls = 0, authorizeCalls = 0;
  denyServer = createServer(createLibraryHttpHandler({ async provision() { provisionCalls++; } }, {
    parentOrigin: origin, ...appHost.browserAuthentication(connection),
    async authorize(subject, path, value) {
      authorizeCalls++;
      assert.equal(subject.principalId, appHost.BROWSER_PRINCIPAL);
      assert.equal(path, '/hanamesh/library/provision'); assert.deepEqual(value, input); return false;
    },
  }));
  await new Promise(resolve => denyServer.listen(0, '127.0.0.1', resolve));
  const denied = await http(`http://127.0.0.1:${denyServer.address().port}/hanamesh/library/provision`, {
    method: 'POST', headers: { ...headers, host: new URL(origin).host }, body: JSON.stringify(input) });
  assert.equal(denied.status, 403); assert.equal(denied.json.error.code, 'FORBIDDEN');
  assert.equal(authorizeCalls, 1); assert.equal(provisionCalls, 0);
  receipt.cases.push({ name: 'denied-operation-authorization', status: 403, code: 'FORBIDDEN',
    authorizeCalls, provisionCalls, evidence: 'FIXTURE route authorization callback' });

  const admission = connection.admit({ headers: { host: new URL(origin).host, ...headers } });
  assert.equal(admission.peer, connection.operator);
  const accepted = await http(origin + '/hanamesh/library/provision', {
    method: 'POST', headers, body: JSON.stringify(input) });
  assert.equal(accepted.status, 202);
  assert.equal(typeof accepted.json.operationId, 'string');
  const completed = await until(async () => (await getEvents()).find(event =>
    event.operationId === accepted.json.operationId && event.type === 'library.provision-done'));
  const book = await ledger(join(dataRoot, 'runtimes', appId));
  assert.equal(book.items[runtimeItem].sha256, archiveSha);
  assert.equal(book.items[runtimeItem].version, '1.0.0');
  const supplied = join(dataRoot, 'runtimes', appId, 'fixture-runtime', 'bin', 'fixture');
  assert.equal(await readFile(supplied, 'utf8'), executable);
  assert.ok((await stat(supplied)).mode & 0o111);
  const after = await http(origin + '/hanamesh/library/installedPlugins', { headers });
  assert.equal(after.json.apps[0].state, 'registered');
  receipt.installedAfter = after.json.apps[0].state;
  receipt.cases.push({ name: 'authenticated-same-origin-provision', status: 202,
    operation: completed.type, ledgerCreatedBy: 'unmodified inlined provision rc3',
    archiveSha256: archiveSha, executableBytesEqual: true, operatorPeerIdentityEqual: true });
  receipt.productionChanges = 0;
  await fiber.dispose();
} finally {
  if (denyServer) await new Promise(resolve => denyServer.close(resolve));
  await ctx.fiber.dispose();
  await rm(root, { recursive: true, force: true });
  receipt.cleanup = { rootRemoved: true, signalsSent: 0 };
  await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
}
console.log(`Contract probe: ${receipt.cases.length} assertions/cases; SOURCE/FIXTURE only; product NOT_RUN.`);
