import {spawnGitSafe} from '../src/git-process.js';
const controller=new AbortController(),abort=()=>controller.abort();
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,abort);
try{
 for(const step of ['check:toolchain','build','check:consistency','test','test:mutation','test:types','preflight']){
  const result=await spawnGitSafe('npm',['run',step],{stdio:'inherit',signal:controller.signal});
  if(result.code!==0){process.exitCode=result.code??1;break;}
 }
}finally{for(const signal of ['SIGINT','SIGTERM'])process.removeListener(signal,abort);}
