import test from 'node:test';
import assert from 'node:assert/strict';
import { clientHarness, settle } from './fixtures/client-ui-harness.mjs';

test('AH-UI15: Open acknowledges the click while startup is still in flight', async t => {
  let finishOpen;
  const row = { appId: 'example', state: 'registered', packageName: 'example', definition: { deployments: [{ id: 'local' }] } };
  const page = { items: [{ id: 'example', kind: 'application', displayName: 'Example', installed: row }], installed: [row] };
  const receipt = { instance: { id: 'instance-1', appId: 'example', status: 'ready' }, lease: { viewId: 'view-1', generation: 1, expiresAt: Date.now() + 90_000 }, leaseToken: 'token', uiUrl: 'http://127.0.0.1:50001/' };
  const fetch = async path => path.startsWith('/hanamesh/library')
    ? { ok: true, json: async () => page }
    : path === '/apps/open'
      ? new Promise(resolve => { finishOpen = resolve; })
      : { ok: true, json: async () => ({ instance: { status: 'stopped' } }) };
  const client = await clientHarness({ fetch });
  t.after(() => client.unmount());

  await client.click('打开');
  const pending = client.find(node => node.type === 'button' && node.children.includes('打开中…'));
  assert(pending, 'button must respond before the app is ready');
  assert.equal(pending.props.disabled, true);
  finishOpen({ ok: true, json: async () => receipt });
  await settle();
  assert(client.find(node => node.type === 'iframe'), 'the ready app still opens normally');
});

test('AH-UI16: Close acknowledges the click while owned-process cleanup is still in flight', async t => {
  let finishClose;
  const row = { appId: 'example', state: 'registered', packageName: 'example', definition: { deployments: [{ id: 'local' }] } };
  const page = { items: [{ id: 'example', kind: 'application', displayName: 'Example', installed: row }], installed: [row] };
  const receipt = { instance: { id: 'instance-1', appId: 'example', status: 'ready' }, lease: { viewId: 'view-1', generation: 1, expiresAt: Date.now() + 90_000 }, leaseToken: 'token', uiUrl: 'http://127.0.0.1:50001/' };
  const fetch = async path => path.startsWith('/hanamesh/library')
    ? { ok: true, json: async () => page }
    : path === '/apps/open'
      ? { ok: true, json: async () => receipt }
      : path === '/apps/close'
        ? new Promise(resolve => { finishClose = resolve; })
        : { ok: true, json: async () => ({}) };
  const client = await clientHarness({ fetch });
  t.after(() => client.unmount());
  await client.click('打开');
  assert(client.find(node => node.type === 'iframe'));

  await client.click('关闭视图');
  const pending = client.find(node => node.type === 'button' && node.children.includes('关闭中…'));
  assert(pending, 'button must respond while process cleanup is still in flight');
  assert.equal(pending.props.disabled, true);
  finishClose({ ok: true, json: async () => ({ instance: { status: 'stopped' } }) });
  await settle();
  assert(!client.find(node => node.type === 'iframe'));
});
