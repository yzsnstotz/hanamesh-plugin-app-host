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
 *   ctx.inject([optional], child)     @deepseek-ai/cordis — optional sibling services (credentials, llm,
 *                                     hanameshOAuth, hanameshUsage) are read duck-typed when/if they appear
 *
 * `inject` lists all three services, so the plugin only activates once they exist: without the
 * connection service there is no authentication and therefore no route (H11/H14 fail closed).
 * Nothing here guesses an API name; every call above has a type declaration in the pinned package.
 */
import z from '@deepseek-ai/schemastery';
import { z as zod } from 'zod';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { defineDomain } from '@deepseek-ai/dsh-storage-domain';
import { AppHost } from './manager.js';
import { DshDomainSnapshotStore, emptySnapshot } from './store.js';
import { createHttpHandler } from './routes.js';
import { requireCondition } from './errors.js';
import { routerDomainSpec } from './router/domain.js';
import { createProviderSources } from './router/sources.js';
import { createRouter } from './router/broker.js';
import { createRouterHttpHandler, ROUTER_ROUTES } from './router/routes.js';
import { libraryDomainSpec } from './library/domain.js';
import { createLibraryService } from './library/service.js';
import { createLibraryInstaller } from './library/install.js';
import { resolveLibraryLocations } from './library/locate.js';
import { createLibraryHttpHandler, LIBRARY_ROUTES } from './library/routes.js';
import { createUsageEvidence } from './usage-evidence.js';

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
  /** Extra origins allowed as frame ancestors of app views — the desktop shell's own webview origin
   *  (e.g. `tauri://localhost`) when the DSH workspace itself runs inside the shell's iframe. */
  frameAncestors: z.array(z.string()),
  /** Standalone Node executable used for guardian/launcher processes; required under Electron. */
  nodeBinary: z.string(),
  router: z.object({ codingOauth: z.object({ mode:z.string() }) }),
  library: z.object({
    fixture:z.string(),
    /** Undefined (not configured) → the HanaMesh catalog source; an explicit `[]` → no source. schemastery would
     *  coerce a missing array to `[]`, so the union keeps "unset" distinguishable from "deliberately empty". */
    sources:z.union([z.array(z.any()),z.const(undefined)]),
    /** All four are set by the desktop shell overlay; on plain DSH they are inferred (see library/locate.js). */
    profileDir:z.string(),profileName:z.string(),dshBin:z.string(),
    registry:z.string(),allowPrerelease:z.boolean(),
  }),
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
  let routerDomain,libraryDomain,library;
  const store = new DshDomainSnapshotStore(domainBinding(domain));
  const host = new AppHost({ store, dataRoot, parentOrigin, frameAncestors: config.frameAncestors ?? [],
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
    let credentialService, llmService, oauthService, usageService;
    ctx.inject(['credentials'], injected => { credentialService=injected.get('credentials');return()=>{credentialService=undefined;}; });
    // rc.27: usage evidence goes through the usage plugin's record seat when (and only when) that plugin is loaded.
    ctx.inject(['hanameshUsage'], injected => { usageService=injected.get('hanameshUsage');return()=>{usageService=undefined;}; });
    const evidence = createUsageEvidence({ host, seat:()=>usageService, logger:ctx.logger });
    ctx.effect(() => () => evidence.close(), 'hanameshApps.usage');
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
    libraryDomain=await facility.open(libraryDomainSpec);
    // Explicit config wins; on plain DSH (no shell overlay) the profile, DSH bin and Node are inferred from this process.
    const locations=await resolveLibraryLocations(config.library??{},{nodeBinary:config.nodeBinary});
    const libraryConfig={...(config.library??{}),sources:locations.sources,profileDir:locations.profileDir,profileName:locations.profileName};
    if(locations.inferred.length&&typeof ctx.logger?.info==='function')ctx.logger.info('hanamesh-app-host library: inferred %s',JSON.stringify(Object.fromEntries(
      locations.inferred.map(key=>[key,key==='sources'?locations.sources.map(source=>source.manifestUrl):locations[key]]))));
    let provisionApi,installer;
    if(locations.profileDir&&locations.profileName&&locations.nodeBinary){
      let dshBin=locations.dshBin;
      if(!dshBin)try{dshBin=createRequire(join(locations.profileDir,'package.json')).resolve('@deepseek-ai/dsh/lib/bin.js');}catch{dshBin=undefined;}
      if(dshBin){
        provisionApi=await import('./provision/index.js');
        installer=createLibraryInstaller({profileDir:locations.profileDir,profileName:locations.profileName,dataRoot,nodeBinary:locations.nodeBinary,
          dshBin,registry:libraryConfig.registry,allowPrerelease:libraryConfig.allowPrerelease,provision:provisionApi.provision,remove:provisionApi.remove,
          emit:event=>library?.emit(event)});
      }
    }
    library=createLibraryService({domain:libraryDomain,host,config:libraryConfig,dataRoot,ledgerReader:provisionApi?.ledger??(async()=>({schema:1,items:{}})),installer});
    await library.init();
    // rc.27: app bundles register plain `app.json` (no package name); the installed scan knows which npm package ships
    // which appId, and that package name is the usage-evidence `hanaRef`. Scan failure only costs evidence, never startup.
    try { for (const row of await library.installed()) if (row.appId && row.packageName) { try { host.bindPackageName(row.appId,row.packageName); } catch {} } }
    catch (error) { if (typeof ctx.logger?.debug === 'function') ctx.logger.debug('hanamesh-app-host usage: installed scan unavailable (%s)', error?.code ?? error?.message); }
    const libraryHandler=createLibraryHttpHandler(library,auth);
    const libraryDisposers=LIBRARY_ROUTES.map(path=>webServer.register({kind:'exact',path,handler:libraryHandler}));
    ctx.effect(() => () => { for (const dispose of disposers.splice(0)) dispose(); }, 'hanameshApps.routes');
    ctx.effect(() => async () => { for(const dispose of routerDisposers.splice(0))dispose();detachResolver();detachObserver();await routerDomain.close(); }, 'hanameshApps.router');
    ctx.effect(() => async () => { for(const dispose of libraryDisposers.splice(0))dispose();await library.close(); }, 'hanameshApps.library');
    ctx.provide('hanameshApps', host);
  } catch (error) {
    await library?.close().catch(()=>{});await libraryDomain?.close().catch(()=>{});await routerDomain?.close().catch(()=>{});
    if (initialized) await host.dispose().catch(() => {}); else await store.close().catch(() => {});
    throw error;
  }
  // Disposal order: routes go first (registered later, disposed earlier by Cordis), then the host
  // stops every owned instance and closes the domain. An attached instance is never signalled.
  ctx.effect(() => async () => { await host.dispose(); }, 'hanameshApps.dispose');
}
