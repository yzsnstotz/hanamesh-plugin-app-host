/** AppHost owns application runtimes, never plugin package installation or a market inventory. */
import {join} from 'node:path';
import {scanInstalled} from './application-inventory.js';
import {SerialQueue,requireCondition} from './errors.js';
import {clearGeneratedRuntimeCache} from './runtime-cleanup.js';
export function createApplicationRuntime({host,profileDir,dataRoot,ledgerReader,provision,remove}){
 const writer=new SerialQueue();let running=0;
 const installed=()=>profileDir?scanInstalled({profileDir,host,ledgerReader,dataRoot}):Promise.resolve([]);
 async function declared(input){requireCondition(input&&typeof input==='object'&&Object.keys(input).every(key=>['appId','packageName','runtimeItem','confirm'].includes(key))&&typeof input.appId==='string'&&typeof input.packageName==='string'&&typeof input.runtimeItem==='string','INVALID_INPUT','Application identity, package and declared runtime item are required.');const row=(await installed()).find(row=>row.appId===input.appId&&row.packageName===input.packageName);requireCondition(row?.definition,'APP_PACKAGE_MISSING','The installed application declaration is unavailable.',{},404);const runtime=row.definition.deployments.map(value=>value.runtime).find(value=>value?.item===input.runtimeItem);requireCondition(runtime,'RUNTIME_NOT_DECLARED','The requested runtime is not declared by this application.');return{row,runtime};}
 return{
  installed,
  get busy(){return running>0;},
  async provision(input){return writer.run(async()=>{const{runtime}=await declared(input);running++;try{const result=await provision(runtime.manifest,{root:join(dataRoot,'runtimes',input.appId),only:[runtime.item]});return{appId:input.appId,status:'provisioned',result};}finally{running--;}});},
  async remove(input){return writer.run(async()=>{requireCondition(input?.confirm===true,'CONFIRMATION_REQUIRED','Confirm application runtime removal.',{},403);await declared(input);requireCondition(!host.instanceList().some(row=>row.appId===input.appId&&!['stopped','failed','interrupted'].includes(row.status)),'INSTANCE_IN_USE','Close all application views before removing its runtime.',{},409);running++;try{const root=join(dataRoot,'runtimes',input.appId),result=await remove(input.runtimeItem,{root});await clearGeneratedRuntimeCache(result,root);return{appId:input.appId,status:'runtime-removed',dataPreserved:true};}finally{running--;}});},
  close:()=>writer.drained(),
 };
}
