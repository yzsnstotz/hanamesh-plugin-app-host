// One guardian per owned runtime. It never attaches to an arbitrary PID.
// Losing the parent's IPC channel triggers cleanup, even when the host was SIGKILLed.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileLock } from './store.js';
import { guardianEnvironment, processIdentity } from './runtime.js';
if (process.versions.electron !== undefined) {
  const refusal = { type:'guardian.refused', code:'NODE_RUNTIME_REQUIRED', message:'Guardian requires a standalone Node.js runtime.' };
  if (process.connected) await new Promise(resolve => process.send(refusal, () => resolve()));
  process.exit(78);
}
let child, lock, stopping, config;
// The guardian must outlive a killed host. Its stdout/stderr pipes die with that host;
// EPIPE is transport loss, not a reason to abandon the exact process group it owns.
for (const output of [process.stdout,process.stderr]) output.on('error', error => {
  if (error.code !== 'EPIPE') throw error;
});
const send = value => { if (process.connected) process.send(value, () => {}); };
function signalOwned(signal) {
  if (!child?.pid) return;
  try {
    // The process group was created by this exact child handle (detached:true).
    // This is not process-name matching and is never used for attach instances.
    if (process.platform !== 'win32') process.kill(-child.pid, signal);
    else if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  } catch (e) { if (e.code !== 'ESRCH') throw e; }
}
function ownedGroupAlive() {
  if (!child?.pid) return false;
  if (process.platform === 'win32') return child.exitCode === null && child.signalCode === null;
  try { process.kill(-child.pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; if (error.code === 'EPERM') return true; throw error; }
}
async function waitForOwnedGroupExit(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (ownedGroupAlive() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
  return !ownedGroupAlive();
}
async function cleanup(reason) {
  if (stopping) return stopping;
  stopping = (async () => {
    let timer, confirmed = !child?.pid;
    if (child?.pid) {
      const ended = child.exitCode !== null || child.signalCode !== null ? Promise.resolve() :
        new Promise(resolve => child.once('close', resolve));
      signalOwned('SIGTERM');
      await Promise.race([ended, new Promise(resolve => { timer = setTimeout(resolve, config.stopGraceMs); })]);
      clearTimeout(timer);
      // A descendant can hold the process group after its leader has exited.
      // Kill only the group originally created by this guardian.
      signalOwned('SIGKILL');
      confirmed = process.platform === 'win32' ? await Promise.race([
        ended.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), 2_000); }),
      ]) : await waitForOwnedGroupExit(2_000);
      clearTimeout(timer);
    }
    if (!confirmed) throw new Error('Owned process group termination was not confirmed; runtime lock retained.');
    if (lock) await lock.release();
    if (process.connected) await new Promise(resolve => process.send({ type:'stopped', reason }, () => resolve()));
    process.exit(0);
  })().catch(error => { send({ type: 'error', code: error.code ?? 'GUARDIAN_FAILURE', message: error.message, details: error.details ?? {} }); process.exit(1); });
  return stopping;
}
process.on('disconnect', () => void cleanup('host-disconnected'));
process.on('SIGTERM', () => void cleanup('guardian-term'));
process.on('SIGINT', () => void cleanup('guardian-int'));
process.on('message', async message => {
  if (message?.type === 'stop') { void cleanup('requested'); return; }
  if (message?.type !== 'launch' || config) return;
  config = message.config;
  try {
    if (!process.connected || stopping) return;
    // A force-killed guardian leaves this lock behind. The record names this pid + start token and
    // the children created below, so the next guardian can prove the stale owner dead (or its
    // orphans ours) instead of failing DATA_ROOT_BUSY until a human deletes the file.
    lock = new FileLock(join(config.dataDir, '.runtime.lock'), { reclaimDead: true, orphanGraceMs: config.stopGraceMs });
    await lock.acquire();
    if (!process.connected || stopping) { await lock.release(); return; }
    child = spawn(config.nodeBinary, [fileURLToPath(new URL('./launcher.js', import.meta.url))], {
      env: guardianEnvironment(config.nodeBinary), shell: false,
      detached: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
    const record = async (pid, role, command, group) => {
      const live = await processIdentity(pid);
      await lock.annotate({ child: { pid, role, command, group, start: live?.start ?? null }, port: config.port ?? null });
    };
    // The launcher (group leader) is recorded before it is told to launch anything.
    child.once('spawn', () => record(child.pid, 'launcher', config.nodeBinary, true).then(() => child.send({type:'launch',config}, error => {
      if(error){send({type:'error',code:'SPAWN_FAILED',message:error.message});void cleanup('ipc-error');}
    }), error => { send({type:'error',code:error.code ?? 'SPAWN_FAILED',message:error.message}); void cleanup('lock-annotate-error'); }));
    child.on('message', message => {
      if(message.type==='spawned')record(message.pid,'app',config.command,false).then(()=>send({type:'spawned',pid:message.pid,groupId:child.pid,
        guardianBinary:process.execPath,launcherBinary:message.launcherBinary}),
        error=>{send({type:'error',code:error.code ?? 'GUARDIAN_FAILURE',message:error.message});void cleanup('lock-annotate-error');});
      if(message.type==='app-exit'){send(message);if(!stopping)void cleanup('app-exited');}
      if(message.type==='error'){send(message);void cleanup('spawn-error');}
    });
    child.once('error', error => { send({ type: 'error', code: 'SPAWN_FAILED', message: error.message }); void cleanup('spawn-error'); });
    child.once('exit', (code, signal) => {
      if(!stopping){send({type:'app-exit',code,signal});void cleanup('group-leader-exited');}
    });
  } catch (error) {
    send({ type: 'error', code: error.code ?? 'SPAWN_FAILED', message: error.message, details: error.details ?? {} });
    void cleanup('setup-error');
  }
});
send({ type: 'guardian-ready' });
