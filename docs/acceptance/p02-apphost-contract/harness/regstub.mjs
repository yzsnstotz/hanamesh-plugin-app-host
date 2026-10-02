// Test-only loopback read-through registry (127.0.0.1:35415): proxies GETs to the machine's local registry 127.0.0.1:4873 and adds
// exactly one unpublished local candidate version to one packument, served from the local tarball. Publishes nothing anywhere.
// usage: node regstub.mjs <package name> <version> <tarball path> <log>
import http from 'node:http'; import fs from 'node:fs'; import crypto from 'node:crypto'; import { execFileSync } from 'node:child_process';
const [name, version, tarball, log] = process.argv.slice(2), UP = 'http://127.0.0.1:4873', SELF = 'http://127.0.0.1:35415';
const bytes = fs.readFileSync(tarball), file = `${name.split('/').pop()}-${version}.tgz`;
const dist = { tarball:`${SELF}/${name}/-/${file}`, integrity:'sha512-' + crypto.createHash('sha512').update(bytes).digest('base64'), shasum:crypto.createHash('sha1').update(bytes).digest('hex') };
const manifest = JSON.parse(execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], { encoding:'utf8' }));
http.createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]); fs.appendFileSync(log, `${new Date().toISOString()} ${req.method} ${path}\n`);
  if (path === `/${name}/-/${file}`) { res.writeHead(200, { 'content-type':'application/octet-stream' }); return res.end(bytes); }
  const up = await fetch(UP + req.url, { headers:{ accept:req.headers.accept ?? 'application/json' } });
  let body = Buffer.from(await up.arrayBuffer());
  if (path === `/${name}` && up.ok) { const doc = JSON.parse(body); doc.versions[version] = { ...manifest, dist }; doc.time = { ...(doc.time ?? {}), [version]:new Date().toISOString() }; body = Buffer.from(JSON.stringify(doc)); }
  res.writeHead(up.status, { 'content-type':up.headers.get('content-type') ?? 'application/json' }); res.end(body);
}).listen(35415, '127.0.0.1', () => console.log('regstub 127.0.0.1:35415', name, version, dist.integrity.slice(0, 20)));
