import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppHost, AtomicFileStore } from '../src/index.js';
import { createRouter } from '../src/router/broker.js';

test('AH-R01/AK09: locked app-host file policies preserve rotated files and remove revoked grants',async t=>{
  const root=await mkdtemp(join(await realpath(tmpdir()),'ah-router-file-'));
  const host=new AppHost({store:new AtomicFileStore(join(root,'sidecar')),dataRoot:join(root,'data'),parentOrigin:'http://127.0.0.1:49123',nodeBinary:process.execPath});
  t.after(async()=>{await host.dispose();await rm(root,{recursive:true,force:true});});
  const entry={path:'auth/test.json',base:'dataDir',projection:'file',kind:'grant',providers:['openai-chatgpt'],format:'oauth-cli-kit'};
  host.register({id:'file-test',name:'File Test',singleInstanceOnly:true,deployments:[{id:'local',dataId:'data-v1',mode:'owned',command:process.execPath,
    args:[new URL('./fixtures/file-app.mjs',import.meta.url).pathname,'port={{port}}','data={{dataDir}}'],env:{},envAllowlist:[],credentialEnv:[entry],embedding:'direct',
    readiness:{path:'/health',status:200,bodyIncludes:'AK_FILE_READY'},startTimeoutMs:4000,stopGraceMs:60,gateway:{cookieAllowlist:[]}}]});await host.init();
  const state={schema:1,apps:{}},domain={global:{get:()=>structuredClone(state),set:async next=>Object.assign(state,structuredClone(next))}};
  const provider={version:1,providers:async()=>[{id:'openai-chatgpt',riskNotice:{summary:'fixture',details:[],revokeHint:'fixture'}}],
    project:async function(){return{format:'oauth-cli-kit',version:this.version,content:JSON.stringify({access:`fixture-${this.version}`})};}};
  const credentials={describeRecord:async()=>({configured:true,kind:'grant'}),describe:async()=>({configured:false})};
  const router=createRouter({credentials,domain,apps:host,sources:{list:async()=>[],resolve:async()=>undefined},oauth:()=>provider});
  host.setCredentialResolver(router.credentialResolver);host.subscribe(router.observe);
  const id='file:dataDir:auth/test.json';await router.grant('file-test',id,{kind:'grant',key:'hanamesh-auth-oauth/openai-chatgpt--app-file-test'},{riskAcknowledged:true});
  const open=viewId=>host.open({appId:'file-test',deploymentId:'local',viewId});const first=await open('one'),file=join(first.instance.dataDir,'auth','test.json');
  assert.equal(JSON.parse(await readFile(file,'utf8')).access,'fixture-1');assert.equal((await stat(file)).mode&0o777,0o600);await host.stop(first.instance.id,{confirm:true});
  await writeFile(file,'{"access":"app-rotated"}');const second=await open('two');assert.equal(JSON.parse(await readFile(file,'utf8')).access,'app-rotated');await host.stop(second.instance.id,{confirm:true});
  provider.version=2;const third=await open('three');assert.equal(JSON.parse(await readFile(file,'utf8')).access,'fixture-2');await host.stop(third.instance.id,{confirm:true});
  await router.revoke('file-test',id);const fourth=await open('four');await assert.rejects(stat(file));await host.stop(fourth.instance.id,{confirm:true});
  await router.grant('file-test',id,{kind:'grant',key:'hanamesh-auth-oauth/openai-chatgpt--app-file-test'},{riskAcknowledged:true});const fifth=await open('five');await host.stop(fifth.instance.id,{confirm:true});
  await router.setMode('file-test','app-owned');const sixth=await open('six');await assert.rejects(stat(file));await host.stop(sixth.instance.id,{confirm:true});
});
