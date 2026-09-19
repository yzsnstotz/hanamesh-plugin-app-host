import { randomUUID } from 'node:crypto';
import { AppHostError, requireCondition } from '../errors.js';
import { loopbackOrigin } from '../descriptor.js';

export const ROUTER_ROUTES=Object.freeze(['/hanamesh/router/providers','/hanamesh/router/plan','/hanamesh/router/grant',
  '/hanamesh/router/revoke','/hanamesh/router/mode','/hanamesh/router/gateway']);
async function body(req){
  requireCondition(req.headers['content-type']?.split(';')[0].trim()==='application/json','CONTENT_TYPE_REQUIRED','Expected application/json.',{},415);
  const chunks=[];let total=0;for await(const chunk of req){total+=chunk.length;requireCondition(total<=16_384,'BODY_TOO_LARGE','Request body is too large.',{},413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AppHostError('INVALID_JSON','Malformed JSON.',{},400);}
}
function send(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; frame-ancestors 'none'"});res.end(JSON.stringify(value));}
const statusFor=code=>({APP_NOT_FOUND:404,ENTRY_UNKNOWN:404,ROUTER_PROVIDER_ABSENT:404,RISK_NOT_ACKNOWLEDGED:403,
  CONSUMER_MISMATCH:403,GATEWAY_OFF:409,GATEWAY_UNREACHABLE:503}[code]??400);

export function createRouterHttpHandler(router,{parentOrigin,authenticate,authorize}){
  parentOrigin=loopbackOrigin(parentOrigin);requireCondition(typeof authenticate==='function'&&typeof authorize==='function','AUTH_BINDING_REQUIRED','Router authentication is required.');
  return async(req,res)=>{const traceId=randomUUID();try{
    requireCondition(req.headers.host===new URL(parentOrigin).host,'HOST_DENIED','Unrecognized request host.',{},403);
    requireCondition(req.url?.startsWith('/')&&!req.url.startsWith('//')&&!req.url.includes('\\'),'BAD_TARGET','Invalid request target.');
    const url=new URL(req.url,parentOrigin),path=url.pathname;requireCondition(ROUTER_ROUTES.includes(path),'NOT_FOUND','Unknown router route.',{},404);
    const readOnly=['/hanamesh/router/providers','/hanamesh/router/plan'].includes(path);
    requireCondition(req.method===(readOnly?'GET':'POST'),'METHOD_NOT_ALLOWED','State changes require POST.',{},405);
    requireCondition(!req.headers.origin||req.headers.origin===parentOrigin,'ORIGIN_DENIED','Unapproved browser origin.',{},403);
    requireCondition(req.headers['sec-fetch-dest']!=='iframe'&&req.headers['sec-fetch-site']!=='cross-site','FRAME_CONTROL_DENIED','An application frame cannot control the router.',{},403);
    requireCondition(req.headers['x-hanamesh-client']==='workspace-v1','CSRF_DENIED','Explicit workspace client header is required.',{},403);
    if(!readOnly)requireCondition(req.headers.origin===parentOrigin,'CSRF_DENIED','Workspace origin is required.',{},403);
    const subject=await authenticate(req);requireCondition(subject&&typeof subject.principalId==='string','UNAUTHENTICATED','Host authentication is required.',{},401);
    const input=readOnly?Object.fromEntries(url.searchParams):await body(req);
    if(path==='/hanamesh/router/providers')requireCondition(Object.keys(input).length===0,'UNKNOWN_FIELDS','No provider parameters are accepted.');
    if(path==='/hanamesh/router/plan')requireCondition(Object.keys(input).every(key=>key==='appId')&&typeof input.appId==='string','UNKNOWN_FIELDS','Plan accepts only appId.');
    requireCondition(await authorize(subject,path,input)===true,'FORBIDDEN','Operation is not authorized.',{},403);
    let result;
    if(path==='/hanamesh/router/providers')result={providers:await router.providers()};
    if(path==='/hanamesh/router/plan')result=await router.plan(input.appId);
    if(path==='/hanamesh/router/grant')result=await router.grant(input.appId,input.entryId,input.subject,{model:input.model,riskAcknowledged:input.riskAcknowledged});
    if(path==='/hanamesh/router/revoke')result=await router.revoke(input.appId,input.entryId);
    if(path==='/hanamesh/router/mode'){await router.setMode(input.appId,input.mode);result=await router.plan(input.appId);}
    if(path==='/hanamesh/router/gateway')result=await router.enableGateway(input.enabled===true);
    send(res,200,{...result,traceId});
  }catch(error){const trusted=error instanceof AppHostError||typeof error?.code==='string',code=trusted?(error.code??error.message):'INTERNAL_ERROR';
    send(res,trusted?(error.status??statusFor(code)):500,{error:{code,message:trusted?error.message:'The operation could not be completed.'},traceId});}
  };
}
