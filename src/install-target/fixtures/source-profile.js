/**
 * SOURCE fixture for the install-recovery contract (rc.10): a temporary profile driven by a stand-in for the official
 * `dsh plugin` command, an in-memory registry, and a stand-in for lib-provision with the same ledger/ownership roles.
 * It writes package.json, a deterministic pnpm-lock.yaml, node_modules and runtime trees under its own temp root only.
 * Failures are injected as the original error types (`DSH_PLUGIN_FAILED` exit status, lib-provision `E_*` codes).
 * This is a conformance fixture: it is not the official CLI, not pnpm, and its results never stand for a real install.
 */
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const exists=async path=>{try{await readFile(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
const readJson=async(path,fallback)=>{try{return JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code==='ENOENT')return fallback;throw error;}};
const writeJson=async(path,value)=>{await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(value,undefined,2)+'\n');};

/** A runtime manifest in the lib-provision shape, for one item and one fixture platform asset. */
export function runtimeManifest(item,version){
  return{schema:1,sources:[{id:'fixture',kind:'file',base:'file:///fixture/'}],items:[{id:item,version,kind:'tar.gz',installTo:item,
    platforms:{'source-fixture':{asset:`${item}-${version}.tar.gz`,sha256:Buffer.from(`${item}@${version}`).toString('hex').padEnd(64,'0').slice(0,64)}}}]};
}

/** Application package versions: `app.json` with an owned deployment and an optional runtime; `invalid` ships a broken definition. */
export function applicationVersion({appId,version,runtime=true,invalid=false}){
  const deployment={id:'local',dataId:'data-v1',mode:'owned',args:['{{dataDir}}','{{port}}'],env:{},envAllowlist:[],readiness:{path:'/',status:200,bodyIncludes:appId},
    ...(runtime?{runtime:{manifest:runtimeManifest('runtime',version),item:'runtime',exec:'bin/app'}}:{})};
  return{version,app:invalid?{id:appId}:{id:appId,name:'Fixture '+appId,deployments:[deployment]}};
}

export async function createSourceProfile({registry,profileName='source-fixture'}){
  const root=await mkdtemp(join(tmpdir(),'hm-install-recovery-'));
  const profileDir=join(root,'profile'),dataRoot=join(root,'data');
  await mkdir(profileDir,{recursive:true});await mkdir(dataRoot,{recursive:true});
  registry={'@fixture/unrelated':[{version:'2.0.0',bundle:true}],'@fixture/concurrent':[{version:'1.0.0'}],...registry};
  await writeJson(join(profileDir,'package.json'),{name:'dsh-profile',private:true,dependencies:{},dsh:{profile:{bundles:[]}}});
  const failures=[];const calls=[];const writers=[];
  const manifestPath=join(profileDir,'package.json'),lockPath=join(profileDir,'pnpm-lock.yaml');
  const moduleDir=name=>join(profileDir,'node_modules',...name.split('/'));
  const resolved=async name=>(await readJson(join(moduleDir(name),'package.json'),{})).version;
  async function writeLock(manifest){
    const lines=["lockfileVersion: '9.0'",'','importers:','  .:','    dependencies:'];
    for(const name of Object.keys(manifest.dependencies??{}).sort())lines.push(`      '${name}':`,`        specifier: ${manifest.dependencies[name]}`,`        version: ${await resolved(name)}`);
    await writeFile(lockPath,lines.join('\n')+'\n');
  }
  async function placeModule(name,version){
    const entry=registry[name]?.find(row=>row.version===version);if(!entry)throw new Error(`fixture registry has no ${name}@${version}`);
    await rm(moduleDir(name),{recursive:true,force:true});
    await writeJson(join(moduleDir(name),'package.json'),{name,version,...(entry.app?{hanamesh:{app:'app.json'}}:{}),...(entry.bundle?{dsh:{bundle:{patch:'./bundle.yml'}}}:{})});
    if(entry.app)await writeJson(join(moduleDir(name),'app.json'),entry.app);
    return entry;
  }
  /** One injected failure per matching call; `skip` lets the first matching calls through (e.g. fail only the compensation). */
  const take=(command,phase)=>{const index=failures.findIndex(row=>row.command===command&&row.phase===phase);if(index<0)return undefined;if(failures[index].skip>0){failures[index].skip--;return undefined;}return failures.splice(index,1)[0];};
  const failed=reason=>({code:1,signal:null,stdout:'',stderr:`dsh: plugin command failed (source fixture: ${reason})`});
  /** Stand-in for `node <bin.js> plugin --profile <name> <pnpm args>`; package files change only through here. */
  async function spawn(command,args){
    const [bin,plugin,flag,name,verb,...rest]=args;
    if(plugin!=='plugin'||flag!=='--profile'||name!==profileName)throw new Error('unexpected command '+JSON.stringify([command,...args]));
    calls.push([verb,...rest]);
    if(take(verb,'before'))return failed(verb+' failed before writing');
    const manifest=await readJson(manifestPath,{});manifest.dependencies??={};const bundles=manifest.dsh?.profile?.bundles??[];
    if(verb==='add'){
      const spec=rest.filter(arg=>!arg.startsWith('--'))[0],at=spec.lastIndexOf('@'),pkg=spec.slice(0,at),version=spec.slice(at+1);
      const entry=await placeModule(pkg,version);const added=!(pkg in manifest.dependencies);manifest.dependencies[pkg]=version;
      if(added&&entry.bundle&&!bundles.includes(pkg))bundles.push(pkg);
    }else if(verb==='remove'){
      const pkg=rest[0];if(!(pkg in manifest.dependencies))return failed(pkg+' is not a dependency');
      delete manifest.dependencies[pkg];await rm(moduleDir(pkg),{recursive:true,force:true});
      const index=bundles.indexOf(pkg);if(index>=0)bundles.splice(index,1);
    }else if(verb==='install'){
      for(const scope of await readdir(join(profileDir,'node_modules')).catch(()=>[]))
        for(const pkg of scope.startsWith('@')?(await readdir(join(profileDir,'node_modules',scope))).map(child=>scope+'/'+child):[scope])
          if(!(pkg in manifest.dependencies))await rm(moduleDir(pkg),{recursive:true,force:true});
    }else throw new Error('unsupported fixture verb '+verb);
    manifest.dsh={...manifest.dsh,profile:{...manifest.dsh?.profile,bundles}};
    await writeJson(manifestPath,manifest);await writeLock(manifest);
    for(const writer of writers.splice(0))await writer();
    if(take(verb,'after'))return failed(verb+' failed after writing');
    return{code:0,signal:null,stdout:'',stderr:''};
  }
  /** Concurrent writer: another `dsh plugin add` lands between this operation's commands. */
  const concurrentAdd=(name,version)=>writers.push(async()=>{const manifest=await readJson(manifestPath,{});await placeModule(name,version);manifest.dependencies[name]=version;await writeJson(manifestPath,manifest);await writeLock(manifest);});
  const ledgerFile=root=>join(root,'.provision','ledger.json');
  const ledger=async root=>await readJson(ledgerFile(root),{schema:1,items:{}});
  const provisionError=(code,item)=>Object.assign(new Error(`source fixture provision ${code}`),{name:'ProvisionError',code,item});
  async function provision(manifest,{root,only}){
    const results=[];
    for(const item of manifest.items.filter(row=>!only||only.includes(row.id))){
      if(take('provision','before'))throw provisionError('E_DOWNLOAD',item.id);
      const asset=Object.values(item.platforms)[0],target=join(root,item.installTo),data=await ledger(root);
      await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});await writeFile(join(target,'VERSION'),item.version);
      await writeJson(target+'.manifest.json',{schema:1,item:item.id,version:item.version,files:[{path:'VERSION'}]});
      data.items[item.id]={version:item.version,sha256:asset.sha256,platform:'source-fixture',installTo:item.installTo,target,installedAt:new Date().toISOString(),source:'fixture'};
      await writeJson(ledgerFile(root),data);
      if(take('provision','unowned'))await writeFile(join(target,'unowned.txt'),'not listed in ownership');
      if(take('provision','after'))throw provisionError('E_VERIFY',item.id);
      results.push({item:item.id,version:item.version,platform:'source-fixture',target,action:'installed'});
    }
    return results;
  }
  async function remove(itemId,{root}){
    if(take('remove','before'))throw provisionError('E_NOT_INSTALLED',itemId);
    const data=await ledger(root),entry=data.items[itemId];if(!entry)throw provisionError('E_NOT_INSTALLED',itemId);
    const owned=await readJson(entry.target+'.manifest.json',{files:[]});
    for(const file of owned.files)await rm(join(entry.target,file.path),{force:true});
    await rm(entry.target+'.manifest.json',{force:true});
    const kept=await readdir(entry.target).catch(()=>[]);if(kept.length===0)await rm(entry.target,{recursive:true,force:true});
    delete data.items[itemId];await writeJson(ledgerFile(root),data);
    return{item:itemId,target:entry.target,kept};
  }
  /** Places an already-installed version through the same stand-in, then provisions its runtime: the upgrade baseline. */
  async function seed(name,version){
    const result=await spawn('node',['bin.js','plugin','--profile',profileName,'add','--save-exact',`${name}@${version}`]);if(result.code!==0)throw new Error('seed failed');
    const entry=registry[name].find(row=>row.version===version),runtime=entry.app?.deployments?.[0]?.runtime;
    if(runtime)await provision(runtime.manifest,{root:join(dataRoot,'runtimes',entry.app.id),only:[runtime.item]});
    calls.length=0;
  }
  await seed('@fixture/unrelated','2.0.0');
  return{root,profileDir,profileName,dataRoot,spawn,provision,remove,ledger,seed,calls,
    fail:(command,phase,skip=0)=>failures.push({command,phase,skip}),concurrentAdd,
    fetchImpl:latest=>async url=>{const name=decodeURIComponent(new URL(url).pathname.split('/').slice(-2,-1)[0]);const version=latest[name];
      return version?new Response(JSON.stringify({version}),{headers:{'content-type':'application/json'}}):new Response('{"error":"not found"}',{status:404,headers:{'content-type':'application/json'}});},
    exists,cleanup:()=>rm(root,{recursive:true,force:true})};
}
