/**
 * rc.28 · HanaMesh market: plugins and applications install through the same `dsh plugin add/remove` path,
 * the installed list includes plugins (profile package.json dependencies), upgrade = catalog latestVersion
 * newer than the installed version, restart states come from the boot-time dependency snapshot, and
 * malformed provision/uninstall input answers 400 (LIB-PROVISION-INPUT). Real temp profiles; the DSH CLI
 * is a recorded spawn double (the real CLI is exercised by the acceptance gate in docs/acceptance/).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, realpath, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createLibraryInstaller, PROTECTED_PACKAGES } from '../src/library/install.js';
import { scanInstalledPlugins, snapshotProfileDependencies, readProfileManifest } from '../src/library/installed.js';
import { createLibraryService } from '../src/library/service.js';
import { createLibraryHttpHandler, LIBRARY_ROUTES } from '../src/library/routes.js';
import { compareVersions, upgradeAvailable, itemKind } from '../src/library/catalog.js';
import { http, until } from './helpers.mjs';

const fixture=resolve('tests/fixtures/catalog/provider-page.json');
const appDefinition={id:'vibe',name:'Vibe',singleInstanceOnly:true,deployments:[{id:'local',dataId:'data-v1',mode:'owned',command:'/bin/sh',args:['-c','exec','{{dataDir}}','{{port}}'],env:{},envAllowlist:[],readiness:{path:'/',status:200,bodyIncludes:'Vibe'}}]};
async function profileFixture(t,{dependencies,bundles=['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app'],packages={}}){
  const root=await realpath(await mkdtemp(join(tmpdir(),'hm-market-')));t.after(()=>rm(root,{recursive:true,force:true}));
  const profile=join(root,'profiles','web');await mkdir(profile,{recursive:true});
  await writeFile(join(profile,'package.json'),JSON.stringify({name:'dsh-profile-web',private:true,dependencies,dsh:{profile:{bundles}}}));
  for(const[name,pkg]of Object.entries(packages)){const dir=join(profile,'node_modules',...name.split('/'));await mkdir(dir,{recursive:true});await writeFile(join(dir,'package.json'),JSON.stringify({name,...pkg}));if(pkg.hanamesh?.app)await writeFile(join(dir,'app.json'),JSON.stringify(appDefinition));}
  return{root,profile,dataRoot:join(root,'data')};
}
function installerDouble(profile,{calls=[],events=[],latest='1.0.0'}={}){
  return{calls,events,installer:createLibraryInstaller({profileDir:profile.profile,profileName:'web',dataRoot:profile.dataRoot,nodeBinary:'/opt/node/bin/node',dshBin:'/opt/dsh/lib/bin.js',
    fetchImpl:async url=>{calls.push({fetch:String(url)});return new Response(JSON.stringify({version:latest}),{headers:{'content-type':'application/json'}});},
    spawn:async(command,args,options)=>{calls.push({command,args,options});return{code:0,stdout:'',stderr:''};},
    provision:async()=>{throw new Error('a plugin never provisions a runtime');},remove:async()=>{throw new Error('a plugin has no owned runtime');},emit:event=>events.push(event)})};
}
const plugin={id:'27a67a57',name:'dsh-plugin-tether',displayName:'dsh-tether',summary:'s',latestVersion:'0.1.17',categories:['remote'],package:{registry:'npm',name:'dsh-plugin-tether'},publisher:{name:'zexadev'}};

test('AH-M01: a catalog plugin installs through the same `dsh plugin add --save-exact` path as an application, reads no app.json and provisions nothing',async t=>{
  const profile=await profileFixture(t,{dependencies:{}});const{calls,events,installer}=installerDouble(profile,{latest:'0.1.17'});
  assert.equal(itemKind(plugin),'plugin');
  const result=await installer.install(plugin);
  assert.deepEqual(result,{status:'restart-required',kind:'plugin',packageName:'dsh-plugin-tether',version:'0.1.17'});
  assert.match(calls[0].fetch,/\/dsh-plugin-tether\/latest$/);
  assert.deepEqual(calls[1],{command:'/opt/node/bin/node',args:['/opt/dsh/lib/bin.js','plugin','--profile','web','add','--save-exact','dsh-plugin-tether@0.1.17'],options:{cwd:profile.profile}});
  assert.equal(calls.length,2);
  assert.deepEqual(events.map(event=>event.type),['library.install-started','library.install-done']);
  assert.equal(events[1].kind,'plugin');
  // By package name (the rc.28 plugins/install seat) — identical command.
  const byName=await installer.installPlugin({packageName:'dsh-plugin-tether'});
  assert.equal(byName.version,'0.1.17');assert.deepEqual(calls[3].args.slice(-2),['--save-exact','dsh-plugin-tether@0.1.17']);
  // Repository-only entries stay browse-only.
  await assert.rejects(installer.install({id:'r',name:'r',displayName:'r',summary:'s',categories:['tools'],repository:{url:'https://example.com'}}),{code:'NOT_INSTALLABLE'});
});

test('AH-M02: plugin uninstall is `dsh plugin remove <name>`; the HanaMesh suite itself is refused both ways (PACKAGE_DENIED)',async t=>{
  const profile=await profileFixture(t,{dependencies:{}});const{calls,installer}=installerDouble(profile);
  const result=await installer.uninstallPlugin({packageName:'dsh-plugin-tether'});
  assert.deepEqual(result,{status:'restart-required',kind:'plugin',packageName:'dsh-plugin-tether'});
  assert.deepEqual(calls[0].args,['/opt/dsh/lib/bin.js','plugin','--profile','web','remove','dsh-plugin-tether']);
  assert.deepEqual([...PROTECTED_PACKAGES].sort(),['@hanamesh/dsh-app-host','@hanamesh/dsh-core','@hanamesh/dsh-usage','hanamesh-core','hanamesh-usage']);
  for(const name of ['hanamesh-core','hanamesh-usage','@hanamesh/dsh-app-host']){
    await assert.rejects(installer.uninstallPlugin({packageName:name}),{code:'PACKAGE_DENIED'});
    await assert.rejects(installer.installPlugin({packageName:name}),{code:'PACKAGE_DENIED'});
    await assert.rejects(installer.install({...plugin,package:{registry:'npm',name}}),{code:'PACKAGE_DENIED'});
  }
  for(const name of ['../escape','Not-Lower','']){await assert.rejects(installer.uninstallPlugin({packageName:name}),{code:'PACKAGE_DENIED'});}
  assert.equal(calls.length,1,'no DSH command ran for a refused name');
});

test('AH-M03: installed plugins = profile dependencies minus application packages, with restart states from the boot snapshot',async t=>{
  const profile=await profileFixture(t,{dependencies:{'hanamesh-core':'0.2.0-rc.27','dsh-plugin-tether':'0.1.17','@hanamesh/app-vibe-trading':'0.1.0','ghost-plugin':'1.0.0'},bundles:['@deepseek-ai/dsh-base','hanamesh-core'],
    packages:{'hanamesh-core':{version:'0.2.0-rc.27',dsh:{bundle:{patch:'./profile/cordis.patch.yml'}}},'dsh-plugin-tether':{version:'0.1.17',dsh:{bundle:{patch:'./p.yml'}}},'@hanamesh/app-vibe-trading':{version:'0.1.0',hanamesh:{app:'app.json'}},'some-lib':{version:'2.0.0'}}});
  const boot=await snapshotProfileDependencies(profile.profile);
  assert.deepEqual(boot,{'hanamesh-core':{version:'0.2.0-rc.27',application:false,bundle:true},'dsh-plugin-tether':{version:'0.1.17',application:false,bundle:true},'@hanamesh/app-vibe-trading':{version:'0.1.0',application:true,bundle:false},'ghost-plugin':{version:null,application:false,bundle:false}});
  // Simulate what `dsh plugin` does after boot: tether removed, some-lib added (already on disk), ghost stays unreadable.
  const manifest=JSON.parse(await readFile(join(profile.profile,'package.json'),'utf8'));delete manifest.dependencies['dsh-plugin-tether'];manifest.dependencies['some-lib']='2.0.0';manifest.dsh.profile.bundles=['@deepseek-ai/dsh-base','hanamesh-core'];
  await writeFile(join(profile.profile,'package.json'),JSON.stringify(manifest));
  const rows=await scanInstalledPlugins({profileDir:profile.profile,bootDependencies:boot});
  assert.deepEqual(rows.map(row=>[row.packageName,row.state,row.version,row.bundle,row.active]),[
    ['dsh-plugin-tether','uninstalled-not-unloaded','0.1.17',true,false],
    ['ghost-plugin','invalid',null,false,false],
    ['hanamesh-core','installed','0.2.0-rc.27',true,true],
    ['some-lib','installed-not-loaded','2.0.0',false,false],
  ]);
  assert.ok(rows.every(row=>row.kind==='plugin'&&row.packageName!=='@hanamesh/app-vibe-trading'),'application packages are not plugins');
  assert.deepEqual((await readProfileManifest(profile.profile)).bundles,['@deepseek-ai/dsh-base','hanamesh-core']);
  // Without a snapshot everything present counts as loaded.
  assert.ok((await scanInstalledPlugins({profileDir:profile.profile})).every(row=>row.state!=='installed-not-loaded'||row.packageName==='some-lib'));
  await assert.rejects(scanInstalledPlugins({profileDir:'relative/path'}),{code:'PROFILE_DIR_REQUIRED'});
});

test('AH-M04: upgrade = catalog latestVersion strictly newer than the installed version (semver, prerelease below release)',()=>{
  assert.equal(compareVersions('0.1.17','0.1.16'),1);assert.equal(compareVersions('0.1.16','0.1.17'),-1);assert.equal(compareVersions('1.0.0','1.0.0'),0);
  assert.equal(compareVersions('1.0.0-rc.2','1.0.0'),-1);assert.equal(compareVersions('1.0.0-rc.10','1.0.0-rc.9'),1);assert.equal(compareVersions('1.0.0-beta','1.0.0-alpha'),1);
  assert.equal(compareVersions('v2.0.0','1.9.9'),1);assert.equal(compareVersions('garbage','1.0.0'),0);
  assert.equal(upgradeAvailable('1.0.0','0.9.0'),true);assert.equal(upgradeAvailable('1.0.0','1.0.0'),false);assert.equal(upgradeAvailable('0.0.0','0.1.0'),false);assert.equal(upgradeAvailable(undefined,'0.1.0'),false);
});

test('AH-M05: the market listing annotates every entry with kind / installed row / upgradeAvailable, lists categories, installed plugins and restartRequired',async t=>{
  // Fixture catalog: Vibe (application, 0.1.0), repository-only (listing), utility-plugin (plugin, 1.0.0).
  const profile=await profileFixture(t,{dependencies:{'@hanamesh/app-vibe-trading':'0.1.0','@hanamesh/utility-plugin':'0.9.0'},
    packages:{'@hanamesh/app-vibe-trading':{version:'0.1.0',hanamesh:{app:'app.json'}},'@hanamesh/utility-plugin':{version:'0.9.0',dsh:{bundle:{patch:'./p.yml'}}}}});
  let state={schema:1,revision:0,sources:[]};const domain={global:{get:async()=>structuredClone(state),set:async next=>{state=structuredClone(next);}},close:async()=>{}};
  const host={list:()=>({apps:[{id:'vibe'}]}),instanceList:()=>[]};
  const service=await createLibraryService({domain,host,config:{fixture,profileDir:profile.profile},dataRoot:profile.dataRoot,ledgerReader:async()=>({schema:1,items:{}})}).init();
  const page=await service.list({category:''});
  const byId=Object.fromEntries(page.items.map(item=>[item.id,item]));
  assert.equal(byId['com.hanamesh.vibe-trading'].kind,'application');assert.equal(byId['com.hanamesh.vibe-trading'].installed.state,'registered');assert.equal(byId['com.hanamesh.vibe-trading'].upgradeAvailable,false);
  assert.equal(byId['com.example.repository-only'].kind,'listing');assert.equal(byId['com.example.repository-only'].installed,null);
  assert.equal(byId['com.hanamesh.utility-plugin'].kind,'plugin');assert.equal(byId['com.hanamesh.utility-plugin'].installed.state,'installed');assert.equal(byId['com.hanamesh.utility-plugin'].installed.version,'0.9.0');
  assert.equal(byId['com.hanamesh.utility-plugin'].upgradeAvailable,true,'0.9.0 installed, catalog latestVersion 1.0.0');
  assert.deepEqual(page.categories,['finance','hanamesh-app','utility']);
  assert.deepEqual(page.plugins.map(row=>row.packageName),['@hanamesh/utility-plugin']);
  assert.deepEqual(page.installed.map(row=>row.packageName),['@hanamesh/app-vibe-trading']);
  assert.equal(page.restartRequired,false);
  // A plugin added after boot flips restartRequired and shows as installed-not-loaded (no upgrade offered while it waits for a restart).
  const manifest=JSON.parse(await readFile(join(profile.profile,'package.json'),'utf8'));manifest.dependencies['dsh-plugin-tether']='0.1.17';await writeFile(join(profile.profile,'package.json'),JSON.stringify(manifest));
  await mkdir(join(profile.profile,'node_modules','dsh-plugin-tether'),{recursive:true});await writeFile(join(profile.profile,'node_modules','dsh-plugin-tether','package.json'),JSON.stringify({name:'dsh-plugin-tether',version:'0.1.17'}));
  const snapshot=await service.installedSnapshot();
  assert.equal(snapshot.restartRequired,true);assert.deepEqual(snapshot.plugins.map(row=>[row.packageName,row.state]),[['@hanamesh/utility-plugin','installed'],['dsh-plugin-tether','installed-not-loaded']]);
  assert.deepEqual(snapshot.apps.map(row=>row.appId),['vibe']);
});

test('AH-M06 (LIB-PROVISION-INPUT): missing or malformed provision / uninstall / plugin fields answer 400 INVALID_INPUT before any operation starts; installedPlugins and the plugin routes are served',async t=>{
  const profile=await profileFixture(t,{dependencies:{'dsh-plugin-tether':'0.1.17'},packages:{'dsh-plugin-tether':{version:'0.1.17'}}});
  const{calls,installer}=installerDouble(profile);
  let state={schema:1,revision:0,sources:[]};const domain={global:{get:async()=>structuredClone(state),set:async next=>{state=structuredClone(next);}},close:async()=>{}};
  const host={list:()=>({apps:[]}),instanceList:()=>[]};
  const service=await createLibraryService({domain,host,config:{fixture,profileDir:profile.profile},dataRoot:profile.dataRoot,ledgerReader:async()=>({schema:1,items:{}}),installer}).init();
  for(const input of [undefined,{},{appId:'vibe'},{appId:'vibe',packageName:'@hanamesh/app-vibe-trading'},{appId:'vibe',packageName:'Bad Name',runtimeItem:'runtime'},{appId:5,packageName:'x',runtimeItem:'r'}])
    await assert.rejects(service.provision(input),error=>error.code==='INVALID_INPUT'&&error.status===400);
  for(const input of [undefined,{},{packageName:'x'},{appId:'vibe'},{appId:'vibe',packageName:'x',runtimeItem:7}])
    await assert.rejects(service.uninstall(input),error=>error.code==='INVALID_INPUT'&&error.status===400);
  for(const input of [undefined,{},{packageName:''},{packageName:'../x'}]){
    await assert.rejects(service.installPlugin(input),error=>error.code==='INVALID_INPUT'&&error.status===400);
    await assert.rejects(service.uninstallPlugin(input),error=>error.code==='INVALID_INPUT'&&error.status===400);
  }
  await assert.rejects(service.install({}),error=>error.code==='INVALID_INPUT'&&error.status===400);
  // The suite itself is refused synchronously (403) before an operation is even started (the installer guard remains the last line).
  for(const name of ['hanamesh-core','@hanamesh/dsh-app-host']){await assert.rejects(service.installPlugin({packageName:name}),error=>error.code==='PACKAGE_DENIED'&&error.status===403);await assert.rejects(service.uninstallPlugin({packageName:name}),error=>error.code==='PACKAGE_DENIED'&&error.status===403);}
  assert.equal(calls.length,0,'nothing reached the DSH CLI');
  assert.equal(service.events().events.length,0,'no operation was started for a rejected input');
  // A plugin the catalog does not list is refused (404), a listed one starts the operation.
  await assert.rejects(service.installPlugin({packageName:'not-in-catalog'}),{code:'CATALOG_ITEM_MISSING'});
  const started=await service.installPlugin({packageName:'@hanamesh/utility-plugin'});assert.equal(started.status,'started');
  await until(()=>service.events().events.some(event=>event.type==='library.install-done'&&event.operationId===started.operationId));
  assert.deepEqual(calls.at(-1).args.slice(-2),['--save-exact','@hanamesh/utility-plugin@1.0.0']);
  const removed=await service.uninstallPlugin({packageName:'dsh-plugin-tether'});
  await until(()=>service.events().events.some(event=>event.type==='library.uninstall-done'&&event.operationId===removed.operationId));
  assert.deepEqual(calls.at(-1).args.slice(-2),['remove','dsh-plugin-tether']);

  // The same through the HTTP handler: real loopback server, auth doubles, the app-host CSRF chain.
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  server.on('request',createLibraryHttpHandler(service,{parentOrigin:origin,authenticate:async()=>({principalId:'dsh-browser'}),authorize:async()=>true}));
  const headers={origin,'content-type':'application/json','x-hanamesh-client':'workspace-v1'};
  const provision=await http(origin+'/hanamesh/library/provision',{method:'POST',headers,body:JSON.stringify({appId:'vibe'})});
  assert.equal(provision.status,400,JSON.stringify(provision.json));assert.equal(provision.json.error.code,'INVALID_INPUT');
  const uninstall=await http(origin+'/hanamesh/library/uninstall',{method:'POST',headers,body:'{}'});
  assert.equal(uninstall.status,400);assert.equal(uninstall.json.error.code,'INVALID_INPUT');
  const pluginUninstall=await http(origin+'/hanamesh/library/plugins/uninstall',{method:'POST',headers,body:'{}'});
  assert.equal(pluginUninstall.status,400);assert.equal(pluginUninstall.json.error.code,'INVALID_INPUT');
  const list=await http(origin+'/hanamesh/library/installedPlugins',{headers:{origin}});
  assert.equal(list.status,200,JSON.stringify(list.json));assert.deepEqual(Object.keys(list.json).sort(),['apps','plugins','restartRequired','traceId']);
  assert.deepEqual(list.json.plugins.map(row=>[row.packageName,row.state]),[['dsh-plugin-tether','installed']]);
  const wrongMethod=await http(origin+'/hanamesh/library/installedPlugins',{method:'POST',headers,body:'{}'});assert.equal(wrongMethod.status,405);assert.equal(wrongMethod.json.error.code,'METHOD_NOT_ALLOWED');
  const extraParams=await http(origin+'/hanamesh/library/installedPlugins?x=1',{headers:{origin}});assert.equal(extraParams.status,400);assert.equal(extraParams.json.error.code,'UNKNOWN_FIELDS');
  const accepted=await http(origin+'/hanamesh/library/plugins/install',{method:'POST',headers,body:JSON.stringify({packageName:'@hanamesh/utility-plugin'})});
  assert.equal(accepted.status,202,JSON.stringify(accepted.json));assert.equal(accepted.json.status,'started');
  assert.deepEqual(LIBRARY_ROUTES.slice(0,6),['/hanamesh/library','/hanamesh/library/sources','/hanamesh/library/install','/hanamesh/library/provision','/hanamesh/library/uninstall','/hanamesh/library/events'],'older routes are kept in place');
  await service.close();
});

test('AH-M07 (client source): the entry is 「市场」, cards carry kind/state/upgrade, and a plugin change shows 「需重启 DSH」 with the hanamesh://restart deep link only inside the shell',async()=>{
  const source=await readFile(new URL('../src/client-ui.js',import.meta.url),'utf8');
  assert.match(source,/onClick:\(\)=>setLibraryVisible\(true\)},'市场'\)/,'sidebar entry');
  assert.match(source,/h\('h1',null,'HanaMesh 市场'\)/,'overlay title');
  assert.match(source,/label:'市场目录源'/,'settings section');
  assert.match(source,/const RESTART_LINK='hanamesh:\/\/restart'/);
  assert.match(source,/shell\?h\('a',\{href:RESTART_LINK/,'deep link only when framed by the shell');
  assert.match(source,/'请手动重启 DSH。'/,'plain DSH: text only');
  assert.match(source,/'data-hanamesh-restart':'required'/);
  assert.match(source,/\['','全部'\],\['hanamesh-app','应用'\],\['plugin','插件'\]/,'fixed filters');
  assert.match(source,/seenCategories/,'catalog categories join the filter');
  assert.match(source,/'\/hanamesh\/library\/plugins\/uninstall'/);
  assert.match(source,/item\.upgradeAvailable\)action=/,'upgrade action');
  assert.match(source,/'升级到 '\+item\.latestVersion/);
  assert.match(source,/'installed-not-loaded':'需重启'/);
  assert.match(source,/const PROTECTED=new Set\(\['@hanamesh\/dsh-app-host','hanamesh-core','hanamesh-usage'\]\)/,'no uninstall button for the suite');
  assert.doesNotMatch(source,/ctx\.get\(/,'the browser bundle never reads host services');
});
