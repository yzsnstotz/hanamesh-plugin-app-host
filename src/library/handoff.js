/**
 * Website → client install handoff (C-MARKET, 2026-10-15 E/F). Upstream Desktop listens on an OS-assigned port that
 * nothing records, and a browser tab without the launch token gets 401, so a website can neither find nor enter the
 * DSH web server. The library therefore opens its own loopback listener on the first free port of a named list and
 * answers exactly three routes there:
 *
 *   GET  /hanamesh/library/install-target   public probe (client, ready, need), ACAO *
 *   POST /hanamesh/library/handoff          queue a target from an allowed website origin; never installs
 *   GET  /hanamesh/library/handoff?id=      that handoff's state for the same origin
 *
 * A queued handoff is shown by the library UI inside the client window with the normal confirmation; only the
 * person's confirmation installs. States: pending → shown → confirmed → installed | cancelled | failed.
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { AppHostError, requireCondition } from '../errors.js';

export const HANDOFF_STATES = Object.freeze(['pending', 'shown', 'confirmed', 'installed', 'cancelled', 'failed']);
const FINAL = new Set(['installed', 'cancelled', 'failed']);
/** Proposed defaults (owner decides; all three are visible and editable in the library settings). */
export const HANDOFF_DEFAULTS = Object.freeze({
  enabled: true,
  ports: Object.freeze([39317, 39318, 39319]),
  allowedOrigins: Object.freeze(['https://market.hanamesh.com']),
  ttlMs: 600_000,
});
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Validate and normalise handoff settings; every field is required after merging with the defaults. */
export function handoffSettings(input = {}) {
  const value = { ...HANDOFF_DEFAULTS, ...Object.fromEntries(Object.entries(input ?? {}).filter(([, v]) => v !== undefined)) };
  const invalid = message => new AppHostError('INVALID_HANDOFF_SETTINGS', message, {}, 400);
  if (Object.keys(value).some(key => !(key in HANDOFF_DEFAULTS))) throw invalid('Unknown handoff setting.');
  if (typeof value.enabled !== 'boolean') throw invalid('enabled must be true or false.');
  if (!Array.isArray(value.ports) || value.ports.length < 1 || value.ports.length > 16 ||
    value.ports.some(port => !Number.isInteger(port) || port < 1024 || port > 65535) || new Set(value.ports).size !== value.ports.length)
    throw invalid('ports must be 1–16 distinct ports between 1024 and 65535.');
  if (!Array.isArray(value.allowedOrigins) || value.allowedOrigins.length > 32) throw invalid('allowedOrigins must be a list of at most 32 origins.');
  const origins = value.allowedOrigins.map(origin => {
    let url; try { url = new URL(origin); } catch { throw invalid(`Not an origin: ${origin}`); }
    if (!['https:', 'http:'].includes(url.protocol) || url.origin !== origin.replace(/\/$/, '')) throw invalid(`Not an origin: ${origin}`);
    if (url.protocol === 'http:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) throw invalid(`Plain http is only accepted for loopback: ${origin}`);
    return url.origin;
  });
  if (!Number.isSafeInteger(value.ttlMs) || value.ttlMs < 10_000 || value.ttlMs > 86_400_000) throw invalid('ttlMs must be between 10000 and 86400000.');
  return { enabled: value.enabled, ports: [...value.ports], allowedOrigins: [...new Set(origins)], ttlMs: value.ttlMs };
}

/** In-memory handoffs. `observe` links library install events to the handoff shown for the same package. */
export function createHandoffQueue({ ttlMs = () => HANDOFF_DEFAULTS.ttlMs, now = Date.now } = {}) {
  const records = new Map(), listeners = new Set();
  const publish = record => { for (const listener of listeners) { try { listener(view(record)); } catch {} } };
  const view = record => ({ handoffId: record.handoffId, state: record.state, origin: record.origin,
    ...(record.itemId ? { itemId: record.itemId } : {}), ...(record.packageName ? { packageName: record.packageName } : {}),
    ...(record.displayName ? { displayName: record.displayName } : {}), ...(record.result ? { result: record.result } : {}),
    ...(record.error ? { error: record.error } : {}), createdAt: record.createdAt, updatedAt: record.updatedAt });
  const move = (record, state, extra = {}) => {
    if (FINAL.has(record.state)) return false;
    Object.assign(record, extra, { state, updatedAt: now() }); publish(record); return true;
  };
  const expire = () => {
    for (const record of records.values()) {
      if (!FINAL.has(record.state) && now() - record.createdAt > ttlMs())
        move(record, 'failed', { error: { code: 'HANDOFF_EXPIRED', message: '交接已过期：在应用库里没有被确认。' } });
      if (FINAL.has(record.state) && now() - record.updatedAt > ttlMs()) records.delete(record.handoffId);
    }
  };
  return Object.freeze({
    create({ origin, target, item, alreadyInstalled }) {
      expire();
      const at = now(), record = { handoffId: randomUUID(), state: 'pending', origin, target,
        itemId: item.id, packageName: item.package?.name, displayName: item.displayName, createdAt: at, updatedAt: at };
      records.set(record.handoffId, record);
      if (alreadyInstalled) move(record, 'installed', { result: { status: 'already-installed' } }); else publish(record);
      return view(record);
    },
    get(handoffId) {
      expire();
      requireCondition(typeof handoffId === 'string' && ID.test(handoffId) && records.has(handoffId), 'HANDOFF_UNKNOWN', 'Unknown handoff.', {}, 404);
      return view(records.get(handoffId));
    },
    /** Handoffs the client window still has to show or is showing. */
    open() { expire(); return [...records.values()].filter(record => ['pending', 'shown', 'confirmed'].includes(record.state)).map(view); },
    /** Client window reports: shown | cancelled. Installs are linked from library events, never from a client claim. */
    report(input) {
      requireCondition(input && typeof input === 'object' && Object.keys(input).every(key => ['handoffId', 'state'].includes(key)) &&
        ['shown', 'cancelled'].includes(input.state), 'INVALID_INPUT', 'Only handoffId and state shown|cancelled are accepted.');
      const record = records.get(this.get(input.handoffId).handoffId);
      if (input.state === 'shown' && record.state !== 'pending') return view(record);
      move(record, input.state); return view(record);
    },
    observe(event) {
      const name = event?.packageName ?? event?.result?.packageName; if (!name) return;
      for (const record of records.values()) {
        if (record.packageName !== name || !['shown', 'confirmed'].includes(record.state)) continue;
        if (event.type === 'library.install-started') move(record, 'confirmed');
        else if (event.type === 'library.install-done') move(record, 'installed', { result: { status: event.status ?? event.result?.status } });
        else if (event.type === 'library.install-failed') move(record, 'failed', { error: { code: event.code ?? 'INSTALL_FAILED', message: '安装失败' } });
      }
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  });
}

function send(res, status, value, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'", ...headers });
  res.end(value === undefined ? '' : JSON.stringify(value));
}
async function jsonBody(req) {
  requireCondition(req.headers['content-type']?.split(';')[0].trim() === 'application/json', 'CONTENT_TYPE_REQUIRED', 'Expected application/json.', {}, 415);
  const chunks = []; let total = 0;
  for await (const chunk of req) { total += chunk.length; requireCondition(total <= 4096, 'BODY_TOO_LARGE', 'Request body is too large.', {}, 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AppHostError('INVALID_JSON', 'Malformed JSON.', {}, 400); }
}

/**
 * HTTP handler of the handoff listener. `library`: installTarget() and resolveTarget(); `settings()`: current settings;
 * `port()`: the bound port (Host must be exactly 127.0.0.1:<port> or localhost:<port>).
 */
export function createHandoffHandler({ library, queue, settings, port }) {
  return async (req, res) => {
    const traceId = randomUUID(); let cors = {};
    try {
      const bound = port();
      requireCondition([`127.0.0.1:${bound}`, `localhost:${bound}`].includes(req.headers.host), 'HOST_DENIED', 'Unrecognized request host.', {}, 403);
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`), path = url.pathname, origin = req.headers.origin;
      if (path === '/hanamesh/library/install-target') {
        cors = { 'access-control-allow-origin': '*', 'access-control-allow-private-network': 'true' };
        if (req.method === 'OPTIONS') { send(res, 204, undefined, { ...cors, 'access-control-allow-methods': 'GET' }); return; }
        requireCondition(req.method === 'GET', 'METHOD_NOT_ALLOWED', 'Discovery requires GET.', {}, 405);
        requireCondition(!url.search, 'UNKNOWN_FIELDS', 'Discovery takes no parameters.');
        send(res, 200, { ...library.installTarget(), traceId }, cors); return;
      }
      requireCondition(path === '/hanamesh/library/handoff', 'NOT_FOUND', 'Unknown handoff route.', {}, 404);
      requireCondition(typeof origin === 'string' && settings().allowedOrigins.includes(origin), 'ORIGIN_DENIED',
        'This website is not allowed to hand installs to this client. Add it in the HanaMesh library settings.', { origin: origin ?? null }, 403);
      cors = { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-private-network': 'true' };
      if (req.method === 'OPTIONS') {
        send(res, 204, undefined, { ...cors, 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' });
        return;
      }
      if (req.method === 'GET') {
        requireCondition([...url.searchParams.keys()].length === 1 && url.searchParams.has('id'), 'UNKNOWN_FIELDS', 'Only id is accepted.');
        const record = queue.get(url.searchParams.get('id'));
        requireCondition(record.origin === origin, 'HANDOFF_UNKNOWN', 'Unknown handoff.', {}, 404);
        const { origin: _o, createdAt: _c, updatedAt: _u, ...visible } = record;
        send(res, 200, { ...visible, traceId }, cors); return;
      }
      requireCondition(req.method === 'POST', 'METHOD_NOT_ALLOWED', 'Unsupported handoff method.', {}, 405);
      requireCondition(!url.search, 'UNKNOWN_FIELDS', 'Handoff takes no query.');
      const target = await jsonBody(req);
      const probe = library.installTarget();
      requireCondition(probe.ready, 'INSTALL_TARGET_UNAVAILABLE', probe.error?.message ?? 'Controlled installer is unavailable.', { need: probe.error?.need ?? [] }, 503);
      const { item } = await library.resolveTarget(target);
      requireCondition(item.kind !== 'listing', 'NOT_INSTALLABLE', 'Catalog item has no npm package to install.');
      const installed = item.installed && ['registered', 'installed', 'installed-not-loaded'].includes(item.installed.state) && !item.upgradeAvailable;
      const record = queue.create({ origin, target, item, alreadyInstalled: installed });
      send(res, 202, { handoffId: record.handoffId, state: record.state, ...(record.result ? { result: record.result } : {}), traceId }, cors);
    } catch (error) {
      const trusted = error instanceof AppHostError;
      send(res, trusted ? error.status : 500, { error: { code: trusted ? error.code : 'INTERNAL_ERROR',
        message: trusted ? error.message : 'The operation could not be completed.', ...(trusted && error.details ? { details: error.details } : {}) }, traceId }, cors);
    }
  };
}

/**
 * The listener itself. `start()` binds 127.0.0.1 on the first free port of settings().ports and reports which one, or
 * why none could be used (`need`), so the library settings and probes can say it.
 */
export function createHandoffListener({ handlerFor, settings, logger, listen = (server, port) => new Promise((resolve, reject) => {
  const fail = error => { server.off('listening', ok); reject(error); }, ok = () => { server.off('error', fail); resolve(); };
  server.once('error', fail); server.once('listening', ok); server.listen(port, '127.0.0.1');
}) }) {
  let server, state = { status: 'stopped' };
  async function stop() {
    const current = server; server = undefined;
    if (current) await new Promise(resolve => { current.close(() => resolve()); current.closeAllConnections?.(); });
    state = { status: 'stopped' };
  }
  async function start() {
    await stop();
    const { enabled, ports } = settings();
    if (!enabled) { state = { status: 'disabled' }; return state; }
    const tried = [];
    for (const port of ports) {
      const candidate = createServer();
      candidate.on('request', handlerFor(() => port));
      try { await listen(candidate, port); server = candidate; state = { status: 'listening', port, origin: `http://127.0.0.1:${port}` }; logger?.info?.('hanamesh-app-host handoff: listening on 127.0.0.1:%d', port); return state; }
      catch (error) { tried.push({ port, code: error.code ?? 'LISTEN_FAILED' }); candidate.close(); }
    }
    state = { status: 'unavailable', tried, need: `网站交接端口 ${ports.join('、')} 都被占用：在应用库设置里换一个空闲端口，并告诉网站同一端口` };
    logger?.warn?.('hanamesh-app-host handoff: no free port %s', JSON.stringify(tried));
    return state;
  }
  return Object.freeze({ start, stop, state: () => state });
}
