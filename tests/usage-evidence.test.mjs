/**
 * rc.27 usage evidence (STATUS `P2-USE-EVENTS`): app-host reports `open` / `use` through the OPTIONAL usage
 * record seat. Real AppHost + real fixture app behind the real gateway; the seat is a fake that records what it
 * was asked. Evidence class: REAL_HOST for the host/gateway, seat is a contract double of
 * `@hanamesh/dsh-usage` `record()` (hanamesh-usage/src/host/record.js).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { connect } from 'node:net';
import { AppHost, AtomicFileStore, createUsageEvidence, createReceiptLedger, hourBucket, SOURCE_PLUGIN, validateDefinition } from '../src/index.js';
import { definition, temporary, http, input, leaseInput, parentOrigin, until } from './helpers.mjs';

/** The exact acceptance rules of usage's record seat: input shape, hanaRef/sourcePlugin as npm names, key ≤ 160 safe chars, ISO occurredAt. */
const hana = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i;
const safeKey = value => typeof value === 'string' && value.length > 0 && value.length <= 160 && /^[A-Za-z0-9][A-Za-z0-9._:@/+\-]*$/.test(value);
function fakeSeat({ consent = 'granted', mode = 'ok' } = {}) {
  const calls = [], seen = new Set();
  return { calls, record: async input => {
    calls.push(structuredClone(input));
    if (mode === 'throw') throw new Error('seat exploded');
    if (mode === 'reject') return { disposition:'rejected', code:'RECORD_FAILED' };
    if (consent !== 'granted') return { disposition:'withheld' };
    const keys = Object.keys(input);
    assert.deepEqual(keys.filter(k => !['hanaRef','action','occurredAt','idempotencyKey','sourcePlugin','sourceHanaRef','targetRef','receipt'].includes(k)), []);
    if ('receipt' in input) { assert.equal(input.action,'use'); assert.deepEqual(Object.keys(input.receipt).sort(),['count','model','providerId']); assert(Number.isInteger(input.receipt.count) && input.receipt.count >= 1); }
    if ('targetRef' in input) assert.match(input.targetRef,/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/);
    assert(hana.test(input.hanaRef) && input.hanaRef.length <= 128, 'hanaRef must be an npm package name');
    assert(hana.test(input.sourcePlugin), 'sourcePlugin must be an npm package name');
    assert(['open','use'].includes(input.action)); assert(safeKey(input.idempotencyKey), 'idempotencyKey shape');
    assert.equal(new Date(Date.parse(input.occurredAt)).toISOString(), input.occurredAt, 'occurredAt must be canonical ISO');
    const id = `${input.sourcePlugin}|${input.idempotencyKey}`;
    if (seen.has(id)) return { disposition:'duplicate', eventId:id };
    seen.add(id); return { disposition:'recorded', eventId:id };
  } };
}
const GATE = { embedding:'gateway' };
async function hostWith(t, { def = definition(GATE), seat, clock, logger, receipts } = {}) {
  const dir = await temporary();
  const host = new AppHost({ store:new AtomicFileStore(join(dir,'sidecar')), dataRoot:join(dir,'data'), parentOrigin, leaseTtlMs:3_600_000, sweepIntervalMs:0, clock });
  host.register(def); await host.init();
  const evidence = createUsageEvidence({ host, seat, logger, receipts, clock, sweepIntervalMs:0 });
  t.after(async () => { evidence.close(); await host.dispose(); await rm(dir,{ recursive:true, force:true }); });
  return { host, evidence, dir };
}
/** Consume the bootstrap ticket like the workspace iframe does; returns the app origin + the grant cookie. */
async function enter(receipt) {
  const boot = await http(receipt.uiUrl,{ headers:{ referer:parentOrigin+'/', 'sec-fetch-dest':'iframe' } });
  assert.equal(boot.status,303);
  return { origin:new URL(receipt.uiUrl).origin, cookie:boot.headers['set-cookie'][0].split(';')[0] };
}
const byAction = (calls, action) => calls.filter(c => c.action === action);

test('AH-U01: open is recorded once per instance reaching ready; hanaRef is the app package name; sourcePlugin is app-host', async t => {
  const seat = fakeSeat();
  const def = { ...definition(GATE), packageName:'@hanamesh/app-example' };
  const { host, evidence } = await hostWith(t,{ def, seat:() => seat });
  const a = await host.open(input('view-a')); await evidence.settle();
  const opens = byAction(seat.calls,'open');
  assert.equal(opens.length,1);
  assert(Math.abs(Date.parse(opens[0].occurredAt) - a.instance.updatedAt) < 1_000, 'occurredAt is the ready time');
  assert.deepEqual({ ...opens[0], occurredAt:undefined },{ hanaRef:'@hanamesh/app-example', action:'open', occurredAt:undefined,
    idempotencyKey:`open:example:${a.instance.id}`, sourcePlugin:SOURCE_PLUGIN });
  assert.equal(SOURCE_PLUGIN,'@hanamesh/dsh-app-host');
  // A second view on the same (single) instance is not a second open; nothing else is recorded either.
  await host.open(input('view-b')); await evidence.settle();
  assert.equal(seat.calls.length,1);
  // Stop → open again = a new launch of the same slot: `open` fires again, same key → usage answers `duplicate`
  // (a repeat is the seat's call, not ours to suppress); a fresh instance gets a fresh key.
  await host.close(leaseInput(a)); await host.stop(a.instance.id,{ confirm:true });
  const again = await host.open(input('view-c')); await evidence.settle();
  assert.equal(again.instance.id,a.instance.id);
  assert.equal(byAction(seat.calls,'open').length,2);
  assert.equal(host.list().apps[0].packageName,'@hanamesh/app-example');
});

test('AH-U02: use is one per app per UTC hour of real gateway activity, reported when the hour closes; bootstrap, denials and 401/403 answers never count', async t => {
  const seat = fakeSeat(); let now = Date.UTC(2026,8,21,10,15,0);
  const def = { ...definition(GATE), packageName:'@hanamesh/app-example' };
  const { host, evidence } = await hostWith(t,{ def, seat:() => seat, clock:() => now });
  const a = await host.open(input('view-a')); await evidence.settle();
  assert.equal(byAction(seat.calls,'use').length,0,'readiness probes and the open itself are not use');
  const { origin, cookie } = await enter(a);
  await evidence.settle(); assert.equal(byAction(seat.calls,'use').length,0,'the bootstrap 303 is not use');
  // Denied requests (no cookie, foreign origin, top-level navigation) never reach the app and never count.
  assert.equal((await http(origin+'/')).status,403);
  assert.equal((await http(origin+'/',{ headers:{ cookie, origin:'https://attacker.invalid' } })).status,403);
  assert.equal((await http(origin+'/',{ headers:{ cookie, 'sec-fetch-dest':'document' } })).status,403);
  // The app's own 401/403 answers do not count either.
  assert.equal((await http(origin+'/forbidden',{ headers:{ cookie } })).status,403);
  assert.equal((await http(origin+'/unauthorized',{ headers:{ cookie } })).status,401);
  await evidence.settle(); assert.equal(byAction(seat.calls,'use').length,0); assert.equal(evidence.receipts.list().length,0);
  // Real forwarded requests count in the local ledger; the hour is still open, so nothing reaches the seat yet.
  assert.equal((await http(origin+'/',{ headers:{ cookie } })).status,200);
  now += 20*60_000; await host.heartbeat(leaseInput(a));
  for (const path of ['/second','/headers','/data']) assert.equal((await http(origin+path,{ headers:{ cookie } })).status,200);
  await evidence.settle();
  assert.equal(byAction(seat.calls,'use').length,0,'the running hour is not reported yet');
  assert.deepEqual(evidence.receipts.list().map(r => ({ hour:r.hour, count:r.count, providerId:r.providerId, reported:r.reported })),[{ hour:'2026092110', count:4, providerId:null, reported:false }]);
  assert.equal(hourBucket(Date.UTC(2026,8,21,10,15,0)),'2026092110');
  // Next UTC hour: the first request closes hour 10 → exactly one `use`, timestamped at hour 10's first request, targetRef = appId.
  now = Date.UTC(2026,8,21,11,0,1); await host.heartbeat(leaseInput(a));
  assert.equal((await http(origin+'/',{ headers:{ cookie } })).status,200); await evidence.settle();
  let uses = byAction(seat.calls,'use');
  assert.equal(uses.length,1);
  assert.deepEqual(uses[0],{ hanaRef:'@hanamesh/app-example', action:'use', occurredAt:'2026-09-21T10:15:00.000Z',
    idempotencyKey:'use:example:2026092110', sourcePlugin:SOURCE_PLUGIN, targetRef:'example' });
  assert.equal(evidence.receipts.list().find(r => r.hour === '2026092110').reported,true);
  // More traffic in hour 11 accumulates locally only.
  for (const path of ['/','/second']) assert.equal((await http(origin+path,{ headers:{ cookie } })).status,200);
  await evidence.settle(); assert.equal(byAction(seat.calls,'use').length,1);
  // A WebSocket upgrade is activity too.
  now = Date.UTC(2026,8,21,12,0,0); await host.heartbeat(leaseInput(a));
  const u = new URL(origin);
  await new Promise((resolve,reject) => {
    const socket = connect(Number(u.port),u.hostname); const timer = setTimeout(() => { socket.destroy(); reject(new Error('ws timeout')); },3000);
    socket.on('connect',() => socket.write(`GET /socket HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\nCookie: ${cookie}\r\nOrigin: ${origin}\r\n\r\n`));
    socket.on('data',() => { clearTimeout(timer); socket.destroy(); resolve(); }); socket.on('error',reject);
  });
  await until(async () => { await evidence.settle(); return byAction(seat.calls,'use').length === 2; });
  uses = byAction(seat.calls,'use');
  assert.deepEqual([uses[1].idempotencyKey,uses[1].occurredAt],['use:example:2026092111','2026-09-21T11:00:01.000Z']);
  assert.equal(evidence.receipts.list().find(r => r.hour === '2026092112').count,1,'the upgrade counted in hour 12');
  // The app's last live instance stops → the running hour (12) is reported right away.
  await host.close(leaseInput(a)); await host.stop(a.instance.id,{ confirm:true });
  await until(async () => { await evidence.settle(); return byAction(seat.calls,'use').length === 3; });
  assert.equal(byAction(seat.calls,'use')[2].idempotencyKey,'use:example:2026092112');
  assert.ok(evidence.receipts.list().every(r => r.reported));
  assert.equal(evidence.receipts.routeOf(a.instance.id),null);
});

test('AH-U03: no seat → nothing recorded, no throw; a seat that appears later is used from then on', async t => {
  let seat; const debug = [];
  const def = { ...definition(GATE), packageName:'@hanamesh/app-example' };
  const { host, evidence } = await hostWith(t,{ def, seat:() => seat, logger:{ debug:(...args) => debug.push(args[0]) } });
  const a = await host.open(input('view-a')); const { origin, cookie } = await enter(a);
  assert.equal((await http(origin+'/',{ headers:{ cookie } })).status,200); await evidence.settle();
  assert(debug.some(line => /seat absent/.test(line)));
  // Incompatible values are treated as absent.
  seat = { notRecord:true }; await host.close(leaseInput(a)); await host.stop(a.instance.id,{ confirm:true });
  const b = await host.open(input('view-b')); await evidence.settle();
  seat = fakeSeat(); await host.close(leaseInput(b)); await host.stop(b.instance.id,{ confirm:true });
  const c = await host.open(input('view-c')); await evidence.settle();
  assert.equal(byAction(seat.calls,'open').length,1); assert.equal(byAction(seat.calls,'open')[0].idempotencyKey,`open:example:${c.instance.id}`);
});

test('AH-U04: a rejecting, throwing or withholding seat never breaks the launch or the proxied request', async t => {
  for (const mode of ['throw','reject']) {
    const seat = fakeSeat({ mode }); const debug = [];
    const def = { ...definition(GATE), packageName:'@hanamesh/app-example' };
    const { host, evidence } = await hostWith(t,{ def, seat:() => seat, logger:{ debug:(...args) => debug.push(args) } });
    const a = await host.open(input('view-'+mode)); assert.equal(a.instance.status,'ready');
    const { origin, cookie } = await enter(a);
    const r = await http(origin+'/',{ headers:{ cookie } }); assert.equal(r.status,200); assert(r.body.toString().includes('HANAMESH_FIXTURE'));
    await host.close(leaseInput(a)); await host.stop(a.instance.id,{ confirm:true });
    await until(async () => { await evidence.settle(); return seat.calls.length === 2; }); // open + use were attempted, failures stayed with the seat
    assert(debug.length >= 2, 'failures are debug-logged, not thrown');
    assert.equal(evidence.receipts.list()[0].reported,false,'a rejected / thrown use stays unreported and is retried later');
  }
  // A synchronously throwing record() (not even a promise) is contained as well.
  const sync = { record: () => { throw new Error('sync'); } };
  const { host } = await hostWith(t,{ def:{ ...definition(GATE), packageName:'@hanamesh/app-example' }, seat:() => sync });
  const a = await host.open(input('view-sync')); assert.equal(a.instance.status,'ready');
  // Consent withheld is a normal disposition: recorded by nobody, logged at debug only.
  const withheld = fakeSeat({ consent:'withheld' }); const lines = [];
  const w = await hostWith(t,{ def:{ ...definition(GATE), packageName:'@hanamesh/app-example' }, seat:() => withheld, logger:{ debug:(...args) => lines.push(args.join(' ')) } });
  await w.host.open(input('view-w')); await w.evidence.settle();
  assert.equal(withheld.calls.length,1); assert(lines.some(line => /withheld/.test(line)));
});

test('AH-U05: hanaRef comes from the package — definition packageName, else the installed-scan binding, else no evidence', async t => {
  // Definition without packageName and nothing bound: no evidence for that app, launch unaffected.
  const seat = fakeSeat(); const debug = [];
  const { host, evidence } = await hostWith(t,{ seat:() => seat, logger:{ debug:(...args) => debug.push(args[0]) } });
  const a = await host.open(input('view-a')); await evidence.settle();
  assert.equal(seat.calls.length,0); assert(debug.some(line => /no package name/.test(line)));
  assert.equal(host.packageName('example'),null); assert.equal(host.list().apps[0].packageName,null);
  // The installed scan binds appId → package (before or after register); evidence resumes with that hanaRef.
  host.bindPackageName('example','@hanamesh/app-vibe-trading');
  assert.equal(host.packageName('example'),'@hanamesh/app-vibe-trading');
  await host.close(leaseInput(a)); await host.stop(a.instance.id,{ confirm:true });
  await host.open(input('view-b')); await evidence.settle();
  assert.equal(seat.calls.length,1); assert.equal(seat.calls[0].hanaRef,'@hanamesh/app-vibe-trading');
  // Binding is validated like the seat validates hanaRef; a definition-declared name wins over a binding.
  assert.throws(() => host.bindPackageName('example','Not A Package'),{ code:'INVALID_PACKAGE_NAME' });
  assert.throws(() => host.bindPackageName('../x','@hanamesh/app-x'),{ code:'INVALID_ID' });
  host.register({ ...definition({ id:'declared', ...GATE }), packageName:'@hanamesh/app-declared' });
  host.bindPackageName('declared','@hanamesh/app-other');
  assert.equal(host.packageName('declared'),'@hanamesh/app-declared');
  // Unknown apps have no package; the definition validator rejects malformed package names.
  assert.equal(host.packageName('nobody'),null);
  assert.throws(() => validateDefinition({ ...definition(), packageName:'@Bad/Name' }),{ code:'INVALID_DEFINITION' });
  // Exactly the shape usage's `validHana` accepts: an npm name, scoped or not — `owner/repo` (bare slash) is not one.
  assert.throws(() => validateDefinition({ ...definition(), packageName:'owner/repo' }),{ code:'INVALID_DEFINITION' });
  assert.equal(validateDefinition({ ...definition(), packageName:'vibe-trading' }).packageName,'vibe-trading');
});

test('AH-U06: multiple instances of one app share the hour at the seat; the hour is reported once the last live instance stops', async t => {
  const seat = fakeSeat(); let now = Date.UTC(2026,8,21,9,0,0);
  const def = { ...definition({ single:false, ...GATE }), packageName:'@hanamesh/app-multi' };
  const { host, evidence } = await hostWith(t,{ def, seat:() => seat, clock:() => now });
  const a = await host.open(input('view-a')), b = await host.open(input('view-b'));
  assert.notEqual(a.instance.id,b.instance.id); await evidence.settle();
  assert.deepEqual(byAction(seat.calls,'open').map(c => c.idempotencyKey).sort(),[`open:example:${a.instance.id}`,`open:example:${b.instance.id}`].sort());
  const ea = await enter(a), eb = await enter(b);
  assert.equal((await http(ea.origin+'/',{ headers:{ cookie:ea.cookie } })).status,200);
  assert.equal((await http(eb.origin+'/',{ headers:{ cookie:eb.cookie } })).status,200);
  await evidence.settle();
  // One ledger row per (app, hour): both instances' requests count together; nothing reported while both run.
  assert.deepEqual(evidence.receipts.list().map(r => ({ hour:r.hour, count:r.count })),[{ hour:'2026092109', count:2 }]);
  assert.equal(byAction(seat.calls,'use').length,0);
  await host.close(leaseInput(a)); await host.stop(a.instance.id,{ confirm:true }); await evidence.settle();
  assert.equal(byAction(seat.calls,'use').length,0,'one instance is still live: the hour stays open');
  now = Date.UTC(2026,8,21,9,30,0); await host.heartbeat(leaseInput(b));
  assert.equal((await http(eb.origin+'/second',{ headers:{ cookie:eb.cookie } })).status,200);
  await host.close(leaseInput(b)); await host.stop(b.instance.id,{ confirm:true });
  await until(async () => { await evidence.settle(); return byAction(seat.calls,'use').length === 1; });
  assert.deepEqual(byAction(seat.calls,'use')[0],{ hanaRef:'@hanamesh/app-multi', action:'use', occurredAt:'2026-09-21T09:00:00.000Z', idempotencyKey:'use:example:2026092109', sourcePlugin:SOURCE_PLUGIN, targetRef:'example' });
  // After close(), nothing is recorded any more even though the host keeps running.
  evidence.close(); const c = await host.open(input('view-c')); const ec = await enter(c);
  now = Date.UTC(2026,8,21,10,0,0);
  assert.equal((await http(ec.origin+'/',{ headers:{ cookie:ec.cookie } })).status,200);
  await host.close(leaseInput(c)); await host.stop(c.instance.id,{ confirm:true });
  await new Promise(r => setTimeout(r,50));
  assert.equal(seat.calls.length,3);
});

test('AH-U08 (T6): the Router route becomes the hour receipt {providerId, model, count}; injections and requests are separate; unknown routes report without a receipt', async t => {
  const seat = fakeSeat(); let now = Date.UTC(2026,8,22,10,30,0);
  const def = { ...definition(GATE), packageName:'@hanamesh/app-vibe' };
  const receipts = createReceiptLedger({ clock:() => now });
  const { host, evidence } = await hostWith(t,{ def, seat:() => seat, clock:() => now, receipts });
  const a = await host.open(input('view-a')); await evidence.settle();
  // The Router resolved two env routes for this instance: the first (declaration order) is the instance's route.
  assert.deepEqual(receipts.inject({ appId:'example', instanceId:a.instance.id, routes:[{ providerId:'deepseek', model:'deepseek-chat' },{ providerId:'openai', model:null }], at:now }),
    { appId:'example', providerId:'deepseek', model:'deepseek-chat', hour:'2026092210', count:0, injections:1, firstAt:now, lastAt:now, reported:false });
  assert.deepEqual(receipts.routeOf(a.instance.id),{ providerId:'deepseek', model:'deepseek-chat' });
  const { origin, cookie } = await enter(a);
  for (const path of ['/','/second','/data']) assert.equal((await http(origin+path,{ headers:{ cookie } })).status,200);
  await evidence.settle();
  assert.deepEqual(evidence.receipts.list().map(r => ({ providerId:r.providerId, model:r.model, hour:r.hour, count:r.count, injections:r.injections })),[{ providerId:'deepseek', model:'deepseek-chat', hour:'2026092210', count:3, injections:1 }]);
  assert.equal(byAction(seat.calls,'use').length,0);
  // Hour closes on the next request: the `use` carries targetRef and the receipt with the final count of hour 10.
  now = Date.UTC(2026,8,22,11,0,0); await host.heartbeat(leaseInput(a));
  assert.equal((await http(origin+'/',{ headers:{ cookie } })).status,200); await evidence.settle();
  const uses = byAction(seat.calls,'use'); assert.equal(uses.length,1);
  assert.deepEqual(uses[0],{ hanaRef:'@hanamesh/app-vibe', action:'use', occurredAt:'2026-09-22T10:30:00.000Z', idempotencyKey:'use:example:2026092210', sourcePlugin:SOURCE_PLUGIN,
    targetRef:'example', receipt:{ providerId:'deepseek', model:'deepseek-chat', count:3 } });
  // A recovered instance with no injection this run counts against a route-less row; when both exist the routed row is the receipt.
  await host.close(leaseInput(a)); await host.stop(a.instance.id,{ confirm:true }); await evidence.settle();
  assert.equal(byAction(seat.calls,'use').length,2,'last instance stopped → hour 11 reported');
  assert.deepEqual(byAction(seat.calls,'use')[1].receipt,{ providerId:'deepseek', model:'deepseek-chat', count:1 });
  const b = await host.open(input('view-b')); const eb = await enter(b);
  now = Date.UTC(2026,8,22,11,45,0); await host.heartbeat(leaseInput(b));
  now = Date.UTC(2026,8,22,12,0,0); await host.heartbeat(leaseInput(b));
  assert.equal((await http(eb.origin+'/',{ headers:{ cookie:eb.cookie } })).status,200); await evidence.settle();
  assert.deepEqual(evidence.receipts.list().find(r => r.hour === '2026092212'),{ appId:'example', providerId:null, model:null, hour:'2026092212', count:1, injections:0, firstAt:'2026-09-22T12:00:00.000Z', lastAt:'2026-09-22T12:00:00.000Z', reported:false });
  await host.close(leaseInput(b)); await host.stop(b.instance.id,{ confirm:true });
  await until(async () => { await evidence.settle(); return byAction(seat.calls,'use').length === 3; });
  const third = byAction(seat.calls,'use')[2]; assert.equal(third.idempotencyKey,'use:example:2026092212'); assert.equal('receipt' in third,false); assert.equal(third.targetRef,'example');
  // Routes are validated like the seat validates them: a secret-looking provider is dropped, a bad model falls back to null.
  assert.equal(receipts.inject({ appId:'example', instanceId:'x', routes:[{ providerId:'sk-live-key', model:null }] }),null);
  assert.deepEqual(receipts.inject({ appId:'example', instanceId:'y', routes:[{ providerId:'openai', model:'has space' }] }).model,null);
  assert.throws(() => receipts.inject({ appId:'../x', instanceId:'z', routes:[] }),{ code:'INVALID_APP' });
});

test('AH-U09 (T6): the receipt ledger persists through one debounced global.set, reloads, reports leftover closed hours on the next start and prunes', async () => {
  let now = Date.UTC(2026,8,22,10,0,0); const writes = [];
  const domain = { global:{ snapshot:{ schema:1, items:{} }, get(){ return structuredClone(this.snapshot); }, async set(v){ writes.push(structuredClone(v)); this.snapshot = structuredClone(v); } } };
  const ledger = createReceiptLedger({ domain, clock:() => now, persistDelayMs:0 });
  ledger.inject({ appId:'vibe', instanceId:'i1', routes:[{ providerId:'deepseek', model:'deepseek-chat' }], at:now });
  for (let i = 0; i < 5; i++) ledger.activity({ appId:'vibe', instanceId:'i1', at:now + i*1000 });
  await ledger.persist();
  assert.equal(writes.at(-1).items['vibe|deepseek|deepseek-chat|2026092210'].count,5);
  assert.deepEqual(ledger.pending({ now }),[],'the running hour is not pending');
  assert.deepEqual(ledger.pending({ now, includeCurrent:true }),[{ appId:'vibe', hour:'2026092210', occurredAt:now, count:5, receipt:{ providerId:'deepseek', model:'deepseek-chat', count:5 } }]);
  // A new process loads the snapshot: the hour is closed now and pending; routes are not remembered across runs.
  now = Date.UTC(2026,8,22,11,30,0);
  const reloaded = createReceiptLedger({ domain, clock:() => now, persistDelayMs:0 });
  assert.equal(reloaded.routeOf('i1'),null);
  assert.deepEqual(reloaded.pending({ now }).map(p => [p.appId,p.hour,p.receipt.count]),[['vibe','2026092210',5]]);
  assert.equal(reloaded.markReported('vibe','2026092210'),1); await reloaded.persist();
  assert.equal(writes.at(-1).items['vibe|deepseek|deepseek-chat|2026092210'].reported,true);
  assert.deepEqual(reloaded.pending({ now }),[]);
  // Debounce: many activities → one publication; retention prunes rows older than 90 days.
  const debounced = createReceiptLedger({ domain, clock:() => now, persistDelayMs:20 });
  const before = writes.length; for (let i = 0; i < 50; i++) debounced.activity({ appId:'vibe', instanceId:'i2', at:now });
  await new Promise(r => setTimeout(r,60)); assert.equal(writes.length,before+1);
  now = Date.UTC(2027,0,1,0,0,0); debounced.activity({ appId:'vibe', instanceId:'i2', at:now }); await debounced.persist();
  assert.deepEqual(Object.keys(writes.at(-1).items),['vibe|||2027010100']);
  await debounced.close();
  // Bad domains and options fail closed at construction.
  assert.throws(() => createReceiptLedger({ domain:{ global:{} } }),{ code:'INVALID_DOMAIN' });
  assert.throws(() => createReceiptLedger({ persistDelayMs:-1 }),{ code:'INVALID_OPTIONS' });
});
