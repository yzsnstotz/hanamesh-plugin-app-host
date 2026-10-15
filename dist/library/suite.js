import {readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {createRequire} from 'node:module';
import semver from 'semver';
import {requireCondition} from '../errors.js';

export const SUITE_TARGET='hanamesh:suite-upgrade';
export const SUITE_PACKAGES=Object.freeze([
  {name:'hanamesh-core',label:'Core',repo:'hanamesh-core'},
  {name:'hanamesh-usage',label:'使用记录',repo:'hanamesh-usage'},
  {name:'@hanamesh/dsh-app-host',label:'应用库',repo:'hanamesh-plugin-app-host'},
].map(Object.freeze));
export const SUITE_INSTALL_COMMAND="env -u GIT_CONFIG_PARAMETERS -u GIT_ASKPASS -u SSH_ASKPASS GIT_CONFIG_NOSYSTEM=1 GIT_TERMINAL_PROMPT=0 GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=credential.helper GIT_CONFIG_VALUE_0= GIT_CONFIG_KEY_1=credential.helper GIT_CONFIG_VALUE_1='!gh auth git-credential' dsh plugin --profile desktop add --save-exact 'github:yzsnstotz/hanamesh-core#main' 'github:yzsnstotz/hanamesh-usage#main' 'github:yzsnstotz/hanamesh-plugin-app-host#main'";
const json=async path=>JSON.parse(await readFile(path,'utf8'));
/** Profile bytes, never guessed from a port or the presence of this listener. */
export async function readSuiteStatus(profileDir){
  if(!profileDir)return{status:'unknown',version:null,components:[]};
  try{
    const profile=await json(join(profileDir,'package.json'));
    if(!profile.dependencies||!Array.isArray(profile.dsh?.profile?.bundles))throw new Error('unreadable profile');
    const components=await Promise.all(SUITE_PACKAGES.map(async({name,label})=>{
      let pkg;try{pkg=await json(join(profileDir,'node_modules',name,'package.json'));}catch{}
      return{name,label,version:pkg?.name===name&&semver.valid(pkg.version)?pkg.version:null,active:profile.dsh.profile.bundles.includes(name)};
    }));
    return{status:components.every(c=>c.version&&c.active)?'installed':'incomplete',version:components[0].version,components};
  }catch{return{status:'unknown',version:null,components:[]};}
}
/** Resolve the host's actually loaded peer metadata; do not use client-supplied runtime versions. */
export async function installedRuntimeVersion(name){
  try{
    let path=dirname(createRequire(import.meta.url).resolve(name));
    for(;;){try{const pkg=await json(join(path,'package.json'));if(pkg.name===name)return semver.valid(pkg.version)?pkg.version:null;}catch{}
      const parent=dirname(path);if(parent===path)return null;path=parent;}
  }catch{return null;}
}
export async function prepareSuiteUpgrade({profileDir,registry,fetchImpl=globalThis.fetch,runtimeVersion=installedRuntimeVersion}){
  const current=await readSuiteStatus(profileDir);
  requireCondition(current.status==='installed','SUITE_INCOMPLETE','套件不完整，请先用补齐命令装齐并启用三个组件。',{command:SUITE_INSTALL_COMMAND},409);
  const base=new URL(registry);
  requireCondition(!base.username&&!base.password&&(base.protocol==='https:'||base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname)),'SUITE_SOURCE_INVALID','套件升级需要可信 HTTPS registry。');
  const components=[];
  for(const [index,{name,label,repo}] of SUITE_PACKAGES.entries()){
    const response=await fetchImpl(`${base.href.replace(/\/$/,'')}/${encodeURIComponent(name)}/latest`,{headers:{accept:'application/json'},redirect:'error'});
    requireCondition(response.ok,'REGISTRY_LOOKUP_FAILED','读取套件新版失败。',{},502);
    const metadata=await response.json(),to=metadata.version,from=current.components[index].version;
    const repository=typeof metadata.repository==='string'?metadata.repository:metadata.repository?.url;
    requireCondition(metadata.name===name&&repository?.replace(/^git\+/,'').replace(/\.git$/,'')===`https://github.com/yzsnstotz/${repo}`,'SUITE_SOURCE_INVALID','套件升级来源与固定官方包不一致。',{packageName:name},409);
    requireCondition(metadata.dsh?.bundle?.patch,'SUITE_INCOMPATIBLE','候选没有官方 DSH bundle 声明。',{packageName:name},409);
    if(metadata.engines?.node)requireCondition(semver.validRange(metadata.engines.node)&&semver.satisfies(process.version,metadata.engines.node),'SUITE_INCOMPATIBLE','套件候选不支持当前 Node 版本。',{packageName:name},409);
    requireCondition(semver.valid(to),'SUITE_VERSION_INVALID','套件候选版本无效。',{packageName:name});
    requireCondition(semver.gte(to,from),'SUITE_DOWNGRADE_REFUSED','Registry 候选旧于已安装版本；保持现有套件。',{packageName:name,installed:from,candidate:to},409);
    requireCondition(metadata.peerDependencies&&typeof metadata.peerDependencies==='object','SUITE_INCOMPATIBLE','无法核实套件候选的宿主兼容要求。',{packageName:name},409);
    for(const [peer,range] of Object.entries(metadata.peerDependencies)){
      if(metadata.peerDependenciesMeta?.[peer]?.optional===true)continue;
      const actual=await runtimeVersion(peer);
      requireCondition(actual,'SUITE_RUNTIME_UNKNOWN','无法核实当前宿主依赖版本。',{peer},409);
      requireCondition(typeof range==='string'&&semver.validRange(range)&&semver.satisfies(actual,range),'SUITE_INCOMPATIBLE','套件候选与当前宿主不兼容。',{packageName:name,peer,actual,required:range},409);
    }
    components.push({name,label,from,to});
  }
  // Current Core suite contract ranges are checked against the complete proposed combination, not individually.
  const usage=components[1].to,appHost=components[2].to;
  requireCondition(semver.satisfies(usage,'>=0.2.0-rc.26 <0.3.0')&&semver.satisfies(appHost,'>=0.5.9 <0.7.0'),'SUITE_INCOMPATIBLE','候选组件组合不满足当前套件要求。',{},409);
  return{components,available:components.some(c=>c.from!==c.to)};
}
