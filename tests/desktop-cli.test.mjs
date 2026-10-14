import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createLibraryInstaller} from '../src/library/install.js';
import {temporary} from './helpers.mjs';

// Component provider fixture for fixed d743267 runDesktopCli(runtimeDir,supportDir).
// Only the existing public installer entry is driven; this is not native install proof.
test('AH-D07: public installer preserves Desktop profile and invokes exported CLI with exact layout and argv',async t=>{
  const root=await temporary();t.after(()=>rm(root,{recursive:true,force:true}));
  const profile=join(root,'profiles/desktop'),runtimeDir=join(root,'dsh'),supportDir=join(root,'runtime');
  await mkdir(profile,{recursive:true});
  const observation=join(root,'cli-observation.json'),record=join(root,'record.mjs');
  const packageName='@fixture/desktop-plugin',version='1.0.0';
  await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{}}));
  await writeFile(record,`import {mkdir,writeFile} from 'node:fs/promises';
export async function record(entry,runtimeDir,supportDir){
 await writeFile(${JSON.stringify(observation)},JSON.stringify({entry,runtimeDir,supportDir,args:process.argv.slice(2),cwd:process.cwd(),node:process.execPath,electron:process.versions.electron}));
 // Only the CLI provider fixture's isolated readback, never product state.
 const target=${JSON.stringify(join(profile,'node_modules/@fixture/desktop-plugin'))};
 await mkdir(target,{recursive:true});
 await writeFile(target+'/package.json',JSON.stringify({name:${JSON.stringify(packageName)},version:${JSON.stringify(version)}}));
 await writeFile(${JSON.stringify(join(profile,'package.json'))},JSON.stringify({dependencies:{[${JSON.stringify(packageName)}]:${JSON.stringify(version)}}}));
}`);
  const plain=join(root,'plain-cli.mjs'),desktop=join(root,'desktop-cli.mjs');
  await writeFile(plain,"import {record} from './record.mjs';await record('plain');");
  await writeFile(desktop,"import {record} from './record.mjs';export async function runDesktopCli(runtimeDir,supportDir){await record('desktop',runtimeDir,supportDir);}");
  const installer=createLibraryInstaller({profileDir:profile,profileName:'desktop',dataRoot:join(root,'data'),nodeBinary:process.execPath,dshBin:plain,
    desktopCli:{entry:desktop,runtimeDir,supportDir},
    fetchImpl:async()=>new Response(JSON.stringify({version}),{headers:{'content-type':'application/json'}})});
  const result=await installer.installPlugin({packageName});
  assert.equal(result.status,'restart-required');
  const actual=JSON.parse(await readFile(observation,'utf8'));
  console.log(JSON.stringify({case:'DESKTOP_INSTALLER_PROVIDER_FIXTURE',...actual}));
  assert.equal(actual.entry,'desktop','Desktop install must use reserved-profile runDesktopCli, not the plain CLI');
  assert.deepEqual(actual,{entry:'desktop',runtimeDir,supportDir,args:['plugin','--profile','desktop','add','--save-exact',packageName+'@'+version],cwd:profile,node:process.execPath});
});
