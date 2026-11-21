/** Install-target contract conformance suite (hanamesh.install-target v1). */
export interface ContractCaseResult {id:string;semantic:string;note:string;outcome:'pass'|'fail'|'skipped';detail?:string;}
export interface ContractSuiteReport {suite:'provider';contract:'hanamesh.install-target';contractVersion:string;total:number;pass:number;fail:number;skipped:number;results:ContractCaseResult[];[key:string]:unknown;}
import type {PackageInstallTarget} from '../client-ui.js';
export interface InstallTargetFields {itemId?:string;packageName?:string;contractVersion?:string;installTarget?:PackageInstallTarget;}
export interface ProviderDeclaration {contract:string;contractVersion:string;supported:string[];schema?:string;}
export function loadContract():Promise<{schema:Record<string,unknown>;contract:Record<string,unknown>;declaration:ProviderDeclaration;packageVersion:string;provider:unknown;catalogPath:string}>;
/** Readable violations of the given schema definition (default: the target fields). */
export function validate(schema:Record<string,unknown>,value:unknown,ref?:string):string[];
export function runProviderSuite():Promise<ContractSuiteReport>;
