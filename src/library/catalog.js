import { readFile } from 'node:fs/promises';
import { AppHostError, requireCondition } from '../errors.js';

const MAX_BYTES=2*1024*1024;
const plain=value=>typeof value==='string'&&value.length>0&&!/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value);
const own=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));

export function validateManifestUrl(value){
  let url;try{url=new URL(value);}catch{throw new AppHostError('INVALID_CATALOG_URL','Catalog manifest URL is invalid.');}
  requireCondition(url.protocol==='https:'&&!url.port&&!url.username&&!url.password&&!url.search&&!url.hash,
    'INVALID_CATALOG_URL','Catalog manifests require standard-port HTTPS without credentials, query, or fragment.');
  return url;
}

export function validateCatalogManifest(value){
  requireCondition(own(value,['manifestVersion','providerId','name','description','homepage','attribution','transport','query'])&&
    value.manifestVersion==='1.0.0'&&/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(value.providerId)&&plain(value.name)&&
    own(value.attribution,['name','url','notice'])&&plain(value.attribution.name)&&
    own(value.transport,['kind','endpoint','method'])&&value.transport.kind==='https-json'&&value.transport.method==='GET'&&
    own(value.query,['supported','defaultLimit','maxLimit','sorts'])&&Array.isArray(value.query.supported)&&Array.isArray(value.query.sorts)&&
    Number.isInteger(value.query.defaultLimit)&&value.query.defaultLimit>=1&&value.query.defaultLimit<=200&&
    Number.isInteger(value.query.maxLimit)&&value.query.maxLimit>=value.query.defaultLimit&&value.query.maxLimit<=200,
    'INVALID_CATALOG_MANIFEST','Catalog source manifest does not match schema 1.0.0.');
  validateManifestUrl(value.attribution.url);
  const endpoint=validateManifestUrl(value.transport.endpoint);
  requireCondition(endpoint.pathname.endsWith('/v1/plugins'),'INVALID_CATALOG_MANIFEST','Catalog endpoint must end in /v1/plugins.');
  return structuredClone(value);
}

function validateItem(item){
  // Key set = schemas/catalog-provider-page.schema.json `item` (incl. optional `updatedAt`; the production source emits it — 2026-09-20).
  requireCondition(own(item,['id','name','displayName','summary','description','homepage','latestVersion','license','categories','keywords','capabilities','compatibility','repository','installSource','package','publisher','media','updatedAt'])&&(item.updatedAt===undefined||(typeof item.updatedAt==='string'&&Number.isFinite(Date.parse(item.updatedAt))))&&
    plain(item.id)&&item.id.length<=160&&plain(item.name)&&plain(item.displayName)&&plain(item.summary)&&
    (item.categories===undefined||(Array.isArray(item.categories)&&new Set(item.categories).size===item.categories.length&&item.categories.every(x=>/^[a-z0-9][a-z0-9._:-]{0,63}$/.test(x))))&&
    (item.package===undefined||(own(item.package,['registry','name'])&&item.package.registry==='npm'&&/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(item.package.name))),
    'INVALID_CATALOG_PAGE','Catalog item does not match schema 1.0.0.');
}

export function validateProviderPage(value){
  requireCondition(own(value,['schemaVersion','generatedAt','revision','items','page'])&&value.schemaVersion==='1.0.0'&&
    Array.isArray(value.items)&&value.items.length<=200&&own(value.page,['nextCursor','total']),
    'INVALID_CATALOG_PAGE','Catalog provider page does not match schema 1.0.0.');
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

async function responseJson(response,label){
  requireCondition(response.ok,'CATALOG_HTTP_ERROR',`${label} returned HTTP ${response.status}.`,{status:response.status},502);
  const contentType=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()??'';
  requireCondition(/^application\/(?:json|.+\+json)$/.test(contentType)&&!response.headers.get('content-encoding'),
    'CATALOG_RESPONSE_DENIED',`${label} must be unencoded JSON.`,{},502);
  const declared=Number(response.headers.get('content-length')??0);
  requireCondition(!declared||declared<=MAX_BYTES,'CATALOG_RESPONSE_TOO_LARGE',`${label} exceeds 2 MiB.`,{},502);
  const bytes=new Uint8Array(await response.arrayBuffer());
  requireCondition(bytes.byteLength<=MAX_BYTES,'CATALOG_RESPONSE_TOO_LARGE',`${label} exceeds 2 MiB.`,{},502);
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new AppHostError('INVALID_CATALOG_JSON',`${label} returned malformed JSON.`,{},502);}
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
  const manifest=validateCatalogManifest(await responseJson(manifestResponse.response,'Catalog manifest'));
  const endpoint=validateManifestUrl(manifest.transport.endpoint);
  requireCondition(endpoint.origin===manifestUrl.origin,'INVALID_CATALOG_MANIFEST','Catalog endpoint must share the manifest origin.');
  if(query)endpoint.searchParams.set('q',String(query).slice(0,200));if(category)endpoint.searchParams.set('category',String(category).slice(0,64));if(cursor)endpoint.searchParams.set('cursor',String(cursor).slice(0,2048));endpoint.searchParams.set('limit','50');
  const pageResponse=await sameOriginFetch(endpoint,fetchImpl,'Catalog page');
  return{source:{kind:'remote',manifestUrl:manifestUrl.href,manifest},...validateProviderPage(await responseJson(pageResponse.response,'Catalog page'))};
}
