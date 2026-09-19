import { readdir, rm, mkdir, cp, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
for(const file of await readdir(`${root}/src`))if(file.endsWith('.js')){
  const result=spawnSync(process.execPath,['--check',`${root}/src/${file}`],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status??1);
}
await rm(`${root}/dist`,{recursive:true,force:true});await mkdir(`${root}/dist`);
await cp(`${root}/src`,`${root}/dist`,{recursive:true});
await mkdir(`${root}/dist/provision`,{recursive:true});
const vendor=`${root}/vendor/hanamesh-lib-provision-0.1.0-rc.1.tgz`;
const extracted=spawnSync('tar',['-xzf',vendor,'-C',`${root}/dist/provision`,'--strip-components=2','package/lib'],{stdio:'inherit'});
if(extracted.status!==0)process.exit(extracted.status??1);
const notices=spawnSync('tar',['-xzf',vendor,'-C',`${root}/dist/provision`,'--strip-components=1','package/THIRD_PARTY_NOTICES.md'],{stdio:'inherit'});
if(notices.status!==0)process.exit(notices.status??1);
await writeFile(`${root}/dist/provision/LICENSE`,'UNLICENSED — bundled only as an internal locked HanaMesh build artifact.\n');
console.log('Build completed: self-contained ESM modules and public type declarations.');
