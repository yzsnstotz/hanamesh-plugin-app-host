// Owned preparation entry. Never prepares an app bundle or starts Desktop.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync, realpathSync, lstatSync, readdirSync, readlinkSync,
  mkdirSync, writeFileSync, unlinkSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve, join, dirname, relative, isAbsolute} from 'node:path';

const args = process.argv.slice(2);
if (args.length !== 1 || !['--stage=project', '--stage=primary-runtime'].includes(args[0])) {
  throw new Error('Required: exactly --stage=project or --stage=primary-runtime. No app/launch stage.');
}
const stage = args[0].slice('--stage='.length);
// This staged helper deliberately has no hidden environment mutation or credential access.
const gitPolicy={GIT_CONFIG_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_COUNT:'2',GIT_CONFIG_KEY_0:'credential.helper',GIT_CONFIG_VALUE_0:'',GIT_CONFIG_KEY_1:'credential.helper',GIT_CONFIG_VALUE_1:'!gh auth git-credential'};
if(Object.entries(gitPolicy).some(([key,value])=>process.env[key]!==value)||process.env.GIT_CONFIG_PARAMETERS||!process.env.GIT_TRACE2_EVENT)throw new Error('GIT_GUARD_REQUIRED: launch via the AppHost scripts/safe-git.mjs runner.');
const root = realpathSync(resolve(import.meta.dirname, '..'));
const upstream = join(root, 'upstream'), app = join(upstream, 'apps/desktop');
function stat(path) {
  try { return lstatSync(path); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
}
function inside(path) {
  const absolute = resolve(path);
  let existing = absolute;
  while (!stat(existing)) existing = dirname(existing);
  const canonical = resolve(realpathSync(existing), relative(existing, absolute));
  const rel = relative(root, canonical);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`OUTSIDE_PREPARATION_ROOT: ${path}`);
  return canonical;
}
const ports = ['DSH_DESKTOP_MAIN_INSPECT_PORT', 'DSH_DESKTOP_RENDERER_DEBUG_PORT',
  'DSH_DESKTOP_HOST_INSPECT_PORT'].map(key => Number(process.env[key]));
if (new Set(ports).size !== 3 || !ports.every(n => Number.isInteger(n) && n > 1024 && n < 65536 && n !== 3080)) {
  throw new Error('Explicit isolated native ports are required.');
}
for (const key of ['HOME', 'DSH_HOME', 'DSH_DESKTOP_USER_DATA_DIR', 'TMPDIR',
  'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME']) {
  if (!process.env[key]) throw new Error(`Explicit isolated ${key} is required.`);
  inside(process.env[key]);
}
for (const key of ['npm_config_cache', 'npm_config_store_dir', 'ZDOTDIR', 'DSH_DESKTOP_PRIMARY_RUNTIME_DIR']) {
  if (process.env[key]) inside(process.env[key]);
}
inside(process.cwd()); inside(upstream); inside(join(app, '.desktop-build')); inside(join(root, 'native'));
execFileSync('/usr/bin/python3', [join(import.meta.dirname, 'lifecycle.py'), 'prepare-check',
  '--root', root, '--ports', ports.join(',')], {env:process.env, stdio:'inherit'});

// Import public preparation functions only after CLI and isolation admission.
const {resolveDesktopBuildTarget} = await import('../upstream/apps/desktop/scripts/desktop-build-paths.mjs');
const target = resolveDesktopBuildTarget();
if (target !== 'mac-arm64' || process.platform !== 'darwin' || process.arch !== 'arm64') {
  throw new Error('This reviewed preparation route requires native mac-arm64.');
}
const build = join(app, '.desktop-build');
const project = join(build, 'development/project');
const runtime = join(build, 'targets', target, 'runtime');
const downloads = join(build, 'downloads');
const resource = stage === 'project' ? project : runtime;
for (const path of [project, runtime, downloads]) inside(path);
const version = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8')).version;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inventory = path => {
  const entries = [];
  function visit(path, name) {
    inside(path);
    const info = lstatSync(path);
    if (info.isSymbolicLink()) {
      const destination = inside(realpathSync(path));
      const manifest = join(destination, 'package.json');
      entries.push({name, type:'link', mode:info.mode, link:readlinkSync(path), destination,
        packageHash:stat(manifest)?.isFile() ? hash(readFileSync(manifest)) : null});
    } else if (info.isDirectory()) {
      entries.push({name, type:'directory', mode:info.mode});
      for (const child of readdirSync(path).sort()) visit(join(path, child), join(name, child));
    } else if (info.isFile()) entries.push({name, type:'file', mode:info.mode, sha256:hash(readFileSync(path))});
    else throw new Error(`UNSUPPORTED_RESOURCE_ENTRY: ${path}`);
  }
  visit(path, '.');
  return entries;
};
const ownerDir = join(root, 'native');
const record = join(ownerDir, `preparation-${stage}.json`);
const reservation = join(ownerDir, 'preparation-reservation.json');
inside(record); inside(reservation);
const identity = {schemaVersion:1, stage, upstream, target, version, resource,
  fixedUpstream:'d743267388641bc76f17c45ce8b4c231aed1d32c',
  helperHash:hash(readFileSync(import.meta.filename)),
  sourceHash:hash(readFileSync(join(app, 'scripts', stage === 'project' ? 'development-project.ts' : 'prepare-primary-runtime.ts')))};
const resourceEntries = () => ({resource:inventory(resource),
  downloads:stage === 'primary-runtime' && stat(downloads) ? inventory(downloads) : null});
function validateMetadata() {
  if (stage === 'project') {
    const descriptor = JSON.parse(readFileSync(join(project, 'desktop-runtime.json'), 'utf8'));
    const manifest = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));
    if (descriptor.schemaVersion !== 1 || descriptor.release.version !== version ||
        descriptor.platform !== 'darwin' || descriptor.arch !== 'arm64' ||
        manifest.name !== '@deepseek-ai/dsh-desktop-runtime' ||
        manifest.dependencies['@deepseek-ai/dsh'] !== version ||
        manifest.dependencies['@deepseek-ai/dsh-desktop-host'] !== version) {
      throw new Error('PREPARED_PROJECT_METADATA_MISMATCH');
    }
    for (const [name, source] of [['dsh', 'cli'], ['dsh-desktop-host', 'desktop-host']]) {
      if (realpathSync(join(project, 'node_modules/@deepseek-ai', name)) !== realpathSync(join(upstream, 'apps', source))) {
        throw new Error('PREPARED_PROJECT_DEPENDENCY_MISMATCH');
      }
    }
  } else {
    const manifest = JSON.parse(readFileSync(join(runtime, 'primary-runtime/runtime.json'), 'utf8'));
    const lock = JSON.parse(readFileSync(join(upstream, 'scripts/primary-runtime/lock.json'), 'utf8'));
    const pnpmVersion = JSON.parse(readFileSync(join(app, 'node_modules/pnpm/package.json'), 'utf8')).version;
    if (manifest.desktopVersion !== version || manifest.platform !== 'darwin' || manifest.arch !== 'arm64' ||
        manifest.node !== lock.nodeVersion || manifest.python !== lock.pythonVersion || manifest.pnpm !== pnpmVersion ||
        !/^[a-f0-9]{64}$/.test(manifest.payloadDigest)) throw new Error('PREPARED_RUNTIME_METADATA_MISMATCH');
  }
}
// No replace-directory API ever receives unknown or inconsistent original data.
let reuse = false;
if (stat(resource)) {
  if (!stat(resource).isDirectory() || !stat(record)?.isFile()) throw new Error(`UNOWNED_PREPARATION_RESOURCE: ${resource}`);
  const prior = JSON.parse(readFileSync(record, 'utf8'));
  if (JSON.stringify(prior.identity) !== JSON.stringify(identity) ||
      JSON.stringify(prior.entries) !== JSON.stringify(resourceEntries())) {
    throw new Error(`PREPARATION_RESOURCE_CHANGED: ${resource}`);
  }
  validateMetadata();
  reuse = true;
} else if (stat(record)) throw new Error(`RECORDED_PREPARATION_RESOURCE_MISSING: ${resource}`);
// The public downloader may remove an invalid cached archive. Preserve unknown
// original cache material by refusing before that downloader can see it.
if (stage === 'primary-runtime' && !reuse && stat(downloads)) {
  throw new Error(`UNOWNED_PREPARATION_DOWNLOAD_CACHE: ${downloads}`);
}
mkdirSync(ownerDir, {recursive:true});
// Fail closed on uncertain exits; a failed preparation keeps this checkpoint.
writeFileSync(reservation, JSON.stringify({identity, pid:process.pid, started:new Date().toISOString()}, null, 2)+'\n', {flag:'wx', mode:0o600});
if (stage === 'project') {
  if (!reuse) {
    const {prepareDevelopmentProject} = await import('../upstream/apps/desktop/scripts/development-project.ts');
    const {DESKTOP_HOST_PROTOCOL_VERSION} = await import('../upstream/apps/desktop/src/host-protocol.ts');
    const require = createRequire(join(app, 'scripts/dev.ts'));
    const pnpmVersion = JSON.parse(readFileSync(join(app, 'node_modules/pnpm/package.json'), 'utf8')).version;
    const nodeVersion = execFileSync(inside(require('electron')), ['-p', 'process.versions.node'], {
      encoding:'utf8', env:{...process.env, ELECTRON_RUN_AS_NODE:'1'},
    }).trim();
    if (!/^\d+\.\d+\.\d+$/.test(nodeVersion)) throw new Error('INVALID_EMBEDDED_NODE_VERSION');
    console.log(JSON.stringify({event:'embedded-node-version', nodeVersion}));
    prepareDevelopmentProject({projectDir:project, cliDir:join(upstream, 'apps/cli'),
      hostDir:join(upstream, 'apps/desktop-host'), dependencyDir:join(upstream, 'node_modules/.pnpm/node_modules'),
      release:{schemaVersion:1, version, hostProtocolVersion:DESKTOP_HOST_PROTOCOL_VERSION, nodeVersion, pnpmVersion}, target});
  }
} else {
  const api = await import('../upstream/apps/desktop/scripts/prepare-primary-runtime.ts');
  if (reuse) api.smokePrimaryRuntime(join(runtime, 'primary-runtime'));
  else await api.preparePrimaryRuntime(); // Keep the upstream's default complete smoke.
}
// Record only resources actually present. A public-port fixture returning no
// resource proves orchestration alone and can never grant ownership for reuse.
const resourcePresent = Boolean(stat(resource));
if (resourcePresent && !reuse) {
  validateMetadata();
  writeFileSync(record, JSON.stringify({identity, entries:resourceEntries()}, null, 2)+'\n', {flag:'wx', mode:0o600});
}
unlinkSync(reservation);
console.log(JSON.stringify({event:'public-preparation-returned', stage, upstream, version, target,
  resource, resourcePresent, reused:reuse, nativeReady:false}));
