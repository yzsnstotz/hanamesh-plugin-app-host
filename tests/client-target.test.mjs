import test from 'node:test';
import assert from 'node:assert/strict';
import { clientHarness, fakeClock, settle } from './fixtures/client-ui-harness.mjs';

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
  const page={items:[{...exact,installed:row,kind:'application'}],installed:[row],page:{nextCursor:null}};
  const receipt={instance:{id:'instance-1',appId:'fixture-app',status:'ready'},lease:{viewId:'view-1',expiresAt:clock.now()+90_000},leaseToken:'fixture-token',uiUrl:'http://127.0.0.1:50001/'};
  let target=null;
  const fetch=async(path,init={})=>{
    calls.push({path,body:init.body?JSON.parse(init.body):null});
    const value=path==='/hanamesh/library/target'?{target}:
      path==='/hanamesh/library/target/consume'?{consumed:true}:
      path.startsWith('/hanamesh/library?')?page:
      path==='/apps/open'?receipt:
      path==='/apps/heartbeat'?{...receipt.lease,expiresAt:clock.now()+90_000}:
      path==='/apps/close'?{instance:{status:'stopped'}}:null;
    assert.notEqual(value,null,'unexpected route '+path);
    return{ok:true,json:async()=>value};
  };
  const client=await clientHarness({fetch,clock});t.after(()=>client.unmount());
  await client.click('打开');assert(client.find(node=>node.type==='iframe'));
  target={targetId:'t-lease',packageName:'dsh-pet',protected:false};await clock.advance(1000);
  assert(client.find(node=>node.type==='iframe'),'target must preserve the current view');
  assert.equal(calls.filter(call=>call.path==='/apps/close').length,0);
  assert.equal(calls.filter(call=>call.path==='/apps/open').length,1);
  assert.equal(calls.filter(call=>call.path==='/hanamesh/library/target/consume').length,1);
});
