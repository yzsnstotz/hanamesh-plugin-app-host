import { randomUUID } from 'node:crypto';
import { AppHostError, requireCondition } from './errors.js';
import { loopbackOrigin } from './descriptor.js';
function browserInstance(instance) {
  if(!instance)return null;
  const {id,appId,deploymentId,dataId,mode,status,runtimeId,errorCode}=instance;
  return {id,appId,deploymentId,dataId,mode,status,runtimeId,...(errorCode?{errorCode}:{})};
}
function visible(value) {
  if(value?.instance)return {...value,instance:browserInstance(value.instance)};
  if(value?.instances)return {...value,instances:value.instances.map(browserInstance)};
  return value;
}
async function jsonBody(req) {
  requireCondition(req.headers['content-type']?.split(';')[0].trim()==='application/json','CONTENT_TYPE_REQUIRED','Expected application/json.',{},415);
  const chunks=[];let total=0;
  for await(const chunk of req){total+=chunk.length;requireCondition(total<=16_384,'BODY_TOO_LARGE','Request body is too large.',{},413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AppHostError('INVALID_JSON','Malformed JSON.',{},400);}
}
function send(res,status,value) {
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
    'x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; frame-ancestors 'none'"});
  res.end(JSON.stringify(value));
}
/** Node request handler. Authentication/authorization MUST come from the host. */
export function createHttpHandler(host,{parentOrigin,authenticate,authorize}) {
  parentOrigin=loopbackOrigin(parentOrigin);
  requireCondition(typeof authenticate==='function'&&typeof authorize==='function','AUTH_BINDING_REQUIRED',
    'Host authentication and per-operation authorization callbacks are mandatory.');
  return async(req,res)=>{
    const traceId=randomUUID();
    try{
      requireCondition(req.headers.host===new URL(parentOrigin).host,'HOST_DENIED','Unrecognized request host.',{},403);
      requireCondition(req.url?.startsWith('/')&&!req.url.startsWith('//')&&!req.url.includes('\\'),'BAD_TARGET','Invalid request target.');
      const url=new URL(req.url,parentOrigin),path=url.pathname;
      const known=['/hanamesh/apps','/apps/open','/apps/resume','/apps/recover','/apps/close','/apps/heartbeat','/apps/stop','/apps/events'];
      requireCondition(known.includes(path),'NOT_FOUND','Unknown app-host route.',{},404);
      const readOnly=['/hanamesh/apps','/apps/events'].includes(path);
      requireCondition(req.method===(readOnly?'GET':'POST'),'METHOD_NOT_ALLOWED','State changes require POST.',{},405);
      requireCondition(!req.headers.origin||req.headers.origin===parentOrigin,'ORIGIN_DENIED','Unapproved browser origin.',{},403);
      requireCondition(req.headers['sec-fetch-dest']!=='iframe','FRAME_CONTROL_DENIED','An application frame cannot control the host.',{},403);
      if(!readOnly){
        requireCondition(req.headers.origin===parentOrigin&&req.headers['x-hanamesh-client']==='workspace-v1',
          'CSRF_DENIED','Workspace origin and explicit client header are required.',{},403);
      }
      const subject=await authenticate(req);
      requireCondition(subject&&typeof subject.principalId==='string','UNAUTHENTICATED','Host authentication is required.',{},401);
      const input=readOnly?Object.fromEntries(url.searchParams):await jsonBody(req);
      requireCondition(await authorize(subject,path,input)===true,'FORBIDDEN','Operation is not authorized.',{},403);
      let result;
      switch(path){
        case '/hanamesh/apps':requireCondition(!url.search,'UNKNOWN_FIELDS','No list parameters are accepted.');result=host.list(subject.principalId);break;
        case '/apps/open':result=await host.beginOpen(input,subject.principalId);break;
        case '/apps/resume':result=await host.resume(input,subject.principalId,{waitForReady:false});break;
        case '/apps/recover':result=await host.recoverView(input,subject.principalId);break;
        case '/apps/close':result=await host.close(input,subject.principalId);break;
        case '/apps/heartbeat':result=await host.heartbeat(input,subject.principalId);break;
        case '/apps/stop':{
          requireCondition(input&&Object.keys(input).every(k=>['instanceId','confirm'].includes(k))&&
            typeof input.instanceId==='string'&&(input.confirm===undefined||typeof input.confirm==='boolean'),
            'INVALID_REQUEST','Stop requires an instanceId and an optional boolean confirmation.');
          result={instance:await host.stop(input.instanceId,{confirm:input.confirm??false},subject.principalId)};break;
        }
        case '/apps/events':requireCondition(Object.keys(input).every(k=>k==='after'),'UNKNOWN_FIELDS','Unknown event parameters.');result=host.eventsSince(Number(input.after??0),subject.principalId);break;
      }
      send(res,200,{...visible(result),traceId});
    }catch(error){
      const trusted=error instanceof AppHostError;
      send(res,trusted?error.status:500,{error:{code:trusted?error.code:'INTERNAL_ERROR',
        message:trusted?error.message:'The operation could not be completed.',
        ...(trusted?{details:error.details}:{})},traceId});
    }
  };
}
