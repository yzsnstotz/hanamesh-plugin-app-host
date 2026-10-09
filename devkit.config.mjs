import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, mkdir, realpath, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {runMutations, verifyPack} from '@hanamesh/devkit';
import {cases} from './scripts/mutation-cases.mjs';
import {javascript, typescript} from './scripts/package-probes.mjs';
const root=import.meta.dirname;
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const pins=JSON.parse(await readFile(join(root,'toolchain.json'),'utf8'));
const devkitSpec='git+https://github.com/yzsnstotz/hanamesh-server-shared.git#semver:^0.2.0&path:/packages/devkit';
const digest=value=>createHash('sha256').update(value).digest('hex');
const cardRun=process.env.HANAMESH_APPHOST_RUN_DIR;
const evidenceDir=resolve(cardRun??join(root,'artifacts'),'mutations');

async function validateDevelopmentPolicy(){
  assert.equal(pkg.peerDependencies['@hanamesh/devkit'],'^0.2.0');
  assert.deepEqual(pkg.peerDependenciesMeta['@hanamesh/devkit'],{optional:true});
  assert.equal(pkg.devDependencies['@hanamesh/devkit'],devkitSpec);
  assert.equal(pkg.dependencies['@hanamesh/devkit'],undefined);
  const installed=JSON.parse(await readFile(new URL('../package.json',import.meta.resolve('@hanamesh/devkit')),'utf8'));
  assert.equal(installed.name,'@hanamesh/devkit');
  const {satisfiesCaret}=await import('@hanamesh/devkit/contract');assert(satisfiesCaret(installed.version,'^0.2.0'));
}

// Per-case name filters and failure reasons are AppHost policy. Execution/copy/cleanup is devkit-owned.
export async function runAppHostMutations(runner=runMutations){
  await mkdir(evidenceDir,{recursive:true});
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
    required:['dist/catalog/suite.js','dist/catalog/suite.d.ts','dist/catalog/fixtures/provider.json','dist/catalog/fixtures/consumer.json','package.json','dist/index.js','dist/index.d.ts','dist/client.js','dist/client.d.ts','dist/client-ui.js','dist/client-ui.d.ts','docs/INSTALL_TARGET.md','dist/dsh.js','dist/provision/LICENSE','schemas/install-target.schema.json','dist/install-target/suite.js','dist/install-target/suite.d.ts','dist/install-target/run.js','dist/install-target/harness.js','dist/install-target/fixtures/catalog.json','dist/install-target/fixtures/provider-cases.json','dist/install-target/fixtures/consumer-cases.json','dist/install-target/fixtures/reference-consumer.js'],
    forbidden:/node_modules\/|vendor\/|tests?\/|scripts\/|artifacts\/|devkit\.config\.mjs|toolchain\.json/u,
    temporaryRoot:undefined,
    validate:async({read})=>{
      const packed=JSON.parse(read('package.json'));
      assert.equal(packed.version,pkg.version);
      assert.deepEqual(packed.dependencies,pkg.dependencies);
      assert.deepEqual(packed.exports,pkg.exports);
      assert.equal(packed.dependencies['@hanamesh/devkit'],undefined);
      assert.equal(packed.peerDependencies['@hanamesh/devkit'],'^0.2.0');
      assert.deepEqual(packed.peerDependenciesMeta['@hanamesh/devkit'],{optional:true});
      for(const path of ['client-ui.js','client-ui.d.ts','library/routes.js','library/service.js','install-target/suite.js','install-target/harness.js','install-target/fixtures/provider-cases.json','install-target/fixtures/consumer-cases.json'])assert.deepEqual(read('dist/'+path),await readFile(join(root,'src',path)),'packed install-target bytes: '+path);
    }};
}

export async function verifyAppHostPack(tarball){
  const options=packOptions(tarball);
  options.temporaryRoot=await realpath(tmpdir());
  // Keep the original offline/no-host-peer smoke separate from the strict host-peer type consumer.
  const prior={offline:process.env.npm_config_offline,peers:process.env.npm_config_auto_install_peers};
  try{
    process.env.npm_config_offline='true';
    process.env.npm_config_auto_install_peers='false';
    await verifyPack({...options,consumer:{packageJson:{private:true,type:'module',
      dependencies:{'@hanamesh/dsh-app-host':`file:${options.tarball}`}},javascript}});
  }finally{
    if(prior.offline===undefined)delete process.env.npm_config_offline;else process.env.npm_config_offline=prior.offline;
    if(prior.peers===undefined)delete process.env.npm_config_auto_install_peers;else process.env.npm_config_auto_install_peers=prior.peers;
  }
  const peers=Object.fromEntries(Object.entries(pkg.peerDependencies).filter(([name])=>name!=='@hanamesh/devkit'));
  await verifyPack({...options,consumer:{packageJson:{private:true,type:'module',dependencies:{...peers,
    '@hanamesh/dsh-app-host':`file:${options.tarball}`}},
    javascript:"import assert from 'node:assert/strict';import{createRequire}from'node:module';import{apply}from'@hanamesh/dsh-app-host/dsh';assert.equal(typeof apply,'function');const require=createRequire(import.meta.url);assert.throws(()=>require.resolve('@hanamesh/devkit'),{code:'MODULE_NOT_FOUND'});",
    typescript}});
}

export default {
  'check-toolchain':{root,pins},
  preflight:{root,validate:validateDevelopmentPolicy},
};
