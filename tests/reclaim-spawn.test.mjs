import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFile,readFile,rm,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnOwned,processIdentity} from '../src/runtime.js';
import {temporary,until,pidAlive} from './helpers.mjs';

test('AH-L07: proven orphan reclamation gets its declared grace before the launch handshake budget',async t=>{
  const dir=await temporary();t.after(()=>rm(dir,{recursive:true,force:true}));
  const orphan=spawn(process.execPath,['-e','process.on("SIGTERM",()=>console.log("ORPHAN_TERM_IGNORED"));setInterval(()=>{},1000);console.log("ORPHAN_READY")'],{detached:true,stdio:['ignore','pipe','ignore']});
  const trace=[];orphan.stdout.on('data',b=>trace.push({at:Date.now(),message:b.toString().trim()}));
  await new Promise((resolve,reject)=>{orphan.stdout.once('data',resolve);orphan.once('error',reject);});
  t.after(async()=>{if(orphan.exitCode===null&&orphan.signalCode===null)process.kill(-orphan.pid,'SIGKILL');await until(()=>!pidAlive(orphan.pid));});
  const dead=spawn(process.execPath,['-e','0'],{stdio:'ignore'});await new Promise(resolve=>dead.once('exit',resolve));
  const live=await processIdentity(orphan.pid),record={pid:dead.pid,start:'dead',id:'reclaim-spawn-fixture',children:[{pid:orphan.pid,start:live.start,command:process.execPath,role:'launcher',group:true}]};
  await writeFile(join(dir,'.runtime.lock'),JSON.stringify(record));
  const started=Date.now();let runner;
  try{
    runner=await spawnOwned({nodeBinary:process.execPath,command:process.execPath,args:['-e','setInterval(()=>{},1000)'],cwd:dir,dataDir:dir,port:null,env:{PATH:'/usr/bin:/bin'},stopGraceMs:5000});
    assert(pidAlive(runner.pid),'the replacement app must actually be running');
    assert.equal(pidAlive(orphan.pid),false,'only the proven orphan must be gone before launch');
    const claimed=JSON.parse(await readFile(join(dir,'.runtime.lock'),'utf8'));
    assert.equal(claimed.pid,runner.guardianPid,'runtime lock must belong to the new exact guardian');
    assert(claimed.children.some(child=>child.role==='app'&&child.pid===runner.pid),'new app must be annotated before the spawn acknowledgement');
    console.log(JSON.stringify({evidence:'REAL_PROCESS_ISOLATED',result:'spawned',elapsedMs:Date.now()-started,oldOrphanPid:orphan.pid,newGuardianPid:runner.guardianPid,newAppPid:runner.pid,lockOwner:claimed.pid,trace}));
  }catch(error){
    console.log(JSON.stringify({evidence:'REAL_PROCESS_ISOLATED',result:error.code,elapsedMs:Date.now()-started,orphanAlive:pidAlive(orphan.pid),lockOwnerUnchanged:JSON.parse(await readFile(join(dir,'.runtime.lock'),'utf8')).id===record.id,trace}));
    assert.fail(`proven orphan reclaim followed by launch must succeed, got ${error.code}`);
  }finally{if(runner)await runner.stop();}
});

async function fakeGuardian(t,behavior){
  const dir=await temporary();t.after(()=>rm(dir,{recursive:true,force:true}));
  const script=join(dir,'guardian.mjs'),binary=join(dir,'假 guardian runner');
  await writeFile(script,`const send=value=>process.send(value,()=>{});
process.on('message',m=>{
 if(m.type==='stop'){send({type:'stopped'});setTimeout(()=>process.exit(0),5);return;}
 if(m.type==='launch'){
  ${behavior}
 }
});
send({type:'guardian-ready'});
setInterval(()=>{},1000);`);
  const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
  await writeFile(binary,'#!/bin/sh\nexec '+quote(process.execPath)+' '+quote(script)+'\n');await chmod(binary,0o700);
  return {nodeBinary:binary,command:process.execPath,args:['-e','0'],cwd:dir,dataDir:dir,port:null,env:{PATH:'/usr/bin:/bin'},stopGraceMs:50};
}
test('AH-L08: hung ownership guardian is bounded by bootstrap plus declared grace and kill confirmation',async t=>{
  const config=await fakeGuardian(t,''),start=Date.now();
  await assert.rejects(spawnOwned(config),e=>e.code==='TIMEOUT'&&e.message==='Runtime ownership recovery timed out.');
  assert(Date.now()-start>=7000);assert(Date.now()-start<15000,'hung ownership must not wait indefinitely');
});
test('AH-L09: after ownership-ready a hung launcher handshake keeps its independent five second bound',async t=>{
  const config=await fakeGuardian(t,"send({type:'ownership-ready'});"),start=Date.now();
  await assert.rejects(spawnOwned(config),e=>e.code==='TIMEOUT'&&e.message==='Process spawn timed out.');
  assert(Date.now()-start>=4900);assert(Date.now()-start<10000,'hung launcher must not wait indefinitely');
});
for(const afterOwnership of [false,true])for(const failure of ['error','exit'])test(`AH-L10: guardian ${failure} ${afterOwnership?'after':'before'} ownership-ready fails immediately`,async t=>{
  const config=await fakeGuardian(t,(afterOwnership?"send({type:'ownership-ready'});":"")+(failure==='error'?"send({type:'error',code:'TEST_EARLY',message:'SYNTHETIC_EARLY_FAILURE'});":"process.exit(1);")),start=Date.now();
  await assert.rejects(spawnOwned(config),e=>e.code===(failure==='error'?'TEST_EARLY':'SPAWN_FAILED'));
  assert(Date.now()-start<2000,'early failure must not wait for either timeout');
});
