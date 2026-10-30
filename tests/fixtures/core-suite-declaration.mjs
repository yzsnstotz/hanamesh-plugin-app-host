import {SUITE_INSTALL_COMMAND} from '@hanamesh/core/suite';
// Public C-CORE section D DTO fixture. This is not a Core runtime integration receipt.
export const registry='https://registry.example.test/';
export const names=['@hanamesh/core','@hanamesh/usage','@hanamesh/dsh-app-host'];
export const versions=['0.3.12','0.2.0-rc.34','0.6.5'];
const ids=['core','usage','app-host'];
const repositories=['https://github.com/yzsnstotz/hanamesh-core','https://github.com/yzsnstotz/hanamesh-usage','https://github.com/yzsnstotz/hanamesh-plugin-app-host'];
export function declaration(){return{schemaVersion:1,installCommand:SUITE_INSTALL_COMMAND,checkedAt:'2026-10-16T00:00:00.000Z',declarationId:'a'.repeat(64),manifest:{schemaVersion:1,id:'hanamesh-suite',core:{name:names[0],version:versions[0],repository:repositories[0]},components:names.slice(1).map((moduleName,i)=>({id:ids[i+1],moduleName,versionRange:'*',repository:repositories[i+1]}))},nodeVersion:'24.13.1',registry,completeness:'complete',installed:names.map((moduleName,i)=>({id:ids[i],moduleName,requiredRange:i?'*':'0.3.12',repository:repositories[i],actualVersion:versions[i],actualRepository:repositories[i],status:'satisfied',...(i===0?{runningVersion:versions[0]}:{})})),upgrades:[{coreVersion:'0.4.0',registry,manifestDigest:'b'.repeat(64),targets:names.map((moduleName,i)=>({id:ids[i],moduleName,version:['0.4.0','0.3.0','0.7.0'][i],repository:repositories[i],metadataDigest:String(i+1).repeat(64)}))}],blocked:[],peerFacts:{},metadataDigests:{}};}
export const core=value=>({protocolVersion:'1',getSuiteDeclaration:async()=>structuredClone(value)});
