import { createServer, request } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { AppHostError, requireCondition, bounded } from './errors.js';
import { documentOrigin, DESKTOP_ORIGIN } from './workspace-origin.js';
import { loopbackOrigin, workspaceOrigin } from './descriptor.js';

/**
 * `frame-ancestors` is matched against EVERY ancestor, not just the direct parent. Inside a
 * desktop shell the chain is `<shell origin>` → DSH workspace → app frame, so the shell's own
 * webview origin (e.g. `tauri://localhost`) must be listed too or the app document is served
 * and then refused by the webview — a blank frame (HanaMesh desktop rc.4, 2026-09-21). The
 * value is `parentOrigin` plus the configured extra ancestors, space-separated.
 */
export function frameAncestorsValue(parentOrigin, frameAncestors = []) {
  return [parentOrigin, ...frameAncestors.filter(origin => origin !== parentOrigin)].join(' ');
}
/** Only exact origins of a scheme a webview can actually host a top-level document on. */
export function ancestorOrigin(value) {
  if (value === DESKTOP_ORIGIN) return value;
  let url;
  try { url = new URL(value); } catch { requireCondition(false, 'INVALID_FRAME_ANCESTOR', 'Expected an explicit ancestor origin.'); }
  requireCondition(['http:', 'https:', 'tauri:', 'asset:', 'file:'].includes(url.protocol) && !url.username && !url.password &&
    (url.pathname === '/' || url.pathname === '') && !url.search && !url.hash && (url.protocol === 'file:' || url.hostname),
    'INVALID_FRAME_ANCESTOR', 'Only scheme://host[:port] ancestor origins are accepted.');
  // `URL.origin` is the string "null" for non-special schemes such as tauri:; rebuild it.
  return url.protocol === 'file:' ? 'file://' : `${url.protocol}//${url.host}`;
}
export function rewriteCsp(value, ancestors) {
  if (/(?:^|;)\s*frame-ancestors\b/i.test(value))
    return value.replace(/(^|;)(\s*)frame-ancestors\b[^;]*/ig, (_, delimiter, whitespace) => `${delimiter}${whitespace}frame-ancestors ${ancestors}`);
  return `${value}${value.trimEnd().endsWith(';') ? '' : ';'} frame-ancestors ${ancestors}`;
}
export function embeddingHeaders(rawHeaders, ancestors) {
  const output = []; let hasCsp = false;
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const key = rawHeaders[i], value = rawHeaders[i + 1];
    if (key.toLowerCase() === 'x-frame-options') continue;
    if (key.toLowerCase() === 'content-security-policy') { output.push(key, rewriteCsp(value, ancestors)); hasCsp = true; }
    else output.push(key, value);
  }
  if (!hasCsp) output.push('Content-Security-Policy', `frame-ancestors ${ancestors}`);
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
  constructor({ upstream, parentOrigin, isLeaseActive, cookieAllowlist = [], allowAppAuthorization = false, maxUploadBytes = 32 * 1024 * 1024, frameAncestors = [], onForward = () => {} }) {
    this.upstream = loopbackOrigin(upstream); this.parentOrigin = workspaceOrigin(parentOrigin);
    requireCondition(Array.isArray(frameAncestors) && frameAncestors.length <= 8, 'INVALID_FRAME_ANCESTOR', 'frameAncestors must be a short list of origins.');
    this.ancestors = frameAncestorsValue(this.parentOrigin, frameAncestors.map(ancestorOrigin));
    requireCondition(typeof isLeaseActive === 'function','INVALID_GATEWAY','A live lease authorization check is required.');
    this.isLeaseActive = isLeaseActive; this.cookieAllowlist = new Set(cookieAllowlist);
    this.allowAppAuthorization = allowAppAuthorization; this.maxUploadBytes = maxUploadBytes;
    requireCondition(typeof onForward === 'function','INVALID_GATEWAY','onForward must be a function.');
    this.onForward = onForward;
    this.children = new Map(); this.scopeKey = null; this.closed = false; this.authorizations = new Map();
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
  async issueAsync(viewKey) {
    if (this.parentOrigin !== DESKTOP_ORIGIN) return this.issue(viewKey);
    requireCondition(!this.closed && this.isLeaseActive(viewKey),'LEASE_EXPIRED','Inactive view.');
    this.revokeInactive();
    let child = this.children.get(viewKey);
    if (!child) {
      requireCondition(this.children.size < 512,'TOO_MANY_TICKETS','Too many views.');
      child = new FixedGateway({upstream:this.upstream,parentOrigin:this.parentOrigin,frameAncestors:this.ancestors.split(' ').slice(1),
        isLeaseActive:key => key === viewKey && this.isLeaseActive(key),cookieAllowlist:[...this.cookieAllowlist],
        allowAppAuthorization:this.allowAppAuthorization,maxUploadBytes:this.maxUploadBytes,onForward:this.onForward});
      child.scopeKey = viewKey;
      await child.start();
      if (this.closed || !this.isLeaseActive(viewKey)) { await child.close(); throw new AppHostError('LEASE_EXPIRED','Inactive view.'); }
      this.children.set(viewKey,child);
      child.expiryTimer = setInterval(() => { if (!child.isLeaseActive(viewKey)) void child.close(); },50);
      child.expiryTimer.unref();
    }
    return child.issue(viewKey);
  }
  authorizeChallenge(viewKey, gatewayOrigin, challenge) {
    const child = this.children.get(viewKey), item = child?.tickets.get(challenge);
    requireCondition(child && !child.closed && child.origin === gatewayOrigin && item && item.viewKey === viewKey &&
      item.loaded && !item.authorized && item.expiresAt > Date.now() && child.isLeaseActive(viewKey),
      'GATEWAY_CHALLENGE_DENIED','Invalid or inactive challenge.',{},403);
    const authorization = token(); item.authorized = true;
    child.authorizations.set(authorization,{challenge,viewKey,expiresAt:item.expiresAt});
    return {authorization};
  }
  revokeInactive() {
    for (const [key,child] of this.children) if (!this.isLeaseActive(key) || child.closed) {
      this.children.delete(key); void child.close();
    }
  }
  #desktopBootstrap(req,res) {
    const challenge = req.url.slice('/__hanamesh_bootstrap/'.length), item = this.tickets.get(challenge);
    if (!this.scopeKey || req.method !== 'GET' || req.headers['sec-fetch-dest'] !== 'iframe' ||
      !item || item.loaded || item.expiresAt <= Date.now() || !this.isLeaseActive(item.viewKey)) return fail(res,403,'GATEWAY_BOOTSTRAP_DENIED');
    item.loaded = true;
    const nonce = token();
    const body = `<!doctype html><meta charset="utf-8"><title>应用连接中</title><p>应用连接中…</p><script nonce="${nonce}">
      const challenge=${JSON.stringify(challenge)}, gatewayOrigin=${JSON.stringify(this.origin)};
      let proved=false, redeemed=false;
      addEventListener('message',async event=>{
        const exact=event.origin==='dsh-app://app'&&event.source===parent;
        console.info('HM_BOOTSTRAP_PROOF',JSON.stringify({origin:event.origin,parent:event.source===parent,accepted:exact}));
        if(!exact||event.data?.challenge!==challenge)return;
        if(event.data.type==='hm-bootstrap-parent'&&!proved){proved=true;parent.postMessage({type:'hm-bootstrap-proof',challenge},'dsh-app://app');}
        if(event.data.type==='hm-bootstrap-authorize'&&proved&&!redeemed&&typeof event.data.authorization==='string'){
          redeemed=true;
          const response=await fetch('/__hanamesh_exchange',{method:'POST',credentials:'omit',headers:{'content-type':'application/json'},
            body:JSON.stringify({challenge,authorization:event.data.authorization})});
          if(response.ok)location.replace('/');else document.querySelector('p').textContent='应用授权失败';
        }
      });
      parent.postMessage({type:'hm-bootstrap-ready',challenge},'dsh-app://app');
    </script>`;
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'origin',
      'content-security-policy':`default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors ${this.ancestors}`});
    res.end(body);
  }
  async #exchange(req,res) {
    if (!this.scopeKey || req.method !== 'POST' || req.headers.origin !== this.origin || req.headers['sec-fetch-site'] !== 'same-origin' ||
      req.headers['content-type'] !== 'application/json') return fail(res,403,'GATEWAY_EXCHANGE_DENIED');
    let body='';
    for await (const chunk of req) { body+=chunk; if(body.length>1024)return fail(res,413,'BODY_TOO_LARGE'); }
    let input; try { input=JSON.parse(body); } catch { return fail(res,400,'INVALID_JSON'); }
    const grant=this.authorizations.get(input.authorization);
    if(!grant || Object.keys(input).some(k=>!['challenge','authorization'].includes(k)) || grant.challenge!==input.challenge ||
      grant.expiresAt<=Date.now() || !this.isLeaseActive(grant.viewKey))return fail(res,403,'GATEWAY_EXCHANGE_DENIED');
    this.authorizations.delete(input.authorization);this.tickets.delete(grant.challenge);
    this.grants.clear();this.grants.set(token(),{viewKey:grant.viewKey});
    res.writeHead(204,{'cache-control':'no-store'});res.end();
  }
  #desktopAuthorized(req) {
    if (!this.scopeKey || this.closed || !this.isLeaseActive(this.scopeKey) ||
      ![...this.grants.values()].some(g=>g.viewKey === this.scopeKey)) return false;
    if (req.headers.upgrade?.toLowerCase() === 'websocket') return req.headers.origin === this.origin;
    let referer;try {referer=documentOrigin(req.headers.referer);}catch{}
    return req.headers['sec-fetch-site'] === 'same-origin' &&
      (req.headers.origin ? req.headers.origin === this.origin : referer === this.origin);
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
    if (this.parentOrigin === DESKTOP_ORIGIN) return this.#desktopAuthorized(req);
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
    try { referer = documentOrigin(req.headers.referer); } catch { return false; }
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
    if (this.parentOrigin === DESKTOP_ORIGIN) return this.#desktopBootstrap(req,res);
    const ticket = req.url.slice('/__hanamesh_bootstrap/'.length);
    const item = this.tickets.get(ticket);
    let referer;
    try { referer = documentOrigin(req.headers.referer); } catch {}
    if (req.method !== 'GET' || req.headers['sec-fetch-dest'] !== 'iframe' || referer !== this.parentOrigin ||
      !item || item.expiresAt <= Date.now() || !this.isLeaseActive(item.viewKey)) return fail(res,403,'GATEWAY_BOOTSTRAP_DENIED');
    this.tickets.delete(ticket);
    const value = token(), suffix = createHash('sha256').update(item.viewKey).digest('hex').slice(0,16);
    const cookieName = this.cookiePrefix + suffix;
    for (const [old,g] of this.grants) if (g.cookieName === cookieName) this.grants.delete(old);
    this.grants.set(value,{ viewKey:item.viewKey, cookieName });
    // No `referrer-policy: no-referrer` here: browsers apply it to the redirect hop, so the
    // `/` navigation that follows arrives without a Referer and the cookie-less embedded path
    // (parent-referer + same-site iframe) can never match (WKWebView, 2026-09-21). The Referer
    // of that hop is the parent document, never this ticket URL, so nothing leaks upstream.
    res.writeHead(303, {
      location:'/', 'set-cookie':`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict`,
      'cache-control':'no-store',
      'content-security-policy':`default-src 'none'; frame-ancestors ${this.ancestors}`,
    });
    res.end();
  }
  /**
   * rc.27 usage evidence: one call per request this gateway actually forwarded for an authorized view and the
   * app answered with anything but 401/403. Bootstrap tickets and every gateway denial never reach here; the
   * host's own readiness probes go to the upstream directly, never through the gateway. A throwing hook must
   * never break the proxied response.
   */
  #forwarded() { try { this.onForward(); } catch {} }
  #handle(req,res) {
    if (!this.#requestShape(req)) return fail(res,403,'GATEWAY_REQUEST_DENIED');
    if (this.parentOrigin === DESKTOP_ORIGIN && req.url === '/__hanamesh_exchange') {
      void this.#exchange(req,res).catch(()=>{if(!res.headersSent)fail(res,400,'GATEWAY_EXCHANGE_DENIED');else res.destroy();});return;
    }
    if (req.url.startsWith('/__hanamesh_bootstrap/')) return this.#bootstrap(req,res);
    if (!this.#authorized(req)) return fail(res,403,'GATEWAY_AUTH_REQUIRED');
    if (!['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(req.method)) return fail(res,405,'METHOD_NOT_ALLOWED');
    if (Number(req.headers['content-length']) > this.maxUploadBytes) return fail(res,413,'UPLOAD_TOO_LARGE');
    const upstream = request(this.upstream + req.url,{ method:req.method,headers:this.#headers(req) }, response => {
      if (response.statusCode !== 401 && response.statusCode !== 403) this.#forwarded();
      res.writeHead(response.statusCode, embeddingHeaders(response.rawHeaders,this.ancestors));
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
      clearTimeout(timer); this.sockets.add(peer); peer.once('close',() => this.sockets.delete(peer)); this.#forwarded();
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
  close() { return this.closeTask ??= this.#close(); }
  async #close() {
    this.closed = true; clearInterval(this.expiryTimer);
    this.tickets.clear(); this.grants.clear(); this.authorizations.clear();
    const children=[...this.children.values()];this.children.clear();
    await Promise.all(children.map(child=>child.close()));
    for (const request of this.upstreams) request.destroy();
    for (const socket of this.sockets) socket.destroy();
    if (this.server?.listening) await bounded(new Promise((resolve,reject) => this.server.close(error => error ? reject(error) : resolve())),2_000,'Gateway shutdown');
  }
}
