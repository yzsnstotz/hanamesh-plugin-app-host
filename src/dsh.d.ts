import type {InstallationReaderConfig} from './installation-status.js';
import type { AppHost, AppDefinition, AuthenticatedSubject, Awaitable, DshStorageBinding } from './index.js';
export const name: 'hanamesh-app-host';
export const DSH_TARGET: '>=0.2.0-rc.2 <0.3.0-0 || >=0.2.1-0 <0.3.0-0';
export const inject: readonly ['webServer', 'storageDomain', 'connection'];
export const BROWSER_PRINCIPAL: 'dsh-browser';
export const ROUTES: readonly string[];
export const Config: unknown;
export const appHostDomainSpec: { readonly name: 'hanamesh_app_host'; readonly version: 1; readonly layout: 'single' };
export interface DshPluginConfig {
  nodeRuntime?:{mode?:'managed'|'external';version?:string;sourceBase?:string;storageRoot?:string;externalBinary?:string};
  dataRoot?: string; parentOrigin?: string; frameAncestors?: string[]; nodeBinary?: string; router?:{codingOauth?:{mode?:'http'|'file'}};
  /** `sources` undefined → the HanaMesh catalog source; explicit `[]` → none. `profileDir`/`profileName`/`dshBin` (and
   *  `nodeBinary`) are inferred from the proven Desktop layout or plain DSH when undefined — see docs/CONTRACT.md 「应用库配置」; explicit values win. */
  /** rc.28: the same keys serve the HanaMesh market (plugins + applications; routes `/hanamesh/library*`, see docs/CONTRACT.md「市场」). */
  library?:{fixture?:string;sources?:Array<{manifestUrl:string;enabled?:boolean}>;profileDir?:string;profileName?:string;dshBin?:string;registry?:string;allowPrerelease?:boolean;eventRetention?:number;installationReaders?:Partial<Record<'claude'|'codex',InstallationReaderConfig>>};
  applications?: AppDefinition[]; leaseTtlMs?: number; sweepIntervalMs?: number;
}
/** Adapt an open `ctx.storageDomain` handle (single layout, global snapshot) to the store binding. */
export function domainBinding(domain: { global: { get(): unknown; set(value: unknown): Promise<void> }; close(): Promise<void> }): DshStorageBinding;
/** Authentication through `ctx.connection.requestRejection`; DSH web is single-user. */
export function browserAuthentication(connection: { requestRejection(request: { headers: Record<string, unknown> }): unknown }): {
  authenticate(request: unknown): Awaitable<AuthenticatedSubject | null>;
  authorize(subject: AuthenticatedSubject, path: string, input: unknown): Awaitable<boolean>;
};
/** Cordis plugin entry; activates once webServer, storageDomain and connection are provided. */
export function apply(ctx: unknown, config: DshPluginConfig): Promise<void>;

/** AppHost-owned HTTP settings on GET/POST /hanamesh/library/suite-source. Catalog sources stay independent. */
export type SuiteSourceMode='configured'|'core';
/** Public Core protocol-1 observation; no provider revision, generation or watch is supplied. */
export interface CoreSuiteSourceState {
  readonly protocolVersion:'1';readonly status:'disabled'|'ready'|'failed'|'disposed';
  readonly selection:'configured'|'custom'|'disabled';readonly registry:string|null;
  readonly archiveCount:number;readonly lastError:string|null;
}
export interface SuiteSourceSettings {
  readonly mode:SuiteSourceMode;readonly configuredRegistry:string;
  readonly observation:{readonly observable:true;readonly state:CoreSuiteSourceState}|{readonly observable:false;readonly code:string};
}
/** POST accepts exactly this shape; saving selects a source and does not authorize installation. */
export interface SuiteSourceSettingsInput {mode:SuiteSourceMode;}
