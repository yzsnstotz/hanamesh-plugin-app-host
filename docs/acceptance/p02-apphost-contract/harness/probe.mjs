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
const call = async (path, body) => { const res = await fetch(origin + path, { method:body ? 'POST' : 'GET', headers:{ cookie, origin, ...(body ? { 'content-type':'application/json', 'x-hanamesh-client':'workspace-v1' } : {}) }, body:body ? JSON.stringify(body) : undefined });
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
  else if (action === 'wait-ready') { let j; for (let i = 0; i < 80; i++) { j = (await call('/hanamesh/apps')).json; if (j.instances?.some(x => x.appId === 'contract-fixture' && x.status === 'ready')) break; await new Promise(r => setTimeout(r, 250)); }
    Object.assign(out, { instances:j.instances?.map(i => ({ id:i.id.slice(0, 8), appId:i.appId, status:i.status, pid:i.pid })) }); }
  else if (action === 'events') { const r = await call('/apps/events?after=0'); const ev = r.json.events ?? [];
    const counts = {}; for (const e of ev) counts[e.type] = (counts[e.type] ?? 0) + 1;
    Object.assign(out, { status:r.status, total:ev.length, counts, duplicateSequences:ev.length - new Set(ev.map(e => e.sequence)).size, instanceIds:[...new Set(ev.map(e => e.instanceId?.slice(0, 8)))] }); }
  else if (action === 'installed') { const r = await call('/hanamesh/library/installedPlugins'); Object.assign(out, { status:r.status,
    apps:r.json.apps?.map(a => ({ packageName:a.packageName, version:a.version, state:a.state, contractVersion:a.contractVersion, hostLifecycle:a.hostLifecycle })),
    plugins:r.json.plugins?.map(p => `${p.packageName}@${p.version}:${p.state}`) }); }
  else if (action === 'routes') { for (const p of ['/hanamesh/apps', '/hanamesh/library', '/hanamesh/core/status']) out[p] = (await call(p)).status;
    const anon = await fetch(origin + '/hanamesh/apps'); out.unauthenticated = anon.status; }
}
console.log(JSON.stringify(out));
