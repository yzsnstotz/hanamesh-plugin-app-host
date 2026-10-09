export const javascript = `
import {runCatalogProviderSuite,runCatalogConsumerSuite} from '@hanamesh/dsh-app-host/catalog/suite';
import assertCatalog from 'node:assert/strict';
for(const report of [await runCatalogProviderSuite(),await runCatalogConsumerSuite()]){assertCatalog.equal(report.fail,0,JSON.stringify(report));console.log(JSON.stringify(report));}

import {writeFile as writeProbeFile} from 'node:fs/promises';
import {join as joinProbePath} from 'node:path';
await writeProbeFile(joinProbePath(import.meta.dirname,'app.mjs'), \`import {createServer} from 'node:http';import{writeFile}from'node:fs/promises';import{join}from'node:path';const[port,data]=process.argv.slice(2);await writeFile(join(data,'independent-app.txt'),'actual app write');createServer((req,res)=>res.end('PACKAGE_SMOKE_IDENTITY')).listen(Number(port),'127.0.0.1');\`);

    import assert from 'node:assert/strict';import{join}from'node:path';import{readFile}from'node:fs/promises';
    import{AppHost,AtomicFileStore}from'@hanamesh/dsh-app-host';import{WorkspaceAppClient}from'@hanamesh/dsh-app-host/client';
    const root=import.meta.dirname;const host=new AppHost({store:new AtomicFileStore(join(root,'sidecar')),dataRoot:join(root,'data'),parentOrigin:'http://127.0.0.1:49123'});
    host.register({id:'installed',name:'Installed package',deployments:[{id:'local',dataId:'v1',mode:'owned',command:process.execPath,args:[join(root,'app.mjs'),'{{port}}','{{dataDir}}'],readiness:{path:'/',status:200,bodyIncludes:'PACKAGE_SMOKE_IDENTITY'},stopGraceMs:60}]});
    try{await host.init();const result=await host.open({appId:'installed',deploymentId:'local',viewId:'installed-view'});assert.equal(await readFile(join(result.instance.dataDir,'independent-app.txt'),'utf8'),'actual app write');assert.equal(typeof WorkspaceAppClient,'function');
    // The ./dsh entry needs the pinned DSH peers (schemastery, storage-domain): without them it cannot load at all, so it cannot masquerade as a plugin here. Its real load is the H01 profile run.
    await assert.rejects(import('@hanamesh/dsh-app-host/dsh'),{code:'ERR_MODULE_NOT_FOUND'});
    console.log(JSON.stringify({check:'ISOLATED_PACKAGE',status:'PASS',realOwnedPid:result.instance.pid,realAppData:true,installedExports:['.','./client'],dshEntry:'requires pinned DSH peers; verified separately in the real profile',sourceTreeImports:0}));}
    finally{await host.dispose();}
  

import assertInstallTarget from 'node:assert/strict';
import {runProviderSuite,runConsumerSuite,runChainSuite} from '@hanamesh/dsh-app-host/install-target/suite';
import {createReferenceConsumer} from '@hanamesh/dsh-app-host/install-target/fixtures/reference-consumer.js';
// The shipped contract suite runs from the installed tarball without host peers: provider routes/client and both consumer fixtures.
const installTargetReports=[await runProviderSuite()];
for(const consumer of [createReferenceConsumer(),createReferenceConsumer({contractVersion:undefined})])installTargetReports.push(await runConsumerSuite(consumer),await runChainSuite(consumer));
for(const report of installTargetReports)assertInstallTarget.equal(report.fail,0,JSON.stringify(report.results.filter(result=>result.outcome==='fail')));
console.log(JSON.stringify({check:'INSTALL_TARGET_CONTRACT',status:'PASS',reports:installTargetReports.map(({suite,consumer,total,pass,fail,skipped})=>({suite,consumer,total,pass,fail,skipped}))}));
`;
export const typescript = `
import {runCatalogProviderSuite,runCatalogConsumerSuite,type CatalogSuiteReport} from '@hanamesh/dsh-app-host/catalog/suite';
const catalogReports:Promise<CatalogSuiteReport>[]=[runCatalogProviderSuite(),runCatalogConsumerSuite()];void catalogReports;

import {openInstallTarget,INSTALL_TARGET_HASH,createMarketSeat} from '@hanamesh/dsh-app-host/client-ui';
await openInstallTarget({packageName:'example-plugin'});
await createMarketSeat().openInstallTarget({itemId:'catalog-id'});
INSTALL_TARGET_HASH satisfies '#hanamesh-install?';
await openInstallTarget({packageName:'example-plugin',contractVersion:'1'});
// @ts-expect-error Only a supported install-target contract version can be declared.
await openInstallTarget({packageName:'example-plugin',contractVersion:'2'});
import {runProviderSuite,runConsumerSuite,runChainSuite,type InstallTargetConsumer,type ContractSuiteReport} from '@hanamesh/dsh-app-host/install-target/suite';
const probeConsumer:InstallTargetConsumer={contractVersion:'1',navigate:()=>({ok:false,code:'INVALID_INSTALL_TARGET'}),handshake:()=>({ok:false,code:'CONTRACT_VERSION_UNSUPPORTED'})};
const probeReports:Promise<ContractSuiteReport>[]=[runProviderSuite(),runConsumerSuite(probeConsumer),runChainSuite(probeConsumer)];void probeReports;
// @ts-expect-error Download URLs and version metadata are owned by the market.
await openInstallTarget({itemId:'catalog-id',url:'https://example.test/pkg.tgz',version:'9.0.0'});
import { AppHost,AtomicFileStore,createHttpHandler,type AppDefinition,type DshStorageBinding } from '@hanamesh/dsh-app-host';
import { WorkspaceAppClient } from '@hanamesh/dsh-app-host/client';
import { apply,domainBinding,browserAuthentication,type DshPluginConfig } from '@hanamesh/dsh-app-host/dsh';
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
`;
