import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {scratch} from './helpers.mjs';
import {createLibraryService} from '../src/library/service.js';
import {validateProviderPage} from '../src/library/catalog.js';
import {loadClient} from '../src/install-target/harness.js';

const template=JSON.parse(await readFile(new URL('./fixtures/catalog/hanamesh-view-v1.json',import.meta.url),'utf8')).page;
const github={source:'github',repo:'acme/reviewed',ref:'a'.repeat(40),path:null,packageName:'dsh-reviewed',allowBuild:[]};
const npm={source:'npm',name:'dsh-reviewed',version:'1.2.3',allowBuild:[]};
const method=target=>({channel:'hanamesh',kind:target.source,spec:target.source==='npm'?target.name:'github:'+target.repo,command:null,sourceId:'1024store',sourceRef:'acme/reviewed',allowBuild:[],target});
const entry=target=>({...structuredClone(template.items[0]),packageName:'dsh-reviewed',package:{registry:'npm',name:'dsh-reviewed'},categories:[],installMethods:[method(target)],oneClickInstall:{allowed:true,reason:null}});
async function library(t,item,{installedVersion,installer}={}){
 const root=await scratch('r25-target-'),fixture=join(root,'catalog.json'),profileDir=join(root,'profile');await mkdir(profileDir);
 await writeFile(fixture,JSON.stringify({...template,items:[item],page:{}}));
 await writeFile(join(profileDir,'package.json'),JSON.stringify({dependencies:installedVersion?{'dsh-reviewed':installedVersion}:{},dsh:{profile:{bundles:installedVersion?['dsh-reviewed']:[]}}}));
 if(installedVersion){const dir=join(profileDir,'node_modules/dsh-reviewed');await mkdir(dir,{recursive:true});await writeFile(join(dir,'package.json'),JSON.stringify({name:'dsh-reviewed',version:installedVersion,dsh:{bundle:{patch:'./patch.yml'}}}));}
 let state={schema:1,revision:0,sources:[]};
 const service=await createLibraryService({domain:{global:{get:async()=>state,set:async next=>{state=next;}},close:async()=>{}},host:{list:()=>({apps:[]}),instanceList:()=>[]},config:{fixture,profileDir},installer}).init();
 t.after(()=>service.close());return service;
}

test('R25 M1 reviewed methods never fall back to an unverified npm display package',async t=>{
 const item=entry(github);item.packageName='dsh-unverified';item.package={registry:'npm',name:'dsh-unverified'};
 item.installMethods.push({channel:'hanamesh',kind:'npm',spec:'dsh-unverified',command:null,sourceId:'1024store',sourceRef:'acme/reviewed',allowBuild:[],npmOwnership:{status:'missing-repository',repository:null},targetUnavailableReason:'npm-repository-unverified'});
 let installs=0;const service=await library(t,item,{installer:{ready:true,install:async()=>{installs++;return{status:'restart-required',packageName:'dsh-unverified'};}}});
 for(const call of ['resolveTarget','install'])await assert.rejects(service[call]({itemId:item.id,packageName:'dsh-unverified'}),error=>{
  assert.equal(error.code,'NOT_INSTALLABLE');assert.equal(error.details.reason,'fixed-install-target-required');assert.match(error.message,/fixed.*target/i);return true;
 });
 assert.equal(installs,0,'unverified npm never reaches the installer');
 assert.deepEqual((await service.resolveTarget({itemId:item.id,packageName:'dsh-reviewed'})).item.installTarget,github,'the reviewed GitHub package remains selectable');
});

test('R25 M2 retired fields are rejected by the HanaMesh catalog',()=>{
 for(const key of ['latestVersion','license','kind']){const item=entry(npm);item[key]=key==='kind'?'plugin':'retired-value';assert.throws(()=>validateProviderPage({...template,items:[item],page:{}}),{code:'INVALID_CATALOG_PAGE'},'retired catalog field '+key+' is rejected');}
});

test('R25 M2 npm fixed targets upgrade in target preview, market list and install without a display version',async t=>{
 const item=entry(npm);let installedTarget;
 const service=await library(t,item,{installedVersion:'1.0.0',installer:{ready:true,install:async value=>{installedTarget=value.installTarget;return{status:'restart-required',kind:'plugin',packageName:'dsh-reviewed',version:npm.version};}}});
 const preview=await service.resolveTarget({itemId:item.id});assert.equal(preview.item.upgradeAvailable,true,'a newer reviewed npm target is an upgrade');assert.deepEqual(preview.item.installTarget,npm);
 const page=await service.list({category:''});assert.equal(page.items.find(x=>x.id===item.id).upgradeAvailable,true,'market uses the exact npm target version');
 const result=await service.install({itemId:item.id,installTarget:npm});assert.equal(result.status,'started','the new fixed target is not already-installed');await service.close();assert.deepEqual(installedTarget,npm);
});

test('R25 M2 confirmation has no retired directory version, shows reviewed npm version and upgrade has no version suffix',async t=>{
 const item={id:'r25',displayName:'Reviewed plugin',kind:'plugin',package:{registry:'npm',name:npm.name},installTarget:npm,installed:{packageName:npm.name,state:'installed',version:'1.0.0'},upgradeAvailable:true};
 const client=await loadClient({fetch:async path=>{
  if(path.startsWith('/hanamesh/library/target?'))return Response.json({source:{kind:'fixture'},item});
  return Response.json({items:[item],plugins:[],installed:[],handoffs:[],pollMs:1500});
 }});t.after(()=>client.unmount());
 assert(client.button('升级'),'upgrade action is shown without a catalog version suffix');
 await client.module.openInstallTarget({itemId:item.id,installTarget:npm});await client.idle();
 assert(!client.text().includes('目录未提供版本'),'confirmation has no retired version placeholder');
 assert(!client.text().includes('"children":["版本"]'),'confirmation has no version label');
 assert(client.text().includes('1.2.3'),'confirmation displays the exact reviewed npm execution target');assert(client.text().includes('精确版本'));
});
