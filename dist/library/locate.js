/**
 * Library locations on plain DSH (PRD §A.8 official-distribution path, rc.26).
 *
 * The pinned kernel exposes neither the profile directory nor the profile name to a plugin, and the
 * desktop shell fills `library.profileDir/profileName/dshBin` and `nodeBinary` through its overlay.
 * A `dsh plugin add` user has no overlay, so without these the installed-app scan returned `[]` and
 * every install/uninstall answered `LIBRARY_INSTALL_UNAVAILABLE`. Each value below is inferred ONLY
 * when the explicit config leaves it undefined, and only from facts this process can prove about
 * itself: where its own package really lives, which script started it, and which Node runs it.
 */
import { readFile, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_NAME='@hanamesh/dsh-app-host';
/** Used when `library.sources` is undefined (not configured). An explicit `[]` means "no source". */
export const DEFAULT_CATALOG_SOURCES=Object.freeze([Object.freeze({manifestUrl:'https://market.hanamesh.com/catalog-source.json',enabled:true})]);
const DSH_BIN_SUFFIX='/@deepseek-ai/dsh/lib/bin.js';

async function json(path){try{return JSON.parse(await readFile(path,'utf8'));}catch{return undefined;}}
/** A DSH profile manifest that carries HanaMesh: `dsh.profile` (written by `dsh plugin`) or a hanamesh dependency. */
export function isHanameshProfileManifest(manifest){
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))return false;
  const hanamesh=name=>typeof name==='string'&&/hanamesh/.test(name);
  const bundles=manifest.dsh?.profile?.bundles;
  return(Array.isArray(bundles)&&bundles.some(hanamesh))||Object.keys(manifest.dependencies??{}).some(hanamesh);
}

/** Real directory of the package that owns `moduleUrl`: walk up to the package.json named PACKAGE_NAME. */
export async function packageRoot(moduleUrl){
  let dir=dirname(fileURLToPath(moduleUrl));
  for(;;){
    if((await json(join(dir,'package.json')))?.name===PACKAGE_NAME)return await realpath(dir);
    const parent=dirname(dir);if(parent===dir)return undefined;dir=parent;
  }
}

/**
 * The profile that lists this package: the nearest ancestor of the REAL package root whose
 * `node_modules/@hanamesh/dsh-app-host` resolves to that root and whose package.json is a HanaMesh
 * profile manifest. Ancestors of a real path are real, so a symlinked store path can never be
 * returned — only the profile that links it.
 */
export async function inferProfileDir(moduleUrl){
  const root=await packageRoot(moduleUrl);if(!root)return undefined;
  let dir=dirname(root);
  for(;;){
    const linked=await realpath(join(dir,'node_modules',...PACKAGE_NAME.split('/'))).catch(()=>undefined);
    if(linked===root&&isHanameshProfileManifest(await json(join(dir,'package.json'))))return dir;
    const parent=dirname(dir);if(parent===dir)return undefined;dir=parent;
  }
}

/** The DSH CLI that started this process — `argv[1]` only when it IS `@deepseek-ai/dsh/lib/bin.js`. */
export function inferDshBin(argv=process.argv){
  const candidate=argv?.[1];
  if(typeof candidate!=='string'||!isAbsolute(candidate))return undefined;
  return candidate.split(sep).join('/').endsWith(DSH_BIN_SUFFIX)?candidate:undefined;
}

/** K5: a plain Node process may run library operations with itself; an Electron host must configure `nodeBinary`. */
export function inferNodeBinary({execPath=process.execPath,versions=process.versions}={}){
  if(versions.electron!==undefined)return undefined;
  return typeof execPath==='string'&&isAbsolute(execPath)?execPath:undefined;
}

/**
 * Explicit config always wins; every inferred key is named in `inferred` so the caller can log it.
 * `sources`: undefined → DEFAULT_CATALOG_SOURCES; an explicit array (including `[]`) is kept as is.
 */
export async function resolveLibraryLocations(config={},{moduleUrl=import.meta.url,argv=process.argv,execPath=process.execPath,versions=process.versions,nodeBinary}={}){
  const inferred=[];
  let profileDir=config.profileDir;if(profileDir===undefined){profileDir=await inferProfileDir(moduleUrl);if(profileDir)inferred.push('profileDir');}
  let profileName=config.profileName;if(profileName===undefined&&profileDir){profileName=basename(profileDir);inferred.push('profileName');}
  let dshBin=config.dshBin;if(dshBin===undefined){dshBin=inferDshBin(argv);if(dshBin)inferred.push('dshBin');}
  let node=nodeBinary;if(node===undefined){node=inferNodeBinary({execPath,versions});if(node)inferred.push('nodeBinary');}
  let sources=config.sources;if(sources===undefined){sources=structuredClone(DEFAULT_CATALOG_SOURCES);inferred.push('sources');}
  return{profileDir,profileName,dshBin,nodeBinary:node,sources,inferred};
}
