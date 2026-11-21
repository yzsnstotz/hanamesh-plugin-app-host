// R491: permanent public-consumer proof of the original HTTP protection points.
// AppHost runtime never imports Market. Only temporary verified normal-package
// copies are faulted; the consumer always loads their public package entry.
import assert from 'node:assert/strict';
import {readFile,mkdir,copyFile,writeFile,symlink,realpath,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {dirname,join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {runMutations} from '@hanamesh/devkit';
import {cases} from './market-owner-cases.mjs';
import {declaration} from '../tests/fixtures/core-suite-declaration.mjs';

const source=resolve(import.meta.dirname,'..');
const digest=value=>createHash('sha256').update(value).digest('hex');
export async function runMarketOwnerMutations(){
 const manifest=JSON.parse(await readFile(join(source,'tests/fixtures/market-owner-package.json'),'utf8'));
 const require=createRequire(join(source,'package.json'));
 const provider=dirname(require.resolve('@hanamesh/market/package.json'));
 const metadata=JSON.parse(await readFile(join(provider,'package.json'),'utf8'));
 assert.equal(metadata.name,manifest.provider);assert.equal(metadata.version,manifest.version);
 const evidence=resolve(process.env.HANAMESH_APPHOST_RUN_DIR??join(source,'artifacts'),'market-owner-mutations');
 const temporaryRoot=await realpath(tmpdir()),root=await mkdtemp(join(temporaryRoot,'hm-market-owner-provider-'));
 await mkdir(evidence,{recursive:true});
 try{
  const payload=[];
  for(const [file,expected] of Object.entries(manifest.files)){
   const bytes=await readFile(join(provider,file));assert.equal(digest(bytes),expected,`normal public Market bytes: ${file}`);
   await mkdir(dirname(join(root,file)),{recursive:true});await writeFile(join(root,file),bytes);
   payload.push({file,sha256:expected});
  }
  await mkdir(join(root,'tests'));
  await copyFile(join(source,'tests/fixtures/market-owner-http.test.mjs'),join(root,'tests/market-owner-http.test.mjs'));
  await writeFile(join(root,'tests/core-declaration.json'),JSON.stringify(declaration())+'\n');
  // All peers/tools belong to this request's declared frozen development lock.
  await symlink(join(source,'node_modules'),join(root,'node_modules'),'dir');
  const results=[];
  for(const item of cases){
   const original=await readFile(join(root,item.file),'utf8');
   const test='tests/market-owner-http.test.mjs',caseDir=join(evidence,item.id);
   const [receipt]=await runMutations({root,cases:[{...item,test}],baselineTests:[test],nodeArgs:['--test-timeout=15000',`--test-name-pattern=${item.pattern}`],evidenceDir:caseDir,temporaryRoot});
   const raw=await readFile(join(caseDir,item.id+'.tap'),'utf8');
   assert.match(raw,item.reason,`${item.id}: original semantic invariant`);
   assert.doesNotMatch(raw,/ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED|SyntaxError|Cannot find module/);
   results.push({...receipt,protects:item.protects,provider:`${manifest.provider}@${manifest.version}`,normalArchiveSha256:manifest.normalArchiveSha256,file:item.file,originalSourceSha256:digest(original),mutatedSourceSha256:digest(original.replace(item.from,item.to)),pattern:item.pattern,originalInvariantReason:item.reason.toString(),baselineTapSha256:digest(await readFile(join(caseDir,'baseline.tap'))),mutantTapSha256:digest(raw)});
  }
  await writeFile(join(evidence,'semantic-results.json'),JSON.stringify({provider:manifest.provider,version:manifest.version,normalArchiveSha256:manifest.normalArchiveSha256,normalArchiveIntegrity:manifest.normalArchiveIntegrity,sourceRef:manifest.sourceRef,payload,consumer:'public plugin entry/self-reference, real Cordis/storage/WebServer, declared frozen source test dependencies',results},null,2)+'\n');
 }finally{await rm(root,{recursive:true,force:true});}
}
