import {stripVTControlCharacters} from 'node:util';
import {redact} from '../runtime.js';
import {AppHostError} from '../errors.js';

// Diagnostic context only: never replace or wrap the original installation error.
const phases=new WeakMap();
export function noteFailurePhase(error,phase){
  if(error&&typeof error==='object'&&!phases.has(error))phases.set(error,phase);
}
const field=(value,key)=>{try{return value?.[key];}catch{return undefined;}};
function clean(value,limit=1000){
  const text=typeof value==='string'?value:typeof value==='number'?String(value):'';
  return redact(stripVTControlCharacters(text))
    .replace(/(https?:\/\/)[^/\s@]+@/gi,'$1[REDACTED]@')
    .replace(/([?&][^\s&=]+)=([^\s&"'<>]*)/g,'$1=[REDACTED]')
    .replace(/((?:authorization|cookie|set-cookie)\s*["']?\s*[:=]\s*)[^\r\n]+/gi,'$1[REDACTED]')
    .slice(0,limit);
}
export function installationDiagnostic(error){
  const lines=[`Phase: ${phases.get(error)??'library operation'}`];
  let cause=error;
  for(let depth=0;cause&&depth<3;depth++){
    const name=clean(field(cause,'name'),80)||'Error';
    const message=clean(field(cause,'message')??(typeof cause==='string'?cause:''));
    const code=clean(field(cause,'code'),100);
    lines.push(`${depth?'Cause: ':''}${name}${code?` [${code}]`:''}: ${message}`);
    cause=field(cause,'cause');
  }
  // Only known installer fields, never arbitrary details/stack/response objects.
  if(error instanceof AppHostError&&error.code==='REGISTRY_LOOKUP_FAILED'&&Number.isInteger(error.details?.status))lines.push(`Registry HTTP status: ${error.details.status}`);
  if(error instanceof AppHostError&&error.code==='DSH_PLUGIN_FAILED'){
    lines.push(`CLI exit: ${Number.isInteger(error.details?.code)?error.details.code:'unknown'}; signal: ${clean(error.details?.signal,80)||'none'}`);
    lines.push(`stderr: ${clean(error.details?.stderr)||'<empty>'}`);
    if(typeof error.details?.diagnostic==='string')lines.push(`CLI output: ${clean(error.details.diagnostic,2000)}`);
  }
  return lines.join('\n').slice(0,4001);
}
