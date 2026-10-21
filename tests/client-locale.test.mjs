import test from 'node:test';
import assert from 'node:assert/strict';
import {registeredClient} from './fixtures/registered-client-harness.mjs';
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate);};
function localeRuntime(){let active='en';const subscribers=new Set(),dicts=new Map();return{register(ns,d){dicts.set(ns,d);return()=>dicts.delete(ns);},bind:ns=>key=>dicts.get(ns)?.[active]?.[key]??key,getLocale:()=>({active}),subscribe:fn=>{subscribers.add(fn);return()=>subscribers.delete(fn);},set(value){active=value;for(const fn of subscribers)fn();},get subscriptions(){return subscribers.size;}};}
const settings={mode:'managed',version:'24.22.0',sourceBase:'https://nodejs.org/dist',storageRoot:'/owned/node',externalBinary:''};
test('host locale changes all owned settings labels and Node controls without changing saved values or downloading',async t=>{
 const locale=localeRuntime(),calls=[];
 const h=await registeredClient({file:new URL('../src/client-ui.js',import.meta.url),locale,href:'http://127.0.0.1:45678',fetch:async(path,init)=>{calls.push({path,init});return{ok:true,json:async()=>path.endsWith('/node-runtime')?{settings,names:{mode:'运行方式',version:'Node 版本',sourceBase:'下载来源',storageRoot:'存放位置',externalBinary:'已有独立 Node 路径'},versions:['24.22.0'],supported:true,ready:false}:path.endsWith('installedPlugins')?{plugins:[]}:{handoffs:[],pollMs:1500}};}});
 t.after(()=>h.dispose());h.mountSettings('hanamesh-node-runtime');await flush();
 assert.match(JSON.stringify(h.tree),/Prepare installation environment/);assert.doesNotMatch(JSON.stringify(h.tree),/[\u3400-\u9fff]/);
 for(const slot of h.slots.values())if(slot.descriptor.label)assert.equal(typeof slot.descriptor.label,'string','registrant-localized navigation label');;
 locale.set('zh');await flush();assert.equal(h.slots.get('hanamesh-node-runtime').descriptor.label,'安装环境');assert.match(JSON.stringify(h.tree),/准备安装环境/);assert.equal(calls.filter(c=>c.init?.method==='POST').length,0);
 h.dispose();assert.equal(locale.subscriptions,0);
});
test('catalog failure has actionable localized copy and the exact original code only in folded diagnostics',async t=>{
 const locale=localeRuntime();const h=await registeredClient({file:new URL('../src/client-ui.js',import.meta.url),locale,href:'http://127.0.0.1:45678',fetch:async path=>({ok:!path.startsWith('/hanamesh/library?'),json:async()=>path.startsWith('/hanamesh/library?')?{error:{code:'INVALID_CATALOG_MANIFEST',message:'Retain selected view.',details:{view:'hanamesh'}}}:path.endsWith('installedPlugins')?{plugins:[]}:{handoffs:[],pollMs:1500}})});t.after(()=>h.dispose());await flush();h.mountMarket();await flush();
 const alert=h.find(n=>n.props?.role==='alert');assert.ok(alert);assert.match(JSON.stringify(alert),/catalog/i);assert.ok(h.find(n=>n.type==='details'&&!n.props.open));assert.ok(h.find(n=>n.type==='summary'&&n.children.includes('Technical details')));
 assert.match(JSON.stringify(h.tree),/Retain selected view/);assert.match(JSON.stringify(h.tree),/hanamesh/);locale.set('zh');await flush();assert.ok(h.find(n=>n.type==='summary'&&n.children.includes('技术详情')));
});

test('website handoff failure follows a later locale switch and retains its raw reason',async t=>{
 const locale=localeRuntime();const h=await registeredClient({file:new URL('../src/client-ui.js',import.meta.url),locale,href:'http://127.0.0.1:45678',fetch:async path=>({ok:!path.endsWith('/handoffs'),json:async()=>path.endsWith('/handoffs')?{error:{code:'HANDOFF_UNAVAILABLE',message:'Handoff original reason',details:{listener:'unavailable'}}}:path.endsWith('/handoff-settings')?{listener:{status:'unavailable',need:'真实端口不可用'}}:{plugins:[]}})});t.after(()=>h.dispose());await flush();h.mountSettings('hanamesh-library-handoff');await flush();assert.match(JSON.stringify(h.tree),/Website handoff could not be read/);locale.set('zh');await flush();assert.doesNotMatch(JSON.stringify(h.tree),/Website handoff could not be read/);assert.match(JSON.stringify(h.tree),/网站交接：读取交接失败/);assert.match(JSON.stringify(h.tree),/HANDOFF_UNAVAILABLE/);assert.match(JSON.stringify(h.tree),/Handoff original reason/);
});

test('normal installation target resolution preserves detailed refusal in localized failure surface',async t=>{
 const locale=localeRuntime();const h=await registeredClient({file:new URL('../src/client-ui.js',import.meta.url),locale,href:'http://127.0.0.1:45678',fetch:async path=>({ok:!path.startsWith('/hanamesh/library/target?'),json:async()=>path.startsWith('/hanamesh/library/target?')?{error:{code:'CATALOG_ITEM_MISSING',message:'Exact target unavailable',details:{itemId:'example'}}}:path.endsWith('installedPlugins')?{plugins:[]}:{handoffs:[],pollMs:1500}})});t.after(()=>h.dispose());await flush();h.mountMarket();await assert.rejects(h.module.openInstallTarget({itemId:'example'}));await flush();assert.ok(h.find(n=>n.type==='summary'&&n.children.includes('Technical details')));assert.match(JSON.stringify(h.tree),/Exact target unavailable/);assert.match(JSON.stringify(h.tree),/CATALOG_ITEM_MISSING/);
});
