import { AppHost,AtomicFileStore,createHttpHandler,type AppDefinition,type DshStorageBinding } from '../dist/index.js';
import { WorkspaceAppClient } from '../dist/client.js';
import { apply,domainBinding,browserAuthentication,type DshPluginConfig } from '../dist/dsh.js';
const definition:AppDefinition={id:'example',name:'Example',deployments:[{id:'local',dataId:'data1',mode:'owned',command:'/absolute/node',args:['app.mjs','{{port}}','{{dataDir}}'],readiness:{path:'/health',status:200,bodyIncludes:'EXAMPLE'}}]};
const host=new AppHost({store:new AtomicFileStore('/tmp/example-state'),dataRoot:'/tmp/example-data',parentOrigin:'http://127.0.0.1:40000'});
host.register(definition);
const opened=await host.beginOpen({appId:'example',deploymentId:'local',viewId:'view'});
await host.resume({viewId:'view',leaseToken:opened.leaseToken});
await host.recoverView({viewId:'view',instanceId:opened.instance.id,confirm:true});
await host.stop(opened.instance.id,{confirm:true});
createHttpHandler(host,{parentOrigin:'http://127.0.0.1:40000',authenticate:(_req:unknown)=>({principalId:'test'}),authorize:()=>true});
const client=new WorkspaceAppClient({origin:'http://127.0.0.1:40000'});
const pending=await client.open({appId:'example',deploymentId:'local',viewId:'view'});
const ready=await client.waitUntilReady(pending);ready.instance.id satisfies string;
// @ts-expect-error Browser contract does not disclose process IDs or filesystem paths.
ready.instance.pid;
// @ts-expect-error Command overrides are not part of the browser Open contract.
await client.open({appId:'example',deploymentId:'local',viewId:'view',command:'/bin/sh'});
// @ts-expect-error Recovery must explicitly confirm invalidation.
await client.recoverView({viewId:'view',instanceId:'x',confirm:false});
const dshConfig:DshPluginConfig={dataRoot:'/tmp/example-data',applications:[definition]};
const binding:DshStorageBinding=domainBinding({global:{get:()=>null,set:async()=>{}},close:async()=>{}});
const authentication=browserAuthentication({requestRejection:()=>undefined});
const dshEntry:(ctx:unknown,config:DshPluginConfig)=>Promise<void>=apply;
void [dshConfig,binding,authentication,dshEntry]; // Type-only exercise, not evidence of real DSH integration.
