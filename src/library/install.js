import { readFile, lstat, unlink, rmdir } from 'node:fs/promises';
import { join, resolve, dirname, sep } from 'node:path';
import { spawn as nodeSpawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { AppHostError, requireCondition, SerialQueue } from '../errors.js';
import { validateDefinition } from '../descriptor.js';
import { itemKind } from './catalog.js';
import { profileSnapshot, runtimeSnapshot, profileChecks, runtimeChecks, packageRestoreArgs, keepOriginals } from './recovery.js';

/** The HanaMesh suite itself (real names + the historical scoped spellings) is never installed or removed through the market. */
export const PROTECTED_PACKAGES=Object.freeze(['@hanamesh/dsh-app-host','hanamesh-core','hanamesh-usage','@hanamesh/dsh-core','@hanamesh/dsh-usage']);
const blocked=new Set(PROTECTED_PACKAGES);
const packageName=value=>typeof value==='string'&&/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value);
const versionText=value=>typeof value==='string'&&/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);
async function json(path){return JSON.parse(await readFile(path,'utf8'));}
function defaultSpawn(command,args,options){return new Promise((resolvePromise,reject)=>{const child=nodeSpawn(command,args,{...options,env:{HOME:process.env.HOME,DSH_HOME:process.env.DSH_HOME,LANG:process.env.LANG??'C.UTF-8',PATH:`${command.slice(0,command.lastIndexOf('/'))}:/usr/bin:/bin`},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);child.on('exit',(code,signal)=>resolvePromise({code,signal,stdout,stderr}));});}

async function defaults(){return await import('../provision/index.js');}

/** Runtime-created Python import caches are disposable. Preserve every other unowned file. */
async function clearGeneratedRuntimeCache(result,runtimeRoot){
  if(!Array.isArray(result?.kept)||result.kept.length===0)return;
  const target=resolve(result.target??'');
  requireCondition(target.startsWith(resolve(runtimeRoot)+sep),'RUNTIME_RESIDUE','Runtime cleanup target is outside the application runtime root.');
  const remaining=[];
  for(const rel of result.kept){
    if(typeof rel!=='string'||!/(?:^|\/)__pycache__\/[^/]+\.pyc$/.test(rel)){remaining.push(rel);continue;}
    const file=resolve(target,rel);
    if(!file.startsWith(target+sep)){remaining.push(rel);continue;}
    const info=await lstat(file).catch(error=>error.code==='ENOENT'?null:Promise.reject(error));
    if(!info?.isFile()){remaining.push(rel);continue;}
    await unlink(file);
    for(let dir=dirname(file);dir.startsWith(target+sep);dir=dirname(dir)){
      try{await rmdir(dir);}catch(error){if(error.code==='ENOTEMPTY'||error.code==='ENOENT')break;throw error;}
    }
  }
  if(remaining.length===0){try{await rmdir(target);}catch(error){if(error.code!=='ENOTEMPTY'&&error.code!=='ENOENT')throw error;}}
  const residue=await lstat(target).catch(error=>error.code==='ENOENT'?null:Promise.reject(error));
  requireCondition(remaining.length===0&&residue===null,'RUNTIME_RESIDUE','Runtime has unowned files that require manual review.',{count:remaining.length},409);
}

export function createLibraryInstaller({profileDir,profileName,dataRoot,nodeBinary,dshBin,registry='https://registry.npmjs.org',allowPrerelease=false,
  fetchImpl=globalThis.fetch,spawn=defaultSpawn,provision,remove,ledger,emit=()=>{}}){
  requireCondition(typeof profileDir==='string'&&resolve(profileDir)===profileDir,'PROFILE_DIR_REQUIRED','library.profileDir must be an absolute path.');
  requireCondition(typeof dataRoot==='string'&&resolve(dataRoot)===dataRoot,'INVALID_ROOT','dataRoot must be absolute.');
  requireCondition(typeof nodeBinary==='string'&&resolve(nodeBinary)===nodeBinary,'NODE_RUNTIME_REQUIRED','An absolute nodeBinary is required for library operations.');
  requireCondition(typeof dshBin==='string'&&resolve(dshBin)===dshBin,'DSH_BIN_REQUIRED','An absolute DSH bin.js path is required.');
  requireCondition(typeof profileName==='string'&&/^[A-Za-z0-9_.-]+$/.test(profileName),'PROFILE_NAME_REQUIRED','library.profileName is required.');
  const runtimeRoot=appId=>join(dataRoot,'runtimes',appId);
  const permitted=name=>requireCondition(packageName(name)&&!blocked.has(name),'PACKAGE_DENIED','Package name is not permitted.',{packageName:name});
  /** rc.10: one profile writer at a time inside this host; `dsh plugin` itself serialises against other writers per command. */
  const profileWriter=new SerialQueue();
  const injected={provision,remove,ledger};
  /** Injected runtime functions (tests, suites) or the vendored lib-provision export of the same name. */
  const runtimeApi=async name=>injected[name]??(await defaults())[name];
  async function installed(packageNameValue){const root=join(profileDir,'node_modules',...packageNameValue.split('/')),pkg=await json(join(root,'package.json'));const appFile=typeof pkg.hanamesh?.app==='string'?pkg.hanamesh.app:'app.json';return{pkg,definition:validateDefinition(await json(join(root,appFile)))};}
  async function run(args){const result=await spawn(nodeBinary,[dshBin,'plugin','--profile',profileName,...args],{cwd:profileDir});requireCondition(result.code===0,'DSH_PLUGIN_FAILED','DSH plugin operation failed.',{code:result.code,signal:result.signal,stderr:String(result.stderr??'').slice(-2000)},502);return result;}
  /** The exact version `dsh plugin add` will pin: the registry's `latest` dist-tag, re-checked here (the catalog's `latestVersion` is a hint only). */
  async function latest(name){
    const base=new URL(registry);requireCondition(['https:','http:'].includes(base.protocol),'REGISTRY_DENIED','Registry URL is invalid.');
    const target=new URL(`${base.href.replace(/\/$/,'')}/${encodeURIComponent(name)}/latest`);const response=await fetchImpl(target,{headers:{accept:'application/json','accept-encoding':'identity'}});
    requireCondition(response.ok,'REGISTRY_LOOKUP_FAILED','Registry latest lookup failed.',{status:response.status},502);const metadata=await response.json();const version=metadata.version;
    requireCondition(versionText(version)&&(allowPrerelease||!version.includes('-')),'UNSTABLE_VERSION','Registry latest must be an exact stable version.');
    return version;
  }
  /**
   * rc.10 compensation after a failed install: the package goes back to its baseline spec through the official CLI, runtime
   * items this operation newly claimed are removed by ownership, a replaced baseline item is provisioned again from the
   * restored definition, and then every item is read back. `restored`/`not-needed` only when every row matches the baseline.
   */
  async function recover({name,stage,base,runtime,operationId}){
    const report={status:'failed',mode:base?.spec===null?'new-install':'upgrade',stage,previousVersion:base?.module??null,actions:[],checks:[],residue:[]};
    if(!base){report.mode='unknown';report.status='not-needed';return report;}
    const fail=error=>{report.error??={code:error.code??'INSTALL_RECOVERY_FAILED',message:String(error.message??error)};};
    try{
      let now=await profileSnapshot(profileDir,name);const args=packageRestoreArgs(base,now,name);
      if(args){report.actions.push(['dsh','plugin',...args].join(' '));try{await run(args);}catch(error){fail(error);}now=await profileSnapshot(profileDir,name);}
      report.checks.push(...profileChecks(base,now,name));
    }catch(error){fail(error);report.residue.push({item:'profile',reason:'NOT_VERIFIED'});}
    if(runtime)try{
      const readLedger=await runtimeApi('ledger');let current=await runtimeSnapshot(readLedger,runtime.root);
      for(const id of Object.keys(current).filter(id=>!(id in runtime.base))){
        report.actions.push('provision remove '+id);
        try{const removed=await (await runtimeApi('remove'))(id,{root:runtime.root});if(removed?.kept?.length)report.residue.push({item:'runtime:'+id,reason:'UNOWNED_FILES_KEPT',count:removed.kept.length});}catch(error){fail(error);}
      }
      const replaced=Object.keys(runtime.base).filter(id=>JSON.stringify(runtime.base[id])!==JSON.stringify(current[id]));
      if(replaced.length&&base.spec!==null&&report.checks.every(row=>row.ok))try{
        const record=await installed(name);
        for(const id of replaced){const declared=record.definition.deployments.map(deployment=>deployment.runtime).find(value=>value?.item===id);if(!declared)continue;
          report.actions.push('provision '+id);await (await runtimeApi('provision'))(declared.manifest,{root:runtime.root,only:[id],onProgress:event=>emit({type:'library.provision-progress',appId:record.definition.id,...event})});}
      }catch(error){fail(error);}
      current=await runtimeSnapshot(readLedger,runtime.root);report.checks.push(...runtimeChecks(runtime.base,current));
    }catch(error){fail(error);report.residue.push({item:'runtime',reason:'NOT_VERIFIED'});}
    for(const row of report.checks)if(!row.ok)report.residue.push({item:row.item,expected:row.expected,actual:row.actual,reason:row.reason??'NOT_RESTORED',...(row.concurrent?{concurrent:row.concurrent}:{})});
    report.status=report.error||report.residue.length?'failed':report.actions.length?'restored':'not-needed';
    if(report.status==='failed'){try{report.originals=await keepOriginals(join(dataRoot,'library-recovery',operationId),base,runtime?.base);}catch(error){report.originals={error:{code:error.code??'ORIGINALS_NOT_KEPT',message:String(error.message??error)}};}}
    return report;
  }
  /**
   * Same path for applications and plugins: baseline → `dsh plugin add --save-exact <name>@<version>` (also the upgrade
   * path) → profile readback → application definition → runtime provision. Any failure after the baseline is compensated
   * and reported with the original error; nothing is retried.
   */
  async function transaction(item,kind,context){
    const name=item.package.name,operationId=/^[A-Za-z0-9-]{1,64}$/.test(context?.operationId??'')?context.operationId:randomUUID();let stage='baseline',base,runtime;
    try{
      base=await profileSnapshot(profileDir,name);
      stage='before-add';const version=await latest(name);
      stage='add';await run(['add','--save-exact',`${name}@${version}`]);
      stage='readback';const added=await profileSnapshot(profileDir,name);
      requireCondition(added.spec===version&&added.module===version,'INSTALL_READBACK_MISMATCH','The profile does not resolve the exact version that was added.',{expected:version,spec:added.spec,module:added.module},502);
      if(kind==='plugin')return{status:'restart-required',kind,packageName:name,version};
      stage='definition';const record=await installed(name);const declared=record.definition.deployments.map(deployment=>deployment.runtime).find(Boolean);
      if(declared){stage='provision';const root=runtimeRoot(record.definition.id);runtime={root,base:await runtimeSnapshot(await runtimeApi('ledger'),root)};
        await (await runtimeApi('provision'))(declared.manifest,{root,only:[declared.item],onProgress:event=>emit({type:'library.provision-progress',appId:record.definition.id,...event})});}
      return{status:'restart-required',kind,appId:record.definition.id,packageName:name,version};
    }catch(error){error.recovery=await recover({name,stage,base,runtime,operationId});throw error;}
  }
  async function installAs(item,kind,context){
    permitted(item.package.name);const name=item.package.name;
    emit({type:'library.install-started',...(item.id?{itemId:item.id}:{}),packageName:name,kind});
    try{const result=await profileWriter.run(()=>transaction(item,kind,context));emit({type:'library.install-done',...result});return result;}
    catch(error){emit({type:'library.install-failed',...(item.id?{itemId:item.id}:{}),packageName:name,kind,code:error.code??'INSTALL_FAILED',...(error.recovery?{recovery:error.recovery}:{})});throw error;}
  }
  return{
    async install(item,context){
      const kind=itemKind(item);
      requireCondition(kind!=='listing','NOT_INSTALLABLE','Catalog item has no npm package to install.');
      return await installAs(item,kind,context);
    },
    /** rc.28: install a plugin by package name (already verified against the catalog by the service). */
    async installPlugin({packageName:name},context){return await installAs({package:{registry:'npm',name}},'plugin',context);},
    async provisionRuntime({appId,packageName:installedName,runtimeItem}){return await profileWriter.run(async()=>{const record=await installed(installedName);requireCondition(record.definition.id===appId,'APP_ID_MISMATCH','Installed package app id does not match.');const runtime=record.definition.deployments.map(deployment=>deployment.runtime).find(value=>value?.item===runtimeItem);requireCondition(runtime,'RUNTIME_NOT_DECLARED','Runtime item is not declared.');const result=await (await runtimeApi('provision'))(runtime.manifest,{root:runtimeRoot(appId),only:[runtime.item],onProgress:event=>emit({type:'library.provision-progress',appId,...event})});return{status:'restart-required',appId,packageName:installedName,result};});},
    async uninstall({packageName:installedName,appId,runtimeItem,running}){permitted(installedName);requireCondition(!running,'INSTANCE_IN_USE','Stop all application instances before uninstalling.',{},409);return await profileWriter.run(async()=>{await run(['remove',installedName]);if(runtimeItem){const result=await (await runtimeApi('remove'))(runtimeItem,{root:runtimeRoot(appId)});await clearGeneratedRuntimeCache(result,runtimeRoot(appId));}return{status:'restart-required',kind:'application',appId,packageName:installedName,dataPreserved:true};});},
    /** rc.28: `dsh plugin remove <name>`; the suite itself (PROTECTED_PACKAGES) is refused with PACKAGE_DENIED. */
    async uninstallPlugin({packageName:installedName}){permitted(installedName);return await profileWriter.run(async()=>{await run(['remove',installedName]);return{status:'restart-required',kind:'plugin',packageName:installedName};});},
  };
}
