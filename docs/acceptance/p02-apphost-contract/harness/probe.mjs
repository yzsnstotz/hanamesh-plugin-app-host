// usage: node probe.mjs <tag> <port> <action> [args]   actions: apps | open <viewId> | close <viewId> | stop | routes | procs <dataRoot>
// Authenticates exactly like the browser (session token → cookie, same-origin header); writes a token-free JSON line to stdout.
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const [tag, port, action, ...rest] = process.argv.slice(2), RUN = process.env.RUN, origin = `http://127.0.0.1:${port}`;
let cookie = '';
async function login() {
  const url = (await readFile(`${RUN}/${tag}.url`, 'utf8')).trim();
  const res = await fetch(url, { redirect:'manual' }); cookie = (res.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ');
}
const call = async (path, body) => { const res = await fetch(origin + path, { method:body ? 'POST' : 'GET', headers:{ cookie, origin, ...(body ? { 'content-type':'application/json' } : {}) }, body:body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = text.slice(0, 120); } return { status:res.status, json }; };
const tokens = new Map(); const tokFile = `${RUN}/${tag}.leases.json`;
try { for (const [k,v] of Object.entries(JSON.parse(await readFile(tokFile,'utf8')))) tokens.set(k,v); } catch {}
const save = async () => (await import('node:fs/promises')).writeFile(tokFile, JSON.stringify(Object.fromEntries(tokens)), { mode:0o600 });
const ps = root => execFileSync('ps', ['-axo', 'pid=,pgid=,command='], { encoding:'utf8' }).split('\n').filter(l => l.includes(root) || l.includes('CONTRACT_FIXTURE_READY')).filter(l => !l.includes('probe.mjs') && !l.includes('ps -axo'));
const out = { tag, action };
if (action === 'procs') { const lines = ps(rest[0]); Object.assign(out, { count:lines.length, commands:lines.map(l => l.trim().split(/\s+/).slice(2).join(' ').replace(RUN, '$RUN').slice(0, 160)) }); }
else {
  await login();
  if (action === 'apps') { const r = await call('/hanamesh/apps'); const j = r.json; Object.assign(out, { status:r.status, apps:j.apps?.map(a => a.id), appCount:j.apps?.length,
    instances:j.instances?.map(i => ({ appId:i.appId, status:i.status })), views:j.views?.map(v => ({ viewId:v.viewId, status:v.status })) }); }
  else if (action === 'open') { const r = await call('/apps/open', { appId:'contract-fixture', deploymentId:'local', viewId:rest[0] });
    if (r.json?.leaseToken) { tokens.set(rest[0], r.json.leaseToken); await save(); }
    Object.assign(out, { status:r.status, code:r.json?.code, instanceStatus:r.json?.instance?.status, gateway:Boolean(r.json?.instance?.gatewayOrigin ?? r.json?.url) }); }
  else if (action === 'close') { const r = await call('/apps/close', { viewId:rest[0], leaseToken:tokens.get(rest[0]) }); Object.assign(out, { status:r.status, code:r.json?.code, instanceStatus:r.json?.instance?.status }); }
  else if (action === 'routes') { for (const p of ['/hanamesh/apps', '/hanamesh/library', '/hanamesh/core/status']) out[p] = (await call(p)).status;
    const anon = await fetch(origin + '/hanamesh/apps'); out.unauthenticated = anon.status; }
}
console.log(JSON.stringify(out));
