// SOURCE/FIXTURE only: public location resolution; no installed Desktop/profile or runtime launch.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { resolveLibraryLocations } from '../../../src/library/locate.js';
import { createLibraryService } from '../../../src/library/service.js';

const root = await mkdtemp(join(tmpdir(), 'apphost-public-config-'));
const cases = [];
try {
  const profile = join(root, 'profiles', 'suite');
  const shared = join(root, 'shared', 'app-host');
  await mkdir(join(shared, 'dist'), { recursive: true });
  await mkdir(join(profile, 'node_modules', '@hanamesh'), { recursive: true });
  await writeFile(join(shared, 'package.json'), JSON.stringify({ name: '@hanamesh/dsh-app-host' }));
  await writeFile(join(shared, 'dist', 'dsh.js'), 'export {};\n');
  await writeFile(join(profile, 'package.json'), JSON.stringify({ dependencies: { '@hanamesh/dsh-app-host': '0.2.0-rc.6' } }));
  await symlink(shared, join(profile, 'node_modules', '@hanamesh', 'dsh-app-host'));
  const facts = { moduleUrl: pathToFileURL(join(shared, 'dist', 'dsh.js')).href,
    argv: ['/fixture/electron', '/fixture/host.js'], execPath: '/fixture/electron', versions: { electron: 'fixture' } };
  const inferred = await resolveLibraryLocations({}, facts);
  assert.equal(inferred.profileDir, undefined);
  assert.equal(inferred.profileName, undefined);
  assert.equal(inferred.nodeBinary, undefined);
  assert.equal(inferred.dshBin, undefined);
  cases.push({ name: 'external-store-link-and-electron-do-not-prove-profile-or-node', pass: true });

  const cli = join(profile, 'node_modules', '@deepseek-ai', 'dsh');
  await mkdir(join(cli, 'lib'), { recursive: true });
  // Official CLI rc2 public export shape, not its implementation or an installed product.
  await writeFile(join(cli, 'package.json'), JSON.stringify({ name: '@deepseek-ai/dsh', type: 'module', exports: { './lib/*': './lib/*' } }));
  await writeFile(join(cli, 'lib', 'bin.js'), 'export {};\n');
  const dshBin = createRequire(join(profile, 'package.json')).resolve('@deepseek-ai/dsh/lib/bin.js');
  assert.equal(dshBin, join(cli, 'lib', 'bin.js'));
  cases.push({ name: 'public-profile-relative-cli-export-resolves', pass: true });

  const explicit = await resolveLibraryLocations({ profileDir: profile, profileName: 'suite', dshBin },
    { ...facts, nodeBinary: process.execPath });
  assert.equal(explicit.nodeBinary, process.execPath);
  assert.equal(explicit.profileDir, profile);
  assert.equal(explicit.profileName, 'suite');
  assert.equal(explicit.dshBin, dshBin);
  assert.deepEqual(explicit.inferred, ['sources']);
  cases.push({ name: 'existing-explicit-public-config-wins-under-electron-facts', pass: true });

  const domain = { global: { get: async () => ({ schema: 1, revision: 0, sources: [] }) }, close: async () => {} };
  const library = createLibraryService({ domain, host: {}, config: {}, dataRoot: root });
  await library.init();
  await assert.rejects(library.provision({ appId: 'fixture', packageName: '@fixture/app', runtimeItem: 'fixture-runtime' }),
    error => error.code === 'LIBRARY_INSTALL_UNAVAILABLE' && error.status === 503);
  assert.deepEqual(library.events().events, []);
  await library.close();
  cases.push({ name: 'missing-installer-is-503-with-zero-operations', pass: true });
  const result = { evidenceClass: 'SOURCE/FIXTURE', realDesktop: 'NOT_RUN', realRuntime: 'NOT_RUN', cases };
  await writeFile(process.argv[2], JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify(result) + '\n');
} finally {
  await rm(root, { recursive: true, force: true });
}
