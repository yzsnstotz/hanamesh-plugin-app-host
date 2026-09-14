import { mkdtemp,writeFile,readFile,rm,realpath } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const tarball=resolve(process.argv[2]??'hanamesh-dsh-app-host-0.1.0-rc.6.tgz');
await readFile(tarball);
const root=await mkdtemp(join(await realpath(tmpdir()),'hm-app-host-package-'));
try{
  await writeFile(join(root,'package.json'),JSON.stringify({private:true,type:'module'}));
  const installed=spawnSync('npm',['install','--offline','--ignore-scripts','--legacy-peer-deps','--no-audit','--no-fund',tarball],{cwd:root,encoding:'utf8',timeout:15000});
  process.stdout.write(installed.stdout??'');process.stderr.write(installed.stderr??'');if(installed.status!==0)throw new Error('Isolated offline tarball install failed.');
  await writeFile(join(root,'app.mjs'),`import {createServer} from 'node:http';import{writeFile}from'node:fs/promises';import{join}from'node:path';const[port,data]=process.argv.slice(2);await writeFile(join(data,'independent-app.txt'),'actual app write');createServer((req,res)=>res.end('PACKAGE_SMOKE_IDENTITY')).listen(Number(port),'127.0.0.1');`);
  await writeFile(join(root,'verify.mjs'),`
    import assert from 'node:assert/strict';import{join}from'node:path';import{readFile}from'node:fs/promises';
    import{AppHost,AtomicFileStore}from'@hanamesh/dsh-app-host';import{WorkspaceAppClient}from'@hanamesh/dsh-app-host/client';
    const root=import.meta.dirname;const host=new AppHost({store:new AtomicFileStore(join(root,'sidecar')),dataRoot:join(root,'data'),parentOrigin:'http://127.0.0.1:49123'});
    host.register({id:'installed',name:'Installed package',deployments:[{id:'local',dataId:'v1',mode:'owned',command:process.execPath,args:[join(root,'app.mjs'),'{{port}}','{{dataDir}}'],readiness:{path:'/',status:200,bodyIncludes:'PACKAGE_SMOKE_IDENTITY'},stopGraceMs:60}]});
    try{await host.init();const result=await host.open({appId:'installed',deploymentId:'local',viewId:'installed-view'});assert.equal(await readFile(join(result.instance.dataDir,'independent-app.txt'),'utf8'),'actual app write');assert.equal(typeof WorkspaceAppClient,'function');
    // The ./dsh entry needs the pinned DSH peers (schemastery, storage-domain): without them it cannot load at all, so it cannot masquerade as a plugin here. Its real load is the H01 profile run.
    await assert.rejects(import('@hanamesh/dsh-app-host/dsh'),{code:'ERR_MODULE_NOT_FOUND'});
    console.log(JSON.stringify({check:'ISOLATED_PACKAGE',status:'PASS',realOwnedPid:result.instance.pid,realAppData:true,installedExports:['.','./client'],dshEntry:'requires pinned DSH peers; verified separately in the real profile',sourceTreeImports:0}));}
    finally{await host.dispose();}
  `);
  const run=spawnSync(process.execPath,['verify.mjs'],{cwd:root,encoding:'utf8',timeout:15000});
  process.stdout.write(run.stdout??'');process.stderr.write(run.stderr??'');if(run.status!==0)throw new Error('Installed artifact smoke failed.');
}finally{await rm(root,{recursive:true,force:true});}
