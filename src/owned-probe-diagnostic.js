import { execFile } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';

// Explicit card-run opt-in. No environment, credentials, argv of other processes,
// or lsof output is recorded. Writes never join the readiness promise.
export function probeDiagnosticSink(directory) {
  return event => { void appendFile(join(directory, 'owned-lsof.jsonl'), JSON.stringify(event)+'\n').catch(()=>{}); };
}
export function observeOwnedProbe(child, { port, args, source, emit }) {
  const start = performance.now();
  const startedAt = new Date().toISOString();
  const base = { source, pid: child.pid ?? null, port, address: '127.0.0.1', args, startedAt, timeoutMs: 1000 };
  let observer, identityObserver, finished = false, pgid = null;
  const write = event => { try { emit({...base,...event}); } catch {} };
  write({phase:'start', pgid:null, pgidSource:'pending exact-pid ps'});
  if (child.pid) {
    identityObserver = execFile('/bin/ps', ['-p',String(child.pid),'-o','pid=,pgid='],
      {timeout:150,maxBuffer:4096}, (error,stdout)=>{
        const fields=stdout.trim().split(/\s+/);
        pgid = Number(fields[0])===child.pid?Number(fields[1]):null;
        write({phase:'identity',pgid,
          pgidSource:'exact-pid ps',observerExit:error?.code??0,observerSignal:error?.signal??null,
          blindSpot:Number(fields[0])===child.pid?null:'Probe exited or ps could not observe its group.'});
      });
  }
  const timer = setTimeout(()=>{
    if (finished || child.exitCode !== null || child.signalCode !== null || !child.pid) return;
    const targetPid = child.pid;
    // ps selects only the child handle while it is alive. No command/env fields.
    observer = execFile('/bin/ps', ['-p',String(targetPid),'-o','pid=,pgid=,stat=,wchan='],
      {timeout:150,maxBuffer:4096}, (error, stdout)=>{
        const fields = stdout.trim().split(/\s+/);
        const matched = Number(fields[0]) === targetPid;
        write({phase:'wait-state',targetPid, observedAt:new Date().toISOString(),
          pgid:matched?Number(fields[1]):null, state:matched?fields[2]:null, wait:matched?fields.slice(3).join(' '):null,
          observerExit:error?.code??0, observerSignal:error?.signal??null,
          observerKilled:error?.killed??false, sourceStage:'slow-window exact-pid ps',
          blindSpot:'No stack collected: stack sampling may suspend target or outlive the original 1000ms budget; ps wait availability depends on platform permissions.'});
      });
  },250);
  timer.unref();
  child.once('error', error=>write({phase:'error',errorCode:error.code??null}));
  child.once('exit',(exit,signal)=>{
    finished=true; clearTimeout(timer);
    for (const ownedObserver of [observer,identityObserver]) {
      if (ownedObserver && ownedObserver.exitCode===null && ownedObserver.signalCode===null) ownedObserver.kill('SIGTERM');
    }
    write({phase:'end',endedAt:new Date().toISOString(),elapsedMs:performance.now()-start,
      pgid,exit,signal,killed:child.killed,sourceStage:'owned execFile exit'});
  });
  child.once('close',()=>{clearTimeout(timer);});
}
