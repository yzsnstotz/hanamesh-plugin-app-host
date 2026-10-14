import { readFile } from 'node:fs/promises';
import { AppHostError, requireCondition } from '../errors.js';

// Catalog schema versions are SemVer; install-target protocol '1' is a separate grammar.
const catalogVersion=value=>typeof value==='string'&&/^1\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$(?![\s\S])/u.test(value);

const MAX_BYTES=2*1024*1024;
const HANAMESH_SCHEMA='hanamesh.catalog.v1';
const MAX_SOURCE_LINKS=500;
const plain=value=>typeof value==='string'&&value.length>0&&!/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value);
const own=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));

export function validateManifestUrl(value){
  let url;try{url=new URL(value);}catch{throw new AppHostError('INVALID_CATALOG_URL','Catalog manifest URL is invalid.');}
  const viewQuery=!url.search||(url.searchParams.size===1&&url.searchParams.get('view')==='hanamesh');
  requireCondition(url.protocol==='https:'&&!url.port&&!url.username&&!url.password&&viewQuery&&!url.hash,
    'INVALID_CATALOG_URL','Catalog manifests require standard-port HTTPS with only an optional view=hanamesh query.');
  return url;
}

export function validateCatalogManifest(value){
  let endpoint;try{endpoint=validateManifestUrl(value?.transport?.endpoint);}catch{throw new AppHostError('INVALID_CATALOG_MANIFEST','Catalog endpoint URL is invalid.');}
  const hana=endpoint.searchParams.get('view')==='hanamesh';
  requireCondition(own(value,['manifestVersion','providerId','name','description','homepage','attribution','transport','query',...(hana?['limits']:[])])&&
    catalogVersion(value.manifestVersion)&&/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(value.providerId)&&plain(value.name)&&
    own(value.attribution,['name','url','notice'])&&plain(value.attribution.name)&&
    own(value.transport,['kind','endpoint','method'])&&value.transport.kind==='https-json'&&value.transport.method==='GET'&&
    own(value.query,['supported','defaultLimit','maxLimit','sorts'])&&Array.isArray(value.query.supported)&&Array.isArray(value.query.sorts)&&
    Number.isInteger(value.query.defaultLimit)&&value.query.defaultLimit>=1&&value.query.defaultLimit<=200&&
    Number.isInteger(value.query.maxLimit)&&value.query.maxLimit>=value.query.defaultLimit&&value.query.maxLimit<=200,
    'INVALID_CATALOG_MANIFEST','Catalog source manifest does not match catalog schema major 1.');
  if(hana){
    requireCondition(displayUrl(value.attribution.url)&&
      own(value.limits,['maxBodyBytes','maxSourceLinks'])&&
      Number.isSafeInteger(value.limits.maxBodyBytes)&&value.limits.maxBodyBytes>0&&value.limits.maxBodyBytes<=MAX_BYTES&&
      Number.isSafeInteger(value.limits.maxSourceLinks)&&value.limits.maxSourceLinks>=0&&value.limits.maxSourceLinks<=MAX_SOURCE_LINKS&&
      value.query.supported.every(key=>['q','category','cursor','limit'].includes(key))&&value.query.sorts.length===0,
      'INVALID_CATALOG_MANIFEST','HanaMesh manifest limits or query declaration is invalid.');
  }else{
    const attribution=validateManifestUrl(value.attribution.url);
    requireCondition(!attribution.search,'INVALID_CATALOG_MANIFEST','Default catalog attribution must not contain a query.');
  }
  requireCondition(endpoint.pathname.endsWith('/v1/plugins'),'INVALID_CATALOG_MANIFEST','Catalog endpoint must end in /v1/plugins.');
  return structuredClone(value);
}

const textWithin=(value,max,nonempty=false)=>typeof value==='string'&&value.length<=max&&(!nonempty||value.length>0)&&
  !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value);
const npmName=value=>textWithin(value,214,true)&&/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value);
function displayUrl(value){
  if(!textWithin(value,2048,true))return false;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.hash;}catch{return false;}
}
function timestamp(value,utc=false){
  if(typeof value!=='string')return false;
  const match=/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if(!match||(utc&&match[7]!=='Z')||!Number.isFinite(Date.parse(value)))return false;
  const date=new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value.slice(0,10);
}
function validateHanaItem(item,maxSourceLinks){
  const optionalText={description:5000,latestVersion:64,license:80};
  const source=item?.source;
  requireCondition(own(item,['id','itemId','packageName','name','displayName','summary','catalogKind','source','description','homepage','latestVersion','license','categories','keywords','repository','package','publisher','updatedAt'])&&
    plain(item.id)&&item.id===item.itemId&&
    textWithin(item.name,160,true)&&textWithin(item.displayName,120,true)&&textWithin(item.summary,1000)&&
    ['application','plugin','entry'].includes(item.catalogKind)&&
    (item.packageName===null?item.package===undefined:
      npmName(item.packageName)&&own(item.package,['registry','name'])&&item.package.registry==='npm'&&item.package.name===item.packageName)&&
    Object.entries(optionalText).every(([key,max])=>item[key]===undefined||textWithin(item[key],max))&&
    (item.homepage===undefined||displayUrl(item.homepage))&&
    (item.updatedAt===undefined||timestamp(item.updatedAt))&&
    (item.categories===undefined||(Array.isArray(item.categories)&&item.categories.length<=32&&item.categories.every(value=>textWithin(value,64,true)&&/^[a-z0-9][a-z0-9._:-]{0,63}$/.test(value))))&&
    (item.keywords===undefined||(Array.isArray(item.keywords)&&item.keywords.length<=64&&item.keywords.every(value=>textWithin(value,64))))&&
    (item.repository===undefined||(own(item.repository,['url','subdirectory'])&&displayUrl(item.repository.url)&&new URL(item.repository.url).hostname==='github.com'&&
      (item.repository.subdirectory===undefined||(textWithin(item.repository.subdirectory,240,true)&&!/^\/|^[a-z]:/i.test(item.repository.subdirectory)&&!item.repository.subdirectory.includes('\\')&&!item.repository.subdirectory.split('/').includes('..')))))&&
    (item.publisher===undefined||(own(item.publisher,['name','url'])&&textWithin(item.publisher.name,120,true)&&(item.publisher.url===undefined||displayUrl(item.publisher.url))))&&
    own(source,['sourceId','sourceRef','sourceLinks'])&&textWithin(source.sourceId,120,true)&&textWithin(source.sourceRef,512,true)&&
    Array.isArray(source.sourceLinks)&&source.sourceLinks.length<=maxSourceLinks&&source.sourceLinks.every(link=>
      own(link,['sourceId','sourceRef','sourceUrl','firstSeenAt','lastSeenAt'])&&textWithin(link.sourceId,120,true)&&textWithin(link.sourceRef,512,true)&&
      displayUrl(link.sourceUrl)&&timestamp(link.firstSeenAt)&&timestamp(link.lastSeenAt)),
    'INVALID_CATALOG_PAGE','HanaMesh catalog item does not match its public schema.');
}

function validateItem(item){
  // Key set = schemas/catalog-provider-page.schema.json `item` (incl. optional `updatedAt`; the production source emits it — 2026-09-20).
  requireCondition(own(item,['id','name','displayName','summary','description','homepage','latestVersion','license','categories','keywords','capabilities','compatibility','repository','installSource','package','publisher','media','updatedAt'])&&(item.updatedAt===undefined||(typeof item.updatedAt==='string'&&Number.isFinite(Date.parse(item.updatedAt))))&&
    plain(item.id)&&item.id.length<=160&&plain(item.name)&&plain(item.displayName)&&plain(item.summary)&&
    (item.categories===undefined||(Array.isArray(item.categories)&&new Set(item.categories).size===item.categories.length&&item.categories.every(x=>/^[a-z0-9][a-z0-9._:-]{0,63}$/.test(x))))&&
    (item.package===undefined||(own(item.package,['registry','name'])&&item.package.registry==='npm'&&/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(item.package.name))),
    'INVALID_CATALOG_PAGE','Catalog item does not match catalog schema major 1.');
}

export function validateProviderPage(value,{maxItems=200,maxSourceLinks=MAX_SOURCE_LINKS}={}){
  if(value?.schemaVersion===HANAMESH_SCHEMA){
    requireCondition(own(value,['schemaVersion','generatedAt','items','page'])&&
      (value.generatedAt===undefined||timestamp(value.generatedAt,true))&&Array.isArray(value.items)&&value.items.length<=maxItems&&own(value.page,['nextCursor','total'])&&
      (Object.keys(value.page).length===0||(Object.keys(value.page).length===2&&typeof value.page.nextCursor==='string'&&value.page.nextCursor.length>0&&Number.isSafeInteger(value.page.total)&&value.page.total>=0)),
      'INVALID_CATALOG_PAGE','HanaMesh catalog page does not match its public schema.');
    for(const item of value.items)validateHanaItem(item,maxSourceLinks);
    return structuredClone(value);
  }
  requireCondition(own(value,['schemaVersion','generatedAt','revision','items','page'])&&catalogVersion(value.schemaVersion)&&
    Array.isArray(value.items)&&value.items.length<=200&&own(value.page,['nextCursor','total']),
    'INVALID_CATALOG_PAGE','Catalog provider page does not match catalog schema major 1.');
  for(const item of value.items)validateItem(item);
  return structuredClone(value);
}

export function isApplication(item){return Boolean(item?.categories?.includes('hanamesh-app')&&item?.package?.registry==='npm');}
/** rc.28 market: an npm-backed entry that is not a HanaMesh application installs as a plain DSH plugin (`dsh plugin add`). */
export function isPlugin(item){return Boolean(item?.package?.registry==='npm'&&!isApplication(item));}
/** `application` | `plugin` | `listing` (repository-only / no npm package: browse only). */
export function itemKind(item){return isApplication(item)?'application':isPlugin(item)?'plugin':'listing';}

/** Exact semver compare without a dependency: numeric core, then a prerelease sorts below its release; unparsable → 0. */
export function compareVersions(a,b){
  const parse=value=>{const m=/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(value??'').trim());return m&&{core:[+m[1],+m[2],+m[3]],pre:m[4]?m[4].split('.'):null};};
  const x=parse(a),y=parse(b);if(!x||!y)return 0;
  for(let i=0;i<3;i++)if(x.core[i]!==y.core[i])return x.core[i]<y.core[i]?-1:1;
  if(!x.pre&&!y.pre)return 0;if(!x.pre)return 1;if(!y.pre)return -1;
  for(let i=0;i<Math.max(x.pre.length,y.pre.length);i++){const p=x.pre[i],q=y.pre[i];if(p===undefined)return -1;if(q===undefined)return 1;const np=/^\d+$/.test(p),nq=/^\d+$/.test(q);
    if(np&&nq){if(+p!==+q)return +p<+q?-1:1;}else if(np!==nq)return np?-1:1;else if(p!==q)return p<q?-1:1;}
  return 0;
}
/** `latestVersion` of the catalog entry is strictly newer than the installed version. */
export function upgradeAvailable(latestVersion,installedVersion){return compareVersions(latestVersion,installedVersion)>0;}

async function responseJson(response,label,maxBytes=MAX_BYTES,providerErrors=false){
  if(!providerErrors)requireCondition(response.ok,'CATALOG_HTTP_ERROR',`${label} returned HTTP ${response.status}.`,{status:response.status},502);
  const contentType=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()??'';
  requireCondition(/^application\/(?:json|.+\+json)$/.test(contentType)&&!response.headers.get('content-encoding'),
    'CATALOG_RESPONSE_DENIED',`${label} must be unencoded JSON.`,{},502);
  const declared=Number(response.headers.get('content-length')??0);
  requireCondition(!declared||declared<=maxBytes,'CATALOG_RESPONSE_TOO_LARGE',`${label} exceeds the declared body limit.`,{},502);
  const bytes=new Uint8Array(await response.arrayBuffer());
  requireCondition(bytes.byteLength<=maxBytes,'CATALOG_RESPONSE_TOO_LARGE',`${label} exceeds the declared body limit.`,{},502);
  let value;try{value=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new AppHostError('INVALID_CATALOG_JSON',`${label} returned malformed JSON.`,{},502);}
  if(!response.ok){
    const codes={INVALID_REQUEST:400,INVALID_CATALOG_ORIGIN:400,CATALOG_CHANGED:409,UPSTREAM_UNAVAILABLE:503,CATALOG_RESPONSE_TOO_LARGE:500};
    const code=value?.error?.code;
    if(typeof code==='string'&&Object.hasOwn(codes,code)&&codes[code]===response.status){
      const missing=Array.isArray(value.error.missing)?value.error.missing.filter(name=>['CATALOG_DB','HM_SERVER_ORIGIN'].includes(name)):[];
      throw new AppHostError(code,`${label} was refused by the catalog provider.`,missing.length?{missing:[...new Set(missing)]}:{},response.status);
    }
    throw new AppHostError('CATALOG_HTTP_ERROR',`${label} returned HTTP ${response.status}.`,{status:response.status},502);
  }
  return value;
}

async function sameOriginFetch(start,fetchImpl,label){
  const origin=start.origin;let current=start;
  for(let redirects=0;redirects<=3;redirects++){
    const response=await fetchImpl(current,{redirect:'manual',headers:{accept:'application/json','accept-encoding':'identity'}});
    if([301,302,303,307,308].includes(response.status)){
      requireCondition(redirects<3,'CATALOG_REDIRECT_DENIED','Catalog redirected more than three times.',{},502);
      const location=response.headers.get('location');requireCondition(location,'CATALOG_REDIRECT_DENIED','Catalog redirect lacks a location.',{},502);
      const next=new URL(location,current);requireCondition(next.origin===origin,'CATALOG_REDIRECT_DENIED','Catalog redirects must remain on the approved origin.',{},502);
      current=next;continue;
    }
    return{response,url:current};
  }
}

export async function loadCatalog({fixture,sources=[],fetchImpl=globalThis.fetch,query='',category='',cursor}={}){
  if(fixture){
    requireCondition(typeof fixture==='string','INVALID_FIXTURE','Catalog fixture path is required.');
    let value;try{value=JSON.parse(await readFile(fixture,'utf8'));}catch(error){throw new AppHostError('INVALID_FIXTURE','Catalog fixture could not be read.',{code:error.code});}
    return{source:{kind:'fixture',path:fixture},...validateProviderPage(value)};
  }
  const enabled=sources.filter(source=>source?.enabled!==false);
  requireCondition(enabled.length===1,'CATALOG_SOURCE_REQUIRED','Exactly one catalog source must be enabled.');
  const manifestUrl=validateManifestUrl(enabled[0].manifestUrl);
  const manifestResponse=await sameOriginFetch(manifestUrl,fetchImpl,'Catalog manifest');
  const manifest=validateCatalogManifest(await responseJson(manifestResponse.response,'Catalog manifest',MAX_BYTES,manifestUrl.searchParams.get('view')==='hanamesh'));
  const endpoint=validateManifestUrl(manifest.transport.endpoint);
  requireCondition(endpoint.origin===manifestUrl.origin,'INVALID_CATALOG_MANIFEST','Catalog endpoint must share the manifest origin.');
  requireCondition(endpoint.searchParams.get('view')===manifestUrl.searchParams.get('view'),'INVALID_CATALOG_MANIFEST','Catalog endpoint must retain the selected view.');
  const hana=endpoint.searchParams.get('view')==='hanamesh';
  if(hana){
    const categories=Array.isArray(category)?category:category?[category]:[];
    requireCondition(typeof query==='string'&&query.length<=200&&categories.length<=20&&categories.every(value=>typeof value==='string'&&/^[a-z0-9][a-z0-9._:-]{0,63}$/.test(value))&&
      (cursor===undefined||(typeof cursor==='string'&&cursor.length>0)),
      'INVALID_REQUEST','Catalog query does not match the HanaMesh view contract.');
    if(query)endpoint.searchParams.set('q',query);
    for(const value of categories)endpoint.searchParams.append('category',value);
    if(cursor!==undefined)endpoint.searchParams.set('cursor',cursor);
    endpoint.searchParams.set('limit',String(manifest.query.defaultLimit));
  }else{
    if(query)endpoint.searchParams.set('q',String(query).slice(0,200));if(category)endpoint.searchParams.set('category',String(category).slice(0,64));if(cursor)endpoint.searchParams.set('cursor',String(cursor).slice(0,2048));endpoint.searchParams.set('limit','50');
  }
  const pageResponse=await sameOriginFetch(endpoint,fetchImpl,'Catalog page');
  const page=await responseJson(pageResponse.response,'Catalog page',hana?manifest.limits.maxBodyBytes:MAX_BYTES,hana);
  requireCondition(hana?page?.schemaVersion===HANAMESH_SCHEMA:catalogVersion(page?.schemaVersion),'INVALID_CATALOG_PAGE','Catalog page must match the selected view.');
  return{source:{kind:'remote',manifestUrl:manifestUrl.href,manifest},...validateProviderPage(page,hana?{maxItems:manifest.query.maxLimit,maxSourceLinks:manifest.limits.maxSourceLinks}:{})};
}
