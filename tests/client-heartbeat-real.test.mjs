/** Isolated real HTTP + owned processes, real 90s default lease; UI hook lifecycle is a stand-in. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { readFile,rm } from 'node:fs/promises';
import { AppHost,AtomicFileStore,createHttpHandler } from '../src/index.js';
import { definition,temporary,until,delay,pidAlive,http } from './helpers.mjs';
import { clientHarness,settle } from './fixtures/client-ui-harness.mjs';
test('AH-VL08: actual default90s lease survives idle market client and last-view close ends exact owned group',
 {skip:process.env.HM_REAL_CLIENT_LEASE!=='1',timeout:130_000},async t=>{
 const root=await temporary();let handler,client,host;const calls=[];
 const server=createServer((req,res)=>{if(req.url?.startsWith('/hanamesh/library')){res.setHeader('content-type','application/json');res.end(JSON.stringify(page));}else handler(req,res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 t.after(async()=>{client?.unmount();await host?.dispose();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
 host=new AppHost({store:new AtomicFileStore(join(root,'store')),dataRoot:join(root,'data'),parentOrigin:origin});
 const def=definition({embedding:'gateway'});host.register(def);await host.init();assert.equal(host.leaseTtlMs,90_000);assert.equal(host.sweepIntervalMs,15_000);
 handler=createHttpHandler(host,{parentOrigin:origin,authenticate:()=>({principalId:'lease-test'}),authorize:()=>true});
 const row={appId:def.id,state:'registered',packageName:'example',definition:def};const page={items:[{id:def.id,kind:'application',displayName:'Example',installed:row}],installed:[row]};
 const browserFetch=async(path,init={})=>{calls.push({path,at:Date.now()});return fetch(origin+path,{...init,headers:{...init.headers,origin}});};
 client=await clientHarness({fetch:browserFetch});await until(()=>client.find(node=>node.type==='button'&&node.children.includes('打开')));await client.click('打开');await until(()=>client.find(node=>node.type==='iframe'),{timeout:10_000});
 const iframe=client.find(node=>node.type==='iframe');const instance=host.instanceList('lease-test')[0],initial=host.list('lease-test').views[0];
 assert.equal(instance.status,'ready');assert(pidAlive(instance.pid));
 const bootstrap=await http(iframe.props.src,{headers:{referer:origin+'/workspace','sec-fetch-dest':'iframe'}});assert.equal(bootstrap.status,303);const cookie=bootstrap.headers['set-cookie'][0].split(';')[0];
 const gatewayURL=new URL(bootstrap.headers.location,iframe.props.src).href;assert.equal((await http(gatewayURL,{headers:{cookie}})).status,200);
 const runtimeLock=JSON.parse(await readFile(join(instance.dataDir,'.runtime.lock'),'utf8'));const ownedPids=[runtimeLock.pid,...runtimeLock.children.map(child=>child.pid)];
 const heldAt=Date.now();console.log(JSON.stringify({evidence:'REAL_PROCESS/REAL_HTTP + HOOK_STANDIN/LIBRARY_STANDIN',phase:'ready',ttlMs:host.leaseTtlMs,sweepMs:host.sweepIntervalMs,ownedPids:ownedPids.length}));
 await delay(95_000);
 const after=host.list('lease-test').views[0];assert.equal(after.status,'active','visible lease must remain active beyond original expiry');assert(after.expiresAt>initial.expiresAt);assert.equal(host.instance(instance.id,'lease-test').status,'ready');assert(pidAlive(instance.pid));assert.equal((await http(gatewayURL,{headers:{cookie}})).status,200,'gateway must still serve after original TTL');
 assert(calls.filter(x=>x.path==='/apps/heartbeat').length>=3,'client must actually consume authenticated HTTP heartbeat');assert.equal(calls.filter(x=>x.path==='/apps/open').length,1);
 console.log(JSON.stringify({phase:'idle-held',elapsedMs:Date.now()-heldAt,heartbeatRequests:calls.filter(x=>x.path==='/apps/heartbeat').length,leaseRenewed:true,sameInstance:true,gatewayStatus:200}));
 await client.click('关闭视图');await until(()=>host.instance(instance.id,'lease-test').status==='stopped',{timeout:8_000});await settle();assert(ownedPids.every(pid=>!pidAlive(pid)),'every exact owned group member exits after last close');assert.equal(calls.filter(x=>x.path==='/apps/close').length,1);const count=calls.filter(x=>x.path==='/apps/heartbeat').length;await delay(150);assert.equal(calls.filter(x=>x.path==='/apps/heartbeat').length,count);assert(!client.find(node=>node.type==='iframe'));
 console.log(JSON.stringify({phase:'closed',ownedGroupGone:true,leaseCloseRequests:1,remainingRenewals:0,productREAL_UI:'NOT_RUN'}));
});
