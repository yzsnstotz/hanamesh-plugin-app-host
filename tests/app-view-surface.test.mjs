import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {clientHarness} from './fixtures/client-ui-harness.mjs';

test('AH-UI17: Market opens one viewport application frame and closes its original lease', async t => {
  const calls=[];
  const row={appId:'example',state:'registered',packageName:'example',definition:{deployments:[{id:'local'}]}};
  const page={items:[{id:'example',kind:'application',displayName:'Example',installed:row}],installed:[row]};
  const receipt={instance:{id:'instance-1',appId:'example',status:'ready'},lease:{viewId:'view-1',generation:1,expiresAt:Date.now()+90_000},leaseToken:'test-view-token',uiUrl:'http://127.0.0.1:50001/'};
  const fetch=async(path,init={})=>{calls.push({path,body:init.body?JSON.parse(init.body):null});const value=path.startsWith('/hanamesh/library')?page:path==='/apps/open'?receipt:path==='/apps/close'?{instance:{status:'stopped'}}:null;assert(value,`unexpected route ${path}`);return{ok:true,json:async()=>value};};
  const market=await clientHarness({fetch,embedded:true});t.after(()=>market.unmount());
  await market.click('打开');
  assert(market.find(node=>node.type==='iframe'),'the owned Market must show the application document');
  assert(market.find(node=>node.type==='button'&&node.children.includes('关闭视图')),'the view has its existing close control');
  const css=await readFile(new URL('../src/client-ui.js',import.meta.url),'utf8');
  assert(css.includes('.hm-market-embedded>.hm-app-frame{position:fixed;inset:0;z-index:1001;height:100vh'), 'the app frame must cover the Settings viewport');
  await market.click('关闭视图');
  assert.deepEqual(calls.filter(call=>call.path==='/apps/close').map(call=>call.body),[{viewId:'view-1',leaseToken:'test-view-token'}]);
  assert(!market.find(node=>node.type==='iframe'));
  assert(market.find(node=>node.props?.['data-hanamesh-library-item']==='example'));
});
