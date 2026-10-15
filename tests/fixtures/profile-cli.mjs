// Own DSH CLI stand-in: profile writes only; no package manager, Git, network or credentials.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
assert.equal(process.env.GIT_CONFIG_NOSYSTEM,'1');
assert.equal(process.env.GIT_CONFIG_VALUE_1,'!gh auth git-credential');
const file=join(process.cwd(),'package.json'),manifest=JSON.parse(await readFile(file,'utf8'));
const args=process.argv.slice(2),remove=args.includes('remove'),spec=args.at(-1),split=spec.lastIndexOf('@');
try{await readFile(join(process.cwd(),'.fixture-fail'));console.error('fixture not-bundle');process.exit(19);}catch(error){if(error.code!=='ENOENT')throw error;}
if(remove){delete manifest.dependencies[spec];manifest.dsh.profile.bundles=manifest.dsh.profile.bundles.filter(name=>name!==spec);await rm(join(process.cwd(),'node_modules',spec),{recursive:true,force:true});}
else{const name=spec.slice(0,split),version=spec.slice(split+1);manifest.dependencies[name]=version;manifest.dsh.profile.bundles.push(name);await mkdir(join(process.cwd(),'node_modules',name),{recursive:true});await writeFile(join(process.cwd(),'node_modules',name,'package.json'),JSON.stringify({name,version,dsh:{bundle:{patch:'./p.yml'}}}));}
await writeFile(file,JSON.stringify(manifest));
