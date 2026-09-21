import test from 'node:test';
import assert from 'node:assert/strict';
import { fork,spawn } from 'node:child_process';
import { join } from 'node:path';
import { rm,readFile,writeFile,access } from 'node:fs/promises';
import { AtomicFileStore } from '../src/index.js';
import { FileLock,emptySnapshot } from '../src/store.js';
import { processIdentity } from '../src/runtime.js';
import { temporary,setup,definition,pidAlive,pidMatches,until,leaseInput,delay } from './helpers.mjs';
const idle=(t,{ignoreTerm=false}={})=>{
  const child=spawn(process.execPath,['-e',`${ignoreTerm?'process.on("SIGTERM",()=>{});':''}setInterval(()=>{},1000);console.log("IDLE_READY")`],{stdio:['ignore','pipe','ignore']});
  t.after(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');});
  return new Promise((resolve,reject)=>{child.stdout.once('data',()=>resolve(child));child.once('error',reject);});
};
const deadPid=async()=>{const child=spawn(process.execPath,['-e','0'],{stdio:'ignore'});await new Promise(r=>child.once('exit',r));await until(()=>!pidAlive(child.pid));return child.pid;};
const lockAt=async(root,record)=>{const path=join(root,'.runtime.lock');await writeFile(path,JSON.stringify(record));return path;};
const exists=path=>access(path).then(()=>true,()=>false);
test('AH-L01: a runtime lock left by a dead owner is reclaimed (current and legacy record shapes)',async t=>{
  const root=await temporary();t.after(()=>rm(root,{recursive:true,force:true}));
  const gone=await deadPid();
  for(const record of [{pid:gone,start:'Thu Jan  1 00:00:00 1970',id:'stale',children:[{pid:await deadPid(),start:'x',command:process.execPath,role:'launcher',group:true}],port:1},{pid:gone,id:'legacy'}]){
    const path=await lockAt(root,record);const lock=new FileLock(path,{reclaimDead:true});
    await lock.acquire();const current=JSON.parse(await readFile(path,'utf8'));
    assert.equal(current.id,lock.id);assert.equal(current.pid,process.pid);assert.equal(typeof current.start,'string');assert.deepEqual(current.children,[]);
    await lock.release();assert.equal(await exists(path),false);
  }
  // reclaimDead=false keeps the historical fail-closed behaviour.
  const path=await lockAt(root,{pid:gone,id:'stale'});
  await assert.rejects(new FileLock(path,{reclaimDead:false}).acquire(),e=>e.code==='DATA_ROOT_BUSY'&&e.details.reason==='owner-dead-no-reclaim');
  console.log('AH-L01 reclaimed stale owner:',JSON.stringify({deadPid:gone}));
});
test('AH-L02: a live owner still blocks, names its pid, and is never signalled',async t=>{
  const root=await temporary();t.after(()=>rm(root,{recursive:true,force:true}));
  const owner=await idle(t);const live=await processIdentity(owner.pid);assert.equal(typeof live.start,'string');
  const path=await lockAt(root,{pid:owner.pid,start:live.start,id:'live',children:[],port:4242});
  await assert.rejects(new FileLock(path,{reclaimDead:true}).acquire(),e=>e.code==='DATA_ROOT_BUSY'&&e.details.pid===owner.pid&&e.details.reason==='owner-alive'&&e.details.port===4242);
  // A legacy record without a start token is also treated as live while its pid runs.
  await lockAt(root,{pid:owner.pid,id:'legacy-live'});
  await assert.rejects(new FileLock(path,{reclaimDead:true}).acquire(),e=>e.code==='DATA_ROOT_BUSY'&&e.details.pid===owner.pid);
  await delay(50);assert(pidAlive(owner.pid));assert.equal(await exists(path),true);
  console.log('AH-L02 live owner blocks:',JSON.stringify({pid:owner.pid,start:live.start}));
});
test('AH-L03: same pid with a different start token is a reused pid: reclaimed, and the stranger is not signalled',async t=>{
  const root=await temporary();t.after(()=>rm(root,{recursive:true,force:true}));
  const stranger=await idle(t);const live=await processIdentity(stranger.pid);
  const path=await lockAt(root,{pid:stranger.pid,start:'Thu Jan  1 00:00:00 1970',id:'reused',children:[{pid:stranger.pid,start:'Thu Jan  1 00:00:00 1970',command:process.execPath,role:'app'}]});
  const lock=new FileLock(path,{reclaimDead:true});await lock.acquire();
  await delay(50);assert(pidAlive(stranger.pid));assert.notEqual(live.start,'Thu Jan  1 00:00:00 1970');
  await lock.release();
  console.log('AH-L03 pid reuse treated as dead:',JSON.stringify({pid:stranger.pid,liveStart:live.start}));
});
test('AH-L04: a surviving recorded child blocks unless provably ours; provably-ours orphans are terminated first',async t=>{
  const root=await temporary();t.after(()=>rm(root,{recursive:true,force:true}));
  const gone=await deadPid();
  // Unknown start token: alive but unprovable -> busy with the child pid, not signalled.
  const unproven=await idle(t);
  let path=await lockAt(root,{pid:gone,start:'x',id:'orphan',children:[{pid:unproven.pid,start:null,command:process.execPath,role:'app'}]});
  await assert.rejects(new FileLock(path,{reclaimDead:true}).acquire(),e=>e.code==='DATA_ROOT_BUSY'&&e.details.pid===unproven.pid&&e.details.ownerPid===gone&&e.details.reason==='orphan-unproven');
  // Matching start token but a different executable: still not ours.
  const strangerStart=(await processIdentity(unproven.pid)).start;
  await lockAt(root,{pid:gone,start:'x',id:'orphan2',children:[{pid:unproven.pid,start:strangerStart,command:'/usr/bin/false',role:'app'}]});
  await assert.rejects(new FileLock(path,{reclaimDead:true}).acquire(),e=>e.code==='DATA_ROOT_BUSY'&&e.details.pid===unproven.pid&&e.details.reason==='orphan-unproven');
  await delay(50);assert(pidAlive(unproven.pid));
  // Same pid + start token + executable: provably ours -> SIGTERM, then SIGKILL after the grace, then reclaim.
  const ours=await idle(t,{ignoreTerm:true});const ourStart=(await processIdentity(ours.pid)).start;
  const exited=new Promise(r=>ours.once('exit',(code,signal)=>r({code,signal})));
  await lockAt(root,{pid:gone,start:'x',id:'orphan3',children:[{pid:unproven.pid,start:'Thu Jan  1 00:00:00 1970',command:process.execPath,role:'launcher'},{pid:ours.pid,start:ourStart,command:process.execPath,role:'app'}]});
  const lock=new FileLock(path,{reclaimDead:true,orphanGraceMs:60});await lock.acquire();
  const death=await exited;assert.equal(death.signal,'SIGKILL');assert(pidAlive(unproven.pid),'a reused child pid must not be signalled');
  await lock.release();
  console.log('AH-L04 orphan handling:',JSON.stringify({unproven:unproven.pid,terminated:ours.pid,death}));
});
async function orphanedRuntime(t){
  // The desktop shell force-kills its tree: host and guardian die together; launcher + app survive.
  const root=await temporary();
  const initial=new AtomicFileStore(join(root,'sidecar'));await initial.init();await initial.save(emptySnapshot());await initial.close();
  const child=fork(new URL('./fixtures/crash-worker.mjs',import.meta.url),['recovery',root,''],{stdio:['ignore','pipe','pipe','ipc']});
  let stderr='';child.stderr.on('data',b=>{stderr+=b;});child.stdout.resume();
  const message=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Checkpoint timeout: '+stderr)),10_000);
    child.on('message',m=>{clearTimeout(timer);m.type==='checkpoint'?resolve(m):reject(new Error(JSON.stringify(m)));});
    child.once('exit',(code,signal)=>{clearTimeout(timer);reject(new Error(`Worker exited before checkpoint ${code}/${signal}: ${stderr}`));});
  });
  const a=message.result;const lockPath=join(a.instance.dataDir,'.runtime.lock');
  const lock=JSON.parse(await readFile(lockPath,'utf8'));
  assert.equal(lock.pid,a.instance.guardianPid);assert.equal(typeof lock.start,'string');
  assert.deepEqual(lock.children.map(c=>c.role),['launcher','app']);assert.equal(lock.children[1].pid,a.instance.pid);
  assert(lock.children.every(c=>typeof c.start==='string'&&typeof c.command==='string'));assert.equal(lock.port,Number(new URL(a.instance.endpoint).port));
  const launcherPid=lock.children[0].pid;
  process.kill(a.instance.guardianPid,'SIGKILL');
  const exited=new Promise(r=>child.once('exit',r));child.kill('SIGKILL');await exited;
  await until(()=>!pidAlive(a.instance.guardianPid));
  t.after(async()=>{
    for(const pid of [launcherPid,a.instance.pid])if(pidAlive(pid)){try{process.kill(pid,'SIGKILL');}catch{}}
    await until(()=>!pidMatches(a.instance.pid,a.instance.dataDir));await rm(root,{recursive:true,force:true});
  });
  assert(pidMatches(a.instance.pid,a.instance.dataDir),'the orphaned app must still be running for this scenario');
  assert(pidAlive(launcherPid));assert.equal(await exists(lockPath),true);
  return{root,a,lockPath,launcherPid};
}
test('AH-L05: shell tree force-killed -> next open reclaims the stale runtime lock and replaces the orphaned app',async t=>{
  const {root,a,lockPath,launcherPid}=await orphanedRuntime(t);
  const {host}=await setup(null,{root,def:definition({extra:{ignoreTerm:true}})});
  try{
    const b=await host.resume(leaseInput(a));
    assert.equal(b.instance.id,a.instance.id);assert.notEqual(b.instance.pid,a.instance.pid);assert(pidAlive(b.instance.pid));
    await until(()=>!pidMatches(a.instance.pid,a.instance.dataDir));assert.equal(pidAlive(launcherPid),false);
    const lock=JSON.parse(await readFile(lockPath,'utf8'));assert.equal(lock.pid,b.instance.guardianPid);
    console.log('AH-L05 reclaimed after tree kill:',JSON.stringify({oldGuardian:a.instance.guardianPid,oldApp:a.instance.pid,newApp:b.instance.pid,newGuardian:b.instance.guardianPid}));
  }finally{await host.dispose();}
});
test('AH-L06: shell tree force-killed but the orphan cannot be proven ours -> open keeps failing DATA_ROOT_BUSY with the live pid',async t=>{
  const {root,a,lockPath,launcherPid}=await orphanedRuntime(t);
  const record=JSON.parse(await readFile(lockPath,'utf8'));
  record.children=record.children.map(c=>({...c,start:null}));await writeFile(lockPath,JSON.stringify(record));
  const {host}=await setup(null,{root,def:definition({extra:{ignoreTerm:true}})});
  try{
    await assert.rejects(host.resume(leaseInput(a)),e=>e.code==='DATA_ROOT_BUSY'&&e.details.pid===launcherPid&&e.details.ownerPid===a.instance.guardianPid);
    assert(pidMatches(a.instance.pid,a.instance.dataDir));assert(pidAlive(launcherPid));
    assert.deepEqual(JSON.parse(await readFile(lockPath,'utf8')),record);
    console.log('AH-L06 unproven orphan keeps the lock:',JSON.stringify({launcherPid,appPid:a.instance.pid}));
  }finally{await host.dispose();}
});
