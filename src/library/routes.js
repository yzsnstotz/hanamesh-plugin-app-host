import { randomUUID } from 'node:crypto';
import { AppHostError, requireCondition } from '../errors.js';
import { controlOrigins } from '../control-origin.js';

// Keep older route order; dsh.js registers each exact path on the public host API.
export const LIBRARY_ROUTES=['/hanamesh/library','/hanamesh/library/sources','/hanamesh/library/install','/hanamesh/library/provision','/hanamesh/library/uninstall','/hanamesh/library/events','/hanamesh/library/installedPlugins','/hanamesh/library/plugins/install','/hanamesh/library/plugins/uninstall','/hanamesh/library/target','/hanamesh/library/install-target','/hanamesh/library/handoffs','/hanamesh/library/handoffs/state','/hanamesh/library/handoff-settings'];
const READ_ROUTES=new Set(['/hanamesh/library','/hanamesh/library/sources','/hanamesh/library/events','/hanamesh/library/installedPlugins','/hanamesh/library/target','/hanamesh/library/handoffs','/hanamesh/library/handoff-settings']);
async function jsonBody(req){
  requireCondition(req.headers['content-type']?.split(';')[0].trim()==='application/json','CONTENT_TYPE_REQUIRED','Expected application/json.',{},415);
  const chunks=[];let total=0;for await(const chunk of req){total+=chunk.length;requireCondition(total<=65_536,'BODY_TOO_LARGE','Request body is too large.',{},413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AppHostError('INVALID_JSON','Malformed JSON.',{},400);}
}
function send(res,status,value,publicProbe=false){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; frame-ancestors 'none'",...(publicProbe?{'access-control-allow-origin':'*'}:{})});res.end(JSON.stringify(value));
}
/** `handoff` (optional): {queue, listener, restart} of the website handoff (handoff.js); the client window reads and reports through these authenticated routes. */
export function createLibraryHttpHandler(library,{parentOrigin,transportOrigin,authenticate,authorize,handoff}){
  const origins=controlOrigins(parentOrigin,transportOrigin);parentOrigin=origins.parent;
  requireCondition(typeof authenticate==='function'&&typeof authorize==='function','AUTH_BINDING_REQUIRED','Host authentication and per-operation authorization callbacks are mandatory.');
  const parent=new URL(origins.transport),hosts=new Set(origins.forwarded?[parent.host]:[parent.host,`localhost:${parent.port}`]);
  return async(req,res)=>{const traceId=randomUUID();try{
    requireCondition(hosts.has(req.headers.host),'HOST_DENIED','Unrecognized request host.',{},403);
    requireCondition(req.url?.startsWith('/')&&!req.url.startsWith('//')&&!req.url.includes('\\'),'BAD_TARGET','Invalid request target.');
    const requestOrigin=`${parent.protocol}//${req.headers.host}`,url=new URL(req.url,requestOrigin),path=url.pathname;
    requireCondition(LIBRARY_ROUTES.includes(path),'NOT_FOUND','Unknown library route.',{},404);
    requireCondition(req.headers['sec-fetch-dest']!=='iframe','FRAME_CONTROL_DENIED','An application frame cannot control the host.',{},403);
    if(path==='/hanamesh/library/install-target'){
      requireCondition(req.method==='GET','METHOD_NOT_ALLOWED','Discovery requires GET.',{},405);
      requireCondition(!url.search,'UNKNOWN_FIELDS','Discovery takes no parameters.');
      send(res,200,{...library.installTarget(),traceId},true);return;
    }
    const readOnly=req.method==='GET'&&READ_ROUTES.has(path);
    requireCondition(readOnly||(req.method==='POST'&&!['/hanamesh/library/installedPlugins','/hanamesh/library/target','/hanamesh/library/handoffs'].includes(path)),'METHOD_NOT_ALLOWED','Unsupported library method.',{},405);
    requireCondition(!req.headers.origin||(origins.forwarded?origins.acceptsOrigin(req.headers.origin):req.headers.origin===requestOrigin),'ORIGIN_DENIED','Unapproved browser origin.',{},403);
    if(!readOnly)requireCondition((origins.forwarded?origins.acceptsOrigin(req.headers.origin):req.headers.origin===requestOrigin)&&req.headers['x-hanamesh-client']==='workspace-v1','CSRF_DENIED','Workspace origin and explicit client header are required.',{},403);
    const subject=await authenticate(req);
    requireCondition(subject&&typeof subject.principalId==='string','UNAUTHENTICATED','Host authentication is required.',{},401);
    if(readOnly)requireCondition(new Set(url.searchParams.keys()).size===[...url.searchParams.keys()].length,'INVALID_INPUT','Duplicate query fields are not accepted.');
    const input=readOnly?Object.fromEntries(url.searchParams):await jsonBody(req);
    requireCondition(await authorize(subject,path,input)===true,'FORBIDDEN','Operation is not authorized.',{},403);
    let result;
    if(path.startsWith('/hanamesh/library/handoff'))requireCondition(handoff,'HANDOFF_UNAVAILABLE','Website handoff is not wired in this host.',{},503);
    if(path==='/hanamesh/library/handoffs'){requireCondition(Object.keys(input).length===0,'UNKNOWN_FIELDS','handoffs takes no parameters.');result={handoffs:handoff.queue.open(),listener:handoff.listener.state(),live:library.live,client:library.installTarget().client};}
    else if(path==='/hanamesh/library/handoffs/state'){send(res,200,{...handoff.queue.report(input),traceId});return;}
    else if(path==='/hanamesh/library/handoff-settings'&&readOnly){requireCondition(Object.keys(input).length===0,'UNKNOWN_FIELDS','handoff-settings takes no parameters.');result={settings:library.handoffSettings(),listener:handoff.listener.state()};}
    else if(path==='/hanamesh/library/handoff-settings'){const settings=await library.replaceHandoffSettings(input);send(res,200,{settings,listener:await handoff.restart(),traceId});return;}
    else if(path==='/hanamesh/library/target')result=await library.resolveTarget(input);
    else if(path==='/hanamesh/library'&&readOnly){requireCondition(Object.keys(input).every(key=>['q','category','cursor'].includes(key)),'UNKNOWN_FIELDS','Unknown library parameters.');result=await library.list(input);}
    else if(path==='/hanamesh/library/sources'&&readOnly)result=library.sources();
    else if(path==='/hanamesh/library/sources')result=await library.replaceSources(input);
    else if(path==='/hanamesh/library/install')result=await library.install(input);
    else if(path==='/hanamesh/library/provision')result=await library.provision(input);
    else if(path==='/hanamesh/library/uninstall')result=await library.uninstall(input);
    else if(path==='/hanamesh/library/installedPlugins'){requireCondition(Object.keys(input).length===0,'UNKNOWN_FIELDS','installedPlugins takes no parameters.');result=await library.installedSnapshot();}
    else if(path==='/hanamesh/library/plugins/install')result=await library.installPlugin(input);
    else if(path==='/hanamesh/library/plugins/uninstall')result=await library.uninstallPlugin(input);
    else{requireCondition(Object.keys(input).every(key=>key==='after'),'UNKNOWN_FIELDS','Unknown event parameters.');result=library.events(Number(input.after??0));}
    send(res,!readOnly&&path!=='/hanamesh/library/sources'&&result.status!=='already-installed'?202:200,{...result,traceId});
  }catch(error){const trusted=error instanceof AppHostError;send(res,trusted?error.status:500,{error:{code:trusted?error.code:'INTERNAL_ERROR',message:trusted?error.message:'The operation could not be completed.',...(trusted?{details:error.details}:{})},traceId});}};
}
