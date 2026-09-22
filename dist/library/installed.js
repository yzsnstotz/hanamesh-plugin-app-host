import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { requireCondition } from '../errors.js';
import { validateDefinition } from '../descriptor.js';

async function json(path){return JSON.parse(await readFile(path,'utf8'));}
const absolute=profileDir=>requireCondition(typeof profileDir==='string'&&resolve(profileDir)===profileDir,'PROFILE_DIR_REQUIRED','library.profileDir must be an absolute path.');

/** The profile manifest written by `dsh plugin`: `dependencies` = every package the user added; `dsh.profile.bundles` = the active layer stack. */
export async function readProfileManifest(profileDir){
  absolute(profileDir);
  let profile;try{profile=await json(join(profileDir,'package.json'));}catch{profile={};}
  return{dependencies:{...(profile.dependencies??{})},bundles:[...(profile.dsh?.profile?.bundles??[])]};
}
async function packageRoots(profileDir){
  const names=new Set(Object.keys((await readProfileManifest(profileDir)).dependencies));
  const scope=join(profileDir,'node_modules','@hanamesh');
  for(const name of await readdir(scope).catch(()=>[]))if(name.startsWith('app-'))names.add(`@hanamesh/${name}`);
  return[...names].map(name=>({name,root:join(profileDir,'node_modules',...name.split('/'))}));
}

export async function scanInstalled({profileDir,host,ledgerReader,dataRoot}){
  absolute(profileDir);
  const registered=new Set((host.list().apps??[]).map(app=>app.id));const rows=[];
  for(const candidate of await packageRoots(profileDir)){
    let pkg;try{pkg=await json(join(candidate.root,'package.json'));}catch{continue;}
    const declaration=pkg.hanamesh?.app;if(!declaration)continue;
    const appFile=typeof declaration==='string'?declaration:'app.json';
    let definition;try{definition=validateDefinition(await json(join(candidate.root,appFile)));}catch(error){rows.push({packageName:pkg.name??candidate.name,version:pkg.version,state:'invalid',errorCode:error.code??'INVALID_DEFINITION'});continue;}
    const runtime=definition.deployments.map(deployment=>deployment.runtime).find(Boolean);let state=registered.has(definition.id)?'registered':'installed-not-loaded';
    if(runtime){const book=await ledgerReader(join(dataRoot,'runtimes',definition.id));if(!book.items?.[runtime.item])state='runtime-missing';}
    rows.push({packageName:pkg.name??candidate.name,version:pkg.version,appId:definition.id,name:definition.name,state,definition,runtimeItem:runtime?.item});
  }
  return rows.sort((a,b)=>(a.packageName??'').localeCompare(b.packageName??''));
}

/**
 * rc.28 market: every `dependencies` entry of the profile that is NOT a HanaMesh application package is a plugin
 * (or a plain library) installed by `dsh plugin add`. The pinned kernel exposes nothing about what the running
 * process loaded, so "needs a restart" is derived from the dependency set observed when this plugin started
 * (`bootDependencies`): added since boot → `installed-not-loaded`; gone since boot → `uninstalled-not-unloaded`
 * (still running until DSH restarts); otherwise `installed`. No snapshot (undefined) → everything present counts as loaded. `bundle` = the package declares `dsh.bundle`
 * (a profile layer), `active` = it is in `dsh.profile.bundles`.
 */
export async function scanInstalledPlugins({profileDir,bootDependencies}){
  const loaded=name=>bootDependencies===undefined||name in bootDependencies;
  const manifest=await readProfileManifest(profileDir);const rows=[];
  for(const name of Object.keys(manifest.dependencies)){
    let pkg;try{pkg=await json(join(profileDir,'node_modules',...name.split('/'),'package.json'));}catch{pkg=undefined;}
    if(pkg?.hanamesh?.app)continue;
    rows.push({packageName:name,version:pkg?.version??null,kind:'plugin',bundle:Boolean(pkg?.dsh?.bundle?.patch),active:manifest.bundles.includes(name),
      state:pkg===undefined?'invalid':loaded(name)?'installed':'installed-not-loaded',...(pkg===undefined?{errorCode:'PACKAGE_UNREADABLE'}:{})});
  }
  for(const name of Object.keys(bootDependencies??{}))if(!(name in manifest.dependencies)&&!bootDependencies[name]?.application)
    rows.push({packageName:name,version:bootDependencies[name]?.version??null,kind:'plugin',bundle:Boolean(bootDependencies[name]?.bundle),active:false,state:'uninstalled-not-unloaded'});
  return rows.sort((a,b)=>a.packageName.localeCompare(b.packageName));
}

/** Snapshot taken at plugin start: which dependencies existed, and which of them are application packages. */
export async function snapshotProfileDependencies(profileDir){
  const manifest=await readProfileManifest(profileDir);const snapshot={};
  for(const name of Object.keys(manifest.dependencies)){
    let pkg;try{pkg=await json(join(profileDir,'node_modules',...name.split('/'),'package.json'));}catch{pkg=undefined;}
    snapshot[name]={version:pkg?.version??null,application:Boolean(pkg?.hanamesh?.app),bundle:Boolean(pkg?.dsh?.bundle?.patch)};
  }
  return snapshot;
}
