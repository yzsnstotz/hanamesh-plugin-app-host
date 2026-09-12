import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),checks=[];
for(const name of ['@deepseek-ai/dsh','@deepseek-ai/cordis','@deepseek-ai/schemastery']){
  try{const path=require.resolve(name+'/package.json'),pkg=require(path);checks.push({name,installed:true,version:pkg.version});}
  catch{checks.push({name,installed:false});}
}
console.log(JSON.stringify({status:'BLOCKED',target:'0.1.5-alpha.1',checks,reason:'真实 DSH storage-domain / auth / route / lifecycle bridge 尚未绑定验证；存在同名包也不算完成集成。',upstreamFilesModified:0},null,2));
process.exitCode=2;
