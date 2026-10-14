/** Q386: C-USAGE-LOCAL edition 1. SOURCE/FIXTURE negative facts; not REAL_UI/U2. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { connect } from 'node:net';
import { AppHost, AtomicFileStore, createUsageEvidence, createReceiptLedger, hourBucket, SOURCE_PLUGIN, validateDefinition } from '../src/index.js';
import { definition, temporary, http, input, leaseInput, parentOrigin } from './helpers.mjs';

// SOURCE/FIXTURE only: actual AppHost, gateway and ledger; a call spy is not Usage implementation.
function fakeSeat({ consent='granted', mode='ok' }={}) {
 const calls=[];
 return {calls,record:async value=>{calls.push(structuredClone(value));if(mode==='throw')throw Error('fixture seat rejection');
  return mode==='reject'?{disposition:'rejected',code:'RECORD_FAILED'}:consent==='withheld'?{disposition:'withheld'}:{disposition:'recorded',eventId:'fixture-not-real-usage'};}};
}
const GATE={embedding:'gateway'};
async function hostWith(t,{def=definition(GATE),seat,clock,logger,receipts}={}) {
 const dir=await temporary(),host=new AppHost({store:new AtomicFileStore(join(dir,'sidecar')),dataRoot:join(dir,'data'),parentOrigin,leaseTtlMs:3_600_000,sweepIntervalMs:0,clock});
 host.register(def);await host.init();const evidence=createUsageEvidence({host,seat,logger,receipts,clock,sweepIntervalMs:0});
 t.after(async()=>{evidence.close();await evidence.settle();await host.dispose();await rm(dir,{recursive:true,force:true});});return{host,evidence,dir};
}
// Synthetic HTTP-workspace headers isolate the gateway component. Not native browser evidence.
async function enter(receipt) {
 const boot=await http(receipt.uiUrl,{headers:{referer:parentOrigin+'/', 'sec-fetch-dest':'iframe'}});assert.equal(boot.status,303);
 return{origin:new URL(receipt.uiUrl).origin,cookie:boot.headers['set-cookie'][0].split(';')[0]};
}
const byAction=(calls,action)=>calls.filter(c=>c.action===action);
async function flush(evidence){await evidence.flush({includeCurrent:true});await evidence.settle();}

test('AH-U01: runtime ready, a second view and restart without actual UI presentation never form open',async t=>{
 const seat=fakeSeat(),{host,evidence}=await hostWith(t,{def:{...definition(GATE),packageName:'@hanamesh/app-fixture'},seat:()=>seat});
 const a=await host.open(input('view-a'));assert.equal(a.instance.status,'ready');await host.open(input('view-b'));await evidence.settle();
 await host.close(leaseInput(a));await host.stop(a.instance.id,{confirm:true});await host.open(input('view-c'));await flush(evidence);
 assert.equal(host.list().apps[0].packageName,'@hanamesh/app-fixture');assert.equal(SOURCE_PLUGIN,'@hanamesh/dsh-app-host');
 assert.deepEqual(seat.calls,[],'runtime ready is not an actual presented UI fact');
});

test('AH-U02: gateway denials/resources/200/WS and hour changes retain Router counts but never produce business use',async t=>{
 const seat=fakeSeat();let now=Date.UTC(2026,8,21,10,15);
 const {host,evidence}=await hostWith(t,{def:{...definition(GATE),packageName:'@hanamesh/app-fixture'},seat:()=>seat,clock:()=>now});
 const a=await host.open(input('view-a'));const {origin,cookie}=await enter(a);
 assert.equal((await http(origin+'/')).status,403);assert.equal((await http(origin+'/',{headers:{cookie,origin:'https://attacker.invalid'}})).status,403);
 assert.equal((await http(origin+'/',{headers:{cookie,'sec-fetch-dest':'document'}})).status,403);
 assert.equal((await http(origin+'/forbidden',{headers:{cookie}})).status,403);assert.equal((await http(origin+'/unauthorized',{headers:{cookie}})).status,401);
 await evidence.settle();assert.equal(evidence.receipts.list().length,0); // M11 retains the original assertion failure signature.
 for(const path of ['/','/second','/headers','/data'])assert.equal((await http(origin+path,{headers:{cookie}})).status,200);
 await evidence.settle();assert.deepEqual(evidence.receipts.list().map(r=>({hour:r.hour,count:r.count,providerId:r.providerId,reported:r.reported})),[{hour:'2026092110',count:4,providerId:null,reported:false}]);
 assert.equal(hourBucket(now),'2026092110');
 assert.deepEqual(evidence.receipts.pending({now}),[],'the running hour is not reported yet');
 now=Date.UTC(2026,8,21,11,0,1);await host.heartbeat(leaseInput(a));assert.equal((await http(origin+'/',{headers:{cookie}})).status,200);
 await evidence.settle();assert.deepEqual(evidence.receipts.pending({now}).map(r=>r.hour),['2026092110'],'only closed Router rows are pending');
 now=Date.UTC(2026,8,21,12);await host.heartbeat(leaseInput(a));const u=new URL(origin);let response='';
 await new Promise((resolve,reject)=>{const socket=connect(Number(u.port),u.hostname),timer=setTimeout(()=>{socket.destroy();reject(Error('fixture WS response missing'));},3000);
  socket.once('connect',()=>socket.write(`GET /socket HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\nCookie: ${cookie}\r\nOrigin: ${origin}\r\n\r\n`));
  socket.once('data',data=>{response=data.toString();clearTimeout(timer);socket.destroy();resolve();});socket.once('error',error=>{clearTimeout(timer);socket.destroy();reject(error);});});
 assert.match(response,/^HTTP\/1.1 101/);await evidence.settle();assert.equal(evidence.receipts.list().find(r=>r.hour==='2026092112').count,1,'WS is an independent Router transport count');
 await host.close(leaseInput(a));await host.stop(a.instance.id,{confirm:true});await flush(evidence);
 assert.equal(evidence.receipts.routeOf(a.instance.id),null);assert.ok(evidence.receipts.list().every(r=>!r.reported),'no Usage acceptance is fabricated');
 assert.deepEqual(byAction(seat.calls,'use'),[],'authorized HTTP/resources/WS, hour boundaries and stopping are not successful business facts');
});

test('AH-U03: absent/incompatible/late service never changes application availability and never supplies missing facts',async t=>{
 let seat;const {host,evidence}=await hostWith(t,{def:{...definition(GATE),packageName:'@hanamesh/app-fixture'},seat:()=>seat});
 for(const [name,value]of [['absent',undefined],['incompatible',{notRecord:true}],['late',fakeSeat()]]){
  seat=value;const a=await host.open(input('view-'+name));assert.equal(a.instance.status,'ready');const e=await enter(a);
  assert.equal((await http(e.origin+'/',{headers:{cookie:e.cookie}})).status,200);await host.close(leaseInput(a));await host.stop(a.instance.id,{confirm:true});await flush(evidence);
 }
 assert.deepEqual(seat.calls,[],'service appearance is not a source fact');
});

test('AH-U04: rejected/throwing/withheld optional seats cannot break apps or turn traffic into record attempts/retries',async t=>{
 for(const opts of [{mode:'throw'},{mode:'reject'},{consent:'withheld'}]){
  const seat=fakeSeat(opts),{host,evidence}=await hostWith(t,{def:{...definition(GATE),packageName:'@hanamesh/app-fixture'},seat:()=>seat});
  const a=await host.open(input('view-'+(opts.mode??opts.consent)));assert.equal(a.instance.status,'ready');const e=await enter(a),result=await http(e.origin+'/',{headers:{cookie:e.cookie}});
  assert.equal(result.status,200);assert.match(result.body.toString(),/HANAMESH_FIXTURE/);await host.close(leaseInput(a));await host.stop(a.instance.id,{confirm:true});await flush(evidence);await flush(evidence);
  assert.equal(evidence.receipts.list()[0].reported,false,'unaccepted Router diagnostics stay unreported');
  assert.deepEqual(seat.calls,[],'no legal source fact: no automatic record or retry against any service disposition');
 }
 const sync={record:()=>{throw Error('fixture synchronous rejection');}},h=await hostWith(t,{def:{...definition(GATE),packageName:'@hanamesh/app-fixture'},seat:()=>sync});
 assert.equal((await h.host.open(input('view-sync'))).instance.status,'ready');await h.evidence.settle();
});

test('AH-U05: package binding is independent attribution, never an actual UI fact or a guessed directory/app identity',async t=>{
 const seat=fakeSeat(),{host,evidence}=await hostWith(t,{seat:()=>seat});const a=await host.open(input('view-a'));await evidence.settle();assert.deepEqual(seat.calls,[]);
 assert.equal(host.packageName('example'),null);assert.equal(host.list().apps[0].packageName,null);host.bindPackageName('example','@hanamesh/app-fixture');
 assert.equal(host.packageName('example'),'@hanamesh/app-fixture');await host.close(leaseInput(a));await host.stop(a.instance.id,{confirm:true});await host.open(input('view-b'));await flush(evidence);
 assert.throws(()=>host.bindPackageName('example','Not A Package'),{code:'INVALID_PACKAGE_NAME'});assert.throws(()=>host.bindPackageName('../x','@hanamesh/app-x'),{code:'INVALID_ID'});
 host.register({...definition({id:'declared',...GATE}),packageName:'@hanamesh/app-declared'});host.bindPackageName('declared','@hanamesh/app-other');assert.equal(host.packageName('declared'),'@hanamesh/app-declared');assert.equal(host.packageName('nobody'),null);
 assert.throws(()=>validateDefinition({...definition(),packageName:'@Bad/Name'}),{code:'INVALID_DEFINITION'});assert.throws(()=>validateDefinition({...definition(),packageName:'owner/repo'}),{code:'INVALID_DEFINITION'});
 assert.equal(validateDefinition({...definition(),packageName:'fixture-app'}).packageName,'fixture-app');assert.deepEqual(seat.calls,[],'known package alone must not manufacture open');
});

test('AH-U06: multiple instances keep independent Router hour aggregation without manufacturing open/use, including disposal',async t=>{
 const seat=fakeSeat();let now=Date.UTC(2026,8,21,9);const {host,evidence}=await hostWith(t,{def:{...definition({single:false,...GATE}),packageName:'@hanamesh/app-fixture'},seat:()=>seat,clock:()=>now});
 const a=await host.open(input('view-a')),b=await host.open(input('view-b'));assert.notEqual(a.instance.id,b.instance.id);const ea=await enter(a),eb=await enter(b);
 for(const e of [ea,eb])assert.equal((await http(e.origin+'/',{headers:{cookie:e.cookie}})).status,200);await evidence.settle();
 assert.deepEqual(evidence.receipts.list().map(r=>({hour:r.hour,count:r.count})),[{hour:'2026092109',count:2}]);await host.close(leaseInput(a));await host.stop(a.instance.id,{confirm:true});
 now=Date.UTC(2026,8,21,9,30);await host.heartbeat(leaseInput(b));assert.equal((await http(eb.origin+'/second',{headers:{cookie:eb.cookie}})).status,200);
 await host.close(leaseInput(b));await host.stop(b.instance.id,{confirm:true});await flush(evidence);assert.equal(evidence.receipts.list()[0].count,3);evidence.close();await evidence.settle();
 const c=await host.open(input('view-c')),ec=await enter(c);now=Date.UTC(2026,8,21,10);assert.equal((await http(ec.origin+'/',{headers:{cookie:ec.cookie}})).status,200);
 await host.close(leaseInput(c));await host.stop(c.instance.id,{confirm:true});await evidence.settle();assert.deepEqual(seat.calls,[],'neither instance/last-stop/close may fabricate a fact');
});

test('AH-U08 (T6): Router injection/request counts and route validation remain independent of business Usage',async t=>{
 const seat=fakeSeat();let now=Date.UTC(2026,8,22,10,30);const receipts=createReceiptLedger({clock:()=>now});
 const {host,evidence}=await hostWith(t,{def:{...definition(GATE),packageName:'@hanamesh/app-fixture'},seat:()=>seat,clock:()=>now,receipts});const a=await host.open(input('view-a'));
 assert.deepEqual(receipts.inject({appId:'example',instanceId:a.instance.id,routes:[{providerId:'deepseek',model:'deepseek-chat'},{providerId:'openai',model:null}],at:now}),{appId:'example',providerId:'deepseek',model:'deepseek-chat',hour:'2026092210',count:0,injections:1,firstAt:now,lastAt:now,reported:false});
 assert.deepEqual(receipts.routeOf(a.instance.id),{providerId:'deepseek',model:'deepseek-chat'});const {origin,cookie}=await enter(a);
 for(const path of ['/','/second','/data'])assert.equal((await http(origin+path,{headers:{cookie}})).status,200);await evidence.settle();
 assert.deepEqual(evidence.receipts.list().map(r=>({providerId:r.providerId,model:r.model,hour:r.hour,count:r.count,injections:r.injections})),[{providerId:'deepseek',model:'deepseek-chat',hour:'2026092210',count:3,injections:1}]);
 now=Date.UTC(2026,8,22,11);await host.heartbeat(leaseInput(a));assert.equal((await http(origin+'/',{headers:{cookie}})).status,200);await host.close(leaseInput(a));await host.stop(a.instance.id,{confirm:true});await flush(evidence);
 const b=await host.open(input('view-b')),eb=await enter(b);now=Date.UTC(2026,8,22,11,45);await host.heartbeat(leaseInput(b));now=Date.UTC(2026,8,22,12);await host.heartbeat(leaseInput(b));assert.equal((await http(eb.origin+'/',{headers:{cookie:eb.cookie}})).status,200);await evidence.settle();
 assert.deepEqual(evidence.receipts.list().find(r=>r.hour==='2026092212'),{appId:'example',providerId:null,model:null,hour:'2026092212',count:1,injections:0,firstAt:'2026-09-22T12:00:00.000Z',lastAt:'2026-09-22T12:00:00.000Z',reported:false});
 await host.close(leaseInput(b));await host.stop(b.instance.id,{confirm:true});await flush(evidence);
 assert.equal(receipts.inject({appId:'example',instanceId:'x',routes:[{providerId:'sk-live-key',model:null}]}),null);assert.equal(receipts.inject({appId:'example',instanceId:'y',routes:[{providerId:'openai',model:'has space'}]}).model,null);
 assert.throws(()=>receipts.inject({appId:'../x',instanceId:'z',routes:[]}),{code:'INVALID_APP'});assert.deepEqual(byAction(seat.calls,'use'),[],'diagnostic receipts never become business use');
});

test('AH-U09 (T6): the receipt ledger persists through one debounced global.set, reloads closed diagnostic rows and prunes; no business Usage implication', async () => {
  let now = Date.UTC(2026,8,22,10,0,0); const writes = [];
  const domain = { global:{ snapshot:{ schema:1, items:{} }, get(){ return structuredClone(this.snapshot); }, async set(v){ writes.push(structuredClone(v)); this.snapshot = structuredClone(v); } } };
  const ledger = createReceiptLedger({ domain, clock:() => now, persistDelayMs:0 });
  ledger.inject({ appId:'vibe', instanceId:'i1', routes:[{ providerId:'deepseek', model:'deepseek-chat' }], at:now });
  for (let i = 0; i < 5; i++) ledger.activity({ appId:'vibe', instanceId:'i1', at:now + i*1000 });
  await ledger.persist();
  assert.equal(writes.at(-1).items['vibe|deepseek|deepseek-chat|2026092210'].count,5);
  assert.deepEqual(ledger.pending({ now }),[],'the running hour is not pending');
  assert.deepEqual(ledger.pending({ now, includeCurrent:true }),[{ appId:'vibe', hour:'2026092210', occurredAt:now, count:5, receipt:{ providerId:'deepseek', model:'deepseek-chat', count:5 } }]);
  // A new process loads the snapshot: the hour is closed now and pending; routes are not remembered across runs.
  now = Date.UTC(2026,8,22,11,30,0);
  const reloaded = createReceiptLedger({ domain, clock:() => now, persistDelayMs:0 });
  assert.equal(reloaded.routeOf('i1'),null);
  assert.deepEqual(reloaded.pending({ now }).map(p => [p.appId,p.hour,p.receipt.count]),[['vibe','2026092210',5]]);
  assert.equal(reloaded.markReported('vibe','2026092210'),1); await reloaded.persist();
  assert.equal(writes.at(-1).items['vibe|deepseek|deepseek-chat|2026092210'].reported,true);
  assert.deepEqual(reloaded.pending({ now }),[]);
  // Debounce: many activities → one publication; retention prunes rows older than 90 days.
  const debounced = createReceiptLedger({ domain, clock:() => now, persistDelayMs:20 });
  const before = writes.length; for (let i = 0; i < 50; i++) debounced.activity({ appId:'vibe', instanceId:'i2', at:now });
  await new Promise(r => setTimeout(r,60)); assert.equal(writes.length,before+1);
  now = Date.UTC(2027,0,1,0,0,0); debounced.activity({ appId:'vibe', instanceId:'i2', at:now }); await debounced.persist();
  assert.deepEqual(Object.keys(writes.at(-1).items),['vibe|||2027010100']);
  await debounced.close();
  // Bad domains and options fail closed at construction.
  assert.throws(() => createReceiptLedger({ domain:{ global:{} } }),{ code:'INVALID_DOMAIN' });
  assert.throws(() => createReceiptLedger({ persistDelayMs:-1 }),{ code:'INVALID_OPTIONS' });
});
