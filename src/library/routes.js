import { randomUUID } from 'node:crypto';
import { AppHostError, requireCondition } from '../errors.js';
import { controlOrigins } from '../control-origin.js';

// Keep older route order; dsh.js registers each exact path on the public host API.
export const LIBRARY_ROUTES=['/hanamesh/library','/hanamesh/library/sources','/hanamesh/library/install','/hanamesh/library/provision','/hanamesh/library/uninstall','/hanamesh/library/events','/hanamesh/library/installedPlugins','/hanamesh/library/plugins/install','/hanamesh/library/plugins/uninstall','/hanamesh/library/target','/hanamesh/library/suite/upgrade'];
export const NODE_RUNTIME_ROUTES=['/hanamesh/library/node-runtime','/hanamesh/library/node-runtime/settings','/hanamesh/library/node-runtime/plan','/hanamesh/library/node-runtime/prepare','/hanamesh/library/node-runtime/cancel'];
LIBRARY_ROUTES.push('/hanamesh/library/version-target','/hanamesh/library/version/install','/hanamesh/library/suite/status','/hanamesh/library/versions',...NODE_RUNTIME_ROUTES,'/hanamesh/library/suite-source');
const READ_ROUTES=new Set(['/hanamesh/library/version-target','/hanamesh/library/suite/status','/hanamesh/library/versions','/hanamesh/library/suite-source','/hanamesh/library/node-runtime','/hanamesh/library','/hanamesh/library/sources','/hanamesh/library/events','/hanamesh/library/installedPlugins','/hanamesh/library/target']);
async function jsonBody(req){
  requireCondition(req.headers['content-type']?.split(';')[0].trim()==='application/json','CONTENT_TYPE_REQUIRED','Expected application/json.',{},415);
  const chunks=[];let total=0;for await(const chunk of req){total+=chunk.length;requireCondition(total<=65_536,'BODY_TOO_LARGE','Request body is too large.',{},413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AppHostError('INVALID_JSON','Malformed JSON.',{},400);}
}
function send(res,status,value){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; frame-ancestors 'none'"});res.end(JSON.stringify(value));
}
export function createLibraryHttpHandler(library,{parentOrigin,transportOrigin,authenticate,authorize,nodeRuntime}){
  const origins=controlOrigins(parentOrigin,transportOrigin);parentOrigin=origins.parent;
  requireCondition(typeof authenticate==='function'&&typeof authorize==='function','AUTH_BINDING_REQUIRED','Host authentication and per-operation authorization callbacks are mandatory.');
  const parent=new URL(origins.transport),hosts=new Set(origins.forwarded?[parent.host]:[parent.host,`localhost:${parent.port}`]);
  return async(req,res)=>{const traceId=randomUUID();try{
    requireCondition(hosts.has(req.headers.host),'HOST_DENIED','Unrecognized request host.',{},403);
    requireCondition(req.url?.startsWith('/')&&!req.url.startsWith('//')&&!req.url.includes('\\'),'BAD_TARGET','Invalid request target.');
    const requestOrigin=`${parent.protocol}//${req.headers.host}`,url=new URL(req.url,requestOrigin),path=url.pathname;
    requireCondition(LIBRARY_ROUTES.includes(path),'NOT_FOUND','Unknown library route.',{},404);
    requireCondition(req.headers['sec-fetch-dest']!=='iframe','FRAME_CONTROL_DENIED','An application frame cannot control the host.',{},403);
    const readOnly=req.method==='GET'&&READ_ROUTES.has(path);
    requireCondition(readOnly||(req.method==='POST'&&!['/hanamesh/library/installedPlugins','/hanamesh/library/target'].includes(path)),'METHOD_NOT_ALLOWED','Unsupported library method.',{},405);
    requireCondition(!req.headers.origin||(origins.forwarded?origins.acceptsOrigin(req.headers.origin):req.headers.origin===requestOrigin),'ORIGIN_DENIED','Unapproved browser origin.',{},403);
    if(!readOnly)requireCondition((origins.forwarded?origins.acceptsOrigin(req.headers.origin):req.headers.origin===requestOrigin)&&req.headers['x-hanamesh-client']==='workspace-v1','CSRF_DENIED','Workspace origin and explicit client header are required.',{},403);
    const subject=await authenticate(req);
    requireCondition(subject&&typeof subject.principalId==='string','UNAUTHENTICATED','Host authentication is required.',{},401);
    if(readOnly)requireCondition(new Set(url.searchParams.keys()).size===[...url.searchParams.keys()].length,'INVALID_INPUT','Duplicate query fields are not accepted.');
    const input=readOnly?Object.fromEntries(url.searchParams):await jsonBody(req);
    if(readOnly&&['/hanamesh/library/target','/hanamesh/library/version-target'].includes(path)&&input.installTarget!==undefined){try{input.installTarget=JSON.parse(input.installTarget);}catch{throw new AppHostError('INVALID_INPUT','installTarget must contain a structured catalog target.');}}
    requireCondition(await authorize(subject,path,input)===true,'FORBIDDEN','Operation is not authorized.',{},403);
    let result;
    if(NODE_RUNTIME_ROUTES.includes(path)){
      requireCondition(nodeRuntime,'NODE_RUNTIME_UNAVAILABLE','本插件尚未提供安装环境管理。',{},503);
      requireCondition(!url.search,'UNKNOWN_FIELDS','安装环境请求不接受查询参数。');
      try{if(path==='/hanamesh/library/node-runtime'){requireCondition(readOnly,'METHOD_NOT_ALLOWED','请使用读取操作。',{},405);result=nodeRuntime.status();}
      else if(path.endsWith('/settings'))result=await nodeRuntime.save(input);
      else if(path.endsWith('/plan'))result=await nodeRuntime.plan(input);
      else if(path.endsWith('/prepare'))result=nodeRuntime.prepare(input);
      else result=nodeRuntime.cancel(input);
      }catch(error){if(error instanceof AppHostError)throw error;throw new AppHostError('NODE_ENVIRONMENT_FAILED','无法读取或保存安装环境：'+String(error?.message??error).slice(0,1500),{cause:error?.code??'NODE_CHECK_FAILED'},500);}
      send(res,path.endsWith('/prepare')?202:200,{...result,traceId});return;
    }
    if(path==='/hanamesh/library/suite-source'){
      requireCondition(!url.search,'UNKNOWN_FIELDS','套件安装包来源不接受查询参数。');
      requireCondition(!readOnly||Object.keys(input).length===0,'UNKNOWN_FIELDS','套件安装包来源读取不接受参数。');
      const result=readOnly?library.suiteSourceSettings():await library.replaceSuiteSourceSettings(input);
      send(res,200,{...result,traceId});return;
    }
    if(path==='/hanamesh/library/suite/upgrade'){send(res,202,{...await library.upgradeSuite(input),traceId});return;}
    if(path==='/hanamesh/library/suite/status'){requireCondition(Object.keys(input).length===0,'INVALID_INPUT','Suite status takes no parameters.');result=await library.suiteStatus();}
    else if(path==='/hanamesh/library/version-target')result=await library.resolveVersionTarget(input);
    else if(path==='/hanamesh/library/version/install')result=await library.installVersion(input);
    else if(path==='/hanamesh/library/versions'){
      const controller=new AbortController(),abort=()=>{if(!res.writableEnded)controller.abort();};req.once('aborted',abort);res.once('close',abort);
      try{if(req.aborted||res.destroyed)controller.abort();result=await library.versions(input,{signal:controller.signal});if(controller.signal.aborted)return;}
      catch(error){if(controller.signal.aborted)return;throw error;}
      finally{req.off('aborted',abort);res.off('close',abort);}
    }
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
