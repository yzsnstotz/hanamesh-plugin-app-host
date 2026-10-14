// Q-375: the formal tests/*.test.mjs gate must exercise the actual owned driver.
// Input registration is explicit card-local test preparation, never a fallback
// to a historical launcher or a fabricated copy. No Electron is started here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, realpath, mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';

test('Q375 actual native driver satisfies keychain, argv and isolation contracts', async t => {
  const inputFile = process.env.AH_NATIVE_DRIVER_TEST_INPUTS
    ?? fileURLToPath(new URL('../../native-driver-test-inputs.json', import.meta.url));
  // Preparation failures are labelled separately; only Python business
  // assertions count as native-driver RED. The card prepares this registration
  // before CI=true pnpm test; no helper/dependency is silently substituted.
  const inputs = JSON.parse(await readFile(inputFile, 'utf8'));
  assert.equal(inputs.schema, 'app-host.native-driver-test.v1', 'NATIVE_TEST_PREPARATION: input schema');
  assert.equal(process.version, 'v24.13.1', 'NATIVE_TEST_PREPARATION: Node toolchain');
  const card = await realpath(inputs.cardRoot);
  assert.equal(card, await realpath(fileURLToPath(new URL('../../', import.meta.url))),
    'NATIVE_TEST_PREPARATION: registration belongs to this worktree card');
  async function owned(path) {
    assert.ok(isAbsolute(path), 'NATIVE_TEST_PREPARATION: explicit absolute path required');
    const actual = await realpath(path);
    const rel = relative(card, actual);
    assert.ok(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel),
      'NATIVE_TEST_PREPARATION: input must stay inside this card');
    return actual;
  }
  const driver = await owned(inputs.driver.path);
  const observer = await owned(inputs.exitObserver.path);
  assert.equal(dirname(observer), dirname(driver), 'NATIVE_TEST_PREPARATION: actual helper companion');
  for (const [path, digest] of [[driver, inputs.driver.sha256], [observer, inputs.exitObserver.sha256]]) {
    assert.match(digest, /^[a-f0-9]{64}$/, 'NATIVE_TEST_PREPARATION: registered source digest');
    assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'), digest,
      'NATIVE_TEST_PREPARATION: registered actual helper changed');
  }
  const upstream = await owned(inputs.upstream);
  const scratchRoot = await owned(inputs.scratchRoot);
  const git = spawnSync('/usr/bin/git', ['-C', upstream, 'rev-parse', 'HEAD'], {encoding: 'utf8'});
  assert.equal(git.status, 0, 'NATIVE_TEST_PREPARATION: upstream checkout available');
  assert.equal(git.stdout.trim(), 'd743267388641bc76f17c45ce8b4c231aed1d32c',
    'NATIVE_TEST_PREPARATION: fixed upstream');
  const diff = spawnSync('/usr/bin/git', ['-C', upstream, 'diff', '--name-only'], {encoding: 'utf8'});
  assert.equal(diff.status, 0, 'NATIVE_TEST_PREPARATION: upstream source verification');
  assert.equal(diff.stdout, '', 'NATIVE_TEST_PREPARATION: upstream source remains unmodified');
  const work = await mkdtemp(resolve(scratchRoot, 'formal-driver-'));
  try {
    for (const dir of ['home', 'dsh-home', 'userData', 'tmp', 'cache', 'scratch']) {
      await mkdir(resolve(work, dir));
    }
    const args = [fileURLToPath(new URL('../scripts/native-driver-test.py', import.meta.url)),
      '--driver', driver, '--upstream', upstream, '--node', process.execPath,
      '--scratch', resolve(work, 'scratch')];
    const result = spawnSync('/usr/bin/python3', args, {cwd: work, encoding: 'utf8',
      env: {PATH: `${dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`,
        HOME: resolve(work, 'home'), DSH_HOME: resolve(work, 'dsh-home'),
        DSH_DESKTOP_USER_DATA_DIR: resolve(work, 'userData'), TMPDIR: resolve(work, 'tmp'),
        XDG_CACHE_HOME: resolve(work, 'cache'), PYTHONDONTWRITEBYTECODE: '1', CI: 'true'},
      stdio: ['ignore', 'pipe', 'pipe']});
    const evidence = {inputFile, driver, upstream, command: ['/usr/bin/python3', ...args],
      exitCode: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr,
      nativeStarted: false};
    await writeFile(resolve(scratchRoot, `${work.split(sep).at(-1)}.json`), JSON.stringify(evidence, null, 2));
    assert.ifError(result.error);
    assert.equal(result.signal, null, 'NATIVE_TEST_PREPARATION: Python must finish normally');
    t.diagnostic(`${result.stdout ?? ''}${result.stderr ?? ''}`);
    assert.match(result.stderr, /Ran 10 tests in/, 'NATIVE_TEST_PREPARATION: all ten scenarios must execute');
    assert.doesNotMatch(result.stderr, /^ERROR:/m, 'NATIVE_TEST_PREPARATION: driver/setup errors are not business RED');
    assert.equal(result.status, 0, 'NATIVE_DRIVER_CONTRACT_RED: actual Python assertions must pass');
  } finally {
    await rm(work, {recursive: true, force: true});
  }
});
