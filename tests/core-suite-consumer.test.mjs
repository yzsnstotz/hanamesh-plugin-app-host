import {SUITE_INSTALL_COMMAND} from '@hanamesh/core/suite';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {scratch} from './helpers.mjs';
import {SUITE_PACKAGES,prepareSuiteUpgrade} from '../src/library/suite.js';
import {createLibraryInstaller} from '../src/library/install.js';
import {createLibraryService} from '../src/library/service.js';
import {clientHarness,settle,fakeClock} from './fixtures/client-ui-harness.mjs';

const missing='Core 未提供套件声明';
// An App-host execution-port double, deliberately NOT a proposed Core wire DTO/getter.
const approved=()=>({available:true,installCommand:SUITE_INSTALL_COMMAND,components:SUITE_PACKAGES.map((p,i)=>({name:p.name,label:p.label,from:['0.3.12','0.2.0-rc.34','0.6.5'][i],to:['0.4.0','0.3.0','0.7.0'][i]}))});
async function profile(){const root=await scratch('core-suite-consumer-'),dependencies={};for(const c of approved().components){dependencies[c.name]=c.from;await mkdir(join(root,'node_modules',c.name),{recursive:true});await writeFile(join(root,'node_modules',c.name,'package.json'),JSON.stringify({name:c.name,version:c.from}));}await writeFile(join(root,'package.json'),JSON.stringify({dependencies,dsh:{profile:{bundles:Object.keys(dependencies)}}}));return root;}
const noRegistry=async()=>{assert.fail('App-host must not select or judge suite candidates from registry metadata');};

test('missing Core declaration refuses before registry access or an installation plan',async()=>{
  const root=await profile();
  await assert.rejects(prepareSuiteUpgrade({profileDir:root,registry:'https://registry.example.test',fetchImpl:noRegistry}),{code:'CORE_SUITE_DECLARATION_MISSING',message:missing});
  await assert.rejects(prepareSuiteUpgrade({coreSuitePlan:async()=>null}),{code:'CORE_SUITE_DECLARATION_MISSING',message:missing});
});

test('Core alone selects compatible targets; App-host consumes ranges beyond its former literals without registry queries',async()=>{
  const root=await profile(),supplied=approved();let reads=0;
  const actual=await prepareSuiteUpgrade({profileDir:root,registry:'https://registry.example.test',fetchImpl:noRegistry,coreSuitePlan:async()=>{reads++;return supplied;}});
  assert.deepEqual(actual,approved());assert.equal(reads,1);
  actual.components[0].to='99.0.0';assert.equal(supplied.components[0].to,'0.4.0');
});

test('provider decisions and named errors are not reconstructed or silently replaced',async()=>{
  const root=await profile(),plan=approved();plan.available=false;
  assert.equal((await prepareSuiteUpgrade({profileDir:root,registry:'https://registry.example.test',fetchImpl:noRegistry,coreSuitePlan:async()=>plan})).available,false);
  const error=Object.assign(new Error('Core refuses this combination'),{code:'SUITE_INCOMPATIBLE'});
  await assert.rejects(prepareSuiteUpgrade({profileDir:root,registry:'https://registry.example.test',fetchImpl:noRegistry,coreSuitePlan:async()=>{throw error;}}),e=>e===error);
});

test('the execution seam refuses malformed plans and components outside the fixed suite',async()=>{
  for(const change of [p=>{p.available='yes';},p=>{p.components.pop();},p=>{p.components[0].name='unrelated-plugin';},p=>{p.components[0].to='latest';},p=>{p.components[1].name=p.components[0].name;}]){
    const plan=approved();change(plan);
    await assert.rejects(prepareSuiteUpgrade({coreSuitePlan:async()=>plan}),{code:'CORE_SUITE_DECLARATION_INVALID'});
  }
});

test('confirmation rereads the Core port and cannot install after its approval is withdrawn',async()=>{
  const root=await profile();let provided=true,writes=0,reads=0;
  const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.js'),coreSuitePlan:async()=>{reads++;return provided?approved():null;},fetchImpl:noRegistry,spawn:async()=>{writes++;return{code:0};}});
  const plan=await installer.prepareSuiteUpgrade();provided=false;
  await assert.rejects(installer.upgradeSuite({planId:plan.planId}),{code:'CORE_SUITE_DECLARATION_MISSING',message:missing});
  assert.equal(reads,2);assert.equal(writes,0);
});

test('normal library discovery shows missing Core declaration while retaining actual installed versions and rejecting upgrade',async t=>{
  const root=await profile();let state={schema:1,revision:0,sources:[]};
  const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.js'),fetchImpl:noRegistry,spawn:async()=>assert.fail('no CLI')});
  const library=await createLibraryService({domain:{global:{get:async()=>state,set:async value=>{state=value;}},close:async()=>{}},host:{instanceList:()=>[],list:()=>({apps:[]})},dataRoot:root,installer,config:{profileDir:root,fixture:join(import.meta.dirname,'fixtures/catalog/provider-page.json')}}).init();t.after(()=>library.close());
  const item=(await library.list({category:''})).items.find(i=>i.kind==='suite');
  assert.equal(item.suiteUpgradeUnavailable,missing);assert.equal(item.suite.components[0].version,'0.3.12');
  await assert.rejects(library.resolveTarget({itemId:'hanamesh:suite-upgrade'}),{code:'CORE_SUITE_DECLARATION_MISSING',message:missing});
});

test('the actual market component renders the missing declaration and disables upgrade',async t=>{
  const h=await clientHarness({fetch:async()=>({ok:true,json:async()=>({items:[{id:'hanamesh:suite',kind:'suite',summary:'official',suiteUpgradeUnavailable:missing,suite:{status:'installed',version:'0.3.12',components:[]}}],installed:[],plugins:[],page:{}})})});t.after(()=>h.unmount());await settle();
  assert.ok(JSON.stringify(h.tree).includes(missing));
  const button=h.find(n=>n.type==='button'&&n.children.includes('检查兼容升级'));assert.ok(button);assert.equal(button.props.disabled,true);
});

test('Core refusal before CLI does not claim partial installation or require restart and repair',async t=>{
  const root=await profile();let state={schema:1,revision:0,sources:[]},provided=true,writes=0;
  const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'dsh.js'),coreSuitePlan:async()=>provided?approved():null,fetchImpl:noRegistry,spawn:async()=>{writes++;return{code:0};}});
  const library=await createLibraryService({domain:{global:{get:async()=>state,set:async value=>{state=value;}},close:async()=>{}},host:{instanceList:()=>[],list:()=>({apps:[]})},dataRoot:root,installer,config:{profileDir:root,fixture:join(import.meta.dirname,'fixtures/catalog/provider-page.json')}}).init();t.after(()=>library.close());
  const target=await library.resolveTarget({itemId:'hanamesh:suite-upgrade'});provided=false;
  const operation=await library.upgradeSuite({planId:target.item.suiteUpgrade.planId});
  for(let i=0;i<100&&!library.events().events.some(e=>e.operationId===operation.operationId&&e.type==='library.install-failed');i++)await new Promise(r=>setTimeout(r,5));
  const event=library.events().events.find(e=>e.operationId===operation.operationId&&e.type==='library.install-failed');
  assert.equal(event.code,'CORE_SUITE_DECLARATION_MISSING');assert.equal(event.details?.stage,undefined);
  assert.notEqual(library.installTarget().suite.restartRequired,true);assert.equal(writes,0);
});

test('a direct suite target displays the missing Core declaration instead of only its error code or repair advice',async t=>{
  const h=await clientHarness({fetch:async path=>path.startsWith('/hanamesh/library/target?')?{ok:false,json:async()=>({error:{code:'CORE_SUITE_DECLARATION_MISSING',message:missing}})}:{ok:true,json:async()=>({items:[],installed:[],plugins:[],page:{}})}});t.after(()=>h.unmount());
  await assert.rejects(h.module.openInstallTarget({itemId:'hanamesh:suite-upgrade'}));await settle();
  const text=JSON.stringify(h.tree);assert.ok(text.includes(missing));assert.doesNotMatch(text,/部分组件可能已改变|补齐命令修复/);
});

test('a suite operation timeout does not claim that installation was never executed',async t=>{
  const clock=fakeClock();
  const h=await clientHarness({clock,fetch:async path=>{
    let value={items:[],installed:[],plugins:[],page:{}};
    if(path.startsWith('/hanamesh/library/target?'))value={source:{kind:'suite'},item:{id:'hanamesh:suite-upgrade',kind:'suite-upgrade',displayName:'HanaMesh 套件',package:{name:'@hanamesh/core'},upgradeAvailable:true,suiteUpgrade:{...approved(),planId:'fixture'}}};
    else if(path==='/hanamesh/library/suite/upgrade')value={operationId:'accepted',status:'started'};
    else if(path.startsWith('/hanamesh/library/events?'))value={sequence:0,events:[],operations:['accepted']};
    return{ok:true,json:async()=>value};
  }});t.after(()=>h.unmount());
  await h.module.openInstallTarget({itemId:'hanamesh:suite-upgrade'});await h.click('确认安装');await clock.advance(600000);await settle();
  const text=JSON.stringify(h.tree);assert.match(text,/OPERATION_TIMEOUT/);assert.doesNotMatch(text,/套件升级未执行|补齐命令修复/);
});
