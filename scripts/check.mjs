import {spawnGitSafe} from '../src/git-process.js';
const controller=new AbortController(),abort=()=>controller.abort();
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,abort);
try{
 for(const step of ['check:toolchain','build','check:consistency','test','test:mutation','test:types','preflight']){
  console.log(JSON.stringify({event:'check-step-start',step}));
  const result=await spawnGitSafe('npm',['run',step],{stdio:'inherit',signal:controller.signal});
  console.log(JSON.stringify({event:'check-step-exit',step,exitCode:result.code,signal:result.signal}));
  if(result.code!==0){process.exitCode=result.code??1;break;}
 }
}finally{for(const signal of ['SIGINT','SIGTERM'])process.removeListener(signal,abort);}
