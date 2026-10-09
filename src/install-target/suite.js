/**
 * Install-target contract conformance suite (hanamesh.install-target v1), shipped with the provider package.
 * Provider cases drive this package's real HTTP routes, library service and client module against the bundled
 * test catalog; consumer cases check what a caller hands to the market; the chain feeds consumer output into the
 * real provider. Fixture data is a test catalog and is labelled as such in the market UI.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createServer, request } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createLibraryService, INSTALL_TARGET_CONTRACT_VERSION } from '../library/service.js';
import { createLibraryHttpHandler } from '../library/routes.js';
import { createLibraryInstaller } from '../library/install.js';
import { loadClient, settle } from './harness.js';
import { createSourceProfile, applicationVersion } from './fixtures/source-profile.js';

const json=async url=>JSON.parse(await readFile(url,'utf8'));
const SCHEMA_URL=new URL('../../schemas/install-target.schema.json',import.meta.url);
const FIXTURES=new URL('./fixtures/',import.meta.url);
const ROUTE='/hanamesh/library/target';

/** Schema, provider declaration and both fixture sets as shipped. */
export async function loadContract(){
  const [schema,pkg,provider,consumer,recovery]=await Promise.all([json(SCHEMA_URL),json(new URL('../../package.json',import.meta.url)),json(new URL('provider-cases.json',FIXTURES)),json(new URL('consumer-cases.json',FIXTURES)),json(new URL('install-failure-cases.json',FIXTURES))]);
  return{schema,contract:schema['x-hanamesh-contract'],declaration:pkg.hanamesh?.installTarget,packageVersion:pkg.version,provider,consumer,recovery,catalogPath:fileURLToPath(new URL(provider.catalog,FIXTURES))};
}

/** Validates the JSON Schema keywords the contract uses; returns readable violations. */
export function validate(schema,value,ref='#/$defs/target'){
  const errors=[];
  const resolve=pointer=>pointer.slice(2).split('/').reduce((node,key)=>node[key],schema);
  const check=(node,value,path)=>{
    if(node.$ref){check(resolve(node.$ref),value,path);}
    const type=Array.isArray(value)?'array':value===null?'null':typeof value;
    if(node.type&&!(Array.isArray(node.type)?node.type:[node.type]).includes(type)){errors.push(`${path}: expected ${node.type}`);return;}
    if('const' in node&&value!==node.const)errors.push(`${path}: must equal ${JSON.stringify(node.const)}`);
    if(node.enum&&!node.enum.includes(value))errors.push(`${path}: not one of ${JSON.stringify(node.enum)}`);
    if(type==='string'){
      if(node.minLength!==undefined&&value.length<node.minLength)errors.push(`${path}: shorter than ${node.minLength}`);
      if(node.maxLength!==undefined&&value.length>node.maxLength)errors.push(`${path}: longer than ${node.maxLength}`);
      if(node.pattern&&!new RegExp(node.pattern,'u').test(value))errors.push(`${path}: does not match the contract grammar`);
    }
    if(type==='object'){
      for(const key of node.required??[])if(!(key in value))errors.push(`${path}: missing ${key}`);
      for(const [key,child] of Object.entries(node.properties??{}))if(key in value)check(child,value[key],`${path}.${key}`);
      if(node.additionalProperties===false)for(const key of Object.keys(value))if(!(key in (node.properties??{})))errors.push(`${path}: field ${key} is not part of the contract`);
    }
    if(type==='array'&&node.items)value.forEach((item,index)=>check(node.items,item,`${path}[${index}]`));
    if(node.anyOf&&!node.anyOf.some(option=>{const before=errors.length;check(option,value,path);const ok=errors.length===before;errors.length=before;return ok;}))errors.push(`${path}: needs one of ${node.anyOf.map(o=>JSON.stringify(o.required??o)).join(' / ')}`);
  };
  check(resolve(ref),value,'target');return errors;
}

function recorder(suite){
  const results=[];
  const record=async(id,semantic,note,run)=>{try{const detail=await run();results.push({id,semantic,note,outcome:detail==='skipped'?'skipped':'pass',...(detail&&detail!=='skipped'?{detail}:{})});}
    catch(error){results.push({id,semantic,note,outcome:'fail',detail:String(error.message??error)});}};
  const summary=extra=>({suite,...extra,total:results.length,pass:results.filter(r=>r.outcome==='pass').length,fail:results.filter(r=>r.outcome==='fail').length,skipped:results.filter(r=>r.outcome==='skipped').length,results});
  return{record,summary};
}
const expectEqual=(actual,expected,what)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);};

/** Starts the real provider routes on a random loopback port with the bundled test catalog and a counting installer. */
export async function startProvider({catalogPath},{profile,installer:real}={}){
  let state={schema:1,revision:0,sources:[]};const installs=[],pending=[];const token=randomUUID();let service;
  // rc.10: recovery cases install through the real installer on a SOURCE profile; every other case keeps the counting installer.
  let made;const installer=profile?{install:(item,context)=>{installs.push(item.package.name);const work=(made??=real(event=>service.emit(event))).install(item,context);pending.push(work.catch(()=>{}));return work;}}
    :{install:async item=>{installs.push(item.package.name);return{kind:'plugin',status:'restart-required'};}};
  service=await createLibraryService({domain:{global:{get:async()=>state,set:async next=>{state=next;}},close:async()=>{}},host:{list:()=>({apps:[]}),instanceList:()=>[]},
    config:{fixture:catalogPath,...(profile?{profileDir:profile.profileDir}:{})},...(profile?{dataRoot:profile.dataRoot,ledgerReader:profile.ledger}:{}),installer}).init();
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  server.on('request',createLibraryHttpHandler(service,{parentOrigin:origin,
    authenticate:async req=>req.headers['x-install-target-suite']===token?{principalId:'install-target-suite'}:null,
    authorize:async(_subject,_path,input)=>input.packageName!=='@hanamesh-fixture/forbidden'}));
  const origins=[origin,origin.replace('127.0.0.1','localhost')];
  const posts=[];
  /** Same-origin browser fetch as the workspace page would issue it. */
  const browserFetchFor=workspaceOrigin=>async(path,init={})=>{const method=init.method??'GET';if(method!=='GET')posts.push({path,headers:{...init.headers}});
    return await fetch(workspaceOrigin+path,{...init,headers:{...init.headers,'x-install-target-suite':token,...(method==='GET'?{}:{origin:workspaceOrigin})}});};
  return{origin,origins,token,service,installs,posts,settled:async()=>{await Promise.all(pending);await settle();},browserFetch:browserFetchFor(origin),browserFetchFor,
    get:(query,headers={})=>fetch(origin+ROUTE+(query?'?'+query:''),{headers:{'x-install-target-suite':token,...headers}}),
    close:async()=>{await new Promise(r=>server.close(r));await service.close();}};
}

/** rc.10: a SOURCE profile holding the recovery fixture registry, with the case's injected failures and the real installer factory. */
export async function sourceRecoveryProfile({recovery},item={}){
  const {application:app,plugin}=recovery;
  const registry={[app.packageName]:[{version:app.previous,app:applicationVersion({appId:app.appId,version:app.previous}).app},{version:app.latest,app:applicationVersion({appId:app.appId,version:app.latest,invalid:Boolean(item.invalidDefinition)}).app}],
    [plugin.packageName]:[{version:plugin.latest,bundle:true}]};
  const profile=await createSourceProfile({registry}),target=item.kind==='plugin'?plugin:app;
  if(item.mode==='upgrade')await profile.seed(target.packageName,app.previous);
  for(const [command,phase,skip] of item.inject??[])profile.fail(command,phase,skip);
  if(item.concurrent)profile.concurrentAdd('@fixture/concurrent','1.0.0');
  const installer=emit=>createLibraryInstaller({profileDir:profile.profileDir,profileName:profile.profileName,dataRoot:profile.dataRoot,nodeBinary:'/source-fixture/bin/node',dshBin:'/source-fixture/dsh/lib/bin.js',
    fetchImpl:profile.fetchImpl(item.registryMissing?{}:{[app.packageName]:app.latest,[plugin.packageName]:plugin.latest}),spawn:profile.spawn,provision:profile.provision,remove:profile.remove,ledger:profile.ledger,emit});
  return{profile,target,installer};
}
/** Independent readback of the SOURCE profile: exact package.json/lockfile text, resolved module version, runtime ledger without timestamps. */
async function profileState({profile},name,appId){
  const read=path=>readFile(path,'utf8').catch(error=>error.code==='ENOENT'?null:Promise.reject(error));
  const module=await read(join(profile.profileDir,'node_modules',...name.split('/'),'package.json'));
  const ledger=Object.fromEntries(Object.entries((await profile.ledger(join(profile.dataRoot,'runtimes',appId))).items).map(([id,{installedAt:_,...entry}])=>[id,entry]));
  return{manifest:await read(join(profile.profileDir,'package.json')),lock:await read(join(profile.profileDir,'pnpm-lock.yaml')),module:module===null?null:JSON.parse(module).version,ledger};
}
/** Runs one install-failure case through the real service and installer on a fresh SOURCE profile; returns the failure event. */
export async function runRecoveryCase(contract,item,{check=true}={}){
  const {schema,recovery}=contract;const source=await sourceRecoveryProfile(contract,item);const {profile,target}=source;const appId=recovery.application.appId;
  const host=await startProvider(contract,{profile,installer:source.installer});
  try{
    const sentinel=join(profile.dataRoot,'principal',appId,'local','data-v1','single','user.db');await mkdir(dirname(sentinel),{recursive:true});await writeFile(sentinel,'keep');
    const before=await profileState(source,target.packageName,appId);
    const started=await host.service.install({packageName:target.packageName});await host.settled();
    const events=host.service.events().events.filter(event=>event.operationId===started.operationId),failed=events.find(event=>event.type==='library.install-failed');
    if(!failed||events.some(event=>event.type==='library.install-done'))throw new Error('expected one failed operation, got '+JSON.stringify(events.map(event=>event.type)));
    if(!check)return failed;
    const errors=validate(schema,failed,'#/$defs/installFailed');if(errors.length)throw new Error(errors.join('; '));
    const result=failed.recovery,fill=text=>text.replaceAll('$package',target.packageName).replaceAll('$previous',recovery.application.previous);
    expectEqual([failed.code,result.status,result.mode,result.stage,result.previousVersion],[item.expect.code,item.expect.status,item.mode,item.stage,item.mode==='upgrade'?recovery.application.previous:null],'original error and recovery result');
    expectEqual(result.actions,item.expect.actions.map(fill),'compensation actions');
    expectEqual(result.error?.code??null,item.expect.recoveryError??null,'compensation error');
    expectEqual([...new Set(result.residue.map(row=>row.item))].sort(),[...(item.expect.residue??[])].sort(),'residue');
    expectEqual(profile.calls.filter(call=>call[0]==='add'&&call.at(-1)===`${target.packageName}@${target.latest}`).length,item.registryMissing?0:1,'add attempts (no automatic retry)');
    expectEqual(await readFile(sentinel,'utf8'),'keep','application data under dataRoot');
    const after=await profileState(source,target.packageName,appId);
    if(result.status==='failed'){
      const unowned=result.residue.some(row=>row.reason==='UNOWNED_FILES_KEPT');
      if(JSON.stringify(after)===JSON.stringify(before)&&!item.concurrent&&!unowned)throw new Error('failed recovery reported for a profile equal to its baseline');
      expectEqual(await readFile(join(result.originals.dir,'package.json'),'utf8'),before.manifest,'kept original package.json');
      if(item.concurrent&&!JSON.parse(after.manifest).dependencies['@fixture/concurrent'])throw new Error('concurrent profile write was undone');
      if(unowned)await readFile(join(profile.dataRoot,'runtimes',appId,'runtime','unowned.txt'));
    }else expectEqual(after,before,'independent readback against the baseline');
    return`SOURCE: ${result.status}; ${result.actions.length} compensation action(s); readback ${result.checks.filter(row=>row.ok).length}/${result.checks.length}`;
  }finally{await host.close();await profile.cleanup();}
}
async function runRecoveryProvider(contract,record){
  const {recovery,schema}=contract;
  await record('RD01','recovery','schema declares the install-failed recovery result and the SOURCE fixture is labelled',async()=>{
    expectEqual(contract.contract.installRecovery?.since,'0.2.0-rc.10','installRecovery.since');expectEqual(recovery.evidence,'SOURCE','fixture evidence label');
    if(!schema.$defs.recovery||!schema.$defs.installFailed)throw new Error('recovery definitions missing');
    for(const item of recovery.presentation)if(item.recovery){const errors=validate(schema,item.recovery,'#/$defs/recovery');if(errors.length)throw new Error(item.id+': '+errors.join('; '));}
  });
  for(const item of recovery.cases)await record(item.id,'recovery',`${item.mode} · ${item.stage}: ${item.note}`,()=>runRecoveryCase(contract,item));
  for(const mode of ['new-install','upgrade'])await record(mode==='upgrade'?'RS02':'RS01','recovery',mode+' without failure: install-done only after the profile reads back the exact version',async()=>{
    const source=await sourceRecoveryProfile(contract,{mode});const host=await startProvider(contract,{profile:source.profile,installer:source.installer});
    try{const started=await host.service.install({packageName:source.target.packageName});await host.settled();
      const done=host.service.events().events.find(event=>event.operationId===started.operationId&&event.type==='library.install-done');
      if(!done)throw new Error('install did not complete');expectEqual(done.result.version,source.target.latest,'installed version');
      const state=await profileState(source,source.target.packageName,recovery.application.appId);
      expectEqual([JSON.parse(state.manifest).dependencies[source.target.packageName],state.module,state.ledger.runtime?.version],[source.target.latest,source.target.latest,source.target.latest],'readback');
    }finally{await host.close();await source.profile.cleanup();}
  });
  for(const [id,caseId,expected,refused] of [['RU01','RB04','已恢复到安装前状态（已逐项读回）','恢复失败'],['RU02','RB11','恢复失败','已恢复到']])
    await record(id,'recovery','market shows '+caseId+' as '+(id==='RU01'?'a failure that was restored':'a failure whose restoration failed, never as installed or rolled back'),async()=>{
      const item=recovery.cases.find(row=>row.id===caseId),source=await sourceRecoveryProfile(contract,item);
      const host=await startProvider(contract,{profile:source.profile,installer:source.installer});const client=await loadClient({fetch:host.browserFetch});
      try{await client.module.openInstallTarget({packageName:source.target.packageName});await client.idle();await client.click('确认安装');await host.settled();await client.tick(1000);
        const text=client.text();
        if(!text.includes('安装失败：'+item.expect.code)||!text.includes(expected))throw new Error('market text: '+text.slice(text.indexOf('安装失败')>=0?text.indexOf('安装失败'):0).slice(0,300));
        if(text.includes(refused)||text.includes('安装完成'))throw new Error('market misreports the recovery result');
      }finally{client.unmount();await host.close();await source.profile.cleanup();}
    });
}

/** Provider conformance: this package as the market that receives install targets. */
export async function runProviderSuite(){
  const contract=await loadContract();const {schema,provider:cases}=contract;const {record,summary}=recorder('provider');
  const host=await startProvider(contract);let client;
  try{
    await record('PD01','declaration','package, schema, service and client declare the same contract version',async()=>{
      expectEqual(contract.declaration,{contract:contract.contract.name,contractVersion:contract.contract.version,supported:contract.contract.supported,schema:'./schemas/install-target.schema.json'},'package.json hanamesh.installTarget');
      const declarationErrors=validate(schema,contract.declaration,'#/$defs/providerDeclaration');if(declarationErrors.length)throw new Error(declarationErrors.join('; '));
      expectEqual(INSTALL_TARGET_CONTRACT_VERSION,contract.contract.version,'library service');
      const probe=await loadClient({fetch:host.browserFetch});try{expectEqual(probe.module.INSTALL_TARGET_CONTRACT_VERSION,contract.contract.version,'client module');}finally{probe.unmount();}
      expectEqual(cases.contractVersion,contract.contract.version,'provider fixture version');
    });
    for(const item of cases.targets)await record(item.id+'/http',item.semantic,item.note,async()=>{
      const response=await host.get(new URLSearchParams(item.input).toString());const body=await response.json();
      if(item.expect.error){expectEqual([response.status,body.error?.code],[item.expect.http,item.expect.error],'refusal');const errors=validate(schema,body,'#/$defs/error');if(errors.length)throw new Error(errors.join('; '));
        if(item.expect.error==='CONTRACT_VERSION_UNSUPPORTED')expectEqual(body.error.details?.supported,contract.contract.supported,'advertised versions');return;}
      expectEqual(response.status,200,'status');const errors=validate(schema,body,'#/$defs/resolution');if(errors.length)throw new Error(errors.join('; '));
      expectEqual([body.item.id,body.item.package.name,body.contractVersion,body.source.kind],[item.expect.itemId,item.expect.packageName,contract.contract.version,'fixture'],'resolution');
    });
    for(const [id,note,headers,status,code] of [['PG01','foreign browser origin',{origin:'https://foreign.example'},403,'ORIGIN_DENIED'],['PG02','application frame',{'sec-fetch-dest':'iframe'},403,'FRAME_CONTROL_DENIED'],['PG03','missing host authentication',{'x-install-target-suite':'wrong'},401,'UNAUTHENTICATED']])
      await record(id,'auth',note+' keeps the existing refusal',async()=>{const response=await host.get('packageName=%40hanamesh-fixture%2Finstall-target-plugin',headers);expectEqual([response.status,(await response.json()).error?.code],[status,code],'refusal');});
    await record('PG04','auth','authorization refusal is kept',async()=>{const response=await host.get('packageName=%40hanamesh-fixture%2Fforbidden');expectEqual([response.status,(await response.json()).error?.code],[403,'FORBIDDEN'],'refusal');});
    await record('PG05','auth','the resolver cannot be used to install',async()=>{const response=await fetch(host.origin+ROUTE,{method:'POST',headers:{'x-install-target-suite':host.token,origin:host.origin,'x-hanamesh-client':'workspace-v1','content-type':'application/json'},body:'{"packageName":"@hanamesh-fixture/install-target-plugin"}'});expectEqual(response.status,405,'status');});
    await record('PG06','auth','install keeps same-origin and client-header checks, with or without a declaration',async()=>{
      for(const body of [{packageName:'@hanamesh-fixture/install-target-plugin'},{packageName:'@hanamesh-fixture/install-target-plugin',contractVersion:'1'}]){
        const response=await fetch(host.origin+'/hanamesh/library/install',{method:'POST',headers:{'x-install-target-suite':host.token,origin:host.origin,'content-type':'application/json'},body:JSON.stringify(body)});
        expectEqual([response.status,(await response.json()).error?.code],[403,'CSRF_DENIED'],'install without client header');}
      const unsupported=await fetch(host.origin+'/hanamesh/library/install',{method:'POST',headers:{'x-install-target-suite':host.token,origin:host.origin,'x-hanamesh-client':'workspace-v1','content-type':'application/json'},body:JSON.stringify({packageName:'@hanamesh-fixture/install-target-plugin',contractVersion:'2'})});
      expectEqual([unsupported.status,(await unsupported.json()).error?.code],[400,'CONTRACT_VERSION_UNSUPPORTED'],'install with unsupported declaration');
    });
    await record('PD02','loopback','schema and fixture name exactly the two aliases at one configured instance/port',async()=>{
      expectEqual(cases.loopback.aliases,contract.contract.loopback.aliases,'declared aliases');
      expectEqual(host.origins.map(value=>new URL(value).hostname),cases.loopback.aliases,'provider aliases');
      expectEqual(new Set(host.origins.map(value=>new URL(value).port)).size,1,'one provider port');
    });
    for(const workspaceOrigin of host.origins)for(const item of cases.loopback.cases)await record(item.id+'/'+new URL(workspaceOrigin).hostname,'loopback',item.note,async()=>{
      const url=new URL(workspaceOrigin),otherOrigin=host.origins.find(value=>value!==workspaceOrigin);
      const replacements={origin:workspaceOrigin,otherOrigin,port:url.port,otherPort:String(Number(url.port)===65535?65534:Number(url.port)+1),hostname:url.hostname};
      const headers=Object.fromEntries(Object.entries(item.headers).map(([key,value])=>[key,value.replace(/\$(origin|otherOrigin|port|otherPort|hostname)\b/gu,(_,name)=>replacements[name])]));
      const path=item.method==='GET'?ROUTE+'?'+new URLSearchParams(item.input):'/hanamesh/library/install';
      const response=await new Promise((resolve,reject)=>{
        const req=request(workspaceOrigin+path,{method:item.method,headers:{'x-install-target-suite':host.token,'content-type':'application/json',...headers}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,json:async()=>JSON.parse(Buffer.concat(chunks).toString('utf8'))}));});
        req.on('error',reject);req.end(item.method==='POST'?JSON.stringify(item.input):undefined);
      });
      const body=await response.json();expectEqual([response.status,body.error?.code??null],[item.expect.http,item.expect.error??null],'loopback boundary');
      if(!item.expect.error)expectEqual([body.contractVersion,body.item.package.name],['1',item.input.packageName],'resolved target');
      expectEqual([host.posts.length,host.installs.length],[0,0],'no installation from transport/refusal cases');
    });
    client=await loadClient({fetch:host.browserFetch});
    for(const item of cases.targets)await record(item.id+'/client',item.semantic,item.note,async()=>{
      let receipt;try{receipt=await client.module.openInstallTarget(item.input);}catch(error){if(!item.expect.error)throw error;expectEqual(String(error.message),item.expect.error,'client refusal');await client.idle();if(!client.text().includes(item.expect.error))throw new Error('refusal is not visible in the market');return;}
      if(item.expect.error)throw new Error('client accepted '+JSON.stringify(receipt));
      const errors=validate(schema,receipt,'#/$defs/receipt');if(errors.length)throw new Error(errors.join('; '));expectEqual(receipt,item.expect,'receipt');
    });
    for(const item of cases.fragments)await record(item.id+'/fragment',item.semantic,item.note,async()=>{
      await client.navigate(item.fragment);const text=client.text();
      if(item.expect.status==='confirmation-required'){if(!client.button('确认安装')||!client.button('取消'))throw new Error('no market confirmation');if(!text.includes('测试目录（fixture）'))throw new Error('fixture catalog is not labelled');return;}
      if(client.button('确认安装'))throw new Error('refused fragment still offers confirmation');if(!text.includes(item.expect.error))throw new Error('refusal '+item.expect.error+' is not visible');
    });
    await record('PC01','cancel','cancelling a confirmation sends no install',async()=>{
      await client.module.openInstallTarget({packageName:'@hanamesh-fixture/install-target-plugin'});await client.idle();await client.click('取消');
      if(!client.text().includes('已取消，未安装'))throw new Error('cancel result not visible');expectEqual([host.posts.length,host.installs.length],[0,0],'install requests after cancel');
    });
    await record('PC02','confirm','only an explicit confirmation installs, once, through the existing guarded route',async()=>{
      expectEqual(host.installs.length,0,'installs before confirmation');
      await client.module.openInstallTarget({packageName:'@hanamesh-fixture/install-target-app',contractVersion:'1'});await client.idle();
      const confirm=client.button('确认安装');confirm.props.onClick();confirm.props.onClick();await client.idle();
      expectEqual(host.posts.map(p=>[p.path,p.headers['x-hanamesh-client']]),[['/hanamesh/library/install','workspace-v1']],'install requests');
      expectEqual(host.installs,['@hanamesh-fixture/install-target-app'],'installer calls');
    });
    client.unmount();client=await loadClient({fetch:host.browserFetchFor(host.origins[1])});
    await record('PC03','confirm','localhost fragment reaches confirmation, cancellation does not install, explicit confirmation installs once',async()=>{
      const postsBefore=host.posts.length,installsBefore=host.installs.length;
      await client.navigate('#hanamesh-install?packageName=%40hanamesh-fixture%2Finstall-target-plugin&contractVersion=1');
      if(!client.button('确认安装'))throw new Error('localhost fragment did not reach confirmation');
      await client.click('取消');expectEqual([host.posts.length,host.installs.length],[postsBefore,installsBefore],'localhost cancellation');
      await client.module.openInstallTarget({packageName:'@hanamesh-fixture/install-target-plugin',contractVersion:'1'});await client.idle();
      const confirm=client.button('确认安装');confirm.props.onClick();confirm.props.onClick();await client.idle();
      expectEqual([host.posts.length,host.installs.length],[postsBefore+1,installsBefore+1],'localhost confirmed install once');
      expectEqual(host.installs.at(-1),'@hanamesh-fixture/install-target-plugin','localhost installer target');
    });
  }finally{client?.unmount();await host.close();}
  await runRecoveryProvider(contract,record);
  return summary({contract:contract.contract.name,contractVersion:contract.contract.version,package:'@hanamesh/dsh-app-host@'+contract.packageVersion,loopback:{parentOrigin:host.origin,origins:host.origins,sameInstanceSamePort:true}});
}

/**
 * Consumer conformance. `consumer` is `{name, contractVersion?, navigate(workspaceUrl,target), handshake?(declaration)}`:
 * navigate returns `{ok:true,url}` (normal navigation of the same workspace) or `{ok:false,code}`; a consumer that declares
 * a contractVersion must also implement handshake → `{ok:boolean,code?}`. Consumers without a declaration are v1 callers.
 */
export async function runConsumerSuite(consumer){
  const contract=await loadContract();const {schema,consumer:cases}=contract;const {record,summary}=recorder('consumer');
  const declared=consumer.contractVersion;
  await record('CD01','declaration','consumer declaration is absent (v1) or a supported version with a handshake',async()=>{
    if(declared===undefined)return'no declaration: unversioned v1 caller';
    if(!contract.contract.supported.includes(declared))throw new Error('declares unsupported version '+JSON.stringify(declared));
    if(typeof consumer.handshake!=='function')throw new Error('a versioned consumer must implement handshake');
  });
  for(const workspaceUrl of cases.workspaces??[cases.workspace])for(const item of cases.targets)await record(item.id+(new URL(workspaceUrl).hostname==='localhost'?'/localhost':''),item.expect==='navigate'?'public':'invalid',item.note,async()=>{
    const result=await consumer.navigate(workspaceUrl,item.target);
    if(item.expect==='refuse'){if(result?.ok!==false||result.url)throw new Error('consumer forwarded an invalid target: '+JSON.stringify(result));return;}
    if(result?.ok!==true){if(item.optional)return'skipped';throw new Error('consumer refused a valid target: '+JSON.stringify(result));}
    const workspace=new URL(workspaceUrl),url=new URL(result.url);
    expectEqual([url.origin,url.pathname,url.search],[workspace.origin,workspace.pathname,workspace.search],'workspace origin/path/authentication');
    const prefix=contract.contract.fragmentPrefix;if(!url.hash.startsWith(prefix))throw new Error('fragment does not start with '+prefix);
    const params=new URLSearchParams(url.hash.slice(prefix.length)),keys=[...params.keys()];
    if(new Set(keys).size!==keys.length)throw new Error('duplicate fragment fields');
    const fields=Object.fromEntries(params),errors=validate(schema,fields);if(errors.length)throw new Error(errors.join('; '));
    expectEqual(fields,{...item.target,...(declared===undefined?{}:{contractVersion:declared})},'fragment fields');
  });
  for(const item of cases.handshake)await record(item.id,'handshake',item.note,async()=>{
    if(declared===undefined)return'skipped';
    const result=await consumer.handshake(item.provider);
    if(item.expect==='accept'){if(result?.ok!==true)throw new Error('refused a compatible provider: '+JSON.stringify(result));return;}
    if(result?.ok!==false)throw new Error('accepted an incompatible provider declaration');
    expectEqual(result.code,'CONTRACT_VERSION_UNSUPPORTED','refusal code');
  });
  for(const item of contract.recovery.presentation)await record(item.id,'recovery-presentation',item.note,async()=>{
    if(typeof consumer.presentInstallFailure!=='function')return'skipped';
    const shown=await consumer.presentInstallFailure({type:'library.install-failed',operationId:'fixture-operation',code:'FIXTURE_FAILURE',...(item.recovery?{recovery:item.recovery}:{})});
    expectEqual([shown?.installed,shown?.restored],[item.expect.installed,item.expect.restored],'presentation');
    if(item.expect.version)expectEqual(shown.version,item.expect.version,'restored version');
    if(item.expect.residue)expectEqual(shown.residue,item.expect.residue,'residue shown');
  });
  return summary({contract:contract.contract.name,contractVersion:contract.contract.version,consumer:consumer.name??'unnamed',declared:declared??null});
}

/** Chain: consumer output → this package's real fragment entry, catalog resolution and confirmation; nothing installs. */
export async function runChainSuite(consumer){
  const contract=await loadContract();const {consumer:cases}=contract;const {record,summary}=recorder('chain');
  const host=await startProvider(contract);let client;
  try{
    for(const workspaceOrigin of host.origins){
    client=await loadClient({fetch:host.browserFetchFor(workspaceOrigin)});
    const workspaceUrl=workspaceOrigin+'/workspace/fixture-session?token=fixture-token#previous';
    const aliasSuffix='/'+new URL(workspaceOrigin).hostname;
    if(consumer.contractVersion!==undefined)await record('CX00'+aliasSuffix,'handshake','consumer accepts this provider package declaration',async()=>{const result=await consumer.handshake(contract.declaration);if(result?.ok!==true)throw new Error('consumer refused the shipped provider: '+JSON.stringify(result));});
    for(const item of cases.targets.filter(c=>c.expect==='navigate'))await record('CX-'+item.id+aliasSuffix,'public',item.note+' → market confirmation',async()=>{
      const result=await consumer.navigate(workspaceUrl,item.target);if(result?.ok!==true){if(item.optional)return'skipped';throw new Error('consumer refused');}
      await client.navigate(new URL(result.url).hash);
      if(!client.button('确认安装'))throw new Error('market did not reach confirmation: '+client.text().slice(0,400));
      const resolved=await client.module.openInstallTarget(Object.fromEntries(new URLSearchParams(new URL(result.url).hash.slice(contract.contract.fragmentPrefix.length))));
      expectEqual(resolved.itemId,item.resolves,'resolved catalog item');expectEqual([host.posts.length,host.installs.length],[0,0],'installs');
      await client.click('取消');
    });
    await record('CX-MISMATCH'+(new URL(workspaceOrigin).hostname==='localhost'?'/localhost':''),'version-mismatch','the same navigation declaring an unsupported version is refused by the market',async()=>{
      const item=cases.targets.find(c=>c.expect==='navigate'&&!c.optional);const result=await consumer.navigate(workspaceUrl,item.target);
      const url=new URL(result.url),params=new URLSearchParams(url.hash.slice(contract.contract.fragmentPrefix.length));params.set('contractVersion','2');
      await client.navigate(contract.contract.fragmentPrefix+params);
      if(client.button('确认安装')||!client.text().includes('CONTRACT_VERSION_UNSUPPORTED'))throw new Error('unsupported declaration was not refused visibly');
      expectEqual([host.posts.length,host.installs.length],[0,0],'installs');
    });
    client.unmount();
    }
    for(const caseId of ['RB04','RB10','RB11'])await record('CX-'+caseId,'recovery-presentation','real provider install-failed event for '+caseId+' → consumer presentation',async()=>{
      if(typeof consumer.presentInstallFailure!=='function')return'skipped';
      const item=contract.recovery.cases.find(row=>row.id===caseId),event=await runRecoveryCase(contract,item,{check:false});const shown=await consumer.presentInstallFailure(event);
      expectEqual([shown?.installed,shown?.restored],[false,item.expect.status!=='failed'],'presentation of the real provider event');
    });
  }finally{client?.unmount();await host.close();}
  return summary({contract:contract.contract.name,contractVersion:contract.contract.version,consumer:consumer.name??'unnamed',declared:consumer.contractVersion??null});
}
