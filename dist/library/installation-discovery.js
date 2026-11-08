/** Host-only discovery. Lists executable directories, never authentication/config contents. */
import {access,stat,readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {homedir,userInfo} from 'node:os';
import {join,isAbsolute} from 'node:path';
import semver from 'semver';
import {AppHostError} from '../errors.js';
import {runOfficialInstallationCommand,INSTALLATION_MANAGER_ENV_KEYS} from './installation-cli.js';

// Existing installation-command fixture budgets; automatic selection adds no retry or longer deadline.
export const INSTALLATION_READ_BUDGET=Object.freeze({timeoutMs:2000,maxOutputBytes:20000});
export const AGENT_INSTALLATION_TARGET=Object.freeze({pluginName:'hanamesh',marketplace:'hanamesh',marketplaceUrl:'https://github.com/yzsnstotz/hanamesh-plugins'});
const absolute=value=>typeof value==='string'&&isAbsolute(value)&&!/[\x00-\x1f]/.test(value);
const failure=code=>new AppHostError(code,'Automatic official CLI discovery could not complete.',{},503);
const split=(value,platform)=>(value??'').split(platform==='win32'?';':':').filter(absolute);
const unique=values=>[...new Set(values.filter(absolute))];
async function exists(file,platform){try{if(!(await stat(file)).isFile())return false;await access(file,platform==='win32'?constants.F_OK:constants.X_OK);return true}catch(error){if(['ENOENT','ENOTDIR'].includes(error.code))return false;if(['EACCES','EPERM'].includes(error.code))throw failure('AGENT_READER_PERMISSION_DENIED');throw failure('AGENT_READER_UNAVAILABLE')}}
async function versions(root,suffix){
 let entries;try{entries=await readdir(root,{withFileTypes:true})}catch(error){if(['ENOENT','ENOTDIR'].includes(error.code))return[];throw failure(error.code==='EACCES'?'AGENT_READER_PERMISSION_DENIED':'AGENT_READER_UNAVAILABLE')}
 return entries.filter(entry=>(entry.isDirectory()||entry.isSymbolicLink())&&semver.valid(entry.name.replace(/^v/,''))).sort((a,b)=>semver.rcompare(a.name.replace(/^v/,''),b.name.replace(/^v/,''))).map(entry=>join(root,entry.name,...suffix));
}

/** VS Code's login/interactive shell pattern, extracting PATH alone, never `env` or startup output. */
export async function readLoginPath({home=homedir(),env=process.env,signal,workerNode,timeoutMs=INSTALLATION_READ_BUDGET.timeoutMs}={}){
 const shell=env.SHELL??userInfo().shell;
 if(!absolute(shell))throw failure('AGENT_SHELL_ENV_UNAVAILABLE');
 const output=await runOfficialInstallationCommand({channel:'shell',reader:{executable:shell,home,configDir:home,...AGENT_INSTALLATION_TARGET,...INSTALLATION_READ_BUDGET,timeoutMs},
  args:['-ilc',`printf '\\0HANAMESH_PATH\\0%s\\0' "$PATH"`],signal,workerNode});
 const parts=output.split('\0HANAMESH_PATH\0');
 if(parts.length!==2||!parts[1].includes('\0'))throw failure('AGENT_SHELL_ENV_UNAVAILABLE');
 const path=parts[1].split('\0')[0];if(/[\x00-\x1f]/.test(path))throw failure('AGENT_SHELL_ENV_UNAVAILABLE');return path;
}

/** Select once: inherited PATH, login PATH, then documented layouts; never try another CLI after execution. */
export async function discoverOfficialReader({channel,home=process.env.HOME??process.env.USERPROFILE??homedir(),env=process.env,platform=process.platform,
 systemBinDirs=platform==='win32'?[]:['/opt/homebrew/bin','/usr/local/bin','/home/linuxbrew/.linuxbrew/bin','/usr/bin','/bin'],loginPath=readLoginPath,signal,workerNode}={}){
 if(!['claude','codex'].includes(channel)||!absolute(home))throw failure('AGENT_PROFILE_UNAVAILABLE');
 signal?.throwIfAborted();
 const configDir=env[channel==='claude'?'CLAUDE_CONFIG_DIR':'CODEX_HOME']??join(home,channel==='claude'?'.claude':'.codex');
 if(!absolute(configDir))throw failure('AGENT_PROFILE_UNAVAILABLE');
 const appData=env.APPDATA??join(home,'AppData','Roaming'),local=env.LOCALAPPDATA??join(home,'AppData','Local');
 const nvm=env.NVM_DIR??join(home,'.nvm'),fnm=env.FNM_DIR??join(home,'.local','share','fnm'),asdf=env.ASDF_DATA_DIR??join(home,'.asdf'),mise=env.MISE_DATA_DIR??join(home,'.local','share','mise');
 const runtimeEnv=Object.fromEntries(INSTALLATION_MANAGER_ENV_KEYS.filter(key=>absolute(env[key])).map(key=>[key,env[key]]));
 const reader={home,configDir,...AGENT_INSTALLATION_TARGET,...INSTALLATION_READ_BUDGET,...(Object.keys(runtimeEnv).length?{runtimeEnv}:{})};
 const find=async dirs=>{for(const dir of unique(dirs)){
  signal?.throwIfAborted();
  for(const name of platform==='win32'?[`${channel}.exe`,`${channel}.cmd`]:[channel]){
   const executable=join(dir,name);if(!await exists(executable,platform))continue;
   if(name.endsWith('.cmd')){
    const entry=channel==='claude'?['@anthropic-ai','claude-code','cli.js']:['@openai','codex','bin','codex.js'];
    const entries=[join(dir,'node_modules',...entry)];
    if(dir===join(local,'Yarn','bin'))entries.push(join(local,'Yarn','Data','global','node_modules',...entry));
    if(dir===join(home,'.yarn','bin'))entries.push(join(home,'.config','yarn','global','node_modules',...entry));
    // pnpm's global layout has a numbered compatibility directory; inspect directory names only.
    for(const base of unique([dir,...(dir===join(local,'pnpm','bin')?[join(local,'pnpm')]:[]),...(absolute(env.PNPM_HOME)&&dir===join(env.PNPM_HOME,'bin')?[env.PNPM_HOME]:[])])){
     let global=[];try{global=await readdir(join(base,'global'))}catch(error){if(!['ENOENT','ENOTDIR'].includes(error.code))throw failure('AGENT_READER_ENTRYPOINT_UNAVAILABLE')}
     for(const name of global.filter(name=>/^\d+$/.test(name)).sort((a,b)=>Number(b)-Number(a)))entries.push(join(base,'global',name,'node_modules',...entry));
    }
    let script;for(const candidate of entries)if(await exists(candidate,'win32')){script=candidate;break}
    if(!script)throw failure('AGENT_READER_ENTRYPOINT_UNAVAILABLE');
    return{...reader,executable:script,nodeScript:true};
   }
   return{...reader,executable};
  }
 }return null};
 let selected=await find(split(env.PATH??env.Path,platform));if(selected)return selected;
 let shellError;
 if(platform!=='win32'){
  try{selected=await find(split(await loginPath({home,env,signal,workerNode}),platform));if(selected)return selected}
  catch(error){if(signal?.aborted)throw error;shellError=error}
 }
 const fixed=[join(home,'.local','bin'),...(channel==='claude'?[join(home,'.claude','local'),join(home,'.claude','local','node_modules','.bin')]:[]),
  env.CODEX_INSTALL_DIR,env.NVM_BIN,env.NVM_SYMLINK,env.FNM_MULTISHELL_PATH,
  ...[env.npm_config_prefix,env.NPM_CONFIG_PREFIX,join(home,'.npm-global'),join(home,'.npm')].filter(absolute).map(root=>platform==='win32'?root:join(root,'bin')),
  env.PNPM_HOME,...(absolute(env.PNPM_HOME)?[join(env.PNPM_HOME,'bin')]:[]),join(home,'.local','share','pnpm'),join(home,'.local','share','pnpm','bin'),join(home,'Library','pnpm'),join(home,'Library','pnpm','bin'),join(home,'.yarn','bin'),join(home,'.config','yarn','global','node_modules','.bin'),
  join(env.VOLTA_HOME??join(home,'.volta'),'bin'),join(asdf,'shims'),join(mise,'shims'),
  ...(platform==='win32'?[join(appData,'npm'),join(local,'pnpm'),join(local,'Yarn','bin'),join(local,'Programs','OpenAI','Codex','bin'),join(local,'Microsoft','WinGet','Links'),join(local,'Volta','bin'),...(absolute(env.ProgramFiles)?[join(env.ProgramFiles,'nodejs')]:[])]:[]),...systemBinDirs];
 selected=await find(fixed);if(selected)return selected;
 const managed=[];
 for(const [root,suffix]of [[join(nvm,'versions','node'),['bin']],[env.NVM_HOME,[]],[join(fnm,'node-versions'),['installation',...(platform==='win32'?[]:['bin'])]],
  [join(home,'Library','Application Support','fnm','node-versions'),['installation','bin']],[join(appData,'fnm','node-versions'),['installation']],
  [join(asdf,'installs','nodejs'),['bin']],[join(mise,'installs','node'),['bin']]]){
  if(absolute(root))managed.push(...await versions(root,suffix));
 }
 selected=await find(managed);if(selected)return selected;
 if(shellError)throw failure(shellError.code==='AGENT_READER_TIMEOUT'?'AGENT_READER_TIMEOUT':'AGENT_SHELL_ENV_UNAVAILABLE');
 throw failure('AGENT_READER_UNAVAILABLE');
}
