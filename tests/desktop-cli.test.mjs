import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {temporary} from './helpers.mjs';

test('AH-D07: Desktop CLI adapter calls the exported reserved-profile entry with fixed layout and plugin argv',async t=>{
  const root=await temporary();t.after(()=>rm(root,{recursive:true,force:true}));
  const entry=join(root,'cli.mjs');
  await writeFile(entry,`export async function runDesktopCli(runtimeDir,supportDir){process.stdout.write(JSON.stringify({runtimeDir,supportDir,args:process.argv.slice(2),electron:process.versions.electron}));}`);
  const {stdout}=await promisify(execFile)(process.execPath,[new URL('../src/library/desktop-cli.js',import.meta.url).pathname,entry,root,join(root,'runtime'),'plugin','--profile','desktop','add','example@1.0.0']);
  assert.deepEqual(JSON.parse(stdout),{runtimeDir:root,supportDir:join(root,'runtime'),args:['plugin','--profile','desktop','add','example@1.0.0']});
});
