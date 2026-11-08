import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, dirname, delimiter } from 'node:path';
import {realpathSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import { DSH_TARGET } from '../src/dsh.js';
import { scratch } from './helpers.mjs';

test('NPM-APPHOST-01: published metadata admits official rc.2 and alpha.2 with bundled provision source dependency', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(DSH_TARGET, '>=0.2.0-rc.2 <0.3.0-0 || >=0.2.1-0 <0.3.0-0 || >=0.2.2-0 <0.3.0-0');
  assert.equal(pkg.hanamesh.dshTarget, DSH_TARGET);
  assert.equal(pkg.hanamesh.deliveryStatus, undefined);
  assert.equal(pkg.peerDependencies['@deepseek-ai/dsh-storage-domain'], DSH_TARGET);
  for (const name of ['@deepseek-ai/dsh-host-webserver', '@deepseek-ai/dsh-client-connection',
    '@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-settings', '@deepseek-ai/dsh-client-locale'])
    assert.equal(pkg.peerDependencies[name], DSH_TARGET, name);
  assert.equal(pkg.peerDependencies['@deepseek-ai/cordis'], '>=4.0.4 <4.2.0-0 || >=4.0.5-alpha.1 <4.2.0-0');
  assert.equal(pkg.peerDependencies['@deepseek-ai/schemastery'], '>=3.18.4 <3.20.0-0 || >=3.18.5-alpha.1 <3.20.0-0');
  assert.equal(pkg.peerDependencies.react, '^18.3.1');
  assert.equal(pkg.peerDependencies['@hanamesh/lib-provision'], undefined);
  assert.equal(pkg.dependencies['@hanamesh/lib-provision'],'^0.2.1');
});

test('NPM-APPHOST-01: actual packed manifest keeps devkit development-only and the fixed provision bundled', async () => {
  const dir = await scratch('hm-apphost-pack-');
  try {
    const cache = join(dir, 'npm-cache');
    await mkdir(cache);
    let npmEntry;
    if(process.platform==='win32'){
      for(const directory of [dirname(process.execPath),...(process.env.PATH??process.env.Path??'').split(delimiter)]){try{const candidate=realpathSync(join(directory,'node_modules/npm/bin/npm-cli.js'));if(statSync(candidate).isFile()){npmEntry=candidate;break;}}catch{}}
      assert.ok(npmEntry,'installed npm JavaScript entry must exist; never execute a .cmd via shell');
    }
    const tar=process.platform==='win32'?join(process.env.SystemRoot,'System32/tar.exe'):'tar';
    const raw = execFileSync(npmEntry?process.execPath:'npm', [...(npmEntry?[npmEntry]:[]),'pack', '--ignore-scripts', '--json', '--pack-destination', dir], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, npm_config_cache: cache, NPM_CONFIG_CACHE: cache },
      encoding: 'utf8',
    });
    const [{ filename, files }] = JSON.parse(raw);
    const manifest = JSON.parse(execFileSync(tar, ['-xOf', join(dir, filename), 'package/package.json'], { encoding: 'utf8' }));
    const packedFile = path => execFileSync(tar, ['-xOf', join(dir, filename), `package/${path}`], { encoding: 'utf8' });
    assert.equal(manifest.license, 'SEE LICENSE IN LICENSE');
    assert.match(packedFile('LICENSE'), /lib-provision.*bundled.*not relicensed/is);
    const licenses = JSON.parse(packedFile('docs/LICENSES.json'));
    assert.equal(licenses.package.version, manifest.version);
    assert.equal(licenses.package.license, manifest.license);
    assert.equal(licenses.components['@hanamesh/lib-provision'].version,JSON.parse(await readFile(new URL(import.meta.resolve('@hanamesh/lib-provision/package.json')),'utf8')).version);
    assert.equal(licenses.components['@hanamesh/lib-provision'].license,'SEE LICENSE IN LICENSE');
    assert.equal(licenses.components['@hanamesh/lib-provision'].source,manifest.dependencies['@hanamesh/lib-provision']);
    assert.deepEqual(manifest.bundleDependencies,['@hanamesh/lib-provision']);
    assert.equal(JSON.parse(packedFile('node_modules/@hanamesh/lib-provision/package.json')).version,'0.2.1');
    assert.deepEqual(JSON.parse(packedFile('node_modules/@hanamesh/lib-provision/package.json')).dependencies??{},{});
    const originalLicense=await readFile(new URL('LICENSE',import.meta.resolve('@hanamesh/lib-provision/package.json')));
    assert.deepEqual(Buffer.from(packedFile('node_modules/@hanamesh/lib-provision/LICENSE')),originalLicense);
    assert.ok(files.every(file=>!file.path.startsWith('dist/provision/')));

    for (const field of ['dependencies', 'peerDependencies', 'devDependencies']) {
      for (const [name, version] of Object.entries(manifest[field] ?? {})) {
        assert.equal(licenses.components[name]?.specs?.[field] ?? licenses.components[name]?.version, version, `${name} version`);
        assert.ok(licenses.components[name]?.license, `${name} license`);
        assert.ok(licenses.components[name]?.source, `${name} source`);
        assert.ok(licenses.components[name]?.purpose, `${name} purpose`);
      }
    }
    for (const field of ['dependencies','peerDependencies','optionalDependencies']) assert.equal(manifest[field]?.['@hanamesh/release-platform-gate'],undefined,`release gate must not be ${field}`);
    assert.ok(files.every(file=>!file.path.includes('release-platform-gate')), 'shared development tool must not enter product bytes');
    assert.equal(manifest.hanamesh?.deliveryStatus, undefined);
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies']) {
      for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
        if(field==='devDependencies'&&name==='@hanamesh/devkit')assert.equal(spec,'^0.2.6');
        else if(field==='devDependencies'&&name==='@hanamesh/release-platform-gate')assert.equal(spec,'file:vendor/hanamesh-release-platform-gate-0.1.12.tgz');
        else if(field==='devDependencies'&&name==='@hanamesh/core'){
          assert.equal(spec,'file:vendor/hanamesh-core-0.3.33.tgz');
          const proof=JSON.parse(await readFile(new URL('../vendor/core-fixture.json',import.meta.url),'utf8'));
          assert.equal(proof.repository,'https://github.com/yzsnstotz/hanamesh-core');assert.equal(proof.version,'0.3.33');
          assert.match(proof.commit,/^[a-f0-9]{40}$/);
          assert.equal(createHash('sha256').update(await readFile(new URL('../vendor/hanamesh-core-0.3.33.tgz',import.meta.url))).digest('hex'),proof.sha256);
          assert.ok(files.every(file=>!file.path.includes('hanamesh-core-0.3.33.tgz')));
        }
        else if(field==='dependencies'&&name==='@hanamesh/lib-provision')assert.equal(spec,'^0.2.1');
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
