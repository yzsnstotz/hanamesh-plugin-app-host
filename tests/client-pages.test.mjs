import test from 'node:test';
import assert from 'node:assert/strict';
import {clientHarness,settle,fakeClock} from './fixtures/client-ui-harness.mjs';
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

test('VR1 installed cards show latest compatible version and selected history reopens exact confirmation',async t=>{
 const current={...item,installed:{state:'installed',version:'1.0.0'},latestVersion:'1.1.0',upgradeAvailable:true};const calls=[];
 const h=await clientHarness({fetch:async(path,init)=>{calls.push({path,init});if(path==='/hanamesh/library/version/install'){const input=JSON.parse(init.body);current.installed={...current.installed,packageName:current.package.name,version:input.version};return response({status:'already-installed'});}if(path.startsWith('/hanamesh/library/versions?'))return response({latestVersion:'1.1.0',versions:[{version:'2.0.0',compatible:false},{version:'1.1.0',compatible:true},{version:'0.9.0',compatible:true}]});if(path.startsWith('/hanamesh/library/version-target?'))return response({source:{kind:'fixture'},item:{...current,selectedVersion:new URL(path,'http://fixture').searchParams.get('version'),installTarget:{...item.installTarget,version:new URL(path,'http://fixture').searchParams.get('version')},upgradeAvailable:true}});return response({items:[current],installed:[],plugins:[],page:{}});}});t.after(()=>h.unmount());
 assert.match(text(h.tree),/1\.0\.0/);assert.match(text(h.tree),/1\.1\.0/);
 await h.click('升级');await settle();assert(calls.at(-1).path.includes('version=1.1.0'));assert.equal(calls.some(row=>row.init?.method==='POST'),false);
 assert.equal(h.find(node=>node.type==='button'&&node.children.includes('确认安装')).props.disabled,true);
 await h.click('取消');await h.click('选择历史版本');await settle();
 const select=h.find(node=>node.type==='select'&&node.props['aria-label']==='插件版本');assert(select);
 assert.equal(h.find(node=>node.type==='option'&&node.props.value==='2.0.0').props.disabled,true);
 select.props.onChange({target:{value:'0.9.0'}});await settle();await h.click('安装所选版本');await settle();
 assert(calls.at(-1).path.includes('version=0.9.0'));assert.equal(h.find(node=>node.type==='button'&&node.children.includes('确认安装')).props.disabled,true);
 await acknowledgeInstall(h);await h.click('确认安装');await settle();const mutation=calls.find(row=>row.path==='/hanamesh/library/version/install');assert.equal(JSON.parse(mutation.init.body).version,'0.9.0');
});


test('VR1 suite confirmation shows the exact bundle transition when component versions stay the same',async t=>{
 const suite={id:'hanamesh:suite-upgrade',displayName:'HanaMesh 套件',kind:'suite-upgrade',package:{name:'@hanamesh/hanamesh'},installed:{state:'installed',version:'0.1.6'},upgradeAvailable:true,suiteUpgrade:{bundle:{from:'0.1.6',to:'0.1.7'},components:[{name:'@hanamesh/core',label:'Core',from:'0.3.36',to:'0.3.36'}]}};
 const h=await clientHarness({fetch:async path=>path.startsWith('/hanamesh/library/target?')?response({source:{kind:'fixture'},item:suite}):response({items:[],installed:[],plugins:[],page:{}})});t.after(()=>h.unmount());
 await h.module.openInstallTarget({itemId:suite.id});await settle();
 const confirmation=h.find(node=>node.props['data-suite-confirmation']);assert(confirmation);assert.match(text(confirmation),/0\.1\.6 → 0\.1\.7/);
 assert.equal(h.find(node=>node.type==='button'&&node.children.includes('确认安装')).props.disabled,true);
});


test('R162-F01 scoped Brand has no installed-row uninstall control while third-party plugins remain operable',async t=>{
 const h=await clientHarness({fetch:async()=>response({items:[],installed:[],plugins:[{packageName:'@hanamesh/brand',version:'0.1.4',state:'installed'},{packageName:'fixture-third-party',version:'1.0.0',state:'installed'}],page:{}})});t.after(()=>h.unmount());
 assert.equal(Boolean(h.find(n=>n.props['data-hanamesh-installed']==='@hanamesh/brand')),false);
 assert(h.find(n=>n.props['data-hanamesh-installed']==='fixture-third-party'));assert(h.find(n=>n.type==='button'&&n.children.includes('卸载')));
});

test('R162-F02 suspended versions preserve the first screen, bound concurrency, reuse reads and isolate item updates',async t=>{
 const items=['alpha','beta','gamma'].map(name=>({...item,id:name,displayName:name,package:{registry:'npm',name},installed:{state:'installed',version:'1.0.0'},installTarget:{...item.installTarget,name}}));const pending=new Map(),calls=[];
 const h=await clientHarness({fetch:async(path,init)=>{
  if(path.startsWith('/hanamesh/library/versions?')){const id=new URL(path,'http://fixture').searchParams.get('itemId');calls.push(id);return new Promise((resolve,reject)=>{pending.set(id,{resolve:v=>resolve(response(v)),reject,signal:init.signal});init.signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true});});}
  return response({source:{kind:'fixture'},versionQueries:{concurrency:2,cacheMs:30000,scope:'one'},items,installed:[],plugins:[{packageName:'fixture-third-party',version:'1.0.0',state:'installed'}],page:{}});
 }});t.after(()=>h.unmount());
 for(const name of ['alpha','beta','gamma'])assert.match(text(h.tree),new RegExp(name));assert(h.find(n=>n.type==='button'&&n.children.includes('详情')));assert(h.find(n=>n.type==='button'&&n.children.includes('卸载')));
 assert.deepEqual(calls,['alpha','beta']);
 pending.get('alpha').resolve({latestVersion:'1.1.0',installedVersion:'1.0.0',upgradeAvailable:true,versions:[{version:'1.1.0',compatible:true}]});await settle();assert.deepEqual(calls,['alpha','beta','gamma']);assert.match(text(h.tree),/1\.1\.0/);
 pending.get('beta').reject(Error('REGISTRY_OFFLINE'));await settle();const beta=h.find(n=>n.props['data-hanamesh-library-item']==='beta');assert.match(text(beta),/REGISTRY_OFFLINE/);assert.doesNotMatch(text(h.find(n=>n.props['data-hanamesh-library-item']==='alpha')),/REGISTRY_OFFLINE/);
 await h.click('搜索');await settle();assert.deepEqual(calls,['alpha','beta','gamma'],'same source/installed facts reuse both completed and pending reads');
 h.unmount();assert.equal(pending.get('gamma').signal.aborted,true,'unmount aborts the outstanding request');
});

test('R162-F02 leaving the market cancels outstanding and queued reads, and stale responses never replace the next source',async t=>{
 let source='one';const pending=[],items=['alpha','beta'].map(name=>({...item,id:name,displayName:name,installed:{state:'installed',version:'1.0.0'}}));
 const h=await clientHarness({embedded:false,fetch:async(path,init)=>{if(path.startsWith('/hanamesh/library/versions?'))return new Promise(resolve=>pending.push({resolve,signal:init.signal}));return response({source:{kind:'fixture',path:source},versionQueries:{concurrency:1,cacheMs:30000,scope:source},items,installed:[],plugins:[],page:{}});}});t.after(()=>h.unmount());
 await h.show();assert.equal(pending.length,1);await h.hide();assert.equal(pending[0].signal.aborted,true);
 source='two';await h.show();assert.equal(pending.length,2);pending[0].resolve(response({latestVersion:'9.9.9',versions:[]}));await settle();assert.doesNotMatch(text(h.tree),/9\.9\.9/);assert.equal(pending.length,2,'old queue must not start after cancellation');
 pending[1].resolve(response({latestVersion:'1.1.0',versions:[]}));await settle();assert.match(text(h.tree),/1\.1\.0/);
});


test('R162-F02 history and reload reuse fresh results while an expired result refreshes on the next explicit load',async t=>{
 const clock=fakeClock();let calls=0;const current={...item,installed:{state:'installed',version:'1.0.0'}};
 const h=await clientHarness({clock,fetch:async path=>{if(path.startsWith('/hanamesh/library/versions?')){calls++;return response({latestVersion:calls===1?'1.1.0':'1.2.0',installedVersion:'1.0.0',upgradeAvailable:true,versions:[{version:'1.2.0',compatible:true},{version:'1.1.0',compatible:true}]});}return response({source:{kind:'fixture'},versionQueries:{concurrency:1,cacheMs:1000,scope:'same'},items:[current],installed:[],plugins:[],page:{}});}});t.after(()=>h.unmount());
 assert.equal(calls,1);await h.click('选择历史版本');assert.equal(calls,1);await h.click('搜索');assert.equal(calls,1);await clock.advance(1001);assert.equal(calls,1,'expiry is not automatic retry');await h.click('搜索');assert.equal(calls,2);assert.match(text(h.tree),/1\.2\.0/);
});

test('R162-F02 an uninstalled item expands on its first manual query and discards display metadata from a previous source',async t=>{
 let scope='first',calls=0;
 const h=await clientHarness({fetch:async path=>{if(path.startsWith('/hanamesh/library/versions?')){calls++;const version=scope==='first'?'1.1.0':'2.0.0';return response({latestVersion:version,installedVersion:null,upgradeAvailable:false,versions:[{version,compatible:true}]});}return response({source:{kind:'fixture',path:scope},versionQueries:{concurrency:1,cacheMs:30000,scope},items:[item],installed:[],plugins:[],page:{}});}});t.after(()=>h.unmount());
 assert.equal(calls,0,'uninstalled items do not trigger automatic discovery');await h.click('选择历史版本');assert.equal(calls,1);assert.equal(Boolean(h.find(n=>n.type==='select'&&n.props['aria-label']==='插件版本')),true);assert.match(text(h.tree),/1\.1\.0/);
 scope='second';await h.click('搜索');assert.doesNotMatch(text(h.tree),/1\.1\.0/,'old source display metadata must be invalidated even without an automatic query');await h.click('选择历史版本');assert.equal(calls,2);assert.equal(Boolean(h.find(n=>n.type==='select'&&n.props['aria-label']==='插件版本')),true);assert.match(text(h.tree),/2\.0\.0/);await h.click('选择历史版本');assert.equal(calls,2);
});
