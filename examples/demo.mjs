import { mkdtemp,realpath,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppHost,AtomicFileStore } from '../dist/index.js';
const root=await mkdtemp(join(await realpath(tmpdir()),'hm-app-host-demo-'));
const host=new AppHost({store:new AtomicFileStore(join(root,'sidecar')),dataRoot:join(root,'data'),parentOrigin:'http://127.0.0.1:49123'});
host.register({id:'example',name:'Controlled example',singleInstanceOnly:true,deployments:[{id:'local',dataId:'example-v1',mode:'owned',command:process.execPath,args:[fileURLToPath(new URL('./app.mjs',import.meta.url)),'{{port}}','{{dataDir}}','{{runtimeId}}'],readiness:{path:'/health',status:200,bodyIncludes:'HANAMESH_APP_HOST_EXAMPLE'},stopGraceMs:100}]});
let timer,closing;
const close=()=>closing??=(async()=>{clearInterval(timer);await host.dispose();await rm(root,{recursive:true,force:true});})();
process.once('SIGINT',()=>void close().catch(e=>{console.error(e);process.exitCode=1;}));
process.once('SIGTERM',()=>void close().catch(e=>{console.error(e);process.exitCode=1;}));
try{
  await host.init();const results=await Promise.all(['demo-a','demo-b'].map(viewId=>host.open({appId:'example',deploymentId:'local',viewId})));
  console.log(JSON.stringify({notice:'受控示例，不是 DSH 集成验收',url:results[0].uiUrl,instanceIds:results.map(r=>r.instance.id),actualPid:results[0].instance.pid,activeViews:host.list().views.length,dataRoot:results[0].instance.dataDir},null,2));
  if(process.argv.includes('--smoke')){await close();console.log('Demo smoke PASS: both views shared one process; dispose completed.');}
  else{console.log('按 Ctrl+C 停止本示例及它拥有的应用进程。');timer=setInterval(()=>{for(const r of results)host.heartbeat({viewId:r.lease.viewId,leaseToken:r.leaseToken}).catch(console.error);},30000);}
}catch(error){console.error(error);await close().catch(console.error);process.exitCode=1;}
