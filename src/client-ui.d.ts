export const name:'hanamesh-app-host-client';
export const inject:readonly ['slots','locale'];
/** Trusted producer configuration; normal Loader activation defaults to false. */
export function apply(ctx:unknown,options?:{verification?:boolean}):void;
export function ProvidersSection():unknown;
/** Settings section「市场目录源」(rc.28 name; the export keeps its rc.11 identifier). */
export function LibrarySourcesSection():unknown;
export function HandoffSettingsSection():unknown;
/** Plugin-local named settings and explicitly confirmed standalone Node preparation. */
export function NodeRuntimeSection():unknown;
/** Sidebar entry「市场」; hidden while the `market` seat owner renders the market itself. */
export function LibraryAction():unknown;
/** The HanaMesh market page (applications + plugins; install / upgrade / uninstall / restart notice).
 *  `embedded` renders it inline for the Extension Management tab instead of as the shell overlay. */
export function LibraryOverlay(props?:{embedded?:boolean,mainPage?:boolean,preferredSubsectionId?:string,verification?:boolean}):unknown;
/** rc.32: the「只能其一」notice shown at the top of the market page when dshmarket holds the seat. */
export function MarketConflictNotice():unknown;
/** Identifiers only; metadata and confirmation are owned by the client's market. */
/** rc.8: `contractVersion` optionally declares the install-target contract the caller speaks; absent means v1, any other value is refused with CONTRACT_VERSION_UNSUPPORTED. */
export type PackageInstallTarget =
  | {source:'npm';name:string;version:string;allowBuild:string[]}
  | {source:'github';repo:string;ref:string;path:string|null;packageName:string;allowBuild:string[]};
export interface InstallTarget {itemId?:string;packageName?:string;contractVersion?:'1';installTarget?:PackageInstallTarget;}
export interface InstallTargetReceipt {status:'confirmation-required'|'installing'|'already-installed'|'superseded';itemId?:string;packageName?:string;}
/** Show/resolve a target without installing. Resolves once confirmation is ready; rejects with a visible market error. */
export function openInstallTarget(input:InstallTarget):Promise<InstallTargetReceipt>;
/** rc.32: the client-side `market` service object read by the shell's Extension Management panel. */
export function createMarketSeat(options?:{verification?:boolean}):{render(options?:{preferredSubsectionId?:string,verification?:boolean}):unknown,setSettingsVisible(visible:boolean):void,openInstallTarget(input:InstallTarget):Promise<InstallTargetReceipt>};
export const MARKET_SEAT:'market';
export const MARKET_CONFLICT_TEXT:string;
/** Test/inspection view of the module-level market state; not part of the DSH contract. */
export function marketState():{conflict:string,entryVisible:boolean};

/** Normal navigation on the authenticated workspace URL; app-host consumes this fragment. */
export const INSTALL_TARGET_HASH:'#hanamesh-install?';
/** Install-target contract version this market implements; see schemas/install-target.schema.json. */
export const INSTALL_TARGET_CONTRACT_VERSION:'1';

/** AppHost-owned registry selection, independent of catalog manifest sources. */
export function SuiteSourceSettingsSection():unknown;

/** Additive DSH layout seats and the Core-owned environment content extension. */
export function registerAppHostPages(ctx:unknown):()=>void;
export function EnvironmentContent():unknown;
/** Current catalog contract supplies none of these counts; null is explicit unknown, never zero. */
export interface CredibilityFacts {itemId?:string;signals?:{stars?:number|null;npmDownloads30d?:number|null;storeInstalls30d?:number|null;checkedAt?:string|null}|null;popularity?:{users30d?:number|null;asOf?:string|null}|null;checkedAt?:string|null;asOf?:string|null}
export function credibilityFacts(facts?:CredibilityFacts|null):{id:string;label:string;value:number|null;reason:'catalog-field-unavailable'|null}[];
export function readCredibility(source:unknown,item:{id:string},fetcher?:typeof fetch):Promise<CredibilityFacts>;
/** HanaMesh-view catalog website link; absent for fixtures and other provider protocols. */
export function catalogWebsiteLink(source:unknown,item:unknown):string|null;

/** CL6 native-market building blocks; full tab migration is not yet activated. */
export interface NativeMarketInstall {readonly spec:string;readonly title:string;readonly version:string;readonly registry?:string;}
export interface NativeMarketCompatibility {readonly compatible:boolean;readonly exempted?:boolean;readonly runtimeVersion?:string;readonly requirements?:Readonly<Record<string,string>>;}
export interface NativeMarketEntry {readonly hanaId:string;readonly publisher?:{readonly name?:string};readonly sourceLinks?:readonly {readonly sourceId:string;readonly sourceUrl:string}[];}
export interface NativeMarketChoice {readonly entry:NativeMarketEntry;readonly install:NativeMarketInstall;readonly compatibility:NativeMarketCompatibility;}
export interface NativeMarketReview extends NativeMarketChoice {readonly trustRequired:true;}
export interface NativeMarketOwner {readonly install?:(target:NativeMarketInstall)=>void;readonly openPackage?:(name:string)=>void;readonly update?:unknown;}
export interface NativeMarketActions {
 readonly capabilities:Readonly<{install:boolean;openPackage:boolean;update:boolean}>;
 review(choice:NativeMarketChoice):NativeMarketReview;
 confirm(review:NativeMarketReview):void;
 cancel():void;
 openInstalled(packageName:string):void;
}
export function createNativeMarketActions(owner?:NativeMarketOwner):NativeMarketActions;
export interface NativeMarketSnapshot {
 readonly status:'idle'|'loading'|'ready'|'error';readonly items:readonly NativeMarketEntry[];readonly bundles:readonly unknown[]|null;
 readonly error:string|null;readonly page:number;readonly hasMore:boolean;readonly query:Readonly<Record<string,unknown>>|null;readonly answered:Readonly<Record<string,unknown>>|null;
}
export interface NativeMarketListing {
 snapshot():NativeMarketSnapshot;subscribe(listener:(snapshot:NativeMarketSnapshot)=>void):()=>void;
 load(query:Readonly<Record<string,unknown>>):Promise<void>;more():Promise<void>;retry():Promise<void>;dispose():void;
}
export function createNativeMarketListing(ports:{readPage:(query:Record<string,unknown>&{page:number;limit:number},options:{signal:AbortSignal})=>Promise<{items:NativeMarketEntry[];page:number;totalPages:number}>;listBundles:()=>Promise<unknown[]>}):NativeMarketListing;
export type NativeMarketDocument={readonly status:'none'}|{readonly status:'ready';readonly markdown:string};
export function readNativeMarketDetail(target:NativeMarketChoice,readers:Record<'meta'|'package'|'repository',(target:NativeMarketChoice)=>Promise<NativeMarketDocument>>):Promise<NativeMarketDocument>;
export function NativeMarketConfirmation(props:{review:NativeMarketReview|null;actions:NativeMarketActions;Modal:unknown;onClose:()=>void}):unknown;
export function NativeMarketExternalActions(props:{command?:string;website:string;copy:(command:string)=>unknown}):unknown;
export function NativeMarketResults(props:{snapshot:NativeMarketSnapshot;card:(item:NativeMarketEntry)=>unknown;onRetry:()=>void;onMore:()=>void}):unknown;
