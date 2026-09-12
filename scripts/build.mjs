import { readdir, rm, mkdir, cp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
for(const file of await readdir(`${root}/src`))if(file.endsWith('.js')){
  const result=spawnSync(process.execPath,['--check',`${root}/src/${file}`],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status??1);
}
await rm(`${root}/dist`,{recursive:true,force:true});await mkdir(`${root}/dist`);
await cp(`${root}/src`,`${root}/dist`,{recursive:true});
console.log('Build completed: self-contained ESM modules and public type declarations.');
