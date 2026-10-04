import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DSH_TARGET } from '../src/dsh.js';

test('NPM-APPHOST-01: published metadata resolves against official DSH rc.2 without private provision peer', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(DSH_TARGET, '0.2.0-rc.2');
  assert.equal(pkg.hanamesh.dshTarget, DSH_TARGET);
  assert.equal(pkg.peerDependencies['@deepseek-ai/dsh-storage-domain'], '0.2.0-rc.2');
  for (const name of ['@deepseek-ai/dsh-host-webserver', '@deepseek-ai/dsh-client-connection',
    '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-settings', '@deepseek-ai/dsh-client-locale'])
    assert.equal(pkg.peerDependencies[name], '0.2.0-rc.2', name);
  assert.equal(pkg.peerDependencies['@deepseek-ai/cordis'], '~4.0.4');
  assert.equal(pkg.peerDependencies['@deepseek-ai/schemastery'], '~3.18.4');
  assert.equal(pkg.peerDependencies.react, '18.3.1');
  assert.equal(pkg.peerDependencies['@hanamesh/lib-provision'], undefined);
  assert.equal(pkg.dependencies['@hanamesh/lib-provision'], undefined);
});
