import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import semver from 'semver';
import {randomUUID} from 'node:crypto';
import {requireCondition} from '../errors.js';

export const SUITE_TARGET='hanamesh:suite-upgrade';
export const SUITE_PACKAGES=Object.freeze([
  {name:'hanamesh-core',label:'Core',repo:'hanamesh-core'},
  {name:'hanamesh-usage',label:'使用记录',repo:'hanamesh-usage'},
  {name:'@hanamesh/dsh-app-host',label:'应用库',repo:'hanamesh-plugin-app-host'},
].map(Object.freeze));
export const SUITE_INSTALL_COMMAND="env -u GIT_CONFIG_PARAMETERS -u GIT_ASKPASS -u SSH_ASKPASS GIT_CONFIG_NOSYSTEM=1 GIT_TERMINAL_PROMPT=0 GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=credential.helper GIT_CONFIG_VALUE_0= GIT_CONFIG_KEY_1=credential.helper GIT_CONFIG_VALUE_1='!gh auth git-credential' dsh plugin --profile desktop add --save-exact 'github:yzsnstotz/hanamesh-core#main' 'github:yzsnstotz/hanamesh-usage#main' 'github:yzsnstotz/hanamesh-plugin-app-host#main'";
const json=async path=>JSON.parse(await readFile(path,'utf8'));
/** Physical inventory only, never a compatibility declaration or permission to upgrade. */
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
export const CORE_SUITE_DECLARATION_MISSING='Core 未提供套件声明';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'&&value.length>0;
const exact=value=>typeof value==='string'&&semver.valid(value)===value;
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const nullableText=value=>value===null||text(value);
const invalid=()=>requireCondition(false,'CORE_SUITE_DECLARATION_INVALID','Core 套件声明无法用于精确安装。',{},503);
function validateDeclaration(value){
  if(!object(value)||value.schemaVersion!==1||!text(value.checkedAt)||!digest(value.declarationId)||!text(value.nodeVersion)||!nullableText(value.registry)||!['complete','incomplete','unknown'].includes(value.completeness))invalid();
  const manifest=value.manifest;
  if(!object(manifest)||manifest.schemaVersion!==1||!text(manifest.id)||!object(manifest.core)||manifest.core.name!==SUITE_PACKAGES[0].name||!exact(manifest.core.version)||!text(manifest.core.repository)||!Array.isArray(manifest.components)||manifest.components.length!==2)invalid();
  const members=new Map();
  for(const row of manifest.components){if(!object(row)||!text(row.id)||!SUITE_PACKAGES.slice(1).some(p=>p.name===row.moduleName)||members.has(row.moduleName)||!text(row.versionRange)||!text(row.repository))invalid();members.set(row.moduleName,row.id);}
  if(!Array.isArray(value.installed)||value.installed.length!==3||!Array.isArray(value.upgrades)||!Array.isArray(value.blocked)||!object(value.peerFacts)||!object(value.metadataDigests))invalid();
  const installed=new Map();
  for(const row of value.installed){
    if(!object(row)||!text(row.id)||!SUITE_PACKAGES.some(p=>p.name===row.moduleName)||installed.has(row.moduleName)||!text(row.requiredRange)||!text(row.repository)||!(row.actualVersion===null||exact(row.actualVersion))||!nullableText(row.actualRepository)||!text(row.status)||(row.runningVersion!==undefined&&!exact(row.runningVersion)))invalid();
    installed.set(row.moduleName,row);
  }
  for(const row of value.blocked)if(!object(row)||!text(row.code)||(row.coreVersion!==undefined&&!text(row.coreVersion))||(row.moduleName!==undefined&&!text(row.moduleName)))invalid();
  if(!Object.values(value.peerFacts).every(nullableText)||!Object.values(value.metadataDigests).every(text))invalid();
  for(const upgrade of value.upgrades){
    if(!object(upgrade)||!exact(upgrade.coreVersion)||!text(upgrade.registry)||!digest(upgrade.manifestDigest)||!Array.isArray(upgrade.targets)||upgrade.targets.length!==3)invalid();
    const targets=new Set();
    for(const row of upgrade.targets){if(!object(row)||!text(row.id)||!SUITE_PACKAGES.some(p=>p.name===row.moduleName)||targets.has(row.moduleName)||!exact(row.version)||!text(row.repository)||!digest(row.metadataDigest))invalid();targets.add(row.moduleName);}
    if(upgrade.targets.find(row=>row.moduleName===SUITE_PACKAGES[0].name).version!==upgrade.coreVersion)invalid();
  }
  return structuredClone(value);
}
/** Read only the optional protocol-1 public state; absence is unobservable, never starting/ready. */
export function readSuiteSourceState(source){

  requireCondition(source!==undefined&&source!==null,'CORE_SUITE_SOURCE_MISSING','Core 本机套件来源尚不可观察；请检查 Core 插件及其来源设置。',{},503);
  requireCondition(object(source)&&source.protocolVersion==='1'&&typeof source.getState==='function','CORE_SUITE_SOURCE_INVALID','Core 本机套件来源协议或读取接口无效。',{},503);
  let state;try{state=source.getState();}catch{requireCondition(false,'CORE_SUITE_SOURCE_INVALID','Core 本机套件来源读取失败。',{},503);}
  requireCondition(object(state)&&state.protocolVersion==='1'&&['disabled','ready','failed','disposed'].includes(state.status)&&['configured','custom','disabled'].includes(state.selection)&&(state.registry===null||text(state.registry))&&Number.isSafeInteger(state.archiveCount)&&state.archiveCount>=0&&(state.lastError===null||typeof state.lastError==='string'),'CORE_SUITE_SOURCE_INVALID','Core 本机套件来源状态无效。',{},503);
  return{protocolVersion:state.protocolVersion,status:state.status,selection:state.selection,registry:state.registry,archiveCount:state.archiveCount,lastError:state.lastError};
}
/** Consume only the optional protocol-1 Cordis method and the public C-CORE section D DTO. */
export function createCoreSuiteAdapter({core=()=>undefined,registry,suiteSourceMode=()=>'configured',suiteSourceService=()=>undefined}={}){
  const current=()=>{const value=core();return value?.protocolVersion==='1'&&typeof value.getSuiteDeclaration==='function'?value:undefined;};
  // AppHost-local service identity only: Core protocol 1 supplies no revision/generation.
  const instances=new WeakMap();
  function sourceBinding(){
    const mode=suiteSourceMode();
    requireCondition(['configured','core'].includes(mode),'INVALID_SUITE_SOURCE_SETTINGS','套件安装包来源选择无效。');
    if(mode==='configured')return{mode,registry};
    const source=suiteSourceService();
    const state=readSuiteSourceState(source);
    requireCondition(state.status==='ready'&&state.selection!=='disabled'&&text(state.registry),'CORE_SUITE_SOURCE_NOT_READY','Core 本机套件来源未就绪（'+state.status+'）。',{status:state.status,selection:state.selection,lastError:state.lastError},409);
    let url;try{url=new URL(state.registry);}catch{}
    requireCondition(url&&['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!url.search&&!url.hash,'CORE_SUITE_SOURCE_INVALID','Core 本机套件来源 registry 无效。',{},503);
    if(!instances.has(source))instances.set(source,randomUUID());
    return{mode,registry:state.registry,selection:state.selection,serviceInstance:instances.get(source)};
  }
  async function read(request){
    const service=current();
    requireCondition(service,'CORE_SUITE_DECLARATION_MISSING',CORE_SUITE_DECLARATION_MISSING,{},503);
    const result=request===undefined?await service.getSuiteDeclaration():await service.getSuiteDeclaration(request);
    requireCondition(current()===service,'CORE_SUITE_DECLARATION_MISSING',CORE_SUITE_DECLARATION_MISSING,{},503);
    return validateDeclaration(result);
  }
  const get=async()=>{
    const binding=sourceBinding();
    const declaration=await read({registry:binding.registry});
    requireCondition(JSON.stringify(sourceBinding())===JSON.stringify(binding),'SUITE_PLAN_CHANGED','套件安装包来源已变化，请重新查看并确认。',{},409);
    requireCondition(declaration.completeness==='complete','CORE_SUITE_CURRENT_INCOMPLETE','Core 套件完整性：'+declaration.completeness,{completeness:declaration.completeness,blocked:declaration.blocked},409);
    let expected;try{const url=new URL(binding.registry);url.pathname=url.pathname.replace(/\/$/,'')+'/';expected=url.href;}catch{}
    requireCondition(expected&&declaration.registry===expected,'CORE_SUITE_SOURCE_MISMATCH','Core 声明来源与执行 registry 不符。',{blocked:declaration.blocked},409);
    requireCondition(declaration.upgrades.length>0,'CORE_SUITE_NO_COMPATIBLE_TUPLE','Core 未提供可执行升级组合。',{blocked:declaration.blocked},409);
    // The first displayed Core tuple is the presentation default; App-host never ranks versions.
    const selectedUpgrade=declaration.upgrades[0];
    requireCondition(selectedUpgrade.registry===declaration.registry,'CORE_SUITE_SOURCE_MISMATCH','Core 升级组合来源与执行 registry 不符。',{},409);
    const components=SUITE_PACKAGES.map(({name,label})=>{const from=declaration.installed.find(row=>row.moduleName===name).actualVersion;if(!exact(from))invalid();return{name,label,from,to:selectedUpgrade.targets.find(row=>row.moduleName===name).version};});
    return{available:true,components,sourceBinding:binding,declarationId:declaration.declarationId,registry:declaration.registry,selectedUpgrade,physicalBaseline:declaration.installed,upgrades:declaration.upgrades,blocked:declaration.blocked};
  };
  Object.defineProperty(get,'unavailable',{get:()=>current()?null:CORE_SUITE_DECLARATION_MISSING});
  get.readFacts=async()=>{
    const declaration=await read();
    return{status:declaration.completeness==='complete'?'installed':declaration.completeness,completeness:declaration.completeness,version:declaration.installed.find(row=>row.moduleName==='hanamesh-core').actualVersion,
      components:declaration.installed.map(row=>({...row,name:row.moduleName,label:SUITE_PACKAGES.find(p=>p.name===row.moduleName).label,version:row.actualVersion})),blocked:declaration.blocked};
  };
  return get;
}
/**
 * Internal App-host execution port. The public adapter above supplies this plan in production;
 * injected normalized stand-ins remain useful for testing CLI/confirmation behavior in isolation.
 * Core owns candidate selection, completeness, ranges and compatibility; this module only checks
 * that an exact execution plan is well formed and confined to our three protected packages.
 */
export async function prepareSuiteUpgrade({coreSuitePlan}={}){
  requireCondition(typeof coreSuitePlan==='function','CORE_SUITE_DECLARATION_MISSING',CORE_SUITE_DECLARATION_MISSING,{},503);
  const plan=await coreSuitePlan();
  requireCondition(plan!==undefined&&plan!==null,'CORE_SUITE_DECLARATION_MISSING',CORE_SUITE_DECLARATION_MISSING,{},503);
  const invalid=()=>requireCondition(false,'CORE_SUITE_DECLARATION_INVALID','Core 套件声明无法用于精确安装。',{},503);
  if(typeof plan!=='object'||Array.isArray(plan)||typeof plan.available!=='boolean'||!Array.isArray(plan.components)||plan.components.length!==SUITE_PACKAGES.length)invalid();
  const rows=new Map();
  for(const row of plan.components){
    if(!row||typeof row!=='object'||!SUITE_PACKAGES.some(p=>p.name===row.name)||rows.has(row.name)||typeof row.from!=='string'||semver.valid(row.from)!==row.from||typeof row.to!=='string'||semver.valid(row.to)!==row.to)invalid();
    rows.set(row.name,row);
  }
  return{...structuredClone(plan),available:plan.available,components:SUITE_PACKAGES.map(({name,label})=>({name,label,from:rows.get(name).from,to:rows.get(name).to}))};
}
