/**
 * rc.26 · library locations on plain DSH (no desktop overlay). Real temp directories, real symlinks;
 * process facts (argv, execPath, versions) are passed in explicitly so nothing here depends on the runner.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, realpath, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { DEFAULT_CATALOG_SOURCES, inferDshBin, inferNodeBinary, inferProfileDir, resolveLibraryLocations } from '../src/library/locate.js';
import { createLibraryService } from '../src/library/service.js';
import { scanInstalled } from '../src/library/installed.js';

const HANAMESH_SOURCE='https://market.hanamesh.com/catalog-source.json';
const argvDsh=['/opt/node/bin/node','/home/u/.dsh/node_modules/@deepseek-ai/dsh/lib/bin.js','--profile','web'];

/** A `dsh plugin add` profile: package.json written by `dsh plugin`, hoisted node_modules, this package inside. */
async function profileFixture(t,{link=false,manifest}={}){
  const root=await realpath(await mkdtemp(join(tmpdir(),'hm-locate-')));t.after(()=>rm(root,{recursive:true,force:true}));
  const profile=join(root,'profiles','suite');await mkdir(join(profile,'node_modules','@hanamesh'),{recursive:true});
  await writeFile(join(profile,'package.json'),JSON.stringify(manifest??{name:'dsh-profile-suite',private:true,dependencies:{'hanamesh-core':'0.2.0-rc.27','@hanamesh/app-vibe-trading':'0.1.0-rc.22'},dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app','hanamesh-core']}}}));
  let pkg=join(profile,'node_modules','@hanamesh','dsh-app-host');
  // pnpm isolated layout: the real files live in the profile's own `.pnpm` store, the hoisted name is a symlink.
  if(link){const store=join(profile,'node_modules','.pnpm','@hanamesh+dsh-app-host@0.1.0-rc.26','node_modules','@hanamesh','dsh-app-host');await mkdir(store,{recursive:true});await symlink(store,pkg,'dir');pkg=store;}
  else await mkdir(pkg,{recursive:true});
  await mkdir(join(pkg,'dist'),{recursive:true});
  await writeFile(join(pkg,'package.json'),JSON.stringify({name:'@hanamesh/dsh-app-host',version:'0.1.0-rc.26'}));
  await writeFile(join(pkg,'dist','dsh.js'),'export {};\n');
  return{root,profile,moduleUrl:pathToFileURL(join(pkg,'dist','dsh.js')).href};
}
function domainDouble(initial={schema:1,revision:0,sources:[]}){let state=structuredClone(initial);return{global:{get:async()=>structuredClone(state),set:async next=>{state=structuredClone(next);}},close:async()=>{},state:()=>state};}

test('AH-L07: library.sources unset → the HanaMesh catalog source is seeded; an explicit [] stays empty',async()=>{
  const unset=await resolveLibraryLocations({},{moduleUrl:import.meta.url,argv:['node','x.js'],execPath:process.execPath,versions:{}});
  assert.deepEqual(unset.sources,[{manifestUrl:HANAMESH_SOURCE,enabled:true}]);assert.ok(unset.inferred.includes('sources'));
  assert.deepEqual(DEFAULT_CATALOG_SOURCES,[{manifestUrl:HANAMESH_SOURCE,enabled:true}]);
  const empty=await resolveLibraryLocations({sources:[]},{moduleUrl:import.meta.url,argv:['node','x.js'],execPath:process.execPath,versions:{}});
  assert.deepEqual(empty.sources,[]);assert.equal(empty.inferred.includes('sources'),false);
  const own=[{manifestUrl:'https://catalog.example.com/catalog-source.json',enabled:true}];
  assert.deepEqual((await resolveLibraryLocations({sources:own},{moduleUrl:import.meta.url,argv:['node','x.js'],versions:{}})).sources,own);
  // First-run seeding in the service is unchanged: it stores whatever resolved.
  const host={list:()=>({apps:[]}),instanceList:()=>[]};
  const seeded=domainDouble();await createLibraryService({domain:seeded,host,config:{sources:unset.sources},dataRoot:'/tmp',ledgerReader:async()=>({schema:1,items:{}})}).init();
  assert.deepEqual(seeded.state().sources,[{manifestUrl:HANAMESH_SOURCE,enabled:true}]);assert.equal(seeded.state().revision,1);
  const none=domainDouble();await createLibraryService({domain:none,host,config:{sources:empty.sources},dataRoot:'/tmp',ledgerReader:async()=>({schema:1,items:{}})}).init();
  assert.deepEqual(none.state().sources,[]);assert.equal(none.state().revision,0);
  // A profile whose storage already holds sources is never re-seeded by the default.
  const kept=domainDouble({schema:1,revision:3,sources:own});await createLibraryService({domain:kept,host,config:{sources:unset.sources},dataRoot:'/tmp',ledgerReader:async()=>({schema:1,items:{}})}).init();
  assert.deepEqual(kept.state().sources,own);
});

test('AH-L08: profileDir/profileName are inferred from the package\'s own real location inside a `dsh plugin` profile',async t=>{
  const hoisted=await profileFixture(t);
  assert.equal(await inferProfileDir(hoisted.moduleUrl),hoisted.profile);
  const resolved=await resolveLibraryLocations({},{moduleUrl:hoisted.moduleUrl,argv:argvDsh,execPath:process.execPath,versions:{}});
  assert.equal(resolved.profileDir,hoisted.profile);assert.equal(resolved.profileName,'suite');
  assert.deepEqual(resolved.inferred.sort(),['dshBin','nodeBinary','profileDir','profileName','sources']);
  // Symlinked store: the profile that LINKS the package is returned, never the `.pnpm` store path (whose own
  // `node_modules/@hanamesh/dsh-app-host` also resolves to the package but has no profile manifest).
  const linked=await profileFixture(t,{link:true});
  assert.ok(linked.moduleUrl.includes('/.pnpm/'));
  assert.equal(await inferProfileDir(linked.moduleUrl),linked.profile);
  assert.equal(basename(await inferProfileDir(linked.moduleUrl)),'suite');
  // A manifest that does not mention hanamesh is not this package's profile.
  const foreign=await profileFixture(t,{manifest:{name:'something',dependencies:{lodash:'1.0.0'}}});
  assert.equal(await inferProfileDir(foreign.moduleUrl),undefined);
  // This repository (src/dsh.js in a checkout, no profile above it) infers nothing.
  assert.equal(await inferProfileDir(new URL('../src/dsh.js',import.meta.url).href),undefined);
  // With the inferred profileDir the installed scan sees a registered CLI-installed app (the O3 stage-4 symptom).
  const vibe=join(hoisted.profile,'node_modules','@hanamesh','app-vibe-trading');await mkdir(vibe,{recursive:true});
  await writeFile(join(vibe,'package.json'),JSON.stringify({name:'@hanamesh/app-vibe-trading',version:'0.1.0-rc.22',hanamesh:{app:'app.json'}}));
  await writeFile(join(vibe,'app.json'),JSON.stringify({id:'vibe-trading',name:'Vibe',singleInstanceOnly:true,deployments:[{id:'local',dataId:'data-v1',mode:'owned',command:'/bin/sh',args:['-c','exec','{{dataDir}}','{{port}}'],env:{},envAllowlist:[],readiness:{path:'/',status:200,bodyIncludes:'vibe'}}]}));
  const rows=await scanInstalled({profileDir:resolved.profileDir,host:{list:()=>({apps:[{id:'vibe-trading'}]})},ledgerReader:async()=>({schema:1,items:{}}),dataRoot:join(hoisted.root,'data')});
  assert.deepEqual(rows.map(row=>[row.packageName,row.state]),[['@hanamesh/app-vibe-trading','registered']]);
});

test('AH-L09: nodeBinary is this process only outside Electron; explicit configuration always wins',async t=>{
  assert.equal(inferNodeBinary({execPath:'/opt/node/bin/node',versions:{node:'24.13.1'}}),'/opt/node/bin/node');
  assert.equal(inferNodeBinary({execPath:'/Applications/X.app/Contents/MacOS/X',versions:{node:'24.13.1',electron:'39.0.0'}}),undefined);
  assert.equal(inferNodeBinary({execPath:'node',versions:{}}),undefined);
  const fixture=await profileFixture(t);
  const electron=await resolveLibraryLocations({},{moduleUrl:fixture.moduleUrl,argv:argvDsh,execPath:'/Applications/X.app/Contents/MacOS/X',versions:{electron:'39.0.0'}});
  assert.equal(electron.nodeBinary,undefined);assert.equal(electron.inferred.includes('nodeBinary'),false);
  const explicit={profileDir:'/srv/shell/profile',profileName:'shell',dshBin:'/srv/shell/dsh/bin.js',sources:[]};
  const resolved=await resolveLibraryLocations(explicit,{moduleUrl:fixture.moduleUrl,argv:argvDsh,execPath:process.execPath,versions:{},nodeBinary:'/srv/shell/node'});
  assert.deepEqual(resolved,{...explicit,nodeBinary:'/srv/shell/node',inferred:[]});
});

test('AH-L10: dshBin is taken from argv[1] only when that script is @deepseek-ai/dsh/lib/bin.js',async()=>{
  assert.equal(inferDshBin(argvDsh),argvDsh[1]);
  assert.equal(inferDshBin(['/opt/node/bin/node','/home/u/tools/dsh/lib/bin.js']),undefined);
  assert.equal(inferDshBin(['/opt/node/bin/node','/home/u/.dsh/node_modules/@deepseek-ai/dsh/lib/bin.js/../evil.js']),undefined);
  assert.equal(inferDshBin(['/opt/node/bin/node','node_modules/@deepseek-ai/dsh/lib/bin.js']),undefined);
  assert.equal(inferDshBin(['/opt/node/bin/node']),undefined);
  assert.equal(inferDshBin(process.argv),undefined,'the test runner is not the DSH CLI');
  const resolved=await resolveLibraryLocations({},{moduleUrl:import.meta.url,argv:['/opt/node/bin/node','/x/other.js'],execPath:process.execPath,versions:{}});
  assert.equal(resolved.dshBin,undefined);assert.equal(resolved.inferred.includes('dshBin'),false);
});
