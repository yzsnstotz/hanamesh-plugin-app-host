// Plugin installs through the host's public plugin manager (upstream @deepseek-ai/dsh-plugin-manager installBundle /
// removeBundle): loaded without a restart when upstream reports `applied`; upstream's own `restart-required` and
// failures are carried through. The manager is a stand-in that writes the same profile files pnpm would.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createLibraryInstaller } from '../src/library/install.js';
import { detectClient, containingApp } from '../src/library/client-identity.js';
import { temporary } from './helpers.mjs';

async function profile(t) {
  const dir = await temporary(); t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'profile', dependencies: {}, dsh: { profile: { bundles: [] } } }));
  return dir;
}
function manager(dir, { application = 'applied', fail } = {}) {
  const calls = [];
  return { calls, value: {
    async installBundle(spec, options) {
      calls.push(['install', spec, options]);
      if (fail) return { changed: false, application: 'failed', stage: 'install', target: spec, error: { code: fail } };
      const [name, version] = [spec.slice(0, spec.lastIndexOf('@')), spec.slice(spec.lastIndexOf('@') + 1)];
      const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
      manifest.dependencies[name] = version; manifest.dsh.profile.bundles.push(name);
      await writeFile(join(dir, 'package.json'), JSON.stringify(manifest));
      await mkdir(join(dir, 'node_modules', name), { recursive: true });
      await writeFile(join(dir, 'node_modules', name, 'package.json'), JSON.stringify({ name, version, dsh: { bundle: { patch: './p.yml' } } }));
      return { changed: true, application, stage: 'enable', target: name, bundle: name, version };
    },
    async removeBundle(name) { calls.push(['remove', name]); return { changed: true, application, stage: 'remove', target: name }; },
  } };
}
const registry = version => async () => ({ ok: true, json: async () => ({ version }) });
const item = { id: 'example.notes', package: { registry: 'npm', name: 'example-notes' } };

test('plugin install goes through pluginManager, pins the registry latest exactly, and reports applied', async t => {
  const dir = await profile(t), live = manager(dir), events = [];
  const installer = createLibraryInstaller({ profileDir: dir, profileName: 'desktop', dataRoot: dir, fetchImpl: registry('1.2.3'), pluginManager: () => live.value, emit: e => events.push(e) });
  assert.equal(installer.ready, true); assert.equal(installer.live, true);
  const result = await installer.install(item);
  assert.deepEqual(result, { status: 'applied', kind: 'plugin', packageName: 'example-notes', version: '1.2.3' });
  assert.deepEqual(live.calls, [['install', 'example-notes@1.2.3', { saveExact: true }]]);
  assert.deepEqual(events.map(e => e.type), ['library.install-started', 'library.install-done']);
  assert.deepEqual(await installer.uninstallPlugin({ packageName: 'example-notes' }), { status: 'applied', kind: 'plugin', packageName: 'example-notes' });
});

test('upstream restart-required is reported as such; a failed manager run is an install failure with its code', async t => {
  const dir = await profile(t);
  const later = createLibraryInstaller({ profileDir: dir, profileName: 'desktop', dataRoot: dir, fetchImpl: registry('1.0.0'), pluginManager: () => manager(dir, { application: 'restart-required' }).value });
  assert.equal((await later.install(item)).status, 'restart-required');
  const dir2 = await profile(t), events = [];
  const failing = createLibraryInstaller({ profileDir: dir2, profileName: 'desktop', dataRoot: dir2, fetchImpl: registry('1.0.0'), pluginManager: () => manager(dir2, { fail: 'not-bundle' }).value, emit: e => events.push(e) });
  await assert.rejects(failing.install(item), error => error.code === 'DSH_PLUGIN_FAILED' && error.details.error.code === 'not-bundle' && error.recovery.status === 'not-needed');
  assert.equal(events.at(-1).type, 'library.install-failed');
});

test('without pluginManager or CLI nothing can install, and the CLI path says what it needs', async t => {
  const dir = await profile(t);
  const installer = createLibraryInstaller({ profileDir: dir, profileName: 'desktop', dataRoot: dir, fetchImpl: registry('1.0.0') });
  assert.equal(installer.ready, false); assert.equal(installer.live, false);
  await assert.rejects(installer.install(item), error => error.code === 'DSH_CLI_UNAVAILABLE' && error.details.need.includes('dshBin'));
});

test('client identity comes from the containing app bundle id only', async () => {
  assert.equal(containingApp('/Applications/HanaMesh.app/Contents/Resources/app/runtime'), '/Applications/HanaMesh.app');
  assert.equal(containingApp('/opt/dsh/runtime'), undefined);
  assert.deepEqual(await detectClient({}), { client: 'dsh', evidence: 'not-desktop' });
  const desktop = { runtimeDir: '/Applications/HanaMesh.app/Contents/Resources/app/runtime' };
  assert.deepEqual(await detectClient({ desktop, readBundleId: async () => 'com.hanamesh.desktop' }), { client: 'hanamesh', evidence: 'bundle-id:com.hanamesh.desktop' });
  assert.equal((await detectClient({ desktop, readBundleId: async () => 'com.deepseek.harness' })).client, 'dsh');
  const unreadable = await detectClient({ desktop, readBundleId: async () => { throw Object.assign(new Error('x'), { code: 'ENOENT' }); } });
  assert.deepEqual(unreadable, { client: 'dsh', evidence: 'bundle-id-unreadable:ENOENT' });
});
