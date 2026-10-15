// Owned native driver contract (keychain flags, argv, cwd/symlink/port
// admission, live-child blocking). Runs the driver shipped in this repo
// (scripts/native-desktop/lifecycle.py) against a fixed upstream DSH checkout.
// It needs that checkout, so it is an explicit check (`pnpm run
// test:native-driver`), not part of `pnpm test`. No Electron is started.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, rm, stat} from 'node:fs/promises';
import {spawnGitSafe as spawnChecked} from '../../src/git-process.js';
import {fileURLToPath} from 'node:url';
import {dirname, isAbsolute, resolve} from 'node:path';
import { scratch } from '../helpers.mjs';

const FIXED = 'd743267388641bc76f17c45ce8b4c231aed1d32c';
const NEED = 'AH_DSH_UPSTREAM must be the absolute path of an installed and built DSH checkout at tag dsh-v0.2.1-alpha.2 (' + FIXED + ')';

test('owned native driver satisfies keychain, argv and isolation contracts', async t => {
  const upstream = process.env.AH_DSH_UPSTREAM;
  assert.ok(upstream && isAbsolute(upstream), `NATIVE_TEST_PREPARATION: ${NEED}`);
  assert.ok((await stat(resolve(upstream, 'apps/desktop/scripts/development-app.ts')).catch(() => null))?.isFile(),
    `NATIVE_TEST_PREPARATION: ${NEED}; apps/desktop/scripts/development-app.ts is missing`);
  const git = await spawnChecked('/usr/bin/git', ['-C', upstream, 'rev-parse', 'HEAD'], {encoding: 'utf8'});
  assert.equal(git.stdout.trim(), FIXED, `NATIVE_TEST_PREPARATION: ${NEED}`);
  const diff = await spawnChecked('/usr/bin/git', ['-C', upstream, 'diff', '--name-only'], {encoding: 'utf8'});
  assert.equal(diff.stdout, '', 'NATIVE_TEST_PREPARATION: upstream source must remain unmodified');
  assert.equal(process.version, 'v24.13.1', 'NATIVE_TEST_PREPARATION: Node toolchain');
  const driver = fileURLToPath(new URL('../../scripts/native-desktop/lifecycle.py', import.meta.url));
  const work = await scratch('app-host-native-driver-');
  try {
    for (const dir of ['home', 'dsh-home', 'userData', 'tmp', 'cache', 'scratch']) await mkdir(resolve(work, dir));
    const args = [fileURLToPath(new URL('../../scripts/native-driver-test.py', import.meta.url)),
      '--driver', driver, '--upstream', upstream, '--node', process.execPath, '--scratch', resolve(work, 'scratch')];
    const result = await spawnChecked('/usr/bin/python3', args, {cwd: work, encoding: 'utf8',
      env: {PATH: `${dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`,
        HOME: resolve(work, 'home'), DSH_HOME: resolve(work, 'dsh-home'),
        DSH_DESKTOP_USER_DATA_DIR: resolve(work, 'userData'), TMPDIR: resolve(work, 'tmp'),
        XDG_CACHE_HOME: resolve(work, 'cache'), PYTHONDONTWRITEBYTECODE: '1', CI: 'true'},
      stdio: ['ignore', 'pipe', 'pipe']});
    assert.ifError(result.error);
    t.diagnostic(`${result.stdout ?? ''}${result.stderr ?? ''}`);
    assert.equal(result.signal, null, 'NATIVE_TEST_PREPARATION: Python must finish normally');
    assert.match(result.stderr, /Ran 10 tests in/, 'NATIVE_TEST_PREPARATION: all ten scenarios must execute');
    assert.doesNotMatch(result.stderr, /^ERROR:/m, 'NATIVE_TEST_PREPARATION: driver/setup errors are not business RED');
    assert.equal(result.status, 0, 'NATIVE_DRIVER_CONTRACT_RED: actual Python assertions must pass');
  } finally {
    await rm(work, {recursive: true, force: true});
  }
});
