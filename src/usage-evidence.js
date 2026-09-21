/**
 * rc.27 — application usage evidence (user decision 2026-09-21, STATUS `P2-USE-EVENTS`).
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
 *
 * `hanaRef` is the app's npm package name (`host.packageName(appId)`: definition `packageName`, else the
 * installed-package scan binding). No package name → no evidence for that app (debug log only).
 * `withheld` (consent off) and `duplicate` (repeat) are normal dispositions and are logged at debug only.
 */
import { requireCondition } from './errors.js';

export const SOURCE_PLUGIN = '@hanamesh/dsh-app-host';
const MAX_KEY = 160;
const pad = n => String(n).padStart(2,'0');
/** UTC hour bucket `YYYYMMDDHH` of an epoch-millisecond instant. */
export function hourBucket(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}`;
}
/** Duck-type the optional sibling service: anything exposing `record(input)` is used, nothing else is assumed. */
export const duckSeat = value => value !== null && typeof value === 'object' && typeof value.record === 'function' ? value : null;
const TERMINAL = ['instance.stopped','instance.failed','instance.interrupted'];

/**
 * @param {{host:import('./manager.js').AppHost, seat:()=>unknown, logger?:{debug?:Function}}} options
 *   `seat()` is read on every emission (the service may appear or disappear while the host runs).
 */
export function createUsageEvidence({ host, seat, logger }) {
  requireCondition(host && typeof host.subscribe === 'function' && typeof host.onActivity === 'function' && typeof host.packageName === 'function',
    'INVALID_HOST','createUsageEvidence needs an AppHost with subscribe/onActivity/packageName.');
  requireCondition(typeof seat === 'function','INVALID_SEAT','seat must be a function returning the optional usage service.');
  const debug = (...args) => { try { logger?.debug?.(...args); } catch {} };
  /** instanceId → last UTC hour bucket a `use` was emitted for (dropped when the instance leaves `ready`). */
  const buckets = new Map();
  const inflight = new Set();
  let closed = false;

  function emit(action, appId, key, at) {
    if (closed) return;
    const api = duckSeat(seat());
    if (!api) { debug('hanamesh-app-host usage: seat absent, %s not recorded', key); return; }
    const hanaRef = host.packageName(appId);
    if (!hanaRef) { debug('hanamesh-app-host usage: no package name for app %s, %s not recorded', appId, key); return; }
    if (key.length > MAX_KEY) { debug('hanamesh-app-host usage: key too long, %s not recorded', key.slice(0,40)); return; }
    const input = { hanaRef, action, occurredAt:new Date(at).toISOString(), idempotencyKey:key, sourcePlugin:SOURCE_PLUGIN };
    let task;
    try { task = Promise.resolve(api.record(input)); }
    catch (error) { debug('hanamesh-app-host usage: seat threw for %s (%s)', key, error?.code ?? error?.message); return; }
    inflight.add(task);
    task.then(result => {
      const disposition = result?.disposition ?? 'unknown';
      debug('hanamesh-app-host usage: %s %s → %s%s', action, key, disposition, result?.code ? ` (${result.code})` : '');
    }, error => { debug('hanamesh-app-host usage: seat rejected %s (%s)', key, error?.code ?? error?.message); })
      .finally(() => inflight.delete(task));
  }

  const unsubscribeEvents = host.subscribe(event => {
    if (event.type === 'instance.ready') {
      const instance = host.instance(event.instanceId, event.principalId);
      if (instance) emit('open', instance.appId, `open:${instance.appId}:${event.instanceId}`, event.at);
    } else if (TERMINAL.includes(event.type)) buckets.delete(event.instanceId);
  });
  const unsubscribeActivity = host.onActivity(activity => {
    const bucket = hourBucket(activity.at);
    if (buckets.get(activity.instanceId) === bucket) return;
    buckets.set(activity.instanceId, bucket);
    emit('use', activity.appId, `use:${activity.appId}:${bucket}`, activity.at);
  });

  return Object.freeze({
    /** Number of instances currently holding an hour bucket (bounded by live instances). */
    trackedInstances: () => buckets.size,
    /** Resolves once every record() call issued so far has settled (tests / orderly shutdown). */
    settle: async () => { await Promise.allSettled([...inflight]); },
    close() { closed = true; unsubscribeEvents(); unsubscribeActivity(); buckets.clear(); },
  });
}
