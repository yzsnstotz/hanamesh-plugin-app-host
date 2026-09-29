import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { definition, input, leaseInput, pidAlive, setup, until } from './helpers.mjs';

test('AH-L11: an exited app closes promptly without spending the unused five-second TERM grace', async t => {
  const def = definition({ extra: { descendant: true } });
  def.deployments[0].stopGraceMs = 5_000;
  const { host } = await setup(t, { def });
  const opened = await host.open(input());
  const descendant = await until(async () => Number(await readFile(join(opened.instance.dataDir, 'descendant.pid'), 'utf8')));
  assert(pidAlive(opened.instance.pid));
  assert(pidAlive(descendant));

  const start = performance.now();
  await host.close(leaseInput(opened));
  const elapsed = performance.now() - start;
  assert(elapsed < 1_500, `close spent ${Math.round(elapsed)}ms although the app exited after TERM`);
  assert.equal(host.instance(opened.instance.id).status, 'stopped');
  assert(!pidAlive(opened.instance.pid));
  assert(!pidAlive(descendant), 'stopped still requires confirmed termination of the owned descendant');

  const reopened = await host.open(input('reopened'));
  assert.equal(reopened.instance.status, 'ready', 'runtime lock is released for a subsequent open');
});
