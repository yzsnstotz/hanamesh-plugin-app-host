import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {scratch} from './helpers.mjs';
import {SUITE_PACKAGES,SUITE_INSTALL_COMMAND,readSuiteStatus,prepareSuiteUpgrade} from '../src/library/suite.js';
async function profile(t,prefix='suite-'){const root=await scratch(prefix);const versions={'hanamesh-core':'0.3.11','hanamesh-usage':'0.2.0-rc.34','@hanamesh/dsh-app-host':'0.6.3'};const dependencies={};for(const {name} of SUITE_PACKAGES){dependencies[name]=versions[name];const p=join(root,'node_modules',name);await mkdir(p,{recursive:true});await writeFile(join(p,'package.json'),JSON.stringify({name,version:versions[name]}));}await writeFile(join(root,'package.json'),JSON.stringify({dependencies,dsh:{profile:{bundles:Object.keys(dependencies)}}}));return root;}
const targets={'hanamesh-core':'0.3.12','hanamesh-usage':'0.2.0-rc.35','@hanamesh/dsh-app-host':'0.6.4'};
// Internal normalized execution-port double; public C-CORE DTO coverage is in core-suite-public.test.mjs.
const coreSuitePlan=async()=>({available:true,components:SUITE_PACKAGES.map(p=>({name:p.name,label:p.label,from:({'hanamesh-core':'0.3.11','hanamesh-usage':'0.2.0-rc.34','@hanamesh/dsh-app-host':'0.6.3'})[p.name],to:targets[p.name]}))});
test('suite discovery reads actual three versions and explicit profile activation; unreadable is unknown',async t=>{const root=await profile(t);assert.equal((await readSuiteStatus(root)).status,'installed');assert.equal((await readSuiteStatus(root)).components.length,3);assert.equal((await readSuiteStatus(join(root,'missing'))).status,'unknown');const p=JSON.parse(await import('node:fs/promises').then(m=>m.readFile(join(root,'package.json'),'utf8')));p.dsh.profile.bundles.pop();await writeFile(join(root,'package.json'),JSON.stringify(p));assert.equal((await readSuiteStatus(root)).status,'incomplete');assert.ok(!SUITE_INSTALL_COMMAND.includes('brand'));});
test('only explicit current upgrade confirmation can invoke the official CLI; ordinary protected install remains denied',async t=>{
  const root=await profile(t,'legal-brand-profile-'),{createLibraryInstaller}=await import('../src/library/install.js');assert.ok(root.includes('brand'));let writes=0;
  const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'official-dsh.js'),registry:'https://registry.example.test',coreSuitePlan,fetchImpl:async()=>assert.fail('suite plan is provided by Core'),spawn:async(_command,args)=>{
    writes++;assert.ok(args.includes('--save-exact'));assert.ok(args.includes('--registry=https://registry.example.test'));assert.ok(args.includes('--strict-peer-dependencies'));assert.deepEqual(args,[join(root,'official-dsh.js'),'plugin','--profile','desktop','add','--save-exact','--strict-peer-dependencies','--registry=https://registry.example.test',...SUITE_PACKAGES.map(({name})=>`${name}@${targets[name]}`)]);
    for(const {name} of SUITE_PACKAGES)await writeFile(join(root,'node_modules',name,'package.json'),JSON.stringify({name,version:targets[name]}));
    await writeFile(join(root,'package.json'),JSON.stringify({dependencies:targets,dsh:{profile:{bundles:Object.keys(targets)}}}));return{code:0};
  }});
  await assert.rejects(installer.installPlugin({packageName:'hanamesh-core'}),{code:'PACKAGE_DENIED'});
  await assert.rejects(installer.upgradeSuite({planId:'forged'}),{code:'SUITE_PLAN_CHANGED'});assert.equal(writes,0);
  const plan=await installer.prepareSuiteUpgrade();assert.equal(writes,0,'preview is read-only');
  const result=await installer.upgradeSuite({planId:plan.planId});assert.equal(writes,1);assert.equal(result.status,'restart-required');assert.deepEqual(result.components.map(c=>c.to),Object.values(targets));
  await assert.rejects(installer.upgradeSuite({planId:plan.planId}),{code:'SUITE_PLAN_CHANGED'});assert.equal(writes,1);
});

test('resolved target versions with stale saved specifications cannot report suite upgrade success',async t=>{
  const root=await profile(t),{createLibraryInstaller}=await import('../src/library/install.js');
  const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,nodeBinary:process.execPath,dshBin:join(root,'official-dsh.js'),registry:'https://registry.example.test',coreSuitePlan,fetchImpl:async()=>assert.fail('suite plan is provided by Core'),spawn:async()=>{for(const {name} of SUITE_PACKAGES)await writeFile(join(root,'node_modules',name,'package.json'),JSON.stringify({name,version:targets[name]}));return{code:0};}});
  const plan=await installer.prepareSuiteUpgrade();
  await assert.rejects(installer.upgradeSuite({planId:plan.planId}),error=>error.code==='INSTALL_READBACK_MISMATCH'&&error.details.actual.components[0].version===targets['hanamesh-core']&&error.details.command===SUITE_INSTALL_COMMAND);
});

test('failed partial suite upgrade refreshes discovery and publishes actual versions with repair guidance',async t=>{
  const root=await profile(t),{createLibraryService}=await import('../src/library/service.js');let state={schema:1,revision:0,sources:[]};
  const service=await createLibraryService({domain:{global:{get:async()=>state,set:async value=>{state=value;}},close:async()=>{}},host:{instanceList:()=>[]},dataRoot:root,config:{profileDir:root,fixture:join(import.meta.dirname,'fixtures/catalog/provider-page.json')},installer:{ready:true,install:async()=>{},upgradeSuite:async()=>{
    await writeFile(join(root,'node_modules/hanamesh-core/package.json'),JSON.stringify({name:'hanamesh-core',version:targets['hanamesh-core']}));
    const error=new Error('partial CLI failure');error.code='DSH_PLUGIN_FAILED';error.details={stage:'suite-upgrade',actual:await readSuiteStatus(root),command:SUITE_INSTALL_COMMAND};throw error;
  }}}).init();t.after(()=>service.close());
  const op=await service.upgradeSuite({planId:'fixture-confirmation'});
  for(let i=0;i<100&&!service.events().events.some(e=>e.operationId===op.operationId&&e.type==='library.install-failed');i++)await new Promise(r=>setTimeout(r,5));
  const event=service.events().events.find(e=>e.operationId===op.operationId&&e.type==='library.install-failed');
  assert.equal(event.details.actual.components[0].version,targets['hanamesh-core']);assert.equal(event.details.command,SUITE_INSTALL_COMMAND);
  const discovery=service.installTarget().suite;assert.equal(discovery.version,targets['hanamesh-core']);assert.equal(discovery.upgradeError,'DSH_PLUGIN_FAILED');assert.equal(discovery.restartRequired,true);
});

test('suite failure UI shows partial versions and the repair command without claiming not installed',async t=>{
  const {clientHarness,fakeClock,settle}=await import('./fixtures/client-ui-harness.mjs'),clock=fakeClock();
  const details={stage:'suite-upgrade',actual:{components:SUITE_PACKAGES.map(p=>({...p,version:targets[p.name],active:true}))},command:SUITE_INSTALL_COMMAND};
  const h=await clientHarness({clock,fetch:async path=>{
    let value={items:[],installed:[],plugins:[],page:{}};
    if(path.startsWith('/hanamesh/library/target?'))value={source:{kind:'suite'},item:{id:'hanamesh:suite-upgrade',displayName:'HanaMesh 套件',kind:'suite-upgrade',package:{name:'hanamesh-core'},upgradeAvailable:true,suiteUpgrade:{planId:'fixture',components:SUITE_PACKAGES.map(p=>({...p,from:'0.0.0',to:targets[p.name]}))}}};
    else if(path==='/hanamesh/library/suite/upgrade')value={operationId:'suite-op',status:'started'};
    else if(path.startsWith('/hanamesh/library/events?'))value={sequence:1,events:[{operationId:'suite-op',type:'library.install-failed',code:'DSH_PLUGIN_FAILED',details}]};
    return{ok:true,json:async()=>value};
  }});t.after(()=>h.unmount());
  await h.module.openInstallTarget({itemId:'hanamesh:suite-upgrade'});await settle();await h.click('确认安装');await clock.advance(1000);
  const text=JSON.stringify(h.tree);assert.match(text,/套件升级未完成/);assert.match(text,/部分组件可能已改变/);assert.ok(text.includes(targets['hanamesh-core']));assert.ok(text.includes(SUITE_INSTALL_COMMAND));assert.doesNotMatch(text,/未安装：/);
});
