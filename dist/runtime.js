import { spawn, execFile } from 'node:child_process';
import { createServer, request } from 'node:http';
import { readdir, readFile, readlink, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';
import { AppHostError, bounded } from './errors.js';
const exec = promisify(execFile);
export async function resolveNodeBinary(nodeBinary) {
  let selected = nodeBinary;
  if (selected === undefined || selected === null || selected === '') {
    if (process.versions.electron !== undefined) {
      throw new AppHostError('NODE_RUNTIME_REQUIRED', 'Electron hosts must configure an external Node.js executable.');
    }
    // A plain Node host may use itself. This fallback is intentionally unreachable in Electron.
    selected = process.execPath;
  }
  if (typeof selected !== 'string' || !isAbsolute(selected)) {
    throw new AppHostError('NODE_RUNTIME_REQUIRED', 'nodeBinary must be an absolute executable path.');
  }
  try { await access(selected, constants.X_OK); }
  catch { throw new AppHostError('NODE_RUNTIME_REQUIRED', 'nodeBinary must be an absolute executable path.'); }
  return selected;
}
export function guardianEnvironment(nodeBinary, source = process.env) {
  const env = {};
  for (const key of ['DSH_HOME', 'HOME', 'LANG', 'TMPDIR']) {
    if (typeof source[key] === 'string' && source[key].length) env[key] = source[key];
  }
  if (!env.LANG) env.LANG = 'C.UTF-8';
  env.PATH = `${dirname(nodeBinary)}:/usr/bin:/bin`;
  return env;
}
export async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  return port;
}
export function readEndpoint(url, { timeoutMs = 600, limit = 128 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET', headers: { 'accept-encoding': 'identity' } }, res => {
      const chunks = []; let length = 0;
      res.on('data', data => { length += data.length; if (length > limit) req.destroy(new AppHostError('PROBE_TOO_LARGE', 'Readiness response exceeds limit.')); else chunks.push(data); });
      res.once('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
      res.once('error', reject);
    });
    const timer = setTimeout(() => req.destroy(new AppHostError('PROBE_TIMEOUT', 'Readiness probe timed out.')), timeoutMs);
    req.once('close', () => clearTimeout(timer)); req.once('error', reject); req.end();
  });
}

// Verifies that the actual listening socket belongs to the group created by our
// exact child handle. A random HTTP 200 (even with the same app marker) is not ready.
export async function ownsLoopbackPort(pid, port) {
  if (process.platform === 'linux') {
    const table = await readFile('/proc/net/tcp', 'utf8');
    const inodes = new Set(table.trim().split('\n').slice(1).map(line => line.trim().split(/\s+/))
      .filter(cols => cols[1] === `0100007F:${port.toString(16).toUpperCase().padStart(4, '0')}` && cols[3] === '0A')
      .map(cols => cols[9]));
    if (!inodes.size) return false;
    for (const entry of await readdir('/proc')) {
      if (!/^\d+$/.test(entry)) continue;
      try {
        const stat = await readFile(`/proc/${entry}/stat`, 'utf8');
        const rest = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
        if (Number(rest[2]) !== pid) continue; // field 5: pgrp
        for (const fd of await readdir(`/proc/${entry}/fd`)) {
          const target = await readlink(`/proc/${entry}/fd/${fd}`).catch(() => '');
          const match = /^socket:\[(\d+)\]$/.exec(target);
          if (match && inodes.has(match[1])) return true;
        }
      } catch (error) { if (!['ENOENT','ESRCH','EACCES'].includes(error.code)) throw error; }
    }
    return false;
  }
  if (process.platform === 'darwin') {
    let binary;
    for (const path of ['/usr/sbin/lsof','/usr/bin/lsof']) {
      try { await access(path, constants.X_OK); binary = path; break; } catch {}
    }
    if (!binary) throw new AppHostError('PORT_OWNERSHIP_UNAVAILABLE', 'lsof is required to verify socket ownership on macOS.');
    let stdout;
    try { ({ stdout } = await exec(binary, ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-FpgLn'], { timeout: 1_000 })); }
    catch (error) { if (error.code === 1) return false; throw error; }
    const blocks = stdout.split(/(?=^p\d+$)/m);
    return blocks.some(block => block.split('\n').includes(`g${pid}`) && block.includes(`n127.0.0.1:${port}`));
  }
  throw new AppHostError('PLATFORM_UNSUPPORTED', 'Owned process/socket verification currently supports POSIX Linux and macOS only.');
}

export function redact(line, secrets = []) {
  for (const secret of secrets) if (typeof secret === 'string' && secret.length >= 4) line = line.split(secret).join('[REDACTED]');
  return line.replace(/(\bBearer\s+)[^\s"',;]+/gi, '$1[REDACTED]')
    .replace(/((?:token|secret|password|api[_-]?key)\s*[=:]\s*)[^\s&"',;]+/gi, '$1[REDACTED]')
    .replace(/("(?:token|secret|password|api[_-]?key)"\s*:\s*")[^"]*/gi, '$1[REDACTED]');
}
function lineSink(stream, write, secrets) {
  let buffer = '', discarding = false;
  stream.setEncoding('utf8');
  stream.on('data', chunk => {
    for (const part of chunk.split(/(?<=\n)/)) {
      if (!discarding) buffer += part;
      if (buffer.length > 8_192) { buffer = ''; discarding = true; }
      if (part.endsWith('\n')) {
        write(discarding ? '[oversize log line omitted]' : redact(buffer.trimEnd(), secrets));
        buffer = ''; discarding = false;
      }
    }
  });
  stream.once('end', () => { if (buffer && !discarding) write(redact(buffer, secrets)); });
}
export async function spawnOwned(config, { onLog = () => {} } = {}) {
  if (!['linux','darwin'].includes(process.platform)) throw new AppHostError('PLATFORM_UNSUPPORTED', 'Owned runtimes are restricted to POSIX.');
  const nodeBinary = await resolveNodeBinary(config.nodeBinary);
  const launchConfig = { ...config, nodeBinary };
  const guardian = spawn(nodeBinary, [fileURLToPath(new URL('./guardian.js', import.meta.url))], {
    env: guardianEnvironment(nodeBinary),
    stdio: ['ignore','pipe','pipe','ipc'], shell: false,
  });
  const secrets = [...Object.entries(config.env).filter(([key]) => /TOKEN|SECRET|PASSWORD|KEY|AUTH|OAUTH|CREDENTIAL/.test(key)).map(([, value]) => value),
    ...(Array.isArray(config.secrets) ? config.secrets : [])];
  lineSink(guardian.stdout, text => onLog('stdout', text), secrets);
  lineSink(guardian.stderr, text => onLog('stderr', text), secrets);
  let resolveSpawn, rejectSpawn, childPid, groupId, guardianBinary, launcherBinary, appExit, cleanupConfirmed = false;
  const spawned = new Promise((resolve, reject) => { resolveSpawn = resolve; rejectSpawn = reject; });
  const exited = new Promise(resolve => {
    guardian.once('exit', (code, signal) => { rejectSpawn(new AppHostError('SPAWN_FAILED','Guardian exited before application launch.')); resolve(appExit ?? { code, signal }); });
    guardian.once('error', error => { rejectSpawn(error); resolve({ code: null, signal: null, error: error.message }); });
  });
  guardian.on('message', msg => {
    if (msg.type === 'stopped') cleanupConfirmed = true;
    if (msg.type === 'guardian-ready') guardian.send({ type: 'launch', config: launchConfig }, error => { if (error) rejectSpawn(error); });
    if (msg.type === 'guardian.refused') rejectSpawn(new AppHostError(msg.code ?? 'NODE_RUNTIME_REQUIRED', msg.message ?? 'Guardian refused its runtime.'));
    if (msg.type === 'spawned') {
      childPid = msg.pid; groupId = msg.groupId; guardianBinary = msg.guardianBinary; launcherBinary = msg.launcherBinary;
      resolveSpawn(msg.pid);
    }
    if (msg.type === 'app-exit') appExit = { code: msg.code, signal: msg.signal };
    if (msg.type === 'error') rejectSpawn(new AppHostError(msg.code, msg.message));
  });
  let stopping;
  const stop = () => {
    if (stopping) return stopping;
    stopping = (async () => {
      if (guardian.exitCode === null && guardian.signalCode === null) {
      if (guardian.connected) guardian.send({ type: 'stop' }, () => {});
      else guardian.kill('SIGTERM'); // exact owned child handle only
      // Do not SIGKILL the guardian: that could orphan the managed application.
      }
      const result = await bounded(exited, config.stopGraceMs + 5_000, 'Owned process cleanup');
      if (!cleanupConfirmed) throw new AppHostError('CLEANUP_UNCONFIRMED', 'Guardian termination was not accompanied by a confirmed cleanup acknowledgement.');
      return result;
    })();
    return stopping;
  };
  try { await bounded(spawned, 5_000, 'Process spawn'); }
  catch (error) { await stop().catch(() => {}); throw error; }
  return { mode: 'owned', pid: childPid, groupId, guardianPid: guardian.pid, nodeBinary, guardianBinary, launcherBinary, exited, stop,
    isAlive: () => guardian.exitCode === null && guardian.signalCode === null && !appExit };
}
export async function waitReady(origin, readiness, { runtime, timeoutMs, signal }) {
  const deadline = Date.now() + timeoutMs;
  let last = 'No matching response.';
  while (Date.now() < deadline) {
    if (signal.aborted) throw new AppHostError('START_CANCELLED','Launch was cancelled.');
    if (runtime?.mode === 'owned' && !runtime.isAlive()) throw new AppHostError('APP_EXITED','Application exited before readiness.');
    try {
      const result = await readEndpoint(new URL(readiness.path, origin), { timeoutMs: Math.min(600, Math.max(25, deadline - Date.now())) });
      const marker = (!readiness.bodyIncludes || result.body.includes(readiness.bodyIncludes)) &&
        (!readiness.header || result.headers[readiness.header.name.toLowerCase()] === readiness.header.value);
      if (result.status === readiness.status && marker) {
        if (runtime?.mode !== 'owned' || await ownsLoopbackPort(runtime.groupId, Number(new URL(origin).port))) return;
        last = 'The endpoint is not owned by the launched process group.';
      } else last = 'Status or application identity marker did not match.';
    } catch (error) {
      if (['PLATFORM_UNSUPPORTED','PORT_OWNERSHIP_UNAVAILABLE'].includes(error.code)) throw error;
      last = 'The readiness endpoint was unavailable.';
    }
    await new Promise(resolve => setTimeout(resolve, 35));
  }
  throw new AppHostError('READY_TIMEOUT', `Application readiness failed: ${last}`, {}, 504);
}
