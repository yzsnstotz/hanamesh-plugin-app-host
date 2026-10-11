// Controlled HTTP locator: dial the registered IPv4 listener and send exact virtual Host.
// This is synthetic transport, never native/browser resolution or request override.
import {request} from 'node:http';
export function desktopHttp(url,{method='GET',headers={},body}={}){
 const u=new URL(url);
 return new Promise((resolve,reject)=>{const q=request({hostname:'127.0.0.1',port:u.port,path:u.pathname+u.search,method,agent:false,headers:{host:u.host,...headers}},res=>{const chunks=[];res.on('data',d=>chunks.push(d));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});q.on('error',reject);if(body!==undefined)q.write(body);q.end();});
}
export const navigation=control=>({'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'iframe',referer:control+'/'});
export const application=data=>({'sec-fetch-site':'same-origin',referer:data+'/'});
