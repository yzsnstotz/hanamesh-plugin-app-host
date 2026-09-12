import type { AppHost,AppDefinition,AuthenticatedSubject,Awaitable,DshStorageBinding } from './index.js';
export const name:'hanamesh-app-host';
export const DSH_TARGET:'0.1.5-alpha.1';
export interface DshBridge<Context=unknown,Request=unknown> {
  dshVersion:typeof DSH_TARGET;
  storage(ctx:Context):Promise<DshStorageBinding>;
  authenticate(ctx:Context,request:Request):Awaitable<AuthenticatedSubject|null>;
  authorize(ctx:Context,subject:AuthenticatedSubject,path:string,input:unknown):Awaitable<boolean>;
  mountAuthenticatedRoutes(ctx:Context,handler:(request:Request,response:unknown)=>Promise<void>):Awaitable<()=>Awaitable<void>>;
  provide(ctx:Context,name:'hanameshApps',host:AppHost):Awaitable<()=>Awaitable<void>>;
  onDispose(ctx:Context,dispose:()=>Promise<void>):void;
}
export interface DshPluginConfig { dataRoot:string; parentOrigin:string; apps:AppDefinition[]; leaseTtlMs?:number; sweepIntervalMs?:number; }
export function createDshPlugin<Context=unknown,Request=unknown>(bridge:DshBridge<Context,Request>):{name:string;apply(ctx:Context,config:DshPluginConfig):Promise<AppHost>};
/** Always rejects until a verified binding is explicitly supplied through createDshPlugin. */
export function apply():Promise<never>;
