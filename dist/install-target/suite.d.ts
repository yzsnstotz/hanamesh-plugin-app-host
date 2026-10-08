/** Install-target contract conformance suite (hanamesh.install-target v1). */
export interface ContractCaseResult {id:string;semantic:string;note:string;outcome:'pass'|'fail'|'skipped';detail?:string;}
export interface ContractSuiteReport {suite:'provider'|'consumer'|'chain';contract:'hanamesh.install-target';contractVersion:string;total:number;pass:number;fail:number;skipped:number;results:ContractCaseResult[];[key:string]:unknown;}
export interface InstallTargetFields {itemId?:string;packageName?:string;contractVersion?:string;}
export interface ProviderDeclaration {contract:string;contractVersion:string;supported:string[];schema?:string;}
/** A caller handing catalog identities to the market by normal navigation of its own workspace. */
export interface InstallTargetConsumer {
  name?:string;
  /** Omit for an unversioned (v1) caller; a declared version requires `handshake`. */
  contractVersion?:string;
  navigate(workspaceUrl:string,target:Record<string,unknown>):{ok:true;url:string}|{ok:false;code:string}|Promise<{ok:true;url:string}|{ok:false;code:string}>;
  handshake?(declaration:ProviderDeclaration|null):{ok:boolean;code?:string}|Promise<{ok:boolean;code?:string}>;
}
export function loadContract():Promise<{schema:Record<string,unknown>;contract:Record<string,unknown>;declaration:ProviderDeclaration;packageVersion:string;provider:unknown;consumer:unknown;catalogPath:string}>;
/** Readable violations of the given schema definition (default: the target fields). */
export function validate(schema:Record<string,unknown>,value:unknown,ref?:string):string[];
export function runProviderSuite():Promise<ContractSuiteReport>;
export function runConsumerSuite(consumer:InstallTargetConsumer):Promise<ContractSuiteReport>;
export function runChainSuite(consumer:InstallTargetConsumer):Promise<ContractSuiteReport>;
