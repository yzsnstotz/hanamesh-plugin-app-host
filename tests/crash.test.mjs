import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { join } from 'node:path';
import { rm,readFile } from 'node:fs/promises';
import { AtomicFileStore } from '../src/index.js';
import { emptySnapshot } from '../src/store.js';
import { validateDeclaration } from '../scripts/check-consistency.mjs';
import { temporary,setup,definition,pidAlive,until,leaseInput } from './helpers.mjs';
async function killAt(t,mode,point){
  const root=await temporary();let message;
  const initial=new AtomicFileStore(join(root,'sidecar'));await initial.init();await initial.save(emptySnapshot());await initial.close();
  const child=fork(new URL('./fixtures/crash-worker.mjs',import.meta.url),[mode,root,point??''],{stdio:['ignore','pipe','pipe','ipc']});
  let stderr='';child.stderr.on('data',b=>{stderr+=b;});child.stdout.resume();
  t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){const done=new Promise(r=>child.once('exit',r));child.kill('SIGKILL');await done;}
    const pid=message?.pid??message?.result?.instance?.pid;if(pid)await until(()=>!pidAlive(pid));await rm(root,{recursive:true,force:true});});
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
  assert.deepEqual(c.groups.map(g=>g.id),['first-lease','stopped-views']);assert.deepEqual(c.boundaries.map(b=>b.id),['reserve-launch','stop-publish']);
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
  const {snapshot:s,message:m}=await killAt(t,'boundary-reserve');
  const written=JSON.parse(await readFile(join(m.dataDir,'runtime-evidence.json'),'utf8'));assert.equal(written.pid,m.pid);assert(m.aliveAtCut);
  // Mutation must fail HERE for the product invariant, not merely because startup throws.
  assert(s.instances.some(i=>i.id===m.instanceId)&&s.leases.some(l=>l.instanceId===m.instanceId),'RESERVE_BOUNDARY_UNSAFE: real app data exists without durable instance + lease ownership');
  await until(()=>!pidAlive(m.pid));assert.equal(s.instances[0].status,'reserved');
  console.log('X03 reserve-launch:',JSON.stringify({signal:'SIGKILL',instanceId:m.instanceId,pid:m.pid,appWroteData:true,durableOwner:true,guardianCleanup:true}));
});
test('X03 stop-publish: SIGKILL at stop boundary cannot advertise stopped while the app is alive',async t=>{
  const {snapshot:s,message:m}=await killAt(t,'boundary-stop');
  const aliveAfterRestart=pidAlive(m.pid);
  assert(!(s.instances[0].status==='stopped'&&(m.aliveAtCut||aliveAfterRestart)),
    'STOP_BOUNDARY_UNSAFE: stopped was published while its owned app still ran at the actual crash cut');
  assert.equal(m.aliveAtCut,false);assert.equal(aliveAfterRestart,false);assert.equal(s.instances[0].status,'stopping');
  console.log('X03 stop-publish:',JSON.stringify({signal:'SIGKILL',stateAfterRestart:s.instances[0].status,aliveAtCut:m.aliveAtCut,aliveAfterRestart}));
});
test('H12/H06: SIGKILL host, guardian cleanup, fresh host exact-identity resume and persisted app data',async t=>{
  const {root,message:{result:a}}=await killAt(t,'recovery');await until(()=>!pidAlive(a.instance.pid));
  const {host}=await setup(null,{root,def:definition({extra:{ignoreTerm:true}})});
  try{
    const b=await host.resume(leaseInput(a));assert.equal(b.instance.id,a.instance.id);assert.equal(b.instance.dataDir,a.instance.dataDir);
    assert.notEqual(b.instance.runtimeId,a.instance.runtimeId);assert.equal(b.originalSessionId,'exact-document');
    assert((await readFile(join(b.instance.dataDir,`write-${a.instance.runtimeId}.txt`),'utf8')).includes(a.instance.runtimeId));
    assert.equal(host.list().views.filter(v=>v.status==='active').length,1);assert(pidAlive(b.instance.pid));
    console.log('H12 real host kill/resume:',JSON.stringify({stableInstance:b.instance.id,oldRuntime:a.instance.runtimeId,newRuntime:b.instance.runtimeId,dataRetained:true}));
  }finally{await host.dispose();}
});
