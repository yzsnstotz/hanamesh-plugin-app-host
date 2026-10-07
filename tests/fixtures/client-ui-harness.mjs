/** Real client module, minimal hook lifecycle stand-in, no production process globals modified. */
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
export const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
export function fakeClock(){
  let now=1_700_000_000_000,sequence=0;const timers=new Map();
  return{now:()=>now,Date:{now:()=>now},setTimeout(fn,ms){const id=++sequence;timers.set(id,{fn,at:now+ms});return id;},clearTimeout(id){timers.delete(id);},
    async advance(ms){const end=now+ms;while(true){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;now=next[1].at;timers.delete(next[0]);next[1].fn();await settle();}now=end;await settle();},get pending(){return timers.size;}};
}
export async function clientHarness({fetch,clock,embedded=true}={}){
  const source=await readFile(new URL('../../src/client-ui.js',import.meta.url),'utf8');
  let loaded,tree,cursor=0,dead=false,scheduled=false,props={embedded};const hooks=[],pendingEffects=[];
  const schedule=()=>{if(!dead&&!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;if(!dead)render();});}};
  const React={createElement:(type,props,...children)=>({type,props:props??{},children}),
    useState(initial){const id=cursor++;if(!hooks[id])hooks[id]={value:typeof initial==='function'?initial():initial};return[hooks[id].value,next=>{hooks[id].value=typeof next==='function'?next(hooks[id].value):next;schedule();}];},
    useRef(initial){const id=cursor++;return hooks[id]??=( {current:initial} );},
    useCallback(fn,deps){const id=cursor++,old=hooks[id];if(!old||deps.some((v,i)=>v!==old.deps[i]))hooks[id]={value:fn,deps};return hooks[id].value;},
    useEffect(run,deps){const id=cursor++,old=hooks[id];if(!old||deps.some((v,i)=>v!==old.deps[i])){hooks[id]={deps,cleanup:old?.cleanup};pendingEffects.push(()=>{hooks[id].cleanup?.();hooks[id].cleanup=run();});}}};
  const listeners=new Map(),documentListeners=new Map(),document={visibilityState:'visible',createElement:()=>({textContent:'',remove(){}}),head:{append(){}},
    addEventListener(name,fn){documentListeners.set(name,fn);},removeEventListener(name,fn){if(documentListeners.get(name)===fn)documentListeners.delete(name);}};
  const window={__ModuleLoader__:{load:module=>{loaded=module;}},self:{},top:{},parent:{postMessage(){}}};
  const scope={window,fetch,location:{hash:''},crypto:globalThis.crypto,console,URLSearchParams,AbortController,
    addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);}};
  const timer=clock??{Date,setTimeout,clearTimeout};scope.Date=timer.Date;scope.setTimeout=timer.setTimeout.bind(timer);scope.clearTimeout=timer.clearTimeout.bind(timer);
  new Function('window','document','globalThis','setTimeout','clearTimeout','Date',source)(window,document,scope,scope.setTimeout,scope.clearTimeout,timer.Date);
  const module=loaded.factory(id=>{assert.equal(id,'react');return React;});
  function render(){cursor=0;tree=module.LibraryOverlay(props);for(const effect of pendingEffects.splice(0))effect();return tree;}
  function find(node,predicate){if(!node)return; if(Array.isArray(node)){for(const child of node){const match=find(child,predicate);if(match)return match;}return;}if(typeof node!=='object')return;if(predicate(node))return node;return find(node.children,predicate);}
  const api={module,render,find:predicate=>find(tree,predicate),get tree(){return tree;},async click(label){const button=find(tree,node=>node.type==='button'&&node.children.includes(label));assert(button,'visible button '+label);button.props.onClick();await settle();},
    hashchange(hash){scope.location.hash=hash;listeners.get('hashchange')?.();},
    unmount(){dead=true;for(const hook of hooks)hook?.cleanup?.();},pagehide(){listeners.get('pagehide')?.();},pageshow(){listeners.get('pageshow')?.();},
    visibility(state){document.visibilityState=state;documentListeners.get('visibilitychange')?.();},
    async show(){module.LibraryAction().props.onClick();await settle();},async hide(){const close=find(tree,node=>node.type==='button'&&node.children.includes('关闭'));assert(close);close.props.onClick();await settle();}};
  render();await settle();return api;
}
