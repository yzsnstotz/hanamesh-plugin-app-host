#!/usr/bin/env node
// Use under fnm exec --using=24.13.1. The child and all ordinary Git descendants
// receive helper isolation; raw trace (which can contain URLs) is never printed.
import {spawnGitSafe} from '../src/git-process.js';
if(process.version!=='v24.13.1')throw new Error('Run with fnm exec --using=24.13.1.');
const [command,...args]=process.argv.slice(2);
if(!command)throw new Error('Usage: node scripts/safe-git.mjs <command> [arguments...]');
const controller=new AbortController();
const abort=()=>controller.abort();
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,abort);
try{
  const result=await spawnGitSafe(command==='node'?process.execPath:command,args,{stdio:'inherit',signal:controller.signal});
  process.exitCode=result.code??1;
}catch(error){
  console.error(error.code??'GIT_GUARD_FAILED');process.exitCode=1;
}finally{for(const signal of ['SIGINT','SIGTERM'])process.removeListener(signal,abort);}
