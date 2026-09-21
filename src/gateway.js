import { createServer, request } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { AppHostError, requireCondition, bounded } from './errors.js';
import { loopbackOrigin } from './descriptor.js';

export function rewriteCsp(value, parentOrigin) {
  if (/(?:^|;)\s*frame-ancestors\b/i.test(value))
    return value.replace(/(^|;)(\s*)frame-ancestors\b[^;]*/ig, (_, delimiter, whitespace) => `${delimiter}${whitespace}frame-ancestors ${parentOrigin}`);
  return `${value}${value.trimEnd().endsWith(';') ? '' : ';'} frame-ancestors ${parentOrigin}`;
}
export function embeddingHeaders(rawHeaders, parentOrigin) {
  const output = []; let hasCsp = false;
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const key = rawHeaders[i], value = rawHeaders[i + 1];
    if (key.toLowerCase() === 'x-frame-options') continue;
    if (key.toLowerCase() === 'content-security-policy') { output.push(key, rewriteCsp(value, parentOrigin)); hasCsp = true; }
    else output.push(key, value);
  }
  if (!hasCsp) output.push('Content-Security-Policy', `frame-ancestors ${parentOrigin}`);
  return output;
}
const token = () => randomBytes(32).toString('hex');
function cookies(header) {
  const map = new Map();
  for (const part of (header ?? '').split(';')) {
    const at = part.indexOf('='); if (at > 0) map.set(part.slice(0,at).trim(), part.slice(at+1).trim());
  }
  return map;
}
function fail(res, status, code) {
  res.writeHead(status, { 'content-type':'application/json', 'cache-control':'no-store', 'content-security-policy':"default-src 'none'; frame-ancestors 'none'" });
  res.end(JSON.stringify({ error: { code } }));
}

/** Fixed upstream only. Bootstrap is our own response, not a rewritten app document. */
export class FixedGateway {
  constructor({ upstream, parentOrigin, isLeaseActive, cookieAllowlist = [], allowAppAuthorization = false, maxUploadBytes = 32 * 1024 * 1024 }) {
    this.upstream = loopbackOrigin(upstream); this.parentOrigin = loopbackOrigin(parentOrigin);
    requireCondition(typeof isLeaseActive === 'function','INVALID_GATEWAY','A live lease authorization check is required.');
    this.isLeaseActive = isLeaseActive; this.cookieAllowlist = new Set(cookieAllowlist);
    this.allowAppAuthorization = allowAppAuthorization; this.maxUploadBytes = maxUploadBytes;
    this.tickets = new Map(); this.grants = new Map(); this.sockets = new Set(); this.upstreams = new Set();
    this.cookiePrefix = `hm_app_${token().slice(0,12)}_`;
  }
  async start() {
    this.server = createServer((req,res) => this.#handle(req,res));
    this.server.on('connection', socket => { this.sockets.add(socket); socket.once('close', () => this.sockets.delete(socket)); });
    this.server.on('upgrade', (req,socket,head) => this.#upgrade(req,socket,head));
    this.server.on('connect', (_req,socket) => socket.end('HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n'));
    await new Promise((resolve,reject) => { this.server.once('error',reject); this.server.listen(0,'127.0.0.1',resolve); });
    this.origin = `http://127.0.0.1:${this.server.address().port}`;
    return this.origin;
  }
  issue(viewKey) {
    requireCondition(this.isLeaseActive(viewKey),'LEASE_EXPIRED','Cannot grant access to an inactive view.');
    for (const [key,t] of this.tickets) if (t.expiresAt < Date.now() || !this.isLeaseActive(t.viewKey)) this.tickets.delete(key);
    for (const [key,g] of this.grants) if (!this.isLeaseActive(g.viewKey)) this.grants.delete(key);
    requireCondition(this.tickets.size < 512,'TOO_MANY_TICKETS','Too many pending iframe tickets.');
    const ticket = token(); this.tickets.set(ticket,{ viewKey, expiresAt:Date.now()+60_000 });
    return `${this.origin}/__hanamesh_bootstrap/${ticket}`;
  }
  #requestShape(req) {
    if (req.headers.host !== new URL(this.origin).host) return false;
    if (!req.url?.startsWith('/') || req.url.startsWith('//') || req.url.includes('\\') || req.url.length > 8_192) return false;
    try { if (/^[\/\\]{2}|[\x00-\x1f]/.test(decodeURIComponent(req.url))) return false; } catch { return false; }
    if (req.headers.origin && ![this.parentOrigin,this.origin].includes(req.headers.origin)) return false;
    if (req.headers['sec-fetch-dest'] === 'document') return false; // never top-level navigation
    return true;
  }
  #authorized(req) {
    if (!this.#requestShape(req)) return false;
    // Cookie capability + live lease. Origin/loopback alone never authenticate.
    for (const [name,value] of cookies(req.headers.cookie)) {
      if (!name.startsWith(this.cookiePrefix)) continue;
      const grant = this.grants.get(value);
      if (grant?.cookieName === name && this.isLeaseActive(grant.viewKey)) return true;
    }
    return this.#embeddedAuthorized(req);
  }
  /**
   * Embedded webviews (Tauri/WKWebView, WebView2 with tracking prevention) never return
   * the bootstrap cookie: the app frame is a third party under the shell's own top-level
   * origin, so `SameSite=Strict`/third-party cookies are dropped and every request after
   * the 303 arrived without a grant → 403 with `frame-ancestors 'none'` → a blank frame
   * (2026-09-21, HanaMesh desktop rc.4 + Vibe). Fall back to Fetch Metadata, which the
   * same webviews do send: a request is accepted without a cookie only when it comes from
   * inside an app document already served by this gateway (`same-origin`), or is the
   * post-bootstrap frame navigation initiated by the registered parent (`same-site` +
   * `iframe` + parent referer), and a bootstrap ticket for a still-live lease has been
   * consumed for this instance. Cross-site and address-bar (`none`) requests stay denied.
   */
  #embeddedAuthorized(req) {
    if (!this.#liveGrantExists()) return false;
    const site = req.headers['sec-fetch-site'];
    if (site === 'same-origin') return true;
    // WebSocket handshakes: every browser sets `Origin` on them (not spoofable from web content); some
    // WebKit builds omit Fetch Metadata there. The app's own origin is equivalent to same-origin.
    if (req.headers.upgrade?.toLowerCase() === 'websocket' && req.headers.origin === this.origin) return true;
    if (site !== 'same-site' || req.headers['sec-fetch-dest'] !== 'iframe') return false;
    let referer;
    try { referer = new URL(req.headers.referer).origin; } catch { return false; }
    return referer === this.parentOrigin;
  }
  #liveGrantExists() {
    for (const [value,g] of this.grants) { if (this.isLeaseActive(g.viewKey)) return true; this.grants.delete(value); }
    return false;
  }
  #headers(req, upgrade = false) {
    const headers = { ...req.headers, host:new URL(this.upstream).host };
    const allowedCookies = [...cookies(req.headers.cookie)].filter(([key]) => this.cookieAllowlist.has(key));
    if (allowedCookies.length) headers.cookie = allowedCookies.map(([k,v]) => `${k}=${v}`).join('; ');
    else delete headers.cookie;
    if (!this.allowAppAuthorization) delete headers.authorization;
    for (const key of Object.keys(headers)) if (/^(?:x-dsh|x-hanamesh|proxy-authorization|proxy-authenticate)/i.test(key)) delete headers[key];
    if (!upgrade) {
      for (const key of String(req.headers.connection ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)) delete headers[key];
      delete headers.connection; delete headers['proxy-connection']; delete headers.upgrade;
    }
    return headers;
  }
  #bootstrap(req,res) {
    const ticket = req.url.slice('/__hanamesh_bootstrap/'.length);
    const item = this.tickets.get(ticket);
    let referer;
    try { referer = new URL(req.headers.referer).origin; } catch {}
    if (req.method !== 'GET' || req.headers['sec-fetch-dest'] !== 'iframe' || referer !== this.parentOrigin ||
      !item || item.expiresAt <= Date.now() || !this.isLeaseActive(item.viewKey)) return fail(res,403,'GATEWAY_BOOTSTRAP_DENIED');
    this.tickets.delete(ticket);
    const value = token(), suffix = createHash('sha256').update(item.viewKey).digest('hex').slice(0,16);
    const cookieName = this.cookiePrefix + suffix;
    for (const [old,g] of this.grants) if (g.cookieName === cookieName) this.grants.delete(old);
    this.grants.set(value,{ viewKey:item.viewKey, cookieName });
    res.writeHead(303, {
      location:'/', 'set-cookie':`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict`,
      'cache-control':'no-store', 'referrer-policy':'no-referrer',
      'content-security-policy':`default-src 'none'; frame-ancestors ${this.parentOrigin}`,
    });
    res.end();
  }
  #handle(req,res) {
    if (!this.#requestShape(req)) return fail(res,403,'GATEWAY_REQUEST_DENIED');
    if (req.url.startsWith('/__hanamesh_bootstrap/')) return this.#bootstrap(req,res);
    if (!this.#authorized(req)) return fail(res,403,'GATEWAY_AUTH_REQUIRED');
    if (!['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(req.method)) return fail(res,405,'METHOD_NOT_ALLOWED');
    if (Number(req.headers['content-length']) > this.maxUploadBytes) return fail(res,413,'UPLOAD_TOO_LARGE');
    const upstream = request(this.upstream + req.url,{ method:req.method,headers:this.#headers(req) }, response => {
      res.writeHead(response.statusCode, embeddingHeaders(response.rawHeaders,this.parentOrigin));
      response.pipe(res, { end:false });
      response.once('error', () => res.destroy());
      response.once('end', () => { if (Object.keys(response.trailers).length) res.addTrailers(response.trailers); res.end(); });
    });
    this.upstreams.add(upstream); upstream.once('close',() => this.upstreams.delete(upstream));
    upstream.setTimeout(120_000,() => upstream.destroy(new Error('Upstream idle timeout')));
    upstream.once('error',() => { if (!res.headersSent) fail(res,502,'GATEWAY_UPSTREAM_FAILED'); else res.destroy(); });
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > this.maxUploadBytes) { if (!res.headersSent) fail(res,413,'UPLOAD_TOO_LARGE'); upstream.destroy(); }
    });
    req.once('aborted',() => upstream.destroy()); res.once('close',() => upstream.destroy());
    req.pipe(upstream);
  }
  #upgrade(req,socket,head) {
    if (!this.#authorized(req) || req.headers.upgrade?.toLowerCase() !== 'websocket') {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    const upstream = request(this.upstream + req.url,{ method:'GET',headers:this.#headers(req,true) });
    this.upstreams.add(upstream); upstream.once('close',() => this.upstreams.delete(upstream));
    const timer = setTimeout(() => { upstream.destroy(); socket.destroy(); },10_000);
    upstream.once('upgrade',(res,peer,upHead) => {
      clearTimeout(timer); this.sockets.add(peer); peer.once('close',() => this.sockets.delete(peer));
      const lines = [`HTTP/1.1 ${res.statusCode} ${res.statusMessage}`];
      for (let i=0;i<res.rawHeaders.length;i+=2) lines.push(`${res.rawHeaders[i]}: ${res.rawHeaders[i+1]}`);
      socket.write(lines.join('\r\n')+'\r\n\r\n'); if (upHead.length) socket.write(upHead); if (head.length) peer.write(head);
      peer.pipe(socket); socket.pipe(peer);
      peer.on('error',() => socket.destroy()); socket.on('error',() => peer.destroy());
      socket.once('close',() => peer.destroy()); peer.once('close',() => socket.destroy());
    });
    upstream.once('response',() => { clearTimeout(timer); upstream.destroy(); socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n'); });
    upstream.once('error',() => { clearTimeout(timer); socket.destroy(); }); upstream.end();
  }
  async close() {
    this.tickets.clear(); this.grants.clear();
    for (const request of this.upstreams) request.destroy();
    for (const socket of this.sockets) socket.destroy();
    if (this.server?.listening) await bounded(new Promise((resolve,reject) => this.server.close(error => error ? reject(error) : resolve())),2_000,'Gateway shutdown');
  }
}
