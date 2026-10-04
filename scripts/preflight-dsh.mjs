import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),checks=[];
for(const [name,expected] of Object.entries({
  '@deepseek-ai/dsh':'0.2.0-rc.2',
  '@deepseek-ai/cordis':'4.0.4',
  '@deepseek-ai/dsh-storage-domain':'0.2.0-rc.2',
  '@deepseek-ai/schemastery':'3.18.4',
})){
  try{const path=require.resolve(name+'/package.json'),pkg=require(path);checks.push({name,expected,installed:true,version:pkg.version,matching:pkg.version===expected});}
  catch{checks.push({name,expected,installed:false,matching:false});}
}
const complete=checks.every(check=>check.matching);
console.log(JSON.stringify({target:'0.2.0-rc.2',complete,checks,upstreamFilesModified:0},null,2));
process.exitCode=complete?0:2;
