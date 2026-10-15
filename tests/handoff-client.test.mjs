/**
 * Website handoff in the client window (src/client-ui.js loaded the way DSH loads it): the poll uses the interval the
 * host delivers (library.handoff.pollMs), and every failure on this path is reported with its real reason — to the
 * website through the handoff state, to the person through the logged notice — never as 「已取消」 or a silent retry.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const settle = async () => { for (let i = 0; i < 30; i += 1) await Promise.resolve(); };
async function client(routes) {
  const source = await readFile(new URL('../src/client-ui.js', import.meta.url), 'utf8');
  const calls = [], warnings = [], timers = []; let loaded;
  const window = { __ModuleLoader__: { load: module => { loaded = module; } }, self: {}, top: {}, parent: { postMessage() {} } };
  const document = { createElement: () => ({ textContent: '', remove() {} }), head: { append() {} } };
  const fetch = async (path, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : undefined; calls.push([path, body]);
    const route = routes[path.split('?')[0]]; if (!route) return { ok: true, status: 200, json: async () => ({}) };
    const answer = await route(body);
    return { ok: (answer.status ?? 200) < 400, status: answer.status ?? 200, json: async () => answer.json };
  };
  const setTimeoutDouble = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  const scope = { window, document, fetch, location: { hash: '' }, crypto: globalThis.crypto, URLSearchParams, Date,
    console: { warn: (...args) => warnings.push(args.join(' ')), info() {} }, addEventListener() {}, removeEventListener() {} };
  new Function('window', 'document', 'globalThis', 'setTimeout', 'clearTimeout', 'Date', source)(window, document, scope, setTimeoutDouble, () => {}, Date);
  const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }), useState: v => [typeof v === 'function' ? v() : v, () => {}], useEffect() {}, useCallback: fn => fn, useRef: v => ({ current: v }) };
  const module = loaded.factory(() => React);
  const effects = [];
  module.apply({ logger: { warn() {}, info() {} }, reflect: { get: () => undefined }, slots: { inject: (_n, run) => run(), register: () => () => {} },
    effect: run => { const dispose = run(); effects.push(dispose); return dispose; }, provide: () => () => {} });
  await settle();
  return { calls, warnings, timers, dispose: () => { for (const dispose of effects) try { dispose?.(); } catch {} } };
}
const pending = (extra = {}) => ({ json: { handoffs: [{ handoffId: 'h-1', state: 'pending', itemId: 'gone.item', ...extra }], pollMs: 2500, listener: {} } });

test('a confirmation that cannot open is reported to the website as failed with its reason, not as cancelled', async t => {
  const c = await client({
    '/hanamesh/library/handoffs': () => pending(),
    '/hanamesh/library/target': () => ({ status: 404, json: { error: { code: 'CATALOG_ITEM_MISSING' } } }),
    '/hanamesh/library/handoffs/state': () => ({ json: { state: 'failed' } }),
  }); t.after(c.dispose);
  const reports = c.calls.filter(([path]) => path === '/hanamesh/library/handoffs/state').map(([, body]) => body);
  assert.deepEqual(reports, [{ handoffId: 'h-1', state: 'failed', error: { code: 'CATALOG_ITEM_MISSING' } }]);
  assert.ok(c.warnings.some(line => line.includes('确认框打不开') && line.includes('CATALOG_ITEM_MISSING')));
  assert.equal(c.timers.at(-1).ms, 2500, 'the next poll uses the delivered library.handoff.pollMs');
});

test('a shown confirmation is reported shown; a failed report is logged with what the website will see', async t => {
  const c = await client({
    '/hanamesh/library/handoffs': () => pending({ itemId: 'com.hanamesh.utility-plugin' }),
    '/hanamesh/library/target': () => ({ json: { item: { id: 'com.hanamesh.utility-plugin', kind: 'plugin', package: { registry: 'npm', name: '@hanamesh/utility-plugin' } } } }),
    '/hanamesh/library/handoffs/state': () => ({ status: 503, json: { error: { code: 'HANDOFF_UNAVAILABLE' } } }),
  }); t.after(c.dispose);
  assert.deepEqual(c.calls.filter(([path]) => path === '/hanamesh/library/handoffs/state').map(([, body]) => body), [{ handoffId: 'h-1', state: 'shown' }]);
  assert.ok(c.warnings.some(line => line.includes('没能告诉网站「确认框已弹出」') && line.includes('HANDOFF_UNAVAILABLE')), c.warnings.join('\n'));
});

test('a failing poll is logged and keeps polling at the setting default until the host answers', async t => {
  const c = await client({ '/hanamesh/library/handoffs': () => ({ status: 500, json: { error: { code: 'INTERNAL_ERROR' } } }) }); t.after(c.dispose);
  assert.ok(c.warnings.some(line => line.includes('读取交接失败') && line.includes('INTERNAL_ERROR')), c.warnings.join('\n'));
  assert.equal(c.timers.at(-1).ms, 1500);
});
