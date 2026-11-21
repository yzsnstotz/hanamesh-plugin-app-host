// Copied into a throwaway extraction of the official Market 0.1.1 tarball.
// Bare @hanamesh/market is the package's PUBLIC self-reference, so mutation
// copies exercise the changed provider instead of an original node_modules link.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {Context} from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as storageJson from '@deepseek-ai/dsh-storage-json';
import * as storageDomain from '@deepseek-ai/dsh-storage-domain';
import WebServer from '@deepseek-ai/dsh-host-webserver';
import * as market from '@hanamesh/market';
assert.equal(import.meta.resolve('@hanamesh/market'),new URL('../lib/index.js',import.meta.url).href,'public self-reference must select the current normal/mutated provider copy');
const SITE='https://market.hanamesh.com',EVIL='https://unapproved.example';
const PROBE='/hanamesh/library/install-target',STATUS='/hanamesh/library/installation-status';
const consent={contractVersion:'1',consent:'read-installations'};
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error('public test services did not start');}
async function boot(t,kind,ports={},core){
 const root=await mkdtemp(join(tmpdir(),'hm-market-owner-')),ctx=new Context();
 t.after(async()=>{await ctx.fiber.dispose();await rm(root,{recursive:true,force:true});});
 const reservation=createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;
 ctx.plugin(Storage);ctx.plugin(storageJson,{root:join(root,'storage')});ctx.plugin(storageDomain,{backend:'json'});ctx.plugin(WebServer,{host:'127.0.0.1',port:0});ctx.provide('connection',{requestRejection:()=>undefined});if(core)ctx.provide('hanameshCore',core);
 await ctx.start?.();await until(()=>ctx.get('webServer')?.port>0);await new Promise(resolve=>reservation.close(resolve));
 const outcome=Promise.withResolvers();ctx.plugin({name:market.name,inject:market.inject,async apply(child){try{await market.apply(child,{handoff:{enabled:kind==='handoff',ports:[port],allowedOrigins:[SITE]}});outcome.resolve(null);}catch(error){outcome.resolve(error);throw error;}}});
 const error=await outcome.promise;if(error)throw error;
 Object.assign(ctx.get('hanameshMarket'),ports);
 return{ctx,base:`http://127.0.0.1:${kind==='handoff'?port:ctx.get('webServer').port}`};
}
const post=(base,origin=SITE,body=consent)=>fetch(base+STATUS,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
for(const kind of ['host','handoff']){
 test(`D3 ${kind} constant refusal preserves private capabilities`,async t=>{
  let reads=0;const h=await boot(t,kind,{installTarget:()=>{reads++;return{client:'hanamesh',ready:true,need:['private-capability']};}});
  for(const origin of [EVIL,'https://another.example:8443']){
   const res=await fetch(h.base+PROBE,{headers:{origin}});assert.equal(res.status,403,'unapproved discovery remains refused');assert.equal(res.headers.get('access-control-allow-origin'),origin,'fixed refusal must stay CORS-readable');assert.equal(res.headers.get('vary'),'Origin');
   for(const field of ['access-control-allow-credentials','access-control-allow-private-network','access-control-allow-headers','access-control-allow-methods','access-control-max-age'])assert.equal(res.headers.get(field),null);
   assert.equal(res.headers.get('cache-control'),'no-store');const body=await res.json();assert.deepEqual(body,{error:{code:'ORIGIN_DENIED',message:'This website is not allowed to read discovery.'}},'constant refusal keeps capabilities private');assert.doesNotMatch(JSON.stringify(body),/client|ready|need|installationStatus|allowedOrigins|traceId/);assert.equal(reads,0,'refusal cannot invoke the capability reader');
  }
  assert.equal((await fetch(h.base+PROBE,{headers:{origin:SITE}})).status,200);assert.equal(reads,1);
 });
 test(`D3 ${kind} preflight keeps conditional PNA and successful GET admission`,async t=>{
  let reads=0;const h=await boot(t,kind,{installTarget:()=>{reads++;return{client:'dsh',ready:true};}});
  for(const origin of [EVIL,SITE])for(const pna of [undefined,'true']){
   const res=await fetch(h.base+PROBE,{method:'OPTIONS',headers:{origin,'access-control-request-method':'GET',...(pna?{'access-control-request-private-network':pna}:{})}});
   assert.equal(res.status,204,'GET preflight must permit reading the later fixed refusal');assert.equal(await res.text(),'');assert.equal(res.headers.get('access-control-allow-origin'),origin);assert.equal(res.headers.get('access-control-allow-methods'),'GET');assert.equal(res.headers.get('access-control-allow-private-network'),pna??null,'PNA is conditional on the explicit request');assert.equal(res.headers.get('access-control-allow-credentials'),null);assert.equal(res.headers.get('access-control-max-age'),null);for(const field of ['Origin','Access-Control-Request-Method','Access-Control-Request-Headers','Access-Control-Request-Private-Network'])assert.ok(res.headers.get('vary').split(',').map(x=>x.trim()).includes(field));assert.equal(reads,0);
  }
  assert.equal((await fetch(h.base+PROBE,{headers:{origin:EVIL}})).status,403);assert.equal(reads,0);
 });
 test(`IS ${kind} Origin admission happens before any reader`,async t=>{
  let reads=0;const h=await boot(t,kind,{installationStatus:async()=>{reads++;return{schemaVersion:1,client:'dsh',observations:[]};}});
  const refused=await post(h.base,EVIL);assert.equal(refused.status,403,'status Origin must be rejected before any reader');assert.equal((await refused.json()).error.code,'ORIGIN_DENIED');assert.equal(refused.headers.get('access-control-allow-origin'),null);assert.equal(reads,0);
  assert.equal((await post(h.base)).status,200);assert.equal(reads,1);
 });
 test(`IS ${kind} exact one-request consent happens before any reader`,async t=>{
  let reads=0;const h=await boot(t,kind,{installationStatus:async()=>{reads++;return{schemaVersion:1,client:'dsh',observations:[]};}});
  for(const body of [{},{contractVersion:'1'},{consent:'read-installations'},{contractVersion:'1',consent:'install'}]){
   const refused=await post(h.base,SITE,body);assert.equal(refused.status,403,'exact explicit consent is required before any reader');assert.equal((await refused.json()).error.code,'INSTALLATION_STATUS_CONSENT_REQUIRED');assert.equal(reads,0);
  }
  assert.equal((await post(h.base)).status,200);assert.equal(reads,1);
 });
 test(`IS ${kind} public entry wires a consented fresh Core reader`,async t=>{
  let calls=0;let value=JSON.parse(await readFile(new URL('./core-declaration.json',import.meta.url),'utf8'));
  const core={protocolVersion:'1',getSuiteDeclaration:async(...args)=>{assert.deepEqual(args,[]);calls++;return structuredClone(value);}};
  const h=await boot(t,kind,{},core),before=calls;
  const probe=await(await fetch(h.base+PROBE,{headers:{origin:SITE}})).json();assert.equal(probe.installationStatus.contract,'hanamesh.installation-status');assert.equal(probe.installationStatus.path,STATUS);assert.equal(calls,before,'capability advertisement never performs a read');
  const first=await post(h.base);assert.equal(first.status,200,'real Market entry wires a consented fresh Core reader');assert.equal((await first.json()).observations.find(row=>row.channel==='dsh').status,'installed');assert.equal(calls,before+1);
  value={...value,completeness:'unknown',blocked:[{code:'CORE_SUITE_PEER_UNKNOWN'}]};
  const second=await post(h.base);assert.equal(second.status,200);assert.equal((await second.json()).observations.find(row=>row.channel==='dsh').status,'unknown');assert.equal(calls,before+2,'later request cannot reuse a stale installed answer');
  delete core.getSuiteDeclaration;const missing=await post(h.base);assert.equal(missing.status,200);assert.equal((await missing.json()).observations.find(row=>row.channel==='dsh').reason.code,'CORE_SUITE_DECLARATION_MISSING');assert.equal(calls,before+2);
 });
}
