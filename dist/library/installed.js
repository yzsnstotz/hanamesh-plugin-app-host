import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { requireCondition } from '../errors.js';
import { validateDefinition } from '../descriptor.js';

async function json(path){return JSON.parse(await readFile(path,'utf8'));}
async function packageRoots(profileDir){
  const profile=await json(join(profileDir,'package.json'));const names=new Set(Object.keys(profile.dependencies??{}));
  const scope=join(profileDir,'node_modules','@hanamesh');
  for(const name of await readdir(scope).catch(()=>[]))if(name.startsWith('app-'))names.add(`@hanamesh/${name}`);
  return[...names].map(name=>({name,root:join(profileDir,'node_modules',...name.split('/'))}));
}

export async function scanInstalled({profileDir,host,ledgerReader,dataRoot}){
  requireCondition(typeof profileDir==='string'&&resolve(profileDir)===profileDir,'PROFILE_DIR_REQUIRED','library.profileDir must be an absolute path.');
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
