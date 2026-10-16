/**
 * DSH plugin entry for @hanamesh/dsh-app-host, using the public APIs audited in
 * official DSH 0.2.0-rc.2 and 0.2.1-alpha.2:
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
import { inferDesktopLayout, resolveLibraryLocations } from './library/locate.js';
import { createLibraryHttpHandler, LIBRARY_ROUTES } from './library/routes.js';
import { createHandoffQueue, createHandoffHandler, createHandoffListener } from './library/handoff.js';
import { detectClient } from './library/client-identity.js';
import { createUsageEvidence } from './usage-evidence.js';
import { createReceiptLedger } from './router/receipts.js';
import { receiptsDomainSpec } from './router/receipts-domain.js';
import {DSH_RANGE} from './dsh-compat.js';

export const name = 'hanamesh-app-host';
export const DSH_TARGET = DSH_RANGE;
export const inject = ['webServer', 'storageDomain', 'connection'];
/** One authenticated local browser session per profile; DSH web has no per-user principals. */
export const BROWSER_PRINCIPAL = 'dsh-browser';
/** Every route the HTTP handler answers; registered individually so nothing else is shadowed. */
export const ROUTES = Object.freeze(['/hanamesh/apps', '/apps/open', '/apps/resume', '/apps/recover',
  '/apps/close', '/apps/heartbeat', '/apps/stop', '/apps/events', '/apps/bootstrap-authorize']);

export const Config = z.object({
  /** Absolute canonical directory that owns every instance data root (secureDirectory refuses symlinks). */
  dataRoot: z.string().default(join(process.env.DSH_HOME ?? process.env.HOME ?? '.', 'data', 'hanamesh-apps')),
  /** Exact workspace origin; inferred Desktop uses dsh-app://app, plain DSH uses HTTP loopback. */
  parentOrigin: z.string(),
  /** Extra origins allowed as frame ancestors of app views — the desktop shell's own webview origin
   *  (e.g. `tauri://localhost`) when the DSH workspace itself runs inside the shell's iframe. */
  frameAncestors: z.union([z.array(z.string()),z.const(undefined)]),
  /** Standalone Node executable used for guardian/launcher processes; required under Electron. */
  nodeBinary: z.string(),
  router: z.object({ codingOauth: z.object({ mode:z.string() }) }),
  library: z.object({
    fixture:z.string(),
    /** Undefined (not configured) → the HanaMesh catalog source; an explicit `[]` → no source. schemastery would
     *  coerce a missing array to `[]`, so the union keeps "unset" distinguishable from "deliberately empty". */
    sources:z.union([z.array(z.any()),z.const(undefined)]),
    /** Locations are inferred from the verified Desktop argv/profile or plain DSH (see library/locate.js). */
    profileDir:z.string(),profileName:z.string(),dshBin:z.string(),
    registry:z.string(),allowPrerelease:z.boolean(),
    /** Publicly named event history capacity; a lost cursor reports resetRequired. */
    eventRetention:z.number().default(512),
    /** Website → client handoff listener (library/handoff.js). Unset fields use the defaults shown in the library
     *  settings page, where they can also be changed (saved values win over this config). */
    handoff:z.object({enabled:z.boolean(),ports:z.union([z.array(z.number()),z.const(undefined)]),
      allowedOrigins:z.union([z.array(z.string()),z.const(undefined)]),ttlMs:z.number(),pollMs:z.number()}),
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
  const desktop = await inferDesktopLayout();
  const transportOrigin = `http://127.0.0.1:${webServer.port}`;
  const parentOrigin = config.parentOrigin ?? desktop?.parentOrigin ?? transportOrigin;
  const frameAncestors = config.frameAncestors ?? desktop?.frameAncestors ?? [];
  const locations = await resolveLibraryLocations(config.library??{}, {nodeBinary:config.nodeBinary, desktop});
  // Pair each acquisition immediately, including partial route registration.
  // The same once-only release belongs to both failed startup and Cordis unload.
  const acquired = [];
  let closing = false, cleanupTail = Promise.resolve();
  const drain = () => {
    closing = true;
    const pending = cleanupTail.then(async () => {
      const failed = [];
      while (acquired.length) {
        const { label, release } = acquired.pop();
        try { await release(); }
        catch {
          failed.push(label);
          try { ctx.logger?.warn?.('APPHOST_CLEANUP_FAILED %s', label); } catch {}
        }
      }
      requireCondition(failed.length === 0, 'APPHOST_CLEANUP_FAILED',
        'AppHost resource cleanup failed.', { resources:failed });
    });
    cleanupTail = pending.catch(() => {});
    return pending;
  };
  // Cordis unloads separate effects concurrently. One drain preserves resource
  // dependencies, including ledger persistence and stopping before domain close.
  ctx.effect(() => drain, 'hanameshApps.dispose');
  const own = (label, action) => {
    let pending;
    const release = () => pending ??= (async () => { await action(); })();
    acquired.push({ label, release });
    // If an awaited acquisition completed after unload began, catch drains its
    // newly acquired resource too; no further activation can publish a seat.
    requireCondition(!closing, 'HOST_CLOSED', 'AppHost activation is being disposed.');
    return release;
  };
  const optional = (name, receive) => {
    const listener = ctx.inject([name], injected => {
      receive(injected.get(name)); return () => receive(undefined);
    });
    own(`listener:${name}`, () => listener.dispose());
  };
  let host, store;
  let initialized = false;
  try {
    const domain = await facility.open(appHostDomainSpec);
    const closeDomain = own('app-domain', () => domain.close());
    store = new DshDomainSnapshotStore(domainBinding({ global:domain.global, close:closeDomain }));
    host = new AppHost({ store, dataRoot, parentOrigin, frameAncestors,
      ...(locations.nodeBinary === undefined ? {} : { nodeBinary: locations.nodeBinary }),
      ...(config.leaseTtlMs === undefined ? {} : { leaseTtlMs: config.leaseTtlMs }),
      ...(config.sweepIntervalMs === undefined ? {} : { sweepIntervalMs: config.sweepIntervalMs }) });
    own('host', () => initialized ? host.dispose() : store.close());
    for (const definition of config.applications ?? []) host.register(definition);
    await host.init(); initialized = true;
    const auth = { parentOrigin, transportOrigin, ...browserAuthentication(connection) };
    const handler = createHttpHandler(host, auth);
    for (const path of ROUTES) own(`route:${path}`, webServer.register({ kind:'exact', path, handler }));
    let credentialService, llmService, oauthService, usageService, coreService;
    optional('credentials', service => { credentialService=service; });
    // Optional Usage service presence does not provide original application success facts.
    optional('hanameshUsage', service => { usageService=service; });
    optional('hanameshCore', service => { coreService=service; });
    // Router hourly counts remain local diagnostics, never synthesized Usage open/use facts.
    const receiptsDomain = await facility.open(receiptsDomainSpec);
    own('receipts-domain', () => receiptsDomain.close());
    const receipts = createReceiptLedger({ domain:receiptsDomain });
    own('receipts', () => receipts.close());
    const evidence = createUsageEvidence({ host, seat:()=>usageService, receipts, logger:ctx.logger });
    own('usage', async () => { evidence.close(); await evidence.settle(); });
    optional('llm', service => { llmService=service; });
    optional('hanameshOAuth', service => { oauthService=service; });
    const credentials = {
      describe: async ref => credentialService ? await credentialService.describe(ref) : { configured:false,writable:false },
      resolve: async ref => credentialService ? await credentialService.resolve(ref) : undefined,
      describeRecord: async key => credentialService ? await credentialService.describeRecord(key) : { configured:false,writable:false },
    };
    const routerDomain = await facility.open(routerDomainSpec);
    own('router-domain', () => routerDomain.close());
    const sources = createProviderSources({ credentials, apps:host, llm:()=>llmService,
      webOrigin:`http://127.0.0.1:${webServer.port}`, codingOauth:config.router?.codingOauth });
    const router = createRouter({ credentials, domain:routerDomain, apps:host, sources, oauth:()=>oauthService, receiptLedger:receipts,
      onInject:({ appId, instanceId, routes }) => { receipts.inject({ appId, instanceId, routes }); } });
    own('resolver', host.setCredentialResolver(router.credentialResolver));
    own('router-observer', host.subscribe(router.observe));
    const routerHandler=createRouterHttpHandler(router,auth);
    for (const path of ROUTER_ROUTES) own(`route:${path}`, webServer.register({kind:'exact',path,handler:routerHandler}));
    const libraryDomain=await facility.open(libraryDomainSpec);
    const closeLibraryDomain=own('library-domain', () => libraryDomain.close());
    // Explicit config wins; infer only proven process/profile locations.
    const libraryConfig={...(config.library??{}),sources:locations.sources,profileDir:locations.profileDir,profileName:locations.profileName};
    if(locations.inferred.length&&typeof ctx.logger?.info==='function')ctx.logger.info('hanamesh-app-host library: inferred %s',JSON.stringify(Object.fromEntries(
      locations.inferred.map(key=>[key,key==='sources'?locations.sources.map(source=>source.manifestUrl):locations[key]]))));
    // Exact-save capability comes from the host's public package metadata. Older managers use the public CLI
    // for installs and preserve restart-required; applications and compensation also use that CLI.
    let pluginManager;
    optional('pluginManager', service => { pluginManager=service; });
    let dshBin=locations.dshBin;
    if(!dshBin&&locations.profileDir&&!desktop)try{dshBin=createRequire(join(locations.profileDir,'package.json')).resolve('@deepseek-ai/dsh/lib/bin.js');}catch{dshBin=undefined;}
    const cliUsable=Boolean(locations.desktopLauncher||locations.nodeBinary&&dshBin&&(!desktop||locations.desktopCli||config.library?.dshBin));
    let provisionApi,installer;
    if(locations.profileDir&&locations.profileName){
      provisionApi=await import('@hanamesh/lib-provision');
      installer=createLibraryInstaller({profileDir:locations.profileDir,profileName:locations.profileName,dataRoot,
        ...(cliUsable?{nodeBinary:locations.nodeBinary,dshBin,desktopCli:locations.desktopCli,desktopLauncher:locations.desktopLauncher}:{}),pluginManagerVersion:locations.pluginManagerVersion,
        registry:libraryConfig.registry,allowPrerelease:libraryConfig.allowPrerelease,provision:provisionApi.provision,remove:provisionApi.remove,ledger:provisionApi.ledger,
        coreService:()=>coreService,pluginManager:()=>pluginManager,emit:event=>library?.emit(event)});
    }
    /** What a person must do so the library can install, in their words (C-MARKET probe `error.need`). */
    const unavailable=()=>{
      if(!locations.profileDir)return[{need:'找不到这个 DSH profile 的目录',how:'用 dsh plugin --profile <名字> add 安装 HanaMesh 应用库，或在插件设置 library.profileDir 里填 profile 目录'}];
      if(installer?.ready)return[];
      if(installer?.unavailable?.length)return installer.unavailable;
      const rows=[];
      if(!locations.nodeBinary)rows.push({need:'找不到能运行 DSH 命令行的 Node',how:desktop?'桌面版的运行时缺少 Node：重新安装客户端':'在插件设置 nodeBinary 里填 Node 的绝对路径'});
      if(!dshBin||(desktop&&!locations.desktopCli&&!config.library?.dshBin))rows.push({need:'找不到可在受控进程中运行的 DSH 命令行',how:'恢复客户端随附的公开 dsh 命令启动器，或在插件设置 library.dshBin 里填 dsh 的 lib/bin.js'});
      return rows;
    };
    const identity=await detectClient({desktop});
    if(typeof ctx.logger?.info==='function')ctx.logger.info('hanamesh-app-host library: client %s (%s)',identity.client,identity.evidence);
    const library=createLibraryService({domain:{global:libraryDomain.global,close:closeLibraryDomain},host,config:libraryConfig,dataRoot,ledgerReader:provisionApi?.ledger??(async()=>({schema:1,items:{}})),installer,client:identity.client,unavailable,logger:ctx.logger});
    own('library', () => library.close());
    await library.init();
    // rc.27: app bundles register plain `app.json` (no package name); the installed scan knows which npm package ships
    // which appId, and that package name is the usage-evidence `hanaRef`. Scan failure only costs evidence, never startup.
    try { for (const row of await library.installed()) if (row.appId && row.packageName) { try { host.bindPackageName(row.appId,row.packageName); } catch (error) { ctx.logger?.warn?.('hanamesh-app-host usage: %s not bound to %s (%s)', row.appId, row.packageName, error?.code ?? error?.message); } } }
    catch (error) { if (typeof ctx.logger?.debug === 'function') ctx.logger.debug('hanamesh-app-host usage: installed scan unavailable (%s)', error?.code ?? error?.message); }
    const queue=createHandoffQueue({ttlMs:()=>library.handoffSettings().ttlMs,onError:(message,error)=>ctx.logger?.warn?.('%s: %s',message,error?.message??error)});
    own('handoff-observer', library.observe(event=>queue.observe(event)));
    const listener=createHandoffListener({settings:()=>library.handoffSettings(),logger:ctx.logger,
      handlerFor:port=>createHandoffHandler({library,queue,settings:()=>library.handoffSettings(),port})});
    own('handoff-listener', () => listener.stop());
    await listener.start();
    const libraryHandler=createLibraryHttpHandler(library,{...auth,handoff:{queue,listener,restart:()=>listener.start()}});
    for (const path of LIBRARY_ROUTES) own(`route:${path}`, webServer.register({kind:'exact',path,handler:libraryHandler}));
    own('seat', ctx.provide('hanameshApps', host));
  } catch (error) {
    // Cleanup names failures without replacing the original activation error.
    await drain().catch(() => {});
    throw error;
  }
}
