export const name:'hanamesh-app-host-client';
export const inject:readonly ['slots','locale'];
export function apply(ctx:unknown):void;
export function ProvidersSection():unknown;
/** Settings section「市场目录源」(rc.28 name; the export keeps its rc.11 identifier). */
export function LibrarySourcesSection():unknown;
/** Sidebar entry「市场」; hidden while the `market` seat owner renders the market itself. */
export function LibraryAction():unknown;
/** The HanaMesh market page (applications + plugins; install / upgrade / uninstall / restart notice).
 *  `embedded` renders it inline for the Extension Management tab instead of as the shell overlay. */
export function LibraryOverlay(props?:{embedded?:boolean,preferredSubsectionId?:string}):unknown;
/** rc.32: the「只能其一」notice shown at the top of the market page when dshmarket holds the seat. */
export function MarketConflictNotice():unknown;
/** Identifiers only; metadata and confirmation are owned by the client's market. */
/** rc.8: `contractVersion` optionally declares the install-target contract the caller speaks; absent means v1, any other value is refused with CONTRACT_VERSION_UNSUPPORTED. */
export interface InstallTarget {itemId?:string;packageName?:string;contractVersion?:'1';}
export interface InstallTargetReceipt {status:'confirmation-required'|'installing'|'already-installed'|'superseded';itemId?:string;packageName?:string;}
/** Show/resolve a target without installing. Resolves once confirmation is ready; rejects with a visible market error. */
export function openInstallTarget(input:InstallTarget):Promise<InstallTargetReceipt>;
/** rc.32: the client-side `market` service object read by the shell's Extension Management panel. */
export function createMarketSeat():{render(options?:{preferredSubsectionId?:string}):unknown,setSettingsVisible(visible:boolean):void,openInstallTarget(input:InstallTarget):Promise<InstallTargetReceipt>};
export const MARKET_SEAT:'market';
export const MARKET_CONFLICT_TEXT:string;
/** Test/inspection view of the module-level market state; not part of the DSH contract. */
export function marketState():{conflict:string,entryVisible:boolean};

/** Normal navigation on the authenticated workspace URL; app-host consumes this fragment. */
export const INSTALL_TARGET_HASH:'#hanamesh-install?';
/** Install-target contract version this market implements; see schemas/install-target.schema.json. */
export const INSTALL_TARGET_CONTRACT_VERSION:'1';
