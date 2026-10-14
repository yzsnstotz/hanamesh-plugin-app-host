import { readdir, rm, mkdir, cp, readFile, writeFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const args=process.argv.slice(2);
if(args.some(arg=>arg!=='--verification')||args.length>1)throw new Error('Unknown AppHost build arguments.');
const verification=args.includes('--verification');
if(verification){
  let checkout=false;try{await access(resolve(root,'.git'));checkout=true;}catch{}
  if(checkout)throw new Error('Verification builds require a separate staging directory; preserve the checkout production output.');
}
for(const file of await readdir(`${root}/src`))if(file.endsWith('.js')){
  const result=spawnSync(process.execPath,['--check',`${root}/src/${file}`],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status??1);
}
await rm(`${root}/dist`,{recursive:true,force:true});await mkdir(`${root}/dist`);
await cp(`${root}/src`,`${root}/dist`,{recursive:true});
if(verification){
  const file=resolve(root,'dist/client-ui.js'),source=await readFile(file,'utf8');
  const marker='return{name,inject,apply,ProvidersSection';
  if(source.split(marker).length!==2)throw new Error('AppHost client factory export is not unique.');
  await writeFile(file,source.replace(marker,'return{name,inject,apply:ctx=>apply(ctx,{verification:true}),ProvidersSection'));
}
console.error('Build completed: AppHost ESM modules and public type declarations; provision is bundled by the normal pack command.');
