import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHandoffHandler} from '../src/library/handoff.js';
import {createLibraryHttpHandler} from '../src/library/routes.js';
import {createLibraryService} from '../src/library/service.js';
const SITE='https://market.example',PATH='/hanamesh/library/installation-status';
const body={contractVersion:'1',consent:'read-installations'};
async function server(t,kind,read){
 let base;const library={installationStatus:read,installTarget:()=>({client:'dsh',ready:false}),handoffSettings:()=>({allowedOrigins:[SITE]})};
 const s=createServer((req,res)=>(kind==='handoff'?createHandoffHandler({library,queue:{},settings:library.handoffSettings,port:()=>new URL(base).port}):createLibraryHttpHandler(library,{parentOrigin:base,authenticate:()=>{throw new Error('status must not authenticate')},authorize:()=>{throw new Error('status must not authorize installs')}}))(req,res));
 await new Promise(r=>s.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${s.address().port}`;t.after(()=>new Promise(r=>{s.close(r);s.closeAllConnections()}));return base;
}
for(const kind of ['handoff','host'])test(`${kind} status POST reads only after explicit consent and strict admission`,async t=>{
 let reads=0;const base=await server(t,kind,async()=>{reads++;return{schemaVersion:1,client:'dsh',observations:[]}});
 const send=(value=body,headers={})=>fetch(base+PATH,{method:'POST',headers:{origin:SITE,'content-type':'application/json',...headers},body:JSON.stringify(value)});
 for(const [value,headers,code]of [[body,{origin:'https://evil.example'},'ORIGIN_DENIED'],[{}, {},'INSTALLATION_STATUS_CONSENT_REQUIRED'],[{...body,command:'touch /tmp/no'}, {},'UNKNOWN_FIELDS'],[{...body,contractVersion:'2'}, {},'INSTALLATION_STATUS_CONTRACT_UNSUPPORTED'],[body,{cookie:'session=private'},'CREDENTIALS_NOT_ACCEPTED']]){
  const res=await send(value,headers);assert.ok(res.status>=400,'rejected requests must not call readers');assert.equal((await res.json()).error.code,code);assert.equal(reads,0);
 }
 const preflight=await fetch(base+PATH,{method:'OPTIONS',headers:{origin:SITE}});assert.equal(preflight.status,204);assert.equal(reads,0);
 const res=await send();assert.equal(res.status,200);assert.equal(res.headers.get('access-control-allow-origin'),SITE);assert.equal(res.headers.get('cache-control'),'no-store');assert.equal((await res.json()).client,'dsh');assert.equal(reads,1);
});
test('capability is advertised without reading any installation and invokes a fresh explicit reader',async()=>{
 let reads=0;const library=createLibraryService({domain:{global:{get:async()=>({revision:1,sources:[]})}},host:{},config:{},dataRoot:'/unused',installationStatus:async()=>({schemaVersion:1,checkedAt:String(++reads)})});
 await library.init();const probe=library.installTarget();assert.equal(probe.installationStatus?.contract,'hanamesh.installation-status');assert.equal(reads,0);
 assert.equal((await library.installationStatus()).checkedAt,'1');assert.equal((await library.installationStatus()).checkedAt,'2');
});
test('separate authoritative reader is publicly implemented',async()=>{
 const module=await import('../src/library/installation-status.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e});
 assert.equal(typeof module.createInstallationStatusReader,'function');
});
for(const kind of ['handoff','host'])test(`${kind} rejects target/credentials/method/query and aborts a disconnected read`,async t=>{
 let reads=0,aborted=false,canRead=false;const base=await server(t,kind,async({signal})=>{reads++;assert.equal(canRead,true,'invalid request must never invoke a reader');await new Promise(resolve=>signal.addEventListener('abort',()=>{aborted=true;resolve()},{once:true}));throw new Error('cancelled private reader')});
 for(const [suffix,method,headers,value,status] of [[PATH,'GET',{origin:SITE},undefined,405],[PATH,'POST',{},JSON.stringify(body),403],[PATH+'?secret=x','POST',{origin:SITE},JSON.stringify(body),400],[PATH,'POST',{origin:SITE,authorization:'Bearer private'},JSON.stringify(body),403],[PATH,'POST',{origin:SITE,'sec-fetch-dest':'iframe'},JSON.stringify(body),403],[PATH,'POST',{origin:SITE},'not-json',400]]){
  const res=await fetch(base+suffix,{method,headers:{'content-type':'application/json',...headers},body:value});assert.equal(res.status,status);assert.equal(reads,0);
 }
 const {request}=await import('node:http');
 for(const [path,host]of [['http://evil.example'+PATH,new URL(base).host],[PATH,'evil.example:9999']]){await new Promise((resolve,reject)=>{const req=request(base,{path,method:'POST',headers:{host,origin:SITE,'content-type':'application/json'}},res=>{res.resume();res.on('end',()=>{try{assert.ok(res.statusCode>=400);assert.equal(reads,0);resolve()}catch(e){reject(e)}})});req.on('error',reject);req.end(JSON.stringify(body))})}
 canRead=true;const controller=new AbortController();const pending=fetch(base+PATH,{method:'POST',headers:{origin:SITE,'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal}).catch(e=>e);
 for(let i=0;i<100&&reads===0;i++)await new Promise(r=>setTimeout(r,5));assert.equal(reads,1);controller.abort();await pending;
 for(let i=0;i<100&&!aborted;i++)await new Promise(r=>setTimeout(r,5));assert.equal(aborted,true);
});
