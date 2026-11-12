import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,chmod,symlink,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Context} from '@deepseek-ai/cordis';
import {scratch} from './helpers.mjs';

// R200-A01: a real Cordis unload while apply() still waits for the payload Node probe must kill that probe at once.
// Cordis runs a plugin's effect cleanups only after apply() returns, so the cancel must not depend on one.
const repo=resolve(fileURLToPath(new URL('..',import.meta.url)));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('AH-D10: unloading the plugin during a pending payload Node probe kills the probe and settles promptly',{skip:process.platform==='win32'},async t=>{
  const root=await scratch('probe-unload-');let pid,ctx;
  const alive=()=>{try{process.kill(pid,0);return true}catch(e){if(e.code==='ESRCH')return false;throw e}};
  const savedArgv=process.argv;
  t.after(async()=>{process.argv=savedArgv;if(pid&&alive())process.kill(pid,'SIGKILL');await ctx?.fiber.dispose().catch(()=>{});await rm(root,{recursive:true,force:true});});
  const runtime=join(root,'dsh'),profile=join(root,'home/profiles/desktop'),host=join(runtime,'node_modules/@deepseek-ai/dsh-desktop-host'),dsh=join(runtime,'node_modules/@deepseek-ai/dsh'),payload=join(root,'primary-runtime');
  for(const dir of [join(host,'lib'),join(dsh,'lib'),join(profile,'node_modules/@hanamesh'),join(payload,'dependencies/node/bin')])await mkdir(dir,{recursive:true});
  for(const [dir,name] of [[host,'@deepseek-ai/dsh-desktop-host'],[dsh,'@deepseek-ai/dsh']])await writeFile(join(dir,'package.json'),JSON.stringify({name,version:'0.2.1-alpha.2'}));
  await symlink(repo,join(profile,'node_modules/@hanamesh/dsh-app-host'));
  await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{'@hanamesh/dsh-app-host':'0.6.27'},dsh:{profile:{bundles:['@hanamesh/dsh-app-host']}}}));
  const entry=join(host,'lib/index.js');await writeFile(entry,'');await writeFile(join(dsh,'lib/bin.js'),'');
  await writeFile(join(payload,'runtime.json'),JSON.stringify({desktopVersion:'0.2.1-alpha.2',platform:process.platform,arch:process.arch,node:process.versions.node}));
  const witness=join(root,'probe.pid'),node=join(payload,'dependencies/node/bin/node');
  // Never answers within the test; exits by itself after 8 s so a regression cannot leak it.
  await writeFile(node,`#!/bin/sh\necho $$ > '${witness}'\nexec sleep 8\n`);await chmod(node,0o755);
  process.argv=[process.execPath,entry,runtime,profile,payload];
  const appHost=await import(pathToFileURL(join(repo,'src/dsh.js')).href);
  const errors=[];ctx=new Context();ctx.logger.exporter({export(message){if(message.type==='error')errors.push(message)}});
  ctx.provide('webServer',{port:49123});ctx.provide('storageDomain',{open(){throw new Error('no acquisition expected after unload')}});ctx.provide('connection',{requestRejection(){}});
  const fiber=ctx.plugin(appHost,{dataRoot:join(root,'data'),library:{sources:[],handoff:{enabled:false}}});
  for(let i=0;i<300&&!pid;i++){try{pid=Number((await readFile(witness,'utf8')).trim())}catch{await pause(10)}}
  assert.ok(pid>0,'the probe child must have started');
  let settled=false;const disposing=Promise.resolve(fiber.dispose()).then(()=>{settled=true});
  for(let i=0;i<50&&(alive()||!settled);i++)await pause(20);
  assert.equal(alive(),false,'real Cordis unload must kill the pending probe');
  assert.equal(settled,true,'real Cordis unload must settle promptly');
  await disposing;
  assert.deepEqual(errors,[],'unload during the probe acquires nothing and logs no error');
});
