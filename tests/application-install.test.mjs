import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { applicationVersion, createSourceProfile } from '../src/install-target/fixtures/source-profile.js';
import { createLibraryInstaller } from '../src/library/install.js';
import { createLibraryService } from '../src/library/service.js';

const packageName='@fixture/runtime-app';
const appId='runtime-app';
const version='1.0.0';
const target={source:'npm',name:packageName,version,allowBuild:[]};
const registry='https://registry.example/';

async function installation(t,{invalid=false}={}){
  const app=applicationVersion({appId,version,invalid}).app;
  const profile=await createSourceProfile({registry:{[packageName]:[{version,app,bundle:true}]}});
  t.after(()=>profile.cleanup());
  let service;
  const installer=createLibraryInstaller({...profile,nodeBinary:process.execPath,dshBin:'/fixture/dsh.js',emit:event=>service.emit(event)});
  service=await createLibraryService({
    domain:{global:{get:()=>({schema:1,revision:0,sources:[]})},close:async()=>{}},
    host:{list:()=>({apps:[]}),instanceList:()=>[]},
    config:{profileDir:profile.profileDir,sources:[]},
    dataRoot:profile.dataRoot,
    installer,
  }).init();
  t.after(()=>service.close());
  const module=join(profile.profileDir,'node_modules',...packageName.split('/'),'package.json');
  const files=()=>Promise.all(['package.json','pnpm-lock.yaml'].map(name=>readFile(join(profile.profileDir,name),'utf8')));
  const ledger=()=>profile.ledger(join(profile.dataRoot,'runtimes',appId));
  return{profile,service,module,files,ledger};
}

test('AppHost application install completes after exact profile readback and runtime provisioning',async t=>{
  const {service,profile,module,files,ledger}=await installation(t);
  const receipt=await service.installApplication({target,version,registry});
  assert.deepEqual(receipt,{status:'ready',restartRequired:true,appId,packageName,version});
  assert.deepEqual(profile.calls,[['add','--save-exact','--registry='+registry,packageName+'@'+version]]);
  const [manifest,lock]=await files();
  assert.equal(JSON.parse(manifest).dependencies[packageName],version);
  assert.ok(lock.includes("      '"+packageName+"':\n        specifier: "+version));
  assert.equal(JSON.parse(await readFile(module,'utf8')).version,version);
  assert.equal((await ledger()).items.runtime.version,version);
});

for(const stage of ['definition','provision']){
  test('AppHost application install restores exact profile and runtime state after '+stage+' failure',async t=>{
    const {service,profile,module,files,ledger}=await installation(t,{invalid:stage==='definition'});
    const before=await files();
    if(stage==='provision')profile.fail('provision','after');
    await assert.rejects(service.installApplication({target,version,registry}),error=>{
      assert.equal(error.code,stage==='definition'?'INVALID_DEFINITION':'E_VERIFY');
      assert.equal(error.recovery.status,'restored');
      assert.equal(error.recovery.stage,stage);
      assert.ok(error.recovery.checks.length>0&&error.recovery.checks.every(check=>check.ok));
      return true;
    });
    assert.deepEqual(await files(),before);
    assert.equal(await profile.exists(module),false);
    assert.deepEqual((await ledger()).items,{});
    assert.deepEqual(profile.calls,[['add','--save-exact','--registry='+registry,packageName+'@'+version],['remove',packageName]]);
  });
}
