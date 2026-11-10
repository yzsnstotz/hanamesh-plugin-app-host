/** npm release discovery for the market; mutations still use the official DSH plugin CLI. */
import semver from 'semver';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {AppHostError,requireCondition} from '../errors.js';
const packageName=value=>typeof value==='string'&&value.length<=214&&/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value);

/** Resolve public host metadata from the running installation, never the plugin's development dependencies. */
export function hostVersionReader(anchor){
 const resolver=createRequire(anchor);
 return async name=>{
  try{return JSON.parse(await readFile(resolver.resolve(name+'/package.json'),'utf8')).version;}catch{
   try{let directory=dirname(resolver.resolve(name));for(;;){try{const value=JSON.parse(await readFile(join(directory,'package.json'),'utf8'));if(value.name===name)return value.version;}catch{}const parent=dirname(directory);if(parent===directory)break;directory=parent;}}catch{}
   return null;
  }
 };
}

/** List published releases and select an exact compatible release; network failures never become 'up to date'. */
export function createNpmVersionCatalog({registry='https://registry.npmjs.org/',fetchImpl=fetch,peerVersion=async()=>null,nodeVersion=process.versions.node,anchor,timeoutMs=30000,maxBytes=16777216}={}){
 const url=new URL(registry);
 requireCondition((url.protocol==='https:'||url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))&&!url.username&&!url.password&&!url.search&&!url.hash,'INVALID_INPUT','Plugin registry must be a credential-free HTTPS or loopback URL.');
 url.pathname=url.pathname.replace(/\/$/,'')+'/';
 async function reason(record,peer){
  if(!record?.dsh?.bundle?.patch)return 'PLUGIN_BUNDLE_MISSING';
  if(record.engines?.node&&(!semver.validRange(record.engines.node)||!semver.satisfies(nodeVersion,record.engines.node)))return 'PLUGIN_NODE_INCOMPATIBLE';
  if(record.engines!==undefined&&(!record.engines||typeof record.engines!=='object'||Array.isArray(record.engines)))return 'PLUGIN_METADATA_INVALID';
  if(record.peerDependencies!==undefined&&(!record.peerDependencies||typeof record.peerDependencies!=='object'||Array.isArray(record.peerDependencies)))return 'PLUGIN_METADATA_INVALID';
  const dshPeer=name=>name==='@deepseek-ai/dsh'||name.startsWith('@deepseek-ai/dsh-');
  if(record.engines?.dsh!==undefined||Object.keys(record.peerDependencies??{}).some(dshPeer)){
   const actual=await peer('@deepseek-ai/dsh');if(!anchor||!actual||!semver.valid(actual))return 'PLUGIN_PEER_UNKNOWN';
   try{const resolver=createRequire(anchor),sdk=await import(pathToFileURL(resolver.resolve('@deepseek-ai/dsh-app-boot')).href);if(sdk.evaluatePluginCompatibility(record,{},actual))return 'PLUGIN_PEER_INCOMPATIBLE';}catch{return 'PLUGIN_PEER_UNKNOWN';}
  }
  for(const [name,range]of Object.entries(record.peerDependencies??{})){
   if(dshPeer(name))continue;
   const actual=await peer(name);
   if(actual===null&&record.peerDependenciesMeta?.[name]?.optional===true)continue;
   if(!actual||!semver.valid(actual))return 'PLUGIN_PEER_UNKNOWN';
   if(typeof range!=='string'||!semver.validRange(range)||!semver.satisfies(actual,range))return 'PLUGIN_PEER_INCOMPATIBLE';
  }
  return null;
 }
 async function read(name){
  requireCondition(packageName(name),'INVALID_INPUT','A valid npm package name is required.');
  try{
   const response=await fetchImpl(new URL(encodeURIComponent(name),url).href,{method:'GET',credentials:'omit',redirect:'error',headers:{accept:'application/json'},signal:AbortSignal.timeout(timeoutMs)});
   requireCondition(response.ok,'PLUGIN_VERSIONS_UNAVAILABLE','Could not read published plugin versions.',{status:response.status},502);
   const chunks=[];let bytes=0;
   for await(const chunk of response.body){bytes+=chunk.length;requireCondition(bytes<=maxBytes,'PLUGIN_VERSIONS_UNAVAILABLE','Plugin version metadata exceeds the configured limit.',{},502);chunks.push(chunk);}
   const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   requireCondition(data.name===name&&data.versions&&typeof data.versions==='object'&&!Array.isArray(data.versions),'PLUGIN_VERSIONS_UNAVAILABLE','The registry returned invalid plugin metadata.',{},502);
   const versions=[],peers=new Map();const peer=name=>{if(!peers.has(name))peers.set(name,Promise.resolve().then(()=>peerVersion(name)));return peers.get(name);};
   for(const version of Object.keys(data.versions).filter(v=>semver.valid(v)===v).sort(semver.rcompare)){
    const record=data.versions[version];if(record?.name!==name||record.version!==version)continue;
    const failure=record.deprecated?'PLUGIN_VERSION_DEPRECATED':await reason(record,peer);
    versions.push({version,compatible:failure===null,...(failure?{reason:failure}:{})});
   }
   // Prereleases remain selectable; the default follows latest's stable/prerelease channel.
   const latest=data['dist-tags']?.latest,prerelease=typeof latest==='string'&&semver.valid(latest)&&semver.prerelease(latest)!==null;
   const latestVersion=versions.find(row=>row.compatible&&(prerelease||semver.prerelease(row.version)===null))?.version??null;
   return{packageName:name,registry:url.href,latestVersion,versions};
  }catch(error){if(error instanceof AppHostError)throw error;throw new AppHostError('PLUGIN_VERSIONS_UNAVAILABLE','Could not read published plugin versions.',{cause:String(error.message??error)},502);}
 }
 return{read,forRegistry:value=>createNpmVersionCatalog({registry:value,fetchImpl,peerVersion,nodeVersion,anchor,timeoutMs,maxBytes}),async select(name,version){requireCondition(typeof version==='string'&&semver.valid(version)===version,'INVALID_INPUT','Select an exact published version.');const result=await read(name),row=result.versions.find(row=>row.version===version);requireCondition(row?.compatible,'PLUGIN_VERSION_INCOMPATIBLE','The selected version is unavailable or incompatible with this client.',{version,reason:row?.reason??'PLUGIN_VERSION_MISSING'},409);return row;}};
}
