// Actual owned prepare.mts, byte-for-byte, in a hermetic public-port fixture.
// No real upstream preparation, downloads, Electron, signing or OS registration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, writeFile, copyFile, chmod, rm} from 'node:fs/promises';
import {spawnGitSafe as spawnChecked} from '../src/git-process.js';
import {createHash} from 'node:crypto';
import {resolve, join, dirname, relative, isAbsolute} from 'node:path';

async function fixture(t) {
  const card = resolve(import.meta.dirname, '../..');
  const base = resolve(process.env.HANAMESH_APPHOST_RUN_DIR ?? card, 'tmp');
  const rel = relative(card, base);
  assert.ok(rel && !rel.startsWith('..') && !isAbsolute(rel), 'fixture writes stay in this card');
  assert.equal(process.version, 'v24.13.1', 'declared Node toolchain');
  await mkdir(base, {recursive:true});
  const root = await mkdtemp(join(base, 'preparation-stages-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  async function file(path, content) {
    await mkdir(dirname(path), {recursive:true}); await writeFile(path, content);
  }
  const helper = join(root, 'helpers', 'prepare.mts');
  const source = resolve(import.meta.dirname, '../scripts/native-desktop/prepare.mts');
  await mkdir(dirname(helper)); await copyFile(source, helper);
  assert.equal(createHash('sha256').update(await readFile(helper)).digest('hex'),
    createHash('sha256').update(await readFile(source)).digest('hex'), 'execute the actual owned entry unchanged');
  const trace = join(root, 'calls.jsonl');
  const recorder = `import {appendFileSync} from 'node:fs';
const record = value => appendFileSync(process.env.AH_PREPARATION_TRACE, JSON.stringify(value)+'\\n');\n`;
  const scripts = join(root, 'upstream/apps/desktop/scripts');
  await file(join(root, 'upstream/package.json'), JSON.stringify({type:'module'}));
  await file(join(scripts, 'development-project.ts'), recorder +
    `export function prepareDevelopmentProject(options) { record({kind:'project',options}); return options.projectDir; }\n`);
  await file(join(scripts, 'prepare-primary-runtime.ts'), recorder +
    `export async function preparePrimaryRuntime(options = {}) { record({kind:'primary-runtime',options});
       if (!options.deferSmoke) record({kind:'default-smoke'}); }\n`);
  await file(join(scripts, 'development-app.ts'), recorder +
    `export function prepareDevelopmentApp() { record({kind:'app-and-system-registration'}); return 'FIXTURE_ONLY'; }\n`);
  await file(join(scripts, 'desktop-build-paths.mjs'), `export const resolveDesktopBuildTarget = () => 'mac-arm64';\n`);
  await file(join(root, 'upstream/apps/desktop/src/host-protocol.ts'), `export const DESKTOP_HOST_PROTOCOL_VERSION = 1;\n`);
  await file(join(root, 'upstream/apps/desktop/package.json'), JSON.stringify({version:'0.2.1-alpha.2'}));
  await file(join(root, 'upstream/apps/desktop/node_modules/pnpm/package.json'), JSON.stringify({version:'11.28.5'}));
  // This short-lived recorder is ordinary Node, explicitly not Electron. It
  // accepts only the approved version query; it never evaluates arbitrary input.
  const probe = join(root, 'fixture-version-probe.mjs');
  await file(probe, '#!' + process.execPath + '\n' + recorder +
    `record({kind:'version-query',argv:process.argv.slice(2),runAsNode:process.env.ELECTRON_RUN_AS_NODE});
     if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(['-p','process.versions.node']) || process.env.ELECTRON_RUN_AS_NODE !== '1') process.exit(8);
     process.stdout.write(process.versions.node);\n`);
  await chmod(probe, 0o700);
  await file(join(root, 'upstream/apps/desktop/node_modules/electron/package.json'), JSON.stringify({main:'index.cjs'}));
  await file(join(root, 'upstream/apps/desktop/node_modules/electron/index.cjs'), 'module.exports=' + JSON.stringify(probe) + ';\n');
  // Ownership/admission is covered by the separately locked actual-driver
  // suites. This inert gate port records delegation; it grants no real path.
  await file(join(root, 'helpers/lifecycle.py'),
    'import json,os,sys\nwith open(os.environ["AH_PREPARATION_TRACE"],"a") as f: f.write(json.dumps({"kind":"preflight","argv":sys.argv[1:]})+"\\n")\n');
  const env = {PATH:process.env.PATH, CI:'true', PYTHONDONTWRITEBYTECODE:'1',
    AH_PREPARATION_TRACE:trace, DSH_DESKTOP_MAIN_INSPECT_PORT:'54241',
    DSH_DESKTOP_RENDERER_DEBUG_PORT:'54242', DSH_DESKTOP_HOST_INSPECT_PORT:'54243'};
  for (const [key, dir] of Object.entries({HOME:'home',DSH_HOME:'dsh-home',DSH_DESKTOP_USER_DATA_DIR:'userData',
    TMPDIR:'tmp',XDG_CACHE_HOME:'cache',XDG_CONFIG_HOME:'config',XDG_DATA_HOME:'data'})) {
    env[key] = join(root, dir); await mkdir(env[key]);
  }
  return {projectDir:join(root, 'upstream/apps/desktop/.desktop-build/development/project'), async run(args) {
    const result = await spawnChecked(process.execPath, [helper, ...args], {cwd:root, env, encoding:'utf8', stdio:['ignore','pipe','pipe']});
    assert.ifError(result.error); assert.equal(result.signal, null, 'entry exits naturally');
    const calls = (await readFile(trace,'utf8').catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error)))
      .trim().split('\n').filter(Boolean).map(row => JSON.parse(row));
    assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND|SyntaxError|Cannot find module/, 'fixture setup errors cannot be business RED');
    t.diagnostic(JSON.stringify({evidence:'SOURCE_PUBLIC_PORT_FIXTURE_NOT_NATIVE',args,exitCode:result.status,calls}));
    return {result,calls};
  }};
}

test('NP01 explicit project stage stops after project preparation without runtime or app registration', async t => {
  const {result,calls} = await (await fixture(t)).run(['--stage=project']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls.map(row => row.kind), ['preflight','version-query','project'],
    'project boundary must stop before runtime preparation and system registration');
});

test('NP02 independent primary-runtime stage retains default smoke without rebuilding project or registering app', async t => {
  const {result,calls} = await (await fixture(t)).run(['--stage=primary-runtime']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls.map(row => row.kind), ['preflight','primary-runtime','default-smoke'],
    'runtime/default smoke must not rebuild the project, query Electron or execute registration');
});

for (const args of [[], ['--stage=app']]) {
  test(`NP03 preparation requires a supported explicit boundary: ${JSON.stringify(args)}`, async t => {
    const {result,calls} = await (await fixture(t)).run(args);
    assert.notEqual(result.status, 0, 'missing/unsupported boundary must refuse the old all-stage route');
    assert.deepEqual(calls, [], 'reject before preflight, version process or any preparation side effect');
  });
}

test('NP04 an existing unowned project is rejected before the destructive public preparation entry', async t => {
  const h = await fixture(t);
  await mkdir(h.projectDir, {recursive:true});
  const sentinel = join(h.projectDir, 'unowned-original.txt');
  await writeFile(sentinel, 'keep original unknown material\n');
  const {result,calls} = await h.run(['--stage=project']);
  assert.notEqual(result.status, 0, 'unowned existing project must not be passed to a replace-directory API');
  assert.equal(calls.some(row => ['project','primary-runtime','app-and-system-registration'].includes(row.kind)), false,
    'ownership rejection precedes destructive public entries');
  assert.equal(await readFile(sentinel, 'utf8'), 'keep original unknown material\n');
});
