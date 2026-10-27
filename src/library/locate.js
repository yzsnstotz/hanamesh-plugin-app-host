/**
 * Library locations on plain DSH (PRD §A.8 official-distribution path, rc.26).
 *
 * The pinned kernel exposes neither the profile directory nor the profile name to a plugin, and the
 * Historical desktop shell fills `library.profileDir/profileName/dshBin` and `nodeBinary` through its overlay.
 * A `dsh plugin add` user has no overlay, so without these the installed-app scan returned `[]` and
 * every install/uninstall answered `LIBRARY_INSTALL_UNAVAILABLE`. Each value below is inferred ONLY
 * when the explicit config leaves it undefined, and only from facts this process can prove about
 * itself: where its own package really lives, which script started it, and which Node runs it.
 */
import { readFile, realpath, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_NAME='@hanamesh/dsh-app-host';
/** Used when `library.sources` is undefined (not configured). An explicit `[]` means "no source". */
export const DEFAULT_CATALOG_SOURCES=Object.freeze([Object.freeze({manifestUrl:'https://market.hanamesh.com/catalog-source.json?view=hanamesh',enabled:true})]);
const DSH_BIN_SUFFIX='/@deepseek-ai/dsh/lib/bin.js';

async function json(path){try{return JSON.parse(await readFile(path,'utf8'));}catch{return undefined;}}
/** The public package manifest resolved by the host's installation/profile anchor. No service flags are inferred. */
async function pluginManagerFacts(anchor){
  if(typeof anchor!=='string'||!isAbsolute(anchor))return {};
  try{
    const require=createRequire(anchor),manifestPath=require.resolve('@deepseek-ai/dsh-plugin-manager/package.json'),pkg=await json(manifestPath);
    if(pkg?.name!=='@deepseek-ai/dsh-plugin-manager'||typeof pkg.version!=='string')return {};
    let pluginManagerRegistry;
    try{const path=require.resolve('@deepseek-ai/dsh-plugin-manager/registry');if(path.startsWith(dirname(manifestPath)+sep))pluginManagerRegistry=path;}catch{}
    return{pluginManagerVersion:pkg.version,...(pluginManagerRegistry?{pluginManagerRegistry}:{})};
  }catch{return {};}
}
export async function inferPluginManagerVersion(anchor){return(await pluginManagerFacts(anchor)).pluginManagerVersion;}
async function desktopRegistryPath(root,pkg){
  const entry=pkg.exports?.['./registry'],target=typeof entry==='string'?entry:entry?.import??entry?.default;
  if(typeof target!=='string'||!target.startsWith('./'))return undefined;
  const path=resolve(root,target);if(!path.startsWith(root+sep))return undefined;
  try{await access(path);return path;}catch{return undefined;}
}
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

/** Proven upstream Desktop launch layout, from desktop/src/host-process.ts and desktop-host/src/index.ts.
 * The shell passes runtimeDir and profileDir to its named entry; prove the entry and this package's
 * profile link before using them. Never infer from cwd, HOME, a port, or a supply overlay.
 */
export async function inferDesktopLayout({moduleUrl=import.meta.url,argv=process.argv}={}) {
  const [entry,runtimeDir,profileDir]=[argv?.[1],argv?.[2],argv?.[3]];
  if (![entry,runtimeDir,profileDir].every(value=>typeof value==='string'&&isAbsolute(value))) return undefined;
  const hostRoot=join(runtimeDir,'node_modules/@deepseek-ai/dsh-desktop-host'),hostManifest=await json(join(hostRoot,'package.json'));
  if (entry!==join(hostRoot,'lib/index.js') || hostManifest?.name!=='@deepseek-ai/dsh-desktop-host') return undefined;
  const root=await packageRoot(moduleUrl);
  const linked=await realpath(join(profileDir,'node_modules',...PACKAGE_NAME.split('/'))).catch(()=>undefined);
  if (!root || root!==linked || basename(profileDir)!=='desktop' || !isHanameshProfileManifest(await json(join(profileDir,'package.json')))) return undefined;
  const dshRoot=join(runtimeDir,'node_modules/@deepseek-ai/dsh');
  const dshManifest=await json(join(dshRoot,'package.json'));
  if (dshManifest?.name!=='@deepseek-ai/dsh') return undefined;
  const dshBin=await realpath(join(dshRoot,'lib/bin.js')).catch(()=>undefined);
  if (!dshBin || !await realpath(entry).catch(()=>undefined)) return undefined;
  const payload=argv[4]??join(dirname(runtimeDir),'runtime/primary-runtime');
  const cli=join(hostRoot,'lib/cli.js');
  const payloadNamed=typeof payload==='string'&&isAbsolute(payload)&&basename(payload)==='primary-runtime';
  const desktopCli=payloadNamed&&!runtimeDir.split(sep).some(segment=>segment.endsWith('.asar'))&&await realpath(cli).catch(()=>undefined)
    ? {entry:cli,runtimeDir,supportDir:dirname(payload)} : undefined;
  let nodeBinary;
  const metadata=payloadNamed?await json(join(payload,'runtime.json')):undefined;
  const matchingRuntime=typeof hostManifest.version==='string'&&metadata?.platform===process.platform&&metadata?.arch===process.arch&&metadata.desktopVersion===hostManifest.version&&hostManifest.version===dshManifest.version;
  // Packaged Desktop supplies a public launcher outside ASAR. Invoke that launcher unchanged;
  // standalone Node cannot import the archived CLI, and the launcher owns Electron's boot details.
  let desktopLauncher;
  const resources=dirname(dirname(runtimeDir));
  if(matchingRuntime&&runtimeDir===join(resources,'app.asar','dsh')&&payload===join(resources,'runtime','primary-runtime')&&basename(dirname(profileDir))==='profiles'){
    // Upstream ships a POSIX launcher on macOS. Windows' .cmd needs a separately verified carrier;
    // Linux has no official packaged Desktop launcher. Both stay explicitly unavailable here.
    if(process.platform==='darwin')try{const command=join(resources,'runtime','cli','bin','dsh');await access(command,constants.X_OK);desktopLauncher={command:await realpath(command),home:await realpath(dirname(dirname(profileDir)))};}catch{}
  }
  const managerManifest=await json(join(runtimeDir,'node_modules/@deepseek-ai/dsh-plugin-manager/package.json'));
  const pluginManagerVersion=managerManifest?.name==='@deepseek-ai/dsh-plugin-manager'&&managerManifest.version===hostManifest.version?managerManifest.version:undefined;
  const pluginManagerRegistry=pluginManagerVersion?await desktopRegistryPath(join(runtimeDir,'node_modules/@deepseek-ai/dsh-plugin-manager'),managerManifest):undefined;
  // Current canonical runtime manifest only. No legacy descriptor inference or PATH search.
  if(metadata?.platform===process.platform&&metadata?.arch===process.arch&&
    metadata.desktopVersion===(await json(join(hostRoot,'package.json')))?.version&&/^24\.\d+\.\d+$/.test(metadata.node??'')) {
    const node=join(payload,'dependencies/node/bin',process.platform==='win32'?'node.exe':'node');
    try {
      await access(node,constants.X_OK);
      const {stdout}=await promisify(execFile)(node,['-p','JSON.stringify({node:process.versions.node,electron:process.versions.electron})'],{timeout:1000,env:{},maxBuffer:1024});
      const actual=JSON.parse(stdout);
      if(actual.node===metadata.node&&actual.electron===undefined)nodeBinary=await realpath(node);
    } catch { /* Unavailable/unproven payload Node stays unavailable; never use Electron. */ }
  }
  return {profileDir:await realpath(profileDir),profileName:'desktop',dshBin,parentOrigin:'dsh-app://app',frameAncestors:[],desktopCli,desktopLauncher,pluginManagerVersion,pluginManagerRegistry,nodeBinary,runtimeDir};
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
export async function resolveLibraryLocations(config={},{moduleUrl=import.meta.url,argv=process.argv,execPath=process.execPath,versions=process.versions,nodeBinary,desktop}={}){
  desktop ??= await inferDesktopLayout({moduleUrl,argv});
  const inferred=[];
  let profileDir=config.profileDir;if(profileDir===undefined){profileDir=desktop?.profileDir??await inferProfileDir(moduleUrl);if(profileDir)inferred.push('profileDir');}
  let profileName=config.profileName;if(profileName===undefined&&profileDir){profileName=desktop?.profileDir===profileDir?desktop.profileName:basename(profileDir);inferred.push('profileName');}
  let dshBin=config.dshBin;if(dshBin===undefined){dshBin=desktop?.dshBin??inferDshBin(argv);if(dshBin)inferred.push('dshBin');}
  let node=nodeBinary;if(node===undefined){node=desktop?.nodeBinary??inferNodeBinary({execPath,versions});if(node)inferred.push('nodeBinary');}
  let sources=config.sources;if(sources===undefined){sources=structuredClone(DEFAULT_CATALOG_SOURCES);inferred.push('sources');}
  const {pluginManagerVersion,pluginManagerRegistry}=desktop??await pluginManagerFacts(inferDshBin(argv)??(profileDir?join(profileDir,'package.json'):undefined));
  return{profileDir,profileName,dshBin,nodeBinary:node,sources,inferred,...(pluginManagerVersion?{pluginManagerVersion}:{}),...(pluginManagerRegistry?{pluginManagerRegistry}:{}),...(desktop&&desktop.profileDir===profileDir&&config.dshBin===undefined?{desktopCli:desktop.desktopCli,desktopLauncher:desktop.desktopLauncher}:{})};
}
