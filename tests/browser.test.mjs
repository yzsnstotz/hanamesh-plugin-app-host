import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile,writeFile,access,rm,mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHttpHandler } from '../src/index.js';
import { setup,definition,temporary,until,pidAlive,delay } from './helpers.mjs';
async function chrome(t){
  let binary;
  // HM_CHROMIUM names an isolated Chromium binary on hosts without a system one (e.g. a Playwright cache on macOS).
  const candidates=[process.env.HM_CHROMIUM,'/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'].filter(Boolean);
  for(const candidate of candidates)try{await access(candidate);binary=candidate;break;}catch{}
  if(!binary){t.skip('REAL_BROWSER unavailable: isolated Chromium binary was not found.');return null;}
  const root=await temporary(),profile=join(root,'chromium-profile');
  const processHandle=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{detached:true,stdio:['ignore','ignore','pipe']});
  let stderr='';processHandle.stderr.on('data',b=>{stderr=(stderr+b).slice(-8000);});
  const kill=async signal=>{
    if(processHandle.exitCode!==null||processHandle.signalCode!==null)return;
    const exited=new Promise(r=>processHandle.once('exit',r));process.kill(-processHandle.pid,signal);await exited;
  };
  t.after(async()=>{await kill('SIGKILL');await rm(root,{recursive:true,force:true});});
  const activePort=await until(async()=>{const text=await readFile(join(profile,'DevToolsActivePort'),'utf8');return text.trim().split('\n');},{timeout:12000});
  const socket=new WebSocket(`ws://127.0.0.1:${activePort[0]}${activePort[1]}`);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  t.after(()=>socket.close());let id=0;const pending=new Map();
  socket.addEventListener('message',event=>{const m=JSON.parse(event.data),request=pending.get(m.id);if(!request)return;pending.delete(m.id);clearTimeout(request.timer);m.error?request.reject(new Error(JSON.stringify(m.error))):request.resolve(m.result);});
  socket.addEventListener('close',()=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(new Error('Browser connection closed.'));}pending.clear();});
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const requestId=++id;const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('CDP timeout: '+method+' '+stderr.slice(-500)));},8000);pending.set(requestId,{resolve,reject,timer});socket.send(JSON.stringify({id:requestId,method,params,...(sessionId?{sessionId}:{})}));});
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const call=(method,params)=>send(method,params,sessionId);await call('Page.enable');await call('Runtime.enable');
  const evaluate=async(expression,contextId)=>{
    const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,...(contextId?{contextId}:{})});
    if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;
  };
  return{call,evaluate,kill,pid:processHandle.pid,version:await send('Browser.getVersion')};
}
async function browserHost(t,{ttl=60_000,sweep=0}={}){
  const browser=await chrome(t);if(!browser)return null;
  let handler;const server=createServer(async(req,res)=>{
    if(req.url==='/'){
      res.writeHead(200,{'content-type':'text/html','set-cookie':'DSH_TEST_AUTH=test-owner; HttpOnly; SameSite=Strict; Path=/'});
      res.end('<!doctype html><html><head><title>HanaMesh app-host acceptance fixture</title></head><body><h1>App-host: isolated browser acceptance fixture</h1><p>This is a test application, not the HanaMesh workbench.</p></body></html>');return;
    }
    if(req.url==='/client.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(await readFile(new URL('../src/client.js',import.meta.url)));return;}
    await handler(req,res);
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));
  const {host}=await setup(t,{def:definition({embedding:'gateway'}),origin,ttl,sweep});
  handler=createHttpHandler(host,{parentOrigin:origin,authenticate:req=>req.headers.cookie?.split(';').some(s=>s.trim()==='DSH_TEST_AUTH=test-owner')?{principalId:'browser-owner'}:null,authorize:()=>true});
  const navigation=await browser.call('Page.navigate',{url:origin});
  if(navigation.errorText==='net::ERR_BLOCKED_BY_ADMINISTRATOR'){
    console.log('REAL_BROWSER BLOCKED: administrator policy denies loopback navigation; policy was not modified.');
    t.skip('BLOCKED: Chromium net::ERR_BLOCKED_BY_ADMINISTRATOR on isolated loopback test profile.');return null;
  }
  assert(!navigation.errorText,JSON.stringify(navigation));
  await until(()=>browser.evaluate(`location.origin===${JSON.stringify(origin)} && document.readyState==='complete'`));
  const receipt=await browser.evaluate(`(async()=>{
    const {WorkspaceAppClient}=await import('/client.js');globalThis.sdk=new WorkspaceAppClient({origin:location.origin});
    const pending=await sdk.open({appId:'example',deploymentId:'local',viewId:'browser-view'});
    globalThis.receipt=await sdk.waitUntilReady(pending);globalThis.lease={viewId:receipt.lease.viewId,leaseToken:receipt.leaseToken};
    globalThis.beat=setInterval(()=>sdk.heartbeat(lease).catch(()=>clearInterval(beat)),100);
    const frame=document.createElement('iframe');frame.id='application';frame.width='900';frame.height='300';frame.src=receipt.uiUrl;document.body.append(frame);
    return receipt;
  })()`);
  const frame=await until(async()=>{
    const {frameTree}=await browser.call('Page.getFrameTree');return frameTree.childFrames?.find(f=>f.frame.url.startsWith(new URL(receipt.uiUrl).origin)&&!f.frame.url.includes('__hanamesh_bootstrap'))?.frame;
  });
  const {executionContextId}=await browser.call('Page.createIsolatedWorld',{frameId:frame.id,worldName:'acceptance-observation'});
  await until(async()=>(await browser.evaluate('document.body?.textContent',executionContextId))?.includes('HANAMESH_FIXTURE'));
  return{browser,host,origin,receipt,frameContext:executionContextId};
}
test('H13 REAL_BROWSER: named parent embeds unchanged app; direct top navigation and iframe control calls are denied',async t=>{
  const state=await browserHost(t);if(!state)return;const {browser,host,origin,receipt,frameContext}=state;
  for(const payload of [{command:'/bin/sh'},{command:'/bin/echo',args:['bad']},{env:{DSH_TOKEN:'bad'}},{url:'http://example.invalid'}]){
    const result=await browser.evaluate(`fetch(${JSON.stringify(origin+'/apps/open')},{method:'POST',credentials:'include',headers:{'content-type':'application/json','x-hanamesh-client':'workspace-v1'},body:JSON.stringify(${JSON.stringify({appId:'example',deploymentId:'local',viewId:'evil',...payload})})}).then(r=>({status:r.status})).catch(e=>({blocked:e.name}))`,frameContext);
    assert.equal(result.blocked,'TypeError');
  }
  assert.equal(host.list('browser-owner').views.length,1);
  await mkdir(new URL('../docs/acceptance',import.meta.url),{recursive:true});
  const shot=await browser.call('Page.captureScreenshot',{format:'png'});await writeFile(new URL('../docs/acceptance/browser-fixture.png',import.meta.url),Buffer.from(shot.data,'base64'));
  await browser.call('Page.navigate',{url:new URL(receipt.uiUrl).origin});
  await until(async()=>(await browser.evaluate('document.body?.textContent'))?.includes('GATEWAY_REQUEST_DENIED'));
  console.log('REAL_BROWSER embedding/security:',JSON.stringify({browser:browser.version.product,namedParentEmbedded:true,iframeMaliciousCallsBlocked:4,directTopNavigationDenied:true}));
});
test('H10 REAL_BROWSER: SIGKILL browser process group, no unload, lease expiry stops actual owned application',async t=>{
  const state=await browserHost(t,{ttl:1200,sweep:50});if(!state)return;const {browser,host,receipt}=state;
  const appPid=host.instance(receipt.instance.id,'browser-owner').pid;assert(pidAlive(appPid));
  await browser.kill('SIGKILL');await until(()=>host.instance(receipt.instance.id,'browser-owner').status==='stopped');
  assert.equal(host.list('browser-owner').views[0].status,'expired');assert(!pidAlive(appPid));
  console.log('REAL_BROWSER lease expiry:',JSON.stringify({browser:browser.version.product,signal:'SIGKILL',browserPid:browser.pid,appPid,noUnload:true,lease:'expired',runtime:'stopped'}));
});
