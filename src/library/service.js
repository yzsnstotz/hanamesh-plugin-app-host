import { randomUUID } from 'node:crypto';
import { AppHostError, requireCondition } from '../errors.js';
import { loadCatalog, isApplication, itemKind, upgradeAvailable, validateManifestUrl } from './catalog.js';
import { scanInstalled, scanInstalledPlugins, snapshotProfileDependencies } from './installed.js';
import { PROTECTED_PACKAGES } from './install.js';

const PACKAGE_NAME=/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max;
const RESTART_STATES=new Set(['installed-not-loaded','uninstalled-not-unloaded']);
const protectedPackage=name=>PROTECTED_PACKAGES.includes(name);

export function createLibraryService({domain,host,config={},dataRoot,ledgerReader,installer}){
  const events=[];let sequence=0;let state;const running=new Map();let bootDependencies;
  const emit=event=>{const value={sequence:++sequence,at:Date.now(),...event};events.push(value);if(events.length>512)events.shift();return value;};
  // Real sources hold ~10k entries (2026-09-20: market.hanamesh.com 12,121). `/hanamesh/library` keeps its rc.16 default
  // (`category=hanamesh-app`, backward compatible); the rc.28 market page asks for `category=''` (everything) explicitly.
  const catalog=({q='',category='hanamesh-app',cursor}={})=>loadCatalog({fixture:config.fixture,sources:state.sources,fetchImpl:config.fetchImpl,query:q,category,cursor});
  async function installed(){return config.profileDir?await scanInstalled({profileDir:config.profileDir,host,ledgerReader,dataRoot}):[];}
  async function installedPlugins(){return config.profileDir?await scanInstalledPlugins({profileDir:config.profileDir,bootDependencies}):[];}
  async function persist(next){next.revision=state.revision+1;await domain.global.set(next);state=next;}
  async function operation(type,task){const operationId=randomUUID();emit({type:`library.${type}-started`,operationId});const work=Promise.resolve().then(task).then(result=>{emit({type:`library.${type}-done`,operationId,result});return result;},error=>{emit({type:`library.${type}-failed`,operationId,code:error.code??'LIBRARY_OPERATION_FAILED'});throw error;}).finally(()=>running.delete(operationId));running.set(operationId,work);work.catch(()=>{});return{operationId,status:'started'};}
  const requireInstaller=(message)=>requireCondition(installer,'LIBRARY_INSTALL_UNAVAILABLE',message,{},503);
  /** Find one catalog entry by id; a package name narrows the provider query (the catalog has no get-by-id, but `q=<package>` matches exactly). */
  async function findItem({itemId,packageName}){
    requireCondition(text(itemId,160),'INVALID_INPUT','itemId is required.');
    requireCondition(packageName===undefined||(text(packageName,214)&&PACKAGE_NAME.test(packageName)),'INVALID_INPUT','packageName is invalid.');
    const page=packageName?await catalog({q:packageName,category:''}):await catalog();
    const item=page.items.find(row=>row.id===itemId&&(packageName===undefined||row.package?.name===packageName));
    requireCondition(item,'CATALOG_ITEM_MISSING','Catalog item was not found.',{itemId},404);return item;
  }
  async function findByPackage(packageName){
    requireCondition(text(packageName,214)&&PACKAGE_NAME.test(packageName),'INVALID_INPUT','packageName is required.');
    requireCondition(!protectedPackage(packageName),'PACKAGE_DENIED','The HanaMesh suite is not managed through the market.',{packageName},403);
    const page=await catalog({q:packageName,category:''});const item=page.items.find(row=>row.package?.registry==='npm'&&row.package?.name===packageName);
    requireCondition(item,'CATALOG_ITEM_MISSING','The catalog does not list this package.',{packageName},404);return item;
  }
  const runningApp=appId=>host.instanceList().some(instance=>instance.appId===appId&&!['stopped','failed','interrupted'].includes(instance.status));
  return{
    async init(){state=await domain.global.get();if(state.sources.length===0&&Array.isArray(config.sources)&&config.sources.length){const sources=config.sources.map((source,index)=>({manifestUrl:validateManifestUrl(source.manifestUrl).href,enabled:source.enabled===true||(source.enabled!==false&&index===0)}));requireCondition(sources.filter(source=>source.enabled).length===1,'CATALOG_SOURCE_REQUIRED','Exactly one catalog source must be enabled.');await persist({...state,sources});}
      // rc.28: the dependency set at boot is the "loaded" baseline for plugin restart states; unreadable → everything counts as loaded.
      if(config.profileDir){try{bootDependencies=await snapshotProfileDependencies(config.profileDir);}catch{bootDependencies=undefined;}}
      return this;},
    async list({q='',category,cursor}={}){requireCondition(typeof q==='string'&&q.length<=200,'INVALID_QUERY','q must be a string of at most 200 characters.');requireCondition(category===undefined||(typeof category==='string'&&category.length<=64&&/^[a-z0-9._:-]*$/.test(category)),'INVALID_QUERY','category is invalid.');requireCondition(cursor===undefined||(typeof cursor==='string'&&cursor.length>0&&cursor.length<=2048),'INVALID_CURSOR','cursor is invalid.');
      const page=await catalog({q,category,cursor});const installedRows=await installed();const pluginRows=await installedPlugins();
      const byPackage=new Map([...pluginRows,...installedRows].map(row=>[row.packageName,row]));
      const items=page.items.map(item=>{const row=byPackage.get(item.package?.name)??null;const kind=itemKind(item);
        return{...item,kind,application:isApplication(item),installed:row,upgradeAvailable:Boolean(row&&row.version&&row.state!=='uninstalled-not-unloaded'&&upgradeAvailable(item.latestVersion,row.version))};});
      const categories=[...new Set(page.items.flatMap(item=>item.categories??[]))].sort();
      return{source:page.source,items,categories,installed:installedRows,plugins:pluginRows,restartRequired:[...pluginRows,...installedRows].some(row=>RESTART_STATES.has(row.state)),page:page.page};},
    sources(){return{sources:structuredClone(state.sources),revision:state.revision};},
    async replaceSources(input){requireCondition(Array.isArray(input?.sources)&&input.sources.length<=16,'INVALID_SOURCES','sources must be an array of at most 16 entries.');const sources=input.sources.map(source=>({manifestUrl:validateManifestUrl(source.manifestUrl).href,enabled:source.enabled===true}));requireCondition(sources.length===0||sources.filter(source=>source.enabled).length===1,'CATALOG_SOURCE_REQUIRED','Exactly one catalog source must be enabled.');await persist({...state,sources});return this.sources();},
    /** `{itemId, packageName?}`: applications and plugins take the same path (`dsh plugin add --save-exact`); also the upgrade path. */
    async install(input){requireInstaller('Install requires absolute profileDir, nodeBinary, dshBin and profileName.');const item=await findItem(input??{});return await operation('install',()=>installer.install(item));},
    async provision(input){requireInstaller('Runtime provision is unavailable.');
      // LIB-PROVISION-INPUT: a missing field is the caller's error (400), not an internal TypeError inside the operation.
      requireCondition(text(input?.appId,160),'INVALID_INPUT','appId is required.');requireCondition(text(input?.packageName,214)&&PACKAGE_NAME.test(input.packageName),'INVALID_INPUT','packageName is required.');requireCondition(text(input?.runtimeItem,160),'INVALID_INPUT','runtimeItem is required.');
      const{appId,packageName,runtimeItem}=input;return await operation('provision',()=>installer.provisionRuntime({appId,packageName,runtimeItem}));},
    async uninstall(input){requireInstaller('Uninstall is unavailable.');
      requireCondition(text(input?.appId,160),'INVALID_INPUT','appId is required.');requireCondition(text(input?.packageName,214)&&PACKAGE_NAME.test(input.packageName),'INVALID_INPUT','packageName is required.');requireCondition(input.runtimeItem===undefined||text(input.runtimeItem,160),'INVALID_INPUT','runtimeItem is invalid.');
      const{appId,packageName,runtimeItem}=input;return await operation('uninstall',()=>installer.uninstall({appId,packageName,runtimeItem,running:runningApp(appId)}));},
    /** rc.28 `{packageName}`: the package must be listed by the enabled catalog; an application package takes the application path. */
    async installPlugin(input){requireInstaller('Plugin install requires absolute profileDir, nodeBinary, dshBin and profileName.');const item=await findByPackage(input?.packageName);return await operation('install',()=>installer.install(item));},
    /** rc.28 `{packageName}`: `dsh plugin remove`; an installed application package is routed through the application uninstall (runtime + running check). */
    async uninstallPlugin(input){requireInstaller('Plugin uninstall is unavailable.');const packageName=input?.packageName;requireCondition(text(packageName,214)&&PACKAGE_NAME.test(packageName),'INVALID_INPUT','packageName is required.');requireCondition(!protectedPackage(packageName),'PACKAGE_DENIED','The HanaMesh suite is not managed through the market.',{packageName},403);
      const app=(await installed()).find(row=>row.packageName===packageName&&row.appId);
      if(app)return await operation('uninstall',()=>installer.uninstall({appId:app.appId,packageName,runtimeItem:app.runtimeItem,running:runningApp(app.appId)}));
      return await operation('uninstall',()=>installer.uninstallPlugin({packageName}));},
    /** Installed application packages of the profile (empty without `profileDir`); rc.27 binds package names for usage evidence. */
    installed,
    /** rc.28: installed plugins (every non-application dependency of the profile) with restart states. */
    installedPlugins,
    async installedSnapshot(){const plugins=await installedPlugins(),apps=await installed();return{plugins,apps,restartRequired:[...plugins,...apps].some(row=>RESTART_STATES.has(row.state))};},
    events(after=0){requireCondition(Number.isSafeInteger(after)&&after>=0,'INVALID_CURSOR','Invalid library event cursor.');return{events:events.filter(event=>event.sequence>after),sequence,operations:[...running.keys()]};},
    async close(){await Promise.allSettled([...running.values()]);await domain.close();},emit,
  };
}
