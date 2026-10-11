import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import * as diagnostics from '../src/owned-probe-diagnostic.js';
for (const [name, script, expected] of [
  ['slow exit', 'setTimeout(()=>process.exit(7),450)', {code:7,signal:null,killed:false}],
  ['timeout', 'setInterval(()=>{},100)', {code:null,signal:'SIGTERM',killed:true}],
  ['signal', 'setTimeout(()=>process.kill(process.pid,"SIGTERM"),450)', {code:null,signal:'SIGTERM',killed:false}],
]) test(name, async()=>{
  assert.equal(typeof diagnostics.observeOwnedProbe,'function');
  const events=[];
  let child;
  const done=new Promise(resolve=>{child=execFile(process.execPath,['-e',script],{timeout:1000},error=>resolve(error));});
  diagnostics.observeOwnedProbe(child,{port:49152,args:['-nP','-iTCP:49152','-sTCP:LISTEN','-FpgLn'],source:'test',emit:e=>events.push(e)});
  const error=await done;
  await new Promise(r=>setTimeout(r,200));
  const end=events.find(e=>e.phase==='end');
  assert(end); assert.equal(end.pid,child.pid); assert.equal(end.port,49152);
  assert.equal(end.exit,expected.code); assert.equal(end.signal,expected.signal); assert.equal(end.killed,expected.killed);
  assert(events.some(e=>e.phase==='wait-state' && e.targetPid===child.pid));
  assert(end.elapsedMs>=400); assert(error);
  assert.throws(()=>process.kill(child.pid,0),{code:'ESRCH'});
  console.log(JSON.stringify(events));
});
test('observer errors cannot alter successful probe',async()=>{
  assert.equal(typeof diagnostics.observeOwnedProbe,'function');
  let child;
  const done=new Promise((resolve,reject)=>{child=execFile(process.execPath,['-e',''],e=>e?reject(e):resolve());});
  assert.doesNotThrow(()=>diagnostics.observeOwnedProbe(child,{port:49152,args:[],source:'test',emit(){throw new Error('sink unavailable');}}));
  await done;
});
