import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
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
/**
 * Internal App-host execution port, not a guessed Core getter or wire DTO. A future adapter must
 * consume G's documented public declaration and return this existing execution-plan shape.
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
  return{available:plan.available,components:SUITE_PACKAGES.map(({name,label})=>({name,label,from:rows.get(name).from,to:rows.get(name).to}))};
}
