// Loopback stand-in for Core's server/website origins: records method/path/header names only (no values, no bodies), answers 503.
import http from 'node:http'; import fs from 'node:fs';
const log = process.argv[2];
http.createServer((req, res) => { let n = 0; req.on('data', c => n += c.length); req.on('end', () => {
  fs.appendFileSync(log, JSON.stringify({ ts:new Date().toISOString(), method:req.method, path:req.url.split('?')[0], headerNames:Object.keys(req.headers).sort(), bodyBytes:n }) + '\n');
  res.writeHead(503, { 'content-type':'application/json' }); res.end('{"error":"P02_APPHOST_STUB"}'); }); })
  .listen(35414, '127.0.0.1', () => console.log('stub 127.0.0.1:35414'));
