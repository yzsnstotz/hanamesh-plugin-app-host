/** Fixed official read-only CLI calls. No browser-controlled argv, environment or profile path. */
import {fork} from 'node:child_process';
import {guardNodeBinary} from '../git-process.js';
import {stat,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,isAbsolute,delimiter} from 'node:path';
import {AppHostError} from '../errors.js';
const fail=code=>{throw new AppHostError(code,'The configured official installation reader could not complete.',{},503)};
export const SUPPORTED_READER_VERSIONS=Object.freeze({claude:'2.1.301 (Claude Code)',codex:'codex-cli 0.162.1'});
export function validReader(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const keys=['executable','home','configDir','pluginName','marketplace','marketplaceUrl','timeoutMs','maxOutputBytes'];
 if(Object.keys(value).some(key=>!keys.includes(key))||!['executable','home','configDir'].every(key=>typeof value[key]==='string'&&isAbsolute(value[key])&&!/[\x00-\x1f]/.test(value[key])))return false;
 if(!['pluginName','marketplace'].every(key=>typeof value[key]==='string'&&/^[a-z0-9][a-z0-9._-]{0,127}$/.test(value[key])))return false;
 try{const url=new URL(value.marketplaceUrl);if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search||url.href!==value.marketplaceUrl)return false}catch{return false}
 return Number.isSafeInteger(value.timeoutMs)&&value.timeoutMs>0&&value.timeoutMs<=2_147_483_647&&Number.isSafeInteger(value.maxOutputBytes)&&value.maxOutputBytes>0;
}
export async function runOfficialInstallationCommand({channel,reader,args,signal,workerNode}){
 if(signal?.aborted)fail('INSTALLATION_STATUS_CANCELLED');
 if(process.platform==='win32')fail('AGENT_READER_PLATFORM_UNSUPPORTED');
 if(!validReader(reader))fail('AGENT_READER_CONFIG_INVALID');
 const nodeRuntime=guardNodeBinary({workerNode});if(!nodeRuntime)fail('AGENT_READER_NODE_REQUIRED');
 for(const path of [reader.home,reader.configDir]){let value;try{value=await stat(path)}catch{fail('AGENT_PROFILE_UNAVAILABLE')}if(!value.isDirectory())fail('AGENT_PROFILE_UNAVAILABLE')}
 const cwd=await mkdtemp(join(tmpdir(),'hanamesh-installation-read-'));
 // An exact configuration directory is explicit. Inherited model/API tokens, proxy, shell startup and askpass are absent.
 const env={PATH:[dirname(nodeRuntime),'/usr/bin','/bin','/usr/local/bin'].join(delimiter),HOME:reader.home,USERPROFILE:reader.home,
  XDG_CONFIG_HOME:join(cwd,'config'),XDG_CACHE_HOME:join(cwd,'cache'),XDG_STATE_HOME:join(cwd,'state'),TMPDIR:cwd,TMP:cwd,TEMP:cwd,
  ...(channel==='claude'?{CLAUDE_CONFIG_DIR:reader.configDir,CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',DISABLE_AUTOUPDATER:'1'}:{CODEX_HOME:reader.configDir}),
  GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'credential.helper',GIT_CONFIG_VALUE_0:''};
 try{return await new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new AppHostError('INSTALLATION_STATUS_CANCELLED','Installation read was cancelled.',{},499));return}
  const child=fork(new URL('./installation-worker.js',import.meta.url),[],{cwd,env,execPath:nodeRuntime,execArgv:[],detached:true,stdio:['ignore','pipe','pipe','ipc']});
  const chunks=[];let total=0,stderr=false,fault,exited=false,message;
  const kill=code=>{fault??=code;if(!exited&&child.pid){child.kill('SIGTERM')}};
  const abort=()=>kill('INSTALLATION_STATUS_CANCELLED');signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>kill('AGENT_READER_TIMEOUT'),reader.timeoutMs);
  child.stdout.on('data',chunk=>{total+=chunk.length;if(total>reader.maxOutputBytes)kill('AGENT_READER_OUTPUT_LIMIT');else chunks.push(chunk)});
  child.stderr.on('data',chunk=>{stderr=true;total+=chunk.length;if(total>reader.maxOutputBytes)kill('AGENT_READER_OUTPUT_LIMIT')});
  child.on('message',value=>{message=value});
  child.once('exit',()=>{exited=true});
  child.once('error',error=>{fault??=error.code==='EACCES'?'AGENT_READER_PERMISSION_DENIED':'AGENT_READER_UNAVAILABLE'});
  child.once('close',code=>{exited=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
   if(fault||message?.error||message?.result!==0||stderr)reject(new AppHostError(fault??message?.error??(stderr?'AGENT_READER_DIAGNOSTIC':'AGENT_READER_FAILED'),'The configured official reader did not return a complete clean result.',{},503));
   else resolve(Buffer.concat(chunks).toString('utf8'));
  });
  if(child.connected)child.send({executable:reader.executable,args,cwd,env},()=>{});
  if(signal?.aborted)abort();
 })}finally{await rm(cwd,{recursive:true,force:true})}
}
