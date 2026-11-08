import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const matrixFile='release/installation-targets.json';
const targets=()=>JSON.parse(readFileSync(join(root,matrixFile),'utf8'));
const expected=[{dsh:'0.2.2-rc.1',pnpm:'11.28.5',os:'darwin',cpu:'arm64'},{dsh:'0.2.2-rc.1',pnpm:'11.28.5',os:'linux',cpu:'arm64'}];
test('release targets are explicit in both publication paths and the exact archive verifier',()=>{
 assert.deepEqual(targets(),expected);
 const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
 for(const [script,verb] of [['release:check','check'],['release:publish','publish']])assert.equal(pkg.scripts[script],`hanamesh-release ${verb} --lockfile pnpm-lock.yaml --installation-targets ${matrixFile}`);
 const verifier=readFileSync(join(root,'scripts/verify-package.mjs'),'utf8');
 assert.match(verifier,/installationTargets:/);assert.match(verifier,/release\/installation-targets\.json/);
 assert.doesNotMatch(verifier,/process\.platform|process\.arch|catch\s*\(|skip-platform/);
});
for(const [label,matrix,code] of [
 ['reviewed full matrix',expected,null],
 ['missing matrix',undefined,'INSTALLATION_TARGETS_REQUIRED'],
 ['old pnpm 11.7',[{dsh:'0.2.0-rc.2',pnpm:'11.7.0',os:'darwin',cpu:'arm64'}],'PNPM_PLATFORM_HANG_RISK'],
 ['mixed old and reviewed',[...expected,{dsh:'0.2.0-rc.2',pnpm:'11.7.0',os:'darwin',cpu:'arm64'}],'PNPM_PLATFORM_HANG_RISK'],
 ['unverified x64',[{dsh:'0.2.2-rc.1',pnpm:'11.28.5',os:'linux',cpu:'x64'}],'INSTALLATION_TARGET_UNSUPPORTED'],
])test('normal consumer enforces installer qualification: '+label,async t=>{
 const {scratch}=await import('./helpers.mjs');const dir=await scratch('hm-install-target-gate-');
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const leaf={name:'arbitrary-platform-leaf',version:'1.0.0',os:['linux'],cpu:['arm64']};
 function archive(name,pkg){const work=join(dir,name);mkdirSync(join(work,'package'),{recursive:true});writeFileSync(join(work,'package/package.json'),JSON.stringify(pkg));const file=join(dir,name+'.tgz');const p=spawnSync('/usr/bin/tar',['-czf',file,'-C',work,'package'],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);return file;}
 const leafTar=archive('leaf',leaf),pkg={name:'gate-consumer-fixture',version:'1.0.0',optionalDependencies:{'arbitrary-platform-leaf':'1.0.0'}},tarball=archive('root',pkg),lockfile=join(dir,'package-lock.json');
 writeFileSync(lockfile,JSON.stringify({lockfileVersion:3,packages:{'':pkg,'node_modules/arbitrary-platform-leaf':{...leaf,resolved:'file:'+leafTar,integrity:'sha512-'+createHash('sha512').update(readFileSync(leafTar)).digest('base64')}}}));
 const cli=join(dirname(fileURLToPath(import.meta.resolve('@hanamesh/release-platform-gate'))),'cli.mjs');const args=[cli,'--tarball',tarball,'--lockfile',lockfile];
 if(matrix!==undefined){const file=join(dir,'targets.json');writeFileSync(file,JSON.stringify(matrix));args.push('--installation-targets',file);}
 const result=spawnSync(process.execPath,args,{encoding:'utf8',env:process.env}),receipt=JSON.parse(result.stdout);
 assert.equal(receipt.installationRiskContract.id,'dsh-pnpm-platform-exit-v1');assert.equal(receipt.disableable,false);
 if(code){assert.equal(result.status,1,result.stdout);assert(receipt.findings.some(x=>x.code===code),result.stdout);}
 else{assert.equal(result.status,0,result.stdout);assert.equal(receipt.status,'PASS');assert.deepEqual(receipt.installationTargets,targets());assert(receipt.checked.some(x=>x.name===leaf.name&&x.optionalPath));}
});
