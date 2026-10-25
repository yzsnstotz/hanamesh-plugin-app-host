import { randomUUID } from 'node:crypto';
import { AppHostError, requireCondition, SerialQueue } from '../errors.js';
import { loadCatalog, isApplication, itemKind, upgradeAvailable, validateManifestUrl } from './catalog.js';
import { scanInstalled, scanInstalledPlugins, snapshotProfileDependencies } from './installed.js';
import {SUITE_TARGET,SUITE_PACKAGES,readSuiteStatus,SUITE_INSTALL_COMMAND,CORE_SUITE_DECLARATION_MISSING,readSuiteSourceState} from './suite.js';
import { PROTECTED_PACKAGES } from './install.js';
import { handoffSettings } from './handoff.js';
import { INSTALLATION_STATUS_CAPABILITY } from '../installation-status.js';

/** Install-target contract version this market implements (schemas/install-target.schema.json). */
export const INSTALL_TARGET_CONTRACT_VERSION='1';
const PACKAGE_NAME=/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max;
const RESTART_STATES=new Set(['installed-not-loaded','uninstalled-not-unloaded']);
const protectedPackage=name=>PROTECTED_PACKAGES.includes(name);
const present=row=>row&&['registered','installed','installed-not-loaded'].includes(row.state);

/**
 * `client`: which client this host is ('dsh' | 'hanamesh', see client-identity.js). `unavailable`: when there is no
 * installer, the facts that are missing, in words a person can act on (`[{need, how}]`); probes and 503s carry them.
 */
export function createLibraryService({domain,host,config={},dataRoot,ledgerReader,installer,client='dsh',unavailable=()=>[],installationStatus,suiteSourceService=()=>undefined,logger}){
  const warn=(message,...args)=>{if(typeof logger?.warn==='function')logger.warn(message,...args);else console.warn(message,...args);};
  const ready=()=>typeof installer?.install==='function'&&installer.ready!==false;
  let suiteStatus={status:'unknown',version:null,components:[]};
  const suiteFacts=async()=>installer?.suiteFacts?await installer.suiteFacts():{...await readSuiteStatus(config.profileDir),status:'unknown',completeness:'unknown',blocked:[{code:'CORE_SUITE_DECLARATION_MISSING'}],suiteUpgradeUnavailable:CORE_SUITE_DECLARATION_MISSING};
  const events=[];let sequence=0;let state;const running=new Map(),installing=new Map();let bootDependencies;
  const eventRetention=config.eventRetention??512;
  requireCondition(Number.isSafeInteger(eventRetention)&&eventRetention>0,'INVALID_INPUT','library.eventRetention must be a positive safe integer.');
  const observers=new Set();
  const emit=event=>{const value={sequence:++sequence,at:Date.now(),...event};events.push(value);if(events.length>eventRetention)events.shift();for(const observer of observers){try{observer(value);}catch(error){warn('hanamesh-app-host library: event observer failed (%s): %s',value.type,error?.message??error);}}return value;};
  // Real sources hold ~10k entries (2026-09-20: market.hanamesh.com 12,121). `/hanamesh/library` keeps its rc.16 default
  // (`category=hanamesh-app`, backward compatible); the rc.28 market page asks for `category=''` (everything) explicitly.
  const catalog=({q='',category='hanamesh-app',cursor}={})=>loadCatalog({fixture:config.fixture,sources:state.sources,fetchImpl:config.fetchImpl,query:q,category,cursor});
  async function installed(){return config.profileDir?await scanInstalled({profileDir:config.profileDir,host,ledgerReader,dataRoot}):[];}
  async function installedPlugins(){return config.profileDir?await scanInstalledPlugins({profileDir:config.profileDir,bootDependencies}):[];}
  const settingsWriter=new SerialQueue();
  function persist(update){return settingsWriter.run(async()=>{const next={...update(state),revision:state.revision+1};await domain.global.set(next);state=next;});}
  async function operation(type,task){const operationId=randomUUID();emit({type:`library.${type}-started`,operationId});const work=Promise.resolve().then(()=>task(operationId)).then(result=>{emit({type:`library.${type}-done`,operationId,result});return result;},error=>{emit({type:`library.${type}-failed`,operationId,code:error.code??'LIBRARY_OPERATION_FAILED',...(error.recovery?{recovery:error.recovery}:{}),...(error.details?.stage==='suite-upgrade'?{details:{stage:'suite-upgrade',actual:error.details.actual,command:SUITE_INSTALL_COMMAND}}:{})});throw error;}).finally(()=>running.delete(operationId));running.set(operationId,work);work.catch(()=>{});return{operationId,status:'started'};}
  const requireInstaller=(message)=>requireCondition(ready(),'LIBRARY_INSTALL_UNAVAILABLE',message,{need:unavailable()},503);
  /**
   * The host itself loaded/unloaded a plugin (pluginManager `applied`): it no longer waits for a restart. When the profile
   * cannot be read back, the result says so (`restartBaseline`) instead of the installed list silently showing 「需重启」.
   */
  let bootSnapshotError;
  async function markLive(result){
    if(result?.status!=='applied'||!config.profileDir)return result;
    if(!bootDependencies)return{...result,restartBaseline:{updated:false,code:'BOOT_SNAPSHOT_UNREADABLE',cause:bootSnapshotError}};
    let now;
    try{now=await snapshotProfileDependencies(config.profileDir);}
    catch(error){const code=error?.code??'PROFILE_READ_FAILED';warn('hanamesh-app-host library: profile read-back after live %s failed (%s)',result.packageName,code);return{...result,restartBaseline:{updated:false,code}};}
    if(now[result.packageName])bootDependencies[result.packageName]=now[result.packageName];else delete bootDependencies[result.packageName];
    return{...result,restartBaseline:{updated:true}};
  }
  async function resolveTarget(input){
    requireCondition(input&&typeof input==='object'&&!Array.isArray(input),'INVALID_INPUT','Only itemId and packageName are accepted.');
    // rc.8: optional install-target contract declaration. Absent keeps the v1 semantics; anything but '1' is refused explicitly, before field checks.
    requireCondition(input.contractVersion===undefined||input.contractVersion===INSTALL_TARGET_CONTRACT_VERSION,'CONTRACT_VERSION_UNSUPPORTED','This market does not implement the requested install-target contract version.',{supported:[INSTALL_TARGET_CONTRACT_VERSION]});
    requireCondition(Object.keys(input).every(key=>['itemId','packageName','contractVersion'].includes(key)),'INVALID_INPUT','Only itemId and packageName are accepted.');
    const{itemId,packageName}=input;
    if(itemId===SUITE_TARGET){
      requireCondition(packageName===undefined,'INVALID_INPUT','套件升级不接受包名或任意替换参数。');
      requireCondition(typeof installer?.prepareSuiteUpgrade==='function','SUITE_UPGRADE_UNAVAILABLE','当前客户端还不支持安全套件升级，请使用补齐命令。',{},503);
      const plan=await installer.prepareSuiteUpgrade();
      return{contractVersion:'1',source:{kind:'suite',manifestUrl:'https://github.com/yzsnstotz'},item:{id:SUITE_TARGET,displayName:'HanaMesh 套件',kind:'suite-upgrade',package:{registry:'npm',name:'@hanamesh/core'},latestVersion:plan.components[0].to,installed:{state:'installed',version:suiteStatus.version},upgradeAvailable:plan.available,suiteUpgrade:plan}};
    }
    requireCondition(itemId!==undefined||packageName!==undefined,'INVALID_INPUT','itemId or packageName is required.');
    requireCondition(itemId===undefined||(text(itemId,160)&&!/[\u0000-\u001f\u007f]/.test(itemId)),'INVALID_INPUT','itemId is invalid.');
    requireCondition(packageName===undefined||(text(packageName,214)&&PACKAGE_NAME.test(packageName)),'INVALID_INPUT','packageName is invalid.');
    let cursor;const seen=new Set(),matches=new Map();
    do{
      const page=await catalog({q:packageName??'',category:'',cursor});
      const found=page.items.find(row=>(itemId===undefined||row.id===itemId)&&(packageName===undefined||row.package?.name===packageName));
      if(found&&itemId===undefined&&page.schemaVersion==='hanamesh.catalog.v1'){
        for(const row of page.items.filter(row=>row.package?.name===packageName))matches.set(row.id,{row,source:page.source});
        requireCondition(matches.size<=1,'CATALOG_TARGET_AMBIGUOUS','Choose an itemId: this npm name belongs to multiple catalog identities.',{packageName},409);
      }else if(found){
        requireCondition(found.package?.registry==='npm','NOT_INSTALLABLE','This catalog entry cannot be installed.');
        requireCondition(!protectedPackage(found.package.name),'PACKAGE_DENIED','The HanaMesh suite is not managed through the market.',{},403);
        const rows=[...await installedPlugins(),...await installed()],row=rows.find(value=>value.packageName===found.package.name)??null;
        return{contractVersion:INSTALL_TARGET_CONTRACT_VERSION,source:page.source,item:{...found,kind:itemKind(found),installed:row,upgradeAvailable:Boolean(row?.version&&row.state!=='uninstalled-not-unloaded'&&upgradeAvailable(found.latestVersion,row.version))}};
      }
      cursor=page.page?.nextCursor;
      requireCondition(!cursor||!seen.has(cursor),'INVALID_CURSOR','Catalog cursor repeated.');if(cursor)seen.add(cursor);
    }while(cursor);
    if(matches.size===1){
      const{row:found,source}=matches.values().next().value;
      requireCondition(!protectedPackage(found.package.name),'PACKAGE_DENIED','The HanaMesh suite is not managed through the market.',{},403);
      const rows=[...await installedPlugins(),...await installed()],row=rows.find(value=>value.packageName===found.package.name)??null;
      return{contractVersion:INSTALL_TARGET_CONTRACT_VERSION,source,item:{...found,kind:itemKind(found),installed:row,upgradeAvailable:Boolean(row?.version&&row.state!=='uninstalled-not-unloaded'&&upgradeAvailable(found.latestVersion,row.version))}};
    }
    throw new AppHostError('CATALOG_ITEM_MISSING','The market catalog does not contain this target.',{},404);
  }
  function installItem(item){
    const key=item.package.name;if(installing.has(key))return installing.get(key);
    const started=operation('install',async operationId=>{try{return await markLive(await installer.install(item,{operationId}));}finally{installing.delete(key);}});
    installing.set(key,started);return started;
  }
  async function findByPackage(packageName){
    requireCondition(text(packageName,214)&&PACKAGE_NAME.test(packageName),'INVALID_INPUT','packageName is required.');
    requireCondition(!protectedPackage(packageName),'PACKAGE_DENIED','The HanaMesh suite is not managed through the market.',{packageName},403);
    const{item}=await resolveTarget({packageName});return item;
  }
  const runningApp=appId=>host.instanceList().some(instance=>instance.appId===appId&&!['stopped','failed','interrupted'].includes(instance.status));
  return{
    async init(){state=await domain.global.get();if(state.revision===0&&state.sources.length===0&&Array.isArray(config.sources)&&config.sources.length){const sources=config.sources.map((source,index)=>({manifestUrl:validateManifestUrl(source.manifestUrl).href,enabled:source.enabled===true||(source.enabled!==false&&index===0)}));requireCondition(sources.filter(source=>source.enabled).length===1,'CATALOG_SOURCE_REQUIRED','Exactly one catalog source must be enabled.');await persist(current=>({...current,sources}));}
      // rc.28: the dependency set at boot is the "loaded" baseline for plugin restart states; unreadable → everything counts as
      // loaded, logged and reported as `restartBaseline` on list() so the market can say restart states are unknown.
      if(config.profileDir){try{bootDependencies=await snapshotProfileDependencies(config.profileDir);}catch(error){bootDependencies=undefined;bootSnapshotError=error?.code??'PROFILE_READ_FAILED';warn('hanamesh-app-host library: boot profile snapshot unreadable (%s); restart states cannot be told',bootSnapshotError);}}
      suiteStatus=await suiteFacts();return this;},
    async list({q='',category,cursor}={}){requireCondition(typeof q==='string'&&q.length<=200,'INVALID_QUERY','q must be a string of at most 200 characters.');requireCondition(category===undefined||(typeof category==='string'&&category.length<=64&&/^[a-z0-9._:-]*$/.test(category)),'INVALID_QUERY','category is invalid.');requireCondition(cursor===undefined||(typeof cursor==='string'&&cursor.length>0&&cursor.length<=2048),'INVALID_CURSOR','cursor is invalid.');
      const page=await catalog({q,category,cursor});const installedRows=await installed();const pluginRows=await installedPlugins();
      suiteStatus={...await suiteFacts(),...(suiteStatus.restartRequired?{restartRequired:true}:{}),...(suiteStatus.upgradeError?{upgradeError:suiteStatus.upgradeError}:{})};
      const byPackage=new Map([...pluginRows,...installedRows].map(row=>[row.packageName,row]));
      let items=page.items.filter(item=>!protectedPackage(item.package?.name)).map(item=>{const row=byPackage.get(item.package?.name)??null;const kind=itemKind(item);
        return{...item,kind,application:isApplication(item),installed:row,upgradeAvailable:Boolean(row&&row.version&&row.state!=='uninstalled-not-unloaded'&&upgradeAvailable(item.latestVersion,row.version))};});
      if(config.profileDir&&!cursor&&(!category||category==='plugin')&&(!q||'hanamesh 套件'.includes(q.toLowerCase())))items.unshift({id:'hanamesh:suite',displayName:'HanaMesh 套件',summary:'官方 · 不计分。Core、使用记录与应用库一次装齐。',kind:'suite',official:true,latestVersion:suiteStatus.version,installed:suiteStatus.status==='installed'?{state:'installed',version:suiteStatus.version}:null,suite:suiteStatus,...((installer?.suiteUpgradeUnavailable??suiteStatus.suiteUpgradeUnavailable)?{suiteUpgradeUnavailable:installer?.suiteUpgradeUnavailable??suiteStatus.suiteUpgradeUnavailable}:{})});
      const categories=[...new Set(page.items.flatMap(item=>item.categories??[]))].sort();
      return{source:page.source,items,categories,installed:installedRows,plugins:pluginRows,restartRequired:[...pluginRows,...installedRows].some(row=>RESTART_STATES.has(row.state)),...(bootSnapshotError?{restartBaseline:{known:false,code:bootSnapshotError}}:{}),page:page.page};},
    sources(){return{sources:structuredClone(state.sources),revision:state.revision};},
    /** Suite package registry selection is independent of catalog manifest sources. */
    suiteSourceSettings(){
      let observation;try{observation={observable:true,state:readSuiteSourceState(suiteSourceService())};}catch(error){observation={observable:false,code:error.code??'CORE_SUITE_SOURCE_INVALID'};}
      return{mode:state.suiteSource?.mode??'configured',configuredRegistry:config.registry??'https://registry.npmjs.org',observation};
    },
    async replaceSuiteSourceSettings(input){
      requireCondition(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).length===1&&['configured','core'].includes(input.mode),'INVALID_SUITE_SOURCE_SETTINGS','只接受 mode: configured 或 core。');
      const selection={mode:input.mode};
      try{await persist(current=>({...current,suiteSource:selection}));}catch(error){throw new AppHostError('SUITE_SOURCE_SAVE_FAILED','套件安装包来源保存失败；原选择保持。',{},500);}
      return this.suiteSourceSettings();
    },
    /** Effective website handoff settings: saved (library settings page) → plugin config `library.handoff` → proposed defaults. */
    handoffSettings(){return handoffSettings(state.handoff??config.handoff??{});},
    async replaceHandoffSettings(input){const next=handoffSettings(input);await persist(current=>({...current,handoff:next}));return next;},
    observe(listener){observers.add(listener);return()=>observers.delete(listener);},
    async replaceSources(input){requireCondition(Array.isArray(input?.sources)&&input.sources.length<=16,'INVALID_SOURCES','sources must be an array of at most 16 entries.');const sources=input.sources.map(source=>({manifestUrl:validateManifestUrl(source.manifestUrl).href,enabled:source.enabled===true}));requireCondition(sources.length===0||sources.filter(source=>source.enabled).length===1,'CATALOG_SOURCE_REQUIRED','Exactly one catalog source must be enabled.');await persist(current=>({...current,sources}));return this.sources();},
    /** `{itemId, packageName?}`: applications and plugins take the same path (`dsh plugin add --save-exact`); also the upgrade path. */
    resolveTarget,
    /** Public discovery is metadata only: no profile, authentication or installed rows. */
    installationStatus,
    installTarget(){const need=ready()?[]:unavailable();return{client,ready:ready(),...(typeof installationStatus==='function'?{installationStatus:INSTALLATION_STATUS_CAPABILITY}:{}),...((suiteStatus.status!=='unknown'||suiteStatus.restartRequired)&&!installer?.suiteUpgradeUnavailable?{suite:structuredClone(suiteStatus)}:{}),installTarget:{contract:'hanamesh.install-target',contractVersion:INSTALL_TARGET_CONTRACT_VERSION,supported:[INSTALL_TARGET_CONTRACT_VERSION],fragmentPrefix:'#hanamesh-install?'},
      ...(!ready()?{error:{code:'INSTALL_TARGET_UNAVAILABLE',message:need.length?'应用库还不能安装：'+need.map(row=>row.need).join('；'):'Controlled installer is unavailable.',need}}:{})};},
    /** Plugin changes load without a restart (the host's public plugin manager is present). */
    get live(){return Boolean(installer?.live);},
    async upgradeSuite(input){requireInstaller('Suite upgrade is unavailable.');
      requireCondition(input&&Object.keys(input).length===1&&typeof input.planId==='string','INVALID_INPUT','Only the current planId is accepted.');
      return await operation('install',async()=>{try{const result=await installer.upgradeSuite(input);suiteStatus={...await suiteFacts(),restartRequired:true};return result;}catch(error){if(error.details?.stage!=='suite-upgrade')throw error;const actual=await readSuiteStatus(config.profileDir);suiteStatus={...await suiteFacts(),restartRequired:true,upgradeError:error.code??'SUITE_UPGRADE_FAILED'};error.details={...error.details,stage:'suite-upgrade',actual,command:SUITE_INSTALL_COMMAND};emit({type:'library.install-failed',packageName:'@hanamesh/core',code:error.code??'SUITE_UPGRADE_FAILED',details:{stage:'suite-upgrade',actual,command:SUITE_INSTALL_COMMAND}});throw error;}});
    },
    async install(input){requireCondition(input?.itemId!==SUITE_TARGET,'SUITE_CONFIRMATION_REQUIRED','请在客户端确认完整升级计划。',{},403);requireInstaller('Install requires absolute profileDir, nodeBinary, dshBin and profileName.');const{item}=await resolveTarget(input??{});if(present(item.installed)&&!item.upgradeAvailable)return{status:'already-installed',itemId:item.id,packageName:item.package.name};return await installItem(item);},
    async provision(input){requireInstaller('Runtime provision is unavailable.');
      // LIB-PROVISION-INPUT: a missing field is the caller's error (400), not an internal TypeError inside the operation.
      requireCondition(text(input?.appId,160),'INVALID_INPUT','appId is required.');requireCondition(text(input?.packageName,214)&&PACKAGE_NAME.test(input.packageName),'INVALID_INPUT','packageName is required.');requireCondition(text(input?.runtimeItem,160),'INVALID_INPUT','runtimeItem is required.');
      const{appId,packageName,runtimeItem}=input;return await operation('provision',()=>installer.provisionRuntime({appId,packageName,runtimeItem}));},
    async uninstall(input){requireInstaller('Uninstall is unavailable.');
      requireCondition(text(input?.appId,160),'INVALID_INPUT','appId is required.');requireCondition(text(input?.packageName,214)&&PACKAGE_NAME.test(input.packageName),'INVALID_INPUT','packageName is required.');requireCondition(input.runtimeItem===undefined||text(input.runtimeItem,160),'INVALID_INPUT','runtimeItem is invalid.');
      const{appId,packageName,runtimeItem}=input;return await operation('uninstall',()=>installer.uninstall({appId,packageName,runtimeItem,running:runningApp(appId)}));},
    /** rc.28 `{packageName}`: the package must be listed by the enabled catalog; an application package takes the application path. */
    async installPlugin(input){requireInstaller('Plugin install requires absolute profileDir, nodeBinary, dshBin and profileName.');const item=await findByPackage(input?.packageName);return await installItem(item);},
    /** rc.28 `{packageName}`: `dsh plugin remove`; an installed application package is routed through the application uninstall (runtime + running check). */
    async uninstallPlugin(input){requireInstaller('Plugin uninstall is unavailable.');const packageName=input?.packageName;requireCondition(text(packageName,214)&&PACKAGE_NAME.test(packageName),'INVALID_INPUT','packageName is required.');requireCondition(!protectedPackage(packageName),'PACKAGE_DENIED','The HanaMesh suite is not managed through the market.',{packageName},403);
      const app=(await installed()).find(row=>row.packageName===packageName&&row.appId);
      if(app)return await operation('uninstall',()=>installer.uninstall({appId:app.appId,packageName,runtimeItem:app.runtimeItem,running:runningApp(app.appId)}));
      return await operation('uninstall',async()=>{return await markLive(await installer.uninstallPlugin({packageName}));});},
    /** Installed application packages of the profile (empty without `profileDir`); rc.27 binds package names for usage evidence. */
    installed,
    /** rc.28: installed plugins (every non-application dependency of the profile) with restart states. */
    installedPlugins,
    async installedSnapshot(){const plugins=await installedPlugins(),apps=await installed();return{plugins,apps,restartRequired:[...plugins,...apps].some(row=>RESTART_STATES.has(row.state))};},
    events(after=0){requireCondition(Number.isSafeInteger(after)&&after>=0,'INVALID_CURSOR','Invalid library event cursor.');return{events:events.filter(event=>event.sequence>after),sequence,operations:[...running.keys()],resetRequired:after>sequence||(events.length>0&&after<events[0].sequence-1)};},
    async close(){installationStatus?.close?.();await Promise.allSettled([...running.values()]);await settingsWriter.drained();await domain.close();},emit,
  };
}
