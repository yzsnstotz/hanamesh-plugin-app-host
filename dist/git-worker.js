// Internal IPC supervisor. The parent never detaches a package manager directly.
import {spawn,spawnSync} from 'node:child_process';
import {existsSync,mkdtempSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,basename} from 'node:path';
import {observeGitTrace} from './git-process.js';
let monitor,directory,timer,done=false,started=false;
function finish(payload){
 if(done)return;done=true;clearInterval(timer);
 try{monitor?.check(true);}catch(error){payload={error:{code:error.code??'GIT_TRACE_INVALID'}};}
 try{if(monitor)monitor.close();else if(directory)rmSync(directory,{recursive:true,force:true});}catch{payload={error:{code:'GIT_TRACE_CLEANUP_FAILED'}};}
 const end=()=>{
  if(process.platform==='win32'){spawnSync('taskkill',['/pid',String(process.pid),'/T','/F'],{stdio:'ignore'});process.exit(1);}
  else process.kill(-process.pid,'SIGKILL');
 };
 if(process.connected)process.send(payload,end);else end();
}
function abort(code='ABORT_ERR'){finish({error:{code,...(code==='ABORT_ERR'?{name:'AbortError'}:{})}});}
process.once('disconnect',()=>abort());
process.once('SIGTERM',()=>abort());process.once('SIGINT',()=>abort());
if(!process.connected)process.exit(1);
process.on('message',request=>{
 if(request.abort)return abort();if(request.timeout)return abort('ETIMEDOUT');
 if(started)return;started=true;
 try{
  let {command,args,options}=request;
  // No caller-owned trace exists before this IPC worker can clean on disconnect.
  directory=mkdtempSync(join(realpathSync(options.env.TMPDIR??tmpdir()),'hm-git-guard-'));
  writeFileSync(join(directory,'events.jsonl'),'',{mode:0o600});monitor=observeGitTrace(directory);
  options.env={...options.env,GIT_TRACE2_EVENT:join(directory,'events.jsonl'),GIT_TRACE_REDACT:'1'};
  if(!process.connected)return abort();
  process.send({directory},error=>{if(error)abort();});
  // Native Windows .cmd shims cannot be executed by spawn without a shell.
  // Resolve the normal npm/global pnpm JS entry and keep argument arrays intact.
  const manager=basename(command).replace(/\.cmd$/i,'').toLowerCase();
  if(process.platform==='win32'&&['npm','npx','pnpm'].includes(manager)){
   const pkg=manager==='pnpm'?'pnpm':'npm',entry=manager==='pnpm'?'pnpm.cjs':manager+'-cli.js';
   const supplied=options.env.npm_execpath;
   const candidates=[...(supplied&&basename(supplied)===entry?[supplied]:[]),...[dirname(process.execPath),...(options.env.PATH??options.env.Path??'').split(';')].map(base=>join(base,'node_modules',pkg,'bin',entry))];
   const cli=candidates.find(path=>existsSync(path));if(!cli)throw Object.assign(new Error('Package manager JS entry unavailable.'),{code:'PACKAGE_MANAGER_UNAVAILABLE'});
   command=process.execPath;args=[cli,...args];
  }
  const {input,...spawnOptions}=options;
  const child=spawn(command,args,{...spawnOptions,stdio:[input===undefined?'ignore':'pipe','inherit','inherit'],detached:false});
  if(input!==undefined){child.stdin.on('error',()=>{});child.stdin.end(input);}
  child.once('error',error=>finish({error:{code:error.code??'SPAWN_FAILED'}}));
  child.once('close',(code,signal)=>finish({result:{code,status:code,signal}}));
  timer=setInterval(()=>{try{monitor.check();}catch(error){finish({error:{code:error.code??'GIT_TRACE_INVALID'}});}},25);
 }catch(error){finish({error:{code:error.code??'GIT_GUARD_FAILED'}});}
});
