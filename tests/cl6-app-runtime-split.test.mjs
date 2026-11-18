import test from 'node:test';
import assert from 'node:assert/strict';
import {clientHarness,settle,fakeClock} from './fixtures/client-ui-harness.mjs';

test('owner split: AppHost contributes application/runtime/model views only, with no market registrations',async t=>{
 const h=await clientHarness({clock:fakeClock(),fetch:async()=>Response.json({items:[],installed:[],plugins:[],apps:[],page:{},handoffs:[],pollMs:1500})});t.after(()=>h.unmount());const entries=[],cleanups=[],ctx={locale:null,layout:{selectPanel(){}},slots:{inject(_name,run){return run();},register(options){entries.push(options);return()=>{};}},effect(run){const cleanup=run();if(typeof cleanup==='function')cleanups.push(cleanup);},inject(_names,run){return run(ctx);},get(){return undefined;},provide(){return()=>{};},reflect:{get(){}}};t.after(()=>cleanups.reverse().forEach(stop=>stop()));h.module.apply(ctx);await settle();
 assert(entries.some(row=>row.name==='hanamesh.home.continue'&&row.id==='applications'),'AppHost must retain application open/close ownership in Core continue content');
 assert(entries.some(row=>row.name==='hanamesh.account.models'),'application model routing remains available');
 assert.equal(entries.some(row=>['plugins.tab','sidebar.panellist','sidebar.footer.action','settings.section'].includes(row.name)),false);
 assert.equal(h.module.createMarketSeat,undefined);assert.equal(h.module.openInstallTarget,undefined);
});
test('owner split: application runtime service cannot install or maintain a plugin inventory',async()=>{
 let api;try{api=await import('../src/application-runtime.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||error.url!==new URL('../src/application-runtime.js',import.meta.url).href)throw error;}
 assert.equal(typeof api?.createApplicationRuntime,'function');
 const value=api.createApplicationRuntime({host:{list:()=>({apps:[]}),instanceList:()=>[]},dataRoot:'/not-used',profileDir:undefined,ledgerReader:async()=>({items:{}}),provision:async()=>{},remove:async()=>{}});
 assert.equal(value.install,undefined);assert.equal(value.installedPlugins,undefined);assert.deepEqual(await value.installed(),[]);
});

test('application runtime mutations require declared identities, removal confirmation and no live instance, preserving app data',async t=>{
 const{mkdir,writeFile,readFile}=await import('node:fs/promises'),{join}=await import('node:path'),{scratch}=await import('./helpers.mjs'),{createApplicationRuntime}=await import('../src/application-runtime.js');const root=await scratch('cl6-app-runtime-'),profile=join(root,'profile'),pkg=join(profile,'node_modules/runtime-app'),data=join(root,'data');await mkdir(pkg,{recursive:true});await mkdir(data);await writeFile(join(data,'keep.txt'),'application-owned-data');
 const runtime={manifest:{schema:1,sources:[],items:[{id:'runtime',version:'1.0.0',kind:'tar.gz',installTo:'runtime',platforms:{}}]},item:'runtime',exec:'bin/app'};await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{'runtime-app':'1.0.0'}}));await writeFile(join(pkg,'package.json'),JSON.stringify({name:'runtime-app',version:'1.0.0',hanamesh:{app:'app.json'}}));await writeFile(join(pkg,'app.json'),JSON.stringify({id:'runtime-app',name:'Runtime app',deployments:[{id:'local',dataId:'v1',mode:'owned',runtime,args:['{{port}}','{{dataDir}}'],readiness:{path:'/',status:200,bodyIncludes:'APP'}}]}));
 let live=[],calls=[];const service=createApplicationRuntime({host:{list:()=>({apps:[]}),instanceList:()=>live},profileDir:profile,dataRoot:data,ledgerReader:async()=>({items:{}}),provision:async(...args)=>{calls.push(['provision',...args]);return{};},remove:async(...args)=>{calls.push(['remove',...args]);return{};}});t.after(()=>service.close());const input={appId:'runtime-app',packageName:'runtime-app',runtimeItem:'runtime'};
 await assert.rejects(service.provision({...input,runtimeItem:'undeclared'}),{code:'RUNTIME_NOT_DECLARED'});await assert.rejects(service.provision({...input,appId:'../../foreign'}),{code:'APP_PACKAGE_MISSING'});await assert.rejects(service.remove(input),{code:'CONFIRMATION_REQUIRED'});assert.equal(calls.length,0);
 await service.provision(input);assert.equal(calls.length,1);assert.deepEqual(calls[0][2],{root:join(data,'runtimes','runtime-app'),only:['runtime']});live=[{appId:'runtime-app',status:'ready'}];await assert.rejects(service.remove({...input,confirm:true}),{code:'INSTANCE_IN_USE'});assert.equal(calls.length,1);live=[];await service.remove({...input,confirm:true});assert.equal(calls.length,2);assert.equal(await readFile(join(data,'keep.txt'),'utf8'),'application-owned-data');
});

test('standalone AppHost retains its application view in native package configuration when Core is absent',async t=>{const h=await clientHarness({fetch:async()=>Response.json({apps:[]})});t.after(()=>h.unmount());const tree=h.module.RuntimeConfiguration({view:'page'});assert(tree.children.some(child=>child?.type===h.module.ApplicationContent),'native AppHost configuration must retain the owned application view without Core');});
