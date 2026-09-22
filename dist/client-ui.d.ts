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
/** rc.32: the client-side `market` service object read by the shell's Extension Management panel. */
export function createMarketSeat():{render(options?:{preferredSubsectionId?:string}):unknown,setSettingsVisible(visible:boolean):void};
export const MARKET_SEAT:'market';
export const MARKET_CONFLICT_TEXT:string;
/** Test/inspection view of the module-level market state; not part of the DSH contract. */
export function marketState():{conflict:string,entryVisible:boolean};
