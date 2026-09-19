/**
 * DSH plugin entry for @hanamesh/dsh-app-host, bound to the PINNED public APIs
 * of DSH 0.1.5-alpha.1 (research checkout 5dda764):
 *
 *   ctx.storageDomain.open(spec)      @deepseek-ai/dsh-storage-domain  — `single` layout, one
 *                                     global snapshot; `global.set()` is one whole-image publish
 *   ctx.webServer.register(route)     @deepseek-ai/dsh-host-webserver  — exact routes + disposer
 *   ctx.connection.requestRejection() @deepseek-ai/dsh-client-connection — Host/Origin fence and
 *                                     the browser session cookie; the same gate the /api channel uses
 *   ctx.provide / ctx.effect          @deepseek-ai/cordis — service seat and disposal
 *
 * `inject` lists all three services, so the plugin only activates once they exist: without the
 * connection service there is no authentication and therefore no route (H11/H14 fail closed).
 * Nothing here guesses an API name; every call above has a type declaration in the pinned package.
 */
import z from '@deepseek-ai/schemastery';
import { z as zod } from 'zod';
import { join } from 'node:path';
import { defineDomain } from '@deepseek-ai/dsh-storage-domain';
import { AppHost } from './manager.js';
import { DshDomainSnapshotStore, emptySnapshot } from './store.js';
import { createHttpHandler } from './routes.js';
import { requireCondition } from './errors.js';
import { routerDomainSpec } from './router/domain.js';
import { createProviderSources } from './router/sources.js';
import { createRouter } from './router/broker.js';
import { createRouterHttpHandler, ROUTER_ROUTES } from './router/routes.js';

export const name = 'hanamesh-app-host';
export const DSH_TARGET = '0.1.5-alpha.1';
export const inject = ['webServer', 'storageDomain', 'connection'];
/** One authenticated local browser session per profile; DSH web has no per-user principals. */
export const BROWSER_PRINCIPAL = 'dsh-browser';
/** Every route the HTTP handler answers; registered individually so nothing else is shadowed. */
export const ROUTES = Object.freeze(['/hanamesh/apps', '/apps/open', '/apps/resume', '/apps/recover',
  '/apps/close', '/apps/heartbeat', '/apps/stop', '/apps/events']);

export const Config = z.object({
  /** Absolute canonical directory that owns every instance data root (secureDirectory refuses symlinks). */
  dataRoot: z.string().default(join(process.env.DSH_HOME ?? process.env.HOME ?? '.', 'data', 'hanamesh-apps')),
  /** Exact loopback workspace origin; defaults to the running web server's own origin. */
  parentOrigin: z.string(),
  /** Standalone Node executable used for guardian/launcher processes; required under Electron. */
  nodeBinary: z.string(),
  router: z.object({ codingOauth: z.object({ mode:z.string() }) }),
  applications: z.array(z.any()).default([]),
  leaseTtlMs: z.number(),
  sweepIntervalMs: z.number(),
});

/** Domain declaration: the whole app-host snapshot is ONE global value, published atomically. */
const snapshotSchema = zod.object({
  schema: zod.literal(1), revision: zod.number().int().nonnegative(), sequence: zod.number().int().nonnegative(),
  instances: zod.array(zod.record(zod.string(), zod.unknown())),
  leases: zod.array(zod.record(zod.string(), zod.unknown())),
  events: zod.array(zod.record(zod.string(), zod.unknown())),
});
export const appHostDomainSpec = defineDomain({
  name: 'hanamesh_app_host', version: 1, layout: 'single', tables: {},
  global: { schema: snapshotSchema, initial: emptySnapshot() },
});

/** Adapt an open storage-domain handle to the store's single-image binding port. */
export function domainBinding(domain) {
  return Object.freeze({
    layout: 'single', domain: appHostDomainSpec.name,
    readSnapshot: async () => domain.global.get(),
    publishSnapshot: async snapshot => { await domain.global.set(snapshot); },
    // Single-open per domain name is enforced by the facility at open(); nothing extra to take here.
    acquireExclusive: async () => {},
    releaseExclusive: async () => { await domain.close(); },
  });
}

/** The authentication port: connection's fence + cookie decide, the plugin never parses a token. */
export function browserAuthentication(connection) {
  requireCondition(typeof connection?.requestRejection === 'function', 'DSH_BINDING_REQUIRED',
    'ctx.connection.requestRejection is required for authenticated app-host routes.');
  return {
    authenticate: async request => connection.requestRejection(request) === undefined
      ? { principalId: BROWSER_PRINCIPAL } : null,
    // DSH web is single-user: an authenticated browser session may perform every app-host operation.
    authorize: async (subject) => subject?.principalId === BROWSER_PRINCIPAL,
  };
}

export async function apply(ctx, config) {
  requireCondition(ctx && typeof ctx.get === 'function' && typeof ctx.provide === 'function' && typeof ctx.effect === 'function',
    'DSH_BINDING_REQUIRED', 'apply() needs a Cordis plugin context; it cannot be called bare.');
  const webServer = ctx.get('webServer'), facility = ctx.get('storageDomain'), connection = ctx.get('connection');
  requireCondition(webServer && facility && connection, 'DSH_BINDING_REQUIRED', 'webServer, storageDomain and connection services are required.');
  config ??= {};
  const dataRoot = config.dataRoot ?? join(process.env.DSH_HOME ?? process.env.HOME ?? '.', 'data', 'hanamesh-apps');
  requireCondition(typeof dataRoot === 'string', 'INVALID_ROOT', 'dataRoot is required.');
  const parentOrigin = config.parentOrigin ?? `http://127.0.0.1:${webServer.port}`;
  const domain = await facility.open(appHostDomainSpec);
  let routerDomain;
  const store = new DshDomainSnapshotStore(domainBinding(domain));
  const host = new AppHost({ store, dataRoot, parentOrigin,
    ...(config.nodeBinary === undefined ? {} : { nodeBinary: config.nodeBinary }),
    ...(config.leaseTtlMs === undefined ? {} : { leaseTtlMs: config.leaseTtlMs }),
    ...(config.sweepIntervalMs === undefined ? {} : { sweepIntervalMs: config.sweepIntervalMs }) });
  let initialized = false;
  try {
    for (const definition of config.applications ?? []) host.register(definition);
    await host.init(); initialized = true;
    const auth = { parentOrigin, ...browserAuthentication(connection) };
    const handler = createHttpHandler(host, auth);
    const disposers = ROUTES.map(path => webServer.register({ kind: 'exact', path, handler }));
    let credentialService, llmService, oauthService;
    ctx.inject(['credentials'], injected => { credentialService=injected.get('credentials');return()=>{credentialService=undefined;}; });
    ctx.inject(['llm'], injected => { llmService=injected.get('llm');return()=>{llmService=undefined;}; });
    ctx.inject(['hanameshOAuth'], injected => { oauthService=injected.get('hanameshOAuth');return()=>{oauthService=undefined;}; });
    const credentials = {
      describe: async ref => credentialService ? await credentialService.describe(ref) : { configured:false,writable:false },
      resolve: async ref => credentialService ? await credentialService.resolve(ref) : undefined,
      describeRecord: async key => credentialService ? await credentialService.describeRecord(key) : { configured:false,writable:false },
    };
    routerDomain = await facility.open(routerDomainSpec);
    const sources = createProviderSources({ credentials, apps:host, llm:()=>llmService,
      webOrigin:`http://127.0.0.1:${webServer.port}`, codingOauth:config.router?.codingOauth });
    const router = createRouter({ credentials, domain:routerDomain, apps:host, sources, oauth:()=>oauthService });
    const detachResolver=host.setCredentialResolver(router.credentialResolver),detachObserver=host.subscribe(router.observe);
    const routerHandler=createRouterHttpHandler(router,auth);
    const routerDisposers=ROUTER_ROUTES.map(path=>webServer.register({kind:'exact',path,handler:routerHandler}));
    ctx.effect(() => () => { for (const dispose of disposers.splice(0)) dispose(); }, 'hanameshApps.routes');
    ctx.effect(() => async () => { for(const dispose of routerDisposers.splice(0))dispose();detachResolver();detachObserver();await routerDomain.close(); }, 'hanameshApps.router');
    ctx.provide('hanameshApps', host);
  } catch (error) {
    await routerDomain?.close().catch(()=>{});
    if (initialized) await host.dispose().catch(() => {}); else await store.close().catch(() => {});
    throw error;
  }
  // Disposal order: routes go first (registered later, disposed earlier by Cordis), then the host
  // stops every owned instance and closes the domain. An attached instance is never signalled.
  ctx.effect(() => async () => { await host.dispose(); }, 'hanameshApps.dispose');
}
