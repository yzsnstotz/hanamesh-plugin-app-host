import type { AppHost, AppDefinition, AuthenticatedSubject, Awaitable, DshStorageBinding } from './index.js';
export const name: 'hanamesh-app-host';
export const DSH_TARGET: '0.1.5-alpha.1';
export const inject: readonly ['webServer', 'storageDomain', 'connection'];
export const BROWSER_PRINCIPAL: 'dsh-browser';
export const ROUTES: readonly string[];
export const Config: unknown;
export const appHostDomainSpec: { readonly name: 'hanamesh_app_host'; readonly version: 1; readonly layout: 'single' };
export interface DshPluginConfig { dataRoot: string; parentOrigin?: string; applications?: AppDefinition[]; leaseTtlMs?: number; sweepIntervalMs?: number; }
/** Adapt an open `ctx.storageDomain` handle (single layout, global snapshot) to the store binding. */
export function domainBinding(domain: { global: { get(): unknown; set(value: unknown): Promise<void> }; close(): Promise<void> }): DshStorageBinding;
/** Authentication through `ctx.connection.requestRejection`; DSH web is single-user. */
export function browserAuthentication(connection: { requestRejection(request: { headers: Record<string, unknown> }): unknown }): {
  authenticate(request: unknown): Awaitable<AuthenticatedSubject | null>;
  authorize(subject: AuthenticatedSubject, path: string, input: unknown): Awaitable<boolean>;
};
/** Cordis plugin entry; activates once webServer, storageDomain and connection are provided. */
export function apply(ctx: unknown, config: DshPluginConfig): Promise<void>;
