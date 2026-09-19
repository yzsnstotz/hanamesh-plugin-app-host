import { randomUUID } from 'node:crypto';
import { AppHostError, requireCondition } from '../errors.js';
import { loadCatalog, isApplication, validateManifestUrl } from './catalog.js';
import { scanInstalled } from './installed.js';

export function createLibraryService({domain,host,config={},dataRoot,ledgerReader,installer}){
  const events=[];let sequence=0;let state;const running=new Map();
  const emit=event=>{const value={sequence:++sequence,at:Date.now(),...event};events.push(value);if(events.length>512)events.shift();return value;};
  const catalog=()=>loadCatalog({fixture:config.fixture,sources:state.sources,fetchImpl:config.fetchImpl});
  async function installed(){return config.profileDir?await scanInstalled({profileDir:config.profileDir,host,ledgerReader,dataRoot}):[];}
  async function persist(next){next.revision=state.revision+1;await domain.global.set(next);state=next;}
  async function operation(type,task){const operationId=randomUUID();emit({type:`library.${type}-started`,operationId});const work=Promise.resolve().then(task).then(result=>{emit({type:`library.${type}-done`,operationId,result});return result;},error=>{emit({type:`library.${type}-failed`,operationId,code:error.code??'LIBRARY_OPERATION_FAILED'});throw error;}).finally(()=>running.delete(operationId));running.set(operationId,work);work.catch(()=>{});return{operationId,status:'started'};}
  return{
    async init(){state=await domain.global.get();if(state.sources.length===0&&Array.isArray(config.sources)&&config.sources.length){const sources=config.sources.map((source,index)=>({manifestUrl:validateManifestUrl(source.manifestUrl).href,enabled:source.enabled===true||(source.enabled!==false&&index===0)}));requireCondition(sources.filter(source=>source.enabled).length===1,'CATALOG_SOURCE_REQUIRED','Exactly one catalog source must be enabled.');await persist({...state,sources});}return this;},
    async list(){const page=await catalog();const installedRows=await installed();const byPackage=new Map(installedRows.map(row=>[row.packageName,row]));return{source:page.source,items:page.items.map(item=>({...item,application:isApplication(item),installed:byPackage.get(item.package?.name)??null})),installed:installedRows,page:page.page};},
    sources(){return{sources:structuredClone(state.sources),revision:state.revision};},
    async replaceSources(input){requireCondition(Array.isArray(input?.sources)&&input.sources.length<=16,'INVALID_SOURCES','sources must be an array of at most 16 entries.');const sources=input.sources.map(source=>({manifestUrl:validateManifestUrl(source.manifestUrl).href,enabled:source.enabled===true}));requireCondition(sources.length===0||sources.filter(source=>source.enabled).length===1,'CATALOG_SOURCE_REQUIRED','Exactly one catalog source must be enabled.');await persist({...state,sources});return this.sources();},
    async install({itemId}){requireCondition(installer,'LIBRARY_INSTALL_UNAVAILABLE','Install requires absolute profileDir, nodeBinary, dshBin and profileName.',{},503);const page=await catalog();const item=page.items.find(row=>row.id===itemId);requireCondition(item,'CATALOG_ITEM_MISSING','Catalog item was not found.',{},404);return await operation('install',()=>installer.install(item));},
    async provision(input){requireCondition(installer,'LIBRARY_INSTALL_UNAVAILABLE','Runtime provision is unavailable.',{},503);return await operation('provision',()=>installer.provisionRuntime(input));},
    async uninstall(input){requireCondition(installer,'LIBRARY_INSTALL_UNAVAILABLE','Uninstall is unavailable.',{},503);const runningNow=host.instanceList().some(instance=>instance.appId===input.appId&&!['stopped','failed','interrupted'].includes(instance.status));return await operation('uninstall',()=>installer.uninstall({...input,running:runningNow}));},
    events(after=0){requireCondition(Number.isSafeInteger(after)&&after>=0,'INVALID_CURSOR','Invalid library event cursor.');return{events:events.filter(event=>event.sequence>after),sequence,operations:[...running.keys()]};},
    async close(){await Promise.allSettled([...running.values()]);await domain.close();},emit,
  };
}
