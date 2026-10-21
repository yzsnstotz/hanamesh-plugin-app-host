import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,chmod,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inferDesktopLayout} from '../src/library/locate.js';
import {createLibraryInstaller} from '../src/library/install.js';
import {createLibraryService} from '../src/library/service.js';
import {temporary} from './helpers.mjs';
import {validateDshPins} from '../scripts/dsh-policy.mjs';

const item={id:'example.notes',package:{registry:'npm',name:'example-notes'}};
async function fixture(t,version='0.2.0-rc.2'){
  const root=await temporary();t.after(()=>rm(root,{recursive:true,force:true}));
  const resources=join(root,'DeepSeek Harness.app/Contents/Resources'),runtimeDir=join(resources,'app.asar/dsh');
  const home=join(root,'隔离 home'),profileDir=join(home,'profiles/desktop'),payload=join(resources,'runtime/primary-runtime');
  const host=join(runtimeDir,'node_modules/@deepseek-ai/dsh-desktop-host'),dsh=join(runtimeDir,'node_modules/@deepseek-ai/dsh');
  const own=join(profileDir,'node_modules/@hanamesh/dsh-app-host'),launcher=join(resources,'runtime/cli/bin/dsh');
  for(const [dir,name] of [[host,'@deepseek-ai/dsh-desktop-host'],[dsh,'@deepseek-ai/dsh'],[join(runtimeDir,'node_modules/@deepseek-ai/dsh-plugin-manager'),'@deepseek-ai/dsh-plugin-manager'],[own,'@hanamesh/dsh-app-host']]){
    await mkdir(join(dir,'lib'),{recursive:true});await writeFile(join(dir,'package.json'),JSON.stringify({name,version}));
  }
  await writeFile(join(profileDir,'package.json'),JSON.stringify({dependencies:{'@hanamesh/dsh-app-host':'0.6.2'},dsh:{profile:{bundles:['@hanamesh/dsh-app-host']}}}));
  const entry=join(host,'lib/index.js');await writeFile(entry,'');await writeFile(join(dsh,'lib/bin.js'),'');
  await mkdir(payload,{recursive:true});await writeFile(join(payload,'runtime.json'),JSON.stringify({desktopVersion:version,platform:process.platform,arch:process.arch,node:process.versions.node}));
  await mkdir(join(launcher,'..'),{recursive:true});await writeFile(launcher,'#!/bin/sh\nexit 0\n');await chmod(launcher,0o755);
  const desktop=await inferDesktopLayout({moduleUrl:pathToFileURL(join(own,'lib/dsh.js')).href,argv:[process.execPath,entry,runtimeDir,profileDir,payload]});
  return{root,home,profileDir,launcher,desktop,host,runtimeDir,payload,entry,own};
}
async function writeInstalled(profile,name,version){
  const pkg=JSON.parse(await readFile(join(profile,'package.json'),'utf8'));pkg.dependencies[name]=version;
  await writeFile(join(profile,'package.json'),JSON.stringify(pkg));await mkdir(join(profile,'node_modules',name),{recursive:true});
  await writeFile(join(profile,'node_modules',name,'package.json'),JSON.stringify({name,version,dsh:{bundle:{patch:'./p.yml'}}}));
}
const registry=async()=>new Response(JSON.stringify({version:'1.2.3'}));

test('official rc.2 ASAR layout proves the shipped public launcher, profile home, and actual manager version',async t=>{
  const h=await fixture(t);assert.equal(h.desktop.pluginManagerVersion,'0.2.0-rc.2');
  assert.deepEqual(h.desktop.desktopLauncher,{command:h.launcher,home:h.home});
  assert.equal(h.desktop.desktopCli,undefined,'standalone Node cannot import inside ASAR');
  await chmod(h.launcher,0o644);
  const unavailable=await inferDesktopLayout({moduleUrl:pathToFileURL(join(h.own,'lib/dsh.js')).href,argv:[process.execPath,h.entry,h.runtimeDir,h.profileDir,h.payload]});
  assert.equal(unavailable.desktopLauncher,undefined,'unexecutable public launcher is unavailable');
  const managerManifest=join(h.runtimeDir,'node_modules/@deepseek-ai/dsh-plugin-manager/package.json');
  await writeFile(managerManifest,JSON.stringify({name:'@deepseek-ai/dsh-plugin-manager',version:'0.2.1-alpha.2'}));
  const mismatch=await inferDesktopLayout({moduleUrl:pathToFileURL(join(h.own,'lib/dsh.js')).href,argv:[process.execPath,h.entry,h.runtimeDir,h.profileDir,h.payload]});
  assert.equal(mismatch.pluginManagerVersion,undefined,'a different package version cannot certify the running runtime manager');
});

for(const [dsh,cordis,schema,accepted] of [['0.2.0-rc.2','4.0.4','3.18.4',true],['0.2.1-alpha.2','4.0.5-alpha.1','3.18.5-alpha.1',true],['0.3.0-alpha.1','4.0.4','3.18.4',false],['0.2.0-rc.1','4.0.4','3.18.4',false]])test(`source preflight inspects public packages without executing dsh: ${dsh}`,async t=>{
  const root=await temporary();t.after(()=>rm(root,{recursive:true,force:true}));await writeFile(join(root,'package.json'),'{}');
  for(const [name,version] of [['dsh',dsh],['dsh-storage-domain',dsh],['cordis',cordis],['schemastery',schema]]){
    const dir=join(root,'node_modules/@deepseek-ai',name);await mkdir(dir,{recursive:true});await writeFile(join(dir,'package.json'),JSON.stringify({name:'@deepseek-ai/'+name,version}));
  }
  const prior=console.log;console.log=()=>{};
  try{if(accepted)assert.doesNotThrow(()=>validateDshPins({root}));else assert.throws(()=>validateDshPins({root}),/DSH_COMPAT_MISMATCH/);}finally{console.log=prior;}
});

test('rc.2 manager is bypassed before mutation; public launcher pins exact version and reports restart-required',async t=>{
  const h=await fixture(t),calls=[];
  const manager={async installBundle(){calls.push('unsupported-manager');throw new Error('rc.2 cannot saveExact');},async removeBundle(){}};
  const installer=createLibraryInstaller({profileDir:h.profileDir,profileName:'desktop',dataRoot:join(h.root,'data'),pluginManager:()=>manager,
    pluginManagerVersion:h.desktop.pluginManagerVersion,desktopLauncher:h.desktop.desktopLauncher,fetchImpl:registry,
    spawn:async(command,args,options)=>{calls.push({command,args,options});await writeInstalled(h.profileDir,'example-notes','1.2.3');return{code:0};}});
  assert.equal(installer.ready,true);assert.equal(installer.live,false);
  assert.deepEqual(await installer.install(item),{status:'restart-required',kind:'plugin',packageName:'example-notes',version:'1.2.3'});
  assert.equal(calls.length,1);assert.equal(calls[0].command,h.launcher);
  assert.deepEqual(calls[0].args,['plugin','--profile','desktop','add','--save-exact','example-notes@1.2.3']);
  assert.equal(calls[0].options.env.DSH_HOME,h.home);assert.equal(calls[0].options.env.HOME,process.env.HOME);
  assert.equal(calls[0].options.env.ELECTRON_RUN_AS_NODE,undefined,'only the upstream public launcher owns its boot environment');
});

for(const version of ['0.2.0-rc.2',undefined])test(`manager ${version??'unknown'} without CLI refuses before any profile mutation and exposes the missing feature`,async t=>{
  const h=await fixture(t),before=await readFile(join(h.profileDir,'package.json'),'utf8');let calls=0;
  const installer=createLibraryInstaller({profileDir:h.profileDir,profileName:'desktop',dataRoot:join(h.root,'data'),pluginManagerVersion:version,
    pluginManager:()=>({async installBundle(){calls++;},async removeBundle(){calls++;}}),fetchImpl:registry});
  assert.equal(installer.ready,false);assert.equal(installer.live,false);
  await assert.rejects(installer.install(item),error=>error.code==='DSH_EXACT_INSTALL_UNAVAILABLE'&&error.details.need.some(row=>/精确版本/.test(row.need)));
  assert.equal(calls,0);assert.equal(await readFile(join(h.profileDir,'package.json'),'utf8'),before);
  const library=createLibraryService({domain:{global:{get:()=>({schema:1,revision:0,sources:[]}),set:async()=>{}},close:async()=>{}},host:{},dataRoot:h.root,config:{profileDir:h.profileDir},installer,unavailable:()=>installer.unavailable});
  await library.init();const probe=library.installTarget();assert.equal(probe.ready,false);assert.match(probe.error.message,/精确版本/);assert.ok(probe.error.need.length);await library.close();
});

test('alpha.2 manager also uses monitored public CLI instead of an unscoped live install',async t=>{
  const h=await fixture(t,'0.2.1-alpha.2');let managerCalls=0,cliCalls=0;
  const installer=createLibraryInstaller({profileDir:h.profileDir,profileName:'desktop',dataRoot:join(h.root,'data'),pluginManagerVersion:h.desktop.pluginManagerVersion,
    pluginManager:()=>({async installBundle(){managerCalls++;},async removeBundle(){managerCalls++;}}),desktopLauncher:h.desktop.desktopLauncher,fetchImpl:registry,
    spawn:async()=>{cliCalls++;await writeInstalled(h.profileDir,'example-notes','1.2.3');return{code:0};}});
  assert.equal(installer.live,false);assert.equal((await installer.install(item)).status,'restart-required');assert.equal(managerCalls,0);assert.equal(cliCalls,1);
});

test('public peers admit official rc.2 and supported alpha peers while development versions remain pinned',async()=>{
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(pkg.version,'0.6.10');
  assert.equal(pkg.peerDependencies['@deepseek-ai/dsh-storage-domain'],'>=0.2.0-rc.2 <0.3.0-0 || >=0.2.1-0 <0.3.0-0');
  assert.equal(pkg.peerDependencies['@deepseek-ai/cordis'],'>=4.0.4 <4.1.0-0 || >=4.0.5-alpha.1 <4.1.0-0');
  assert.equal(pkg.peerDependencies['@deepseek-ai/schemastery'],'>=3.18.4 <3.19.0-0 || >=3.18.5-alpha.1 <3.19.0-0');
  assert.equal(pkg.peerDependencies.react,'^18.3.1');
  assert.equal(pkg.devDependencies['@deepseek-ai/dsh-storage-domain'],'0.2.1-alpha.2');
});
