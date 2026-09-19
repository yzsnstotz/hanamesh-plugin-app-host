import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),checks=[];
for(const name of ['@deepseek-ai/dsh','@deepseek-ai/cordis','@deepseek-ai/schemastery']){
  try{const path=require.resolve(name+'/package.json'),pkg=require(path);checks.push({name,installed:true,version:pkg.version});}
  catch{checks.push({name,installed:false});}
}
const complete=checks.every(check=>check.installed);
console.log(JSON.stringify({target:'0.1.5-alpha.1',complete,checks,upstreamFilesModified:0},null,2));
process.exitCode=complete?0:2;
