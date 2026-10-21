import test from 'node:test';
import assert from 'node:assert/strict';
import {registeredClient} from './fixtures/registered-client-harness.mjs';
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate);};
const text=node=>JSON.stringify(node);
test('MN UI actual settings slot shows all named settings; planning never downloads and confirmation is distinct',async t=>{
 const calls=[];const settings={mode:'managed',version:'24.22.0',sourceBase:'https://nodejs.org/dist',storageRoot:'/owned/node',externalBinary:''};
 const state={settings,names:Object.fromEntries(Object.keys(settings).map(k=>[k,k])),versions:['24.22.0','24.13.1'],supported:true,platform:'darwin-arm64',ready:false,operation:null};
 const harness=await registeredClient({file:new URL('../src/client-ui.js',import.meta.url),href:'http://127.0.0.1:45678',fetch:async(path,init)=>{
 calls.push({path,init});let value=path.endsWith('/node-runtime')?state:path.endsWith('/plan')?{planId:'p',version:'24.22.0',platform:'darwin-arm64',source:'https://nodejs.org/dist/v24.22.0/node.tar.gz',bytes:50000000,unpackedBytes:190000000,requiredBytes:430000000,root:'/owned/node/runtime',sha256:'a'.repeat(64),license:'MIT'}:path.endsWith('/prepare')?{operation:{id:'op',state:'preparing',phase:'download'}}:path.endsWith('installedPlugins')?{plugins:[]}:{handoffs:[],pollMs:1500};return {ok:true,json:async()=>value};}});
 t.after(()=>harness.dispose());harness.mountSettings('hanamesh-node-runtime');await flush();
 for(const key of Object.keys(settings))assert.ok(harness.find(n=>n.props?.['data-node-setting']===key),key);
 const button=label=>harness.find(n=>n.type==='button'&&n.children.includes(label));
 assert.ok(button('准备安装环境'));button('准备安装环境').props.onClick();await flush();assert.match(text(harness.tree),/50\.0 MB/);assert.match(text(harness.tree),/darwin-arm64/);assert.equal(calls.filter(c=>c.path.endsWith('/prepare')).length,0);
 button('确认下载并准备').props.onClick();await flush();const call=calls.find(c=>c.path.endsWith('/prepare'));assert.deepEqual(JSON.parse(call.init.body),{planId:'p',confirm:true});
});
