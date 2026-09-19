import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createLibraryInstaller } from '../src/library/install.js';

async function installedPackage(profile){const root=join(profile,'node_modules','@hanamesh','app-vibe-trading');await mkdir(root,{recursive:true});
  await writeFile(join(root,'package.json'),JSON.stringify({name:'@hanamesh/app-vibe-trading',version:'1.2.3',hanamesh:{app:'app.json'}}));
  await writeFile(join(root,'app.json'),JSON.stringify({id:'vibe',name:'Vibe',deployments:[{id:'local',dataId:'data-v1',mode:'owned',command:'/bin/sh',args:['{{dataDir}}','{{port}}'],env:{},envAllowlist:[],readiness:{path:'/',status:200,bodyIncludes:'Vibe'},runtime:{manifest:{schema:1,sources:[],items:[]},item:'runtime'}}]}));}

test('AH-L04/L05: install uses explicit Node + DSH argv, exact stable registry version, then provisions the declared item',async()=>{
  const profile=await mkdtemp(join(tmpdir(),'hm-library-install-')),dataRoot=join(profile,'data');const calls=[],events=[];
  const installer=createLibraryInstaller({profileDir:profile,profileName:'p3',dataRoot,nodeBinary:'/opt/node/bin/node',dshBin:'/opt/dsh/bin.js',
    fetchImpl:async()=>new Response(JSON.stringify({version:'1.2.3'}),{headers:{'content-type':'application/json'}}),
    spawn:async(command,args,options)=>{calls.push({command,args,options});await installedPackage(profile);return{code:0,stdout:'ok',stderr:''};},
    provision:async(manifest,options)=>{calls.push({manifest,options});return[{item:'runtime',action:'installed'}];},remove:async()=>{},emit:event=>events.push(event)});
  const result=await installer.install({id:'vibe-item',categories:['hanamesh-app'],package:{registry:'npm',name:'@hanamesh/app-vibe-trading'}});
  assert.deepEqual(calls[0],{command:'/opt/node/bin/node',args:['/opt/dsh/bin.js','plugin','--profile','p3','add','--save-exact','@hanamesh/app-vibe-trading@1.2.3'],options:{cwd:profile}});
  assert.equal(calls[1].options.root,join(dataRoot,'runtimes','vibe'));
  assert.deepEqual(calls[1].options.only,['runtime']);
  assert.equal(result.status,'restart-required');
  assert.ok(events.some(event=>event.type==='library.install-done'));
});

test('AH-L06: uninstall removes the package and owned runtime but preserves application data',async()=>{
  const profile=await mkdtemp(join(tmpdir(),'hm-library-remove-')),dataRoot=join(profile,'data');await installedPackage(profile);
  const kept=join(dataRoot,'principal','vibe','local','data-v1','single','user.db');await mkdir(join(kept,'..'),{recursive:true});await writeFile(kept,'keep');
  const calls=[];const installer=createLibraryInstaller({profileDir:profile,profileName:'p3',dataRoot,nodeBinary:'/opt/node/bin/node',dshBin:'/opt/dsh/bin.js',
    fetchImpl:async()=>{throw new Error('unused');},spawn:async(command,args,options)=>{calls.push({command,args,options});return{code:0,stdout:'',stderr:''};},
    provision:async()=>[],remove:async(item,options)=>calls.push({item,options}),emit:()=>{}});
  const result=await installer.uninstall({packageName:'@hanamesh/app-vibe-trading',appId:'vibe',runtimeItem:'runtime',running:false});
  assert.equal(result.status,'restart-required');
  assert.deepEqual(calls[0].args,['/opt/dsh/bin.js','plugin','--profile','p3','remove','@hanamesh/app-vibe-trading']);
  assert.equal(calls[1].item,'runtime');
  await access(kept);
});
