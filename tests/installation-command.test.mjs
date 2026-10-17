import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';
import{runOfficialInstallationCommand}from'../src/library/installation-cli.js';
async function setup(t,code){const root=await mkdtemp(join(tmpdir(),'installation-command-test-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'profile'));const executable=join(root,'official-cli');await writeFile(executable,`#!${process.execPath}\n${code}`,{mode:0o700});return{root,reader:{executable,home:root,configDir:join(root,'profile'),pluginName:'hanamesh',marketplace:'registered-suite',marketplaceUrl:'https://market.example/plugins.git',timeoutMs:2000,maxOutputBytes:20000}}}
const invoke=(reader,signal)=>runOfficialInstallationCommand({channel:'codex',reader,args:['plugin','list','--json','--disable','remote_plugin'],signal});
test('official child receives only named read arguments and a credential-free explicitly scoped environment',async t=>{
 const{reader}=await setup(t,`console.log(JSON.stringify({args:process.argv.slice(2),env:process.env,cwd:process.cwd()}))`);
 const previous=process.env.HANAMESH_TEST_SECRET;process.env.HANAMESH_TEST_SECRET='never-inherit';t.after(()=>{if(previous===undefined)delete process.env.HANAMESH_TEST_SECRET;else process.env.HANAMESH_TEST_SECRET=previous});
 const value=JSON.parse(await invoke(reader));assert.deepEqual(value.args,['plugin','list','--json','--disable','remote_plugin']);assert.equal(value.env.HANAMESH_TEST_SECRET,undefined);assert.equal(value.env.HOME,reader.home);assert.equal(value.env.CODEX_HOME,reader.configDir);assert.equal(value.env.GIT_CONFIG_VALUE_0,'');assert.notEqual(value.cwd,reader.home);await assert.rejects(readFile(join(value.cwd,'anything')),{code:'ENOENT'});
});
for(const [name,code,patch,expected]of [['stderr',`process.stderr.write('secret private path');console.log('{}')`,{},'AGENT_READER_DIAGNOSTIC'],['nonzero',`process.exit(1)`,{},'AGENT_READER_FAILED'],['overflow',`process.stdout.write('x'.repeat(10000));setInterval(()=>{},1000)`,{maxOutputBytes:100},'AGENT_READER_OUTPUT_LIMIT'],['timeout',`setInterval(()=>{},1000)`,{timeoutMs:60},'AGENT_READER_TIMEOUT']])test(`official reader ${name} is named unknown material, never parsed as absence`,async t=>{const{reader}=await setup(t,code);await assert.rejects(invoke({...reader,...patch}),e=>{assert.equal(e.code,expected);assert.doesNotMatch(e.message,/secret|private path/);return true})});
test('a missing configured profile is not initialized or interpreted as an empty inventory',async t=>{const{root,reader}=await setup(t,'console.log("[]")');const configDir=join(root,'missing-profile');await assert.rejects(invoke({...reader,configDir}),{code:'AGENT_PROFILE_UNAVAILABLE'});await assert.rejects(readFile(configDir),{code:'ENOENT'})});
test('cancellation kills the exact owned read process and rejects without output',async t=>{
 const root=await mkdtemp(join(tmpdir(),'installation-cancel-test-'));t.after(()=>rm(root,{recursive:true,force:true}));const record=join(root,'pid');
 const{reader}=await setup(t,`(await import('node:fs')).writeFileSync(${JSON.stringify(record)},String(process.pid));setInterval(()=>{},1000)`);
 const controller=new AbortController();const pending=invoke(reader,controller.signal);pending.catch(()=>{});t.after(()=>controller.abort());let pid;
 for(let i=0;i<100;i++){try{pid=Number(await readFile(record,'utf8'));break}catch{await new Promise(r=>setTimeout(r,5))}}
 assert.ok(pid);controller.abort();await assert.rejects(pending,{code:'INSTALLATION_STATUS_CANCELLED'});assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
});
test('reader supervisor retains group ownership after CLI leader exits, so the budget closes inherited pipes',async t=>{
 const root=await mkdtemp(join(tmpdir(),'installation-exited-leader-'));t.after(()=>rm(root,{recursive:true,force:true}));const record=join(root,'children.json');
 const{reader}=await setup(t,`const {spawn}=await import('node:child_process');const fs=await import('node:fs');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:['ignore','inherit','inherit']});fs.writeFileSync(${JSON.stringify(record)},JSON.stringify({leader:process.pid,child:child.pid}));process.exit(0);`);
 const pending=invoke({...reader,timeoutMs:1500});const outcome=pending.then(()=>({code:'unexpected-success'}),e=>({code:e.code}));let child;
 try{
  for(let i=0;i<200;i++){try{child=JSON.parse(await readFile(record,'utf8'));break}catch{await new Promise(r=>setTimeout(r,5))}}assert.ok(child?.child,'the CLI leader actually spawned its pipe-holding child');
  const result=await Promise.race([outcome,new Promise(r=>setTimeout(()=>r({code:'SUPERVISOR_DID_NOT_SETTLE'}),3000))]);
  assert.equal(result.code,'AGENT_READER_TIMEOUT','an exited CLI leader must not defeat group cancellation');
  for(let i=0;i<100;i++){try{process.kill(child.child,0);await new Promise(r=>setTimeout(r,5))}catch{child=undefined;break}}assert.equal(child,undefined,'the exact owned pipe-holding child is gone');
 }finally{if(child?.child){try{process.kill(child.child,'SIGKILL')}catch{}}await outcome}
});
test('a completed official command forwards every bounded JSON byte before its anchor exits',async t=>{const{reader}=await setup(t,`process.stdout.write(JSON.stringify({value:'x'.repeat(1024*1024)}))`);const text=await invoke({...reader,timeoutMs:5000,maxOutputBytes:2*1024*1024});assert.equal(JSON.parse(text).value.length,1024*1024,'complete official output is drained before group cleanup')});
test('parent death disconnects the live anchor and reaps its exact command group',async t=>{
 const{spawn}=await import('node:child_process');const root=await mkdtemp(join(tmpdir(),'installation-parent-death-'));const record=join(root,'owned.json');let observed,caller;
 const{reader}=await setup(t,`const fs=await import('node:fs');fs.writeFileSync(${JSON.stringify(record)},JSON.stringify({command:process.pid,anchor:process.ppid}));setInterval(()=>{},1000)`);
 const entry=join(root,'caller.mjs');await writeFile(entry,`import{runOfficialInstallationCommand}from ${JSON.stringify(new URL('../src/library/installation-cli.js',import.meta.url).href)};await runOfficialInstallationCommand({channel:'codex',reader:${JSON.stringify({...reader,timeoutMs:8000})},args:['plugin','list','--json']});`);
 try{caller=spawn(process.execPath,[entry],{env:{PATH:'/usr/bin:/bin',HOME:root},stdio:'ignore'});
  for(let i=0;i<200;i++){try{observed=JSON.parse(await readFile(record,'utf8'));break}catch{await new Promise(r=>setTimeout(r,5))}}assert.ok(observed?.anchor,'the live owned anchor started its command');
  const exited=new Promise(r=>caller.once('exit',r));caller.kill('SIGKILL');await exited;
  for(let i=0;i<200;i++){try{process.kill(observed.command,0);await new Promise(r=>setTimeout(r,5))}catch{observed=undefined;break}}
  assert.equal(observed,undefined,'parent IPC disconnect must reap only its owned read group');
 }finally{if(caller?.exitCode===null&&caller?.signalCode===null)caller.kill('SIGKILL');if(observed){try{process.kill(observed.anchor,'SIGTERM')}catch{}}await rm(root,{recursive:true,force:true})}
});
