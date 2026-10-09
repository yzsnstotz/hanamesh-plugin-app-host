/**
 * rc.10 install recovery: what one market install changed in the profile and in the application runtime root, and the
 * item-by-item readback that decides whether a compensation really restored the state before the operation.
 * Nothing here writes profile files: package changes go back through the official `dsh plugin` command only.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const DEPENDENCY_FIELDS=['devDependencies','dependencies','optionalDependencies'];
const EXACT=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const digest=bytes=>bytes===null?null:createHash('sha256').update(bytes).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function optional(path){try{return await readFile(path);}catch(error){if(error.code==='ENOENT')return null;throw error;}}

/** The profile facts one package operation can change: its direct spec, bundle selection, lockfile and resolved module. */
export async function profileSnapshot(profileDir,name){
  const manifestBytes=await optional(join(profileDir,'package.json')),lockBytes=await optional(join(profileDir,'pnpm-lock.yaml'));
  const manifest=manifestBytes===null?{}:JSON.parse(manifestBytes.toString('utf8'));
  const direct=Object.assign({},...DEPENDENCY_FIELDS.map(field=>manifest[field]??{}));
  const moduleBytes=await optional(join(profileDir,'node_modules',...name.split('/'),'package.json'));
  return{manifestBytes,lockBytes,spec:direct[name]??null,others:Object.fromEntries(Object.entries(direct).filter(([key])=>key!==name)),
    bundles:manifest.dsh?.profile?.bundles??[],lock:digest(lockBytes),module:moduleBytes===null?null:JSON.parse(moduleBytes.toString('utf8')).version??null};
}

/** Ledger entries of one runtime root, without the install timestamp (a re-provision of the same bytes is the same state). */
export async function runtimeSnapshot(readLedger,root){
  const ledger=await readLedger(root);
  return Object.fromEntries(Object.entries(ledger?.items??{}).map(([id,entry])=>[id,{version:entry.version,sha256:entry.sha256,platform:entry.platform,installTo:entry.installTo}]));
}

/** Names of other direct dependencies that changed while this operation ran: a concurrent profile writer, never ours to undo. */
export const concurrentChanges=(base,now)=>[...new Set([...Object.keys(base.others),...Object.keys(now.others)])].filter(key=>base.others[key]!==now.others[key]).sort();

/** Item-by-item comparison of the profile with its baseline; every row carries expected, actual and ok. */
export function profileChecks(base,now,name){
  const concurrent=concurrentChanges(base,now);
  const rows=[
    {item:'dependency',expected:base.spec,actual:now.spec},
    {item:'module',expected:base.module,actual:now.module},
    {item:'bundle',expected:base.bundles.includes(name),actual:now.bundles.includes(name)},
  ].map(row=>({...row,ok:same(row.expected,row.actual)}));
  if(concurrent.length)rows.push({item:'lockfile',expected:base.lock,actual:now.lock,ok:false,reason:'CONCURRENT_PROFILE_WRITE',concurrent});
  else rows.push({item:'lockfile',expected:base.lock,actual:now.lock,ok:base.lock===now.lock},{item:'bundles',expected:base.bundles,actual:now.bundles,ok:same(base.bundles,now.bundles)});
  return rows;
}

export function runtimeChecks(base,now){
  return [...new Set([...Object.keys(base),...Object.keys(now)])].sort().map(id=>({item:'runtime:'+id,expected:base[id]??null,actual:now[id]??null,ok:same(base[id]??null,now[id]??null)}));
}

/** The official CLI arguments that put one package back to its baseline spec, or none when nothing package-side changed. */
export function packageRestoreArgs(base,now,name){
  if(profileChecks(base,now,name).every(row=>row.ok||row.reason==='CONCURRENT_PROFILE_WRITE'))return null;
  if(base.spec===null)return now.spec===null?['install']:['remove',name];
  return['add',...(EXACT.test(base.spec)?['--save-exact']:[]),`${name}@${base.spec}`];
}

/** Keeps the pre-operation profile files and runtime ledger where the user (or a later operation) can restore them by hand. */
export async function keepOriginals(dir,base,runtimeBase){
  await mkdir(dir,{recursive:true,mode:0o700});const files=[];
  if(base.manifestBytes!==null){await writeFile(join(dir,'package.json'),base.manifestBytes,{mode:0o600});files.push('package.json');}
  if(base.lockBytes!==null){await writeFile(join(dir,'pnpm-lock.yaml'),base.lockBytes,{mode:0o600});files.push('pnpm-lock.yaml');}
  if(runtimeBase){await writeFile(join(dir,'runtime-ledger.json'),JSON.stringify(runtimeBase,undefined,2)+'\n',{mode:0o600});files.push('runtime-ledger.json');}
  return{dir,files,sha256:{...(base.manifestBytes===null?{}:{'package.json':digest(base.manifestBytes)}),...(base.lockBytes===null?{}:{'pnpm-lock.yaml':digest(base.lockBytes)})}};
}
