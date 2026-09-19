// Nine router lifecycle tests migrate the broker contract from auth-apikey; this file carries eight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../src/router/broker.js';

const entries=[
  {env:'OPENAI_API_KEY',kind:'api-key',providers:['openai'],sets:{LANGCHAIN_PROVIDER:'{{provider}}'}},
  {env:'LANGCHAIN_PROVIDER'},
  {path:'auth/token.json',base:'dataDir',projection:'file',kind:'grant',format:'oauth-cli-kit',sets:{LANGCHAIN_PROVIDER:'openai_codex'}},
];
function fixture(){
  const values=new Map([['OPENAI_API_KEY','secret-openai']]),state={schema:1,apps:{}};
  const credentials={describe:async ref=>({configured:values.has(ref),writable:true,source:values.has(ref)?'file':undefined}),
    resolve:async ref=>values.has(ref)?{value:values.get(ref),source:'file'}:undefined,
    describeRecord:async()=>({configured:true,kind:'grant',writable:true})};
  const domain={global:{get:()=>structuredClone(state),set:async next=>Object.assign(state,structuredClone(next))}};
  const apps={list:()=>({apps:[{id:'vibe-trading',deployments:[{id:'local',mode:'owned',credentialEnv:entries}]}]}),
    subscribe(listener){this.listener=listener;return()=>{this.listener=null;};}};
  const oauth={version:1,providers:async()=>[{id:'openai-chatgpt',riskNotice:{summary:'risk',details:[],revokeHint:'revoke'}}],
    project:async function(){return{format:'oauth-cli-kit',version:this.version,content:'{"access":"sensitive"}'};}};
  const sources={
    list:async()=>[
      {id:'openai',source:'dsh-models',kind:'api-key',displayName:'OpenAI',ref:'OPENAI_API_KEY',state:values.has('OPENAI_API_KEY')?'configured':'absent'},
      {id:'deepseek',source:'dsh-models',kind:'api-key',displayName:'DeepSeek',ref:'DEEPSEEK_API_KEY',state:values.has('DEEPSEEK_API_KEY')?'configured':'absent'},
      {id:'coding-oauth-gateway',source:'coding-oauth-gateway',kind:'api-key',displayName:'Coding OAuth Gateway',state:'configured',baseUrl:'http://127.0.0.1:18080/v1',models:['gpt-5.5']},
    ],
    resolve:async subject=>subject.kind==='api-key'&&values.has(subject.ref)?{value:values.get(subject.ref),provider:{id:subject.ref==='OPENAI_API_KEY'?'openai':'deepseek'}}:
      subject.kind==='provider'?{value:'gateway-secret',provider:{id:'coding-oauth-gateway',baseUrl:'http://127.0.0.1:18080/v1',models:['gpt-5.5']}}:undefined,
    enableGateway:async enabled=>({enabled}),
  };
  const router=createRouter({credentials,domain,apps,sources,oauth:()=>oauth});
  const launch=()=>router.credentialResolver({appId:'vibe-trading',deploymentId:'local',instanceId:'one',principalId:'dsh-browser',credentialEnv:entries});
  return{router,launch,apps,oauth,values,state,credentials,sources};
}

test('AH-R01 directory reports configured references but never exposes values',async()=>{
  const{router}=fixture(),json=JSON.stringify(await router.providers());assert(json.includes('OPENAI_API_KEY'));assert(!json.includes('secret-openai'));
});
test('AH-R02 only explicitly granted declared entries are injected and re-resolved at each launch',async()=>{
  const{router,launch,values}=fixture();assert.equal(await launch(),undefined);
  await assert.rejects(router.grant('vibe-trading','env:NOT_DECLARED',{kind:'api-key',ref:'OPENAI_API_KEY'}),{code:'ENTRY_UNKNOWN'});
  await router.grant('vibe-trading','env:OPENAI_API_KEY',{kind:'api-key',ref:'OPENAI_API_KEY'});
  assert.deepEqual((await launch()).env,{OPENAI_API_KEY:'secret-openai',LANGCHAIN_PROVIDER:'openai'});
  values.set('OPENAI_API_KEY','rotated-sensitive');assert.equal((await launch()).env.OPENAI_API_KEY,'rotated-sensitive');
  await router.revoke('vibe-trading','env:OPENAI_API_KEY');assert.equal(await launch(),undefined);
});
test('AH-R01 grant keeps matching-consumer risk acknowledgement for legacy grant slots',async()=>{
  const{router}=fixture(),subject={kind:'grant',key:'hanamesh-auth-oauth/openai-chatgpt--app-vibe-trading'};
  await assert.rejects(router.grant('vibe-trading','file:dataDir:auth/token.json',subject),{code:'RISK_NOT_ACKNOWLEDGED'});
  await assert.rejects(router.grant('vibe-trading','file:dataDir:auth/token.json',{kind:'grant',key:'hanamesh-auth-oauth/openai-chatgpt--app-other'},{riskAcknowledged:true}),{code:'CONSUMER_MISMATCH'});
  assert.equal((await router.grant('vibe-trading','file:dataDir:auth/token.json',subject,{riskAcknowledged:true})).items.at(-1).state,'granted');
});
test('AH-R01 absent OAuth leaves a selected grant missing without reading its record',async()=>{
  const{state,credentials,sources,apps}=fixture();state.apps['vibe-trading']={mode:'managed',grants:{'file:dataDir:auth/token.json':{subject:{kind:'grant',key:'hanamesh-auth-oauth/openai-chatgpt--app-vibe-trading'},grantedAt:'x',riskAcknowledged:true}},ledger:{},revoked:{}};
  const router=createRouter({credentials,domain:{global:{get:()=>state}},apps,sources,oauth:()=>undefined});assert.equal((await router.plan('vibe-trading')).items.at(-1).state,'missing');
});
test('AH-R01/AK11 file projection lifecycle follows host events and app-owned cleanup',async()=>{
  const{router,launch,oauth}=fixture(),subject={kind:'grant',key:'hanamesh-auth-oauth/openai-chatgpt--app-vibe-trading'};
  await router.grant('vibe-trading','file:dataDir:auth/token.json',subject,{riskAcknowledged:true});assert.equal((await launch()).files[0].policy,'overwrite');
  assert.deepEqual((await launch()).env,{LANGCHAIN_PROVIDER:'openai_codex'});await router.observe({type:'credential.injected',instanceId:'one',names:['file:auth/token.json']});
  assert.equal((await launch()).files[0].policy,'if-absent');oauth.version=2;assert.equal((await launch()).files[0].policy,'overwrite');
  await router.setMode('vibe-trading','app-owned');assert.deepEqual((await launch()).files,[{path:'auth/token.json',policy:'remove'}]);
});
test('AH-R01 interrupted launch keeps durable file intent',async()=>{
  const{router,launch,state}=fixture();await router.grant('vibe-trading','file:dataDir:auth/token.json',{kind:'grant',key:'hanamesh-auth-oauth/openai-chatgpt--app-vibe-trading'},{riskAcknowledged:true});
  assert.equal((await launch()).files[0].policy,'overwrite');assert.equal(state.apps['vibe-trading'].ledger['file:dataDir:auth/token.json'].pendingVersion,1);assert.equal((await launch()).files[0].policy,'if-absent');
});
test('AH-R11/AK11 sets expands provider, baseUrl and model and ignores undeclared or empty targets',async()=>{
  const{router,apps}=fixture(),declared=[
    {env:'OPENAI_API_KEY',kind:'api-key',providers:['coding-oauth-gateway'],sets:{OPENAI_BASE_URL:'{{baseUrl}}',LANGCHAIN_MODEL_NAME:'{{model|gpt-5.5}}',EMPTY:'{{baseUrl}}',NOT_DECLARED:'x'}},
    {env:'OPENAI_BASE_URL'},{env:'LANGCHAIN_MODEL_NAME'},{env:'EMPTY'},
  ];apps.list=()=>({apps:[{id:'vibe-trading',deployments:[{id:'local',mode:'owned',credentialEnv:declared}]}]});
  await router.grant('vibe-trading','env:OPENAI_API_KEY',{kind:'provider',providerId:'coding-oauth-gateway'},{model:'gpt-5.5'});
  const out=await router.credentialResolver({appId:'vibe-trading',instanceId:'one',credentialEnv:declared});
  assert.deepEqual(out.env,{OPENAI_API_KEY:'gateway-secret',OPENAI_BASE_URL:'http://127.0.0.1:18080/v1',LANGCHAIN_MODEL_NAME:'gpt-5.5',EMPTY:'http://127.0.0.1:18080/v1'});assert(!('NOT_DECLARED'in out.env));
});
test('AH-R05 sets default applies and empty baseUrl is omitted',async()=>{
  const{router,apps,values}=fixture();values.set('DEEPSEEK_API_KEY','deep-secret');const declared=[
    {env:'DEEPSEEK_API_KEY',kind:'api-key',providers:['deepseek'],sets:{MODEL:'{{model|gpt-5.5}}',BASE:'{{baseUrl}}'}},{env:'MODEL'},{env:'BASE'},
  ];apps.list=()=>({apps:[{id:'vibe-trading',deployments:[{mode:'owned',credentialEnv:declared}]}]});
  await router.grant('vibe-trading','env:DEEPSEEK_API_KEY',{kind:'api-key',ref:'DEEPSEEK_API_KEY'});const out=await router.credentialResolver({appId:'vibe-trading',instanceId:'one',credentialEnv:declared});
  assert.equal(out.env.MODEL,'gpt-5.5');assert(!('BASE'in out.env));
});
