/** Live command-group anchor. Its separate reaper removes the cwd only after this group has ended. */
import {spawn} from 'node:child_process';
let started=false,reported=false;
const stopOwnedGroup=()=>process.kill(-process.pid,'SIGKILL');
function report(payload){
 if(reported)return;reported=true;
 if(process.connected){try{process.send(payload,error=>{if(error)stopOwnedGroup()})}catch{stopOwnedGroup()}}else stopOwnedGroup();
 // Remain the live group owner until the reaper terminates us; never release a reusable PGID early.
}
process.once('disconnect',stopOwnedGroup);
process.once('SIGTERM',stopOwnedGroup);process.once('SIGINT',stopOwnedGroup);
process.once('uncaughtException',()=>report({error:'AGENT_READER_FAILED'}));
process.once('unhandledRejection',()=>report({error:'AGENT_READER_FAILED'}));
if(!process.connected)process.exit(1);
process.on('message',request=>{
 if(started)return;started=true;
 try{
  const child=spawn(request.executable,request.args,{cwd:process.cwd(),env:process.env,detached:false,shell:false,stdio:['ignore','pipe','pipe']});
  child.stdout.pipe(process.stdout,{end:false});child.stderr.pipe(process.stderr,{end:false});
  child.once('error',error=>report({error:error.code==='EACCES'?'AGENT_READER_PERMISSION_DENIED':'AGENT_READER_UNAVAILABLE'}));
  // An exited leader may leave descendants holding its pipes. Keep ownership until EOF or reaper cancellation.
  child.once('close',code=>{
   let flushed=0;const complete=()=>{if(++flushed===2)report({result:code})};
   process.stdout.write('',complete);process.stderr.write('',complete);
  });
 }catch{report({error:'AGENT_READER_UNAVAILABLE'})}
});
