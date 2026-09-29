import test from 'node:test';
import assert from 'node:assert/strict';
import {clientHarness,fakeClock,settle} from './fixtures/client-ui-harness.mjs';
async function setup(t,{embedded=true,heartbeat,closeResponder,openResponder}={}){
 const clock=fakeClock(),calls=[];const receipt={instance:{id:'instance-1',appId:'example',status:'ready'},lease:{viewId:'view-1',generation:1,expiresAt:clock.now()+90_000},leaseToken:'test-view-token',uiUrl:'http://127.0.0.1:50001/'};
 const row={appId:'example',state:'registered',packageName:'example',definition:{deployments:[{id:'local'}]}};
 const page={items:[{id:'example',kind:'application',displayName:'Example',installed:row}],installed:[row]};
 const fetch=async(path,init={})=>{const body=init.body?JSON.parse(init.body):undefined;calls.push({path,body,signal:init.signal,keepalive:init.keepalive});let value;
  if(path.startsWith('/hanamesh/library'))value=page;
  else if(path==='/apps/open'){if(openResponder)return openResponder({path,init,clock,calls,receipt});value=receipt;}
  else if(path==='/apps/heartbeat'){if(heartbeat)return heartbeat({path,init,clock,calls,receipt});value={...receipt.lease,expiresAt:clock.now()+90_000};}
  else if(path==='/apps/close'){if(closeResponder)return closeResponder({path,init,clock,calls,receipt});value={instance:{status:'stopped'}};}
  else throw new Error('Unexpected route '+path);
  return{ok:true,json:async()=>value};};
 const client=await clientHarness({fetch,clock,embedded});t.after(()=>client.unmount());if(!embedded)await client.show();await client.click('打开');
 return{client,clock,calls,receipt,renewals:()=>calls.filter(x=>x.path==='/apps/heartbeat'),closes:()=>calls.filter(x=>x.path==='/apps/close')};
}
test('AH-VL01: real market client keeps one idle view renewed beyond its original TTL with exact current credential',async t=>{
 const a=await setup(t);await a.clock.advance(95_000);assert(a.renewals().length>=3,'visible idle view must consume heartbeat before the 90s lease expires');
 for(const call of a.renewals())assert.deepEqual(call.body,{viewId:a.receipt.lease.viewId,leaseToken:a.receipt.leaseToken});
 assert.equal(a.calls.filter(x=>x.path==='/apps/open').length,1);assert.equal(a.calls.filter(x=>x.path==='/apps/resume').length,0);assert.equal(a.closes().length,0);
 assert(a.client.find(node=>node.type==='iframe'),'the existing iframe remains mounted');
});
test('AH-VL02: close-last-view cancels renewals immediately and sends one explicit lease close',async t=>{
 const a=await setup(t);await a.clock.advance(30_000);assert.equal(a.renewals().length,1,'one heartbeat before close');await a.client.click('关闭视图');assert.equal(a.closes().length,1);
 await a.clock.advance(180_000);assert.equal(a.renewals().length,1);assert.equal(a.closes().length,1);assert(!a.client.find(node=>node.type==='iframe'));
});
test('AH-VL03: hiding the overlay releases the exact lease and never keeps a hidden view alive',async t=>{
 const a=await setup(t,{embedded:false});await a.client.hide();assert.equal(a.closes().length,1,'hidden overlay explicitly releases its lease');await a.clock.advance(180_000);assert.equal(a.renewals().length,0);
 await a.client.show();assert(!a.client.find(node=>node.type==='iframe'),'showing market does not resurrect a closed receipt');
});
test('AH-VL04: unmount during in-flight heartbeat aborts it, closes once and ignores its late completion',async t=>{
 let resolveHeartbeat;const a=await setup(t,{heartbeat:()=>new Promise(resolve=>{resolveHeartbeat=resolve;})});await a.clock.advance(30_000);assert.equal(a.renewals().length,1,'heartbeat entered');a.client.unmount();await settle();assert.equal(a.closes().length,1);assert(a.renewals()[0].signal.aborted,'unmount aborts in-flight request');
 resolveHeartbeat({ok:true,json:async()=>({...a.receipt.lease,expiresAt:a.clock.now()+90_000})});await settle();await a.clock.advance(180_000);assert.equal(a.renewals().length,1,'late completion must not schedule another renewal');assert.equal(a.closes().length,1);
});
test('AH-VL05: transient heartbeat transport failure is observed and retried without creating a new view',async t=>{
 let count=0;const a=await setup(t,{heartbeat:async({clock,receipt})=>{if(++count===1)throw new Error('NETWORK_DOWN');return{ok:true,json:async()=>({...receipt.lease,expiresAt:clock.now()+90_000})};}});await a.clock.advance(55_000);assert.equal(a.renewals().length,2,'transient failure retries while original lease is still active');assert.equal(a.calls.filter(x=>x.path==='/apps/open').length,1);
});
test('AH-VL06: terminal expired lease is not silently resumed or renewed forever',async t=>{
 const a=await setup(t,{heartbeat:async()=>({ok:false,status:409,json:async()=>({error:{code:'LEASE_EXPIRED'}})})});await a.clock.advance(180_000);assert.equal(a.renewals().length,1,'expired credential stops renewal');assert.equal(a.calls.filter(x=>x.path==='/apps/open').length,1);assert.equal(a.calls.filter(x=>x.path==='/apps/resume').length,0);
});
test('AH-VL07: pagehide performs best-effort close, cancels heartbeat and unmount does not duplicate close',async t=>{
 const a=await setup(t);a.client.pagehide();await settle();assert.equal(a.closes().length,1,'pagehide releases the held lease');assert.equal(a.closes()[0].keepalive,true);a.client.unmount();await settle();await a.clock.advance(180_000);assert.equal(a.closes().length,1);assert.equal(a.renewals().length,0);
});
test('AH-VL09: clicking close during in-flight heartbeat fences its late response and releases exactly once',async t=>{
 let resolveHeartbeat;const a=await setup(t,{heartbeat:()=>new Promise(resolve=>{resolveHeartbeat=resolve;})});await a.clock.advance(30_000);assert.equal(a.renewals().length,1);await a.client.click('关闭视图');assert.equal(a.closes().length,1);assert(a.renewals()[0].signal.aborted,'close aborts in-flight renewal');
 resolveHeartbeat({ok:true,json:async()=>({...a.receipt.lease,expiresAt:a.clock.now()+90_000})});await settle();await a.clock.advance(180_000);assert.equal(a.renewals().length,1);assert.equal(a.closes().length,1);assert(!a.client.find(node=>node.type==='iframe'));
});
test('AH-VL10: failed close can be explicitly retried after network recovery without restarting renewal',async t=>{
 let count=0;const a=await setup(t,{closeResponder:async()=>{if(++count===1)throw new Error('NETWORK_DOWN');return{ok:true,json:async()=>({instance:{status:'stopped'}})};}});
 await a.client.click('关闭视图');assert.equal(a.closes().length,1);assert(a.client.find(node=>node.type==='iframe'),'failed close keeps receipt available for explicit retry');
 await a.clock.advance(30_000);assert.equal(a.renewals().length,0,'closing never renews after failure');await a.client.click('关闭视图');assert.equal(a.closes().length,2,'network recovery allows a new explicit close request');assert(!a.client.find(node=>node.type==='iframe'));
});
test('AH-VL11: overlapping explicit closes share the in-flight request and successful cleanup remains idempotent',async t=>{
 let resolveClose;const a=await setup(t,{closeResponder:()=>new Promise(resolve=>{resolveClose=resolve;})});await a.client.click('关闭视图');await a.client.click('关闭视图');assert.equal(a.closes().length,1,'in-flight close is shared');
 resolveClose({ok:true,json:async()=>({instance:{status:'stopped'}})});await settle();a.client.unmount();await settle();assert.equal(a.closes().length,1,'successful close stays cached for cleanup');
});
for(const status of ['ready','starting'])test('AH-VL12: late '+status+' Open receipt after hiding is closed without anonymous resume or renewal',async t=>{
 let resolveOpen;const a=await setup(t,{embedded:false,openResponder:()=>new Promise(resolve=>{resolveOpen=resolve;})});await a.client.hide();resolveOpen({ok:true,json:async()=>({...a.receipt,instance:{...a.receipt.instance,status}})});await settle();assert.equal(a.closes().length,1,'hidden consumer closes late exact receipt');assert.deepEqual(a.closes()[0].body,{viewId:a.receipt.lease.viewId,leaseToken:a.receipt.leaseToken});await a.clock.advance(180_000);assert.equal(a.renewals().length,0);assert.equal(a.calls.filter(x=>x.path==='/apps/resume').length,0);await a.client.show();assert(!a.client.find(node=>node.type==='iframe'));
});
test('AH-VL13: late Open receipt after unmount is explicitly closed and never polled or retained',async t=>{
 let resolveOpen;const a=await setup(t,{openResponder:()=>new Promise(resolve=>{resolveOpen=resolve;})});a.client.unmount();resolveOpen({ok:true,json:async()=>a.receipt});await settle();assert.equal(a.closes().length,1,'unmounted consumer closes late exact receipt');assert.deepEqual(a.closes()[0].body,{viewId:a.receipt.lease.viewId,leaseToken:a.receipt.leaseToken});await a.clock.advance(180_000);assert.equal(a.renewals().length,0);assert.equal(a.calls.filter(x=>x.path==='/apps/resume').length,0);
});
test('AH-VL14: hiding then reopening market does not resurrect an old pending Open receipt',async t=>{
 let resolveOpen;const a=await setup(t,{embedded:false,openResponder:()=>new Promise(resolve=>{resolveOpen=resolve;})});await a.client.hide();await a.client.show();resolveOpen({ok:true,json:async()=>a.receipt});await settle();assert.equal(a.closes().length,1,'old surface generation closes its late receipt');assert(!a.client.find(node=>node.type==='iframe'),'reopened market cannot adopt an abandoned Open');assert.equal(a.renewals().length,0);
});
