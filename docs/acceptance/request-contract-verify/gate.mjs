// Independent verifier fixtures; never loads implementation acceptance probes/helpers.
import assert from 'node:assert/strict';
import {request,createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile,realpath,mkdtemp,stat,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {Context} from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as JsonStorage from '@deepseek-ai/dsh-storage-json';
import * as Domain from '@deepseek-ai/dsh-storage-domain';
import WebServer from '@deepseek-ai/dsh-host-webserver';
import * as Connection from '@deepseek-ai/dsh-client-connection';
import * as AppHost from '../../../dist/dsh.js';
import {createLibraryHttpHandler} from '../../../dist/library/routes.js';
import {resolveLibraryLocations,inferNodeBinary,inferDshBin,inferProfileDir} from '../../../dist/library/locate.js';
import {ledger} from '../../../dist/provision/index.js';
import {validateDefinition} from '../../../dist/descriptor.js';
const out=process.argv[2]; assert.ok(out);
const root=await realpath(await mkdtemp(join(tmpdir(),'independent-apphost-')));
const result={root,evidence:['SOURCE','FIXTURE','REAL_RUNTIME component HTTP/process only'],formalParameters:'NOT_CAPTURED',Chromium:'NOT_RUN',Vibe:'NOT_RUN',modelRequests:0,cases:[],config:[],fixtures:['test credential record provider','new installed test app descriptor','local file runtime archive','authorization denial callback','Electron process facts']};
const resources=[];
async function ready(fn){const end=Date.now()+6000;while(Date.now()<end){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,20));}throw Error('component readiness deadline');}
function call(url,{method='GET',headers={},body}={}){return new Promise((resolve,reject)=>{const req=request(url,{method,headers},res=>{let s='';res.on('data',b=>s+=b);res.on('end',()=>{let json;try{json=JSON.parse(s);}catch{}resolve({status:res.statusCode,headers:res.headers,json});});});req.on('error',reject);req.setTimeout(6000,()=>req.destroy(Error('component request deadline')));req.end(body);});}
async function serve(handler){const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));assert.notEqual(server.address().port,3080);resources.push(()=>new Promise(r=>server.close(r)));return server;}
async function boot(label,config){
 const ctx=new Context();resources.push(()=>ctx.fiber.dispose());const records=new Map();
 ctx.provide('credentials',{async modifyRecord(key,mutator){const v=await mutator(records.get(key));if(v!==undefined)records.set(key,v);return records.get(key);},async describe(){return{configured:false,writable:false};},async describeRecord(){return{configured:false,writable:false};},async resolve(){return undefined;}});
 ctx.plugin(Storage);ctx.plugin(JsonStorage,{root:join(root,label,'storage')});ctx.plugin(Domain,{backend:'json'});ctx.plugin(WebServer,{host:'127.0.0.1',port:0});ctx.plugin(Connection);await ctx.start?.();
 await ready(()=>ctx.get('connection')&&ctx.get('webServer')?.port>0);
 const origin=`http://127.0.0.1:${ctx.get('webServer').port}`;assert.notEqual(ctx.get('webServer').port,3080);
 const conn=ctx.get('connection');ctx.get('webServer').register({kind:'exact',path:'/',handler:(req,res)=>{if(conn.authorizeIndex(req,res)){res.writeHead(200);res.end();}}});
 const exchange=await call(conn.authenticatedUrl(origin+'/'));assert.equal(exchange.status,303);
 const cookie=exchange.headers['set-cookie'][0].split(';')[0];
 ctx.plugin(AppHost,config);await ready(()=>ctx.get('hanameshApps'));
 return{ctx,conn,origin,headers:{origin,cookie,'content-type':'application/json','x-hanamesh-client':'workspace-v1'}};
}
try{
 // New local file asset read by the unmodified provision checksum/install path.
 const tree=join(root,'archive-tree');await mkdir(join(tree,'bin'),{recursive:true});
 const payload='#!/bin/sh\nprintf "INDEPENDENT_COMPONENT_RUNTIME\\n"\n';
 await writeFile(join(tree,'bin','verify-runtime'),payload,{mode:0o755});const archive=join(root,'independent-runtime.tgz');execFileSync('/usr/bin/tar',['-czf',archive,'-C',tree,'bin']);
 const bytes=await readFile(archive);const digest=createHash('sha256').update(bytes).digest('hex');let downloads=0;
 const asset=await serve((req,res)=>{if(req.url==='/independent-runtime.tgz'){downloads++;res.writeHead(200,{'content-type':'application/octet-stream','content-length':bytes.length});res.end(bytes);}else{res.writeHead(404);res.end();}});
 const appId='independent-request-verifier',packageName='@fixture/independent-apphost',runtimeItem='independent-runtime';
 const dataRoot=join(root,'component-data'),profile=join(root,'profiles','independent');const pkgRoot=join(profile,'node_modules','@fixture','independent-apphost');await mkdir(pkgRoot,{recursive:true});
 await writeFile(join(profile,'package.json'),JSON.stringify({name:'dsh-profile-independent',private:true,dependencies:{[packageName]:'1.2.3'},dsh:{profile:{bundles:[]}}}));
 await writeFile(join(pkgRoot,'package.json'),JSON.stringify({name:packageName,version:'1.2.3',hanamesh:{app:'app.json'}}));
 const definition={id:appId,name:'Independent verification fixture',deployments:[{id:'local',dataId:'independent-data',mode:'owned',args:['{{port}}','{{dataDir}}'],env:{},envAllowlist:[],readiness:{path:'/',status:200,bodyIncludes:'INDEPENDENT_COMPONENT_RUNTIME'},runtime:{item:runtimeItem,exec:'bin/verify-runtime',manifest:{schema:1,sources:[{id:'local-http-fixture',kind:'file',base:pathToFileURL(root+'/').href}],items:[{id:runtimeItem,version:'1.2.3',kind:'tar.gz',installTo:'verified-runtime',platforms:{[`${process.platform}-${process.arch}`]:{asset:'independent-runtime.tgz',sha256:digest}}}]}}}]};
 validateDefinition(definition);await writeFile(join(pkgRoot,'app.json'),JSON.stringify(definition));
 const h=await boot('supply',{dataRoot,applications:[definition],nodeBinary:process.execPath,library:{profileDir:profile,profileName:'independent',dshBin:join(root,'fixture-cli-never-executed.js'),sources:[]}});
 result.port=new URL(h.origin).port;result.sessionExchange=303;assert.equal(h.conn.admit({headers:{host:new URL(h.origin).host,...h.headers}}).peer,h.conn.operator);
 const input={appId,packageName,runtimeItem};const runtimeRoot=join(dataRoot,'runtimes',appId);
 const get=async path=>{const r=await call(h.origin+path,{headers:h.headers});assert.equal(r.status,200);return r.json;};
 assert.equal((await get('/hanamesh/library/installedPlugins')).apps[0].state,'runtime-missing');
 const body=JSON.stringify(input);
 const negatives=[
 ['no-origin',{origin:undefined},403,'CSRF_DENIED'],['custom-origin',{origin:'dsh-app://app'},403,'ORIGIN_DENIED'],['null-origin',{origin:'null'},403,'ORIGIN_DENIED'],['foreign-origin',{origin:'https://foreign.invalid'},403,'ORIGIN_DENIED'],['other-origin-port',{origin:'http://127.0.0.1:1'},403,'ORIGIN_DENIED'],
 ['foreign-host',{host:'foreign.invalid'},403,'HOST_DENIED'],['other-host-port',{host:'127.0.0.1:1'},403,'HOST_DENIED'],['no-marker',{'x-hanamesh-client':undefined},403,'CSRF_DENIED'],['fake-marker',{'x-hanamesh-client':'not-workspace'},403,'CSRF_DENIED'],['no-cookie',{cookie:undefined},401,'UNAUTHENTICATED'],['bad-cookie',{cookie:'dsh_browser_session=invalid'},401,'UNAUTHENTICATED'],['iframe',{'sec-fetch-dest':'iframe'},403,'FRAME_CONTROL_DENIED'],['cross-site',{'sec-fetch-site':'cross-site'},401,'UNAUTHENTICATED']];
 for(const [name,change,status,code] of negatives){
  const headers=Object.fromEntries(Object.entries({...h.headers,...change}).filter(([,v])=>v!==undefined));
  const rejected=h.conn.requestRejection({headers:{host:new URL(h.origin).host,...headers}});
  const r=await call(h.origin+'/hanamesh/library/provision',{method:'POST',headers,body});assert.equal(r.status,status,name);assert.equal(r.json.error.code,code,name);
  assert.deepEqual((await get('/hanamesh/library/events')).events,[],name);assert.deepEqual((await ledger(runtimeRoot)).items,{},name);assert.equal(downloads,0,name);
  result.cases.push({name,status,code,connectionRejection:rejected??'admitted',downloads,operations:0,ledgerUnchanged:true});
 }
 // Authorization seam: real auth and real route with a rejecting business callback.
 let authCalls=0,supplyCalls=0;const denied=await serve(createLibraryHttpHandler({async provision(){supplyCalls++;}}, {parentOrigin:h.origin,...AppHost.browserAuthentication(h.conn),async authorize(subject,path,inputValue){authCalls++;assert.equal(subject.principalId,AppHost.BROWSER_PRINCIPAL);assert.equal(path,'/hanamesh/library/provision');assert.deepEqual(inputValue,input);return false;}}));
 const denial=await call(`http://127.0.0.1:${denied.address().port}/hanamesh/library/provision`,{method:'POST',headers:{...h.headers,host:new URL(h.origin).host},body});assert.equal(denial.status,403);assert.equal(denial.json.error.code,'FORBIDDEN');assert.equal(authCalls,1);assert.equal(supplyCalls,0);assert.equal(downloads,0);assert.deepEqual((await ledger(runtimeRoot)).items,{});assert.deepEqual((await get('/hanamesh/library/events')).events,[]);
 result.cases.push({name:'business-denial',status:403,code:'FORBIDDEN',authorizationCalls:authCalls,supplyCalls,ledgerUnchanged:true,evidence:'FIXTURE callback + real route/Connection'});
 const r=await call(h.origin+'/hanamesh/library/provision',{method:'POST',headers:h.headers,body});assert.equal(r.status,202);assert.equal(typeof r.json.operationId,'string');
 const done=await ready(async()=>{const events=(await get('/hanamesh/library/events')).events;const failed=events.find(e=>e.operationId===r.json.operationId&&e.type==='library.provision-failed');assert.equal(failed,undefined);return events.find(e=>e.operationId===r.json.operationId&&e.type==='library.provision-done');});
 const book=await ledger(runtimeRoot);assert.equal(book.items[runtimeItem].sha256,digest);assert.equal(book.items[runtimeItem].version,'1.2.3');const binary=join(runtimeRoot,'verified-runtime','bin','verify-runtime');assert.equal(await readFile(binary,'utf8'),payload);assert.ok((await stat(binary)).mode&0o111);assert.equal(downloads,0);
 assert.equal(execFileSync(binary,{encoding:'utf8'}),'INDEPENDENT_COMPONENT_RUNTIME\n');assert.equal((await get('/hanamesh/library/installedPlugins')).apps[0].state,'registered');assert.equal(done.result.status,'restart-required');
 result.cases.push({name:'normal-supply',status:202,event:done.type,result:done.result.status,httpDownloadCount:downloads,assetKind:'file fixture',archiveSha256:digest,ledgerWriter:'original installer -> original inline provision',binaryEqual:true,binaryExecuted:true,installedState:'registered'});
 // Public config facts use our fixtures; no formal effective parameters inferred.
 assert.equal(inferNodeBinary(),process.execPath);assert.equal(inferNodeBinary({execPath:'/fixture/Electron',versions:{electron:'fixture'}}),undefined);result.config.push('real independent Node inferred; fixture Electron undefined');
 const shared=join(root,'outside-profile','apphost');await mkdir(join(shared,'dist'),{recursive:true});await writeFile(join(shared,'package.json'),JSON.stringify({name:'@hanamesh/dsh-app-host'}));await writeFile(join(shared,'dist','dsh.js'),'export {};\n');await mkdir(join(profile,'node_modules','@hanamesh'),{recursive:true});await symlink(shared,join(profile,'node_modules','@hanamesh','dsh-app-host'));
 assert.equal(await inferProfileDir(pathToFileURL(join(shared,'dist','dsh.js')).href),undefined);result.config.push('external shared store link does not infer profile');
 const cli=join(profile,'node_modules','@deepseek-ai','dsh');await mkdir(join(cli,'lib'),{recursive:true});await writeFile(join(cli,'package.json'),JSON.stringify({name:'@deepseek-ai/dsh',type:'module',exports:{'./lib/*':'./lib/*'}}));await writeFile(join(cli,'lib','bin.js'),'export {};\n');const dshBin=createRequire(join(profile,'package.json')).resolve('@deepseek-ai/dsh/lib/bin.js');
 const resolved=await resolveLibraryLocations({profileDir:profile,profileName:'public-name',dshBin},{versions:{electron:'fixture'},execPath:'/fixture/Electron',nodeBinary:process.execPath});assert.equal(resolved.nodeBinary,process.execPath);assert.equal(resolved.profileDir,profile);assert.equal(resolved.profileName,'public-name');assert.equal(resolved.dshBin,dshBin);assert.equal(inferDshBin(['node',dshBin]),dshBin);assert.equal(inferDshBin(['node','/fixture/host.js']),undefined);result.config.push('top-level Node and explicit library profileDir/profileName/dshBin win; public CLI export fixture resolves');
 const nested=await resolveLibraryLocations({nodeBinary:process.execPath},{versions:{electron:'fixture'},execPath:'/fixture/Electron'});assert.equal(nested.nodeBinary,undefined);result.config.push('library.nodeBinary is not the public Node input');
 const missing=await boot('missing-installer',{dataRoot:join(root,'missing-data'),library:{sources:[]}});
 const unavailable=await call(missing.origin+'/hanamesh/library/provision',{method:'POST',headers:missing.headers,body});assert.equal(unavailable.status,503);assert.equal(unavailable.json.error.code,'LIBRARY_INSTALL_UNAVAILABLE');const noEvents=await call(missing.origin+'/hanamesh/library/events',{headers:missing.headers});assert.deepEqual(noEvents.json.events,[]);result.config.push('real Loader missing installer -> authenticated HTTP503 / zero operations');
 result.passed=true;
}finally{
 for(const dispose of resources.reverse())await dispose();
 result.disposed=true;result.signalsSent=0;await writeFile(out,JSON.stringify(result,null,2)+'\n');
}
console.log(JSON.stringify({passed:result.passed,cases:result.cases.length,config:result.config.length,root,formal:'NOT_RUN',modelRequests:0}));
