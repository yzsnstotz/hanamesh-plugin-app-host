import { mkdtemp, rm, realpath, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { request, createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { AppHost, AtomicFileStore } from '../src/index.js';
export const fixture=resolve(import.meta.dirname,'fixtures/app.mjs');
export const parentOrigin='http://127.0.0.1:49123';
export const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function temporary(){return await mkdtemp(join(await realpath(tmpdir()),`hm-app-host-${process.pid}-`));}
export function definition({id='example',single=true,extra={},embedding='direct'}={}){
  const args=[fixture,'port={{port}}','data={{dataDir}}','runtimeId={{runtimeId}}','instanceId={{instanceId}}',
    ...Object.entries(extra).map(([k,v])=>`${k}=${v}`)];
  return{id,name:`App ${id}`,singleInstanceOnly:single,deployments:[{id:'local',dataId:'data-v1',mode:'owned',command:process.execPath,args,
    env:{},envAllowlist:[],embedding,readiness:{path:'/health',status:200,bodyIncludes:'HANAMESH_FIXTURE'},
    startTimeoutMs:4_000,stopGraceMs:60,gateway:{cookieAllowlist:['app_session','app_pref']}}]};
}
export async function setup(t,{def=definition(),ttl=60_000,sweep=0,root,checkpoint,origin=parentOrigin,nodeBinary}={}){
  const dir=root??await temporary();
  const host=new AppHost({store:new AtomicFileStore(join(dir,'sidecar')),dataRoot:join(dir,'data'),parentOrigin:origin,
    leaseTtlMs:ttl,sweepIntervalMs:sweep,checkpoint,nodeBinary});host.register(def);await host.init();
  t?.after(async()=>{await host.dispose();if(!root)await rm(dir,{recursive:true,force:true});});
  return{host,root:dir,def};
}
export function input(viewId='view-1',appId='example'){return{appId,deploymentId:'local',viewId};}
export function leaseInput(opened){return{viewId:opened.lease.viewId,leaseToken:opened.leaseToken};}
export function pidAlive(pid){
  try{
    const state=execFileSync('ps',['-o','stat=','-p',String(pid)],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
    return Boolean(state)&&!state.startsWith('Z');
  }catch{return false;}
}
export async function until(fn,{timeout=6_000,interval=30}={}){
  const end=Date.now()+timeout;let last;
  while(Date.now()<end){try{last=await fn();if(last)return last;}catch(e){last=e;}await delay(interval);}
  throw new Error(`Condition did not become true: ${last}`);
}
export function http(url,{method='GET',headers={},body}={}){
  return new Promise((resolve,reject)=>{
    const req=request(url,{method,headers},res=>{
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
export async function identity(origin){return(await http(origin+'/identity')).json;}
