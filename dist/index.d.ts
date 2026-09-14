export type Awaitable<T> = T | Promise<T>;
export type InstanceStatus = 'reserved'|'starting'|'ready'|'stopping'|'stopped'|'failed'|'interrupted';
export type LeaseStatus = 'active'|'closed'|'expired'|'stopped'|'failed';
export interface Readiness { path:string; status:number; bodyIncludes?:string; header?:{name:string;value:string}; }
export interface GatewayPolicy { cookieAllowlist?:string[]; allowAppAuthorization?:boolean; }
interface DeploymentBase { id:string; dataId:string; readiness:Readiness; embedding?:'direct'|'gateway'; startTimeoutMs?:number; stopGraceMs?:number; gateway?:GatewayPolicy; }
/** rc.4: what an app needs, never where it comes from. `projection:'env'` names a process variable; `projection:'file'` a path relative to the app HOME. */
export type CredentialEnvEntry =
  { env:string; kind?:'api-key'|'grant'; providers?:string[]; required?:boolean; purpose?:string; projection?:'env' }
| { path:string; kind?:'api-key'|'grant'; providers?:string[]; required?:boolean; purpose?:string; projection:'file'; base?:'home'|'dataDir'; format?:string };
/** `base`: where `path` is rooted — the app HOME (`<dataDir>/home`, default) or the data directory itself (e.g. a `$XXX_HOME={{dataDir}}` app). `format`: opaque id the credential broker maps a grant to (e.g. `codex-cli-auth-json`, `oauth-cli-kit`); the host never interprets it. */
export interface CredentialResolverInput { appId:string; deploymentId:string; instanceId:string; principalId:string; credentialEnv:CredentialEnvEntry[]; }
export interface CredentialResolverResult { env?:Record<string,string>; files?:Array<{path:string;content:string;mode?:number}>; secrets?:string[]; }
/** Seated by the credential broker (plugin-auth-apikey). Undefined / throw = inject nothing; the launch proceeds. */
export type CredentialResolver = (input:CredentialResolverInput)=>Awaitable<CredentialResolverResult|undefined>;
export interface OwnedDeployment extends DeploymentBase { mode:'owned'; command:string; args:string[]; cwd?:string; env?:Record<string,string>; envAllowlist?:string[]; credentialEnv?:CredentialEnvEntry[]; }
export interface AttachedDeployment extends DeploymentBase { mode:'attach'; url:string; }
export type Deployment = OwnedDeployment|AttachedDeployment;
export interface AppDefinition { id:string; name:string; singleInstanceOnly?:boolean; deployments:Deployment[]; }
export interface InstanceRecord {
  id:string; appId:string; deploymentId:string; dataId:string; principalId:string; dataDir:string; mode:'owned'|'attach';
  definitionHash:string; status:InstanceStatus; runtimeId:string|null; endpoint:string|null; gatewayOrigin:string|null;
  pid:number|null; guardianPid:number|null; createdAt:number; updatedAt:number; errorCode?:string;
}
export interface ViewLease { principalId:string; viewId:string; instanceId:string; generation:number; status:LeaseStatus; expiresAt:number; createdAt:number; originalSessionId:string|null; }
export interface StoredLease extends ViewLease { tokenHash:string; }
export interface HostEvent { sequence:number; at:number; type:string; instanceId:string; principalId:string; viewId?:string; generation?:number; [key:string]:unknown; }
export interface Snapshot { schema:1; revision:number; sequence:number; instances:InstanceRecord[]; leases:StoredLease[]; events:HostEvent[]; }
export interface SnapshotStore { init():Promise<void>; load():Promise<Snapshot>; save(snapshot:Snapshot):Promise<void>; close():Promise<void>; }
export interface OpenRequest { appId:string; deploymentId:string; viewId:string; leaseToken?:string; instanceId?:string; originalSessionId?:string; }
export interface LeaseRequest { viewId:string; leaseToken:string; }
export interface RecoverRequest { viewId:string; instanceId:string; confirm:true; }
export interface OpenReceipt { instance:InstanceRecord; lease:ViewLease; leaseToken:string; uiUrl:string|null; originalSessionId:string|null; }
export interface AppListing {
  contractVersion:1; apps:Array<{id:string;name:string;singleInstanceOnly:boolean;deployments:Array<{id:string;dataId:string;mode:'owned'|'attach';embedding:'direct'|'gateway';credentialEnv:CredentialEnvEntry[]}>}>;
  instances:InstanceRecord[]; views:ViewLease[]; sequence:number;
}
export interface EventPage { events:HostEvent[]; sequence:number; resetRequired:boolean; }
export interface HostOptions {
  store:SnapshotStore; dataRoot:string; parentOrigin:string; leaseTtlMs?:number; sweepIntervalMs?:number;
  clock?:()=>number; checkpoint?:(point:string,details:Record<string,unknown>)=>Awaitable<void>; credentialResolver?:CredentialResolver|null;
}
export class AppHost {
  constructor(options:HostOptions);
  /** rc.4: seat or clear the credential broker; returns a disposer that clears it only if still the same function. */
  setCredentialResolver(resolver:CredentialResolver|null):()=>void;
  register(definition:AppDefinition):{appId:string;definitionHash:string}; init():Promise<this>;
  beginOpen(input:OpenRequest,principalId?:string):Promise<OpenReceipt>;
  open(input:OpenRequest,principalId?:string):Promise<OpenReceipt>; start(input:OpenRequest,principalId?:string):Promise<OpenReceipt>;
  resume(input:LeaseRequest,principalId?:string,options?:{waitForReady?:boolean}):Promise<OpenReceipt>;
  recoverView(input:RecoverRequest,principalId?:string):Promise<OpenReceipt>;
  heartbeat(input:LeaseRequest,principalId?:string):Promise<ViewLease>;
  close(input:LeaseRequest,principalId?:string):Promise<{instanceId:string;alreadyClosed:boolean}>;
  stop(instanceId:string,options?:{confirm?:boolean},principalId?:string):Promise<InstanceRecord>; stopAll():Promise<void>;
  sweepLeases():Promise<void>; instance(id:string,principalId?:string):InstanceRecord|null; instanceList(principalId?:string):InstanceRecord[];
  list(principalId?:string):AppListing; eventsSince(sequence?:number,principalId?:string):EventPage;
  subscribe(listener:(event:HostEvent|{type:'host.error';code:string})=>void):()=>void;
  logTail(id:string,limit?:number,principalId?:string):Array<{at:number;stream:string;text:string}>; dispose():Promise<void>;
}
export class AppHostError extends Error { constructor(code:string,message:string,details?:Record<string,unknown>,status?:number); code:string; details:Record<string,unknown>; status:number; }
export class AtomicFileStore implements SnapshotStore {
  constructor(root:string,options?:{checkpoint?:(point:string,snapshot:Snapshot)=>Awaitable<void>}); readonly path:string;
  init():Promise<void>; load():Promise<Snapshot>; save(snapshot:Snapshot):Promise<void>; close():Promise<void>;
}
export interface DshStorageBinding {
  layout:'single'; domain:'hanamesh-app-host'; readSnapshot():Promise<Snapshot|null|undefined>;
  publishSnapshot(snapshot:Snapshot):Promise<void>; acquireExclusive():Promise<void>; releaseExclusive():Promise<void>;
}
export class DshDomainSnapshotStore implements SnapshotStore {
  constructor(binding:DshStorageBinding); init():Promise<void>; load():Promise<Snapshot>; save(snapshot:Snapshot):Promise<void>; close():Promise<void>;
}
export interface AuthenticatedSubject { principalId:string; [key:string]:unknown; }
export interface HttpOptions<Request=unknown> {
  parentOrigin:string; authenticate(request:Request):Awaitable<AuthenticatedSubject|null>;
  authorize(subject:AuthenticatedSubject,path:string,input:unknown):Awaitable<boolean>;
}
export function createHttpHandler<Request=unknown,Response=unknown>(host:AppHost,options:HttpOptions<Request>):(request:Request,response:Response)=>Promise<void>;
export class FixedGateway {
  constructor(options:{upstream:string;parentOrigin:string;isLeaseActive:(viewKey:string)=>boolean;cookieAllowlist?:string[];allowAppAuthorization?:boolean;maxUploadBytes?:number});
  origin:string; start():Promise<string>; issue(viewKey:string):string; close():Promise<void>;
}
export function rewriteCsp(value:string,parentOrigin:string):string;
export function embeddingHeaders(rawHeaders:string[],parentOrigin:string):string[];
