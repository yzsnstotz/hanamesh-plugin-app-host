import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
export function validateDshPins({root}={}){
if(root!==undefined&&!isAbsolute(root))throw new Error('DSH_PREFLIGHT_ROOT_INVALID: expected an explicit absolute host project path.');
const project=root===undefined?new URL('../package.json',import.meta.url):join(realpathSync(root),'package.json');
const require=createRequire(project),checks=[];
for(const [name,expected] of Object.entries({
  '@deepseek-ai/dsh':'0.2.1-alpha.2',
  '@deepseek-ai/cordis':'4.0.5-alpha.1',
  '@deepseek-ai/dsh-storage-domain':'0.2.1-alpha.2',
  '@deepseek-ai/schemastery':'3.18.5-alpha.1',
})){
  try{const path=realpathSync(require.resolve(name+'/package.json')),pkg=require(path);checks.push({name,expected,installed:true,path,version:pkg.version,matching:pkg.version===expected});}
  catch{checks.push({name,expected,installed:false,matching:false});}
}
const complete=checks.every(check=>check.matching);
console.log(JSON.stringify({target:'0.2.1-alpha.2',project:String(project),complete,checks,upstreamFilesModified:0},null,2));
if(!complete)throw new Error('DSH_PIN_MISMATCH: pinned official DSH and all original peers must be installed.');
}
