/** Run the installed macOS client with a fresh HOME and assert its real, explicitly consented status response. */
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import {join,dirname,isAbsolute} from 'node:path';
import assert from 'node:assert/strict';
const [app,root,site,preparedProfile]=process.argv.slice(2);
if(preparedProfile)assert.ok(isAbsolute(preparedProfile),'Prepared profile must be an absolute owned test-fixture path.');
assert.equal(process.platform,'darwin','This installed Desktop check requires macOS.');
assert.ok(isAbsolute(app??'')&&isAbsolute(root??''),'App and evidence paths must be absolute.');
const profile=preparedProfile??join(app,'Contents/Resources/hanamesh-seeds/profile');
const suitePackage=JSON.parse(await readFile(join(profile,'node_modules/@hanamesh/hanamesh/package.json'),'utf8'));
assert.ok(app&&root&&site,'usage: node tests/native/installed-detection.mjs <installed.app> <new-evidence-root> <website-origin> [owned-CLI-prepared-profile]');
assert.equal(new URL(site).origin,site);
await mkdir(root,{recursive:false,mode:0o700});
for(const name of ['home','dsh','shared','user-data','tmp'])await mkdir(join(root,name));
if(preparedProfile){await mkdir(join(root,'dsh/profiles'));await cp(preparedProfile,join(root,'dsh/profiles/desktop'),{recursive:true,verbatimSymlinks:true});}
const env={PATH:[dirname(process.execPath),'/usr/bin','/bin'].join(':'),HOME:join(root,'home'),DSH_HOME:join(root,'dsh'),HANAMESH_SHARED_HOME:join(root,'shared'),DSH_DESKTOP_USER_DATA_DIR:join(root,'user-data'),TMPDIR:join(root,'tmp')+'/',SHELL:'/bin/zsh',LANG:'en_US.UTF-8'};
const child=spawn(join(app,'Contents/MacOS/HanaMesh'),['--user-data-dir='+join(root,'user-data'),'--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--use-mock-keychain','--password-store=basic'],{env,stdio:['ignore','pipe','pipe'],detached:true});
await writeFile(join(root,'process.json'),JSON.stringify({pid:child.pid,app,site})+'\n');
let log='';child.stdout.on('data',v=>log+=v);child.stderr.on('data',v=>log+=v);
const pause=()=>new Promise(r=>setTimeout(r,250));
class CDP{
 constructor(url){this.ws=new WebSocket(url);this.next=0;this.pending=new Map();this.ready=new Promise((r,j)=>{this.ws.addEventListener('open',r,{once:true});this.ws.addEventListener('error',j,{once:true})});this.ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=this.pending.get(m.id);if(p){this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}}});this.ws.addEventListener('close',()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('UI target closed'))}this.pending.clear()});}
 async send(method,params={}){await this.ready;const id=++this.next;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('UI request timed out: '+method))},10000);this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params}))});}
 async eval(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error('UI evaluation failed');return r.result.value;}
 close(){this.ws.close();}
}
let cdpPort,target,clicked=false;
try{
 const end=Date.now()+60000;
 while(Date.now()<end){
  if(child.exitCode!==null)throw Error('Installed app exited '+child.exitCode);
  if(!cdpPort){try{cdpPort=Number((await readFile(join(root,'user-data/DevToolsActivePort'),'utf8')).split('\n')[0])}catch{await pause();continue}}
  const targets=await(await fetch('http://127.0.0.1:'+cdpPort+'/json/list')).json();
  target=targets.find(t=>t.type==='page'&&t.url.startsWith('dsh-app://'))??targets.find(t=>t.type==='page');
  if(!target){await pause();continue}
  const c=new CDP(target.webSocketDebuggerUrl);
  try{
   const info=await c.eval(`({text:document.body?.innerText??'',buttons:[...document.querySelectorAll('button')].map(b=>b.innerText.trim())})`);
   await writeFile(join(root,'ui-last.json'),JSON.stringify({title:target.title,text:info.text,buttons:info.buttons})+'\n');
   if(!clicked&&info.buttons.includes('Set up later')){await c.eval(`[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Set up later').click()`);clicked=true;}
   if(info.text.includes('New Session')&&info.text.includes('Plugins'))break;
  }finally{c.close()}
  await pause();
 }
 let probes=[];
 // A visible main window can precede plugin activation. Wait only for the owned listener to start.
 do{
  probes=[];
  for(const port of [39317,39318,39319]){
   try{const res=await fetch('http://127.0.0.1:'+port+'/hanamesh/library/install-target',{headers:{origin:site},signal:AbortSignal.timeout(3000)});probes.push({port,status:res.status,acao:res.headers.get('access-control-allow-origin'),body:await res.json()})}
   catch(e){probes.push({port,error:e.cause?.code??e.name})}
  }
  if(probes.some(p=>p.status!==undefined))break;
  await pause();
 }while(Date.now()<end);
 await writeFile(join(root,'probes.json'),JSON.stringify(probes,null,2)+'\n');
 const codes=[...new Set(log.match(/(?:INVALID_CATALOG_URL|AGENT_[A-Z_]+|CORE_[A-Z_]+)/g)??[])];
 await writeFile(join(root,'error-codes.json'),JSON.stringify(codes)+'\n');
 const probe=probes.find(p=>p.status===200&&p.body?.installationStatus?.contract==='hanamesh.installation-status');
 assert.ok(probe,'installed client must advertise installation status; probes='+JSON.stringify(probes));
 assert.equal(probe.acao,site);
 const res=await fetch('http://127.0.0.1:'+probe.port+probe.body.installationStatus.path,{method:'POST',headers:{origin:site,'content-type':'application/json'},body:JSON.stringify({contractVersion:'1',consent:'read-installations'})});
 const status=await res.json();await writeFile(join(root,'installation-status.json'),JSON.stringify({status:res.status,acao:res.headers.get('access-control-allow-origin'),body:status},null,2)+'\n');
 assert.equal(res.status,200);assert.equal(status.client,'hanamesh');assert.equal(status.observations.length,5);
 const current=status.observations.find(o=>o.scope.id==='current-runtime');assert.equal(current.status,'installed');assert.equal(current.version,suitePackage.version);
 console.log(JSON.stringify({result:'PASS',probePort:probe.port,observations:status.observations}));
}catch(error){await writeFile(join(root,'failure.json'),JSON.stringify({message:error.message})+'\n');console.error(error.message);process.exitCode=1;}
finally{
 await writeFile(join(root,'app.stdout-stderr.log'),log,{mode:0o600});
 child.kill('SIGTERM');
 await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,5000))]);
 if(child.exitCode===null)child.kill('SIGKILL');
}
