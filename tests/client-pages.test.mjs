import test from 'node:test';
import assert from 'node:assert/strict';
import {clientHarness,settle,fakeClock} from './fixtures/client-ui-harness.mjs';
import {acknowledgeInstall} from './fixtures/install-review.mjs';
const item={id:'fixture:notes',displayName:'Notes fixture',summary:'Local source fixture',description:'Long fixture description',kind:'plugin',package:{registry:'npm',name:'fixture-notes'},installTarget:{source:'npm',name:'fixture-notes',version:'1.0.0',allowBuild:[]},source:{sourceId:'fixture',sourceRef:'notes',sourceLinks:[]},installed:null};
const text=node=>!node?'':Array.isArray(node)?node.map(text).join(' '):typeof node==='object'?text(node.children):String(node);
const response=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
async function fixture(t){const calls=[];const h=await clientHarness({fetch:async(path,init)=>{calls.push({path,init});if(path.startsWith('/hanamesh/library/target?'))return response({source:{kind:'fixture'},item});if(path.startsWith('/hanamesh/library'))return response({source:{kind:'fixture'},items:[item],installed:[],plugins:[],page:{}});throw Error('UNEXPECTED_ROUTE');}});t.after(()=>h.unmount());return{h,calls};}

test('install requires acknowledgement of the current target and a replacement target clears acceptance',async t=>{
 const{h,calls}=await fixture(t);await h.module.openInstallTarget({itemId:item.id});await settle();
 let confirm=h.find(node=>node.type==='button'&&node.children.includes('确认安装'));assert.equal(confirm.props.disabled,true);
 confirm.props.onClick();await settle();assert.equal(calls.some(row=>row.init?.method==='POST'),false);
 await acknowledgeInstall(h);confirm=h.find(node=>node.type==='button'&&node.children.includes('确认安装'));assert.equal(confirm.props.disabled,false);
 // A newly resolved target must be reviewed again even if its display id is the same.
 await h.module.openInstallTarget({itemId:item.id});await settle();
 assert.equal(h.find(node=>node.type==='button'&&node.children.includes('确认安装')).props.disabled,true);
});
test('VR1 suite confirmation shows the exact bundle transition when component versions stay the same',async t=>{
 const suite={id:'hanamesh:suite-upgrade',displayName:'HanaMesh 套件',kind:'suite-upgrade',package:{name:'@hanamesh/hanamesh'},installed:{state:'installed',version:'0.1.6'},upgradeAvailable:true,suiteUpgrade:{bundle:{from:'0.1.6',to:'0.1.7'},components:[{name:'@hanamesh/core',label:'Core',from:'0.3.36',to:'0.3.36'}]}};
 const h=await clientHarness({fetch:async path=>path.startsWith('/hanamesh/library/target?')?response({source:{kind:'fixture'},item:suite}):response({items:[],installed:[],plugins:[],page:{}})});t.after(()=>h.unmount());
 await h.module.openInstallTarget({itemId:suite.id});await settle();
 const confirmation=h.find(node=>node.props['data-suite-confirmation']);assert(confirmation);assert.match(text(confirmation),/0\.1\.6 → 0\.1\.7/);
 assert.equal(h.find(node=>node.type==='button'&&node.children.includes('确认安装')).props.disabled,true);
});
