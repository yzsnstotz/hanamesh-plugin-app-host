/**
 * Consumer fixture for the install-target contract: a caller that hands a catalog identity to the market by normal
 * navigation of its own authenticated workspace. Every rule is read from the shipped schema, not restated here.
 * This is a test fixture for conformance runs, not a product encoding API.
 */
import { readFile } from 'node:fs/promises';
import { validate } from '../suite.js';

const schema=JSON.parse(await readFile(new URL('../../../schemas/install-target.schema.json',import.meta.url),'utf8'));
const contract=schema['x-hanamesh-contract'];

/** @param {{contractVersion?:string}} [options] Omit contractVersion for an unversioned (v1) caller. */
export function createReferenceConsumer(options={}){
  const contractVersion='contractVersion' in options?options.contractVersion:contract.version;
  if(contractVersion!==undefined&&!contract.supported.includes(contractVersion))throw new Error('Unsupported install-target contract version '+JSON.stringify(contractVersion));
  return{
    name:'reference-consumer'+(contractVersion===undefined?'-unversioned':'-v'+contractVersion),
    contractVersion,
    navigate(workspaceUrl,target){
      const fields={...target,...(contractVersion===undefined?{}:{contractVersion})};
      if(validate(schema,fields).length)return{ok:false,code:'INVALID_INSTALL_TARGET'};
      const url=new URL(workspaceUrl);url.hash=contract.fragmentPrefix.slice(1)+new URLSearchParams(fields);
      return{ok:true,url:url.href};
    },
    /** rc.10: present a library.install-failed event; only a schema-valid restored/not-needed recovery counts as restored. */
    presentInstallFailure(event){
      const recovery=event?.recovery,known=recovery&&!validate(schema,recovery,'#/$defs/recovery').length;
      if(!known)return{installed:false,restored:false,code:event?.code,text:`安装失败：${event?.code}；恢复结果未知`};
      const restored=recovery.status==='restored'||recovery.status==='not-needed',residue=recovery.residue.map(row=>row.item);
      return{installed:false,restored,code:event.code,residue,...(restored&&recovery.mode==='upgrade'?{version:recovery.previousVersion}:{}),
        text:restored?`安装失败：${event.code}；已恢复${recovery.mode==='upgrade'?'到原版本 '+recovery.previousVersion:'到安装前状态'}`:`安装失败：${event.code}；恢复失败，未恢复：${residue.join('、')}`};
    },
    handshake(declaration){
      const compatible=declaration&&!validate(schema,declaration,'#/$defs/providerDeclaration').length&&declaration.contract===contract.name&&declaration.supported.includes(contractVersion);
      return compatible?{ok:true}:{ok:false,code:'CONTRACT_VERSION_UNSUPPORTED'};
    }};
}
