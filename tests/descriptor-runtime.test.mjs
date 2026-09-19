import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AppHost, AtomicFileStore, validateDefinition } from '../src/index.js';
import { definition, input, temporary, identity } from './helpers.mjs';

function runtimeDefinition(exec = 'bin/vibe') {
  const app = definition({ id: 'vibe' });
  const deployment = app.deployments[0];
  delete deployment.command;
  deployment.args = ['port={{port}}', 'data={{dataDir}}', 'runtimeId={{runtimeId}}', 'instanceId={{instanceId}}'];
  deployment.runtime = {
    manifest: {
      schema: 1,
      sources: [{ id: 'local', kind: 'file', base: 'file:///tmp/' }],
      items: [{
        id: 'vibe-runtime', version: '0.1.15', kind: 'tar.gz', installTo: 'vibe-runtime',
        platforms: { 'darwin-arm64': { asset: 'vibe.tgz', sha256: 'a'.repeat(64) } },
      }],
    },
    item: 'vibe-runtime', exec,
  };
  return app;
}

test('AH-P01: runtime deployment is valid without command and participates in the definition fingerprint', () => {
  const app = runtimeDefinition();
  const validated = validateDefinition(app);
  assert.equal(validated.deployments[0].runtime.item, 'vibe-runtime');
  assert.equal(validated.deployments[0].runtime.exec, 'bin/vibe');
  assert.throws(() => validateDefinition({ ...app, deployments: [{ ...app.deployments[0], command: '/bin/sh' }] }),
    error => error.code === 'INVALID_RUNTIME');
});

test('AH-P02: runtime item, installTo and exec must remain inside the provisioned tree', () => {
  const wrongItem = runtimeDefinition(); wrongItem.deployments[0].runtime.item = 'missing';
  assert.throws(() => validateDefinition(wrongItem), error => error.code === 'INVALID_RUNTIME');
  for (const exec of ['/bin/vibe', '../vibe', 'bin/../vibe', 'bin\\vibe', 'bin/\0vibe', './vibe', '']) {
    assert.throws(() => validateDefinition(runtimeDefinition(exec)), error => error.code === 'INVALID_RUNTIME', exec);
  }
});

test('AH-P03: host launches the executable selected by the validated runtime and matching ledger', async t => {
  const root = await temporary();
  const dataRoot = join(root, 'data');
  const target = join(dataRoot, 'runtimes', 'vibe', 'vibe-runtime');
  await mkdir(join(target, 'bin'), { recursive: true });
  const launcher = join(target, 'bin', 'vibe');
  const fixture = new URL('./fixtures/app.mjs', import.meta.url).pathname;
  await writeFile(launcher, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(fixture)} "$@"\n`);
  await chmod(launcher, 0o755);
  const host = new AppHost({
    store: new AtomicFileStore(join(root, 'sidecar')), dataRoot,
    parentOrigin: 'http://127.0.0.1:49123', sweepIntervalMs: 0,
    runtimeLedgerReader: async () => ({ schema: 1, items: { 'vibe-runtime': { version: '0.1.15' } } }),
  });
  host.register(runtimeDefinition()); await host.init();
  t.after(async () => host.dispose());
  const opened = await host.open(input('runtime-view', 'vibe'));
  assert.equal(opened.instance.status, 'ready');
  assert.equal((await identity(opened.uiUrl)).dataDir, opened.instance.dataDir);
});

test('AH-P04: missing, stale or non-executable runtime fails closed as RUNTIME_MISSING', async t => {
  for (const scenario of ['missing-ledger', 'stale-ledger', 'missing-exec', 'non-executable']) {
    await t.test(scenario, async () => {
      const root = await temporary(), dataRoot = join(root, 'data');
      const target = join(dataRoot, 'runtimes', 'vibe', 'vibe-runtime', 'bin');
      if (scenario !== 'missing-exec') {
        await mkdir(target, { recursive: true });
        await writeFile(join(target, 'vibe'), '#!/bin/sh\nexit 0\n');
        await chmod(join(target, 'vibe'), scenario === 'non-executable' ? 0o644 : 0o755);
      }
      const items = scenario === 'missing-ledger' ? {} : {
        'vibe-runtime': { version: scenario === 'stale-ledger' ? '0.1.14' : '0.1.15' },
      };
      const host = new AppHost({
        store: new AtomicFileStore(join(root, 'sidecar')), dataRoot,
        parentOrigin: 'http://127.0.0.1:49123', sweepIntervalMs: 0,
        runtimeLedgerReader: async () => ({ schema: 1, items }),
      });
      host.register(runtimeDefinition()); await host.init();
      try { await assert.rejects(host.open(input(`view-${scenario}`, 'vibe')), error => error.code === 'RUNTIME_MISSING'); }
      finally { await host.dispose(); }
    });
  }
});
