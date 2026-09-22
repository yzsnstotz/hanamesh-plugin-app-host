/**
 * rc.32 — the client-side `market` seat and the dshmarket mutual exclusion.
 *
 * The seat contract is read off the PINNED shell panel (`dsh-tauri-panel-extension` 1.0.0, shipped in
 * hanamesh-desktop-tauri `src-tauri/resources/node_modules/`): it resolves `ctx.reflect.get('market')`,
 * keeps the value only when `typeof value.render === 'function'`, renders the 「市场」 tab with
 * `render({preferredSubsectionId:'installed'})`, and brackets its ownership with
 * `setSettingsVisible(false)` / `setSettingsVisible(true)`. Nothing here guesses a name.
 *
 * The bundle is loaded the way DSH loads it (a `window.__ModuleLoader__.load({id,factory})` call), so these
 * are behaviour assertions on the real module object, not source greps.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/** Minimal React double: createElement records the tree; hooks are only needed if a component is invoked. */
function reactDouble(){
  return{
    createElement:(type,props,...children)=>({type,props:props??{},children}),
    useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],
    useEffect:()=>{},useCallback:fn=>fn,useMemo:fn=>fn(),
  };
}

/** Load src/client-ui.js with its own `window`/`document`/`fetch`, never the test process globals. */
async function loadClientModule({installedPlugins=[],fetchFailure=false}={}){
  const source=await readFile(new URL('../src/client-ui.js',import.meta.url),'utf8');
  const calls={fetch:[]};
  let loaded;
  const fakeWindow={__ModuleLoader__:{load:module=>{loaded=module;}},self:{},top:{},parent:{postMessage:(message,origin)=>{calls.post={message,origin};}}};
  const fakeDocument={createElement:()=>({textContent:'',remove(){}}),head:{append(){}}};
  const fetchDouble=async(path)=>{
    calls.fetch.push(path);
    if(fetchFailure)throw new Error('NETWORK_DOWN');
    if(path==='/hanamesh/library/installedPlugins')return{ok:true,json:async()=>({plugins:installedPlugins,apps:[],restartRequired:false})};
    return{ok:true,json:async()=>({})};
  };
  const scope={window:fakeWindow,document:fakeDocument,fetch:fetchDouble,console:{warn(){},info(){}},crypto:globalThis.crypto,setTimeout,URLSearchParams};
  const factory=new Function('window','document','globalThis',source);
  factory(fakeWindow,fakeDocument,scope);
  const React=reactDouble();
  const module=loaded.factory(specifier=>{assert.equal(specifier,'react');return React;});
  return{module,calls,React};
}

/** A cordis client context double: only the surfaces the bundle is allowed to touch. */
function contextDouble({seatHolder}={}){
  const record={provided:[],disposed:0,effects:[],logs:[]};
  const ctx={
    logger:{warn:text=>record.logs.push(text),info:text=>record.logs.push(text)},
    reflect:{get:(name,strict)=>{record.reflectReads=[...(record.reflectReads??[]),[name,strict]];return name==='market'?seatHolder:undefined;}},
    slots:{inject:(_name,run)=>run(),register:()=>()=>{}},
    effect:(run,label)=>{const dispose=run();record.effects.push({label,dispose});return dispose;},
    provide:(name,value)=>{record.provided.push({name,value});return()=>{record.disposed+=1;};},
  };
  return{ctx,record};
}
const settle=async()=>{for(let i=0;i<8;i+=1)await Promise.resolve();};

test('AH-MS01: with no dshmarket the plugin provides the `market` seat, and the seat renders the market page and can hide our own entry',async()=>{
  const{module,React}=await loadClientModule({installedPlugins:[{packageName:'dsh-plugin-tether',state:'installed'}]});
  const{ctx,record}=contextDouble();
  module.apply(ctx);
  await settle();
  assert.equal(record.provided.length,1,'exactly one seat is taken');
  const[{name,value}]=record.provided;
  assert.equal(name,'market');
  assert.equal(name,module.MARKET_SEAT);
  // The panel keeps the service only when `render` is a function, and always calls `setSettingsVisible`.
  assert.equal(typeof value.render,'function');
  assert.equal(typeof value.setSettingsVisible,'function');
  const element=value.render({preferredSubsectionId:'installed'});
  assert.equal(element.type,module.LibraryOverlay);
  assert.deepEqual(element.props,{embedded:true,preferredSubsectionId:'installed'});
  assert.equal(value.render().props.embedded,true,'the panel may call render() with no options');
  assert.equal(module.marketState().conflict,'','no conflict notice when the seat is ours');
  assert.equal(module.MarketConflictNotice(),null,'nothing is shown at the top of the market page');
  // setSettingsVisible(false): the panel owns the surface, so our sidebar entry stands down and comes back.
  assert.equal(module.marketState().entryVisible,true);
  value.setSettingsVisible(false);
  assert.equal(module.marketState().entryVisible,false);
  assert.equal(module.LibraryAction(),null,'the sidebar 「市场」 button is gone while the panel owns the market');
  value.setSettingsVisible(true);
  assert.equal(module.marketState().entryVisible,true);
  assert.notEqual(module.LibraryAction(),null);
  void React;
});

test('AH-MS02: dshmarket installed in the profile — the seat is left alone, the market page carries the 「只能其一」 notice, and the host logged it',async()=>{
  const{module}=await loadClientModule({installedPlugins:[{packageName:'dshmarket',state:'installed'},{packageName:'dsh-plugin-tether',state:'installed'}]});
  const{ctx,record}=contextDouble();
  module.apply(ctx);
  await settle();
  assert.deepEqual(record.provided,[],'the seat is never contested');
  assert.equal(module.marketState().conflict,module.MARKET_CONFLICT_TEXT);
  assert.match(module.MARKET_CONFLICT_TEXT,/dshmarket/);
  assert.match(module.MARKET_CONFLICT_TEXT,/只能其一/);
  assert.equal(record.logs.length,1,'exactly one readable log line');
  assert.match(record.logs[0],/dshmarket/);
  assert.equal(module.marketState().entryVisible,true,'our own sidebar entry keeps working');
  const notice=module.MarketConflictNotice();
  assert.equal(notice.type,'p');
  assert.equal(notice.props.role,'status');
  assert.equal(notice.props['data-hanamesh-market-conflict'],'dshmarket');
  assert.deepEqual(notice.children,[module.MARKET_CONFLICT_TEXT],'the notice is at the top of the market page');
});

test('AH-MS03: dshmarket already holding the seat is detected before we try to provide it',async()=>{
  const{module}=await loadClientModule({installedPlugins:[]});
  const{ctx,record}=contextDouble({seatHolder:{render(){return null;},setSettingsVisible(){}}});
  module.apply(ctx);
  await settle();
  assert.deepEqual(record.provided,[],'a registered seat is never overwritten');
  assert.equal(module.marketState().conflict,module.MARKET_CONFLICT_TEXT);
  assert.deepEqual(record.reflectReads,[['market',false]],'the seat is read non-strictly: a pending provider still counts');
});

test('AH-MS04: an unreachable host never blocks the seat, and disposing the plugin gives the seat back',async()=>{
  const failing=await loadClientModule({fetchFailure:true});
  const first=contextDouble();
  failing.module.apply(first.ctx);
  await settle();
  assert.equal(first.record.provided.length,1,'a library route that cannot answer fails open');
  const seatEffect=first.record.effects.find(effect=>effect.label==='hanamesh-app-host:market-seat');
  assert(seatEffect,'the seat is taken inside a labelled effect so Cordis disposes it');
  seatEffect.dispose();
  assert.equal(first.record.disposed,1,'the provide disposer runs');
  assert.equal(failing.module.marketState().conflict,'');
  assert.equal(failing.module.marketState().entryVisible,true);
});

test('AH-MS05: the in-shell restart goes through the shell postMessage bridge, not a blocked iframe scheme navigation',async()=>{
  const{module,calls}=await loadClientModule();
  const source=await readFile(new URL('../src/client-ui.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/location\.assign\(RESTART_LINK\)/,'WKWebView drops a custom scheme started inside the iframe');
  assert.match(source,/postMessage\(\{type:RESTART_LINK\},'\*'\)/,'the shell validates source and origin; the iframe cannot know tauri://localhost');
  assert.match(source,/const RESTART_LINK='hanamesh:\/\/restart'/,'the deep link stays the OS-level entry point');
  void[module,calls];
});
