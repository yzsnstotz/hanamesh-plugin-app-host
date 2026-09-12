import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFile,writeFile,rm,symlink } from 'node:fs/promises';
import { AtomicFileStore } from '../src/index.js';
import { emptySnapshot,validateSnapshot,secureDirectory } from '../src/store.js';
import { waitReady,ownsLoopbackPort } from '../src/runtime.js';
import { validateDefinition } from '../src/descriptor.js';
import { apply,createDshPlugin } from '../src/dsh.js';
import { temporary,external,definition,parentOrigin } from './helpers.mjs';
test('AH store: pre-publish failure preserves prior image; post-publish failure is explicitly uncertain',async t=>{
  const root=await temporary();let failPoint;const s=new AtomicFileStore(root,{checkpoint:async at=>{if(at===failPoint)throw new Error('injected write failure');}});
  await s.init();t.after(async()=>{await s.close();await rm(root,{recursive:true,force:true});});await s.save(emptySnapshot());
  failPoint='snapshot-temp-fsynced';await assert.rejects(s.save({...emptySnapshot(),revision:1}));assert.equal((await s.load()).revision,0);
  failPoint='snapshot-published';await assert.rejects(s.save({...emptySnapshot(),revision:2}),{code:'COMMIT_UNCERTAIN'});assert.equal((await s.load()).revision,2);
});
test('AH store: a second live owner is rejected and cannot silently overwrite state',async t=>{
  const root=await temporary();const a=new AtomicFileStore(root),b=new AtomicFileStore(root);await a.init();t.after(async()=>{await a.close();await rm(root,{recursive:true,force:true});});
  await assert.rejects(b.init(),{code:'DATA_ROOT_BUSY'});await a.save(emptySnapshot());assert.equal((await a.load()).revision,0);
});
test('AH store: corrupt snapshots and symlinked roots fail closed',async t=>{
  const root=await temporary();t.after(()=>rm(root,{recursive:true,force:true}));await symlink(root,join(root,'link'));await assert.rejects(secureDirectory(join(root,'link','child')));
  assert.throws(()=>validateSnapshot({...emptySnapshot(),leases:[null]}),{code:'CORRUPT_STATE'});
  const s=new AtomicFileStore(join(root,'store'));await s.init();try{await writeFile(s.path,'{invalid');await assert.rejects(s.load());}finally{await s.close();}
});
test('AH readiness: unrelated HTTP 200 with the same app marker is not owned readiness',async t=>{
  const {origin}=await external(t);assert.equal(await ownsLoopbackPort(99999999,Number(new URL(origin).port)),false);
  await assert.rejects(waitReady(origin,{path:'/health',status:200,bodyIncludes:'HANAMESH_FIXTURE'},
    {runtime:{mode:'owned',groupId:99999999,isAlive:()=>true},timeoutMs:120,signal:new AbortController().signal}),{code:'READY_TIMEOUT'});
});
test('AH descriptors: relative commands, shell-style launch, missing data binding and host env are rejected',()=>{
  for(const transform of [d=>d.deployments[0].command='node',d=>d.deployments[0].args='node app.js',d=>d.deployments[0].args=['port={{port}}'],d=>{d.deployments[0].env={DSH_TOKEN:'x'};d.deployments[0].envAllowlist=['DSH_TOKEN'];}]){const d=definition();transform(d);assert.throws(()=>validateDefinition(d));}
});
test('H01/H11 guard: absent verified DSH bridge cannot masquerade as a loaded plugin',async()=>{
  assert.throws(()=>createDshPlugin({dshVersion:'0.1.5-alpha.1'}),{code:'DSH_BINDING_REQUIRED'});await assert.rejects(apply(),{code:'DSH_BINDING_REQUIRED'});
});
