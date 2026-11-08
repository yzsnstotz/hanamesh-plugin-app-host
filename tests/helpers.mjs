import { mkdtemp, rm, realpath, readFile } from 'node:fs/promises';
import { rmSync, watch, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { request, createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { AppHost, AtomicFileStore } from '../src/index.js';
export const fixture=resolve(import.meta.dirname,'fixtures/app.mjs');
export const parentOrigin='http://127.0.0.1:49123';
export const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Every test directory lives under one root per test process, removed when that process exits — passed, failed or
// thrown. Tests never call mkdtemp on the system temp dir themselves (tests/temp-cleanup.test.mjs guards this).
const processRoots=new Map(),ownedProcessRoots=new Set();
export async function scratch(prefix='t-',{short=false}={}){
  const key=short?'short':'default';
  if(!processRoots.has(key))processRoots.set(key,realpath(short&&process.platform!=='win32'?'/tmp':tmpdir())
    .then(base=>mkdtemp(join(base,short?`hm-${process.pid}-`:`hm-app-host-${process.pid}-`)))
    .then(path=>{ownedProcessRoots.add(path);return path;}));
  return await mkdtemp(join(await processRoots.get(key),prefix));
}
process.on('exit',()=>{for(const path of ownedProcessRoots)rmSync(path,{recursive:true,force:true});});
// Subscribe before the initial read so fast fixture publication cannot be lost.
// This only observes an exact test-created file; it does not change command budgets.
export function waitForFixtureFile(file,{timeoutMs=2000}={}){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);watcher.close();error?reject(error):resolve(value);};
    const check=()=>{void readFile(file,'utf8').then(value=>finish(null,value),error=>{if(error.code!=='ENOENT')finish(error);});};
    const watcher=watch(dirname(file),check);
    const timer=setTimeout(()=>finish(new Error('Fixture did not publish its readiness file within its declared startup budget.')),timeoutMs);
    watcher.once('error',finish);check();
  });
}
export async function temporary(){return await scratch('t-');}
export function definition({id='example',single=true,extra={},embedding='direct'}={}){
  const args=[fixture,'port={{port}}','data={{dataDir}}','runtimeId={{runtimeId}}','instanceId={{instanceId}}',
    ...Object.entries(extra).map(([k,v])=>`${k}=${v}`)];
  return{id,name:`App ${id}`,singleInstanceOnly:single,deployments:[{id:'local',dataId:'data-v1',mode:'owned',command:process.execPath,args,
    env:{},envAllowlist:[],embedding,readiness:{path:'/health',status:200,bodyIncludes:'HANAMESH_FIXTURE'},
    startTimeoutMs:4_000,stopGraceMs:60,gateway:{cookieAllowlist:['app_session','app_pref']}}]};
}
export async function setup(t,{def=definition(),ttl=60_000,sweep=0,root,checkpoint,clock,origin=parentOrigin,nodeBinary}={}){
  const dir=root??await temporary();
  const host=new AppHost({store:new AtomicFileStore(join(dir,'sidecar')),dataRoot:join(dir,'data'),parentOrigin:origin,
    leaseTtlMs:ttl,sweepIntervalMs:sweep,checkpoint,clock,nodeBinary});host.register(def);await host.init();
  t?.after(async()=>{await host.dispose();if(!root)await rm(dir,{recursive:true,force:true});});
  return{host,root:dir,def};
}
export function input(viewId='view-1',appId='example'){return{appId,deploymentId:'local',viewId};}
export function leaseInput(opened){return{viewId:opened.lease.viewId,leaseToken:opened.leaseToken};}
function liveProcessStart(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 1) return null;
  try { process.kill(pid,0); } catch(error) { if(error.code==='ESRCH')return null; throw error; }
  if(process.platform==='linux') {
    try {
      const stat=readFileSync(`/proc/${pid}/stat`,'utf8'),fields=stat.slice(stat.lastIndexOf(')')+2).split(' ');
      if(['Z','X'].includes(fields[0]))return null;
      return `${readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()}:${fields[19]}`;
    } catch(error) { if(['ENOENT','ESRCH'].includes(error.code))return null; throw error; }
  }
  if(process.platform==='darwin') {
    try {
      const fields=execFileSync('/bin/ps',['-o','stat=','-o','lstart=','-p',String(pid)],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().split(/\s+/);
      return fields.length>=6&&!fields[0].startsWith('Z')?fields.slice(1,6).join(' '):null;
    } catch(error) { if(typeof error.status==='number')return null;throw error; }
  }
  // A Windows PID probe proves existence, never a POSIX group or process identity.
  return true;
}
export function pidAlive(pid){return liveProcessStart(pid)!==null;}
export function pidMatches(pid, marker){
  const live=liveProcessStart(pid);if(live===null)return false;
  let evidence;
  try{evidence=JSON.parse(readFileSync(join(marker,'runtime-evidence.json'),'utf8'));}
  catch(error){if(error.code==='ENOENT')return false;throw error;}
  if(evidence.pid!==pid||resolve(evidence.dataDir)!==resolve(marker))return false;
  if(typeof evidence.processStart==='string'&&typeof live==='string')return evidence.processStart===live;
  // Unknown identity fails closed for cleanup: an existing matching PID cannot
  // be reported as reaped merely because the platform lacks a start token.
  return true;
}
export async function until(fn,{timeout=6_000,interval=30}={}){
  const end=Date.now()+timeout;let last;
  while(Date.now()<end){try{last=await fn();if(last)return last;}catch(e){last=e;}await delay(interval);}
  throw new Error(`Condition did not become true: ${last}`);
}
export function http(url,{method='GET',headers={},body}={}){
  return new Promise((resolve,reject)=>{
    const u=new URL(url);
    const req=request(url,{method,headers,...(u.hostname.endsWith('.localhost')?{hostname:'127.0.0.1',port:u.port,agent:false,headers:{host:u.host,...headers}}:{})},res=>{
      const chunks=[];res.on('data',d=>chunks.push(d));res.once('end',()=>{
        const bytes=Buffer.concat(chunks);let json;try{json=JSON.parse(bytes.toString());}catch{}
        resolve({status:res.statusCode,headers:res.headers,rawHeaders:res.rawHeaders,body:bytes,json});
      });res.once('error',reject);
    });req.once('error',reject);req.setTimeout(8_000,()=>req.destroy(new Error('test request timeout')));
    if(body!==undefined)req.write(body);req.end();
  });
}
export async function external(t){
  const root=await temporary();
  const reservation=createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;
  await new Promise(r=>reservation.close(r));
  const child=spawn(process.execPath,[fixture,`port=${port}`,`data=${root}`,'runtimeId=external','instanceId=external'],{stdio:['ignore','pipe','pipe']});
  let stdout='';child.stdout.on('data',d=>{stdout+=d;});child.stderr.on('data',()=>{});
  t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){const done=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await done;}await rm(root,{recursive:true,force:true});});
  const origin=`http://127.0.0.1:${port}`;await until(()=>stdout.includes('FIXTURE_READY'));
  return{child,origin,root};
}
// Explicit portable HTTP/lease fixture. This remains attach mode and the test
// that created the external process owns cleanup; AppHost never acquires it.
export async function attachDefinition(t,{id='example',single=true,embedding='direct'}={}){
  const {origin}=await external(t);
  return{id,name:`App ${id}`,singleInstanceOnly:single,deployments:[{id:'local',dataId:'data-v1',mode:'attach',url:origin,
    embedding,readiness:{path:'/health',status:200,bodyIncludes:'HANAMESH_FIXTURE'}}]};
}
export async function identity(origin){return(await http(origin+'/identity')).json;}

// Public DSH registry DTO for CLI tests: no fallback or host configuration is inferred by AppHost.
