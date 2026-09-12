import { AppHost } from './manager.js';
import { DshDomainSnapshotStore } from './store.js';
import { createHttpHandler } from './routes.js';
import { requireCondition } from './errors.js';
export const name='hanamesh-app-host';
export const DSH_TARGET='0.1.5-alpha.1';
/**
 * Integration factory, NOT a guessed call to ctx.storageDomain.open()/ctx.webServer.register().
 * The missing pinned API binding is explicit and startup fails closed without it.
 */
export function createDshPlugin(bridge){
  requireCondition(bridge?.dshVersion===DSH_TARGET && typeof bridge.storage==='function' &&
    typeof bridge.mountAuthenticatedRoutes==='function' && typeof bridge.onDispose==='function' &&
    typeof bridge.provide==='function' && typeof bridge.authenticate==='function' && typeof bridge.authorize==='function','DSH_BINDING_REQUIRED',
    'Provide verified DSH 0.1.5-alpha.1 public-API bindings before enabling this plugin.');
  return {name,async apply(ctx,config){
    const store=new DshDomainSnapshotStore(await bridge.storage(ctx));
    const host=new AppHost({store,dataRoot:config.dataRoot,parentOrigin:config.parentOrigin,
      leaseTtlMs:config.leaseTtlMs,sweepIntervalMs:config.sweepIntervalMs});
    for(const definition of config.apps??[])host.register(definition);
    await host.init();
    let unmount,unprovide;
    try{
      const handler=createHttpHandler(host,{parentOrigin:config.parentOrigin,
        authenticate:request=>bridge.authenticate(ctx,request),
        authorize:(subject,path,input)=>bridge.authorize(ctx,subject,path,input)});
      unmount=await bridge.mountAuthenticatedRoutes(ctx,handler);
      unprovide=await bridge.provide(ctx,'hanameshApps',host);
      bridge.onDispose(ctx,async()=>{await unmount?.();await host.dispose();await unprovide?.();});
      return host;
    }catch(error){await unmount?.();await host.dispose();await unprovide?.();throw error;}
  }};
}
export async function apply(){
  requireCondition(false,'DSH_BINDING_REQUIRED','This release candidate needs the verified profile bridge; see docs/DSH_INTEGRATION.md.');
}
