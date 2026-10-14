// Own driver admission regression; no native launch, external source edit or signals.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
test('D214 staged-source and pre-spawn reservation gates reject unsafe second admission',async t=>{
 const card=resolve(import.meta.dirname,'../..'),base=resolve(process.env.HANAMESH_APPHOST_RUN_DIR??card,'tmp');
 assert.ok(base.startsWith(card+'/'));await mkdir(base,{recursive:true});const scratch=await mkdtemp(resolve(base,'native-admission-'));
 try{
  const args=[resolve(import.meta.dirname,'../scripts/native-admission-test.py'),'--source',resolve(import.meta.dirname,'../scripts/native-desktop'),'--scratch',scratch];
  const result=spawnSync('/usr/bin/python3',args,{encoding:'utf8',env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});
  t.diagnostic(result.stdout+result.stderr);assert.ifError(result.error);assert.equal(result.signal,null);assert.match(result.stderr,/Ran 2 tests/);assert.equal(result.status,0,'native fixed-source and exclusive durable admission must hold');
 }finally{await rm(scratch,{recursive:true,force:true});}
});
