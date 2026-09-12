import type { InstanceRecord,OpenReceipt,OpenRequest,LeaseRequest,RecoverRequest,ViewLease,AppListing,EventPage } from './index.js';
export type BrowserInstance = Pick<InstanceRecord,'id'|'appId'|'deploymentId'|'dataId'|'mode'|'status'|'runtimeId'|'errorCode'>;
export type BrowserReceipt = Omit<OpenReceipt,'instance'> & {instance:BrowserInstance;traceId:string};
export type BrowserListing = Omit<AppListing,'instances'> & {instances:BrowserInstance[];traceId:string};
export class WorkspaceAppClient {
  constructor(options?:{origin?:string;fetch?:typeof globalThis.fetch;headers?:()=>Record<string,string>|Promise<Record<string,string>>});
  list(signal?:AbortSignal):Promise<BrowserListing>;
  open(input:OpenRequest,signal?:AbortSignal):Promise<BrowserReceipt>;
  resume(lease:LeaseRequest,signal?:AbortSignal):Promise<BrowserReceipt>;
  recoverView(input:RecoverRequest,signal?:AbortSignal):Promise<BrowserReceipt>;
  close(lease:LeaseRequest,signal?:AbortSignal):Promise<{instanceId:string;alreadyClosed:boolean;traceId:string}>;
  heartbeat(lease:LeaseRequest,signal?:AbortSignal):Promise<ViewLease & {traceId:string}>;
  stop(instanceId:string,options?:{confirm?:boolean;signal?:AbortSignal}):Promise<{instance:BrowserInstance;traceId:string}>;
  events(after?:number,signal?:AbortSignal):Promise<EventPage & {traceId:string}>;
  waitUntilReady(receipt:BrowserReceipt,options?:{timeoutMs?:number;pollMs?:number;signal?:AbortSignal}):Promise<BrowserReceipt>;
}
