/** Advertised metadata only. Discovery performs no installation read. */
export const INSTALLATION_STATUS_CAPABILITY:Readonly<{contract:'hanamesh.installation-status';contractVersion:'1';path:'/hanamesh/library/installation-status'}>;
export interface InstallationReaderConfig {
 /** Absolute official executable and explicitly selected user/config directories. Never supplied by a website. */
 executable:string;home:string;configDir:string;
 /** Identity and exact HTTPS marketplace URL from the registered AgentPluginDTO. */
 pluginName:string;marketplace:string;marketplaceUrl:string;
 /** Required positive bounded operation budgets. No product default is inferred. */
 timeoutMs:number;maxOutputBytes:number;
}
export interface InstallationStatusRequest {contractVersion:'1';consent:'read-installations'}
export interface InstallationObservation {
 channel:'hanamesh'|'dsh'|'claude'|'codex';
 scope:{id:'current-runtime'|'other-runtime'|'agent-cli'|'desktop-app';kind:'responding-runtime'|'unobserved-runtime'|'official-user-profile'|'desktop-app';label:string};
 status:'installed'|'not-installed'|'incomplete'|'unknown';version:string|null;versionKind:'core'|'agent-distribution';
 components:readonly {name:string;version:string|null;active?:boolean;status?:string}[];
 identity:{pluginName:string;marketplace:string}|null;
 reason:{code:string;message:string;action:string}|null;
 blocked?:readonly {code:string;moduleName?:string}[];
}
export interface InstallationStatus {schemaVersion:1;client:'hanamesh'|'dsh';checkedAt:string;observations:readonly InstallationObservation[];traceId?:string}
