import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanInstalled } from '../src/library/installed.js';

const definition=(id,runtime)=>({id,name:id,singleInstanceOnly:true,deployments:[{id:'local',dataId:'data-v1',mode:'owned',command:'/bin/sh',args:['-c','exec', '{{dataDir}}','{{port}}'],env:{},envAllowlist:[],readiness:{path:'/',status:200,bodyIncludes:id},...(runtime?{runtime}:{})}]});
async function addPackage(profile,name,id,runtime){
  const root=join(profile,'node_modules',...name.split('/'));await mkdir(root,{recursive:true});
  await writeFile(join(root,'package.json'),JSON.stringify({name,version:'1.0.0',hanamesh:{app:'app.json'}}));
  await writeFile(join(root,'app.json'),JSON.stringify(definition(id,runtime)));
}

test('AH-L03: installed scan reports registered, installed-not-loaded and runtime-missing independently of catalog sources',async()=>{
  const profile=await mkdtemp(join(tmpdir(),'hm-library-profile-'));
  await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{'@hanamesh/app-one':'1.0.0','third-app':'1.0.0','runtime-app':'1.0.0'}}));
  await addPackage(profile,'@hanamesh/app-one','one');
  await addPackage(profile,'third-app','two');
  await addPackage(profile,'runtime-app','three',{manifest:{schema:1,sources:[],items:[]},item:'runtime'});
  const rows=await scanInstalled({profileDir:profile,host:{list:()=>({apps:[{id:'one'}]})},ledgerReader:async()=>({schema:1,items:{}}),dataRoot:join(profile,'data')});
  assert.deepEqual(Object.fromEntries(rows.map(row=>[row.appId,row.state])),{one:'registered',two:'installed-not-loaded',three:'runtime-missing'});
});
