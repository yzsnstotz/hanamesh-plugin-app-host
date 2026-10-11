import test from 'node:test';
import assert from 'node:assert/strict';
import {clientHarness,settle} from './fixtures/client-ui-harness.mjs';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {external,http} from './helpers.mjs';
import {FixedGateway} from '../src/gateway.js';
const challenge='a'.repeat(64),origin='http://127.0.0.1:49291';
test('D26 workspace: wrong origin, null origin and wrong iframe Window cannot request a grant',async t=>{
 const requests=[],posts=[];const receipt={instance:{appId:'example',status:'ready'},lease:{viewId:'v',expiresAt:Date.now()+60000},leaseToken:'b'.repeat(64),uiUrl:origin+'/__hanamesh_bootstrap/'+challenge};
 const client=await clientHarness({href:'dsh-app://app/',fetch:async(path,init)=>{requests.push({path,init});return{ok:true,json:async()=>path.startsWith('/hanamesh/library')?{items:[{id:'example',kind:'application',displayName:'Example',installed:{state:'registered',appId:'example',definition:{deployments:[{id:'local'}]}}}]}:path==='/apps/open'?receipt:path==='/apps/bootstrap-authorize'?{authorization:'test-only-not-a-real-grant'}:{}};}});t.after(()=>client.unmount());
 await client.click('打开');await settle();const frame=client.find(n=>n.type==='iframe'),source={postMessage:(...args)=>posts.push(args)};frame.props.ref.current={contentWindow:source};
 const data={type:'hm-bootstrap-proof',challenge};
 for(const event of [{origin:'null',source,data},{origin:'http://127.0.0.1:1',source,data},{origin,source:{},data}])await client.message(event);
 assert.equal(requests.filter(r=>r.path==='/apps/bootstrap-authorize').length,0);assert.equal(posts.length,0);
 await client.message({origin,source,data:{type:'hm-bootstrap-ready',challenge}});assert.equal(posts[0][1],origin);
 await client.message({origin,source,data});assert.equal(requests.filter(r=>r.path==='/apps/bootstrap-authorize').length,1);assert.equal(posts[1][1],origin);
 await client.message({origin,source,data});assert.equal(requests.filter(r=>r.path==='/apps/bootstrap-authorize').length,1);
});
test('D26 bootstrap: null/wrong origin or nonparent source does not produce proof or exchange',async t=>{
 const {origin:upstream}=await external(t);const g=new FixedGateway({upstream,parentOrigin:'dsh-app://app',isLeaseActive:()=>true});await g.start();t.after(()=>g.close());const url=await g.issueAsync('view');
 const page=(await http(url,{headers:{'sec-fetch-dest':'iframe'}})).body.toString(),script=page.match(/<script nonce="[^"]+">([\s\S]*)<\/script>/)[1];let receive;const messages=[],calls=[],parent={postMessage:(...args)=>messages.push(args)};
 runInNewContext(script,{parent,console:{info(){}},addEventListener:(_n,fn)=>{receive=fn;},fetch:async(...args)=>{calls.push(args);return{ok:true};},location:{replace(){}},JSON,document:{querySelector:()=>({})}});
 const c=new URL(url).pathname.split('/').at(-1),data={type:'hm-bootstrap-parent',challenge:c};
 for(const event of [{origin:'null',source:parent,data},{origin:'dsh-app://shell',source:parent,data},{origin:'dsh-app://app',source:{},data}])await receive(event);
 assert.equal(messages.length,1);assert.equal(calls.length,0);assert.equal(messages[0][1],'dsh-app://app');
 await receive({origin:'dsh-app://app',source:parent,data});assert.equal(messages.length,2);
 await receive({origin:'null',source:parent,data:{type:'hm-bootstrap-authorize',challenge:c,authorization:'wrong'}});assert.equal(calls.length,0);
});
