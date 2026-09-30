import test from 'node:test';
import assert from 'node:assert/strict';
import { clientHarness, fakeClock, settle } from './fixtures/client-ui-harness.mjs';

test('AH-UI15: Open acknowledges the click while startup is still in flight', async t => {
  let finishOpen;
  const row = { appId: 'example', state: 'registered', packageName: 'example', definition: { deployments: [{ id: 'local' }] } };
  const page = { items: [{ id: 'example', kind: 'application', displayName: 'Example', installed: row }], installed: [row] };
  const receipt = { instance: { id: 'instance-1', appId: 'example', status: 'ready' }, lease: { viewId: 'view-1', generation: 1, expiresAt: Date.now() + 90_000 }, leaseToken: 'token', uiUrl: 'http://127.0.0.1:50001/' };
  const fetch = async path => path.startsWith('/hanamesh/library')
    ? { ok: true, json: async () => page }
    : path === '/apps/open'
      ? new Promise(resolve => { finishOpen = resolve; })
      : { ok: true, json: async () => ({ instance: { status: 'stopped' } }) };
  const client = await clientHarness({ fetch });
  t.after(() => client.unmount());

  await client.click('打开');
  const pending = client.find(node => node.type === 'button' && node.children.includes('打开中…'));
  assert(pending, 'button must respond before the app is ready');
  assert.equal(pending.props.disabled, true);
  finishOpen({ ok: true, json: async () => receipt });
  await settle();
  assert(client.find(node => node.type === 'iframe'), 'the ready app still opens normally');
});

test('AH-UI16: Close acknowledges the click while owned-process cleanup is still in flight', async t => {
  let finishClose;
  const row = { appId: 'example', state: 'registered', packageName: 'example', definition: { deployments: [{ id: 'local' }] } };
  const page = { items: [{ id: 'example', kind: 'application', displayName: 'Example', installed: row }], installed: [row] };
  const receipt = { instance: { id: 'instance-1', appId: 'example', status: 'ready' }, lease: { viewId: 'view-1', generation: 1, expiresAt: Date.now() + 90_000 }, leaseToken: 'token', uiUrl: 'http://127.0.0.1:50001/' };
  const fetch = async path => path.startsWith('/hanamesh/library')
    ? { ok: true, json: async () => page }
    : path === '/apps/open'
      ? { ok: true, json: async () => receipt }
      : path === '/apps/close'
        ? new Promise(resolve => { finishClose = resolve; })
        : { ok: true, json: async () => ({}) };
  const client = await clientHarness({ fetch });
  t.after(() => client.unmount());
  await client.click('打开');
  assert(client.find(node => node.type === 'iframe'));

  await client.click('关闭视图');
  const pending = client.find(node => node.type === 'button' && node.children.includes('关闭中…'));
  assert(pending, 'button must respond while process cleanup is still in flight');
  assert.equal(pending.props.disabled, true);
  finishClose({ ok: true, json: async () => ({ instance: { status: 'stopped' } }) });
  await settle();
  assert(!client.find(node => node.type === 'iframe'));
});

test('AH-UI18: pending Open polls read-only status and resumes exactly once after ready', async t => {
  const clock=fakeClock(),calls=[];
  const row={appId:'example',state:'registered',packageName:'example',definition:{deployments:[{id:'local'}]}};
  const page={items:[{id:'example',kind:'application',displayName:'Example',installed:row}],installed:[row]};
  const pending={instance:{id:'instance-1',appId:'example',status:'starting'},lease:{viewId:'view-1',generation:1,expiresAt:clock.now()+90_000},leaseToken:'token',uiUrl:null};
  let polls=0;
  const fetch=async(path,init={})=>{calls.push({path,method:init.method??'GET'});let value;
    if(path.startsWith('/hanamesh/library'))value=page;
    else if(path==='/apps/open')value=pending;
    else if(path==='/hanamesh/apps')value={instances:[{id:'instance-1',status:++polls>=3?'ready':'starting'}]};
    else if(path==='/apps/resume')value={...pending,instance:{...pending.instance,status:'ready'},uiUrl:'http://127.0.0.1:50001/'};
    else if(path==='/apps/close')value={instance:{status:'stopped'}};
    else throw Error(`unexpected route ${path}`);
    return{ok:true,json:async()=>value};};
  const client=await clientHarness({fetch,clock});t.after(()=>client.unmount());await client.click('打开');
  await clock.advance(1000);
  assert(client.find(node=>node.type==='iframe'),'ready application must appear');
  assert.equal(calls.filter(call=>call.path==='/hanamesh/apps').length,3);
  assert.equal(calls.filter(call=>call.path==='/apps/resume').length,1);
  assert(calls.filter(call=>call.path==='/hanamesh/apps').every(call=>call.method==='GET'));
});

test('AH-UI19: hiding during pending Open closes its exact lease without a late resume',async t=>{
  const clock=fakeClock(),calls=[];
  const row={appId:'example',state:'registered',packageName:'example',definition:{deployments:[{id:'local'}]}};
  const page={items:[{id:'example',kind:'application',displayName:'Example',installed:row}],installed:[row]};
  const pending={instance:{id:'instance-1',appId:'example',status:'starting'},lease:{viewId:'view-1',generation:1,expiresAt:clock.now()+90_000},leaseToken:'token',uiUrl:null};
  const fetch=async(path,init={})=>{calls.push({path,body:init.body?JSON.parse(init.body):null});const value=path.startsWith('/hanamesh/library')?page:path==='/apps/open'?pending:path==='/hanamesh/apps'?{instances:[{id:'instance-1',status:'ready'}]}:path==='/apps/close'?{instance:{status:'stopped'}}:null;assert(value,`unexpected route ${path}`);return{ok:true,json:async()=>value};};
  const client=await clientHarness({fetch,clock,embedded:false});t.after(()=>client.unmount());await client.show();await client.click('打开');await client.hide();
  await clock.advance(500);
  assert.equal(calls.filter(call=>call.path==='/apps/close').length,1);
  assert.equal(calls.filter(call=>call.path==='/apps/resume').length,0);
  assert(!client.find(node=>node.type==='iframe'));
});

test('AH-UI20: a long read-only startup renews its pending lease without repeated resume writes',async t=>{
  const clock=fakeClock(),startedAt=clock.now(),calls=[];
  const row={appId:'example',state:'registered',packageName:'example',definition:{deployments:[{id:'local'}]}};
  const page={items:[{id:'example',kind:'application',displayName:'Example',installed:row}],installed:[row]};
  let expiresAt=startedAt+90_000;
  const pending={instance:{id:'instance-1',appId:'example',status:'starting'},lease:{viewId:'view-1',generation:1,expiresAt},leaseToken:'token',uiUrl:null};
  const fetch=async(path,init={})=>{calls.push(path);let value;
    if(path.startsWith('/hanamesh/library'))value=page;
    else if(path==='/apps/open')value=pending;
    else if(path==='/hanamesh/apps')value={instances:[{id:'instance-1',status:clock.now()>expiresAt?'stopped':clock.now()-startedAt>=95_000?'ready':'starting'}]};
    else if(path==='/apps/heartbeat'){if(clock.now()>expiresAt)return{ok:false,status:409,json:async()=>({error:{code:'LEASE_EXPIRED'}})};expiresAt=clock.now()+90_000;value={...pending.lease,expiresAt};}
    else if(path==='/apps/resume')value={...pending,instance:{...pending.instance,status:clock.now()-startedAt>=95_000?'ready':'starting'},lease:{...pending.lease,expiresAt},uiUrl:clock.now()-startedAt>=95_000?'http://127.0.0.1:50001/':null};
    else if(path==='/apps/close')value={instance:{status:'stopped'}};
    else throw Error(`unexpected route ${path}`);
    return{ok:true,json:async()=>value};};
  const client=await clientHarness({fetch,clock});t.after(()=>client.unmount());await client.click('打开');
  await clock.advance(100_000);
  assert(client.find(node=>node.type==='iframe'),'long startup should reach a usable frame');
  assert(calls.includes('/apps/heartbeat'),'pending view must renew before 90s expiry');
  assert.equal(calls.filter(path=>path==='/apps/resume').length,1);
});

test('AH-UI21: a timed-out pending Open releases its exact lease',async t=>{
  const clock=fakeClock(),calls=[];
  const row={appId:'example',state:'registered',packageName:'example',definition:{deployments:[{id:'local'}]}};
  const page={items:[{id:'example',kind:'application',displayName:'Example',installed:row}],installed:[row]};
  const pending={instance:{id:'instance-1',appId:'example',status:'starting'},lease:{viewId:'view-1',generation:1,expiresAt:clock.now()+90_000},leaseToken:'token',uiUrl:null};
  const fetch=async(path,init={})=>{calls.push({path,body:init.body?JSON.parse(init.body):null});let value;
    if(path.startsWith('/hanamesh/library'))value=page;
    else if(path==='/apps/open')value=pending;
    else if(path==='/hanamesh/apps')value={instances:[{id:'instance-1',status:'starting'}]};
    else if(path==='/apps/heartbeat')value={...pending.lease,expiresAt:clock.now()+90_000};
    else if(path==='/apps/close')value={instance:{status:'stopped'}};
    else throw Error(`unexpected route ${path}`);
    return{ok:true,json:async()=>value};};
  const client=await clientHarness({fetch,clock});t.after(()=>client.unmount());await client.click('打开');
  await clock.advance(121_000);
  assert.equal(calls.filter(call=>call.path==='/apps/close').length,1);
  assert.deepEqual(calls.find(call=>call.path==='/apps/close').body,{viewId:'view-1',leaseToken:'token'});
  assert(!client.find(node=>node.type==='iframe'));
});

test('AH-UI22: a ready-to-starting race never issues a second resume write',async t=>{
  const clock=fakeClock(),calls=[];
  const row={appId:'example',state:'registered',packageName:'example',definition:{deployments:[{id:'local'}]}};
  const page={items:[{id:'example',kind:'application',displayName:'Example',installed:row}],installed:[row]};
  const pending={instance:{id:'instance-1',appId:'example',status:'starting'},lease:{viewId:'view-1',generation:1,expiresAt:clock.now()+90_000},leaseToken:'token',uiUrl:null};
  const fetch=async(path,init={})=>{calls.push(path);let value;
    if(path.startsWith('/hanamesh/library'))value=page;
    else if(path==='/apps/open')value=pending;
    else if(path==='/hanamesh/apps')value={instances:[{id:'instance-1',status:'ready'}]};
    else if(path==='/apps/resume')value=pending;
    else if(path==='/apps/close')value={instance:{status:'stopped'}};
    else throw Error(`unexpected route ${path}`);
    return{ok:true,json:async()=>value};};
  const client=await clientHarness({fetch,clock});t.after(()=>client.unmount());await client.click('打开');
  await clock.advance(1000);
  assert.equal(calls.filter(path=>path==='/apps/resume').length,1);
  assert.equal(calls.filter(path=>path==='/apps/close').length,1);
  assert(!client.find(node=>node.type==='iframe'));
});
