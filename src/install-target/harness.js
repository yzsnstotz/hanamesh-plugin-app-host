/** Loads this package's real client module with a minimal hook stand-in; no production globals are modified. */
import { readFile } from 'node:fs/promises';

export const settle=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};

/** Timers only advance when asked, so market polling never runs on its own during a suite. */
function frozenClock(){let now=1_700_000_000_000,sequence=0;const timers=new Map();
  return{Date:{now:()=>now},setTimeout(fn,ms){const id=++sequence;timers.set(id,{fn,at:now+ms});return id;},clearTimeout(id){timers.delete(id);}};}

export async function loadClient({fetch:transport}){
  // Real HTTP replies arrive on later macrotasks; track them so a step completes only when the market is idle.
  let inflight=0;const fetch=async(...args)=>{inflight++;try{const response=await transport(...args),body=await response.text();return{ok:response.ok,status:response.status,json:async()=>JSON.parse(body)};}finally{inflight--;}};
  const idle=async()=>{do{await settle();await new Promise(r=>setImmediate(r));}while(inflight>0);await settle();};
  const source=await readFile(new URL('../client-ui.js',import.meta.url),'utf8');
  let loaded,tree,cursor=0,dead=false,scheduled=false;const hooks=[],pendingEffects=[],disposers=[];
  const schedule=()=>{if(!dead&&!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;if(!dead)render();});}};
  const React={createElement:(type,props,...children)=>({type,props:props??{},children}),
    useState(initial){const id=cursor++;if(!hooks[id])hooks[id]={value:typeof initial==='function'?initial():initial};return[hooks[id].value,next=>{hooks[id].value=typeof next==='function'?next(hooks[id].value):next;schedule();}];},
    useRef(initial){const id=cursor++;return hooks[id]??=({current:initial});},
    useCallback(fn,deps){const id=cursor++,old=hooks[id];if(!old||deps.some((v,i)=>v!==old.deps[i]))hooks[id]={value:fn,deps};return hooks[id].value;},
    useEffect(run,deps){const id=cursor++,old=hooks[id];if(!old||deps.some((v,i)=>v!==old.deps[i])){hooks[id]={deps,cleanup:old?.cleanup};pendingEffects.push(()=>{hooks[id].cleanup?.();hooks[id].cleanup=run();});}}};
  const listeners=new Map(),document={visibilityState:'visible',createElement:()=>({textContent:'',remove(){}}),head:{append(){}},addEventListener(){},removeEventListener(){}};
  const window={__ModuleLoader__:{load:module=>{loaded=module;}},self:{},top:{},parent:{postMessage(){}}};
  const clock=frozenClock();
  const scope={window,fetch,location:{hash:''},crypto:globalThis.crypto,console,URLSearchParams,AbortController,Date:clock.Date,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,
    addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);}};
  new Function('window','document','globalThis','setTimeout','clearTimeout','Date',source)(window,document,scope,scope.setTimeout,scope.clearTimeout,clock.Date);
  const module=loaded.factory(id=>{if(id!=='react')throw new Error('Unexpected client require: '+id);return React;});
  function render(){cursor=0;tree=module.LibraryOverlay({embedded:true});for(const effect of pendingEffects.splice(0))effect();return tree;}
  function find(node,predicate){if(!node)return;if(Array.isArray(node)){for(const child of node){const match=find(child,predicate);if(match)return match;}return;}if(typeof node!=='object')return;if(predicate(node))return node;return find(node.children,predicate);}
  module.apply({effect:run=>{disposers.push(run());},slots:{inject:(_n,run)=>run(),register:()=>()=>{}},reflect:{get:()=>undefined},provide:()=>()=>{}});
  render();await idle();
  return{module,
    text:()=>JSON.stringify(tree),
    button:label=>find(tree,node=>node.type==='button'&&node.children.includes(label)),
    async click(label){const button=find(tree,node=>node.type==='button'&&node.children.includes(label));if(!button)throw new Error('No visible button '+label);button.props.onClick();await idle();},
    idle,
    async navigate(hash){scope.location.hash=hash;listeners.get('hashchange')?.();await idle();},
    unmount(){dead=true;for(const dispose of disposers)dispose?.();for(const hook of hooks)hook?.cleanup?.();}};
}
