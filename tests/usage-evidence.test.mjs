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
import { AppHost, AtomicFileStore, createUsageEvidence, hourBucket, SOURCE_PLUGIN, validateDefinition } from '../src/index.js';
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
    assert.deepEqual(keys.filter(k => !['hanaRef','action','occurredAt','idempotencyKey','sourcePlugin'].includes(k)), []);
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
async function hostWith(t, { def = definition(GATE), seat, clock, logger } = {}) {
  const dir = await temporary();
  const host = new AppHost({ store:new AtomicFileStore(join(dir,'sidecar')), dataRoot:join(dir,'data'), parentOrigin, leaseTtlMs:3_600_000, sweepIntervalMs:0, clock });
  host.register(def); await host.init();
  const evidence = createUsageEvidence({ host, seat, logger });
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

test('AH-U02: use is one per app per UTC hour of real gateway activity; bootstrap, denials and 401/403 answers never count', async t => {
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
  await evidence.settle(); assert.equal(byAction(seat.calls,'use').length,0);
  // First real forwarded request of the hour → exactly one `use`, timestamped at that request.
  assert.equal((await http(origin+'/',{ headers:{ cookie } })).status,200);
  await evidence.settle();
  let uses = byAction(seat.calls,'use');
  assert.equal(uses.length,1);
  assert.deepEqual(uses[0],{ hanaRef:'@hanamesh/app-example', action:'use', occurredAt:'2026-09-21T10:15:00.000Z',
    idempotencyKey:'use:example:2026092110', sourcePlugin:SOURCE_PLUGIN });
  assert.equal(hourBucket(now),'2026092110');
  // More traffic in the same hour: no further calls at all (not even duplicates).
  now += 20*60_000; await host.heartbeat(leaseInput(a));
  for (const path of ['/','/second','/headers','/data']) assert.equal((await http(origin+path,{ headers:{ cookie } })).status,200);
  await evidence.settle(); assert.equal(byAction(seat.calls,'use').length,1);
  // Next UTC hour: one more.
  now = Date.UTC(2026,8,21,11,0,1); await host.heartbeat(leaseInput(a));
  assert.equal((await http(origin+'/',{ headers:{ cookie } })).status,200); await evidence.settle();
  uses = byAction(seat.calls,'use'); assert.equal(uses.length,2);
  assert.equal(uses[1].idempotencyKey,'use:example:2026092111'); assert.equal(uses[1].occurredAt,'2026-09-21T11:00:01.000Z');
  assert.equal(evidence.trackedInstances(),1);
  // A WebSocket upgrade is activity too (same hour → no new call; new hour → counts).
  now = Date.UTC(2026,8,21,12,0,0); await host.heartbeat(leaseInput(a));
  const u = new URL(origin);
  await new Promise((resolve,reject) => {
    const socket = connect(Number(u.port),u.hostname); const timer = setTimeout(() => { socket.destroy(); reject(new Error('ws timeout')); },3000);
    socket.on('connect',() => socket.write(`GET /socket HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\nCookie: ${cookie}\r\nOrigin: ${origin}\r\n\r\n`));
    socket.on('data',() => { clearTimeout(timer); socket.destroy(); resolve(); }); socket.on('error',reject);
  });
  await until(async () => { await evidence.settle(); return byAction(seat.calls,'use').length === 3; });
  assert.equal(byAction(seat.calls,'use')[2].idempotencyKey,'use:example:2026092112');
  // The bucket map is bounded: the instance's entry is dropped when it stops.
  await host.close(leaseInput(a)); await host.stop(a.instance.id,{ confirm:true });
  assert.equal(evidence.trackedInstances(),0);
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
    await evidence.settle();
    assert.equal(seat.calls.length,2,mode); // open + use were attempted, failures stayed with the seat
    assert(debug.length >= 2, 'failures are debug-logged, not thrown');
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

test('AH-U06: multiple instances of one app share the hour bucket at the seat, and each instance drops its bucket on stop', async t => {
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
  // Both instances asked once (per-instance bucket); the seat de-duplicates the per-app key itself.
  const uses = byAction(seat.calls,'use'); assert.equal(uses.length,2);
  assert(uses.every(c => c.idempotencyKey === 'use:example:2026092109'));
  assert.equal(evidence.trackedInstances(),2);
  await host.close(leaseInput(a)); await host.stop(a.instance.id,{ confirm:true });
  assert.equal(evidence.trackedInstances(),1);
  // After close(), nothing is recorded any more even though the host keeps running.
  evidence.close(); now = Date.UTC(2026,8,21,9,30,0); await host.heartbeat(leaseInput(b)); now = Date.UTC(2026,8,21,10,0,0);
  assert.equal((await http(eb.origin+'/',{ headers:{ cookie:eb.cookie } })).status,200);
  await new Promise(r => setTimeout(r,50));
  assert.equal(seat.calls.length,4);
});
