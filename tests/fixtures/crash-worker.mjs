import { join } from 'node:path';
import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { AppHost, AtomicFileStore } from '../../src/index.js';
import { definition,parentOrigin,until } from '../helpers.mjs';
const [mode,root,point,attachOrigin]=process.argv.slice(2);let paused=false;
const alive=pid=>{try{return !execFileSync('ps',['-o','stat=','-p',String(pid)],{encoding:'utf8'}).trim().startsWith('Z');}catch{return false;}};
// Hold the event loop at the cut: a pending promise alone does not keep Node alive, so without a ref'd
// handle the worker would exit (code 13) right after the checkpoint and race the parent's SIGKILL.
const holdForKill=()=>setInterval(()=>{},2**30);
const pause=async details=>{if(paused)return;paused=true;holdForKill();process.send({type:'checkpoint',...details});await new Promise(()=>{});};
const store=new AtomicFileStore(join(root,'sidecar'),{checkpoint:async(at,snapshot)=>{
  const matches=mode==='group-first'?snapshot.instances.length===1&&snapshot.instances[0].status==='reserved':
    mode==='group-stop'?snapshot.instances[0]?.status==='stopped':false;
  if(matches&&at===point)await pause({at,snapshot});
}});
let lastRuntime;
const host=new AppHost({store,dataRoot:join(root,'data'),parentOrigin,sweepIntervalMs:0,leaseTtlMs:60_000,
  checkpoint:async(at,details)=>{
    if(at==='runtime-spawned')lastRuntime=details;
    if(mode==='boundary-reserve'&&at==='runtime-spawned'){
      await until(()=>access(join(details.dataDir,'runtime-evidence.json')).then(()=>true));
      await pause({at,...details,aliveAtCut:alive(details.pid)});
    }
    if(mode==='boundary-stop'&&at==='runtime-stopped')await pause({at,...lastRuntime,aliveAtCut:alive(lastRuntime.pid)});
  }});
try{
  const def=definition({extra:{ignoreTerm:true,...(mode==='boundary-reserve'?{spamLogs:true}:{})}});
  if(process.platform==='win32'&&mode==='group-stop'){
    if(!attachOrigin)throw Error('Parent-owned attach fixture origin required.');
    def.deployments=[{id:'local',dataId:'data-v1',mode:'attach',url:attachOrigin,readiness:{path:'/health',status:200,bodyIncludes:'HANAMESH_FIXTURE'}}];
  }
  host.register(def);await host.init();
  const result=await host.open({appId:'example',deploymentId:'local',viewId:'crash-view',originalSessionId:'exact-document'});
  if(mode==='group-stop'||mode==='boundary-stop')await host.stop(result.instance.id,{confirm:true});
  else if(mode==='recovery')await pause({at:'ready',result});
  else throw new Error('Expected crash checkpoint was not reached.');
}catch(error){if(process.connected)process.send({type:'error',code:error.code,message:error.message,stack:error.stack});process.exitCode=1;await host.dispose().catch(()=>{});process.disconnect?.();}
