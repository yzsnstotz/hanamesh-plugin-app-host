import test from 'node:test';
import assert from 'node:assert/strict';
import { clientHarness, dualSurfaceClientHarness, fakeClock, settle } from './fixtures/client-ui-harness.mjs';

const exact={id:'exact-1',kind:'plugin',displayName:'Exact',package:{registry:'npm',name:'dsh-pet'}};
const second={...exact,id:'exact-2'};
const substring={...exact,id:'substring',package:{registry:'npm',name:'dsh-pet-tools'}};
function setup(t,{pages=[{items:[exact,second,substring],page:{nextCursor:null}}],initialTarget=null,failCatalog=false,embedded=true}={}){
  const clock=fakeClock(),calls=[];let target=initialTarget,failTarget=false;
  const fetch=async(path,init={})=>{
    calls.push({path,method:init.method??'GET',body:init.body?JSON.parse(init.body):null});
    if(path==='/hanamesh/library/target'){
      if(failTarget)throw Error('offline');
      return{ok:true,json:async()=>({target})};
    }
    if(path==='/hanamesh/library/target/consume')return{ok:true,json:async()=>({consumed:true})};
    if(path.startsWith('/hanamesh/library?')){
      if(failCatalog)throw Error('catalog offline');
      return{ok:true,json:async()=>path.includes('cursor=')?pages[1]:pages[0]};
    }
    throw Error('unexpected '+path);
  };
  return{clock,calls,async mount(){const client=await clientHarness({fetch,clock,embedded});t.after(()=>client.unmount());return client;},setTarget:value=>{target=value;},failTarget:value=>{failTarget=value;},consumes:()=>calls.filter(call=>call.path.endsWith('/consume')),searches:()=>calls.filter(call=>call.path.startsWith('/hanamesh/library?'))};
}
const state=client=>client.find(node=>node.props?.['data-hanamesh-target-state']);

test('P06A-T13: panel seat hides the manual entry but a later OS target opens the market from the DSH home page',async t=>{
  const a=setup(t,{embedded:false});const client=await a.mount();
  const initialReads=a.calls.filter(call=>call.path==='/hanamesh/library/target').length;
  client.module.createMarketSeat().setSettingsVisible(false);
  assert.equal(client.module.LibraryAction(),null,'panel owns the manual sidebar entry');
  a.setTarget({targetId:'seat-target',packageName:'dsh-pet',protected:false});
  await a.clock.advance(1000);
  assert.equal(a.calls.filter(call=>call.path==='/hanamesh/library/target').length,initialReads+1,'target polling stays active while the panel owns the seat');
  assert.equal(state(client)?.props['data-hanamesh-target-state'],'found','the market opens without visiting Settings');
  assert(client.find(node=>node.props?.['data-hanamesh-library-item']==='exact-1'&&node.props?.['data-hanamesh-target']==='exact'));
  assert.equal(a.consumes().length,1);
  assert.equal(a.calls.filter(call=>call.path.includes('/install')).length,0);
});

test('P06A-T11/T13: panel seat takeover does not close an existing market app view lease',async t=>{
  const clock=fakeClock(),calls=[];
  const row={appId:'fixture-app',state:'registered',packageName:'fixture-app',definition:{deployments:[{id:'local'}]}};
  const receipt={instance:{id:'instance-seat',appId:'fixture-app',status:'ready'},lease:{viewId:'view-seat',expiresAt:clock.now()+90_000},leaseToken:'fixture-token',uiUrl:'http://127.0.0.1:50001/'};
  const fetch=async(path,init={})=>{
    calls.push({path,body:init.body?JSON.parse(init.body):null});
    const value=path==='/hanamesh/library/target'?{target:null}:
      path.startsWith('/hanamesh/library?')?{items:[{...exact,installed:row,kind:'application'}],installed:[row],page:{nextCursor:null}}:
      path==='/apps/open'?receipt:
      path==='/apps/close'?{instance:{status:'stopped'}}:null;
    assert.notEqual(value,null,'unexpected route '+path);
    return{ok:true,json:async()=>value};
  };
  const client=await clientHarness({fetch,clock,embedded:false});t.after(()=>client.unmount());
  await client.show();await client.click('打开');assert(client.find(node=>node.type==='iframe'));
  client.module.createMarketSeat().setSettingsVisible(false);await settle();
  assert.equal(client.module.LibraryAction(),null,'the manual entry stays hidden');
  assert(client.find(node=>node.type==='iframe'),'seat takeover must preserve the foreground app view');
  assert.equal(calls.filter(call=>call.path==='/apps/close').length,0);
});

test('P06A-T11/T13: a new target ID for the same package reloads the catalog while the market overlay is open',async t=>{
  const a=setup(t,{embedded:false});const client=await a.mount();
  client.module.createMarketSeat().setSettingsVisible(false);
  a.setTarget({targetId:'same-name-1',packageName:'dsh-pet',protected:false});
  await a.clock.advance(1000);
  assert.equal(state(client)?.props['data-hanamesh-target-state'],'found');
  assert.equal(a.consumes().length,1);
  const firstSearches=a.searches().length;
  a.setTarget({targetId:'same-name-2',packageName:'dsh-pet',protected:false});
  await a.clock.advance(1000);
  assert.equal(a.searches().length,firstSearches+1,'new target identity refetches even when query text is unchanged');
  assert.equal(state(client)?.props['data-hanamesh-target-state'],'found');
  assert.equal(a.consumes().length,2,'each target identity is acknowledged once after presentation');
});

test('P06A-T13: an already mounted embedded Market presents and consumes before the background overlay',async t=>{
  const clock=fakeClock(),calls=[];let target=null,overlay,embedded;
  const fetch=async(path,init={})=>{
    calls.push({path,body:init.body?JSON.parse(init.body):null,
      atConsume:path.endsWith('/consume')?{
        embedded:state(embedded)?.props['data-hanamesh-target-state'],
        overlay:state(overlay)?.props['data-hanamesh-target-state'],
        embeddedExact:Boolean(embedded.find(node=>node.props?.['data-hanamesh-target']==='exact')),
      }:null});
    if(path==='/hanamesh/library/target')return{ok:true,json:async()=>({target})};
    if(path==='/hanamesh/library/target/consume')return{ok:true,json:async()=>({consumed:true})};
    if(path.startsWith('/hanamesh/library?'))return{ok:true,json:async()=>({items:[exact,second,substring],page:{nextCursor:null}})};
    throw Error('unexpected '+path);
  };
  const client=await dualSurfaceClientHarness({fetch,clock});t.after(()=>client.unmount());
  overlay=await client.mount(false);embedded=await client.mount(true);
  const readsBefore=calls.filter(call=>call.path==='/hanamesh/library/target').length;
  target={targetId:'embedded-first',packageName:'dsh-pet',protected:false};
  await clock.advance(1000); // overlay timer was registered first: force the reverse scheduling race
  assert.equal(calls.filter(call=>call.path==='/hanamesh/library/target').length,readsBefore+1,'only the foreground embedded surface reads the pending target');
  assert.equal(state(embedded)?.props['data-hanamesh-target-state'],'found','the foreground embedded Market owns the target');
  assert.equal(state(overlay),undefined,'the background overlay must not open over Settings');
  assert.deepEqual(calls.filter(call=>call.path.endsWith('/consume')).map(call=>({id:call.body.targetId,...call.atConsume})),
    [{id:'embedded-first',embedded:'found',overlay:undefined,embeddedExact:true}],'only the visible embedded surface acknowledges the target');
  embedded.unmount();
  target={targetId:'overlay-after-embedded',packageName:'dsh-pet',protected:false};
  await clock.advance(1000);
  assert.equal(state(overlay)?.props['data-hanamesh-target-state'],'found','overlay resumes when the embedded Market unmounts');
  assert.deepEqual(calls.filter(call=>call.path.endsWith('/consume')).map(call=>call.body.targetId),['embedded-first','overlay-after-embedded']);
  assert.equal(calls.filter(call=>call.path.includes('install')||call.path==='/apps/close').length,0);
});

test('P06A-T08/T09/T10b: polling opens market, exact marks all duplicates, page 1 is not falsely missing, consume follows presentation',async t=>{
  const a=setup(t,{pages:[{items:[substring],page:{nextCursor:'page2'}},{items:[exact,second],page:{nextCursor:null}}]});
  const client=await a.mount();
  a.setTarget({targetId:'t1',packageName:'dsh-pet',protected:false});await a.clock.advance(1000);
  assert.equal(state(client)?.props['data-hanamesh-target-state'],'not-on-loaded-pages');
  assert.match(state(client).children.join(''),/加载更多/);
  assert.equal(a.consumes().length,1);
  assert.equal(a.searches().at(-1).path,'/hanamesh/library?q=dsh-pet&category=');
  await client.click('更多');await settle();
  assert.equal(state(client)?.props['data-hanamesh-target-state'],'found');
  assert.equal(client.find(node=>node.props?.['data-hanamesh-library-item']==='exact-1')?.props['data-hanamesh-target'],'exact');
  assert.equal(client.find(node=>node.props?.['data-hanamesh-library-item']==='exact-2')?.props['data-hanamesh-target'],'exact');
  assert.equal(client.find(node=>node.props?.['data-hanamesh-library-item']==='substring')?.props['data-hanamesh-target'],undefined);
  assert.equal(a.calls.filter(call=>call.path.includes('/install')).length,0);
  client.unmount();const reads=a.calls.filter(call=>call.path==='/hanamesh/library/target').length;await a.clock.advance(10_000);assert.equal(a.calls.filter(call=>call.path==='/hanamesh/library/target').length,reads);
});

test('P06A-T08/T10: failure backs off 5000 ms then resumes 1000 ms, protected and unavailable states are visible',async t=>{
  const a=setup(t,{initialTarget:{targetId:'p1',packageName:'hanamesh-core',protected:true},failCatalog:true});const client=await a.mount();
  assert.equal(state(client)?.props['data-hanamesh-target-state'],'protected');
  a.failTarget(true);await a.clock.advance(1000);let reads=a.calls.filter(call=>call.path==='/hanamesh/library/target').length;
  await a.clock.advance(4999);assert.equal(a.calls.filter(call=>call.path==='/hanamesh/library/target').length,reads);
  a.failTarget(false);await a.clock.advance(1);reads=a.calls.filter(call=>call.path==='/hanamesh/library/target').length;
  await a.clock.advance(1000);assert.equal(a.calls.filter(call=>call.path==='/hanamesh/library/target').length,reads+1);
  a.setTarget({targetId:'p2',packageName:'dsh-pet',protected:false});await a.clock.advance(1000);
  assert.equal(state(client)?.props['data-hanamesh-target-state'],'catalog-unavailable');
});

test('P06A-T11: a target leaves an already open application view lease mounted',async t=>{
  const clock=fakeClock(),calls=[];
  const row={appId:'fixture-app',state:'registered',packageName:'fixture-app',definition:{deployments:[{id:'local'}]}};
  const page={items:[{...exact,installed:row,kind:'application'},second,substring],installed:[row],page:{nextCursor:null}};
  const receipt={instance:{id:'instance-1',appId:'fixture-app',status:'ready'},lease:{viewId:'view-1',expiresAt:clock.now()+90_000},leaseToken:'fixture-token',uiUrl:'http://127.0.0.1:50001/'};
  let target=null,client,visibleAtConsume=false;
  const fetch=async(path,init={})=>{
    calls.push({path,body:init.body?JSON.parse(init.body):null});
    const value=path==='/hanamesh/library/target'?{target}:
      path==='/hanamesh/library/target/consume'?(visibleAtConsume=Boolean(client.find(node=>node.props?.['data-hanamesh-library-item']==='exact-1'&&node.props?.['data-hanamesh-target']==='exact')&&client.find(node=>node.props?.['data-hanamesh-library-item']==='exact-2'&&node.props?.['data-hanamesh-target']==='exact')),{consumed:true}):
      path.startsWith('/hanamesh/library?')?page:
      path==='/apps/open'?receipt:
      path==='/apps/heartbeat'?{...receipt.lease,expiresAt:clock.now()+90_000}:
      path==='/apps/close'?{instance:{status:'stopped'}}:null;
    assert.notEqual(value,null,'unexpected route '+path);
    return{ok:true,json:async()=>value};
  };
  client=await clientHarness({fetch,clock});t.after(()=>client.unmount());
  await client.click('打开');assert(client.find(node=>node.type==='iframe'));
  target={targetId:'t-lease',packageName:'dsh-pet',protected:false};await clock.advance(1000);
  assert(client.find(node=>node.type==='iframe'),'target must preserve the current view');
  assert.equal(visibleAtConsume,true,'both exact target cards must be rendered before consume');
  assert(client.find(node=>node.props?.['data-hanamesh-library-item']==='exact-1'&&node.props?.['data-hanamesh-target']==='exact'));
  assert(client.find(node=>node.props?.['data-hanamesh-library-item']==='exact-2'&&node.props?.['data-hanamesh-target']==='exact'));
  assert.equal(client.find(node=>node.props?.['data-hanamesh-library-item']==='substring'),undefined);
  target={targetId:'t-lease-obsolete',packageName:'dsh-pet',protected:false};
  target={targetId:'t-lease-latest',packageName:'dsh-pet',protected:false};
  await clock.advance(1000);
  assert(client.find(node=>node.type==='iframe'),'same-name target replacement preserves the foreground iframe');
  assert.equal(state(client)?.props['data-hanamesh-target-state'],'found');
  assert.deepEqual(calls.filter(call=>call.path==='/hanamesh/library/target/consume').map(call=>call.body.targetId),['t-lease','t-lease-latest'],'only the latest target identity is consumed');
  await clock.advance(30_000);
  assert(client.find(node=>node.type==='iframe'),'lease remains mounted through a heartbeat');
  assert(calls.some(call=>call.path==='/apps/heartbeat'),'the existing view is still renewed');
  assert.equal(calls.filter(call=>call.path==='/apps/close').length,0);
  assert.equal(calls.filter(call=>call.path==='/apps/open').length,1);
  assert.equal(calls.filter(call=>call.path==='/hanamesh/library/target/consume').length,2);
});
