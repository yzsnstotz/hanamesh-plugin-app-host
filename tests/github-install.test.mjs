import test from 'node:test';
import assert from 'node:assert/strict';
import { pinnedGithubSpec } from '../src/library/github-target.js';
import {createLibraryInstaller} from '../src/library/install.js';
import {createLibraryService} from '../src/library/service.js';
import {scratch} from './helpers.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {loadClient} from '../src/install-target/harness.js';
import {createHandoffQueue} from '../src/library/handoff.js';
import {createLibraryHttpHandler} from '../src/library/routes.js';
import {createServer} from 'node:http';
import {validate,loadContract} from '../src/install-target/suite.js';
import {createReferenceConsumer} from '../src/install-target/fixtures/reference-consumer.js';

const fixtureDshBin=resolve('fixture/dsh/bin.js');
const sha='0123456789abcdef0123456789abcdef01234567';
test('GitHub installs use a full immutable commit, including monorepo subdirectories',()=>{
  assert.equal(pinnedGithubSpec('Tang-mm95/dsh-kdocs-connector',sha),`github:Tang-mm95/dsh-kdocs-connector#${sha}`);
  assert.equal(pinnedGithubSpec('gao-gao-zai/BetterShell',sha,'packages/better-shell-tools'),`github:gao-gao-zai/BetterShell#${sha}&path:packages/better-shell-tools`);
});

const target={source:'github',repo:'acme/mono',ref:sha,path:'plugins/demo',packageName:'dsh-demo',allowBuild:['sharp']};
test('a collected npm target installs its exact version without resolving latest again',async()=>{
  const profile=await scratch('npm-collected-'),calls=[];
  const selected={source:'npm',name:'dsh-demo',version:'1.2.3',allowBuild:[]};
  const installer=createLibraryInstaller({profileDir:profile,profileName:'isolated',dataRoot:join(profile,'data'),nodeBinary:process.execPath,dshBin:fixtureDshBin,
    fetchImpl:async()=>{assert.fail('a collected exact npm target must not resolve latest');},spawn:async(_command,args)=>{
      calls.push(args);const dir=join(profile,'node_modules','dsh-demo');await mkdir(dir,{recursive:true});
      await writeFile(join(dir,'package.json'),JSON.stringify({name:'dsh-demo',version:'1.2.3'}));
      await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{'dsh-demo':'1.2.3'}}));return{code:0,stdout:'',stderr:''};
    }});
  let result;try{result=await installer.install({id:'demo',installTarget:selected});}catch(error){assert.fail('collected npm target must install without resolving latest: '+error.code);}
  assert.equal(result.version,'1.2.3');
  assert.equal(calls[0].at(-1),'dsh-demo@1.2.3');
});
test('GitHub installer passes the pinned source, subdirectory and reviewed build list to the official CLI without a registry lookup',async()=>{
  const profile=await scratch('github-cli-'),calls=[];
  const installer=createLibraryInstaller({profileDir:profile,profileName:'isolated',dataRoot:join(profile,'data'),nodeBinary:process.execPath,dshBin:fixtureDshBin,
    fetchImpl:async()=>{assert.fail('GitHub installation must not ask npm latest or resolve a branch');},
    spawn:async(command,args)=>{
      calls.push({command,args});
      const root=join(profile,'node_modules','dsh-demo');await mkdir(root,{recursive:true});
      await writeFile(join(root,'package.json'),JSON.stringify({name:'dsh-demo',version:'1.0.0',dsh:{bundle:{patch:'./cordis.patch.yml'}}}));
      await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{'dsh-demo':pinnedGithubSpec(target.repo,target.ref,target.path)},dsh:{profile:{bundles:['dsh-demo']}}}));
      return{code:0,stdout:'',stderr:''};
    }});
  const result=await installer.install({id:'demo',installTarget:target});
  assert.deepEqual(calls,[{command:process.execPath,args:[fixtureDshBin,'plugin','--profile','isolated','add','--save-exact','--allow-build=sharp',`github:acme/mono#${sha}&path:plugins/demo`]}]);
  assert.equal(result.status,'restart-required');assert.equal(result.commit,sha);assert.equal(result.packageName,'dsh-demo');
});

test('a branch advancing after collection cannot change the SHA passed to the native installer',async t=>{
  let branchHead=sha;
  const server=createServer((_req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({sha:branchHead}));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const branchUrl='http://127.0.0.1:'+server.address().port+'/repos/acme/mono/commits/main';
  // The collection boundary fixes a target once; the install boundary receives only that target.
  const collected={...target,ref:(await (await fetch(branchUrl)).json()).sha,allowBuild:[]};
  branchHead='b'.repeat(40);
  assert.notEqual((await (await fetch(branchUrl)).json()).sha,collected.ref,'branch really advanced in the source fixture');
  const profile=await scratch('github-branch-advanced-'),calls=[];
  const installer=createLibraryInstaller({profileDir:profile,profileName:'isolated',dataRoot:join(profile,'data'),nodeBinary:process.execPath,dshBin:fixtureDshBin,
    fetchImpl:async()=>assert.fail('installation must not resolve the updated branch'),
    spawn:async(_command,args)=>{
      const spec=args.at(-1);calls.push(spec);
      const root=join(profile,'node_modules','dsh-demo');await mkdir(root,{recursive:true});
      await writeFile(join(root,'package.json'),JSON.stringify({name:'dsh-demo',version:'1.0.0',dsh:{bundle:{patch:'./patch.yml'}}}));
      await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{'dsh-demo':spec},dsh:{profile:{bundles:['dsh-demo']}}}));
      return{code:0,stdout:'',stderr:''};
    }});
  const result=await installer.install({id:'demo',installTarget:collected});
  assert.deepEqual(calls,[pinnedGithubSpec(collected.repo,sha,collected.path)]);
  assert.equal(result.commit,sha);assert.notEqual(result.commit,branchHead);
});

test('a failed GitHub install reports persisted build permissions as residue instead of claiming restoration',async()=>{
  const profile=await scratch('github-policy-'),policy=join(profile,'pnpm-workspace.yaml');
  const installer=createLibraryInstaller({profileDir:profile,profileName:'isolated',dataRoot:join(profile,'data'),nodeBinary:process.execPath,dshBin:fixtureDshBin,
    spawn:async()=>{await writeFile(policy,'allowBuilds:\n  sharp: true\n');return{code:1,stdout:'',stderr:'build failed'};}});
  await assert.rejects(installer.install({id:'demo',installTarget:target}),error=>{
    assert.equal(error.code,'DSH_PLUGIN_FAILED');assert.equal(error.recovery.status,'failed');
    assert(error.recovery.residue.some(row=>row.item==='build-permissions'),'persisted permission is visible');return true;
  });
  assert.match(await readFile(policy,'utf8'),/sharp: true/,'App-host does not rewrite pnpm policy behind the user');
});

test('GitHub installation rejects a different saved SHA or an inactive bundle after CLI exit zero',async()=>{
  for(const active of [true,false]){
    const profile=await scratch('github-readback-');
    const installer=createLibraryInstaller({profileDir:profile,profileName:'isolated',dataRoot:join(profile,'data'),nodeBinary:process.execPath,dshBin:fixtureDshBin,spawn:async(_command,args)=>{
      if(args.includes('add')){
        const dir=join(profile,'node_modules','dsh-demo');await mkdir(dir,{recursive:true});
        await writeFile(join(dir,'package.json'),JSON.stringify({name:'dsh-demo',version:'1.0.0',dsh:{bundle:{patch:'./patch.yml'}}}));
        await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{'dsh-demo':pinnedGithubSpec(target.repo,active?'b'.repeat(40):target.ref,target.path)},dsh:{profile:{bundles:active?['dsh-demo']:[]}}}));
      }
      return{code:0,stdout:'',stderr:''};
    }});
    await assert.rejects(installer.install({id:'demo',installTarget:target}),{code:'INSTALL_READBACK_MISMATCH'});
  }
});

test('GitHub package identity cannot replace protected HanaMesh suite packages',async()=>{
  const profile=await scratch('github-protected-');let spawned=0;
  const installer=createLibraryInstaller({profileDir:profile,profileName:'isolated',dataRoot:join(profile,'data'),nodeBinary:process.execPath,dshBin:fixtureDshBin,spawn:async()=>{spawned++;return{code:0};}});
  await assert.rejects(installer.install({id:'demo',installTarget:{...target,packageName:'@hanamesh/core'}}),{code:'PACKAGE_DENIED'});
  assert.equal(spawned,0);
});

test('GitHub confirmation cannot switch commit or build permissions when the directory changes',async t=>{
  const root=await scratch('github-confirm-'),fixture=join(root,'catalog.json');
  const template=JSON.parse(await readFile(new URL('./fixtures/catalog/hanamesh-view-v1.json',import.meta.url),'utf8')).page;
  const item={...template.items[0],packageName:null};delete item.package;
  item.installMethods=[{channel:'hanamesh',kind:'github',spec:'github:acme/mono',command:null,allowBuild:['sharp'],sourceId:'1024store',sourceRef:'acme/mono',target}];
  item.oneClickInstall={allowed:true,reason:null};
  const save=async()=>writeFile(fixture,JSON.stringify({...template,items:[item],page:{}}));await save();
  let state={schema:1,revision:0,sources:[]},installs=0;
  const service=await createLibraryService({domain:{global:{get:async()=>state,set:async next=>{state=next;}},close:async()=>{}},
    host:{list:()=>({apps:[]}),instanceList:()=>[]},config:{fixture},installer:{ready:true,install:async()=>{installs++;return{status:'restart-required',packageName:'dsh-demo'};}}}).init();
  t.after(()=>service.close());
  const preview=await service.resolveTarget({itemId:item.id,installTarget:target});
  assert.deepEqual(preview.item.installTarget,target);
  for(const change of [{...target,ref:'f'.repeat(40)},{...target,allowBuild:['sharp','unreviewed']}]){
    item.installMethods[0].target=change;await save();
    await assert.rejects(service.install({itemId:item.id,installTarget:preview.item.installTarget}),{code:'CATALOG_CHANGED'});
  }
  item.installMethods[0].target=target;item.oneClickInstall={allowed:false,reason:'npm-repository-mismatch'};await save();
  await assert.rejects(service.install({itemId:item.id,installTarget:target}),{code:'NOT_INSTALLABLE'});
  assert.equal(installs,0);
});

test('GitHub HTTP target resolves encoded data and install rejects a changed commit before any CLI mutation',async t=>{
  const root=await scratch('github-http-'),fixture=join(root,'catalog.json');
  const template=JSON.parse(await readFile(new URL('./fixtures/catalog/hanamesh-view-v1.json',import.meta.url),'utf8')).page;
  const item={...template.items[0],packageName:null,oneClickInstall:{allowed:true,reason:null},installMethods:[{channel:'hanamesh',kind:'github',spec:'github:acme/mono',command:null,allowBuild:target.allowBuild,sourceId:'1024store',sourceRef:'acme/mono',target}]};delete item.package;
  await writeFile(fixture,JSON.stringify({...template,items:[item],page:{}}));
  let state={schema:1,revision:0,sources:[]},installs=0;
  const service=await createLibraryService({domain:{global:{get:async()=>state,set:async next=>{state=next;}},close:async()=>{}},host:{list:()=>({apps:[]}),instanceList:()=>[]},config:{fixture},installer:{ready:true,install:async()=>{installs++;return{status:'restart-required',packageName:'dsh-demo'};}}}).init();
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await service.close();});
  server.on('request',createLibraryHttpHandler(service,{parentOrigin:origin,authenticate:async()=>({principalId:'fixture'}),authorize:async()=>true}));
  const body={itemId:item.id,installTarget:target};
  const response=await fetch(origin+'/hanamesh/library/target?'+new URLSearchParams({itemId:item.id,installTarget:JSON.stringify(target)}));
  assert.equal(response.status,200);assert.deepEqual((await response.json()).item.installTarget,target);
  item.installMethods[0].target={...target,ref:'b'.repeat(40)};
  await writeFile(fixture,JSON.stringify({...template,items:[item],page:{}}));
  const refused=await fetch(origin+'/hanamesh/library/install',{method:'POST',headers:{origin,'x-hanamesh-client':'workspace-v1','content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal(refused.status,409);assert.equal((await refused.json()).error.code,'CATALOG_CHANGED');assert.equal(installs,0);
});

test('GitHub handoff progress is bound to the same SHA and build list, not merely a matching package name',()=>{
  const queue=createHandoffQueue(),other={...target,ref:'b'.repeat(40)};
  const create=installTarget=>queue.create({origin:'https://market.example',target:{itemId:'demo',installTarget},item:{id:'demo',package:{name:'dsh-demo'},installTarget}});
  const first=create(target),second=create(other);
  queue.report({handoffId:first.handoffId,state:'shown'});queue.report({handoffId:second.handoffId,state:'shown'});
  assert.deepEqual(queue.get(first.handoffId).installTarget,target);
  queue.observe({type:'library.install-started',packageName:'dsh-demo',installTarget:target});
  queue.observe({type:'library.install-done',packageName:'dsh-demo',installTarget:target,status:'restart-required'});
  assert.equal(queue.get(first.handoffId).state,'installed');assert.equal(queue.get(second.handoffId).state,'shown');
});

test('GitHub public target schema and authenticated navigation preserve the full structured target',async()=>{
  const {schema}=await loadContract(),input={itemId:'demo',installTarget:target};
  assert.deepEqual(validate(schema,input),[]);
  assert.notDeepEqual(validate(schema,{installTarget:target}),[]);
  for(const invalid of [{...target,ref:'main'},{...target,path:'../escape'},{...target,allowBuild:true}])assert.notDeepEqual(validate(schema,{...input,installTarget:invalid}),[]);
  const result=createReferenceConsumer().navigate('http://localhost:4321/workspace?auth=fixture',input);
  assert.equal(result.ok,true);const url=new URL(result.url);assert.equal(url.search,'?auth=fixture');
  assert.deepEqual(JSON.parse(new URLSearchParams(url.hash.slice('#hanamesh-install?'.length)).get('installTarget')),target);
});

test('GitHub client confirmation displays the repository, full SHA, path and local build warning, then submits exactly that reviewed target',async t=>{
  const posts=[];
  const client=await loadClient({fetch:async(path,init={})=>{
    if(init.method==='POST')posts.push({path,body:JSON.parse(init.body)});
    if(path.startsWith('/hanamesh/library/target?')){
      const params=new URLSearchParams(path.split('?')[1]);assert.deepEqual(JSON.parse(params.get('installTarget')),target);
      return Response.json({source:{kind:'fixture'},item:{id:'demo',displayName:'Demo',kind:'plugin',package:{registry:'github',name:'dsh-demo'},installTarget:target,installed:null,upgradeAvailable:false}});
    }
    if(path==='/hanamesh/library/install')return Response.json({operationId:'op-github',status:'started'},{status:202});
    return Response.json({items:[],plugins:[],installed:[],handoffs:[],pollMs:1500});
  }});t.after(()=>client.unmount());
  await client.module.openInstallTarget({itemId:'demo',installTarget:target});await client.idle();
  for(const text of ['acme/mono',sha,'plugins/demo','会在本机执行构建脚本','sharp'])assert(client.text().includes(text),'confirmation shows '+text);
  assert.equal(posts.length,0,'preview does not install or approve scripts');
  await client.click('确认安装');
  assert.deepEqual(posts,[{path:'/hanamesh/library/install',body:{itemId:'demo',packageName:'dsh-demo',installTarget:target}}]);
});

test('floating refs and parameter injection never become a DSH install spec',()=>{
  for(const ref of ['main','HEAD','v1.0.0',sha.slice(0,7),'',sha+'&path:other',sha+'\n']){
    assert.throws(()=>pinnedGithubSpec('acme/plugin',ref),{code:'INVALID_INPUT'});
  }
  for(const repo of ['https://github.com/acme/plugin','acme/plugin#main','acme/plugin/other','-flag/repo','acme/repo&path:other','acme/repo\n']){
    assert.throws(()=>pinnedGithubSpec(repo,sha),{code:'INVALID_INPUT'});
  }
  for(const path of ['../other','packages/../../other','/absolute','packages//other','packages/./other','packages\\other','packages/a&main','packages/a#main','packages/%2e%2e/other']){
    assert.throws(()=>pinnedGithubSpec('acme/plugin',sha,path),{code:'INVALID_INPUT'});
  }
});


test('A2 missing installMethods refuses every installation entry before registry or CLI access',async t=>{
  const root=await scratch('a2-missing-methods-'),fixture=join(root,'catalog.json');
  const template=JSON.parse(await readFile(new URL('./fixtures/catalog/hanamesh-view-v1.json',import.meta.url),'utf8')).page;
  const item={...template.items[0],oneClickInstall:{allowed:true,reason:null}};delete item.installMethods;
  await writeFile(fixture,JSON.stringify({...template,items:[item],page:{}}));
  let state={schema:1,revision:0,sources:[]},installs=0;
  const service=await createLibraryService({domain:{global:{get:async()=>state,set:async next=>{state=next;}},close:async()=>{}},host:{list:()=>({apps:[]}),instanceList:()=>[]},config:{fixture},installer:{ready:true,install:async()=>{installs++;return{status:'restart-required'};}}}).init();
  t.after(()=>service.close());
  await assert.rejects(service.resolveTarget({itemId:item.id}),{code:'NOT_INSTALLABLE'});
  await assert.rejects(service.install({itemId:item.id}),{code:'NOT_INSTALLABLE'});
  await assert.rejects(service.installPlugin({packageName:item.package.name}),{code:'NOT_INSTALLABLE'});
  assert.equal(installs,0);
});

test('A2 installer refuses absent exact target before any profile or process mutation',async()=>{
  const root=await scratch('a2-no-target-');let calls=0;
  const installer=createLibraryInstaller({profileDir:root,profileName:'isolated',dataRoot:join(root,'data'),nodeBinary:process.execPath,dshBin:fixtureDshBin,fetchImpl:async()=>{calls++;throw Error('unexpected registry lookup');},spawn:async()=>{calls++;return{code:0};}});
  await assert.rejects(installer.install({id:'unreviewed',package:{registry:'npm',name:'dsh-example'}}),{code:'NOT_INSTALLABLE'});
  assert.equal(calls,0);
});
