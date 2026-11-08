/** Detached reaper: it outlives the caller and owns the neutral directory, outside the command group. */
import {fork,spawnSync} from 'node:child_process';
import {mkdtempSync,realpathSync,rmSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
let started=false,finishing=false,finalized=false,directory,anchor,anchorExited=false,payload;
function finalize(){
 if(finalized)return;finalized=true;
 // Normal owned shutdown reaches here after the live group was killed and its anchor closed.
 // An external SIGKILL/native crash of an internal supervisor is outside automatic recovery.
 if(directory){try{rmSync(directory,{recursive:true,force:true,maxRetries:4,retryDelay:25});try{lstatSync(directory);payload={error:'AGENT_READER_CLEANUP_FAILED'}}catch(error){if(error.code!=='ENOENT')throw error}}catch{payload={error:'AGENT_READER_CLEANUP_FAILED'}}}
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
