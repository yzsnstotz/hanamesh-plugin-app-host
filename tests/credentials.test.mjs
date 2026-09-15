import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { AppHost, AtomicFileStore } from '../src/index.js';
import { setup, definition, input, identity, until, temporary } from './helpers.mjs';

const declared=[{env:'EXAMPLE_API_KEY',kind:'api-key',providers:['example'],required:true},
  {env:'LANGCHAIN_PROVIDER'},{path:'.codex/auth.json',kind:'grant',projection:'file',providers:['openai-chatgpt'],format:'codex-cli-auth-json'},
  {path:'auth/openai-codex.json',kind:'grant',projection:'file',base:'dataDir',format:'oauth-cli-kit',sets:{LANGCHAIN_PROVIDER:'openai_codex'}}];
function withCredentials(){const d=definition();d.deployments[0].credentialEnv=declared;d.deployments[0].envAllowlist=[];return d;}

test('AH-C1: credentialEnv is validated — host control names, duplicates, static-env repeats and escaping paths are rejected',async t=>{
  const dir=await temporary();
  const bad=(patch)=>{const d=definition();Object.assign(d.deployments[0],patch);const h=new AppHost({store:new AtomicFileStore(join(dir,'s')),dataRoot:join(dir,'d'),parentOrigin:'http://127.0.0.1:49123'});return ()=>h.register(d);};
  assert.throws(bad({credentialEnv:[{env:'DSH_TOKEN'}]}),/INVALID_CREDENTIAL_ENV|host control/);
  assert.throws(bad({credentialEnv:[{env:'HOME'}]}),/INVALID_CREDENTIAL_ENV|host control/);
  assert.throws(bad({credentialEnv:[{env:'A_KEY'},{env:'A_KEY'}]}),/Duplicate/);
  assert.throws(bad({env:{A_KEY:'x'},envAllowlist:['A_KEY'],args:['{{dataDir}}','{{port}}'],credentialEnv:[{env:'A_KEY'}]}),/static env/);
  assert.throws(bad({credentialEnv:[{path:'../x',projection:'file'}]}),/relative to the app HOME/);
  assert.throws(bad({credentialEnv:[{path:'/etc/x',projection:'file'}]}),/relative to the app HOME/);
  assert.throws(bad({credentialEnv:[{env:'A_KEY',kind:'oauth'}]}),/unknown kind/);
  assert.throws(bad({credentialEnv:[{path:'x.json',projection:'file',base:'root'}]}),/base must be home or dataDir/);
  assert.throws(bad({credentialEnv:[{path:'x.json',projection:'file',format:'Bad Format'}]}),/format is an opaque/);
  // rc.8 `sets`: only declared env slots may be targeted; values are short single-line strings.
  assert.throws(bad({credentialEnv:[{env:'A_KEY',sets:{UNDECLARED:'x'}}]}),/not a declared env slot/);
  assert.throws(bad({credentialEnv:[{env:'A_KEY'},{env:'B_MODE',sets:{A_KEY:'bad\nline'}}]}),/short single-line/);
  assert.throws(bad({credentialEnv:[{env:'A_KEY',sets:['x']}]}),/sets must map/);
  const ok=definition();ok.deployments[0].credentialEnv=declared;
  const h=new AppHost({store:new AtomicFileStore(join(dir,'s2')),dataRoot:join(dir,'d2'),parentOrigin:'http://127.0.0.1:49123'});
  h.register(ok);
  assert.deepEqual(h.list().apps[0].deployments[0].credentialEnv.map(c=>c.env??c.path),['EXAMPLE_API_KEY','LANGCHAIN_PROVIDER','.codex/auth.json','auth/openai-codex.json']);
  assert.equal(h.list().apps[0].deployments[0].credentialEnv[3].base,'dataDir');assert.equal(h.list().apps[0].deployments[0].credentialEnv[2].base,'home');
});

test('AH-C2/C3/C4: resolver values reach the child only for declared names; undeclared env and escaping files are rejected with events; logs are redacted',async t=>{
  const seen=[];
  const {host,root}=await setup(t,{def:withCredentials()});
  host.setCredentialResolver(async req=>{seen.push(req);return{env:{EXAMPLE_API_KEY:'sk-secret-value-1234',LANGCHAIN_PROVIDER:'example',UNDECLARED_KEY:'nope'},
    files:[{path:'.codex/auth.json',content:'{"tokens":{"access_token":"tok-abcdef-9999"}}'},{path:'auth/openai-codex.json',content:'{"access":"tok-vibe-1111","refresh":"r","expires":1}'},{path:'../escape.txt',content:'x'}],secrets:['tok-abcdef-9999']};});
  const opened=await host.open(input());
  assert.equal(seen.length,1);assert.equal(seen[0].appId,'example');assert.equal(seen[0].credentialEnv.length,4);
  const id=await identity(opened.uiUrl);
  assert.equal(id.credentialEnv.EXAMPLE_API_KEY,'sk-secret-value-1234');
  assert.equal(id.credentialEnv.LANGCHAIN_PROVIDER,'example');
  assert.equal(id.credentialEnv.UNDECLARED_KEY,null);
  assert.equal(JSON.parse(id.homeAuth).tokens.access_token,'tok-abcdef-9999');
  const home=join(opened.instance.dataDir,'home');
  assert.equal(((await stat(join(home,'.codex','auth.json'))).mode & 0o777),0o600);
  assert.equal(JSON.parse(id.dataAuth).access,'tok-vibe-1111');
  assert.equal(((await stat(join(opened.instance.dataDir,'auth','openai-codex.json'))).mode & 0o777),0o600);
  await assert.rejects(stat(join(home,'auth','openai-codex.json')));
  await assert.rejects(stat(join(opened.instance.dataDir,'escape.txt')));
  const events=host.eventsSince(0).events.map(e=>[e.type,e.names]);
  assert.ok(events.some(([t,n])=>t==='credential.injected'&&n.includes('EXAMPLE_API_KEY')&&n.includes('file:.codex/auth.json')&&n.includes('file:auth/openai-codex.json')));
  assert.ok(events.some(([t,n])=>t==='credential.env-rejected'&&n.includes('UNDECLARED_KEY')&&n.includes('file:../escape.txt')));
  await until(()=>host.logTail(opened.instance.id).some(l=>l.text.includes('fixture-sees-key')));
  const lines=host.logTail(opened.instance.id).map(l=>l.text).join('\n');
  assert.ok(lines.includes('[REDACTED]'));assert.ok(!lines.includes('sk-secret-value-1234'));
});

test('AH-C5: a throwing resolver is recorded and never blocks the launch',async t=>{
  const {host}=await setup(t,{def:withCredentials()});
  host.setCredentialResolver(async()=>{const e=new Error('broker down');e.code='BROKER_DOWN';throw e;});
  const opened=await host.open(input());
  assert.equal(opened.instance.status,'ready');
  const id=await identity(opened.uiUrl);assert.equal(id.credentialEnv.EXAMPLE_API_KEY,null);
  assert.ok(host.eventsSince(0).events.some(e=>e.type==='credential.resolver-failed'&&e.code==='BROKER_DOWN'));
});

test('AH-C6: without a resolver (or after its disposer ran) nothing is injected and no credential event exists',async t=>{
  const {host}=await setup(t,{def:withCredentials()});
  const dispose=host.setCredentialResolver(async()=>({env:{EXAMPLE_API_KEY:'x'}}));dispose();
  const opened=await host.open(input());
  const id=await identity(opened.uiUrl);assert.equal(id.credentialEnv.EXAMPLE_API_KEY,null);assert.equal(id.homeAuth,null);
  assert.ok(!host.eventsSince(0).events.some(e=>e.type.startsWith('credential.')));
});

test('AH-C7 (rc.6): file policy — if-absent keeps an app-rotated file, overwrite replaces it, remove deletes it; events name each',async t=>{
  let policy='if-absent',content='{"access":"v1"}';
  const {host}=await setup(t,{def:withCredentials()});
  host.setCredentialResolver(async()=>({files:[{path:'auth/openai-codex.json',content,policy}]}));
  const first=await host.open(input('v1'));
  assert.equal(JSON.parse((await identity(first.uiUrl)).dataAuth).access,'v1');
  await host.stop(first.instance.id,{confirm:true});
  const { writeFile }=await import('node:fs/promises');
  await writeFile(join(first.instance.dataDir,'auth','openai-codex.json'),'{"access":"rotated-by-app"}');
  const second=await host.open(input('v2'));
  assert.equal(JSON.parse((await identity(second.uiUrl)).dataAuth).access,'rotated-by-app');
  assert.ok(host.eventsSince(0).events.some(e=>e.type==='credential.file-kept'&&e.names.includes('file:auth/openai-codex.json')));
  await host.stop(second.instance.id,{confirm:true});
  policy='overwrite';content='{"access":"v2"}';
  const third=await host.open(input('v3'));
  assert.equal(JSON.parse((await identity(third.uiUrl)).dataAuth).access,'v2');
  await host.stop(third.instance.id,{confirm:true});
  policy='remove';
  const fourth=await host.open(input('v4'));
  assert.equal((await identity(fourth.uiUrl)).dataAuth,null);
  assert.ok(host.eventsSince(0).events.some(e=>e.type==='credential.file-removed'&&e.names.includes('file:auth/openai-codex.json')));
});
