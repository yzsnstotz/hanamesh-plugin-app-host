// Produce the module-owned verification variant in a fresh card-local staging
// tree. Normal install/prepack/pack policies still apply; no dependency copying.
import {parseArgs} from 'node:util';
import {cp, mkdir, readFile, writeFile, realpath, access} from 'node:fs/promises';
import {resolve, join, relative, isAbsolute, dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const {values} = parseArgs({options: {destination: {type: 'string'}, version: {type: 'string'}}});
if (!values.destination || !/^\d+\.\d+\.\d+-verification\.\d+$/.test(values.version ?? '')) {
  throw new Error('Usage: node scripts/pack-verification.mjs --destination <fresh card directory> --version X.Y.Z-verification.N');
}
const source = resolve(import.meta.dirname, '..'), card = await realpath(resolve(source, '..'));
const destination = resolve(values.destination);
const parent = await realpath(dirname(destination)), rel = relative(card, parent);
if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Verification destination parent must be inside this card.');
try {await access(destination); throw new Error('Verification destination already exists; preserve it.');}
catch (error) {if (error.code !== 'ENOENT') throw error;}
await mkdir(destination);
const producer = join(destination, 'producer');
await mkdir(producer);
for (const name of ['src', 'README.md', 'LICENSE', 'docs', 'schemas', 'profile', 'consistency.json',
  'pnpm-lock.yaml', 'pnpm-workspace.yaml']) await cp(join(source, name), join(producer, name), {recursive: true});
await mkdir(join(producer, 'scripts'));
await cp(join(source, 'scripts/build.mjs'), join(producer, 'scripts/build.mjs'));
const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
manifest.version = values.version;
manifest.scripts = {build: 'node scripts/build.mjs --verification', prepack: 'node scripts/build.mjs --verification'};
await writeFile(join(producer, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
for (const name of ['LICENSES', 'PROVENANCE']) {
  const file = join(producer, 'docs', name + '.json');
  const metadata = JSON.parse(await readFile(file, 'utf8'));
  if (name === 'LICENSES') metadata.package.version = values.version;
  else metadata.currentCandidate.version = values.version;
  await writeFile(file, JSON.stringify(metadata, null, 2) + '\n');
}
const dirs = {HOME: 'home', DSH_HOME: 'dsh-home', DSH_DESKTOP_USER_DATA_DIR: 'userData', TMPDIR: 'tmp',
  XDG_CACHE_HOME: 'cache', XDG_CONFIG_HOME: 'config', XDG_DATA_HOME: 'data',
  npm_config_cache: 'cache/npm', npm_config_store_dir: 'store'};
const env = {PATH: process.env.PATH, CI: 'true', LANG: 'C.UTF-8'};
for (const [key, subdir] of Object.entries(dirs)) {
  env[key] = join(destination, subdir); await mkdir(env[key], {recursive: true});
}
const commands = [];
function run(args) {
  const result = spawnSync('pnpm', args, {cwd: producer, env, stdio: ['ignore', 'inherit', 'inherit']});
  commands.push({command: ['pnpm', ...args], exitCode: result.status, signal: result.signal});
  if (result.error || result.status !== 0) throw result.error ?? new Error(`Normal pnpm ${args[0]} exited ${result.status}`);
}
run(['install', '--frozen-lockfile']);
run(['pack', '--pack-destination', destination]);
const archive = join(destination, `hanamesh-dsh-app-host-${values.version}.tgz`);
const evidence = {kind: 'APPHOST_VERIFICATION_PACKAGE_NOT_U2', version: values.version,
  source, producer, archive, commands, sha256: createHash('sha256').update(await readFile(archive)).digest('hex'),
  clientSHA256: createHash('sha256').update(await readFile(join(producer, 'dist/client-ui.js'))).digest('hex')};
await writeFile(join(destination, 'verification-package.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
