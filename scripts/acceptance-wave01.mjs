// One-off real DSH profile acceptance. Usage: node scripts/acceptance-wave01.mjs <dsh-rt> <tarball>
// Creates and removes an isolated DSH_HOME. Never prints launch tokens, cookies or lease tokens.
import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, realpath } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const [runtimeDirectory, tarball] = process.argv.slice(2).map(path => resolve(path));
assert(runtimeDirectory && tarball, 'Pass the DSH runtime directory and built tarball.');
const moduleRoot = resolve(import.meta.dirname, '..');
const fixture = join(moduleRoot, 'tests/fixtures/app.mjs');
const dshBin = join(runtimeDirectory, 'node_modules/@deepseek-ai/dsh/lib/bin.js');
const temporaryRoot = await mkdtemp(join(await realpath(tmpdir()), 'hm-app-host-wave01-'));
const dshHome = join(temporaryRoot, 'dsh-home');
const dataRoot = join(dshHome, 'app-data');
const env = { ...process.env, DSH_HOME: dshHome, PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}` };
const evidence = { profile: 'isolated web-derived acc', node: process.version, setup: [], actions: [], cleanup: {} };
const launchedPids = new Set();
let host;

function checkCli(label, args) {
  const result = spawnSync(process.execPath, [dshBin, ...args], {
    cwd: runtimeDirectory, env, encoding: 'utf8', timeout: 120_000,
  });
  evidence.setup.push({ label, exit: result.status, signal: result.signal });
  assert.equal(result.status, 0, `${label} failed (exit ${result.status}, signal ${result.signal ?? 'none'})`);
  return result.stdout;
}
const pause = ms => new Promise(done => setTimeout(done, ms));
async function until(callback, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await callback();
    if (value) return value;
    await pause(100);
  }
  throw new Error('Timed out waiting for a required profile condition.');
}
async function portNumber() {
  const server = createServer();
  await new Promise((done, reject) => server.once('error', reject).listen(0, '127.0.0.1', done));
  const port = server.address().port;
  await new Promise(done => server.close(done));
  return port;
}
function alive(pid) {
  if (!pid) return false;
  try {
    const state = execFileSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' }).trim();
    return Boolean(state) && !state.startsWith('Z');
  } catch { return false; }
}
function fixtureProcesses() {
  const lines = execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).split('\n');
  return lines.filter(line => line.includes(`${process.execPath} ${fixture} `))
    .map(line => Number(line.trim().split(/\s+/)[0]));
}
async function dataFiles() {
  try { return (await readdir(dataRoot, { recursive: true })).filter(path => path.endsWith('runtime-evidence.json') || /write-[^/]+\.txt$/.test(path)); }
  catch { return []; }
}
async function runtimeEvidence() {
  const path = (await dataFiles()).find(path => path.endsWith('runtime-evidence.json'));
  return path ? JSON.parse(await readFile(join(dataRoot, path), 'utf8')) : null;
}
async function endHost() {
  if (!host) return;
  const child = host;
  host = null;
  if (child.exitCode === null && child.signalCode === null) {
    const stopped = new Promise(done => child.once('exit', (code, signal) => done({ code, signal })));
    child.kill('SIGTERM');
    const result = await Promise.race([stopped, pause(10_000).then(() => null)]);
    if (!result) {
      child.kill('SIGKILL');
      await stopped;
      throw new Error('DSH profile did not terminate after SIGTERM.');
    }
    assert.equal(result.code, 0, 'DSH profile did not close cleanly.');
  }
}
async function boot(port) {
  const child = spawn(process.execPath, [dshBin, '--profile', 'acc', '--port', String(port), '--host', '127.0.0.1'], {
    cwd: runtimeDirectory, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  host = child;
  let bootText = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    // This buffer is never logged; it contains the short-lived launch token.
    bootText = (bootText + String(chunk)).slice(-20_000);
  });
  const token = await until(() => {
    if (child.exitCode !== null || child.signalCode !== null) {
      const diagnostic = bootText.split('\n').filter(line => /error|fail|invalid|cannot/i.test(line))
        .map(line => line.replace(/token=[^\s]+/gi, 'token=[REDACTED]')
          .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/"token"\s*:\s*"[^"]+"/gi, '"token":"[REDACTED]"'))
        .slice(-4).join(' | ');
      throw new Error(`DSH profile exited before it announced the web URL. ${diagnostic}`);
    }
    return bootText.match(/[?&]token=([^\s"']+)/)?.[1];
  }, 20_000);
  const origin = `http://127.0.0.1:${port}`;
  const exchanged = await until(async () => {
    try {
      const response = await fetch(`${origin}/?token=${encodeURIComponent(token)}`, { redirect: 'manual' });
      return response.status === 303 ? response : null;
    } catch { return null; }
  });
  const cookie = exchanged.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  assert(cookie, 'Token exchange did not set a browser cookie.');
  return { origin, cookie };
}
async function request(session, path, body) {
  const response = await fetch(session.origin + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      cookie: session.cookie, ...(body === undefined ? {} : {
        origin: session.origin, 'content-type': 'application/json', 'x-hanamesh-client': 'workspace-v1',
      }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, value: await response.json() };
}

try {
  await mkdir(dshHome, { recursive: true });
  checkCli('create profile', ['--profile', 'acc', '--from-default-profile', 'web', '--dump-config']);
  checkCli('install packaged plugin', ['plugin', '--profile', 'acc', 'add', tarball]);
  const patch = `- insert:
    - id: hanamesh-app-host
      name: '@hanamesh/dsh-app-host/dsh'
      config:
        dataRoot: ${JSON.stringify(dataRoot)}
        applications:
          - id: fixture
            name: Fixture application
            singleInstanceOnly: true
            deployments:
              - id: local
                dataId: data-v1
                mode: owned
                embedding: direct
                command: ${JSON.stringify(process.execPath)}
                args: ${JSON.stringify([fixture, 'port={{port}}', 'data={{dataDir}}', 'runtimeId={{runtimeId}}', 'instanceId={{instanceId}}'])}
                readiness:
                  path: /health
                  status: 200
                  bodyIncludes: HANAMESH_FIXTURE
`;
  await writeFile(join(dshHome, 'profiles/acc/cordis.patch.yml'), patch);
  assert(checkCli('compose patched profile', ['--profile', 'acc', '--dump-config']).includes("name: '@hanamesh/dsh-app-host/dsh'"));
  const port = await portNumber();
  let session = await boot(port);
  const listed = await request(session, '/hanamesh/apps');
  assert.equal(listed.status, 200);
  assert.equal(listed.value.apps[0]?.id, 'fixture');

  const openBody = { appId: 'fixture', deploymentId: 'local', viewId: 'v1' };
  const first = await request(session, '/apps/open', openBody);
  assert.equal(first.status, 200);
  const instanceId = first.value.instance.id;
  const v1Token = first.value.leaseToken;
  assert(v1Token);
  const exactSecond = await request(session, '/apps/open', openBody);
  const exactThird = await request(session, '/apps/open', openBody);
  evidence.actions.push({ action: '1 exact checklist repeated Open without token', statuses: [first.status, exactSecond.status, exactThird.status], codes: [null, exactSecond.value.error?.code, exactThird.value.error?.code] });
  assert.notEqual(exactSecond.status, 200, 'Contract unexpectedly accepted anonymous reuse of an existing view.');
  assert.notEqual(exactThird.status, 200, 'Contract unexpectedly accepted anonymous reuse of an existing view.');
  const repeatedSecond = await request(session, '/apps/open', { ...openBody, leaseToken: v1Token });
  const repeatedThird = await request(session, '/apps/open', { ...openBody, leaseToken: v1Token });
  assert.deepEqual([repeatedSecond.status, repeatedThird.status], [200, 200]);
  assert.equal(repeatedSecond.value.instance.id, instanceId);
  assert.equal(repeatedThird.value.instance.id, instanceId);
  const firstReady = await until(async () => {
    const state = await request(session, '/hanamesh/apps');
    return state.value.instances.find(item => item.id === instanceId && item.status === 'ready');
  });
  const originalRuntime = await until(runtimeEvidence);
  launchedPids.add(originalRuntime.pid);
  const initialProcesses = fixtureProcesses();
  assert.deepEqual(initialProcesses, [originalRuntime.pid]);
  evidence.actions.push({ action: '1 token-bearing repeated Open', statuses: [first.status, repeatedSecond.status, repeatedThird.status], instanceIds: [instanceId, repeatedSecond.value.instance.id, repeatedThird.value.instance.id], ready: firstReady.status, processCount: initialProcesses.length, pid: originalRuntime.pid });

  const secondView = await request(session, '/apps/open', { appId: 'fixture', deploymentId: 'local', viewId: 'v2' });
  assert.equal(secondView.status, 200);
  assert.equal(secondView.value.instance.id, instanceId);
  const v2Token = secondView.value.leaseToken;
  assert(v2Token);
  const closeFirst = await request(session, '/apps/close', { viewId: 'v1', leaseToken: v1Token });
  assert.equal(closeFirst.status, 200);
  const afterClose = await request(session, '/hanamesh/apps');
  assert.equal(afterClose.value.instances.find(item => item.id === instanceId)?.status, 'ready');
  assert(alive(originalRuntime.pid));
  evidence.actions.push({ action: '2 two views then close v1', openStatus: secondView.status, closeStatus: closeFirst.status, sameInstance: true, remainingView: afterClose.value.views.find(item => item.viewId === 'v2')?.status, instanceStatus: 'ready', processAlive: true });

  const busyStop = await request(session, '/apps/stop', { instanceId, confirm: false });
  assert.equal(busyStop.status, 409);
  assert.equal(busyStop.value.error?.code, 'INSTANCE_IN_USE');
  assert(busyStop.value.error.details.views.some(view => view.viewId === 'v2'));
  evidence.actions.push({ action: '3 busy Stop', status: busyStop.status, code: busyStop.value.error.code, occupiers: busyStop.value.error.details.views.map(view => view.viewId) });

  await endHost();
  await until(() => !alive(originalRuntime.pid));
  session = await boot(port);
  const restored = await request(session, '/hanamesh/apps');
  assert.equal(restored.status, 200);
  assert(restored.value.instances.some(item => item.id === instanceId));
  const restoredView = restored.value.views.find(item => item.viewId === 'v2');
  assert(restoredView);
  const resumed = await request(session, '/apps/resume', { viewId: 'v2', leaseToken: v2Token });
  assert.equal(resumed.status, 200);
  assert.equal(resumed.value.instance.id, instanceId);
  await until(async () => (await request(session, '/hanamesh/apps')).value.instances.find(item => item.id === instanceId && item.status === 'ready'));
  const newRuntime = await until(async () => {
    const item = await runtimeEvidence();
    return item?.pid !== originalRuntime.pid ? item : null;
  });
  launchedPids.add(newRuntime.pid);
  evidence.actions.push({ action: '4 restart and resume', listStatus: restored.status, sameInstance: true, restoredViewStatus: restoredView.status, resumeStatus: resumed.status, newRuntimePid: newRuntime.pid });

  const files = await dataFiles();
  const runtimeWrites = files.filter(path => /write-[^/]+\.txt$/.test(path));
  assert(runtimeWrites.length >= 1);
  assert(runtimeWrites.every(path => path.includes('fixture/local/data-v1/single/')));
  assert((await Promise.all(runtimeWrites.map(path => readFile(join(dataRoot, path), 'utf8')))).every(value => value.startsWith('Written by runtime ')));
  evidence.actions.push({ action: '5 runtime-written data files', count: runtimeWrites.length, paths: runtimeWrites });
  await endHost();
  await until(() => !alive(newRuntime.pid));
  evidence.cleanup.hostExitZero = true;
  evidence.cleanup.ownedProcessesStopped = true;
  evidence.result = 'PASS_WITH_CHECKLIST_CORRECTION';
} catch (error) {
  evidence.result = 'FAIL';
  evidence.error = error.message;
  process.exitCode = 1;
} finally {
  try { await endHost(); }
  catch (error) { evidence.cleanup.hostShutdownError = error.message; process.exitCode = 1; }
  for (const pid of launchedPids) if (alive(pid)) {
    process.kill(pid, 'SIGTERM');
    evidence.cleanup.exactPidFallback = [...(evidence.cleanup.exactPidFallback ?? []), pid];
  }
  await rm(temporaryRoot, { recursive: true, force: true });
  evidence.cleanup.temporaryProfileRemoved = true;
  console.log(JSON.stringify(evidence, null, 2));
}
