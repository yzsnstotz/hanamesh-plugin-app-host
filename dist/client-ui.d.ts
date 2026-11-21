export const name:'hanamesh-app-host-client';
export const inject:readonly ['slots','locale'];
export function apply(ctx:unknown,options?:{verification?:boolean}):void;
export function ProvidersSection():unknown;
export function NodeRuntimeSection():unknown;
export type PackageInstallTarget =
  | {source:'npm';name:string;version:string;allowBuild:string[]}
  | {source:'github';repo:string;ref:string;path:string|null;packageName:string;allowBuild:string[]};
export interface InstallTarget {itemId?:string;packageName?:string;contractVersion?:'1';installTarget?:PackageInstallTarget;}
export interface InstallTargetReceipt {status:'confirmation-required'|'installing'|'already-installed'|'superseded';itemId?:string;packageName?:string;}
export function openInstallTarget(input:InstallTarget):Promise<InstallTargetReceipt>;

export const INSTALL_TARGET_CONTRACT_VERSION:'1';

export function SuiteSourceSettingsSection():unknown;

export function registerAppHostPages(ctx:unknown):()=>void;
export function EnvironmentContent():unknown;

export function ApplicationContent(props?:{visible?:boolean}):unknown;
export function RuntimeConfiguration(props?:{view?:'page'|'summary'}):unknown;
