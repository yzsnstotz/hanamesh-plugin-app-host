import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn as nodeSpawn } from 'node:child_process';
import { AppHostError, requireCondition } from '../errors.js';
import { validateDefinition } from '../descriptor.js';
import { itemKind } from './catalog.js';

/** The HanaMesh suite itself (real names + the historical scoped spellings) is never installed or removed through the market. */
export const PROTECTED_PACKAGES=Object.freeze(['@hanamesh/dsh-app-host','hanamesh-core','hanamesh-usage','@hanamesh/dsh-core','@hanamesh/dsh-usage']);
const blocked=new Set(PROTECTED_PACKAGES);
const packageName=value=>typeof value==='string'&&/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value);
const versionText=value=>typeof value==='string'&&/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);
async function json(path){return JSON.parse(await readFile(path,'utf8'));}
function defaultSpawn(command,args,options){return new Promise((resolvePromise,reject)=>{const child=nodeSpawn(command,args,{...options,env:{HOME:process.env.HOME,DSH_HOME:process.env.DSH_HOME,LANG:process.env.LANG??'C.UTF-8',PATH:`${command.slice(0,command.lastIndexOf('/'))}:/usr/bin:/bin`},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);child.on('exit',(code,signal)=>resolvePromise({code,signal,stdout,stderr}));});}

async function defaults(){return await import('../provision/index.js');}

export function createLibraryInstaller({profileDir,profileName,dataRoot,nodeBinary,dshBin,registry='https://registry.npmjs.org',allowPrerelease=false,
  fetchImpl=globalThis.fetch,spawn=defaultSpawn,provision,remove,emit=()=>{}}){
  requireCondition(typeof profileDir==='string'&&resolve(profileDir)===profileDir,'PROFILE_DIR_REQUIRED','library.profileDir must be an absolute path.');
  requireCondition(typeof dataRoot==='string'&&resolve(dataRoot)===dataRoot,'INVALID_ROOT','dataRoot must be absolute.');
  requireCondition(typeof nodeBinary==='string'&&resolve(nodeBinary)===nodeBinary,'NODE_RUNTIME_REQUIRED','An absolute nodeBinary is required for library operations.');
  requireCondition(typeof dshBin==='string'&&resolve(dshBin)===dshBin,'DSH_BIN_REQUIRED','An absolute DSH bin.js path is required.');
  requireCondition(typeof profileName==='string'&&/^[A-Za-z0-9_.-]+$/.test(profileName),'PROFILE_NAME_REQUIRED','library.profileName is required.');
  const runtimeRoot=appId=>join(dataRoot,'runtimes',appId);
  const permitted=name=>requireCondition(packageName(name)&&!blocked.has(name),'PACKAGE_DENIED','Package name is not permitted.',{packageName:name});
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
  /** Same path for applications and plugins: `dsh plugin add --save-exact <name>@<version>` (also the upgrade path: a newer exact version replaces the installed one). */
  async function add(name){const version=await latest(name);await run(['add','--save-exact',`${name}@${version}`]);return version;}
  return{
    async install(item){
      const kind=itemKind(item);
      requireCondition(kind!=='listing','NOT_INSTALLABLE','Catalog item has no npm package to install.');const name=item.package.name;
      permitted(name);
      emit({type:'library.install-started',itemId:item.id,packageName:name,kind});
      try{
        const version=await add(name);
        if(kind==='plugin'){const result={status:'restart-required',kind,packageName:name,version};emit({type:'library.install-done',...result});return result;}
        const record=await installed(name);const runtime=record.definition.deployments.map(deployment=>deployment.runtime).find(Boolean);
        if(runtime){const api=provision?{provision}:{...(await defaults())};await api.provision(runtime.manifest,{root:runtimeRoot(record.definition.id),only:[runtime.item],onProgress:event=>emit({type:'library.provision-progress',appId:record.definition.id,...event})});}
        const result={status:'restart-required',kind,appId:record.definition.id,packageName:name,version};emit({type:'library.install-done',...result});return result;
      }catch(error){emit({type:'library.install-failed',itemId:item.id,packageName:name,kind,code:error.code??'INSTALL_FAILED'});throw error;}
    },
    /** rc.28: install a plugin by package name (already verified against the catalog by the service). */
    async installPlugin({packageName:name}){
      permitted(name);
      emit({type:'library.install-started',packageName:name,kind:'plugin'});
      try{const version=await add(name);const result={status:'restart-required',kind:'plugin',packageName:name,version};emit({type:'library.install-done',...result});return result;}
      catch(error){emit({type:'library.install-failed',packageName:name,kind:'plugin',code:error.code??'INSTALL_FAILED'});throw error;}
    },
    async provisionRuntime({appId,packageName:installedName,runtimeItem}){const record=await installed(installedName);requireCondition(record.definition.id===appId,'APP_ID_MISMATCH','Installed package app id does not match.');const runtime=record.definition.deployments.map(deployment=>deployment.runtime).find(value=>value?.item===runtimeItem);requireCondition(runtime,'RUNTIME_NOT_DECLARED','Runtime item is not declared.');const api=provision?{provision}:{...(await defaults())};const result=await api.provision(runtime.manifest,{root:runtimeRoot(appId),only:[runtime.item],onProgress:event=>emit({type:'library.provision-progress',appId,...event})});return{status:'restart-required',appId,packageName:installedName,result};},
    async uninstall({packageName:installedName,appId,runtimeItem,running}){permitted(installedName);requireCondition(!running,'INSTANCE_IN_USE','Stop all application instances before uninstalling.',{},409);await run(['remove',installedName]);if(runtimeItem){const api=remove?{remove}:{...(await defaults())};await api.remove(runtimeItem,{root:runtimeRoot(appId)});}return{status:'restart-required',kind:'application',appId,packageName:installedName,dataPreserved:true};},
    /** rc.28: `dsh plugin remove <name>`; the suite itself (PROTECTED_PACKAGES) is refused with PACKAGE_DENIED. */
    async uninstallPlugin({packageName:installedName}){permitted(installedName);await run(['remove',installedName]);return{status:'restart-required',kind:'plugin',packageName:installedName};},
  };
}
