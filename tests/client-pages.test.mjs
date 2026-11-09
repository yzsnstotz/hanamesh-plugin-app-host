import test from 'node:test';
import assert from 'node:assert/strict';
import {clientHarness,settle} from './fixtures/client-ui-harness.mjs';
import {acknowledgeInstall} from './fixtures/install-review.mjs';
const item={id:'fixture:notes',displayName:'Notes fixture',summary:'Local source fixture',description:'Long fixture description',kind:'plugin',package:{registry:'npm',name:'fixture-notes'},installTarget:{source:'npm',name:'fixture-notes',version:'1.0.0',allowBuild:[]},source:{sourceId:'fixture',sourceRef:'notes',sourceLinks:[]},installed:null};
const text=node=>!node?'':Array.isArray(node)?node.map(text).join(' '):typeof node==='object'?text(node.children):String(node);
const response=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
async function fixture(t){const calls=[];const h=await clientHarness({fetch:async(path,init)=>{calls.push({path,init});if(path.startsWith('/hanamesh/library/target?'))return response({source:{kind:'fixture'},item});if(path.startsWith('/hanamesh/library'))return response({source:{kind:'fixture'},items:[item],installed:[],plugins:[],page:{}});throw Error('UNEXPECTED_ROUTE');}});t.after(()=>h.unmount());return{h,calls};}

test('details preserve unknown credibility counts, source text and existing install ownership',async t=>{
 const{h,calls}=await fixture(t);await h.click('详情');assert.match(text(h.tree),/Long fixture description/);
 for(const label of ['GitHub 星数','npm 下载 / 30 天','DSH 安装 / 30 天','使用人数 / 30 天'])assert.match(text(h.tree),new RegExp(label));
 assert.equal(h.module.credibilityFacts().every(row=>row.value===null&&row.reason==='catalog-field-unavailable'),true);
 assert.match(text(h.tree),/不代表 0/);assert.equal(calls.some(row=>row.init?.method==='POST'),false);
 await h.click('返回应用库');assert(h.find(node=>node.type==='button'&&node.children.includes('详情')));
});
test('install requires acknowledgement of the current target and a replacement target clears acceptance',async t=>{
 const{h,calls}=await fixture(t);await h.module.openInstallTarget({itemId:item.id});await settle();
 let confirm=h.find(node=>node.type==='button'&&node.children.includes('确认安装'));assert.equal(confirm.props.disabled,true);
 confirm.props.onClick();await settle();assert.equal(calls.some(row=>row.init?.method==='POST'),false);
 await acknowledgeInstall(h);confirm=h.find(node=>node.type==='button'&&node.children.includes('确认安装'));assert.equal(confirm.props.disabled,false);
 // A newly resolved target must be reviewed again even if its display id is the same.
 await h.module.openInstallTarget({itemId:item.id});await settle();
 assert.equal(h.find(node=>node.type==='button'&&node.children.includes('确认安装')).props.disabled,true);
});
test('public main keys and sidebar id match, do not replace host structure and release together',async t=>{
 const{h}=await fixture(t),entries=[],released=[],selected=[];
 const stop=h.module.registerAppHostPages({layout:{selectPanel:id=>selected.push(id)},slots:{inject(_name,run){return run();},register(options,component){entries.push({options,component});return()=>released.push(options.key??options.id);}}});
 assert(entries.some(row=>row.options.name==='main'&&row.options.key==='hanamesh-library'));
 assert(entries.some(row=>row.options.name==='main'&&row.options.key==='hanamesh-providers'));
 assert(entries.some(row=>row.options.name==='sidebar.panellist'&&row.options.id==='hanamesh-library'&&row.options.order===-20));
 assert.equal(entries.some(row=>['root','sidebar','conversation'].includes(row.options.name)),false);
 await h.module.openInstallTarget({itemId:item.id});assert.equal(selected.at(-1),'hanamesh-library');stop();assert.equal(released.length,3);
});
test('website links follow the reviewed HanaMesh catalog provider without guessing other provider routes',async t=>{
 const{h}=await fixture(t);
 assert.equal(h.module.catalogWebsiteLink({kind:'fixture',manifestUrl:'https://example.invalid/catalog-source.json?view=hanamesh'},item),null);
 assert.equal(h.module.catalogWebsiteLink({manifestUrl:'https://example.invalid/other.json'},item),null);
 assert.equal(h.module.catalogWebsiteLink({manifestUrl:'https://example.invalid/catalog-source.json?view=hanamesh'},item),'https://example.invalid/hana/fixture%3Anotes');
});

test('credibility preserves exact public counters, timestamps and missing values without calling the signal feed',async t=>{
 const{h}=await fixture(t);
 const source={manifestUrl:'https://example.invalid/catalog-source.json?view=hanamesh'},calls=[];
 const read=async(url,options)=>{calls.push({url,options});return response(url.includes('/api/v2/')?{hanaId:item.id,signals:{stars:0,npmDownloads30d:1789,storeInstalls30d:null,checkedAt:'2026-11-09T00:00:00Z'}}:{hanaId:item.id,users30d:16,asOf:'2026-11-10T00:00:00Z'});};
 const facts=await h.module.readCredibility(source,item,read);
 assert.deepEqual(h.module.credibilityFacts(facts).map(row=>row.value),[0,1789,null,16]);
 assert.equal(facts.checkedAt,'2026-11-09T00:00:00Z');assert.equal(facts.asOf,'2026-11-10T00:00:00Z');
 assert.equal(calls.length,2);assert(calls.every(row=>row.options.credentials==='omit'&&row.options.redirect==='error'&&row.options.method==='GET'));
 assert.equal(calls.some(row=>row.url.includes('/signals/changes')),false);
 const missing=await h.module.readCredibility(source,item,async()=>{throw Error('network unavailable')});
 assert(h.module.credibilityFacts(missing).every(row=>row.value===null));
 const wrong=await h.module.readCredibility(source,item,async()=>response({hanaId:'other',signals:{stars:99},users30d:55}));
 assert(h.module.credibilityFacts(wrong).every(row=>row.value===null));
 assert.equal(h.module.credibilityFacts({signals:{stars:-1,npmDownloads30d:NaN,storeInstalls30d:null},popularity:{installCount:77,users30d:null}}).every(row=>row.value===null),true);
 let unknownCalls=0;await h.module.readCredibility({manifestUrl:'https://example.invalid/other.json'},item,async()=>{unknownCalls++;});assert.equal(unknownCalls,0);
});


test('main details use their own title and hide library search and category tabs',async t=>{
 const h=await clientHarness({mainPage:true,fetch:async()=>response({source:{kind:'fixture'},items:[item],installed:[],plugins:[],page:{}})});t.after(()=>h.unmount());await h.click('详情');
 assert(h.find(node=>node.type==='h1'&&node.children.includes(item.displayName)));
 assert.equal(h.find(node=>node.type==='input'&&node.props.type==='search'),undefined);
 assert.equal(h.find(node=>node.props.role==='tablist'),undefined);
 assert.match(text(h.tree),/HanaMesh \/ 应用详情/);
});
