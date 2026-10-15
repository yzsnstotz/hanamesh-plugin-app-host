// §0 of the plan: tests leave no directories in the system temp dir, whether they pass or fail.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { scratch } from './helpers.mjs';

const testsDir = import.meta.dirname;

test('no test makes its own directory in the system temp dir; they all go through scratch()', async () => {
  const offenders = [];
  for (const entry of await readdir(testsDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.m?[jt]s$/.test(entry.name)) continue;
    const path = join(entry.parentPath, entry.name), rel = relative(testsDir, path);
    if (rel === 'helpers.mjs') continue;
    if (/\btmpdir\s*\(/.test(await readFile(path, 'utf8'))) offenders.push(rel);
  }
  assert.deepEqual(offenders, []);
});

test('a failing test process still removes every scratch directory it made', async () => {
  const tmp = await scratch('child-tmp-');
  await mkdir(tmp, { recursive: true });
  const child = spawnSync(process.execPath, ['--test', '--test-reporter=tap', resolve(testsDir, 'fixtures/scratch-failing.mjs')], {
    env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmp }, encoding: 'utf8',
  });
  assert.notEqual(child.status, 0, 'the child test really failed');
  assert.match(child.stdout, /intentional failure/);
  assert.deepEqual(await readdir(tmp), [], 'nothing left in the child TMPDIR');
  await rm(tmp, { recursive: true, force: true });
});
