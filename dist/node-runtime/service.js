/** Plugin-owned standalone runtime. Nothing downloads during activation, planning or settings saves. */
import {readFile,statfs,lstat,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {release} from 'node:os';
import {join,dirname,isAbsolute,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import * as provisionApi from '@hanamesh/lib-provision';
import {AppHostError,requireCondition,copy} from '../errors.js';
import {secureDirectory,FileLock} from '../store.js';
const run=promisify(execFile);
const catalog=JSON.parse(await readFile(new URL('./releases.json',import.meta.url),'utf8'));
export const NODE_SETTING_NAMES=Object.freeze({mode:'安装环境管理方式',version:'独立 Node 固定版本',sourceBase:'Node 下载来源',storageRoot:'独立 Node 存放位置',externalBinary:'已有独立 Node 路径（高级）'});
const fields=Object.keys(NODE_SETTING_NAMES);
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
const exact=(input,keys)=>requireCondition(plain(input)&&Object.keys(input).every(k=>keys.includes(k)),'NODE_INPUT_INVALID','安装环境的请求包含不支持的字段。');
const checkScript="console.log(JSON.stringify({version:process.versions.node,platform:process.platform,arch:process.arch,electron:process.versions.electron??null}))";
export async function probeStandaloneNode(binary,{platform,version,signal}={}){
 requireCondition(typeof binary==='string'&&isAbsolute(binary),'NODE_BINARY_INVALID','独立 Node 路径必须是绝对路径。');
 await access(binary,constants.X_OK);
 const {stdout}=await run(binary,['-e',checkScript],{env:{PATH:''},maxBuffer:4096,signal});
 let actual;try{actual=JSON.parse(stdout);}catch{throw new AppHostError('NODE_NOT_STANDALONE','所选文件没有返回独立 Node 的检查结果；Electron 包装脚本不能代替独立 Node。');}
 requireCondition(actual.electron===null&&/^24\./.test(actual.version)&&(Number(actual.version.split('.')[1])>13||Number(actual.version.split('.')[1])===13&&Number(actual.version.split('.')[2])>=1)&&(!version||actual.version===version)&&`${actual.platform}-${actual.arch}`===platform,'NODE_NOT_STANDALONE','需要当前平台的独立 Node.js 24（24.13.1 或更新）；所选文件的版本、平台或 Electron 检查未通过。');
 return actual;
}
async function safeAncestors(path){
 let p=path;
 while(true){try{const info=await lstat(p);requireCondition(info.isDirectory()&&!info.isSymbolicLink(),'NODE_STORAGE_UNSAFE','存放位置不能经过符号链接或普通文件。');}catch(e){if(e.code!=='ENOENT')throw e;}
  const parent=dirname(p);if(p===parent)break;p=parent;}
}
async function diskBytes(path){let p=path;while(true){try{const info=await statfs(p,{bigint:true});return Number(info.bavail*info.bsize);}catch(e){if(e.code!=='ENOENT'||p===dirname(p))throw e;p=dirname(p);}}}
const causeText=e=>String(e?.message??e).slice(0,1500);
/** Ports are public lib-provision and storage-domain; test substitutes never enter the normal plugin package. */
export function createNodeRuntime({domain,dataRoot,config={},initialBinary,platform=`${process.platform}-${process.arch}`,kernelRelease=release(),provisionApi:api=provisionApi,probe=probeStandaloneNode,freeBytes=diskBytes,busy=()=>false,checkpoint=async()=>{},lockFactory=path=>new FileLock(path,{reclaimDead:true})}){
 const defaultSettings={mode:initialBinary?'external':'managed',version:catalog.defaultVersion,sourceBase:'https://nodejs.org/dist',storageRoot:join(dataRoot,'managed-node'),externalBinary:initialBinary??''};
 let state,settings,executable,operation=null,plan=null,closed=false,saving=false,pending=Promise.resolve(),controller;
 const supported=['darwin-arm64','darwin-x64'].includes(platform)&&Number(kernelRelease.split('.')[0])>=22&&(Number(kernelRelease.split('.')[0])>22||Number(kernelRelease.split('.')[1])>=6);
 const available=()=>{requireCondition(!closed,'NODE_CLOSED','安装环境页面已关闭。');};
 const idle=()=>{available();requireCondition(!saving&&!controller&&!['preparing','committing'].includes(operation?.state)&&!busy(),'NODE_IN_USE','安装环境正在准备或有插件操作运行，请完成或取消后再修改。');};
 function validate(next){
  exact(next,fields);requireCondition(fields.every(k=>typeof next[k]==='string')&&['managed','external'].includes(next.mode),'NODE_SETTINGS_INVALID','请填写完整的安装环境设置。');
  requireCondition(catalog.archives.some(a=>a.version===next.version),'NODE_VERSION_UNSUPPORTED','请选择已校验的固定 Node 版本，不能填写 latest。');
  let source;try{source=new URL(next.sourceBase);}catch{}
  requireCondition(source?.protocol==='https:'&&!source.username&&!source.password&&!source.search&&!source.hash,'NODE_SOURCE_INVALID','下载来源必须是没有账号、密码、查询参数的 HTTPS 地址。');
  requireCondition(isAbsolute(next.storageRoot)&&resolve(next.storageRoot)===next.storageRoot&&next.storageRoot!=='/'&&!next.storageRoot.includes('\0'),'NODE_STORAGE_INVALID','请选择绝对的专用存放目录。');
  requireCondition(next.mode!=='external'||isAbsolute(next.externalBinary),'NODE_BINARY_INVALID','已有独立 Node 路径必须是绝对路径。');
  return {...next,sourceBase:source.href.replace(/\/$/,'')};
 }
 const externalCheck=()=>requireCondition(['darwin-arm64','darwin-x64','linux-arm64','linux-x64'].includes(platform),'NODE_PLATFORM_UNSUPPORTED','当前平台尚未完成独立 Node 的进程守护支持；Windows 不支持本安装流程。');
 const supportedCheck=()=>requireCondition(supported,'NODE_PLATFORM_UNSUPPORTED','一键准备当前仅支持 macOS 13.5 及以上的 arm64 / x64；Windows 安装与进程守护尚未接通。');
 async function publish(next){const whole={...next,revision:state.revision+1};await domain.global.set(whole);state=whole;}
 function manifest(p){return {schema:1,sources:[{id:'confirmed-source',kind:'https',base:new URL(`v${p.version}/`,p.sourceBase+'/').href}],items:[{id:'node',version:p.version,kind:'tar.gz',installTo:'runtime',platforms:{[platform]:{asset:p.asset,sha256:p.sha256,size:p.bytes,strip:1}},verify:{exec:'bin/node',args:['-e',checkScript],expect:JSON.stringify({version:p.version,platform:'darwin',arch:platform.slice(7),electron:null})}}]};}
 async function verifyActive(active,signal,heldLock){
  requireCondition(active&&active.platform===platform&&catalog.archives.some(a=>a.version===active.version&&a.platform===platform&&a.sha256===active.sha256),'NODE_LEDGER_MISMATCH','运行时记录与已校验的官方发行记录不一致。');
  await safeAncestors(active.root);const lock=heldLock??lockFactory(join(active.root,'.apphost-node.lock'));if(!heldLock)await lock.acquire();
  try{const verification=await api.verify({root:active.root}),ledger=await api.ledger(active.root),entry=ledger.items.node;
   requireCondition(verification.ok&&verification.items.some(i=>i.item==='node'&&['ok','repaired'].includes(i.state))&&entry?.sha256===active.sha256&&entry.version===active.version&&entry.platform===platform&&entry.installTo==='runtime','NODE_LEDGER_MISMATCH','独立 Node 文件、SHA 或管理账本不一致，未启用。');
   const binary=join(active.root,'runtime/bin/node');await probe(binary,{platform,version:active.version,signal});return binary;
  }finally{if(!heldLock)await lock.release();}
 }
 const service={
  get executable(){return executable;},
  async init(){state=await domain.global.get();settings=validate({...defaultSettings,...Object.fromEntries(Object.entries(config).filter(([,v])=>v!==undefined)),...(state.settings??{})});
   try{if(settings.mode==='external'){externalCheck();await probe(settings.externalBinary,{platform});executable=settings.externalBinary;}
    else if(state.active){supportedCheck();executable=await verifyActive(state.active);}
   }catch(e){operation={id:null,state:'failed',phase:'restore',error:{message:'安装环境尚未就绪：'+causeText(e),code:e.code??'NODE_CHECK_FAILED'}};}
  },
  status(){return copy({settings,names:NODE_SETTING_NAMES,versions:[...new Set(catalog.archives.map(a=>a.version))],platform,supported,ready:!!executable,executable:executable??null,active:state?.active??null,operation,limitations:'一键准备支持 macOS 13.5+ arm64 / x64；Windows 尚不支持。下载仅在确认后开始；不重试、不切换来源。'});},
  async save(input){exact(input,['settings']);idle();const next=validate(input.settings);saving=true;plan=null;
   try{await safeAncestors(next.storageRoot);let external;
    if(next.mode==='external'){externalCheck();await probe(next.externalBinary,{platform});external=next.externalBinary;}
    await publish({...state,settings:next,active:next.mode==='external'?null:state.active});settings=next;if(next.mode==='external')executable=external;else if(state.active===null)executable=undefined;
    operation=null;return service.status();
   }finally{saving=false;}
  },
  async plan(input){exact(input,[]);idle();supportedCheck();requireCondition(settings.mode==='managed','NODE_MANAGED_REQUIRED','请先选择并保存「插件管理」方式。');
   const revision=state.revision,snapshot=copy(settings),asset=catalog.archives.find(a=>a.version===snapshot.version&&a.platform===platform);
   await safeAncestors(snapshot.storageRoot);const free=await freeBytes(snapshot.storageRoot),requiredBytes=asset.bytes+2*asset.unpackedBytes;
   requireCondition(free>=requiredBytes,'NODE_DISK_SPACE',`准备环境需要至少 ${requiredBytes} 字节可用空间，当前只有 ${free} 字节。`);idle();requireCondition(revision===state.revision,'NODE_PLAN_STALE','设置已经改变，请重新查看准备信息。');
   plan={...asset,sourceBase:snapshot.sourceBase,source:new URL(`v${snapshot.version}/${asset.asset}`,snapshot.sourceBase+'/').href,root:join(snapshot.storageRoot,'apphost-node',snapshot.version,platform),requiredBytes,freeBytes:free,planId:randomUUID(),revision,license:'Node.js MIT；归档内 LICENSE 保留其第三方声明',minimumOS:'macOS 13.5'};return copy(plan);
  },
  prepare(input){exact(input,['planId','confirm']);idle();supportedCheck();requireCondition(input.confirm===true,'NODE_CONFIRM_REQUIRED','请先核对来源、平台、版本与体积，再确认下载。');
   requireCondition(plan&&input.planId===plan.planId&&plan.revision===state.revision,'NODE_PLAN_STALE','这份确认信息已经失效，请重新查看准备信息。');
   const accepted=plan;plan=null;controller=new AbortController();const signal=controller.signal;operation={id:randomUUID(),state:'preparing',phase:'starting',bytes:0,total:accepted.bytes};
   pending=(async()=>{let lock;try{
    requireCondition(await freeBytes(settings.storageRoot)>=accepted.requiredBytes,'NODE_DISK_SPACE','当前磁盘空间不足，尚未开始下载。');
    await secureDirectory(accepted.root);lock=lockFactory(join(accepted.root,'.apphost-node.lock'));await lock.acquire();signal.throwIfAborted();
    await api.provision(manifest(accepted),{root:accepted.root,platform,force:true,sourceOrder:['confirmed-source'],signal,onProgress:event=>{operation={...operation,phase:event.phase,...(event.bytes!==undefined?{bytes:event.bytes}:{}),...(event.total!==undefined?{total:event.total}:{})};}});
    signal.throwIfAborted();
    const active={root:accepted.root,version:accepted.version,platform,sha256:accepted.sha256},binary=await verifyActive(active,signal,lock);signal.throwIfAborted();
    await checkpoint('node-verified-before-binding');signal.throwIfAborted();operation={...operation,state:'committing',phase:'bind'};await publish({...state,settings,active});await lock.release();lock=null;executable=binary;operation={...operation,state:'ready',phase:'ready'};
   }catch(e){operation={...operation,state:signal.aborted?'cancelled':'failed',error:{code:signal.aborted?'NODE_PREPARATION_CANCELLED':e.code??'NODE_PREPARATION_FAILED',message:signal.aborted?'已取消准备；尚未启用新的安装环境。':`准备安装环境未完成（${operation.phase}）：${causeText(e)}`}};
   }finally{try{if(lock)await lock.release();}catch(e){operation={...operation,state:'failed',error:{code:'NODE_CLEANUP_FAILED',message:(operation.error?.message??'准备安装环境未完成')+'；运行时锁清理失败：'+causeText(e),original:operation.error??null}};}finally{controller=null;}}})() ;return {operation:copy(operation)};
  },
  cancel(input){exact(input,['operationId']);available();requireCondition(operation?.state!=='committing','NODE_COMMIT_IN_PROGRESS','已完成校验，正在保存并启用，不能再取消；请查看最终结果。');requireCondition(controller&&operation.state==='preparing'&&input.operationId===operation.id,'NODE_OPERATION_STALE','这项准备操作已经结束或不是当前操作。');controller.abort();return {operation:copy(operation)};},
  settled:()=>pending,
  async close(){closed=true;controller?.abort();await pending;},
 };
 return service;
}
