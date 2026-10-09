import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, access, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createLibraryInstaller } from '../src/library/install.js';

async function installedPackage(profile){const root=join(profile,'node_modules','@hanamesh','app-vibe-trading');await mkdir(root,{recursive:true});
  await writeFile(join(root,'package.json'),JSON.stringify({name:'@hanamesh/app-vibe-trading',version:'1.2.3',hanamesh:{app:'app.json'}}));
  await writeFile(join(root,'app.json'),JSON.stringify({id:'vibe',name:'Vibe',deployments:[{id:'local',dataId:'data-v1',mode:'owned',args:['{{dataDir}}','{{port}}'],env:{},envAllowlist:[],readiness:{path:'/',status:200,bodyIncludes:'Vibe'},runtime:{manifest:{schema:1,sources:[],items:[{id:'runtime',version:'0.1.15',kind:'tar.gz',installTo:'runtime',platforms:{}}]},item:'runtime',exec:'bin/vibe'}}]}));}

test('AH-L04/L05: install uses explicit Node + DSH argv, exact stable registry version, then provisions the declared item',async()=>{
  const profile=await mkdtemp(join(tmpdir(),'hm-library-install-')),dataRoot=join(profile,'data');const calls=[],events=[];
  const installer=createLibraryInstaller({profileDir:profile,profileName:'p3',dataRoot,nodeBinary:'/opt/node/bin/node',dshBin:'/opt/dsh/bin.js',
    fetchImpl:async()=>new Response(JSON.stringify({version:'1.2.3'}),{headers:{'content-type':'application/json'}}),
    spawn:async(command,args,options)=>{calls.push({command,args,options});await installedPackage(profile);await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{'@hanamesh/app-vibe-trading':'1.2.3'}}));return{code:0,stdout:'ok',stderr:''};},
    provision:async(manifest,options)=>{calls.push({manifest,options});return[{item:'runtime',action:'installed'}];},remove:async()=>{},ledger:async()=>({schema:1,items:{}}),emit:event=>events.push(event)});
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

test('AH-RI01: uninstall clears generated Python bytecode left by provision remove',async()=>{
  const profile=await mkdtemp(join(tmpdir(),'hm-library-bytecode-')),dataRoot=join(profile,'data');
  const runtimeRoot=join(dataRoot,'runtimes','vibe'),target=join(runtimeRoot,'vibe-trading');
  const cache=join(target,'python','lib','__pycache__');await mkdir(cache,{recursive:true});
  const bytecode=join(cache,'module.cpython-311.pyc');await writeFile(bytecode,'generated');
  const installer=createLibraryInstaller({profileDir:profile,profileName:'p3',dataRoot,nodeBinary:'/opt/node/bin/node',dshBin:'/opt/dsh/bin.js',
    spawn:async()=>({code:0,stdout:'',stderr:''}),remove:async()=>({target,kept:['python/lib/__pycache__/module.cpython-311.pyc']})});
  await installer.uninstall({packageName:'@hanamesh/app-vibe-trading',appId:'vibe',runtimeItem:'runtime',running:false});
  await assert.rejects(stat(bytecode),{code:'ENOENT'});
  await assert.rejects(stat(target),{code:'ENOENT'});
});

test('AH-RI02: uninstall preserves unknown runtime residue and reports incomplete cleanup',async()=>{
  const profile=await mkdtemp(join(tmpdir(),'hm-library-residue-')),dataRoot=join(profile,'data');
  const target=join(dataRoot,'runtimes','vibe','vibe-trading');await mkdir(target,{recursive:true});
  const other=join(target,'user.txt');await writeFile(other,'keep');
  const installer=createLibraryInstaller({profileDir:profile,profileName:'p3',dataRoot,nodeBinary:'/opt/node/bin/node',dshBin:'/opt/dsh/bin.js',
    spawn:async()=>({code:0,stdout:'',stderr:''}),remove:async()=>({target,kept:['user.txt']})});
  await assert.rejects(installer.uninstall({packageName:'@hanamesh/app-vibe-trading',appId:'vibe',runtimeItem:'runtime',running:false}),error=>error.code==='RUNTIME_RESIDUE');
  await access(other);
});

/** rc.10: a CLI double that writes what `dsh plugin add/remove` writes (spec, module, lockfile text) and can fail one verb. */
function cliDouble(profile,{failing=new Set(),order=[]}={}){
  return async(_command,args)=>{const verb=args[4],spec=args.at(-1);order.push('start '+verb);await new Promise(resolvePromise=>setImmediate(resolvePromise));
    if(failing.has(verb)){order.push('end '+verb);return{code:1,stdout:'',stderr:'dsh: plugin command failed'};}
    const manifestPath=join(profile,'package.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
    const at=spec.lastIndexOf('@'),name=verb==='add'?spec.slice(0,at):spec,version=spec.slice(at+1),dir=join(profile,'node_modules',...name.split('/'));
    if(verb==='add'){manifest.dependencies[name]=version;await mkdir(dir,{recursive:true});await writeFile(join(dir,'package.json'),JSON.stringify({name,version,hanamesh:{app:'app.json'}}));await writeFile(join(dir,'app.json'),'{"id":"broken"}');}
    else{delete manifest.dependencies[name];await rm(dir,{recursive:true,force:true});}
    await writeFile(manifestPath,JSON.stringify(manifest));await writeFile(join(profile,'pnpm-lock.yaml'),JSON.stringify(manifest.dependencies));order.push('end '+verb);return{code:0,stdout:'',stderr:''};};
}
const registry=async()=>new Response(JSON.stringify({version:'2.0.0'}),{headers:{'content-type':'application/json'}});

test('AH-RB01: a failed install keeps its original error; a failed compensation is reported with residue and kept originals, never as restored',async()=>{
  const profile=await mkdtemp(join(tmpdir(),'hm-library-recovery-')),dataRoot=join(profile,'data');
  await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{}}));await writeFile(join(profile,'pnpm-lock.yaml'),'{}');
  const events=[];const installer=createLibraryInstaller({profileDir:profile,profileName:'p3',dataRoot,nodeBinary:'/opt/node/bin/node',dshBin:'/opt/dsh/bin.js',
    fetchImpl:registry,spawn:cliDouble(profile,{failing:new Set(['remove'])}),ledger:async()=>({schema:1,items:{}}),emit:event=>events.push(event)});
  await assert.rejects(installer.install({id:'x',categories:['hanamesh-app'],package:{registry:'npm',name:'@fixture/broken-app'}},{operationId:'op-1'}),error=>error.code==='INVALID_DEFINITION'&&error.recovery.status==='failed');
  const failed=events.find(event=>event.type==='library.install-failed');
  assert.equal(failed.code,'INVALID_DEFINITION');assert.equal(failed.recovery.error.code,'DSH_PLUGIN_FAILED');
  assert.deepEqual(failed.recovery.residue.map(row=>row.item).sort(),['dependency','lockfile','module']);
  assert.equal(failed.recovery.originals.dir,join(dataRoot,'library-recovery','op-1'));
  assert.equal(await readFile(join(failed.recovery.originals.dir,'pnpm-lock.yaml'),'utf8'),'{}');
});

test('AH-RB02: market installs and their compensations never interleave profile writes inside one host',async()=>{
  const profile=await mkdtemp(join(tmpdir(),'hm-library-serial-')),dataRoot=join(profile,'data');
  await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{}}));await writeFile(join(profile,'pnpm-lock.yaml'),'{}');
  const order=[];const installer=createLibraryInstaller({profileDir:profile,profileName:'p3',dataRoot,nodeBinary:'/opt/node/bin/node',dshBin:'/opt/dsh/bin.js',
    fetchImpl:registry,spawn:cliDouble(profile,{order}),ledger:async()=>({schema:1,items:{}})});
  const results=await Promise.allSettled(['@fixture/a','@fixture/b'].map(name=>installer.install({id:name,categories:['hanamesh-app'],package:{registry:'npm',name}})));
  assert.deepEqual(results.map(result=>[result.status,result.reason?.recovery?.status]),[['rejected','restored'],['rejected','restored']]);
  assert.deepEqual(order,['start add','end add','start remove','end remove','start add','end add','start remove','end remove']);
});
