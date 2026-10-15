import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import semver from 'semver';
import {DSH_RANGE} from '../src/dsh-compat.js';
export function validateDshPins({root}={}){
if(root!==undefined&&!isAbsolute(root))throw new Error('DSH_PREFLIGHT_ROOT_INVALID: expected an explicit absolute host project path.');
const project=root===undefined?new URL('../package.json',import.meta.url):join(realpathSync(root),'package.json');
const require=createRequire(project),checks=[],pkg=createRequire(import.meta.url)('../package.json');
for(const [name,expected] of Object.entries({
  '@deepseek-ai/dsh':DSH_RANGE,
  '@deepseek-ai/cordis':pkg.peerDependencies['@deepseek-ai/cordis'],
  '@deepseek-ai/dsh-storage-domain':DSH_RANGE,
  '@deepseek-ai/schemastery':pkg.peerDependencies['@deepseek-ai/schemastery'],
})){
  try{const path=realpathSync(require.resolve(name+'/package.json')),pkg=require(path);checks.push({name,expected,installed:true,path,version:pkg.version,matching:semver.satisfies(pkg.version,expected,{includePrerelease:true})});}
  catch{checks.push({name,expected,installed:false,matching:false});}
}
const complete=checks.every(check=>check.matching);
console.log(JSON.stringify({target:DSH_RANGE,project:String(project),complete,checks,upstreamFilesModified:0},null,2));
if(!complete)throw new Error('DSH_COMPAT_MISMATCH: official DSH and all required peers must match the supported public ranges.');
}
