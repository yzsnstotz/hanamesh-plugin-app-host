import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {createNodeRuntime} from '../src/node-runtime/service.js';
import {nodeBinding} from '../src/library/node-binding.js';
import {temporary} from './helpers.mjs';
async function rig(t, extra={}){
 const root=await temporary();let image={schema:1,revision:0,settings:null,active:null},calls=[],start;const started=new Promise(r=>start=r);
 const provision={provision:async(m,o)=>{calls.push({m,o});start();o.onProgress({item:'node',phase:'download',bytes:4,total:8});if(extra.provision)return extra.provision(m,o);},verify:async()=>({ok:true,items:[{item:'node',state:'ok'}]}),ledger:async()=>({schema:1,items:{node:{version:'24.22.0',platform:'darwin-arm64',sha256:extra.sha??'fake',installTo:'runtime'}}})};
 const runtime=createNodeRuntime({domain:{global:{get:async()=>structuredClone(image),set:async next=>{image=structuredClone(next);}}},dataRoot:root,platform:'darwin-arm64',kernelRelease:'25.0.0',provisionApi:provision,probe:async()=>{},freeBytes:async()=>10**12,...extra});
 await runtime.init();t.after(()=>runtime.close());return {runtime,calls,started,image:()=>image,root};
}
test('MN01 no startup download; stale or unconfirmed plans cannot provision',async t=>{
 const {runtime:r,calls}=await rig(t);assert.equal(r.executable,undefined);assert.equal(calls.length,0);
 const p=await r.plan({});assert.equal(calls.length,0);assert.equal(p.platform,'darwin-arm64');assert.match(p.source,/^https:\/\/nodejs.org\/dist\/v24\.22\.0\//);assert.equal(p.sha256.length,64);assert.ok(p.bytes>0&&p.requiredBytes>p.bytes);
 assert.throws(()=>r.prepare({planId:p.planId,confirm:false}),{code:'NODE_CONFIRM_REQUIRED'});
 await r.save({settings:{...r.status().settings,sourceBase:'https://mirror.example/node'}});
 assert.throws(()=>r.prepare({planId:p.planId,confirm:true}),{code:'NODE_PLAN_STALE'});assert.equal(calls.length,0);
});
test('MN02 prepare keeps ready false until verified ledger and active publication; exact one chosen source',async t=>{
 let done;const gate=new Promise(r=>done=r);const {runtime:r,calls,image,started}=await rig(t,{provision:()=>gate});
 const p=await r.plan({});const op=r.prepare({planId:p.planId,confirm:true});assert.equal(r.executable,undefined);await started;
 assert.equal(calls.length,1);assert.deepEqual(calls[0].o.sourceOrder,['confirmed-source']);assert.equal(calls[0].m.items[0].platforms['darwin-arm64'].sha256,p.sha256);
 // A forged/mismatched provider ledger must never publish a ready binding.
 done();await r.settled();assert.equal(r.status().operation.state,'failed');assert.equal(r.executable,undefined);assert.equal(image().active,null);assert.equal(r.status().operation.id,op.operation.id);
});
test('MN03 cancellation reaches the single provision AbortSignal; no retry and no ready',async t=>{
 const {runtime:r,calls,started}=await rig(t,{provision:(_m,o)=>new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true}))});
 const p=await r.plan({}),op=r.prepare({planId:p.planId,confirm:true});await started;
 r.cancel({operationId:op.operation.id});await r.settled();assert.equal(r.status().operation.state,'cancelled');assert.equal(calls.length,1);assert.equal(r.executable,undefined);
});
test('MN04 unsupported Windows, unsafe source/root/version, insufficient disk and live settings races reject before provision',async t=>{
 const {runtime:w,calls}=await rig(t,{platform:'win32-x64'});assert.equal(w.status().supported,false);await assert.rejects(w.plan({}),{code:'NODE_PLATFORM_UNSUPPORTED'});assert.equal(calls.length,0);
 const {runtime:r}=await rig(t);for(const settings of [{sourceBase:'http://example.com'},{sourceBase:'https://u:p@example.com'},{version:'latest'},{storageRoot:'../runtime'}])await assert.rejects(r.save({settings:{...r.status().settings,...settings}}));
 const {runtime:d}=await rig(t,{freeBytes:async()=>1});await assert.rejects(d.plan({}),{code:'NODE_DISK_SPACE'});
 const {runtime:b}=await rig(t,{busy:()=>true});await assert.rejects(b.save({settings:b.status().settings}),{code:'NODE_IN_USE'});
});
test('MN05 verified commit binds immediately and restores offline; external mode never accepts Electron',async t=>{
 let chosen;const {runtime:r,image}=await rig(t,{provision:async(m)=>{chosen=m.items[0].platforms['darwin-arm64'].sha256;},provisionApi:{provision:async(m)=>{chosen=m.items[0].platforms['darwin-arm64'].sha256;},verify:async()=>({ok:true,items:[{item:'node',state:'ok'}]}),ledger:async()=>({items:{node:{version:'24.22.0',platform:'darwin-arm64',sha256:chosen,installTo:'runtime'}}})}});
 const p=await r.plan({});r.prepare({planId:p.planId,confirm:true});await r.settled();assert.equal(r.status().operation.state,'ready');assert.equal(r.executable,join(p.root,'runtime/bin/node'));assert.equal(image().active.sha256,p.sha256);
 const bad=await rig(t,{probe:async()=>{throw new Error('Electron is not standalone Node');}});await assert.rejects(bad.runtime.save({settings:{...bad.runtime.status().settings,mode:'external',externalBinary:process.execPath}}));assert.equal(bad.runtime.executable,undefined);
});
test('MN06 dynamic binding snapshots each call and caches the same writer until Node changes',()=>{
 let binary;const made=[];const b=nodeBinding(()=>binary,node=>{const d={ready:!!node,install:()=>node};made.push(d);return d;});
 assert.equal(b.ready,false);assert.equal(b.install(),undefined);binary='/managed/node';assert.equal(b.ready,true);const install=b.install;binary='/managed/node2';assert.equal(install(),'/managed/node');assert.equal(b.install(),'/managed/node2');assert.equal(made.length,3);
});
test('MN07 provider/network failure is visible with original cause and never retried; pending preparation blocks settings',async t=>{
 const {runtime:r,calls,started}=await rig(t,{provision:async()=>{throw Object.assign(new Error('certificate chain was rejected'),{code:'SOURCE_FAILED'});}});
 const p=await r.plan({});r.prepare({planId:p.planId,confirm:true});await started;await assert.rejects(r.save({settings:r.status().settings}),{code:'NODE_IN_USE'});await r.settled();
 assert.equal(calls.length,1);assert.match(r.status().operation.error.message,/certificate chain was rejected/);assert.equal(r.executable,undefined);
});
test('MN08 X03 real SIGKILL after verification cannot publish a ready pointer',async t=>{
 const {writeFile,readFile}=await import('node:fs/promises');const {spawn}=await import('node:child_process');const root=await temporary(),file=join(root,'image.json');await writeFile(file,JSON.stringify({schema:1,revision:0,settings:null,active:null}));
 const child=spawn(process.execPath,[new URL('./fixtures/managed-node-crash-worker.mjs',import.meta.url).pathname,root],{stdio:['ignore','pipe','pipe','ipc']});let stderr='';child.stderr.on('data',d=>stderr+=d);
 t.after(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');});
 const checkpoint=await new Promise((resolve,reject)=>{child.once('message',resolve);child.once('error',reject);child.once('exit',()=>reject(new Error('worker exited before checkpoint '+stderr)));});
 assert.equal(checkpoint.point,'node-verified-before-binding');const exited=new Promise(r=>child.once('exit',(code,signal)=>r({code,signal})));child.kill('SIGKILL');assert.equal((await exited).signal,'SIGKILL');
 assert.equal(JSON.parse(await readFile(file,'utf8')).active,null);
 let network=0;const restored=createNodeRuntime({dataRoot:root,platform:'darwin-arm64',kernelRelease:'25.0.0',domain:{global:{get:async()=>JSON.parse(await readFile(file,'utf8'))}},provisionApi:{provision:async()=>network++}});await restored.init();assert.equal(restored.executable,undefined);assert.equal(network,0);await restored.close();
});
test('MN09 Node delegates share one profile writer, including operations accepted during replacement',async t=>{
 const {createLibraryInstaller}=await import('../src/library/install.js');const {SerialQueue}=await import('../src/errors.js');const root=await temporary(),profileWriter=new SerialQueue();
 const calls=[];let firstDone,started;const gate=new Promise(r=>firstDone=r),start=new Promise(r=>started=r);
 const make=nodeBinary=>createLibraryInstaller({profileDir:root,profileName:'test',dataRoot:root,dshBin:join(root,'cli.js'),nodeBinary,profileWriter,spawn:async(command,args)=>{calls.push({command,args});if(calls.length===1){started();await gate;}return{code:0};}});
 let binary=process.execPath;const installer=nodeBinding(()=>binary,make);const one=installer.uninstallPlugin({packageName:'fixture-one'});await start;
 binary=join(root,'replacement-node');const two=installer.uninstallPlugin({packageName:'fixture-two'});await new Promise(setImmediate);assert.equal(calls.length,1,'replacement must wait behind the old writer');
 firstDone();await Promise.all([one,two]);assert.equal(calls.length,2);assert.equal(calls[0].command,process.execPath);assert.equal(calls[1].command,binary);
 const source=await (await import('node:fs/promises')).readFile(new URL('../src/dsh.js',import.meta.url),'utf8');assert.match(source,/pluginManagerVersion:locations\.pluginManagerVersion,profileWriter,/,'real DSH entry passes the shared writer to every delegate');
});
test('MN10 existing Linux external Node remains supported; managed preparation and Windows stay unavailable',async t=>{
 const {runtime:r}=await rig(t,{platform:'linux-x64',initialBinary:'/configured/standalone-node'});assert.equal(r.executable,'/configured/standalone-node');assert.equal(r.status().supported,false);
 const {runtime:w}=await rig(t,{platform:'win32-x64',initialBinary:'/configured/standalone-node'});assert.equal(w.executable,undefined);assert.equal(w.status().ready,false);
});
test('MN11 cancellation during atomic publication is explicitly refused; disk and live binding agree',async t=>{
 const root=await temporary();let image={schema:1,revision:0,settings:null,active:null},sha,commit,release;
 const committing=new Promise(r=>commit=r),gate=new Promise(r=>release=r);
 const r=createNodeRuntime({dataRoot:root,platform:'darwin-arm64',kernelRelease:'25.0.0',probe:async()=>{},freeBytes:async()=>1e12,domain:{global:{get:async()=>image,set:async next=>{commit();await gate;image=structuredClone(next);}}},provisionApi:{provision:async m=>{sha=m.items[0].platforms['darwin-arm64'].sha256;},verify:async()=>({ok:true,items:[{item:'node',state:'ok'}]}),ledger:async()=>({items:{node:{version:'24.22.0',sha256:sha,platform:'darwin-arm64',installTo:'runtime'}}})}});await r.init();t.after(()=>r.close());
 const p=await r.plan({}),op=r.prepare({planId:p.planId,confirm:true});await committing;assert.equal(r.status().operation.state,'committing');assert.throws(()=>r.cancel({operationId:op.operation.id}),{code:'NODE_COMMIT_IN_PROGRESS'});await assert.rejects(r.save({settings:r.status().settings}),{code:'NODE_IN_USE'});assert.equal(r.executable,undefined);
 release();await r.settled();assert.equal(r.status().operation.state,'ready');assert.equal(r.executable,join(image.active.root,'runtime/bin/node'));
});
test('MN12 cleanup failure is visible, retains original failure, and never rejects the detached operation',async t=>{
 const {writeFile}=await import('node:fs/promises');const {runtime:r}=await rig(t,{provision:async(_m,o)=>{await writeFile(join(o.root,'.apphost-node.lock'),JSON.stringify({id:'foreign'}));throw new Error('original download failed');}});
 const p=await r.plan({});r.prepare({planId:p.planId,confirm:true});await assert.doesNotReject(r.settled());assert.equal(r.status().operation.state,'failed');assert.equal(r.status().operation.error.code,'NODE_CLEANUP_FAILED');assert.match(r.status().operation.error.message,/original download failed/);assert.match(r.status().operation.error.message,/Lock changed owner/);assert.equal(r.executable,undefined);
});
test('MN13 failed preparation cannot start a new operation until lock cleanup has settled',async t=>{
 let cleanup,release;const cleaning=new Promise(r=>cleanup=r),gate=new Promise(r=>release=r);
 const {runtime:r}=await rig(t,{provision:async()=>{throw new Error('source failure');},lockFactory:()=>({acquire:async()=>{},release:async()=>{cleanup();await gate;}})});
 const p=await r.plan({});r.prepare({planId:p.planId,confirm:true});await cleaning;assert.equal(r.status().operation.state,'failed');await assert.rejects(r.plan({}),{code:'NODE_IN_USE'});
 release();await r.settled();assert.ok((await r.plan({})).planId);
});
