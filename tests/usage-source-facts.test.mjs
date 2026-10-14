// Q386 SOURCE/FIXTURE: public Host observation interface + actual module/ledger.
// No future source event, application SDK or fake real business operation is introduced.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createReceiptLedger,createUsageEvidence} from '../src/index.js';
function observedHost({packageName='@hanamesh/app-fixture'}={}) {
 let event,activity;
 const host={subscribe:fn=>{event=fn;return()=>{event=undefined;};},onActivity:fn=>{activity=fn;return()=>{activity=undefined;};},
  packageName:()=>packageName,instance:()=>({appId:'fixture',id:'fixture-instance',status:'ready'}),instanceList:()=>[]};
 return{host,event:value=>event?.(value),activity:value=>activity?.(value)};
}
function spy(){const calls=[];return{calls,record:async value=>{calls.push(structuredClone(value));return{disposition:'recorded',eventId:'fixture-spy-only'};}};}
async function settle(evidence){await evidence.flush({includeCurrent:true});await evidence.settle();}

test('USF01 persisted closed Router receipt on startup is not an original business success and is never sent',async t=>{
 const original=Date.UTC(2026,8,22,10),now=Date.UTC(2026,8,22,12),writes=[];
 const domain={global:{snapshot:{schema:1,items:{}},get(){return structuredClone(this.snapshot);},async set(value){this.snapshot=structuredClone(value);writes.push(value);}}};
 const before=createReceiptLedger({domain,clock:()=>original,persistDelayMs:0});before.inject({appId:'fixture',instanceId:'old-instance',routes:[{providerId:'fixture',model:null}],at:original});before.activity({appId:'fixture',instanceId:'old-instance',at:original});await before.close();
 const receipts=createReceiptLedger({domain,clock:()=>now,persistDelayMs:0}),seat=spy(),h=observedHost();
 const evidence=createUsageEvidence({host:h.host,seat:()=>seat,receipts,clock:()=>now,sweepIntervalMs:0});t.after(async()=>{evidence.close();await evidence.settle();await receipts.close();});
 await settle(evidence);await receipts.persist();assert.equal(receipts.list()[0].count,1,'Router diagnostic count is retained');
 assert.equal(receipts.list()[0].firstAt,new Date(original).toISOString(),'original diagnostic time is retained, not made into a new success');
 assert.deepEqual(seat.calls,[],'restoring an old receipt cannot invent a new original open/use fact');
 assert.ok(receipts.list().every(row=>!row.reported),'no Usage acceptance may be manufactured on restore');
});

for(const [name,packageName,at]of [['only receiver/runtime time, no original presentation/success time','@hanamesh/app-fixture',Date.UTC(2026,8,22,12)],['unknown attribution',null,Date.UTC(2026,8,22,12)]]){
 test(`USF02 ${name}: no original presentation/success means no fact, no receiver-now substitution and a visible bounded diagnostic`,async t=>{
  const seat=spy(),logs=[],h=observedHost({packageName}),evidence=createUsageEvidence({host:h.host,seat:()=>seat,clock:()=>Date.UTC(2026,8,23),sweepIntervalMs:0,logger:{debug:(...args)=>logs.push(args)}});
  t.after(async()=>{evidence.close();await evidence.settle();});
  assert.doesNotThrow(()=>h.event({type:'instance.ready',instanceId:'fixture-instance',principalId:'fixture-principal',at}),'a runtime observation with missing source time must not break application availability');
  await settle(evidence);assert.deepEqual(seat.calls,[],'unknown source fact must not call record with a runtime/receiver timestamp');
  assert.match(logs.flat().join(' '),/USAGE_FACT_UNAVAILABLE/,'missing original facts must be diagnosable, never silently treated as recorded');
 });
}

test('USF03 hourly flush, close and recovered transport activity are not a new success even when service returns recorded',async t=>{
 let now=Date.UTC(2026,8,22,10);const seat=spy(),h=observedHost(),receipts=createReceiptLedger({clock:()=>now});
 const evidence=createUsageEvidence({host:h.host,seat:()=>seat,receipts,clock:()=>now,sweepIntervalMs:0});t.after(async()=>{evidence.close();await evidence.settle();});
 h.activity({appId:'fixture',instanceId:'fixture-instance',at:now});now=Date.UTC(2026,8,22,11);await settle(evidence);
 h.event({type:'instance.stopped',instanceId:'fixture-instance',principalId:'fixture-principal',at:now});await settle(evidence);evidence.close();await evidence.settle();
 assert.equal(receipts.list()[0].count,1);assert.deepEqual(seat.calls,[],'flush/stop/dispose cannot ask a permissive service to bless synthetic business facts');
});
