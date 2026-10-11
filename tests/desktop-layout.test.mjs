import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as locate from '../src/library/locate.js';
import {temporary} from './helpers.mjs';

async function layout(t){
  const root=await temporary();t.after(()=>rm(root,{recursive:true,force:true}));
  const runtime=join(root,'dsh'),profile=join(root,'home/profiles/desktop'),host=join(runtime,'node_modules/@deepseek-ai/dsh-desktop-host'),dsh=join(runtime,'node_modules/@deepseek-ai/dsh'),own=join(profile,'node_modules/@hanamesh/dsh-app-host');
  for(const dir of [join(host,'lib'),join(dsh,'lib'),join(own,'dist')])await mkdir(dir,{recursive:true});
  for(const [dir,name] of [[host,'@deepseek-ai/dsh-desktop-host'],[dsh,'@deepseek-ai/dsh'],[own,'@hanamesh/dsh-app-host']])await writeFile(join(dir,'package.json'),JSON.stringify({name,version:'0.2.1-alpha.2'}));
  await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{'@hanamesh/dsh-app-host':'0.5.1'},dsh:{profile:{bundles:['@hanamesh/dsh-app-host']}}}));
  const entry=join(host,'lib/index.js');await writeFile(entry,'');await writeFile(join(dsh,'lib/bin.js'),'');
  return{root,runtime,profile,entry,moduleUrl:pathToFileURL(join(own,'dist/dsh.js')).href,argv:[process.execPath,entry,runtime,profile,join(root,'primary-runtime')]};
}

test('AH-D04: upstream Desktop argv and manifests infer profile, CLI and workspace without supply config',async t=>{
  const h=await layout(t);assert.equal(typeof locate.inferDesktopLayout,'function');
  const desktop=await locate.inferDesktopLayout({moduleUrl:h.moduleUrl,argv:h.argv});
  assert.equal(desktop.profileDir,h.profile);assert.equal(desktop.profileName,'desktop');assert.equal(desktop.parentOrigin,'dsh-app://app');assert.deepEqual(desktop.frameAncestors,[]);
  const resolved=await locate.resolveLibraryLocations({},{moduleUrl:h.moduleUrl,argv:h.argv,execPath:process.execPath,versions:{},desktop});
  assert.equal(resolved.profileDir,h.profile);assert.equal(resolved.dshBin,join(h.runtime,'node_modules/@deepseek-ai/dsh/lib/bin.js'));assert.equal(resolved.nodeBinary,process.execPath);
  const other=join(h.root,'foreign/app-host');await mkdir(join(other,'dist'),{recursive:true});await writeFile(join(other,'package.json'),JSON.stringify({name:locate.PACKAGE_NAME}));
  assert.equal(await locate.inferDesktopLayout({moduleUrl:pathToFileURL(join(other,'dist/dsh.js')).href,argv:h.argv}),undefined,'profile must link this exact package root');
  for(const argv of [[process.execPath,join(h.root,'index.js'),h.runtime,h.profile],[...h.argv.slice(0,3),h.root], [process.execPath,h.entry,h.root,h.profile]])assert.equal(await locate.inferDesktopLayout({moduleUrl:h.moduleUrl,argv}),undefined);
  // pnpm's external store root need not have the Desktop profile among its ancestors.
  const store=join(h.root,'store/app-host');await mkdir(join(store,'dist'),{recursive:true});await writeFile(join(store,'package.json'),JSON.stringify({name:locate.PACKAGE_NAME}));await rm(join(h.profile,'node_modules/@hanamesh/dsh-app-host'),{recursive:true});await symlink(store,join(h.profile,'node_modules/@hanamesh/dsh-app-host'));
  assert.equal((await locate.inferDesktopLayout({moduleUrl:pathToFileURL(join(store,'dist/dsh.js')).href,argv:h.argv})).profileDir,h.profile);
  // A different package root, guessed script, wrong profile or wrongly named executable is never admitted.
  const electron=await locate.resolveLibraryLocations({},{moduleUrl:pathToFileURL(join(store,'dist/dsh.js')).href,argv:h.argv,execPath:'/Applications/DSH.app/Contents/MacOS/DSH',versions:{electron:'44.7.0'}});
  assert.equal(electron.nodeBinary,undefined,'K5 still requires standalone Node; layout must not invent one');
  const explicit=await locate.resolveLibraryLocations({profileDir:h.root,profileName:'explicit',dshBin:'/explicit/bin.js',sources:[]},{moduleUrl:h.moduleUrl,argv:h.argv,nodeBinary:process.execPath,desktop});assert.equal(explicit.profileDir,h.root);assert.equal(explicit.profileName,'explicit');assert.equal(explicit.dshBin,'/explicit/bin.js');
});


test('AH-D06: Desktop primary runtime manifest selects an executable standalone Node and reserved-profile CLI',async t=>{
  const h=await layout(t),payload=h.argv[4],node=join(payload,'dependencies/node/bin/node');
  await mkdir(join(payload,'dependencies/node/bin'),{recursive:true});await symlink(process.execPath,node);
  await writeFile(join(payload,'runtime.json'),JSON.stringify({desktopVersion:'0.2.1-alpha.2',platform:process.platform,arch:process.arch,node:process.versions.node,python:'3.13.0',pythonPackages:{}}));
  await writeFile(join(h.runtime,'node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js'),'export async function runDesktopCli() {}');
  const resolved=await locate.resolveLibraryLocations({},{moduleUrl:h.moduleUrl,argv:h.argv,execPath:'/electron',versions:{electron:'44.7.0'}});
  assert.equal(resolved.nodeBinary,process.execPath,'use declared executable payload Node, never Electron');
  assert.equal(resolved.desktopCli.entry,join(h.runtime,'node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js'));
  assert.equal(resolved.desktopCli.supportDir,h.root);
  await rm(join(h.runtime,'node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js'));
  assert.equal((await locate.resolveLibraryLocations({},{moduleUrl:h.moduleUrl,argv:h.argv,execPath:'/electron',versions:{electron:'44.7.0'}})).nodeBinary,process.execPath,'owned Node is independent of installer CLI availability');
  await writeFile(join(payload,'runtime.json'),JSON.stringify({desktopVersion:'0.2.1-alpha.2',platform:process.platform,arch:process.arch,node:'24.99.99'}));
  assert.equal((await locate.resolveLibraryLocations({},{moduleUrl:h.moduleUrl,argv:h.argv,execPath:'/electron',versions:{electron:'44.7.0'}})).nodeBinary,undefined,'unproven payload version is refused');
  await writeFile(join(payload,'runtime.json'),JSON.stringify({desktopVersion:'0.2.1-alpha.2',platform:'wrong',arch:process.arch,node:process.versions.node}));
  assert.equal((await locate.resolveLibraryLocations({},{moduleUrl:h.moduleUrl,argv:h.argv,execPath:'/electron',versions:{electron:'44.7.0'}})).nodeBinary,undefined);
});
