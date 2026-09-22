/**
 * rc.27 — application usage evidence (user decision 2026-09-21, STATUS `P2-USE-EVENTS`); T6 — usage receipts.
 *
 * Applications' `open` / `use` events are reported by app-host through the usage plugin's record seat
 * (`ctx.hanameshUsage.record`). The three HanaMesh plugins never import each other: the seat arrives as an
 * OPTIONAL Cordis service, read duck-typed each time it is needed. Absent or incompatible seat → no events,
 * never a throw, never a blocked launch or proxied request.
 *
 *   open  once per successful app open — the instance reaching `ready` (the served view).
 *         idempotencyKey `open:<appId>:<instanceId>`, occurredAt = the ready time.
 *   use   real activity only — the instance's gateway forwarded an authorized request (bootstrap, denials,
 *         401/403 answers and the host's own readiness probes never count). At most one per app per UTC hour:
 *         idempotencyKey `use:<appId>:<YYYYMMDDHH>`, occurredAt = the first forwarded request of that bucket.
 *         T6: the event carries `targetRef = appId` and, when the Router routed a provider into the app, the
 *         hour's receipt `{providerId, model, count}` from the receipt ledger (router/receipts.js). Because the
 *         count is only final when the hour is over, the `use` event is handed to the seat when the UTC hour
 *         closes (next activity in a later hour, the periodic sweep, plugin shutdown) or as soon as the app's
 *         last live instance ends. Hours that were still open when the host died are reported on the next start
 *         (the ledger is persisted); the seat de-duplicates by key, so nothing is counted twice.
 *
 * `hanaRef` is the app's npm package name (`host.packageName(appId)`: definition `packageName`, else the
 * installed-package scan binding). No package name → no evidence for that app (debug log only).
 * `withheld` (consent off) and `duplicate` (repeat) are normal dispositions and are logged at debug only.
 */
import { requireCondition } from './errors.js';
import { createReceiptLedger, hourBucket } from './router/receipts.js';

export { hourBucket };
export const SOURCE_PLUGIN = '@hanamesh/dsh-app-host';
const MAX_KEY = 160;
/** Duck-type the optional sibling service: anything exposing `record(input)` is used, nothing else is assumed. */
export const duckSeat = value => value !== null && typeof value === 'object' && typeof value.record === 'function' ? value : null;
const TERMINAL = ['instance.stopped','instance.failed','instance.interrupted'];
const LIVE = ['starting','ready','stopping'];

/**
 * @param {{host:import('./manager.js').AppHost, seat:()=>unknown, receipts?:ReturnType<typeof createReceiptLedger>, logger?:{debug?:Function}, clock?:()=>number, sweepIntervalMs?:number}} options
 *   `seat()` is read on every emission (the service may appear or disappear while the host runs).
 *   `receipts` is the Router's receipt ledger; without one an in-memory ledger gives the same behaviour.
 */
export function createUsageEvidence({ host, seat, receipts, logger, clock = Date.now, sweepIntervalMs = 60_000 }) {
  requireCondition(host && typeof host.subscribe === 'function' && typeof host.onActivity === 'function' && typeof host.packageName === 'function',
    'INVALID_HOST','createUsageEvidence needs an AppHost with subscribe/onActivity/packageName.');
  requireCondition(typeof seat === 'function','INVALID_SEAT','seat must be a function returning the optional usage service.');
  requireCondition(Number.isSafeInteger(sweepIntervalMs) && sweepIntervalMs >= 0,'INVALID_OPTIONS','sweepIntervalMs must be a non-negative integer.');
  const debug = (...args) => { try { logger?.debug?.(...args); } catch {} };
  const ledger = receipts ?? createReceiptLedger({ clock });
  const inflight = new Set();
  let closed = false;

  /** @returns {Promise<{disposition:string, code?:string}|null>} null when nothing was attempted */
  function emit(action, appId, key, at, extra = {}) {
    if (closed) return Promise.resolve(null);
    const api = duckSeat(seat());
    if (!api) { debug('hanamesh-app-host usage: seat absent, %s not recorded', key); return Promise.resolve(null); }
    const hanaRef = host.packageName(appId);
    if (!hanaRef) { debug('hanamesh-app-host usage: no package name for app %s, %s not recorded', appId, key); return Promise.resolve(null); }
    if (key.length > MAX_KEY) { debug('hanamesh-app-host usage: key too long, %s not recorded', key.slice(0,40)); return Promise.resolve(null); }
    const input = { hanaRef, action, occurredAt:new Date(at).toISOString(), idempotencyKey:key, sourcePlugin:SOURCE_PLUGIN, ...extra };
    let task;
    try { task = Promise.resolve(api.record(input)); }
    catch (error) { debug('hanamesh-app-host usage: seat threw for %s (%s)', key, error?.code ?? error?.message); return Promise.resolve(null); }
    const settled = task.then(result => {
      const disposition = result?.disposition ?? 'unknown';
      debug('hanamesh-app-host usage: %s %s → %s%s', action, key, disposition, result?.code ? ` (${result.code})` : '');
      return result && typeof result === 'object' ? result : null;
    }, error => { debug('hanamesh-app-host usage: seat rejected %s (%s)', key, error?.code ?? error?.message); return null; });
    inflight.add(settled);
    settled.finally(() => inflight.delete(settled));
    return settled;
  }

  /** Report every closed (or, with includeCurrent, every) unreported hour as one `use` event with its receipt. */
  function flush({ appId, includeCurrent = false } = {}) {
    if (closed) return Promise.resolve();
    const tasks = [];
    for (const hour of ledger.pending({ appId, includeCurrent, now:clock() })) {
      const extra = { targetRef:hour.appId, ...(hour.receipt ? { receipt:hour.receipt } : {}) };
      tasks.push(emit('use', hour.appId, `use:${hour.appId}:${hour.hour}`, hour.occurredAt, extra).then(result => {
        if (result && (result.disposition === 'recorded' || result.disposition === 'duplicate')) ledger.markReported(hour.appId, hour.hour);
      }));
    }
    return Promise.all(tasks).then(() => {});
  }
  const liveInstances = appId => {
    try { return host.instanceList().filter(i => i.appId === appId && LIVE.includes(i.status)).length; } catch { return 0; }
  };

  const unsubscribeEvents = host.subscribe(event => {
    if (event.type === 'instance.ready') {
      const instance = host.instance(event.instanceId, event.principalId);
      if (instance) void emit('open', instance.appId, `open:${instance.appId}:${event.instanceId}`, event.at);
    } else if (TERMINAL.includes(event.type)) {
      ledger.forget(event.instanceId);
      const instance = host.instance(event.instanceId, event.principalId);
      // The app's last live instance ended: this hour's count is final for now, report it right away.
      if (instance && liveInstances(instance.appId) === 0) void flush({ appId:instance.appId, includeCurrent:true });
    }
  });
  const unsubscribeActivity = host.onActivity(activity => {
    ledger.activity({ appId:activity.appId, instanceId:activity.instanceId, at:activity.at });
    void flush({ appId:activity.appId });
  });
  let timer = null;
  if (sweepIntervalMs > 0) { timer = setInterval(() => { void flush(); }, sweepIntervalMs); timer.unref?.(); }
  // Hours left open by a previous run (persisted ledger) are reported once the seat is reachable.
  queueMicrotask(() => { void flush(); });

  return Object.freeze({
    /** Report closed hours now (tests / shutdown); `includeCurrent` also reports the running hour. */
    flush,
    /** Resolves once every record() call issued so far has settled (tests / orderly shutdown). */
    settle: async () => { await Promise.allSettled([...inflight]); },
    receipts: ledger,
    close() { void flush(); closed = true; if (timer !== null) clearInterval(timer); unsubscribeEvents(); unsubscribeActivity(); },
  });
}
