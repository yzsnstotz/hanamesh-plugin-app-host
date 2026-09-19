import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as runtime from '../src/runtime.js';
import { setup, input } from './helpers.mjs';

test('AH-K5-1: guardian and launcher use the explicit executable Node runtime', async t => {
  assert.equal(typeof runtime.resolveNodeBinary, 'function');
  assert.equal(typeof runtime.guardianEnvironment, 'function');
  const checkpoints = [];
  const { host } = await setup(t, { nodeBinary: process.execPath, checkpoint: async (point, details) => checkpoints.push({ point, details }) });
  await host.open(input('k5-explicit'));
  const spawned = checkpoints.find(entry => entry.point === 'runtime-spawned')?.details;
  assert.equal(spawned.nodeBinary, process.execPath);
  assert.equal(spawned.guardianBinary, process.execPath);
  assert.equal(spawned.launcherBinary, process.execPath);
});

test('AH-K5-1: internal runtime environment has only the controlled whitelist', async () => {
  assert.equal(typeof runtime.guardianEnvironment, 'function');
  const env = runtime.guardianEnvironment(process.execPath, {
    DSH_HOME: '/tmp/dsh-k5', HOME: '/tmp/home-k5', LANG: 'ja_JP.UTF-8', TMPDIR: '/tmp/k5',
    API_TOKEN: 'must-not-pass', NODE_OPTIONS: '--inspect', PATH: '/untrusted/bin',
  });
  assert.deepEqual(env, {
    DSH_HOME: '/tmp/dsh-k5', HOME: '/tmp/home-k5', LANG: 'ja_JP.UTF-8', TMPDIR: '/tmp/k5',
    PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
  });
});

test('AH-K5-2: Electron self-hosting refuses fallback and persists a failed instance event', async t => {
  assert.equal(typeof runtime.resolveNodeBinary, 'function');
  const { host } = await setup(t);
  const prior = Object.getOwnPropertyDescriptor(process.versions, 'electron');
  Object.defineProperty(process.versions, 'electron', { configurable: true, value: '99.0.0-test' });
  try {
    await assert.rejects(runtime.resolveNodeBinary(), { code: 'NODE_RUNTIME_REQUIRED' });
    await assert.rejects(host.open(input('k5-electron')), { code: 'NODE_RUNTIME_REQUIRED' });
  } finally {
    if (prior) Object.defineProperty(process.versions, 'electron', prior);
    else delete process.versions.electron;
  }
  const failed = host.instanceList().find(instance => instance.errorCode === 'NODE_RUNTIME_REQUIRED');
  assert.equal(failed?.status, 'failed');
  assert(host.eventsSince(0).events.some(event => event.type === 'instance.failed' && event.code === 'NODE_RUNTIME_REQUIRED'));
});

test('AH-K5-2: configured nodeBinary must be absolute and executable', async t => {
  assert.equal(typeof runtime.resolveNodeBinary, 'function');
  await assert.rejects(runtime.resolveNodeBinary('node'), { code: 'NODE_RUNTIME_REQUIRED' });
  const root = await mkdtemp(join(tmpdir(), 'hm-k5-node-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const notExecutable = join(root, 'node');
  await writeFile(notExecutable, '#!/bin/sh\nexit 0\n');
  await chmod(notExecutable, 0o600);
  await assert.rejects(runtime.resolveNodeBinary(notExecutable), { code: 'NODE_RUNTIME_REQUIRED' });
});

test('AH-K5-3: guardian refuses an Electron runtime with exit 78 and a typed event', async () => {
  const guardian = new URL('../src/guardian.js', import.meta.url);
  const preload = new URL('./fixtures/fake-electron.mjs', import.meta.url);
  const child = spawn(process.execPath, ['--import', preload.pathname, guardian.pathname], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  const messages = [];
  child.on('message', message => messages.push(message));
  const exit = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 2_000);
    child.once('error', reject);
    child.once('exit', (code, signal) => { clearTimeout(timer); resolve({ code, signal }); });
  });
  assert.deepEqual(exit, { code: 78, signal: null });
  assert(messages.some(message => message?.type === 'guardian.refused' && message.code === 'NODE_RUNTIME_REQUIRED'));
});
