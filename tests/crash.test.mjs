import { assertOwnedPlatformRejection } from './platform-owned.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { join } from 'node:path';
import { rm,readFile } from 'node:fs/promises';
import { AtomicFileStore } from '../src/index.js';
import { emptySnapshot } from '../src/store.js';
import { validateDeclaration } from '../scripts/check-consistency.mjs';
import { temporary,setup,definition,pidAlive,pidMatches,until,leaseInput,external,input } from './helpers.mjs';
async function killAt(t,mode,point){
  const root=await temporary();let message;
  const initial=new AtomicFileStore(join(root,'sidecar'));await initial.init();await initial.save(emptySnapshot());await initial.close();
  const attachOrigin=process.platform==='win32'&&mode==='group-stop'?(await external(t)).origin:'';
  const child=fork(new URL('./fixtures/crash-worker.mjs',import.meta.url),[mode,root,point??'',attachOrigin],{stdio:['ignore','pipe','pipe','ipc']});
  let stderr='';child.stderr.on('data',b=>{stderr+=b;});child.stdout.resume();
  t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){const done=new Promise(r=>child.once('exit',r));child.kill('SIGKILL');await done;}
    const pid=message?.pid??message?.result?.instance?.pid,marker=message?.dataDir??message?.result?.instance?.dataDir;
    if(pid)await until(()=>marker?!pidMatches(pid,marker):!pidAlive(pid));await rm(root,{recursive:true,force:true});});
  message=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Checkpoint timeout: '+stderr)),10_000);
    child.on('message',m=>{clearTimeout(timer);m.type==='checkpoint'?resolve(m):reject(new Error(JSON.stringify(m)));});
    child.once('error',reject);child.once('exit',(code,signal)=>{clearTimeout(timer);reject(new Error(`Worker exited before checkpoint ${code}/${signal}: ${stderr}`));});
  });
  const exited=new Promise(r=>child.once('exit',(code,signal)=>r({code,signal})));child.kill('SIGKILL');const death=await exited;assert.equal(death.signal,'SIGKILL');
  const restarted=new AtomicFileStore(join(root,'sidecar'));await restarted.init();const snapshot=await restarted.load();await restarted.close();
  return{root,message,snapshot,death};
}
test('X01: consistency declaration covers each production group and boundary',async()=>{
  const c=validateDeclaration(JSON.parse(await readFile(new URL('../consistency.json',import.meta.url))));
  assert.deepEqual(c.groups.map(g=>g.id),['first-lease','stopped-views','library-install','receipt-hour','suite-source-selection']);assert.deepEqual(c.boundaries.map(b=>b.id),['reserve-launch','stop-publish','receipt-report','market-seat-exclusive','node-ready-binding','suite-source-confirmation']);
  assert.throws(()=>validateDeclaration({...c,groups:[]}));
});
for(const point of ['snapshot-temp-fsynced','snapshot-published']){
  test(`X02 first-lease: real SIGKILL at ${point} restores all or none`,async t=>{
    const {snapshot:s,death}=await killAt(t,'group-first',point);
    const facts=[s.instances.length===1,s.leases.length===1,s.events.some(e=>e.type==='view.opened')];
    assert(facts.every(Boolean)||facts.every(v=>!v));assert.equal(facts[0],point==='snapshot-published');
    console.log('X02 first-lease:',JSON.stringify({point,death,facts,revision:s.revision}));
  });
  test(`X02 stopped-views: real SIGKILL at ${point} restores all or none`,async t=>{
    const {snapshot:s,death}=await killAt(t,'group-stop',point);
    const facts=[s.instances[0].status==='stopped',s.leases[0].status==='stopped',s.events.some(e=>e.type==='view.stopped')];
    assert(facts.every(Boolean)||facts.every(v=>!v));assert.equal(facts[0],point==='snapshot-published');
    console.log('X02 stopped-views:',JSON.stringify({point,death,facts,revision:s.revision}));
  });
}
test('X03 reserve-launch: SIGKILL after actual process writes leaves a durable owner, never unowned data',async t=>{
  if(process.platform==='win32'){
    const points=[],{host}=await setup(t,{checkpoint:async point=>points.push(point)});
    await assertOwnedPlatformRejection(host,input('reserve-boundary'));
    assert.deepEqual(points,['reservation-durable'],'reservation must precede platform refusal, with no runtime-spawned crash cut or app data');return;
  }
  const {snapshot:s,message:m}=await killAt(t,'boundary-reserve');
  const written=JSON.parse(await readFile(join(m.dataDir,'runtime-evidence.json'),'utf8'));assert.equal(written.pid,m.pid);assert(m.aliveAtCut);
  // Mutation must fail HERE for the product invariant, not merely because startup throws.
  assert(s.instances.some(i=>i.id===m.instanceId)&&s.leases.some(l=>l.instanceId===m.instanceId),'RESERVE_BOUNDARY_UNSAFE: real app data exists without durable instance + lease ownership');
  await until(()=>!pidMatches(m.pid,m.dataDir));assert.equal(s.instances[0].status,'reserved');
  console.log('X03 reserve-launch:',JSON.stringify({signal:'SIGKILL',instanceId:m.instanceId,pid:m.pid,appWroteData:true,durableOwner:true,guardianCleanup:true}));
});
test('X03 stop-publish: SIGKILL at stop boundary cannot advertise stopped while the app is alive',async t=>{
  if(process.platform==='win32'){
    const points=[],{host}=await setup(t,{checkpoint:async point=>points.push(point)});
    const failed=await assertOwnedPlatformRejection(host,input('stop-boundary'));
    const stopped=await host.stop(failed.id,{confirm:true});
    assert.deepEqual(stopped,failed,'stopping an already terminal failed instance cannot claim that a runtime was stopped');
    assert.equal(host.instance(failed.id).status,'failed');
    assert.ok(!host.eventsSince().events.some(event=>event.type==='instance.stopped'),'no stop acknowledgement is manufactured without a launched runtime');
    assert.ok(!points.includes('runtime-spawned'),'no owned runtime can run at the stop crash boundary');
    assert.equal(host.instance(failed.id).pid,null);return;
  }
  const {snapshot:s,message:m}=await killAt(t,'boundary-stop');
  const aliveAfterRestart=pidMatches(m.pid,m.dataDir);
  assert(!(s.instances[0].status==='stopped'&&(m.aliveAtCut||aliveAfterRestart)),
    'STOP_BOUNDARY_UNSAFE: stopped was published while its owned app still ran at the actual crash cut');
  assert.equal(m.aliveAtCut,false);assert.equal(aliveAfterRestart,false);assert.equal(s.instances[0].status,'stopping');
  console.log('X03 stop-publish:',JSON.stringify({signal:'SIGKILL',stateAfterRestart:s.instances[0].status,aliveAtCut:m.aliveAtCut,aliveAfterRestart}));
});
test('H12/H06: SIGKILL host, guardian cleanup, fresh host exact-identity resume and persisted app data',async t=>{
  if(process.platform==='win32'){
    const root=await temporary(),first=await setup(null,{root});
    const failed=await assertOwnedPlatformRejection(first.host,{...input('before-restart'),originalSessionId:'exact-document'});
    await first.host.dispose();const second=await setup(t,{root});
    assert.equal(second.host.instance(failed.id).status,'failed');
    const retried=await assertOwnedPlatformRejection(second.host,{...input('after-restart'),instanceId:failed.id,originalSessionId:'exact-document'});
    assert.equal(retried.id,failed.id);assert.equal(retried.dataDir,failed.dataDir);
    assert.equal(second.host.list().views.filter(view=>view.status==='active').length,0);return;
  }
  const {root,message:{result:a}}=await killAt(t,'recovery');await until(()=>!pidMatches(a.instance.pid,a.instance.dataDir));
  const {host}=await setup(null,{root,def:definition({extra:{ignoreTerm:true}})});
  try{
    const b=await host.resume(leaseInput(a));assert.equal(b.instance.id,a.instance.id);assert.equal(b.instance.dataDir,a.instance.dataDir);
    assert.notEqual(b.instance.runtimeId,a.instance.runtimeId);assert.equal(b.originalSessionId,'exact-document');
    assert((await readFile(join(b.instance.dataDir,`write-${a.instance.runtimeId}.txt`),'utf8')).includes(a.instance.runtimeId));
    assert.equal(host.list().views.filter(v=>v.status==='active').length,1);assert(pidAlive(b.instance.pid));
    console.log('H12 real host kill/resume:',JSON.stringify({stableInstance:b.instance.id,oldRuntime:a.instance.runtimeId,newRuntime:b.instance.runtimeId,dataRetained:true}));
  }finally{await host.dispose();}
});
test('H12: a stale view from a killed host cannot delay stopping a newly opened view',async t=>{
  if(process.platform==='win32'){
    const root=await temporary(),first=await setup(null,{root});
    const failed=await assertOwnedPlatformRejection(first.host,input('stale'));
    await first.host.dispose();const second=await setup(t,{root});
    const current=await assertOwnedPlatformRejection(second.host,input('fresh'));
    assert.equal(current.id,failed.id);assert.ok(second.host.list().views.every(view=>view.status==='failed'));
    await assert.rejects(second.host.resume({viewId:'stale',leaseToken:'0'.repeat(64)}),{code:'LEASE_NOT_OWNED'});
    assert.equal(second.host.instance(failed.id).status,'failed');return;
  }
  const {root,message:{result:stale}}=await killAt(t,'recovery');await until(()=>!pidMatches(stale.instance.pid,stale.instance.dataDir));
  const {host}=await setup(null,{root,def:definition({extra:{ignoreTerm:true}})});
  try{
    assert.equal(host.instance(stale.instance.id).status,'interrupted');
    assert.equal(host.list().views.find(v=>v.viewId===stale.lease.viewId).status,'expired');
    assert(host.eventsSince().events.some(e=>e.type==='view.expired'&&e.viewId===stale.lease.viewId&&e.reason==='host-restart'));
    const fresh=await host.open({appId:'example',deploymentId:'local',viewId:'fresh-view'});
    assert.equal(fresh.instance.id,stale.instance.id);
    await host.close(leaseInput(fresh));
    assert.equal(host.instance(fresh.instance.id).status,'stopped');
    assert(!pidMatches(fresh.instance.pid,fresh.instance.dataDir));
    const resumed=await host.resume(leaseInput(stale));
    assert.equal(resumed.instance.id,stale.instance.id);
    assert.notEqual(resumed.leaseToken,stale.leaseToken);
    await host.close(leaseInput(resumed));
  }finally{await host.dispose();}
});
