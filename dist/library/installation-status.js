/** Read fresh public installation facts. No compatibility calculation, persistence or polling. */
import semver from 'semver';
import {AppHostError} from '../errors.js';
import {createCoreSuiteAdapter,SUITE_PACKAGES} from './suite.js';
import {SUPPORTED_READER_VERSIONS,validReader,runOfficialInstallationCommand} from './installation-cli.js';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=x=>typeof x==='string'&&semver.valid(x)===x?x:null;
const reason=(code,message,action)=>({code,message,action});
const interrupted=()=>new AppHostError('INSTALLATION_STATUS_CANCELLED','Installation read was cancelled.',{},499);
function abortable(work,signal){
 if(signal.aborted)return Promise.reject(interrupted());
 return new Promise((resolve,reject)=>{const abort=()=>reject(interrupted());signal.addEventListener('abort',abort,{once:true});Promise.resolve(work).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort))});
}
const base=(channel,id,kind,label)=>({channel,scope:{id,kind,label},status:'unknown',version:null,versionKind:['dsh','hanamesh'].includes(channel)?'core':'agent-distribution',components:[],identity:null,reason:null});
const unknown=(row,code,message,action)=>({...row,status:'unknown',version:null,reason:reason(code,message,action)});
const agentBase=channel=>base(channel,'agent-cli','official-user-profile',channel==='claude'?'Claude Code 用户级插件（不覆盖项目或其他隔离资料）':'Codex CLI 本地市场用户资料（不代表桌面 App、项目或其他隔离资料）');
const inventoryError=()=>{throw new AppHostError('AGENT_INVENTORY_INVALID','Official inventory shape is unsupported.',{},503)};
const qualified=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9._-]*@[a-z0-9][a-z0-9._-]*$/.test(x)&&x.length<=257;
function parseInventory(channel,plugins,marketplaces,target){
 let rows,markets;
 if(channel==='claude'){
  if(!Array.isArray(plugins)||!Array.isArray(marketplaces))inventoryError();rows=plugins;markets=marketplaces;
  if(!rows.every(r=>object(r)&&qualified(r.id)&&['user','project','local','managed','session','synced'].includes(r.scope)&&typeof r.enabled==='boolean'&&typeof r.version==='string'&&typeof r.installPath==='string'&&(r.errors===undefined||Array.isArray(r.errors))&&(r.notes===undefined||Array.isArray(r.notes))))inventoryError();
 }else{
  if(!object(plugins)||!Array.isArray(plugins.installed)||!Array.isArray(plugins.available)||!object(marketplaces)||!Array.isArray(marketplaces.marketplaces))inventoryError();rows=plugins.installed;markets=marketplaces.marketplaces;
  if(!rows.every(r=>object(r)&&qualified(r.pluginId)&&r.pluginId===`${r.name}@${r.marketplaceName}`&&typeof r.installed==='boolean'&&typeof r.enabled==='boolean'))inventoryError();
 }
 if(!markets.every(r=>object(r)&&typeof r.name==='string'&&r.name.length>0&&r.name.length<=128))inventoryError();
 const sourceRows=markets.filter(r=>r.name===target.marketplace);
 if(sourceRows.length>1)throw new AppHostError('AGENT_INVENTORY_CONFLICT','Conflicting marketplace identities.',{},503);
 if(sourceRows.length){const m=sourceRows[0],url=channel==='claude'?(['url','git'].includes(m.source)?m.url:null):(['git','url'].includes(m.marketplaceSource?.sourceType)?m.marketplaceSource.source:null);
  if(url!==target.marketplaceUrl)throw new AppHostError('AGENT_MARKETPLACE_SOURCE_MISMATCH','The configured marketplace source is not the registered target.',{},503);
 }
 const id=`${target.pluginName}@${target.marketplace}`;
 const matches=rows.filter(r=>(channel==='claude'?r.id:r.pluginId)===id);
 const scoped=channel==='claude'?matches.filter(r=>r.scope==='user'):matches;
 if(matches.length&&!scoped.length)throw new AppHostError('AGENT_SCOPE_UNOBSERVABLE','The target is outside the configured user scope.',{},503);
 if(scoped.length>1)throw new AppHostError('AGENT_INVENTORY_CONFLICT','Conflicting target installations.',{},503);
 if(!scoped.length)return{status:'not-installed',version:null,components:[],reason:null};
 if(!sourceRows.length)throw new AppHostError('AGENT_MARKETPLACE_SOURCE_UNAVAILABLE','The target marketplace source is not observable.',{},503);
 const installedSource=scoped[0].marketplaceSource;
 if(channel==='codex'){
  if(!installedSource||!['git','url'].includes(installedSource.sourceType)||typeof installedSource.source!=='string')throw new AppHostError('AGENT_MARKETPLACE_SOURCE_UNAVAILABLE','Installed marketplace source is not observable.',{},503);
  if(installedSource.source!==target.marketplaceUrl)throw new AppHostError('AGENT_MARKETPLACE_SOURCE_MISMATCH','Installed marketplace source conflicts with the registered target.',{},503);
 }
 const row=scoped[0],version=exact(channel==='claude'&&row.readFromFolder!==undefined?row.folderVersion:row.version);
 const failed=channel==='claude'?Boolean(row.errors?.length||row.notes?.length):!row.installed;
 return{status:failed?'incomplete':'installed',version,components:[{name:target.pluginName,version,active:row.enabled}],
  reason:failed?reason(channel==='claude'?'AGENT_PLUGIN_LOAD_FAILED':'AGENT_PLUGIN_PAYLOAD_MISSING','官方清单报告插件负载或加载问题。','在该官方客户端的插件详情中检查并修复。'):version===null?reason('AGENT_VERSION_UNAVAILABLE','已确认该作用域的安装记录，但实际版本未知。','在该官方客户端插件详情中核对实际版本。'):null};
}
const failureCodes=new Set(['AGENT_READER_UNAVAILABLE','AGENT_READER_PERMISSION_DENIED','AGENT_READER_PLATFORM_UNSUPPORTED','AGENT_READER_NODE_REQUIRED','AGENT_PROFILE_UNAVAILABLE','AGENT_READER_TIMEOUT','AGENT_READER_OUTPUT_LIMIT','AGENT_READER_CLEANUP_FAILED','AGENT_READER_DIAGNOSTIC','AGENT_READER_FAILED','AGENT_INVENTORY_INVALID','AGENT_INVENTORY_CONFLICT','AGENT_MARKETPLACE_SOURCE_MISMATCH','AGENT_MARKETPLACE_SOURCE_UNAVAILABLE','AGENT_SCOPE_UNOBSERVABLE']);
/** Trusted static configuration only; `core` is the optional public protocol-1 Cordis service accessor. */
export function createInstallationStatusReader({client='dsh',core=()=>undefined,readers={},workerNode,runCommand=runOfficialInstallationCommand}={}){
 if(!['dsh','hanamesh'].includes(client))throw new TypeError('client must be dsh or hanamesh');
 const settings=structuredClone(readers??{}),active=new Set();let closed=false;
 const suite=createCoreSuiteAdapter({core});
 async function runtime(signal){
  const row=base(client,'current-runtime','responding-runtime',client==='dsh'?'当前响应的 DSH runtime':'当前响应的 HanaMesh 客户端 runtime');
  try{const value=await abortable(suite.readFacts(),signal);
   const components=value.components.map(c=>({name:c.name,version:exact(c.version),...(['satisfied','missing','incompatible','damaged','unreadable','inactive','failed','ambiguous'].includes(c.status)?{status:c.status}:{}),...(typeof c.active==='boolean'?{active:c.active}:{})}));
   const blocked=value.blocked.map(r=>({code:/^CORE_[A-Z0-9_]{1,75}$/.test(r.code)?r.code:'CORE_SUITE_BLOCKED',...(SUITE_PACKAGES.some(c=>c.name===r.moduleName)?{moduleName:r.moduleName}:{})}));
   return{...row,status:value.status,version:value.status==='unknown'?null:exact(value.version),components,blocked,
    reason:value.status==='unknown'?reason('CORE_SUITE_DECLARATION_UNKNOWN','Core 尚不能确认本 runtime 的套件完整性。','查看 Core 设置中的具名阻断原因，补齐其公开事实后重新检测。'):value.status==='incomplete'?reason('CORE_SUITE_CURRENT_INCOMPLETE','Core 报告本 runtime 的套件不完整。','在本客户端按 Core 组件说明修复后重新检测。'):null};
  }catch(error){if(signal.aborted)throw interrupted();const code=['CORE_SUITE_DECLARATION_MISSING','CORE_SUITE_DECLARATION_INVALID'].includes(error.code)?error.code:'CORE_SUITE_READ_FAILED';return unknown(row,code,code==='CORE_SUITE_DECLARATION_MISSING'?'本 runtime 未提供 Core 套件声明方法。':'本次 Core 套件声明读取失败。','启用支持 protocol 1 getSuiteDeclaration 的 Core，查看其设置并重新检测。')}
 }
 async function agent(channel,signal){
  const initial=agentBase(channel),config=settings[channel];
  if(config===undefined)return unknown(initial,'AGENT_READER_NOT_CONFIGURED','尚未配置该渠道的官方只读清单读取器。','在 AppHost library.installationReaders 中配置官方命令、用户资料、登记目标与读取预算后重新检测。');
  if(!validReader(config))return unknown(initial,'AGENT_READER_CONFIG_INVALID','官方读取器缺少有效的显式配置。','核对 library.installationReaders 的绝对路径、登记插件名/市场来源和必填读取预算。');
  const row={...initial,identity:{pluginName:config.pluginName,marketplace:config.marketplace}};
  const invoke=args=>abortable(runCommand({channel,reader:config,args,signal,workerNode}),signal);
  try{
   const version=(await invoke(['--version'])).trim();
   if(version!==SUPPORTED_READER_VERSIONS[channel])return unknown(row,'AGENT_READER_VERSION_UNSUPPORTED','该官方 CLI 版本尚未验证此读取协议。','使用提供方正文列明的支持版本，或先核实新版本官方清单协议。');
   const suffix=channel==='codex'?['--disable','remote_plugin']:[];
   const text=await invoke(['plugin','list','--json',...suffix]);
   const sourceText=await invoke(['plugin','marketplace','list','--json',...suffix]);
   let plugins,marketplaces;try{plugins=JSON.parse(text);marketplaces=JSON.parse(sourceText)}catch{inventoryError()}
   return{...row,...parseInventory(channel,plugins,marketplaces,config)};
  }catch(error){if(signal.aborted||error.code==='INSTALLATION_STATUS_CANCELLED')throw interrupted();const code=failureCodes.has(error.code)?error.code:'AGENT_READER_FAILED';return unknown(row,code,'本次官方清单读取未能提供完整且一致的安装事实。','在对应官方 CLI 的已配置用户资料中检查插件与市场清单、权限或诊断，修复后显式重检。')}
 }
 const read=async({signal}={})=>{
  if(closed||signal?.aborted)throw interrupted();const controller=new AbortController();active.add(controller);const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
  try{const current=await runtime(combined);const agents=await Promise.all(['claude','codex'].map(channel=>agent(channel,combined)));if(combined.aborted)throw interrupted();
   return{schemaVersion:1,client,checkedAt:new Date().toISOString(),observations:[current,
    unknown(base(client==='dsh'?'hanamesh':'dsh','other-runtime','unobserved-runtime','另一客户端 runtime（须由其自身监听回答）'),'OTHER_RUNTIME_NOT_OBSERVED','本监听未读取另一客户端的 runtime。','启动该客户端，并向其已广告的状态入口显式检测。'),...agents,
    unknown(base('codex','desktop-app','desktop-app','Codex / ChatGPT 桌面 App（独立作用域）'),'CODEX_DESKTOP_SCOPE_UNOBSERVABLE','Codex CLI 清单不能证明桌面 App 的安装。','在桌面 App 的插件目录核对；需官方公开桌面状态协议后才可接入。')]};
  }finally{active.delete(controller)}
 };
 read.close=()=>{closed=true;for(const controller of active)controller.abort();active.clear()};return read;
}
