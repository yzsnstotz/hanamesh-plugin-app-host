import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { setup,definition,input,leaseInput,http,pidAlive,until,temporary,external,identity,delay } from './helpers.mjs';

test('H02: eight concurrent opens reserve one actual application process',async t=>{
  const {host}=await setup(t);
  const results=await Promise.all(Array.from({length:8},(_,i)=>host.open(input(`view-${i}`))));
  assert.equal(new Set(results.map(r=>r.instance.id)).size,1);
  const pids=await Promise.all(results.map(r=>identity(r.uiUrl).then(v=>v.pid)));
  assert.equal(new Set(pids).size,1);assert(pidAlive(pids[0]));
  assert.equal(host.instanceList().length,1);assert.equal(host.list().views.filter(v=>v.status==='active').length,8);
  console.log('H02 real process evidence:',JSON.stringify({opens:8,pids:[...new Set(pids)]}));
});
test('H03: multi-instance applications write genuinely separate data roots',async t=>{
  const {host}=await setup(t,{def:definition({single:false})});
  const [a,b]=await Promise.all([host.open(input('a')),host.open(input('b'))]);
  assert.notEqual(a.instance.id,b.instance.id);assert.notEqual(a.instance.dataDir,b.instance.dataDir);
  const [ad,bd]=await Promise.all([readdir(a.instance.dataDir),readdir(b.instance.dataDir)]);
  assert(ad.includes(`write-${a.instance.runtimeId}.txt`));assert(!ad.includes(`write-${b.instance.runtimeId}.txt`));
  assert(bd.includes(`write-${b.instance.runtimeId}.txt`));assert(!bd.includes(`write-${a.instance.runtimeId}.txt`));
  console.log('H03 actual directory contents:',JSON.stringify({a:{path:a.instance.dataDir,files:ad},b:{path:b.instance.dataDir,files:bd}}));
  await host.close(leaseInput(a));assert(!pidAlive(a.instance.pid));assert(pidAlive(b.instance.pid));assert.equal((await http(b.uiUrl)).status,200);
});
test('H04/H05: reopen is idempotent; closing one view does not stop the other',async t=>{
  const {host}=await setup(t);let a=await host.open(input('a'));
  for(let i=0;i<3;i++)a=await host.open({...input('a'),leaseToken:a.leaseToken});
  assert.equal(host.list().views.filter(v=>v.status==='active').length,1);assert.equal(a.lease.generation,1);
  const b=await host.open(input('b'));assert.equal(a.instance.id,b.instance.id);
  await host.close(leaseInput(a));assert.equal((await http(b.uiUrl)).status,200);assert(pidAlive(b.instance.pid));
  await host.close(leaseInput(b));assert(!pidAlive(b.instance.pid));assert.equal(host.instance(b.instance.id).status,'stopped');
  assert.equal((await host.close(leaseInput(b))).alreadyClosed,true);
});
test('H06: restart/resume preserves exact view, deployment, data and original-session identities',async t=>{
  const root=await temporary();
  const def=definition({single:false});const first=await setup(null,{root,def});
  const a=await first.host.open({...input('a'),originalSessionId:'document-exact-a'});
  const b=await first.host.open({...input('b'),originalSessionId:'document-exact-b'});
  await first.host.dispose();
  const second=await setup(t,{root,def});t.after(()=>rm(root,{recursive:true,force:true}));
  // Restore B first: A must not choose the first ready instance.
  const rb=await second.host.resume(leaseInput(b));const ra=await second.host.resume(leaseInput(a));
  assert.equal(ra.instance.id,a.instance.id);assert.equal(rb.instance.id,b.instance.id);
  assert.notEqual(ra.instance.runtimeId,a.instance.runtimeId);assert.equal(ra.instance.dataDir,a.instance.dataDir);
  assert.equal(ra.originalSessionId,'document-exact-a');assert.equal(rb.originalSessionId,'document-exact-b');
  assert.equal(second.host.list().views.filter(v=>v.status==='active').length,2);
  assert((await readdir(ra.instance.dataDir)).includes(`write-${a.instance.runtimeId}.txt`));
  console.log('H06 durable slot restore:',JSON.stringify({old:a.instance.id,restored:ra.instance.id,originalSessionId:ra.originalSessionId}));
});
test('H07: forged, expired-generation, and cross-principal close cannot decrement another lease',async t=>{
  const {host}=await setup(t);const a=await host.open(input('a'));
  await assert.rejects(host.close({viewId:'bogus',leaseToken:a.leaseToken}),{code:'LEASE_NOT_OWNED'});
  await assert.rejects(host.close({...leaseInput(a),leaseToken:'f'.repeat(64)}),{code:'LEASE_NOT_OWNED'});
  await assert.rejects(host.close(leaseInput(a),'other'),{code:'LEASE_NOT_OWNED'});
  assert.equal(host.list().views.filter(v=>v.status==='active').length,1);
  await host.close(leaseInput(a));const reopened=await host.open({...input('a'),leaseToken:a.leaseToken});
  assert.notEqual(reopened.leaseToken,a.leaseToken);assert.equal(reopened.lease.generation,2);
  await assert.rejects(host.close(leaseInput(a)),{code:'LEASE_NOT_OWNED'});assert(pidAlive(reopened.instance.pid));
});
test('H08: busy Stop explains occupiers; confirmed stop emits durable notifications for every view',async t=>{
  const {host}=await setup(t);const a=await host.open(input('a'));await host.open(input('b'));
  await assert.rejects(host.stop(a.instance.id),e=>e.code==='INSTANCE_IN_USE'&&e.details.views.length===2);
  assert(pidAlive(a.instance.pid));await host.stop(a.instance.id,{confirm:true});assert(!pidAlive(a.instance.pid));
  const notices=host.eventsSince().events.filter(e=>e.type==='view.stopped');
  assert.deepEqual(notices.map(e=>e.viewId).sort(),['a','b']);assert.equal(host.instance(a.instance.id).status,'stopped');
});
test('H09: attach close, stopAll and dispose never signal the external process',async t=>{
  const {child,origin}=await external(t);
  const def={id:'example',name:'External',singleInstanceOnly:true,deployments:[{id:'local',dataId:'external-data',mode:'attach',url:origin,
    readiness:{path:'/health',status:200,bodyIncludes:'HANAMESH_FIXTURE'}}]};
  const {host}=await setup(t,{def});
  const signals=[];const originalKill=process.kill;
  process.kill=function(pid,signal){if(pid===child.pid||pid===-child.pid)signals.push(signal);return originalKill.call(process,pid,signal);};
  try{
    const a=await host.open(input('a'));await host.close(leaseInput(a));assert(pidAlive(child.pid));
    await host.open(input('b'));await host.stopAll();assert(pidAlive(child.pid));
    await host.open(input('c'));await host.dispose();assert(pidAlive(child.pid));
    assert.equal((await http(origin)).status,200);assert.deepEqual(signals,[]);
  }finally{process.kill=originalKill;}
});
test('H10: expired leases converge without any unload request',async t=>{
  const {host}=await setup(t,{ttl:400,sweep:50});const a=await host.open(input('a'));
  await until(()=>host.instance(a.instance.id).status==='stopped');assert(!pidAlive(a.instance.pid));
  assert.equal(host.list().views[0].status,'expired');
  await assert.rejects(host.heartbeat(leaseInput(a)),{code:'LEASE_EXPIRED'});
});
test('AH: startup cancellation receipt stops the actual child and does not return false-ready',async t=>{
  const {host}=await setup(t,{def:definition({extra:{delay:700}})});
  const receipt=await host.beginOpen(input('cancel'));assert.equal(receipt.uiUrl,null);assert.equal(receipt.instance.status,'starting');
  await host.close(leaseInput(receipt));assert.equal(host.instance(receipt.instance.id).status,'stopped');assert(!pidAlive(receipt.instance.pid));
});
test('AH: never-ready startup is bounded, cleans up, and supports an explicit retry',async t=>{
  const def=definition({extra:{neverReady:true}});def.deployments[0].startTimeoutMs=250;
  const {host}=await setup(t,{def});const receipt=await host.beginOpen(input('never'));
  await until(()=>host.instance(receipt.instance.id).status==='failed');assert(!pidAlive(receipt.instance.pid));
  assert.equal(host.instance(receipt.instance.id).errorCode,'READY_TIMEOUT');
  const retry=await host.beginOpen({...input('never'),leaseToken:receipt.leaseToken});
  assert.equal(retry.instance.id,receipt.instance.id);assert.notEqual(retry.instance.runtimeId,receipt.instance.runtimeId);
  await host.close(leaseInput(retry));
});
test('AH: spontaneous application exit cannot leave ready forever',async t=>{
  const {host}=await setup(t);const a=await host.open(input('exit'));await http(a.uiUrl+'/exit');
  await until(()=>host.instance(a.instance.id).status==='failed');assert.equal(host.instance(a.instance.id).errorCode,'APP_EXITED');
});
test('AH: disjoint applications launch independently and cannot rebind an existing view',async t=>{
  const {host}=await setup(t);host.register(definition({id:'second'}));
  const [a,b]=await Promise.all([host.open(input('a')),host.open(input('b','second'))]);
  assert.notEqual(a.instance.id,b.instance.id);assert.notEqual(a.instance.pid,b.instance.pid);
  await assert.rejects(host.open({...input('a','second'),leaseToken:a.leaseToken}),{code:'VIEW_BINDING_CONFLICT'});
  await assert.rejects(host.resume({viewId:'missing',leaseToken:a.leaseToken}),{code:'LEASE_NOT_OWNED'});
});
test('AH: host secrets are not inherited; logs redact bearer and JSON secrets',async t=>{
  process.env.DSH_TOKEN='do-not-inherit';t.after(()=>delete process.env.DSH_TOKEN);
  const {host}=await setup(t);const a=await host.open(input());assert.equal((await identity(a.uiUrl)).inheritedSecret,null);
  await until(()=>host.logTail(a.instance.id,128).length>=3);
  const logs=JSON.stringify(host.logTail(a.instance.id,128));assert(!logs.includes('fixture-secret-value'));assert(!logs.includes('json-sensitive-value'));
  assert(logs.includes('[REDACTED]'));assert(!JSON.stringify(host.list()).includes('tokenHash'));
});
test('AH: confirmed Stop removes a SIGTERM-resistant descendant in its owned group',async t=>{
  const {host}=await setup(t,{def:definition({extra:{descendant:true,ignoreTerm:true}})});const a=await host.open(input());
  const descendant=await until(async()=>Number(await readFile(join(a.instance.dataDir,'descendant.pid'),'utf8')));
  assert(pidAlive(descendant));await host.stop(a.instance.id,{confirm:true});assert(!pidAlive(a.instance.pid));assert(!pidAlive(descendant));
});

test('FIX-01: lost receipt recovery is owner-confirmed, fences old credentials and retains exact identity',async t=>{
  const {host}=await setup(t);const a=await host.open(input('lost'));
  await assert.rejects(host.recoverView({viewId:'lost',instanceId:a.instance.id,confirm:true},'other'),{code:'LEASE_NOT_OWNED'});
  await assert.rejects(host.recoverView({viewId:'lost',instanceId:a.instance.id}),{code:'RECOVERY_CONFIRM_REQUIRED'});
  const recovered=await host.recoverView({viewId:'lost',instanceId:a.instance.id,confirm:true});
  assert.equal(recovered.lease.generation,2);assert.equal(host.list().views.filter(v=>v.status==='active').length,1);
  await assert.rejects(host.close(leaseInput(a)),{code:'LEASE_NOT_OWNED'});
  const b=await host.resume(leaseInput(recovered));assert.equal(b.instance.id,a.instance.id);assert.equal(b.instance.pid,a.instance.pid);
});
test('FIX-01 gateway: closed/recovered generations never regain iframe capabilities after reopen',async t=>{
  const {host}=await setup(t,{def:definition({embedding:'gateway'})});const a=await host.open(input('gate-a'));await host.open(input('gate-b'));
  const boot=await http(a.uiUrl,{headers:{referer:'http://127.0.0.1:49123/','sec-fetch-dest':'iframe'}});assert.equal(boot.status,303);
  const cookie=boot.headers['set-cookie'][0].split(';')[0],origin=new URL(a.uiUrl).origin;
  assert.equal((await http(origin,{headers:{cookie}})).status,200);await host.close(leaseInput(a));
  const again=await host.open({...input('gate-a'),leaseToken:a.leaseToken});assert.equal((await http(origin,{headers:{cookie}})).status,403);
  const fresh=await http(again.uiUrl,{headers:{referer:'http://127.0.0.1:49123/','sec-fetch-dest':'iframe'}});
  const freshCookie=fresh.headers['set-cookie'][0].split(';')[0];assert.equal((await http(origin,{headers:{cookie:freshCookie}})).status,200);
  await host.recoverView({viewId:'gate-a',instanceId:a.instance.id,confirm:true});assert.equal((await http(origin,{headers:{cookie:freshCookie}})).status,403);
});

test('AH recovery: tampered data-root bindings cannot redirect application writes',async t=>{
  const {writeFile}=await import('node:fs/promises');const root=await temporary();
  const first=await setup(null,{root});const a=await first.host.open(input('persisted'));await first.host.dispose();
  const path=join(root,'sidecar','app-host.json'),snapshot=JSON.parse(await readFile(path,'utf8'));
  snapshot.instances[0].dataDir=join(root,'outside-approved-layout');await writeFile(path,JSON.stringify(snapshot));
  const second=await setup(t,{root});t.after(()=>rm(root,{recursive:true,force:true}));
  await assert.rejects(second.host.resume(leaseInput(a)),{code:'BINDING_PATH_INVALID'});
  assert(!(await readdir(root)).includes('outside-approved-layout'));
});

test('AH-D1: an upgraded descriptor is adopted by a stopped instance across a host restart',async t=>{
  const root=await temporary();
  const first=await setup(null,{root});
  const opened=await first.host.open(input('v1'));
  await first.host.stop(opened.instance.id,{confirm:true});
  await first.host.dispose();
  // Same app id, same data binding, different descriptor text (what an app rc bump does).
  const upgraded=definition();upgraded.name='App example (upgraded)';
  const second=await setup(t,{root,def:upgraded});t.after(()=>rm(root,{recursive:true,force:true}));
  const reopened=await second.host.open(input('v2'));
  assert.equal(reopened.instance.id,opened.instance.id,'same stopped instance, no new data root');
  assert.equal(reopened.instance.status,'ready');
  assert(second.host.eventsSince(0).events.some(e=>e.type==='instance.definition-adopted'&&e.instanceId===opened.instance.id));
  // A definition can only change across a host restart (register() refuses replacement in a running host), so the
  // adopted instance keeps working for further views without a second adoption event.
  const again=await second.host.open(input('v3'));assert.equal(again.instance.id,opened.instance.id);
  assert.equal(second.host.eventsSince(0).events.filter(e=>e.type==='instance.definition-adopted').length,1);
});
