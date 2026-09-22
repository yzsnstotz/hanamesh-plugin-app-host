export type Awaitable<T> = T | Promise<T>;
export type InstanceStatus = 'reserved'|'starting'|'ready'|'stopping'|'stopped'|'failed'|'interrupted';
export type LeaseStatus = 'active'|'closed'|'expired'|'stopped'|'failed';
export interface Readiness { path:string; status:number; bodyIncludes?:string; header?:{name:string;value:string}; }
export interface GatewayPolicy { cookieAllowlist?:string[]; allowAppAuthorization?:boolean; }
interface DeploymentBase { id:string; dataId:string; readiness:Readiness; embedding?:'direct'|'gateway'; startTimeoutMs?:number; stopGraceMs?:number; gateway?:GatewayPolicy; }
/** rc.4: what an app needs, never where it comes from. `projection:'env'` names a process variable; `projection:'file'` a path relative to the app HOME. */
export type CredentialEnvEntry =
  { env:string; kind?:'api-key'|'grant'; providers?:string[]; required?:boolean; purpose?:string; projection?:'env'; sets?:Record<string,string> }
| { path:string; kind?:'api-key'|'grant'; providers?:string[]; required?:boolean; purpose?:string; projection:'file'; base?:'home'|'dataDir'; format?:string; sets?:Record<string,string> };
/** rc.8 `sets`: non-secret companion env applied by the broker when this slot is granted (each key must be a declared env slot). Value `{{provider}}` is replaced with the granted credential's provider id. */
/** `base`: where `path` is rooted — the app HOME (`<dataDir>/home`, default) or the data directory itself (e.g. a `$XXX_HOME={{dataDir}}` app). `format`: opaque id the credential broker maps a grant to (e.g. `codex-cli-auth-json`, `oauth-cli-kit`); the host never interprets it. */
export interface CredentialResolverInput { appId:string; deploymentId:string; instanceId:string; principalId:string; credentialEnv:CredentialEnvEntry[]; }
/** File projection policy (rc.6): `if-absent` (default) never clobbers a file the app rotated itself; `overwrite` replaces it (new grant version); `remove` deletes it (revoke / app-owned). The host never reads the file back. Events: `credential.injected` (env names + written files), `credential.file-kept`, `credential.file-removed`, `credential.env-rejected`, `credential.resolver-failed`. rc.7: a stopped instance adopts a changed app definition on open (`instance.definition-adopted`); only a running one refuses with `DEFINITION_CHANGED` (409). */
export type CredentialFilePolicy = 'if-absent'|'overwrite'|'remove';
export interface CredentialResolverResult { env?:Record<string,string>; files?:Array<{path:string;content?:string;mode?:number;policy?:CredentialFilePolicy}>; secrets?:string[]; }
/** Seated by the credential broker (plugin-auth-apikey). Undefined / throw = inject nothing; the launch proceeds. */
export type CredentialResolver = (input:CredentialResolverInput)=>Awaitable<CredentialResolverResult|undefined>;
export interface RuntimeManifestItem { id:string; version:string; kind:'tar.gz'|'zip'; installTo:string; platforms:Record<string,{asset:string;sha256:string;size?:number;strip?:number;url?:string}>; }
export interface RuntimeManifest { schema:1; sources:Array<{id:string;kind:'https'|'file';base:string}>; items:RuntimeManifestItem[]; }
export interface RuntimeSelection { manifest:RuntimeManifest; item:string; exec:string; }
interface OwnedDeploymentBase extends DeploymentBase { mode:'owned'; args:string[]; cwd?:string; env?:Record<string,string>; envAllowlist?:string[]; credentialEnv?:CredentialEnvEntry[]; }
export type OwnedDeployment = OwnedDeploymentBase & ({ command:string; runtime?:never }|{ command?:never; runtime:RuntimeSelection });
export interface AttachedDeployment extends DeploymentBase { mode:'attach'; url:string; }
export type Deployment = OwnedDeployment|AttachedDeployment;
/** rc.27 `packageName`: the npm package shipping this app — the usage-evidence `hanaRef`. Optional; the installed-package scan binds it otherwise (`AppHost.bindPackageName`). */
export interface AppDefinition { id:string; name:string; singleInstanceOnly?:boolean; packageName?:string; deployments:Deployment[]; }
export interface InstanceRecord {
  id:string; appId:string; deploymentId:string; dataId:string; principalId:string; dataDir:string; mode:'owned'|'attach';
  definitionHash:string; status:InstanceStatus; runtimeId:string|null; endpoint:string|null; gatewayOrigin:string|null;
  pid:number|null; guardianPid:number|null; createdAt:number; updatedAt:number; errorCode?:string;
}
export interface ViewLease { principalId:string; viewId:string; instanceId:string; generation:number; status:LeaseStatus; expiresAt:number; createdAt:number; originalSessionId:string|null; }
export interface StoredLease extends ViewLease { tokenHash:string; }
export interface HostEvent { sequence:number; at:number; type:string; instanceId:string; principalId:string; viewId?:string; generation?:number; [key:string]:unknown; }
/** rc.27: a request the instance's gateway forwarded for an authorized view (never bootstrap, denials, 401/403 or host probes). In-memory only. */
export interface InstanceActivity { type:'instance.activity'; instanceId:string; appId:string; deploymentId:string; principalId:string; at:number; }
export interface Snapshot { schema:1; revision:number; sequence:number; instances:InstanceRecord[]; leases:StoredLease[]; events:HostEvent[]; }
export interface SnapshotStore { init():Promise<void>; load():Promise<Snapshot>; save(snapshot:Snapshot):Promise<void>; close():Promise<void>; }
export interface OpenRequest { appId:string; deploymentId:string; viewId:string; leaseToken?:string; instanceId?:string; originalSessionId?:string; }
export interface LeaseRequest { viewId:string; leaseToken:string; }
export interface RecoverRequest { viewId:string; instanceId:string; confirm:true; }
export interface OpenReceipt { instance:InstanceRecord; lease:ViewLease; leaseToken:string; uiUrl:string|null; originalSessionId:string|null; }
export interface AppListing {
  contractVersion:1; apps:Array<{id:string;name:string;singleInstanceOnly:boolean;packageName:string|null;deployments:Array<{id:string;dataId:string;mode:'owned'|'attach';embedding:'direct'|'gateway';credentialEnv:CredentialEnvEntry[]}>}>;
  instances:InstanceRecord[]; views:ViewLease[]; sequence:number;
}
export interface EventPage { events:HostEvent[]; sequence:number; resetRequired:boolean; }
export interface HostOptions {
  store:SnapshotStore; dataRoot:string; parentOrigin:string; leaseTtlMs?:number; sweepIntervalMs?:number;
  nodeBinary?:string; clock?:()=>number; checkpoint?:(point:string,details:Record<string,unknown>)=>Awaitable<void>; credentialResolver?:CredentialResolver|null;
  runtimeLedgerReader?:(root:string)=>Awaitable<{schema:1;items:Record<string,{version:string}>}>;
}
export class AppHost {
  constructor(options:HostOptions);
  /** rc.4: seat or clear the credential broker; returns a disposer that clears it only if still the same function. */
  setCredentialResolver(resolver:CredentialResolver|null):()=>void;
  register(definition:AppDefinition):{appId:string;definitionHash:string}; init():Promise<this>;
  /** rc.27: bind the npm package that ships `appId` (from the installed scan); a definition-declared `packageName` wins. */
  bindPackageName(appId:string,packageName:string):void;
  /** Usage-evidence `hanaRef` for an app, or null when unknown (then no evidence is reported for it). */
  packageName(appId:string):string|null;
  /** rc.27: real gateway activity per instance; not persisted, not in `eventsSince`. Returns a disposer. */
  onActivity(listener:(activity:InstanceActivity)=>void):()=>void;
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
  layout:'single'; domain:'hanamesh_app_host'; readSnapshot():Promise<Snapshot|null|undefined>;
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
  constructor(options:{upstream:string;parentOrigin:string;isLeaseActive:(viewKey:string)=>boolean;cookieAllowlist?:string[];allowAppAuthorization?:boolean;maxUploadBytes?:number;frameAncestors?:string[];
    /** rc.27: called once per forwarded request the upstream answered with anything but 401/403 (and per accepted WebSocket upgrade). */
    onForward?:()=>void});
  origin:string; start():Promise<string>; issue(viewKey:string):string; close():Promise<void>;
}
export function rewriteCsp(value:string,parentOrigin:string):string;
export function embeddingHeaders(rawHeaders:string[],parentOrigin:string):string[];
export function validateDefinition(input:AppDefinition):AppDefinition;
/** rc.27 usage evidence: `open` once per instance reaching ready, `use` once per app per UTC hour of real gateway activity, through the optional usage seat. */
export const SOURCE_PLUGIN:'@hanamesh/dsh-app-host';
export function hourBucket(ms:number):string;
/** T6 usage receipt riding on a `use` event: provider × model × forwarded-request count of that UTC hour; never content. */
export interface UsageReceipt { providerId:string; model:string|null; count:number; }
export interface UsageRecordInput { hanaRef:string; action:'open'|'use'; occurredAt?:string; idempotencyKey:string; sourcePlugin:string; sourceHanaRef?:string; targetRef?:string; receipt?:UsageReceipt; }
export interface UsageRecordResult { disposition:'recorded'|'duplicate'|'withheld'|'rejected'; eventId?:string; code?:string; }
export interface UsageSeat { record(input:UsageRecordInput):Awaitable<UsageRecordResult>; }
/** T6 receipt ledger (storage domain `hanamesh_router_receipts`): hourly rows per app × Router route, reported through the usage seat when the hour closes. */
export interface ReceiptRoute { providerId:string; model:string|null; }
export interface ReceiptRow { appId:string; providerId:string|null; model:string|null; hour:string; count:number; injections:number; firstAt:string; lastAt:string; reported:boolean; }
export interface ReceiptLedger {
  inject(input:{appId:string;instanceId:string;routes?:readonly {providerId:string;model?:string|null}[];at?:number}):Record<string,unknown>|null;
  activity(input:{appId:string;instanceId:string;at?:number}):Record<string,unknown>;
  forget(instanceId:string):void; routeOf(instanceId:string):ReceiptRoute|null;
  pending(options?:{appId?:string;includeCurrent?:boolean;now?:number}):{appId:string;hour:string;occurredAt:number;count:number;receipt:UsageReceipt|null}[];
  markReported(appId:string,hour:string):number; list(options?:{appId?:string}):ReceiptRow[]; size():number;
  persist():Promise<void>; close():Promise<void>;
}
export function createReceiptLedger(options?:{domain?:{global:{get():unknown;set(value:unknown):Promise<void>}};clock?:()=>number;persistDelayMs?:number;maxItems?:number;retentionMs?:number}):ReceiptLedger;
export function normalizeRoute(route:unknown):ReceiptRoute|null;
export function createUsageEvidence(options:{host:AppHost;seat:()=>UsageSeat|unknown;receipts?:ReceiptLedger;logger?:{debug?:(...args:unknown[])=>void};clock?:()=>number;sweepIntervalMs?:number}):{
  flush(options?:{appId?:string;includeCurrent?:boolean}):Promise<void>; settle():Promise<void>; receipts:ReceiptLedger; close():void;
};
export const name:'hanamesh-app-host';
export const inject:readonly ['webServer','storageDomain','connection'];
export function apply(ctx:unknown,config?:import('./dsh.js').DshPluginConfig):Promise<void>;
