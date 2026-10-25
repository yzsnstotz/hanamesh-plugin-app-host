import assert from 'node:assert/strict';
import {requireGuardedGitEnv} from './src/git-process.js';
import {createHash} from 'node:crypto';
import {readFile, mkdir, mkdtemp, realpath, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {runMutations, verifyPack} from '@hanamesh/devkit';
import {cases} from './scripts/mutation-cases.mjs';
import {typescript,runtimeLedgerJavascript} from './scripts/package-probes.mjs';
const root=import.meta.dirname;
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const pins=JSON.parse(await readFile(join(root,'toolchain.json'),'utf8'));
const devkitSpec='file:vendor/hanamesh-devkit-0.2.3.tgz';
const digest=value=>createHash('sha256').update(value).digest('hex');
const cardRun=process.env.HANAMESH_APPHOST_RUN_DIR;
const evidenceDir=resolve(cardRun??join(root,'artifacts'),'mutations');

async function validateDevelopmentPolicy(){
  assert.equal(pkg.peerDependencies['@hanamesh/devkit'],undefined);
  assert.equal(pkg.peerDependenciesMeta?.['@hanamesh/devkit'],undefined);
  assert.equal(pkg.devDependencies['@hanamesh/devkit'],devkitSpec);
  assert.equal(pkg.dependencies['@hanamesh/devkit'],undefined);
  const installed=JSON.parse(await readFile(new URL('../package.json',import.meta.resolve('@hanamesh/devkit')),'utf8'));
  assert.equal(installed.name,'@hanamesh/devkit');
  const {satisfiesCaret}=await import('@hanamesh/devkit/contract');assert(satisfiesCaret(installed.version,'^0.2.0'));
}

// Per-case name filters and failure reasons are AppHost policy. Execution/copy/cleanup is devkit-owned.
export async function runAppHostMutations(runner=runMutations){
  await mkdir(evidenceDir,{recursive:true});
  // Mutants may break cleanup on purpose (M57); every mutant and its copy live in one TMPDIR removed afterwards.
  const runTmp=await mkdtemp(join(await realpath(tmpdir()),'hm-app-host-mutations-')),priorTmp=process.env.TMPDIR;
  process.env.TMPDIR=runTmp;
  try{return await mutateAll(runner);}
  finally{if(priorTmp===undefined)delete process.env.TMPDIR;else process.env.TMPDIR=priorTmp;await rm(runTmp,{recursive:true,force:true});}
}
async function mutateAll(runner){
  const results=[];
  for(const item of cases){
    const caseDir=join(evidenceDir,item.id);
    const [receipt]=await runner({root,cases:[item],baselineTests:[item.test],
      nodeArgs:['--test-timeout=15000',`--test-name-pattern=${item.pattern}`],evidenceDir:caseDir,
      temporaryRoot:await realpath(tmpdir())});
    const log=await readFile(join(caseDir,`${item.id}.tap`),'utf8');
    assert.match(log,item.reason,`${item.id}: original product-invariant reason`);
    // A loader/import/syntax failure must never stand in for the requested invariant assertion.
    assert.doesNotMatch(log,/ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED|SyntaxError|Cannot find module/u);
    const original=await readFile(join(root,item.file),'utf8');
    results.push({...receipt,test:item.test,pattern:item.pattern,killed:receipt.detected,
      originalSourceSha256:digest(original),mutatedSourceSha256:digest(original.replace(item.from,item.to))});
  }
  await writeFile(join(evidenceDir,'results.json'),JSON.stringify({results},null,2)+'\n');
  return results;
}

export function packOptions(tarball){
  return {root,tarball:resolve(tarball??join(root,`hanamesh-dsh-app-host-${pkg.version}.tgz`)),
    required:['dist/node-runtime/service.js','dist/node-runtime/domain.js','dist/node-runtime/releases.json','dist/library/node-binding.js','dist/library/installation-status.js','dist/library/installation-status-http.js','dist/library/installation-cli.js','dist/library/installation-worker.js','dist/library/installation-command-worker.js','dist/installation-status.js','dist/installation-status.d.ts','docs/INSTALLATION_STATUS.md','dist/git-process.js','dist/git-worker.js','dist/catalog/suite.js','dist/catalog/suite.d.ts','dist/catalog/fixtures/provider.json','dist/catalog/fixtures/consumer.json','package.json','dist/index.js','dist/index.d.ts','dist/client.js','dist/client.d.ts','dist/client-ui.js','dist/client-ui.d.ts','docs/INSTALL_TARGET.md','dist/dsh.js','schemas/install-target.schema.json','dist/install-target/suite.js','dist/install-target/suite.d.ts','dist/install-target/run.js','dist/install-target/harness.js','dist/install-target/fixtures/catalog.json','dist/install-target/fixtures/provider-cases.json','dist/install-target/fixtures/consumer-cases.json','dist/install-target/fixtures/reference-consumer.js','node_modules/@hanamesh/lib-provision/package.json','node_modules/@hanamesh/lib-provision/LICENSE'],
    forbidden:/dist\/provision\/|node_modules\/(?!@hanamesh\/lib-provision\/)|vendor\/|tests?\/|scripts\/|artifacts\/|devkit\.config\.mjs|toolchain\.json/u,
    temporaryRoot:undefined,
    validate:async({read})=>{
      const packed=JSON.parse(read('package.json'));
      assert.equal(packed.version,pkg.version);
      assert.deepEqual(packed.dependencies,pkg.dependencies);
      assert.deepEqual(packed.bundleDependencies,['@hanamesh/lib-provision']);
      const provider=JSON.parse(read('node_modules/@hanamesh/lib-provision/package.json'));
      assert.equal(provider.version,'0.2.1');
      assert.deepEqual(provider.dependencies??{},{});
      assert.deepEqual(read('node_modules/@hanamesh/lib-provision/LICENSE'),await readFile(new URL('LICENSE',import.meta.resolve('@hanamesh/lib-provision/package.json'))));
      assert.deepEqual(packed.peerDependencies,pkg.peerDependencies);
      assert.deepEqual(packed.exports,pkg.exports);
      assert.equal(packed.dependencies['@hanamesh/devkit'],undefined);
      assert.equal(packed.peerDependencies['@hanamesh/devkit'],undefined);
      assert.equal(packed.peerDependenciesMeta?.['@hanamesh/devkit'],undefined);
      for(const path of ['library/catalog.js','manager.js','library/installation-status.js','library/installation-status-http.js','library/installation-cli.js','library/installation-worker.js','library/installation-command-worker.js','git-process.js','git-worker.js','client-ui.js','client-ui.d.ts','library/routes.js','library/service.js','install-target/suite.js','install-target/harness.js','install-target/fixtures/provider-cases.json','install-target/fixtures/consumer-cases.json'])assert.deepEqual(read('dist/'+path),await readFile(join(root,'src',path)),'packed install-target bytes: '+path);
      for(const path of ['catalog-provider-page.schema.json'])assert.deepEqual(read('schemas/'+path),await readFile(join(root,'schemas',path)));
    }};
}

export function assertHostPeerInstallRejected(error){
  assert.equal(error.status,1,'host-peer consumer must fail installation');
  assert.equal(error.signal,null,'host-peer consumer must not be interrupted');
  assert.match(error.message,/^Command failed: pnpm install --prefer-offline --strict-peer-dependencies --frozen-lockfile=false(?:\n|$)/u);
  const output=[error.stdout,error.stderr].map(value=>value?.toString()??'').join('\n');
  assert.deepEqual(output.match(/ERR_PNPM_[A-Z_]+/gu),['ERR_PNPM_PEER_DEP_ISSUES'],'only strict peer rejection is expected');
  assert.doesNotMatch(output,/unmet peer \S+@/iu,'incompatible peers are not missing host peers');
  const missing=[...output.matchAll(/missing peer ([^\r\n]+)/gu)].map(match=>match[1].trim().replace(/@"([^"]+)"$/u,'@$1')).sort();
  assert.deepEqual(missing,Object.entries(pkg.peerDependencies).map(([name,version])=>`${name}@${version}`).sort(),
    'missing host peers must exactly match declared names and versions');
  return missing;
}

export async function verifyAppHostPack(tarball){
  requireGuardedGitEnv();
  const options=packOptions(tarball);
  options.temporaryRoot=await realpath(tmpdir());
  // Devkit rejects missing host peers during strict installation, before any JS probe can run.
  const prior={peers:process.env.npm_config_auto_install_peers};
  try{
    // A fresh isolated store must resolve ordinary dependencies before strict peer
    // validation; forcing offline would test cache preparation instead of peers.
    process.env.npm_config_auto_install_peers='false';
    await assert.rejects(()=>verifyPack({...options,consumer:{packageJson:{private:true,type:'module',
      dependencies:{'@hanamesh/dsh-app-host':`file:${options.tarball}`}},javascript:''}}),error=>{
      const missing=assertHostPeerInstallRejected(error);
      console.log(JSON.stringify({check:'HOST_PEERS_REQUIRED',status:'PASS',missing}));
      return true;
    });
  }finally{
    if(prior.peers===undefined)delete process.env.npm_config_auto_install_peers;else process.env.npm_config_auto_install_peers=prior.peers;
  }
  // Explicit consumer closure; these remain transitive host peers, not AppHost declarations.
  const peers=Object.fromEntries(Object.keys(pkg.peerDependencies).map(name=>[name,pkg.devDependencies[name]??(name.startsWith('@deepseek-ai/dsh-')?'0.2.1-alpha.2':name==='react'?'18.3.1':pkg.peerDependencies[name])]))
  Object.assign(peers,{
    '@deepseek-ai/dsh-storage':'0.2.1-alpha.2',
    '@deepseek-ai/dsh-scope':'0.2.1-alpha.2'});
  await verifyPack({...options,consumer:{packageJson:{private:true,type:'module',dependencies:{...peers,
    '@hanamesh/dsh-app-host':`file:${options.tarball}`}},
    javascript:"import assert from 'node:assert/strict';import{createRequire}from'node:module';import{apply}from'@hanamesh/dsh-app-host/dsh';assert.equal(typeof apply,'function');const require=createRequire(import.meta.url);assert.throws(()=>require.resolve('@hanamesh/devkit'),{code:'MODULE_NOT_FOUND'});"+'\n'+runtimeLedgerJavascript,
    typescript}});
}

export default {
  'check-toolchain':{root,pins},
  preflight:{root,validate:validateDevelopmentPolicy},
};
