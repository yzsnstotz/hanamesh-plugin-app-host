import {resolve,sep,dirname} from 'node:path';
import {lstat,unlink,rmdir} from 'node:fs/promises';
import {requireCondition} from './errors.js';
export async function clearGeneratedRuntimeCache(result,runtimeRoot){
  if(!Array.isArray(result?.kept)||result.kept.length===0)return;
  const target=resolve(result.target??'');
  requireCondition(target.startsWith(resolve(runtimeRoot)+sep),'RUNTIME_RESIDUE','Runtime cleanup target is outside the application runtime root.');
  const remaining=[];
  for(const rel of result.kept){
    if(typeof rel!=='string'||!/(?:^|\/)__pycache__\/[^/]+\.pyc$/.test(rel)){remaining.push(rel);continue;}
    const file=resolve(target,rel);
    if(!file.startsWith(target+sep)){remaining.push(rel);continue;}
    const info=await lstat(file).catch(error=>error.code==='ENOENT'?null:Promise.reject(error));
    if(!info?.isFile()){remaining.push(rel);continue;}
    await unlink(file);
    for(let dir=dirname(file);dir.startsWith(target+sep);dir=dirname(dir)){
      try{await rmdir(dir);}catch(error){if(error.code==='ENOTEMPTY'||error.code==='ENOENT')break;throw error;}
    }
  }
  if(remaining.length===0){try{await rmdir(target);}catch(error){if(error.code!=='ENOTEMPTY'&&error.code!=='ENOENT')throw error;}}
  const residue=await lstat(target).catch(error=>error.code==='ENOENT'?null:Promise.reject(error));
  requireCondition(remaining.length===0&&residue===null,'RUNTIME_RESIDUE','Runtime has unowned files that require manual review.',{count:remaining.length},409);
}
