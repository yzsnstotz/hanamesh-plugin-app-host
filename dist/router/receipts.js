/**
 * T6 — usage receipts (design 2026-09-22 §3, STATUS `T6`).
 *
 * The Router knows which provider / model it injected into which application instance; the gateway knows when that
 * instance really served an authorized request. This ledger turns the two into content-free hourly receipts
 *
 *     { appId, providerId, model, hour, count }      hour = UTC `YYYYMMDDHH`, count = forwarded requests in that hour
 *
 * kept in app-host's own storage domain (`hanamesh_router_receipts`, one global snapshot, ONE `global.set` per
 * publication, debounced) and reported through the usage plugin's record seat as the receipt of that hour's `use`
 * event (see usage-evidence.js). No prompt, response, credential or URL is ever recorded — only the provider id,
 * the model name the Router routed, and a count.
 *
 *   inject   Router `credentialResolver` resolved a route for an instance → the instance's route is remembered
 *            (first api-key / provider env entry in declaration order) and the (app, route, hour) row counts one injection.
 *   activity the instance's gateway forwarded an authorized request → the (app, route, hour) row counts one request;
 *            an instance whose route is unknown (recovered / attached, no injection this run) counts against a
 *            route-less row so the hour's `use` is still reported, just without a receipt.
 *   reported once the usage seat accepted (or already had) the hour's `use` event the rows are flagged; later requests in
 *            the same hour keep counting locally but are not re-reported (the seat de-duplicates by key).
 *
 * Without a storage domain (library use, tests) the ledger is memory-only and behaves identically.
 */
import { z } from 'zod';
import { defineDomain } from '@deepseek-ai/dsh-storage-domain';
import { requireCondition } from '../errors.js';

const pad = n => String(n).padStart(2,'0');
/** UTC hour bucket `YYYYMMDDHH` of an epoch-millisecond instant. */
export function hourBucket(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}`;
}
/** Bucket → epoch ms of its first instant (used for retention and for ordering). */
export function bucketStart(bucket) {
  return Date.UTC(Number(bucket.slice(0,4)),Number(bucket.slice(4,6))-1,Number(bucket.slice(6,8)),Number(bucket.slice(8,10)));
}
const PROVIDER = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/, MODEL = /^[A-Za-z0-9][A-Za-z0-9_.:/@+-]{0,127}$/, APP = /^[a-z0-9][a-z0-9-]*$/, BUCKET = /^\d{10}$/;
const SECRET = /(?:^sk-|^sk_|^bearer[.:-]|ghp_|github_pat_|xox[baprs]-|secret|password|api.?key|private.?key)/i;
/** A route the Router actually resolved: provider id plus the model it routed (granted, else the app's declared default, else null). */
export function normalizeRoute(route) {
  if (!route || typeof route !== 'object') return null;
  const providerId = route.providerId, model = route.model ?? null;
  if (typeof providerId !== 'string' || !PROVIDER.test(providerId) || SECRET.test(providerId)) return null;
  if (model !== null && (typeof model !== 'string' || !MODEL.test(model) || SECRET.test(model))) return { providerId, model:null };
  return { providerId, model };
}
const row = z.object({ appId:z.string(), providerId:z.string().nullable(), model:z.string().nullable(), hour:z.string(),
  count:z.number().int().nonnegative(), injections:z.number().int().nonnegative(), firstAt:z.number().int().nonnegative(), lastAt:z.number().int().nonnegative(), reported:z.boolean() });
export const receiptsDomainSpec = defineDomain({
  name:'hanamesh_router_receipts', version:1, layout:'single', tables:{},
  global:{ schema:z.object({ schema:z.literal(1), items:z.record(z.string(),row) }), initial:{ schema:1, items:{} } },
});
const key = (appId,providerId,model,hour) => `${appId}|${providerId ?? ''}|${model ?? ''}|${hour}`;
const DAY = 86_400_000;

/**
 * @param {{domain?:{global:{get():any,set(value:any):Promise<void>}}, clock?:()=>number, persistDelayMs?:number, maxItems?:number, retentionMs?:number}} [options]
 */
export function createReceiptLedger({ domain, clock = Date.now, persistDelayMs = 5_000, maxItems = 5_000, retentionMs = 90*DAY } = {}) {
  requireCondition(domain === undefined || (domain && domain.global && typeof domain.global.get === 'function' && typeof domain.global.set === 'function'),
    'INVALID_DOMAIN','receipts domain must expose global.get/set.');
  requireCondition(Number.isSafeInteger(persistDelayMs) && persistDelayMs >= 0 && Number.isSafeInteger(maxItems) && maxItems > 0,'INVALID_OPTIONS','persistDelayMs / maxItems out of range.');
  const loaded = domain ? domain.global.get() : null;
  /** @type {Record<string, any>} */
  const items = loaded && loaded.schema === 1 && loaded.items && typeof loaded.items === 'object' ? structuredClone(loaded.items) : {};
  /** instanceId → normalized route (or null when the Router resolved nothing for it). */
  const routes = new Map();
  let dirty = false, closed = false, timer = null, writing = Promise.resolve();

  function prune() {
    const cutoff = clock() - retentionMs;
    for (const [k,item] of Object.entries(items)) if (bucketStart(item.hour) < cutoff) delete items[k];
    const keys = Object.keys(items);
    if (keys.length > maxItems) {
      keys.sort((a,b) => items[a].reported === items[b].reported ? items[a].lastAt - items[b].lastAt : (items[a].reported ? -1 : 1));
      for (const k of keys.slice(0, keys.length - maxItems)) delete items[k];
    }
  }
  /** ONE global.set per publication; every mutation since the last one rides in the same image. */
  function persistNow() {
    if (!dirty || !domain) { dirty = false; return writing; }
    dirty = false; prune();
    const image = { schema:1, items:structuredClone(items) };
    writing = writing.then(() => domain.global.set(image)).catch(() => { dirty = true; });
    return writing;
  }
  function schedule() {
    dirty = true;
    if (!domain || closed) return;
    if (persistDelayMs === 0) { void persistNow(); return; }
    if (timer === null) { timer = setTimeout(() => { timer = null; void persistNow(); }, persistDelayMs); timer.unref?.(); }
  }
  function touch(appId, route, at, field) {
    requireCondition(typeof appId === 'string' && APP.test(appId),'INVALID_APP','appId must be an application id.');
    requireCondition(Number.isSafeInteger(at) && at >= 0,'INVALID_TIME','at must be epoch milliseconds.');
    const hour = hourBucket(at), k = key(appId, route?.providerId ?? null, route?.model ?? null, hour);
    const item = items[k] ?? (items[k] = { appId, providerId:route?.providerId ?? null, model:route?.model ?? null, hour, count:0, injections:0, firstAt:at, lastAt:at, reported:false });
    item[field] += 1; item.firstAt = Math.min(item.firstAt, at); item.lastAt = Math.max(item.lastAt, at);
    schedule();
    return { ...item };
  }
  const api = Object.freeze({
    /** The Router injected credentials into an instance; `routes` in declaration order, the first valid one is the instance's route. */
    inject({ appId, instanceId, routes: resolved = [], at = clock() }) {
      requireCondition(typeof appId === 'string' && APP.test(appId),'INVALID_APP','appId must be an application id.');
      requireCondition(typeof instanceId === 'string' && instanceId.length > 0,'INVALID_INSTANCE','instanceId is required.');
      const route = (Array.isArray(resolved) ? resolved : []).map(normalizeRoute).find(Boolean) ?? null;
      routes.set(instanceId, route);
      return route ? touch(appId, route, at, 'injections') : null;
    },
    /** The instance's gateway forwarded an authorized request. */
    activity({ appId, instanceId, at = clock() }) {
      return touch(appId, routes.get(instanceId) ?? null, at, 'count');
    },
    /** The instance ended; its route binding is dropped (rows stay until reported / pruned). */
    forget(instanceId) { routes.delete(instanceId); },
    routeOf(instanceId) { const r = routes.get(instanceId); return r ? { ...r } : null; },
    /**
     * Hours ready to report as one `use` event each: rows of an (app, hour) that saw real requests and were not reported yet.
     * `before` (a bucket) keeps the current hour out unless `includeCurrent`; `appId` narrows to one app.
     * The receipt is the routed row with the most requests; `occurredAt` is the earliest request of the hour.
     */
    pending({ appId, includeCurrent = false, now = clock() } = {}) {
      const current = hourBucket(now), groups = new Map();
      for (const item of Object.values(items)) {
        if (item.reported || item.count === 0 || (appId !== undefined && item.appId !== appId)) continue;
        if (!includeCurrent && item.hour >= current) continue;
        const g = key(item.appId,'','',item.hour), group = groups.get(g) ?? { appId:item.appId, hour:item.hour, occurredAt:item.firstAt, count:0, receipt:null };
        group.occurredAt = Math.min(group.occurredAt, item.firstAt); group.count += item.count;
        if (item.providerId !== null && (group.receipt === null || item.count > group.receipt.count)) group.receipt = { providerId:item.providerId, model:item.model, count:item.count };
        groups.set(g, group);
      }
      return [...groups.values()].sort((a,b) => a.hour.localeCompare(b.hour) || a.appId.localeCompare(b.appId));
    },
    /** The hour's `use` event reached the seat (recorded or already there): flag every row of that (app, hour). */
    markReported(appId, hour) {
      requireCondition(typeof hour === 'string' && BUCKET.test(hour),'INVALID_HOUR','hour must be a UTC bucket.');
      let n = 0;
      for (const item of Object.values(items)) if (item.appId === appId && item.hour === hour && !item.reported) { item.reported = true; n++; }
      if (n > 0) schedule();
      return n;
    },
    /** Local inspection (router route): the receipt rows, newest hour first, optionally for one app. Never includes credentials. */
    list({ appId } = {}) {
      return Object.values(items).filter(item => appId === undefined || item.appId === appId)
        .sort((a,b) => b.hour.localeCompare(a.hour) || a.appId.localeCompare(b.appId) || String(a.providerId).localeCompare(String(b.providerId)))
        .map(item => ({ appId:item.appId, providerId:item.providerId, model:item.model, hour:item.hour, count:item.count, injections:item.injections,
          firstAt:new Date(item.firstAt).toISOString(), lastAt:new Date(item.lastAt).toISOString(), reported:item.reported }));
    },
    size: () => Object.keys(items).length,
    /** Publish now (tests, orderly shutdown). */
    async persist() { if (timer !== null) { clearTimeout(timer); timer = null; } await persistNow(); },
    async close() { if (closed) return; closed = true; if (timer !== null) { clearTimeout(timer); timer = null; } await persistNow(); routes.clear(); },
  });
  return api;
}
