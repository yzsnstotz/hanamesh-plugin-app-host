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
 locale.set('zh');await flush();assert.ok(h.slots.has('@hanamesh/dsh-app-host'),'runtime configuration remains on its native bundle config slot');assert.match(JSON.stringify(h.tree),/准备安装环境/);assert.equal(calls.filter(c=>c.init?.method==='POST').length,0);
 h.dispose();assert.equal(locale.subscriptions,0);
});

function visibleText(node){if(Array.isArray(node))return node.map(visibleText).join(' ');if(!node||typeof node!=='object')return typeof node==='string'?node:'';return node.type==='details'?'':visibleText(node.children);}
for(const language of ['zh','en'])test(`provider source and state use readable ${language} labels while exact records stay folded`,async t=>{
 const locale=localeRuntime();locale.set(language);
 const providers=[['configured','dsh-models'],['absent','dsh-models'],['unreachable','coding-oauth-gateway'],['gateway-off','coding-oauth-gateway'],['future-state','future-source']].map(([state,source],i)=>({id:'provider-'+i,displayName:'Provider '+i,source,state,models:['model-A'],value:'must-not-render-secret'}));
 const calls=[];const h=await registeredClient({file:new URL('../src/client-ui.js',import.meta.url),locale,href:'http://127.0.0.1:45678',fetch:async(path,init)=>{calls.push({path,init});return{ok:true,json:async()=>path.endsWith('/providers')?{providers}:path.endsWith('/apps')?{apps:[]}:{handoffs:[],pollMs:1500}};}});t.after(()=>h.dispose());h.mountSettings('hanamesh-providers');await flush();
 const shown=visibleText(h.tree);
 for(const raw of ['dsh-models','absent','gateway-off','unreachable','future-state','future-source'])assert.ok(!shown.includes(raw),raw+' is not primary copy');
 for(const text of language==='zh'?['已配置','尚未配置','暂时无法连接','网关已关闭','状态暂不可用','DSH 模型设置']:['Configured','Not configured','Cannot connect right now','Gateway is off','Status unavailable','DSH model settings'])assert.ok(shown.includes(text),text);
 const exact=h.find(n=>n.type==='details'&&JSON.stringify(n).includes('future-state'));assert.ok(exact&&!exact.props.open);assert.match(JSON.stringify(exact),/future-source/);assert.doesNotMatch(JSON.stringify(h.tree),/must-not-render-secret/);
 assert.ok(h.find(n=>n.type==='td'&&n.props['data-label']===(language==='zh'?'来源':'Source')),'stacked cells retain their own field label');
 assert.equal(calls.filter(c=>c.init?.method==='POST').length,0);
 locale.set(language==='zh'?'en':'zh');await flush();assert.ok(visibleText(h.tree).includes(language==='zh'?'Not configured':'尚未配置'));
});

test('future provider routing state is unknown without exposing its code or offering a grant action',async t=>{
 const locale=localeRuntime();const calls=[];
 const h=await registeredClient({file:new URL('../src/client-ui.js',import.meta.url),locale,href:'http://127.0.0.1:45678',fetch:async(path,init)=>{calls.push({path,init});return{ok:true,json:async()=>path.endsWith('/providers')?{providers:[]}:path.endsWith('/apps')?{apps:[{id:'app-one',name:'Test App'}]}:path.includes('/plan?')?{items:[{state:'future-routing-state',entry:{env:'APP_API_KEY',purpose:'Application access'}}]}:{handoffs:[],pollMs:1500}};}});t.after(()=>h.dispose());h.mountSettings('hanamesh-providers');await flush();
 assert.match(visibleText(h.tree),/Status unavailable/);assert.doesNotMatch(visibleText(h.tree),/future-routing-state/);
 assert.ok(h.find(n=>n.type==='details'&&!n.props.open&&JSON.stringify(n).includes('future-routing-state')));
 assert.ok(!h.find(n=>n.type==='button'&&visibleText(n).match(/Restore|Revoke/)));
 assert.equal(calls.filter(c=>c.init?.method==='POST').length,0);
});

for(const unknown of ['constructor','toString','__proto__'])test(`inherited key ${unknown} remains unknown in source, provider state and route state`,async t=>{
 const locale=localeRuntime();const calls=[];
 const h=await registeredClient({file:new URL('../src/client-ui.js',import.meta.url),locale,href:'http://127.0.0.1:45678',fetch:async(path,init)=>{calls.push({path,init});return{ok:true,json:async()=>path.endsWith('/providers')?{providers:[{id:'provider-unknown',displayName:'Unknown Provider',source:unknown,state:unknown,models:[]}]}:path.endsWith('/apps')?{apps:[{id:'app-one',name:'Test App'}]}:path.includes('/plan?')?{items:[{state:unknown,entry:{env:'APP_API_KEY',purpose:'Application access'}}]}:{handoffs:[],pollMs:1500}};}});t.after(()=>h.dispose());h.mountSettings('hanamesh-providers');await flush();
 assert.match(visibleText(h.tree),/Source unavailable/);assert.equal(visibleText(h.tree).split('Status unavailable').length-1,2);
 assert.ok(h.find(n=>n.type==='details'&&!n.props.open&&JSON.stringify(n).includes(unknown)));
 assert.ok(!h.find(n=>n.type==='button'&&visibleText(n).match(/Restore|Revoke/)));assert.equal(calls.filter(c=>c.init?.method==='POST').length,0);
});

for(const language of ['zh','en'])test(`R1 provider guidance uses host ${language} menu and keeps implementation in technical details`,async t=>{
 const locale=localeRuntime();locale.set(language);
 const h=await registeredClient({file:new URL('../src/client-ui.js',import.meta.url),locale,href:'http://127.0.0.1:45678',fetch:async path=>({ok:true,json:async()=>path.endsWith('/providers')?{providers:[]}:{apps:[]}})});t.after(()=>h.dispose());h.mountSettings('hanamesh-providers');await flush();
 const shown=visibleText(h.tree);assert.doesNotMatch(shown,/profile|注入|槽位|injection|slots/i);
 assert.ok(shown.includes(language==='zh'?'DSH「模型」':'DSH Models'));
 assert.ok(h.find(n=>n.type==='details'&&!n.props.open&&visibleText(n.children).includes(language==='zh'?'技术详情':'Technical details')));
 if(language==='zh')assert.doesNotMatch(shown,/Models/);
});
