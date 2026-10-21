import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createLibraryHttpHandler} from '../src/library/routes.js';
import {http} from './helpers.mjs';
test('MN HTTP environment actions stay authenticated, same-origin and explicit; public install-target remains read only',async t=>{
 const calls=[];let origin;const server=createServer((q,s)=>handler(q,s));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));origin=`http://127.0.0.1:${server.address().port}`;
 const nodeRuntime={save:async()=>{throw Object.assign(new Error('ENOENT: standalone Node path does not exist'),{code:'ENOENT'});},status:()=>({ready:false,settings:{}}),plan:async input=>{calls.push(['plan',input]);return{planId:'p'};},prepare:input=>{calls.push(['prepare',input]);return{operation:{id:'o'}};}};
 const handler=createLibraryHttpHandler({handoffSettings:()=>({allowedOrigins:['https://market.example']}),installTarget:()=>({ready:false})},{parentOrigin:origin,authenticate:async q=>q.headers.authorization==='Bearer fixture'?{principalId:'fixture'}:null,authorize:async()=>true,nodeRuntime});
 const path=origin+'/hanamesh/library/node-runtime';assert.equal((await http(path)).status,401);
 assert.equal((await http(path,{headers:{authorization:'Bearer fixture'}})).status,200);
 const post={method:'POST',headers:{authorization:'Bearer fixture','content-type':'application/json','x-hanamesh-client':'workspace-v1',origin},body:'{}'};
 assert.equal((await http(path+'/prepare',{...post,headers:{...post.headers,origin:'https://market.example'}})).status,403);assert.equal(calls.length,0);
 assert.equal((await http(path+'/plan',post)).status,200);assert.deepEqual(calls,[['plan',{}]]);
 assert.equal((await http(origin+'/hanamesh/library/install-target',{headers:{origin:'https://market.example'}})).status,200);
 assert.equal((await http(path+'/prepare',{...post,headers:{...post.headers,authorization:''}})).status,401);assert.equal(calls.length,1);
 const missing=await http(path+'/settings',post);assert.equal(missing.status,500);assert.match(missing.json.error.message,/standalone Node path does not exist/);assert.equal(missing.json.error.details.cause,'ENOENT');
 assert.equal((await http(path+'?extra=1',{headers:{authorization:'Bearer fixture'}})).status,400);
});
