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
 let api;try{api=await import('../src/application-runtime.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
 assert.equal(typeof api?.createApplicationRuntime,'function');
 const value=api.createApplicationRuntime({host:{list:()=>({apps:[]}),instanceList:()=>[]},dataRoot:'/not-used',profileDir:undefined,ledgerReader:async()=>({items:{}}),provision:async()=>{},remove:async()=>{}});
 assert.equal(value.install,undefined);assert.equal(value.installedPlugins,undefined);assert.deepEqual(await value.installed(),[]);
});
