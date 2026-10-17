/** Internal detached anchor: the official command shares our group; only this live owner kills it. */
import {spawn} from 'node:child_process';
import {mkdtempSync,realpathSync,rmSync} from 'node:fs';
import {join} from 'node:path';
let started=false,done=false,directory;
function finish(payload){
 if(done)return;done=true;
 if(directory){try{rmSync(directory,{recursive:true,force:true})}catch{payload={error:'AGENT_READER_CLEANUP_FAILED'}}}
 const stopOwnedGroup=()=>process.kill(-process.pid,'SIGKILL');
 if(process.connected){try{process.send(payload,stopOwnedGroup)}catch{stopOwnedGroup()}}else stopOwnedGroup();
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
  const env={...request.env,XDG_CONFIG_HOME:join(directory,'config'),XDG_CACHE_HOME:join(directory,'cache'),XDG_STATE_HOME:join(directory,'state'),TMPDIR:directory,TMP:directory,TEMP:directory};
  const child=spawn(request.executable,request.args,{cwd:directory,env,detached:false,shell:false,stdio:['ignore','pipe','pipe']});
  child.stdout.pipe(process.stdout,{end:false});child.stderr.pipe(process.stderr,{end:false});
  child.once('error',error=>finish({error:error.code==='EACCES'?'AGENT_READER_PERMISSION_DENIED':'AGENT_READER_UNAVAILABLE'}));
  // Keep the IPC anchor alive after leader exit, until inherited pipes close or the parent cancels.
  child.once('close',code=>{
   // Queue completion after every forwarded output byte; self-termination cannot truncate a clean JSON result.
   let flushed=0;const complete=()=>{if(++flushed===2)finish({result:code})};
   process.stdout.write('',complete);process.stderr.write('',complete);
  });
 }catch{finish({error:'AGENT_READER_UNAVAILABLE'})}
});
