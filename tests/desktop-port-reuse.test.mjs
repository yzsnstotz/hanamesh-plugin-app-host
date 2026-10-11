// Controlled HTTP negative, not a browser/REAL_UI result.
// Virtual Host transport dials the fixed IPv4 listener; no native resolution/header override. Headers represent an old
// same-origin document; they are never injected into native Desktop traffic.
import assert from 'node:assert/strict';
import test from 'node:test';
import {Server,createServer,request} from 'node:http';
import {FixedGateway} from '../src/gateway.js';
import {writeFileSync} from 'node:fs';
const http=(url,opts={})=>new Promise((resolve,reject)=>{const q=request({hostname:'127.0.0.1',port:new URL(url).port,path:new URL(url).pathname+new URL(url).search,agent:false,...opts,headers:{host:new URL(url).host,...opts.headers}},r=>{const b=[];r.on('data',c=>b.push(c));r.once('end',()=>resolve({status:r.statusCode,body:Buffer.concat(b).toString()}));});q.once('error',reject);if(opts.body)q.write(opts.body);q.end();});
test('D26 security RED: revoked view origin must not inherit another view grant after port reuse',async()=>{
const upstream=createServer((_q,r)=>r.end('UNMODIFIED_ORDINARY_BODY'));await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
const live=new Set(['principal:view-A:instance:gen1','principal:view-B:instance:gen1']);
const g=new FixedGateway({upstream:`http://127.0.0.1:${upstream.address().port}`,parentOrigin:'dsh-app://app',isLeaseActive:k=>live.has(k)});await g.start();
let outcome;
try {
 const keyA=[...live][0],keyB=[...live][1],a=new URL(await g.issueAsync(keyA)),port=Number(a.port);
 live.delete(keyA);g.revokeInactive();await new Promise(r=>setTimeout(r,10));
 // Deterministically exercise a valid OS choice: the released port is assigned again.
 const original=Server.prototype.listen;Server.prototype.listen=function(...args){if(args[0]===0)args[0]=port;return original.apply(this,args);};
 let b;try{b=new URL(await g.issueAsync(keyB));}finally{Server.prototype.listen=original;}
 await http(b.href,{headers:{'sec-fetch-dest':'iframe'}});const challenge=b.pathname.split('/').at(-1),{authorization}=g.authorizeChallenge(keyB,b.origin,challenge);
 await http(b.origin+'/__hanamesh_exchange',{method:'POST',headers:{origin:b.origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify({challenge,authorization})});
 // An old document and the new view have identical browser origin after port reuse.
 const result=await http(a.origin+'/',{headers:{'sec-fetch-site':'same-origin',referer:a.origin+'/'}});
 outcome={kind:'CONTROLLED_HTTP_NEGATIVE',oldViewRevoked:!live.has(keyA),newViewLive:live.has(keyB),sameOrigin:a.origin===b.origin,expected:403,actual:result.status,body:result.body,portReuseForced:true,ordinaryNativeTrafficUntouched:true};
 console.log(JSON.stringify(outcome));
 assert.equal(result.status,403,'revoked view A must not inherit view B authority when the OS reuses a port');
}finally{await g.close();await new Promise(r=>upstream.close(r));}

});
