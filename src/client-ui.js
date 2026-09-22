/* Browser bundle for DSH client-modules. The Node condition of exports["./client"] remains the SDK. */
window.__ModuleLoader__.load({id:'@hanamesh/dsh-app-host',factory:function(require){'use strict';
  const React=require('react');
  const h=React.createElement;
  const request=async(path,init={})=>{
    const response=await globalThis.fetch.bind(globalThis)(path,{...init,headers:{'x-hanamesh-client':'workspace-v1',...(init.body?{'content-type':'application/json'}:{}),...init.headers}});
    const value=await response.json();if(!response.ok)throw new Error(value?.error?.code??`HTTP_${response.status}`);return value;
  };
  const entryId=entry=>entry.projection==='file'?`file:${entry.base??'home'}:${entry.path}`:`env:${entry.env}`;
  function ProvidersSection(){
    const[providers,setProviders]=React.useState([]),[apps,setApps]=React.useState([]),[plans,setPlans]=React.useState({}),[error,setError]=React.useState('');
    const load=React.useCallback(async()=>{try{setError('');const[p,a]=await Promise.all([request('/hanamesh/router/providers'),request('/hanamesh/apps')]);
      setProviders(p.providers??[]);setApps(a.apps??[]);const rows=await Promise.all((a.apps??[]).map(async app=>[app.id,await request('/hanamesh/router/plan?appId='+encodeURIComponent(app.id))]));setPlans(Object.fromEntries(rows));}catch(e){setError(String(e.message??e));}},[]);
    React.useEffect(()=>{void load();},[load]);
    const mutate=async(path,body)=>{try{setError('');await request(path,{method:'POST',body:JSON.stringify(body)});await load();}catch(e){setError(String(e.message??e));}};
    const sourceRows=providers.map(provider=>h('tr',{key:provider.id},h('td',null,provider.displayName),h('td',null,provider.source),h('td',null,provider.state),h('td',null,provider.keyHint??'—'),h('td',null,(provider.models??[]).join('、')||'—')));
    const stateText={auto:'自动',granted:'手动指定',missing:'无可用供应商',revoked:'已停用','app-owned':'应用自管'};
    const subjectText=item=>item.granted?(item.granted.kind==='provider'?item.granted.providerId:item.granted.ref??item.granted.key):'—';
    const acceptable=entry=>providers.find(p=>p.state==='configured'&&(!entry.providers?.length||entry.providers.includes(p.id)||(p.id==='coding-oauth-gateway'&&entry.providers.includes('openai'))));
    // One compact table for every app: app × slot → routed provider. Scales to many apps; no per-app card, no manual picker.
    const routeRows=apps.flatMap(app=>{const plan=plans[app.id];if(!plan)return[];const slots=(plan.items??[]).filter(item=>!item.derived);return slots.map((item,index)=>{const id=entryId(item.entry);
      const routed=item.state==='auto'||item.state==='granted',current=item.model??'',options=[...new Set([...(item.models??[]),...(current?[current]:[])])];
      const modelCell=!routed?'—':options.length?h('select',{value:current,onChange:e=>void mutate('/hanamesh/router/model',{appId:app.id,entryId:id,model:e.target.value})},h('option',{value:''},item.defaultModel?`应用默认（${item.defaultModel}）`:'应用默认'),...options.map(m=>h('option',{key:m,value:m},m))):
        h('input',{type:'text',defaultValue:current,placeholder:item.defaultModel?`应用默认（${item.defaultModel}）`:'应用默认',onBlur:e=>{if(e.target.value.trim()!==current)void mutate('/hanamesh/router/model',{appId:app.id,entryId:id,model:e.target.value.trim()});}});
      return h('tr',{key:`${app.id}:${id}`},index===0?h('td',{rowSpan:slots.length},app.name):null,h('td',null,item.entry.env??item.entry.path),h('td',null,item.entry.purpose??'—'),h('td',null,subjectText(item)),h('td',null,modelCell),h('td',null,stateText[item.state]??item.state),
        h('td',null,item.state==='revoked'?h('button',{type:'button',onClick:()=>{const provider=acceptable(item.entry);if(provider)void mutate('/hanamesh/router/grant',{appId:app.id,entryId:id,subject:provider.ref?{kind:'api-key',ref:provider.ref}:{kind:'provider',providerId:provider.id}});}},'恢复'):
          (item.state==='auto'||item.state==='granted')?h('button',{type:'button',onClick:()=>void mutate('/hanamesh/router/revoke',{appId:app.id,entryId:id})},'停用'):null));});});
    return h('section',{className:'hm-providers'},h('h2',null,'供应商'),h('p',null,'这里只显示来源、状态、提示与模型，不读取或展示密钥值。'),error?h('p',{role:'alert'},error):null,
      h('table',null,h('thead',null,h('tr',null,...['名称','来源','状态','Key 提示','模型'].map(label=>h('th',{key:label},label)))),h('tbody',null,...sourceRows)),
      h('p',{className:'hm-provider-hint'},'来源的开关在各自的地方：API key 在 DSH「Models」，Coding OAuth 本地网关在该插件自己的设置页（DSH 对话不需要它，只有按 OpenAI API 说话的应用需要）。'),
      h('h3',null,'路由'),
      h('p',{className:'hm-provider-hint'},'自动：profile 里已配置、且应用声明接受的供应商在应用启动时直接注入；模型随路由一起在这里选（留「应用默认」则用应用清单里的默认值）。「停用」让某一槽位退出自动路由。'),
      routeRows.length?h('table',null,h('thead',null,h('tr',null,...['应用','槽位','用途','供应商','模型','状态',''].map((label,index)=>h('th',{key:index},label)))),h('tbody',null,...routeRows)):h('p',{className:'hm-provider-hint'},'还没有安装任何声明了供应商槽位的应用。'));
  }
  let libraryVisible=false;const libraryListeners=new Set();
  const setLibraryVisible=value=>{libraryVisible=value;for(const listener of libraryListeners)listener(value);};
  // rc.32 market seat. The shell's Extension Management panel (dsh-tauri-panel-extension) reads the client-side
  // cordis service `market` via `ctx.reflect.get('market')` and shows a 「市场」 tab when it is there; it calls
  // `render({preferredSubsectionId})` for the tab body and `setSettingsVisible(false)` while it owns the surface
  // (restored to `true` on dispose). Only one plugin can hold the seat — dshmarket provides the same one.
  const MARKET_SEAT='market',DSHMARKET_PACKAGE='dshmarket';
  const MARKET_CONFLICT_TEXT='检测到 DSH Market（dshmarket）：「扩展管理」的市场标签只能由一个插件提供，这次没有由 HanaMesh 市场接管。两者只能其一——要用 HanaMesh 市场请先卸载 dshmarket 并重启 DSH；要用 dshmarket 就从下方侧栏的「市场」入口使用 HanaMesh 市场。';
  let marketConflict='';const conflictListeners=new Set();
  const setMarketConflict=value=>{marketConflict=value;for(const listener of conflictListeners)listener(value);};
  // The seat owner asks us to stand down our own entry points while it renders the market itself.
  let entryVisible=true;const entryListeners=new Set();
  const setEntryVisible=value=>{entryVisible=value;if(!value)setLibraryVisible(false);for(const listener of entryListeners)listener(value);};
  function MarketConflictNotice(){
    const[text,setText]=React.useState(marketConflict);
    React.useEffect(()=>{conflictListeners.add(setText);return()=>conflictListeners.delete(setText);},[]);
    if(!text)return null;
    return h('p',{role:'status',className:'hm-market-conflict','data-hanamesh-market-conflict':DSHMARKET_PACKAGE},text);
  }
  function LibraryAction(){
    const[shown,setShown]=React.useState(entryVisible);
    React.useEffect(()=>{entryListeners.add(setShown);return()=>entryListeners.delete(setShown);},[]);
    if(!shown)return null;
    return h('button',{type:'button',className:'hm-library-action',onClick:()=>setLibraryVisible(true)},'市场');
  }
  function LibrarySourcesSection(){
    const[sources,setSources]=React.useState([]),[draft,setDraft]=React.useState(''),[error,setError]=React.useState('');
    const load=React.useCallback(async()=>{try{const value=await request('/hanamesh/library/sources');setSources(value.sources??[]);setError('');}catch(e){setError(String(e.message??e));}},[]);
    React.useEffect(()=>{void load();},[load]);
    const save=async next=>{try{await request('/hanamesh/library/sources',{method:'POST',body:JSON.stringify({sources:next})});await load();}catch(e){setError(String(e.message??e));}};
    const move=(index,delta)=>{const next=[...sources],target=index+delta;if(target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];void save(next);};
    return h('section',{className:'hm-library-sources'},h('h2',null,'市场目录源'),h('p',null,'可保存多个来源，但浏览时只启用一个。'),error?h('p',{role:'alert'},error):null,
      ...sources.map((source,index)=>h('div',{className:'hm-source-row',key:source.manifestUrl},h('code',null,source.manifestUrl),h('button',{type:'button',disabled:source.enabled,onClick:()=>void save(sources.map((row,i)=>({...row,enabled:i===index})))},source.enabled?'已启用':'启用'),h('button',{type:'button',onClick:()=>move(index,-1)},'上移'),h('button',{type:'button',onClick:()=>move(index,1)},'下移'),h('button',{type:'button',onClick:()=>void save(sources.filter((_,i)=>i!==index))},'删除'))),
      h('div',{className:'hm-source-add'},h('input',{value:draft,placeholder:'https://…/catalog-source.json',onChange:event=>setDraft(event.target.value)}),h('button',{type:'button',onClick:()=>{if(draft)void save([...sources.map(row=>({...row,enabled:false})),{manifestUrl:draft,enabled:true}]);setDraft('');}},'添加并启用')));
  }
  const FAILURE_REASONS={REGISTRY_LOOKUP_FAILED:'包不在当前 registry 上——尚未发布到 npm，或客户端 registry 设置不对',DSH_PLUGIN_FAILED:'DSH 安装命令失败，查看宿主日志',LIBRARY_INSTALL_UNAVAILABLE:'当前宿主未提供安装参数（profile / node 路径）',CATALOG_ITEM_MISSING:'目录里已没有这一项，刷新后重试',UNSTABLE_VERSION:'registry 上的最新版是预发布版（rc），客户端未允许安装预发布版',RUNTIME_ARCHIVE_UNAVAILABLE:'运行时归档下载失败，检查网络或来源',OPERATION_TIMEOUT:'10 分钟内没有结果，可稍后重试',PACKAGE_DENIED:'HanaMesh 套件自身不能从市场安装或卸载',INSTANCE_IN_USE:'先关闭该应用的所有视图再卸载'};
  const failureReason=code=>FAILURE_REASONS[code]??'详细原因见宿主日志';
  // rc.28 market: fixed filters first (everything / applications / plugins), then every category the catalog itself reported.
  const BASE_FILTERS=[['','全部'],['hanamesh-app','应用'],['plugin','插件']];
  const KIND_TEXT={application:'应用',plugin:'插件',listing:'仅收录'};
  const STATE_TEXT={registered:'已安装',installed:'已安装','installed-not-loaded':'需重启','uninstalled-not-unloaded':'已卸载 · 需重启','runtime-missing':'缺运行时',invalid:'包无效'};
  // The desktop shell hosts DSH inside its own webview frame and owns the `hanamesh://` scheme; official DSH in a plain browser has no frame.
  const inShell=()=>{try{return globalThis.window.self!==globalThis.window.top;}catch{return true;}};
  const RESTART_LINK='hanamesh://restart';
  // rc.32: WKWebView never hands a custom-scheme navigation started inside the DSH iframe to the OS, so the
  // deep link alone cannot reach the shell from here. The shell already listens for `hanamesh://…` messages on
  // its inbound iframe bridge (the same namespace as `hanamesh://bound-refresh`), so in-shell we post
  // `hanamesh://restart` to the parent and the shell calls its own restart. The `hanamesh://restart` URL stays
  // the OS-level entry (an external browser or `open hanamesh://restart`), handled in the shell's deep_link.rs.
  const requestRestart=()=>{try{globalThis.window.parent.postMessage({type:RESTART_LINK},'*');}catch{}};
  // Mirrors PROTECTED_PACKAGES on the host: the suite is never offered an uninstall button (the host answers 403 anyway).
  const PROTECTED=new Set(['@hanamesh/dsh-app-host','hanamesh-core','hanamesh-usage']);
  function RestartNotice({reason}){
    const shell=inShell();
    return h('p',{role:'status',className:'hm-restart-notice','data-hanamesh-restart':'required'},h('strong',null,'需重启 DSH'),' ',reason??'插件更改在 DSH 重启后生效。',' ',
      shell?h('a',{href:RESTART_LINK,className:'hm-restart-link',onClick:event=>{event.preventDefault();requestRestart();}},'重启 DSH'):h('span',{className:'hm-restart-hint'},'请手动重启 DSH。'));
  }
  // rc.32: the same market page serves two surfaces — the shell overlay behind the sidebar 「市场」 button
  // (`embedded` false) and the Extension Management 「市场」 tab through the `market` seat (`embedded` true,
  // always visible, no close button, `preferredSubsectionId` decides which subsection comes first).
  function LibraryOverlay({embedded,preferredSubsectionId}={}){
    const[visible,setVisible]=React.useState(embedded?true:libraryVisible),[snapshot,setSnapshot]=React.useState(null),[error,setError]=React.useState(''),[receipt,setReceipt]=React.useState(null),[query,setQuery]=React.useState(''),[filter,setFilter]=React.useState(''),[extra,setExtra]=React.useState([]),[pending,setPending]=React.useState({}),[seenCategories,setSeenCategories]=React.useState([]),[changed,setChanged]=React.useState(false);
    React.useEffect(()=>{if(embedded)return;libraryListeners.add(setVisible);return()=>libraryListeners.delete(setVisible);},[embedded]);
    // `plugin` is a client-side view (every npm entry that is not an application); every other filter is a provider category.
    const params=React.useCallback(cursor=>{const p=new URLSearchParams();if(query)p.set('q',query);p.set('category',filter==='plugin'?'':filter);if(cursor)p.set('cursor',cursor);return'?'+p.toString();},[query,filter]);
    const remember=page=>setSeenCategories(list=>[...new Set([...list,...(page.categories??[])])].sort());
    const load=React.useCallback(async()=>{try{setError('');setExtra([]);const page=await request('/hanamesh/library'+params());setSnapshot(page);remember(page);}catch(e){setError(String(e.message??e));}},[params]);
    const more=async()=>{try{const cursor=(extra.at(-1)??snapshot)?.page?.nextCursor;if(!cursor)return;const next=await request('/hanamesh/library'+params(cursor));setExtra(list=>[...list,next]);remember(next);}catch(e){setError(String(e.message??e));}};
    React.useEffect(()=>{if(visible)void load();},[visible,load]);
    // rc.18: install/provision/uninstall are 202 + events. Track the operation per card so the user sees
    // 「安装中…」 and, on failure, the code with a readable reason (user 2026-09-20: clicked install, nothing happened).
    const operate=async(path,body,key,label)=>{setError('');setPending(p=>({...p,[key]:{label,text:label+'中…'}}));try{const started=await request(path,{method:'POST',body:JSON.stringify(body)});const {operationId}=started;let after=0;const deadline=Date.now()+600000;let outcome=null;while(!outcome&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,1000));const feed=await request('/hanamesh/library/events?after='+after);after=feed.sequence??after;for(const event of feed.events??[]){if(event.operationId!==operationId)continue;if(event.type.endsWith('-done'))outcome={ok:true};else if(event.type.endsWith('-failed'))outcome={ok:false,code:event.code??'LIBRARY_OPERATION_FAILED'};}}
      if(!outcome)outcome={ok:false,code:'OPERATION_TIMEOUT'};
      if(outcome.ok)setChanged(true);
      setPending(p=>({...p,[key]:outcome.ok?{label,text:label+'完成，重启 DSH 后生效'}:{label,text:label+'失败：'+outcome.code+'（'+failureReason(outcome.code)+'）',failed:true}}));
      await load();}catch(e){setPending(p=>({...p,[key]:{label,text:label+'失败：'+String(e.message??e),failed:true}}));}};
    const open=async installed=>{try{setError('');const deployment=installed.definition.deployments[0],viewId='hml-'+globalThis.crypto.randomUUID();let next=await request('/apps/open',{method:'POST',body:JSON.stringify({appId:installed.appId,deploymentId:deployment.id,viewId})});const deadline=Date.now()+120000;while(next.instance.status!=='ready'){if(!['reserved','starting'].includes(next.instance.status)||Date.now()>deadline)throw new Error(next.instance.errorCode??'INSTANCE_NOT_READY');await new Promise(resolve=>setTimeout(resolve,250));next=await request('/apps/resume',{method:'POST',body:JSON.stringify({viewId,leaseToken:next.leaseToken})});}setReceipt(next);}catch(e){setError(String(e.message??e));}};
    const close=async()=>{if(receipt)await request('/apps/close',{method:'POST',body:JSON.stringify({viewId:receipt.lease.viewId,leaseToken:receipt.leaseToken})});setReceipt(null);};
    if(!visible)return null;
    const pages=[snapshot,...extra].filter(Boolean),all=pages.flatMap(page=>page.items??[]),items=filter==='plugin'?all.filter(item=>item.kind==='plugin'):all,installed=snapshot?.installed??[],plugins=snapshot?.plugins??[],nextCursor=(extra.at(-1)??snapshot)?.page?.nextCursor??null;
    const restartRequired=changed||Boolean(snapshot?.restartRequired);
    const filters=[...BASE_FILTERS,...seenCategories.filter(c=>c!=='hanamesh-app').map(c=>[c,c])];
    const card=item=>{const row=item.installed,op=pending[item.id],busy=op&&!op.failed&&op.text.endsWith('中…');const installBody={itemId:item.id,...(item.package?.name?{packageName:item.package.name}:{})};
      let action=h('span',null,'仅收录，不可安装'),state=null;
      if(row)state=h('span',{className:'hm-market-state','data-hanamesh-state':row.state},(STATE_TEXT[row.state]??row.state)+(row.version?' '+row.version:''));
      if(busy)action=h('button',{type:'button',disabled:true},op.text);
      else if(item.kind!=='listing'&&!row)action=h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/install',installBody,item.id,'安装')},op?.failed?'重试安装':'安装');
      else if(row&&item.upgradeAvailable)action=h('span',{className:'hm-market-actions'},h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/install',installBody,item.id,'升级')},'升级到 '+item.latestVersion),row.state==='registered'?h('button',{type:'button',onClick:()=>void open(row)},'打开'):null);
      else if(row?.state==='runtime-missing')action=h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/provision',{appId:row.appId,packageName:row.packageName,runtimeItem:row.runtimeItem},item.id,'补齐运行时')},'补齐运行时');
      else if(row?.state==='registered')action=h('span',{className:'hm-market-actions'},h('button',{type:'button',onClick:()=>void open(row)},'打开'),h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/uninstall',{appId:row.appId,packageName:row.packageName,runtimeItem:row.runtimeItem},item.id,'卸载')},'卸载'));
      else if(row?.state==='installed')action=PROTECTED.has(row.packageName)?h('span',null,'HanaMesh 套件'):h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/plugins/uninstall',{packageName:row.packageName},item.id,'卸载')},'卸载');
      else if(row?.state==='uninstalled-not-unloaded')action=h('span',null,'已卸载，重启 DSH 后生效');
      else if(row)action=h('span',null,'已安装，重启 DSH 后生效');
      return h('article',{key:item.id,'data-hanamesh-library-item':item.id,'data-hanamesh-kind':item.kind},h('h3',null,item.displayName),h('p',null,item.summary),
        h('small',null,KIND_TEXT[item.kind]+' · '+(item.publisher?.name??'未知发布者')+' · '+(item.latestVersion??'—')+((item.categories??[]).length?' · '+item.categories.join('、'):'')),
        state,action,op&&!busy?h('p',{role:op.failed?'alert':'status',className:op.failed?'hm-library-failed':'hm-library-ok'},op.text):null);};
    const catalogSection=receipt?h('div',{className:'hm-app-frame'},h('div',null,h('strong',null,receipt.instance.appId),h('button',{type:'button',onClick:()=>void close()},'关闭视图')),h('iframe',{src:receipt.uiUrl,title:receipt.instance.appId,sandbox:'allow-forms allow-modals allow-popups allow-same-origin allow-scripts'})):
      h('div',{className:'hm-library-grid',key:'catalog'},...items.map(card));
    const moreButton=nextCursor&&!receipt?h('button',{type:'button',className:'hm-library-more',key:'more',onClick:()=>void more()},'更多'):null;
    const installedSection=!receipt&&(installed.length||plugins.length)?h('section',{className:'hm-market-installed',key:'installed'},h('h2',null,'已安装'),h('ul',null,
        ...installed.map(row=>h('li',{key:'app:'+row.packageName,'data-hanamesh-installed':row.packageName},'应用 · '+(row.name??row.packageName)+' · '+row.packageName+' '+(row.version??'')+' · '+(STATE_TEXT[row.state]??row.state))),
        ...plugins.map(row=>h('li',{key:'plugin:'+row.packageName,'data-hanamesh-installed':row.packageName},'插件 · '+row.packageName+' '+(row.version??'')+' · '+(STATE_TEXT[row.state]??row.state)+(row.bundle&&!row.active&&row.state==='installed'?'（未启用为 profile 层）':''),
          row.state==='installed'&&!PROTECTED.has(row.packageName)&&!pending['plugin:'+row.packageName]?h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/plugins/uninstall',{packageName:row.packageName},'plugin:'+row.packageName,'卸载')},'卸载'):pending['plugin:'+row.packageName]?h('span',{className:pending['plugin:'+row.packageName].failed?'hm-library-failed':'hm-library-ok'},' '+pending['plugin:'+row.packageName].text):null)))):null;
    // The seat owner may ask for a subsection to come first; `installed` is the only one it names today.
    const body=preferredSubsectionId==='installed'?[installedSection,catalogSection,moreButton]:[catalogSection,moreButton,installedSection];
    return h('section',{className:embedded?'hm-market hm-market-embedded':'hm-library-overlay hm-market'},
      h('header',null,h('div',null,h('h1',null,'HanaMesh 市场')),embedded?null:h('button',{type:'button',onClick:()=>setLibraryVisible(false)},'关闭')),
      h(MarketConflictNotice,null),
      h('div',{className:'hm-library-toolbar'},h('input',{type:'search',placeholder:'搜索应用与插件',value:query,onChange:e=>setQuery(e.target.value),onKeyDown:e=>{if(e.key==='Enter')void load();}}),h('button',{type:'button',onClick:()=>void load()},'搜索'),
        h('select',{'aria-label':'类别',value:filter,onChange:e=>setFilter(e.target.value)},...filters.map(([value,label])=>h('option',{key:value||'all',value},label)))),
      restartRequired?h(RestartNotice,null):null,
      error?h('p',{role:'alert'},error):null,
      ...body);
  }
  /** The `market` seat object read by the shell's Extension Management panel. */
  function createMarketSeat(){
    return{
      render(options){return h(LibraryOverlay,{embedded:true,preferredSubsectionId:options?.preferredSubsectionId});},
      setSettingsVisible(visible){setEntryVisible(visible!==false);},
    };
  }
  /** Another client plugin (dshmarket) already holds the seat — `reflect.get` is a sibling client service, not a host service. */
  function marketSeatTaken(ctx){try{return ctx.reflect?.get?.(MARKET_SEAT,false)!==undefined;}catch{return false;}}
  /** dshmarket installed in this profile, whether or not its client module has loaded yet. Unreachable host → fail open. */
  async function dshmarketInstalled(){
    try{const snapshot=await request('/hanamesh/library/installedPlugins');return(snapshot.plugins??[]).some(row=>row.packageName===DSHMARKET_PACKAGE);}
    catch{return false;}
  }
  /** Take the seat only when dshmarket is provably absent; otherwise stand down with a readable notice and a log line. */
  function claimMarketSeat(ctx){
    let dispose,released=false;
    // Both logs: the host logger when the client context carries one, and always the browser console —
    // a DSH client logger is not visible from the page, and the console is where this is actually read.
    const standDown=()=>{setMarketConflict(MARKET_CONFLICT_TEXT);
      const line='hanamesh-app-host market: '+MARKET_CONFLICT_TEXT;
      try{if(typeof ctx.logger?.warn==='function')ctx.logger.warn(line);}catch{}
      try{globalThis.console?.warn?.(line);}catch{}};
    void(async()=>{
      const conflict=marketSeatTaken(ctx)||await dshmarketInstalled();
      if(released)return;
      if(conflict){standDown();return;}
      // A seat that appears after the panel mounted is fine: cordis notifies every `inject(['market'])` fiber.
      try{dispose=ctx.provide(MARKET_SEAT,createMarketSeat());}catch{standDown();}
    })();
    return()=>{released=true;setMarketConflict('');setEntryVisible(true);dispose?.();};
  }
  const name='hanamesh-app-host-client',inject=['slots','locale'];
  // No cross-plugin reads here: the browser-side cordis context never carries host services such as hanameshCore
  // (dsh-client-modules boots its own root context); Core status lives in Core's own Settings section.
  function apply(ctx){ctx.effect(()=>{const style=document.createElement('style');style.textContent='.hm-providers,.hm-library-sources{display:grid;gap:16px}.hm-providers table{width:100%;border-collapse:collapse}.hm-providers th,.hm-providers td{padding:8px;text-align:left;border-bottom:1px solid color-mix(in srgb,currentColor 14%,transparent)}.hm-provider-card{padding:16px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:12px}.hm-provider-row{display:grid;grid-template-columns:minmax(120px,1fr) auto minmax(180px,1fr) auto;gap:8px;align-items:center;margin:8px 0}.hm-source-row{display:grid;grid-template-columns:minmax(0,1fr) repeat(4,auto);gap:8px}.hm-source-row code{overflow-wrap:anywhere}.hm-source-add{display:flex;gap:8px}.hm-source-add input{flex:1}.hm-library-overlay{position:absolute;inset:0;z-index:30;pointer-events:auto;overflow:auto;padding:24px;background:#fff;color:#18181b}.hm-library-overlay button,.hm-library-overlay input{color:#18181b}.hm-library-overlay>header{display:flex;justify-content:space-between;align-items:center}.hm-library-toolbar{display:flex;gap:8px;align-items:center;margin:8px 0}.hm-library-toolbar input[type=search]{flex:1;padding:6px 10px}.hm-library-more{margin:12px auto;display:block}.hm-library-failed{color:#b91c1c;margin:0}.hm-library-ok{color:#166534;margin:0}.hm-restart-notice{padding:10px 12px;border:1px solid #f59e0b;border-radius:8px;background:#fffbeb;margin:8px 0}.hm-restart-link{margin-left:4px;font-weight:600}.hm-market-state{font-size:12px;color:#3f3f46}.hm-market-actions{display:flex;gap:8px;flex-wrap:wrap}.hm-market-embedded{display:block}.hm-market-embedded>header{display:flex;justify-content:space-between;align-items:center}.hm-market-conflict{padding:10px 12px;border:1px solid #6366f1;border-radius:8px;background:color-mix(in srgb,#6366f1 8%,transparent);margin:8px 0}.hm-market-installed{margin-top:24px}.hm-market-installed ul{padding-left:18px;display:grid;gap:6px}.hm-library-toolbar select{padding:6px 10px}.hm-library-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}.hm-library-grid article{display:grid;gap:10px;padding:16px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:12px}.hm-app-frame{display:grid;grid-template-rows:auto 1fr;height:calc(100vh - 130px)}.hm-app-frame>div{display:flex;justify-content:space-between}.hm-app-frame iframe{width:100%;height:100%;border:0}';document.head.append(style);return()=>style.remove();},'hanamesh-app-host:style');
    ctx.effect(()=>ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'hanamesh-providers',order:18,label:'供应商'},ProvidersSection)),'hanamesh-app-host:providers');
    ctx.effect(()=>ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'hanamesh-library-sources',order:19,label:'市场目录源'},LibrarySourcesSection)),'hanamesh-app-host:library-sources');
    ctx.effect(()=>ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:'hanamesh-library',order:30},LibraryAction)),'hanamesh-app-host:library-action');
    ctx.effect(()=>ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'hanamesh-library-overlay',order:30},LibraryOverlay)),'hanamesh-app-host:library-overlay');
    ctx.effect(()=>claimMarketSeat(ctx),'hanamesh-app-host:market-seat');}
  return{name,inject,apply,ProvidersSection,LibrarySourcesSection,LibraryAction,LibraryOverlay,MarketConflictNotice,createMarketSeat,
    MARKET_SEAT,MARKET_CONFLICT_TEXT,marketState:()=>({conflict:marketConflict,entryVisible})};
}});
