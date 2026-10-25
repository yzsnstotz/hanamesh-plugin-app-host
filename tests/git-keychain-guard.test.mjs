import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,chmod,rm,readdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {scratch} from './helpers.mjs';
import {createLibraryInstaller} from '../src/library/install.js';
const policy=await import('../src/git-process.js').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return{};});
const keys={GIT_CONFIG_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_COUNT:'2',GIT_CONFIG_KEY_0:'credential.helper',GIT_CONFIG_VALUE_0:'',GIT_CONFIG_KEY_1:'credential.helper',GIT_CONFIG_VALUE_1:'!gh auth git-credential'};
function required(name){assert.equal(typeof policy[name],'function',`missing own Git safeguard: ${name}`);return policy[name];}
async function fixture(t){
 const root=await scratch('git-keychain-');t.after(()=>rm(root,{recursive:true,force:true}));
 const bin=join(root,'bin'),home=join(root,'home'),tmp=join(root,'tmp'),calls=join(root,'calls');
 for(const dir of [bin,home,tmp])await mkdir(dir);
 for(const [name,body] of Object.entries({gh:'echo "gh $*" >> "$FIXTURE_CALLS"\ncat >/dev/null\ncase "$*" in *get) printf "username=fixture\\npassword=fixture-only\\n";; esac\n',
  'git-credential-osxkeychain':'echo "osxkeychain $*" >> "$FIXTURE_CALLS"\ncat >/dev/null\nprintf "username=fixture\\npassword=fixture-only\\n"\n'})){
  await writeFile(join(bin,name),'#!/bin/sh\n'+body);await chmod(join(bin,name),0o700);
 }
 // Only fake helpers are ever reachable in these configs; never call macOS keychain.
 const bad=join(bin,'git-credential-osxkeychain');
 const system=join(root,'system'),global=join(home,'.gitconfig');
 for(const path of [system,global])await writeFile(path,'[credential]\n helper = '+JSON.stringify(bad)+'\n');
 const env={PATH:bin+':/usr/bin:/bin',HOME:home,TMPDIR:tmp,FIXTURE_CALLS:calls,GIT_CONFIG_SYSTEM:system,
  GIT_CONFIG_GLOBAL:global,GIT_CONFIG_PARAMETERS:"'credential.helper=should-be-cleared'",GIT_CONFIG_COUNT:'3',GIT_CONFIG_KEY_2:'credential.helper',GIT_CONFIG_VALUE_2:'should-be-cleared'};
 return {root,bin,tmp,env,calls,readCalls:async()=>(await readFile(calls,'utf8').catch(e=>e.code==='ENOENT'?'':Promise.reject(e))).trim().split('\n').filter(Boolean)};
}
const input='protocol=https\nhost=fixture.invalid\nusername=fixture\npassword=fixture-only\n\n';
test('GIT01 every DSH CLI installer receives the full safe Git environment after minimal env rebuilding',async t=>{
 const root=await scratch('git-cli-env-');t.after(()=>rm(root,{recursive:true,force:true}));
 await writeFile(join(root,'package.json'),JSON.stringify({dependencies:{}}));let observed;
 const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,
  nodeBinary:process.execPath,dshBin:join(root,'dsh.mjs'),fetchImpl:async()=>new Response('{"version":"1.2.3"}'),
  spawn:async(_cmd,_args,options)=>{observed=options.env;return{code:1};}});
 await assert.rejects(()=>installer.installPlugin({packageName:'fixture-plugin'}));
 for(const [key,value] of Object.entries(keys))assert.equal(observed?.[key],value,'DSH child '+key);
});
test('GIT02 real Git get/store/erase bypass fake system/global helpers and use only fake gh',async t=>{
 const h=await fixture(t),run=required('spawnGitSafe');
 for(const op of ['fill','approve','reject']){
  const result=await run('/usr/bin/git',['credential',op],{cwd:h.root,env:h.env,input:op==='fill'?input.replace('password=fixture-only\n',''):input,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.equal(result.error,undefined);
 }
 assert.deepEqual(await h.readCalls(),['gh auth git-credential get','gh auth git-credential store','gh auth git-credential erase']);
 assert.deepEqual(await readdir(h.tmp),[],'private trace removed after success');
 const env=required('safeGitEnv')(h.env);for(const [k,v] of Object.entries(keys))assert.equal(env[k],v);
 assert.equal(env.GIT_CONFIG_PARAMETERS,undefined);assert.equal(env.GIT_CONFIG_KEY_2,undefined);assert.equal(env.GIT_CONFIG_VALUE_2,undefined);
});
test('GIT03 nested Git helper override is a fatal regression even if fake keychain exits zero',async t=>{
 const h=await fixture(t),run=required('spawnGitSafe');
 // Nested shell command deliberately overrides helper policy. Fake helper is harmless.
 const file=join(h.root,'nested.mjs');await writeFile(file,`import {spawnSync} from 'node:child_process';spawnSync('/usr/bin/git',['-c','credential.helper=','-c',${JSON.stringify('credential.helper='+join(h.bin,'git-credential-osxkeychain'))},'credential','fill'],{input:${JSON.stringify(input.replace('password=fixture-only\n',''))},env:process.env});`);
 await assert.rejects(()=>run(process.execPath,[file],{cwd:h.root,env:h.env,encoding:'utf8'}),{code:'GIT_KEYCHAIN_FORBIDDEN'});
 assert.ok((await h.readCalls()).every(line=>line.startsWith('osxkeychain ')));assert.deepEqual(await readdir(h.tmp),[],'trace removed on failure');
});
test('GIT04 guarded command detects nested forbidden helper and stops a hanging process group',async t=>{
 const h=await fixture(t),run=required('spawnGitSafe');
 const file=join(h.root,'nested.mjs');await writeFile(file,`import {spawnSync} from 'node:child_process';spawnSync('/usr/bin/git',['-c','credential.helper=','-c',${JSON.stringify('credential.helper='+join(h.bin,'git-credential-osxkeychain'))},'credential','fill'],{input:${JSON.stringify(input.replace('password=fixture-only\n',''))},env:process.env});setInterval(()=>{},1000);`);
 await assert.rejects(()=>run(process.execPath,[file],{cwd:h.root,env:h.env,timeout:3000}),{code:'GIT_KEYCHAIN_FORBIDDEN'});
 assert.deepEqual(await readdir(h.tmp),[],'monitor traces removed after terminating its own group');
});
test('GIT05 asynchronous launch errors and aborts remove only their own guard directory',async t=>{
 const h=await fixture(t),run=required('spawnGitSafe');
 await assert.rejects(()=>run(join(h.root,'missing'),[],{env:h.env}),{code:'ENOENT'});
 const controller=new AbortController();const pending=run(process.execPath,['-e','setInterval(()=>{},1000)'],{env:h.env,signal:controller.signal});
 setTimeout(()=>controller.abort(),100);await assert.rejects(()=>pending,{name:'AbortError'});
 assert.deepEqual(await readdir(h.tmp),[],'no launch/abort residue');
});

test('GIT06 a rebuilt minimal package-manager environment receives the policy and cannot auto-switch pnpm',async t=>{
 const h=await fixture(t),run=required('spawnGitSafe');
 const cli=join(h.bin,'pnpm');await writeFile(cli,'#!'+process.execPath+'\nprocess.stdout.write(JSON.stringify(process.env));');await chmod(cli,0o700);
 const result=await run(cli,['install','--frozen-lockfile'],{env:{PATH:h.env.PATH,HOME:h.env.HOME,TMPDIR:h.env.TMPDIR},encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);const env=JSON.parse(result.stdout);
 for(const [key,value] of Object.entries(keys))assert.equal(env[key],value,'package installer '+key);
 assert.equal(env.pnpm_config_manage_package_manager_versions,'false');assert.equal(env.npm_config_manage_package_manager_versions,'false');
 assert.deepEqual(await readdir(h.tmp),[]);
});
test('GIT07 parent SIGTERM ends the owned child and deletes its monitor',async t=>{
 const h=await fixture(t),ready=join(h.root,'ready');
 const script=join(h.root,'wait.mjs');await writeFile(script,`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(ready)},String(process.pid));setInterval(()=>{},1000);`);
 const runner=spawn(process.execPath,[new URL('../scripts/safe-git.mjs',import.meta.url).pathname,process.execPath,script],{env:h.env,stdio:['ignore','pipe','pipe']});
 t.after(()=>{if(runner.exitCode===null&&runner.signalCode===null)runner.kill('SIGKILL');});
 let childPid;for(let i=0;i<100;i++){try{childPid=Number(await readFile(ready,'utf8'));break;}catch{}await new Promise(r=>setTimeout(r,20));}
 assert.ok(childPid,'guarded child started');const done=new Promise(resolve=>runner.once('close',resolve));runner.kill('SIGTERM');assert.equal(await done,1);
 assert.throws(()=>process.kill(childPid,0),{code:'ESRCH'});assert.deepEqual(await readdir(h.tmp),[],'SIGTERM trace cleanup');
});
test('GIT08 unsafe live manager environment refuses before mutation and reports why',async t=>{
 const prior=process.env.GIT_CONFIG_NOSYSTEM;delete process.env.GIT_CONFIG_NOSYSTEM;
 t.after(()=>{if(prior===undefined)delete process.env.GIT_CONFIG_NOSYSTEM;else process.env.GIT_CONFIG_NOSYSTEM=prior;});
 const root=await scratch('git-manager-env-');t.after(()=>rm(root,{recursive:true,force:true}));let calls=0;
 const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,pluginManagerVersion:'0.2.1-alpha.2',pluginManager:()=>({installBundle(){calls++;},removeBundle(){calls++;}})});
 assert.equal(installer.ready,false);assert.equal(installer.live,false);
 await assert.rejects(()=>installer.installPlugin({packageName:'fixture-plugin'}),error=>error.code==='DSH_EXACT_INSTALL_UNAVAILABLE'&&/Git/.test(error.details.need[0].need));assert.equal(calls,0);
});

test('GIT09 native minimal environment retains the guard across the actual Python driver boundary',async t=>{
 const h=await fixture(t),run=required('spawnGitSafe'),driver=new URL('../scripts/native-desktop/lifecycle.py',import.meta.url).pathname;
 const script=`import sys,json,importlib.util\nsys.path.insert(0,sys.argv[1])\nspec=importlib.util.spec_from_file_location('owned_driver',sys.argv[1]+'/lifecycle.py')\nmodule=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(module)\nenv,dirs,node=module.isolated_environment(sys.argv[2],[54241,54242,54243])\nprint(json.dumps(env))\n`;
 const result=await run('/usr/bin/python3',['-c',script,dirname(driver),h.root],{env:{...h.env,PYTHONDONTWRITEBYTECODE:'1'},encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);const env=JSON.parse(result.stdout);for(const [key,value] of Object.entries(keys))assert.equal(env[key],value,'native '+key);
 assert.ok(env.GIT_TRACE2_EVENT);assert.equal(env.pnpm_config_manage_package_manager_versions,'false');assert.deepEqual(await readdir(h.tmp),[]);
});
test('GIT10 command failure and timeout leave no helper traces or owned child processes',async t=>{
 const h=await fixture(t),run=required('spawnGitSafe');
 assert.equal((await run(process.execPath,['-e','process.exit(7)'],{env:h.env})).code,7);
 await assert.rejects(()=>run(process.execPath,['-e','setInterval(()=>{},1000)'],{env:h.env,timeout:100}),{code:'ETIMEDOUT'});
 assert.deepEqual(await readdir(h.tmp),[]);
});

for(const stopSignal of ['SIGTERM','SIGKILL'])test(`GIT11 ${stopSignal} of an outer runner cleans a nested guarded install and both private traces`,async t=>{
 const h=await fixture(t),ready=join(h.root,'nested-ready'),api=new URL('../src/git-process.js',import.meta.url).href;
 const wait=join(h.root,'nested-wait.mjs');await writeFile(wait,`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(ready)},String(process.pid));setInterval(()=>{},1000);`);
 const caller=join(h.root,'caller.mjs');await writeFile(caller,`import {spawnGitSafe} from ${JSON.stringify(api)};await spawnGitSafe(process.execPath,[${JSON.stringify(wait)}],{env:process.env});`);
 const runner=spawn(process.execPath,[new URL('../scripts/safe-git.mjs',import.meta.url).pathname,process.execPath,caller],{env:h.env,stdio:'ignore'});
 let childPid;t.after(()=>{if(runner.exitCode===null&&runner.signalCode===null)runner.kill('SIGKILL');if(childPid)try{process.kill(childPid,'SIGKILL');}catch{}});
 for(let i=0;i<100;i++){try{childPid=Number(await readFile(ready,'utf8'));break;}catch{}await new Promise(r=>setTimeout(r,20));}
 assert.ok(childPid,'nested install started');const done=new Promise(resolve=>runner.once('close',resolve));runner.kill(stopSignal);await done;
 let alive=true;for(let i=0;i<50;i++){try{process.kill(childPid,0);}catch{alive=false;break;}await new Promise(r=>setTimeout(r,20));}
 assert.equal(alive,false,'nested detached install must stop when its caller dies');assert.deepEqual(await readdir(h.tmp),[],'both monitor roots removed');
});
test('GIT12 even helper-safe host environment cannot bypass the owned monitor through in-process manager',async t=>{
 const root=await scratch('git-live-monitor-');t.after(()=>rm(root,{recursive:true,force:true}));let calls=0;
 const installer=createLibraryInstaller({profileDir:root,profileName:'desktop',dataRoot:root,pluginManagerVersion:'0.2.1-alpha.2',pluginManager:()=>({installBundle(){calls++;},removeBundle(){calls++;}})});
 assert.equal(installer.ready,false,'manager has no public scoped env/monitor port');assert.equal(installer.live,false);
 await assert.rejects(()=>installer.installPlugin({packageName:'fixture-plugin'}));assert.equal(calls,0);
});

test('GIT13 caller death during supervisor startup leaves no unowned trace window',async t=>{
 const h=await fixture(t),ready=join(h.root,'caller-ready'),api=new URL('../src/git-process.js',import.meta.url).href;
 const caller=join(h.root,'early-caller.mjs');await writeFile(caller,`import {spawnGitSafe} from ${JSON.stringify(api)};import {writeFileSync} from 'node:fs';const run=spawnGitSafe(process.execPath,['-e','setInterval(()=>{},1000)'],{env:process.env});writeFileSync(${JSON.stringify(ready)},'ready');await run;`);
 const runner=spawn(process.execPath,[new URL('../scripts/safe-git.mjs',import.meta.url).pathname,process.execPath,caller],{env:h.env,stdio:'ignore'});
 t.after(()=>{if(runner.exitCode===null&&runner.signalCode===null)runner.kill('SIGKILL');});
 let seen=false;for(let i=0;i<100;i++){try{await readFile(ready);seen=true;break;}catch{}await new Promise(r=>setTimeout(r,2));}
 assert.equal(seen,true);const done=new Promise(resolve=>runner.once('close',resolve));runner.kill('SIGKILL');await done;
 for(let i=0;i<100;i++){if((await readdir(h.tmp)).length===0)break;await new Promise(r=>setTimeout(r,10));}
 assert.deepEqual(await readdir(h.tmp),[],'supervisor owns every trace from creation through disconnect');
});

test('GIT14 copied first-install line installs the exact scoped npm tuple without a Git helper prefix',async t=>{
 const {SUITE_INSTALL_COMMAND}=await import('../src/library/suite.js');const h=await fixture(t);
 const dsh=join(h.bin,'dsh');await writeFile(dsh,'#!'+process.execPath+'\nprocess.stdout.write(JSON.stringify({env:process.env,args:process.argv.slice(2)}));');await chmod(dsh,0o700);
 const child=spawn('/bin/sh',['-c',SUITE_INSTALL_COMMAND],{env:h.env,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
 assert.equal(await new Promise(resolve=>child.once('close',resolve)),0,stderr);const actual=JSON.parse(stdout);
 assert.deepEqual(actual.args,['plugin','--profile','desktop','add','--save-exact','@hanamesh/core@0.3.21','@hanamesh/usage@0.3.0-rc.6','@hanamesh/dsh-app-host@0.6.13']);
 for(const key of [...Object.keys(keys),'GIT_CONFIG_PARAMETERS'])assert.equal(actual.env[key],h.env[key],'npm line leaves caller Git environment untouched: '+key);
 assert.deepEqual(await h.readCalls(),[],'npm line does not invoke Git credential helpers');
});

test('GIT15 Electron hosts require an explicitly supplied independent Node for the supervisor',async t=>{
 const choose=required('guardNodeBinary');
 assert.equal(choose({versions:{node:'24.13.1',electron:'44.0.0'},execPath:'/Applications/Host.app/Electron'}),undefined);
 assert.equal(choose({workerNode:process.execPath,versions:{electron:'44.0.0'},execPath:'/Applications/Host.app/Electron'}),process.execPath);
 const h=await fixture(t),proxy=join(h.bin,'node'),mark=join(h.root,'supervisor-started');
 await writeFile(proxy,'#!/bin/sh\nprintf started > '+JSON.stringify(mark)+'\nexec '+JSON.stringify(process.execPath)+' "$@"\n');await chmod(proxy,0o700);
 const result=await required('spawnGitSafe')(process.execPath,['-e','process.stdout.write("plain-node")'],{workerNode:proxy,env:h.env});
 assert.equal(result.code,0);assert.equal(result.stdout,'plain-node');assert.equal(await readFile(mark,'utf8'),'started','fork uses the supplied Node executable');
});
