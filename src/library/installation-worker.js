/** Detached reaper: it outlives the caller and owns the neutral directory, outside the command group. */
import {fork,spawnSync} from 'node:child_process';
import {mkdtempSync,realpathSync,rmSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
let started=false,finishing=false,finalized=false,directory,anchor,anchorExited=false,payload;
function groupMetadata(){
 const result=spawnSync('/bin/ps',['-axo','pid=,pgid=,uid=,stat='],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
 if(result.status!==0)throw new Error('Owned group metadata is unavailable.');
 const rows=result.stdout.trim().split('\n').filter(Boolean).map(line=>{
  const match=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s*$/.exec(line);
  if(!match)throw new Error('Owned group metadata is invalid.');
  return{pid:Number(match[1]),pgid:Number(match[2]),uid:Number(match[3]),state:match[4]};
 });
 return rows.filter(row=>row.pgid===anchor.pid);
}
async function confirmOwnedGroupGone(){
 if(process.platform==='win32'||!anchor)return;
 // Observe only the PGID created by this anchor, never send another termination
 // signal after its PID could be reused. close(anchor) alone does not reap descendants.
 const deadline=Date.now()+1000;const observed=new Set();
 while(true){
  try{process.kill(-anchor.pid,0)}catch(error){
   if(error.code==='ESRCH')return;
   if(error.code!=='EPERM')throw error;
   // Darwin may return EPERM for an empty or zombie-only process group. Read
   // metadata only (never argv/commands); a foreign UID or unknown state fails closed.
   const members=groupMetadata();
   if(members.some(row=>row.uid!==process.getuid()||!/^[-A-Za-z+<>]+$/.test(row.state)))throw error;
   for(const row of members)observed.add(row.pid);
   if(members.length===0){
    let remaining=false;for(const pid of observed){try{process.kill(pid,0);remaining=true}catch(probe){if(probe.code!=='ESRCH')throw probe}}
    if(!remaining)return;
   }
  }
  if(Date.now()>=deadline)throw new Error('Owned command group did not finish reaping.');
  await new Promise(resolve=>setTimeout(resolve,5));
 }
}
async function finalize(){
 if(finalized)return;finalized=true;
 let cleanupComplete=false;
 // Normal owned shutdown reaches here after the live group was killed and its anchor closed.
 // An external SIGKILL/native crash of an internal supervisor is outside automatic recovery.
 try{await confirmOwnedGroupGone();
  if(directory){rmSync(directory,{recursive:true,force:true,maxRetries:4,retryDelay:25});try{lstatSync(directory);throw new Error('Owned neutral directory survived cleanup.')}catch(error){if(error.code!=='ENOENT')throw error}}
  cleanupComplete=true;
 }catch{payload={error:'AGENT_READER_CLEANUP_FAILED'}}
 payload={...payload,cleanupComplete};
 let flushed=0;const complete=()=>{if(++flushed!==2)return;const exit=()=>process.exit(0);
  if(process.connected){try{process.send(payload,exit)}catch{exit()}}else exit();
 };
 process.stdout.write('',complete);process.stderr.write('',complete);
}
function finish(value){
 if(finishing)return;finishing=true;payload=value;
 if(anchor&&!anchorExited){
  // The IPC anchor deliberately stays alive after command completion. Kill only its still-owned group.
  try{if(process.platform==='win32'){
   const result=spawnSync(join(process.env.SystemRoot,'System32','taskkill.exe'),['/pid',String(anchor.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
   if(result.status!==0)payload={error:'AGENT_READER_FAILED'};
  }else process.kill(-anchor.pid,'SIGKILL')}catch{payload={error:'AGENT_READER_FAILED'}}
 }else if(!anchor)finalize();
}
process.once('disconnect',()=>finish({error:'INSTALLATION_STATUS_CANCELLED'}));
process.once('SIGTERM',()=>finish({error:'INSTALLATION_STATUS_CANCELLED'}));
process.once('SIGINT',()=>finish({error:'INSTALLATION_STATUS_CANCELLED'}));
process.once('uncaughtException',()=>finish({error:'AGENT_READER_FAILED'}));
process.once('unhandledRejection',()=>finish({error:'AGENT_READER_FAILED'}));
if(!process.connected)process.exit(1);
process.on('message',request=>{
 if(request.abort){finish({error:'INSTALLATION_STATUS_CANCELLED'});return}
 if(started)return;started=true;
 try{
  if(!process.connected){finish({error:'INSTALLATION_STATUS_CANCELLED'});return}
  directory=mkdtempSync(join(realpathSync(request.temporaryRoot),'hanamesh-installation-read-'));
  process.send({directory},error=>{if(error)finish({error:'INSTALLATION_STATUS_CANCELLED'})});
  const env={...request.env,TMPDIR:directory,TMP:directory,TEMP:directory};
  anchor=fork(new URL('./installation-command-worker.js',import.meta.url),[],{cwd:directory,env,execArgv:[],detached:process.platform!=='win32',stdio:['ignore','pipe','pipe','ipc']});
  anchor.stdout.pipe(process.stdout,{end:false});anchor.stderr.pipe(process.stderr,{end:false});
  anchor.on('message',value=>finish(value));
  anchor.once('exit',()=>{anchorExited=true});
  anchor.once('error',()=>{if(!finishing){finishing=true;payload={error:'AGENT_READER_UNAVAILABLE'}}});
  anchor.once('close',()=>{if(!finishing){finishing=true;payload={error:'AGENT_READER_FAILED'}}finalize()});
  anchor.send({executable:request.executable,args:request.args},error=>{if(error)finish({error:'AGENT_READER_UNAVAILABLE'})});
 }catch{finish({error:'AGENT_READER_UNAVAILABLE'})}
});
