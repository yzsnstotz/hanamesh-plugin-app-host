// A live group leader prevents process-group-ID reuse during cleanup.
// It intentionally remains alive until the guardian terminates the owned group.
import { spawn } from 'node:child_process';
const send=value=>{if(process.connected)process.send(value,()=>{});};
let started=false;
process.on('SIGTERM',()=>{});
process.on('SIGINT',()=>{});
process.on('message',message=>{
  if(started||message?.type!=='launch')return;started=true;
  const c=message.config;
  const app=spawn(c.command,c.args,{cwd:c.cwd,env:c.env,shell:false,detached:false,stdio:['ignore','inherit','inherit']});
  app.once('spawn',()=>send({type:'spawned',pid:app.pid,launcherBinary:process.execPath}));
  app.once('error',e=>send({type:'error',code:'SPAWN_FAILED',message:e.message}));
  app.once('exit',(code,signal)=>send({type:'app-exit',code,signal}));
});
// The guardian owns this handle and is responsible for reaping it.
setInterval(()=>{},60_000);
