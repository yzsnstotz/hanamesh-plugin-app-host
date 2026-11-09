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
 for(const label of ['GitHub 星数','npm 下载 / 30 天','安装人数','使用人数'])assert.match(text(h.tree),new RegExp(label));
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
 assert(entries.some(row=>row.options.name==='sidebar.panellist'&&row.options.id==='hanamesh-library'));
 assert.equal(entries.some(row=>['root','sidebar','conversation'].includes(row.options.name)),false);
 await h.module.openInstallTarget({itemId:item.id});assert.equal(selected.at(-1),'hanamesh-library');stop();assert.equal(released.length,3);
});
test('website links follow the reviewed HanaMesh catalog provider without guessing other provider routes',async t=>{
 const{h}=await fixture(t);
 assert.equal(h.module.catalogWebsiteLink({kind:'fixture',manifestUrl:'https://example.invalid/catalog-source.json?view=hanamesh'},item),null);
 assert.equal(h.module.catalogWebsiteLink({manifestUrl:'https://example.invalid/other.json'},item),null);
 assert.equal(h.module.catalogWebsiteLink({manifestUrl:'https://example.invalid/catalog-source.json?view=hanamesh'},item),'https://example.invalid/hana/fixture%3Anotes');
});
