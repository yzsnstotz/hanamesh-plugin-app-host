// Real artifact/consumer acceptance. No host-peer preinstallation or policy override.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,rm,readdir,readFile} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import { scratch } from './helpers.mjs';
const cwd=resolve(dirname(fileURLToPath(import.meta.url)),'..');
test('DIST11 normal tarball installs under default pnpm11 strict peers and exposes self-contained JS/types',async t=>{
 const root=await scratch('apphost-pnpm11-');t.after(()=>rm(root,{recursive:true,force:true}));
 const home=join(root,'home'),cache=join(root,'cache'),temp=join(root,'tmp'),consumer=join(root,'consumer');for(const p of [home,cache,temp,consumer])await mkdir(p);
 const env={PATH:process.env.PATH,HOME:home,DSH_HOME:join(home,'dsh'),TMPDIR:temp,XDG_CACHE_HOME:cache,XDG_CONFIG_HOME:join(home,'config'),npm_config_cache:join(cache,'npm'),npm_config_store_dir:join(cache,'pnpm-store')};
 const run=(file,args,dir)=>spawnSync(file,args,{cwd:dir,env,encoding:'utf8'});
 let artifact=process.env.AH_TEST_TARBALL;
 if(!artifact){const result=run('pnpm',['pack','--pack-destination',root],cwd);assert.equal(result.status,0,result.stdout+result.stderr);const archives=(await readdir(root)).filter(name=>name.endsWith('.tgz'));assert.equal(archives.length,1,'normal pnpm pack must produce one real tarball');artifact=join(root,archives[0]);}
 artifact=resolve(artifact);console.log(JSON.stringify({case:'DIST11_ARTIFACT',sha256:createHash('sha256').update(await readFile(artifact)).digest('hex')}));await writeFile(join(consumer,'package.json'),JSON.stringify({name:'isolated-apphost-consumer',private:true,type:'module',dependencies:{'@hanamesh/dsh-app-host':`file:${artifact}`},devDependencies:{typescript:'5.8.3'}}));
 const args=['--yes','--package=pnpm@11.0.0','pnpm','install','--strict-peer-dependencies'];
 const installed=process.env.AH_TEST_PNPM11?run(process.execPath,[resolve(process.env.AH_TEST_PNPM11),'install','--strict-peer-dependencies'],consumer):run('npx',args,consumer);
 console.log(JSON.stringify({case:'DIST11',artifact,command:process.env.AH_TEST_PNPM11?'node <official pnpm11> install --strict-peer-dependencies':'npx --yes --package=pnpm@11.0.0 pnpm install --strict-peer-dependencies',status:installed.status,signal:installed.signal,stdout:installed.stdout,stderr:installed.stderr}));
 assert.equal(installed.error,undefined,'consumer must actually execute');assert.equal(installed.signal,null,'consumer must exit normally');assert.equal(installed.status,0,'default strict consumer rejected real artifact; exotic subdependency denial is not a host-peer/Loader rejection\n'+installed.stdout+installed.stderr);
 const entries=['','/dsh','/client','/client-ui','/catalog/suite','/install-target/suite'];await writeFile(join(consumer,'consumer.mts'),entries.map((s,i)=>`import * as p${i} from '@hanamesh/dsh-app-host${s}'; void p${i};`).join('\n'));
 const types=run(process.execPath,[join(consumer,'node_modules/typescript/bin/tsc'),'--noEmit','--strict','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext','consumer.mts'],consumer);assert.equal(types.status,0,types.stdout+types.stderr);
 // /client-ui is a browser Loader entry, not a Node runtime API. Resolve and
 // parse it without inventing window/Loader; actual activation belongs to native U2.
 const js=run(process.execPath,['--input-type=module','-e',entries.map(s=>`console.log(import.meta.resolve('@hanamesh/dsh-app-host${s}'));`).join('\n')+'\n'+entries.filter(s=>s!=='/client-ui').map(s=>`await import('@hanamesh/dsh-app-host${s}');`).join('\n')],consumer);assert.equal(js.status,0,js.stdout+js.stderr);
 const browser=run(process.execPath,['--check',join(consumer,'node_modules/@hanamesh/dsh-app-host/dist/client-ui.js')],consumer);assert.equal(browser.status,0,browser.stdout+browser.stderr);
 const tree=process.env.AH_TEST_PNPM11?run(process.execPath,[resolve(process.env.AH_TEST_PNPM11),'list','--depth','Infinity','--json'],consumer):run('npx',['--yes','--package=pnpm@11.0.0','pnpm','list','--depth','Infinity','--json'],consumer);assert.equal(tree.status,0,tree.stdout+tree.stderr);console.log(JSON.stringify({case:'DIST11_RESOLVED',dependencyTree:JSON.parse(tree.stdout),node:process.version,jsNodeImports:5,browserEntryResolvedAndParsed:true,nativeBrowserActivation:'NOT_TESTED',declarationEntries:6}));
});
