import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,symlink,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {secureDirectory} from '../src/store.js';

test('secureDirectory walks the native filesystem root without duplicating a Windows drive',async t=>{
 const root=await mkdtemp(join(tmpdir(),'px1-secure-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const directory=join(await realpath(root),'nested','owned');
 assert.equal(await secureDirectory(directory),await realpath(directory));
 assert.equal(await secureDirectory(directory),await realpath(directory),'an existing owned directory is reusable');
});
test('secureDirectory still refuses a symlink or Windows junction in an ancestor',async t=>{
 const root=await mkdtemp(join(tmpdir(),'px1-secure-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const canonical=await realpath(root),target=join(canonical,'target'),link=join(canonical,'link');
 await mkdir(target);await symlink(target,link,process.platform==='win32'?'junction':'dir');
 await assert.rejects(secureDirectory(join(link,'child')),{code:'UNSAFE_DATA_PATH'});
});
