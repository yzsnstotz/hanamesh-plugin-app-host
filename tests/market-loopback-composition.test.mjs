import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as storageJson from '@deepseek-ai/dsh-storage-json';
import * as storageDomain from '@deepseek-ai/dsh-storage-domain';
import WebServer from '@deepseek-ai/dsh-host-webserver';
import * as market from '@hanamesh/market';
import * as appHost from '../src/index.js';
import { declaration } from './fixtures/core-suite-declaration.mjs';
import { temporary, until, http } from './helpers.mjs';

const website='https://market.hanamesh.com',probePath='/hanamesh/library/install-target';
async function isolatedDefaultPortList() {
  // Same ordered three-port policy as the default list; never occupy 39317-19.
  const reservations=[];
  for(let i=0;i<3;i++) {
    const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));reservations.push(server);
  }
  const ports=reservations.map(server=>server.address().port);
  for(const server of reservations)await new Promise(resolve=>server.close(resolve));
  return ports;
}

for(const order of [[market,appHost],[appHost,market]]) {
  test(`R491 loopback combination with both default-enabled listeners: ${order.map(p=>p.name).join(' -> ')}`,async t=>{
    const root=await temporary(),ctx=new Context(),ports=await isolatedDefaultPortList(),fibers=new Map();
    t.after(async()=>ctx.fiber.dispose());
    const profile=join(root,'profile');await mkdir(profile);
    await writeFile(join(profile,'package.json'),JSON.stringify({name:'loopback-composition-profile',dependencies:{},dsh:{profile:{bundles:[]}}}));
    ctx.plugin(Storage);ctx.plugin(storageJson,{root:join(root,'storage')});ctx.plugin(storageDomain,{backend:'json'});
    ctx.plugin(WebServer,{host:'127.0.0.1',port:0});
    ctx.provide('connection',{requestRejection:()=>undefined});
    let nativeCalls=0,coreReads=0;
    ctx.provide('pluginManager',{inspect:async()=>{nativeCalls++;throw new Error('handoff never inspects or installs a package');}});
    ctx.provide('hanameshCore',{protocolVersion:'1',getSuiteDeclaration:async()=>{coreReads++;return declaration();}});
    await ctx.start?.();await until(()=>ctx.get('webServer')?.port>0);
    const workspace=`http://127.0.0.1:${ctx.get('webServer').port}`;
    for(const plugin of order) {
      const outcome=Promise.withResolvers();
      const fiber=ctx.plugin({name:plugin.name,inject:plugin.inject,async apply(child){
        try {
          // Only the named port list changes. Both enabled/default allowlist/TTL
          // policies are the real plugin defaults, with no disabled listener.
          await plugin.apply(child,plugin===market?{handoff:{ports}}:{nodeBinary:process.execPath,dataRoot:join(root,'apps'),applications:[],library:{profileDir:profile,profileName:'desktop',sources:[],handoff:{ports}}});
          outcome.resolve(null);
        } catch(error){outcome.resolve(error);throw error;}
      }});fibers.set(plugin.name,fiber);
      assert.equal(await outcome.promise,null,`${plugin.name} must activate with both real listeners enabled`);
    }
    const marketSettings=await http(workspace+'/hanamesh/market/settings');
    const appHostHandoffs=await http(workspace+'/hanamesh/library/handoffs');
    assert.equal(marketSettings.status,200);assert.equal(appHostHandoffs.status,200);
    const marketPort=marketSettings.json.listener.port,appHostPort=appHostHandoffs.json.listener.port;
    assert.equal(marketSettings.json.settings.handoff.enabled,true);
    assert.equal(marketSettings.json.listener.status,'listening');
    assert.equal(appHostHandoffs.json.listener.status,'listening');
    assert.deepEqual([order[0]===market?marketPort:appHostPort,order[1]===market?marketPort:appHostPort],ports.slice(0,2),'first free default-list position is determined by actual load order');
    assert.notEqual(marketPort,appHostPort);
    assert.equal((await http(`http://127.0.0.1:${appHostPort}`+probePath,{headers:{origin:website}})).status,404,'the AppHost listener never masquerades as the website discovery owner');

    // Contract consumer: each listed port is probed once; only a successful
    // responder advertising both contracts can receive the following requests.
    const probes=[];let selected;
    for(const port of ports) {
      const origin=`http://127.0.0.1:${port}`,reply=await http(origin+probePath,{headers:{origin:website}});
      probes.push({port,status:reply.status});
      if(reply.status===404)continue;
      assert.equal(reply.status,200);
      assert.equal(reply.json.installTarget.contract,'hanamesh.install-target');
      assert.equal(reply.json.installationStatus.contract,'hanamesh.installation-status');
      selected={origin,port,statusPath:reply.json.installationStatus.path};break;
    }
    assert.equal(selected?.port,marketPort,'consumer must select the actual Market listener, including when AppHost owns the first port');
    const before=coreReads;
    const status=await http(selected.origin+selected.statusPath,{method:'POST',headers:{origin:website,'content-type':'application/json'},body:JSON.stringify({contractVersion:'1',consent:'read-installations'})});
    assert.equal(status.status,200);assert.equal(status.json.observations.find(row=>row.channel==='dsh').status,'installed');
    assert.equal(coreReads,before+1,'the selected Market responder wires a fresh real Core read');

    const target={itemId:'fixture.loopback-plugin',packageName:'fixture-loopback-plugin',contractVersion:'1'};
    let resolutions=0;
    // Named catalog read port double only: the normal Market queue/HTTP handler
    // and native-readiness policy remain active; no installation is performed.
    ctx.get('hanameshMarket').resolveTarget=async input=>{
      resolutions++;assert.deepEqual(input,target);
      return{item:{id:target.itemId,displayName:'Loopback catalog fixture',kind:'plugin',package:{name:target.packageName},installed:null,upgradeAvailable:false}};
    };
    const handoff=await http(selected.origin+'/hanamesh/library/handoff',{method:'POST',headers:{origin:website,'content-type':'application/json'},body:JSON.stringify(target)});
    assert.equal(handoff.status,202);assert.equal(handoff.json.state,'pending');assert.equal(resolutions,1);
    const result=await http(selected.origin+'/hanamesh/library/handoff?id='+handoff.json.handoffId,{headers:{origin:website}});
    assert.equal(result.status,200);assert.equal(result.json.state,'pending');
    const marketQueue=await http(workspace+'/hanamesh/market/handoffs');
    assert.equal(marketQueue.json.handoffs[0].handoffId,handoff.json.handoffId);
    assert.deepEqual((await http(workspace+'/hanamesh/library/handoffs')).json.handoffs,[],'website handoff must never enter the AppHost queue');
    assert.equal(nativeCalls,0,'no inspect/install/confirmation side effects from discovery, status or handoff');
    t.diagnostic(JSON.stringify({ports,order:order.map(p=>p.name),marketPort,appHostPort,probes,consumerPort:selected.port,statusPort:selected.port,handoffPort:selected.port}));
    await fibers.get(appHost.name).dispose();
    assert.equal((await http(selected.origin+probePath,{headers:{origin:website}})).status,200,'disposing AppHost does not remove the selected Market listener');
    await fibers.get(market.name).dispose();
    await assert.rejects(http(selected.origin+probePath),{code:'ECONNREFUSED'});
  });
}
