import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DSH_TARGET } from '../src/dsh.js';

test('NPM-APPHOST-01: published metadata resolves against official DSH rc.2 with external provision source dependency', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(DSH_TARGET, '0.2.0-rc.2');
  assert.equal(pkg.hanamesh.dshTarget, DSH_TARGET);
  assert.equal(pkg.hanamesh.deliveryStatus, undefined);
  assert.equal(pkg.peerDependencies['@deepseek-ai/dsh-storage-domain'], '0.2.0-rc.2');
  for (const name of ['@deepseek-ai/dsh-host-webserver', '@deepseek-ai/dsh-client-connection',
    '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-settings', '@deepseek-ai/dsh-client-locale'])
    assert.equal(pkg.peerDependencies[name], '0.2.0-rc.2', name);
  assert.equal(pkg.peerDependencies['@deepseek-ai/cordis'], '4.0.4');
  assert.equal(pkg.peerDependencies['@deepseek-ai/schemastery'], '3.18.4');
  assert.equal(pkg.peerDependencies.react, '18.3.1');
  assert.equal(pkg.peerDependencies['@hanamesh/lib-provision'], undefined);
  assert.match(pkg.dependencies['@hanamesh/lib-provision'],/^git\+https:\/\/github\.com\/yzsnstotz\/hanamesh-lib-provision\.git#semver:\^0\.2\.\d+(?:-rc\.\d+)?$/);
});

test('NPM-APPHOST-01: actual packed manifest keeps devkit only as a development source range', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'hm-apphost-pack-'));
  try {
    const raw = execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', dir], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, npm_config_cache: join(dir, 'npm-cache') },
      encoding: 'utf8',
    });
    const [{ filename, files }] = JSON.parse(raw);
    const manifest = JSON.parse(execFileSync('tar', ['-xOf', join(dir, filename), 'package/package.json'], { encoding: 'utf8' }));
    const packedFile = path => execFileSync('tar', ['-xOf', join(dir, filename), `package/${path}`], { encoding: 'utf8' });
    assert.equal(manifest.license, 'SEE LICENSE IN LICENSE');
    assert.match(packedFile('LICENSE'), /external.*lib-provision.*not relicensed or bundled/is);
    const licenses = JSON.parse(packedFile('docs/LICENSES.json'));
    assert.equal(licenses.package.version, manifest.version);
    assert.equal(licenses.package.license, manifest.license);
    assert.equal(licenses.components['@hanamesh/lib-provision'].version,JSON.parse(await readFile(new URL(import.meta.resolve('@hanamesh/lib-provision/package.json')),'utf8')).version);
    assert.equal(licenses.components['@hanamesh/lib-provision'].license,'SEE LICENSE IN LICENSE');
    assert.equal(licenses.components['@hanamesh/lib-provision'].source,manifest.dependencies['@hanamesh/lib-provision']);
    assert.ok(files.every(file=>!file.path.startsWith('dist/provision/')));

    for (const field of ['dependencies', 'peerDependencies', 'devDependencies']) {
      for (const [name, version] of Object.entries(manifest[field] ?? {})) {
        assert.equal(licenses.components[name]?.specs?.[field] ?? licenses.components[name]?.version, version, `${name} version`);
        assert.ok(licenses.components[name]?.license, `${name} license`);
        assert.ok(licenses.components[name]?.source, `${name} source`);
        assert.ok(licenses.components[name]?.purpose, `${name} purpose`);
      }
    }
    assert.equal(manifest.hanamesh?.deliveryStatus, undefined);
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies']) {
      for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
        if(field==='devDependencies'&&name==='@hanamesh/devkit')assert.equal(spec,'git+https://github.com/yzsnstotz/hanamesh-server-shared.git#semver:^0.2.0&path:/packages/devkit');
        else assert.doesNotMatch(spec, /^(?:file:|link:)/, `${field}.${name}`);
      }
    }
    assert.ok(Object.keys(manifest.peerDependencies ?? {}).every(name => !name.startsWith('@hanamesh/')));
    assert.equal(manifest.peerDependencies['@hanamesh/devkit'],undefined);
    assert.equal(manifest.peerDependenciesMeta?.['@hanamesh/devkit'],undefined);
    assert.equal(manifest.dependencies['@hanamesh/devkit'],undefined);
    assert.ok(files.every(file => !file.path.startsWith('vendor/')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
