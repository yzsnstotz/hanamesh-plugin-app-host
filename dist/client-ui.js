/* Browser bundle for DSH client-modules. The Node condition of exports["./client"] remains the SDK. */
window.__ModuleLoader__.load({id:'@hanamesh/dsh-app-host',factory:function(require){'use strict';
  const React=require('react');
  const h=React.createElement;
  const request=async(path,init={})=>{
    const response=await globalThis.fetch.bind(globalThis)(path,{...init,headers:{'x-hanamesh-client':'workspace-v1',...(init.body?{'content-type':'application/json'}:{}),...init.headers}});
    const value=await response.json();if(!response.ok)throw new Error(value?.error?.code??`HTTP_${response.status}`);return value;
  };
  const entryId=entry=>entry.projection==='file'?`file:${entry.base??'home'}:${entry.path}`:`env:${entry.env}`;
  const groups=items=>{
    const found=new Map();for(const item of items){const title=item.entry.purpose??item.entry.env??item.entry.path??entryId(item.entry);
      if(!found.has(title))found.set(title,[]);found.get(title).push(item);}return[...found.entries()];
  };
  function ProvidersSection(){
    const[providers,setProviders]=React.useState([]),[apps,setApps]=React.useState([]),[plans,setPlans]=React.useState({}),[error,setError]=React.useState('');
    const load=React.useCallback(async()=>{try{setError('');const[p,a]=await Promise.all([request('/hanamesh/router/providers'),request('/hanamesh/apps')]);
      setProviders(p.providers??[]);setApps(a.apps??[]);const rows=await Promise.all((a.apps??[]).map(async app=>[app.id,await request('/hanamesh/router/plan?appId='+encodeURIComponent(app.id))]));setPlans(Object.fromEntries(rows));}catch(e){setError(String(e.message??e));}},[]);
    React.useEffect(()=>{void load();},[load]);
    const mutate=async(path,body)=>{try{setError('');await request(path,{method:'POST',body:JSON.stringify(body)});await load();}catch(e){setError(String(e.message??e));}};
    const sourceRows=providers.map(provider=>h('tr',{key:provider.id},h('td',null,provider.displayName),h('td',null,provider.source),h('td',null,provider.state),h('td',null,provider.keyHint??'—'),h('td',null,(provider.models??[]).join('、')||'—')));
    const cards=apps.map(app=>{const plan=plans[app.id];if(!plan)return null;return h('section',{className:'hm-provider-card',key:app.id},h('h3',null,app.name),
      ...groups(plan.items??[]).map(([purpose,items])=>h('div',{className:'hm-provider-purpose',key:purpose},h('strong',null,purpose),...items.map(item=>{
        const id=entryId(item.entry),choices=providers.filter(provider=>!item.entry.providers?.length||item.entry.providers.includes(provider.id));
        return h('div',{className:'hm-provider-row',key:id},h('span',null,item.entry.env??item.entry.path),h('span',null,item.state),
          h('select',{defaultValue:'',onChange:event=>{const provider=choices.find(row=>row.id===event.target.value);if(provider)void mutate('/hanamesh/router/grant',{appId:app.id,entryId:id,subject:provider.ref?{kind:'api-key',ref:provider.ref}:{kind:'provider',providerId:provider.id},model:provider.models?.[0]});}},h('option',{value:''},'选择供应商'),...choices.map(provider=>h('option',{value:provider.id,key:provider.id},provider.displayName))),
          item.granted?h('button',{type:'button',onClick:()=>void mutate('/hanamesh/router/revoke',{appId:app.id,entryId:id})},'撤销'):null);
      }))),h('details',null,h('summary',null,'高级'),h('button',{type:'button',onClick:()=>void mutate('/hanamesh/router/mode',{appId:app.id,mode:plan.mode==='managed'?'app-owned':'managed'})},plan.mode==='managed'?'切换为应用自管':'切换为托管')));});
    return h('section',{className:'hm-providers'},h('h2',null,'供应商'),h('p',null,'这里只显示来源、状态、提示与模型，不读取或展示密钥值。'),error?h('p',{role:'alert'},error):null,
      h('button',{type:'button',onClick:()=>void mutate('/hanamesh/router/gateway',{enabled:true})},'启用网关'),
      h('table',null,h('thead',null,h('tr',null,...['名称','来源','状态','Key 提示','模型'].map(label=>h('th',{key:label},label)))),h('tbody',null,...sourceRows)),...cards);
  }
  let libraryVisible=false;const libraryListeners=new Set();
  const setLibraryVisible=value=>{libraryVisible=value;for(const listener of libraryListeners)listener(value);};
  function LibraryAction(){return h('button',{type:'button',className:'hm-library-action',onClick:()=>setLibraryVisible(true)},'应用库');}
  function LibrarySourcesSection(){
    const[sources,setSources]=React.useState([]),[draft,setDraft]=React.useState(''),[error,setError]=React.useState('');
    const load=React.useCallback(async()=>{try{const value=await request('/hanamesh/library/sources');setSources(value.sources??[]);setError('');}catch(e){setError(String(e.message??e));}},[]);
    React.useEffect(()=>{void load();},[load]);
    const save=async next=>{try{await request('/hanamesh/library/sources',{method:'POST',body:JSON.stringify({sources:next})});await load();}catch(e){setError(String(e.message??e));}};
    const move=(index,delta)=>{const next=[...sources],target=index+delta;if(target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];void save(next);};
    return h('section',{className:'hm-library-sources'},h('h2',null,'应用库目录源'),h('p',null,'可保存多个来源，但浏览时只启用一个。'),error?h('p',{role:'alert'},error):null,
      ...sources.map((source,index)=>h('div',{className:'hm-source-row',key:source.manifestUrl},h('code',null,source.manifestUrl),h('button',{type:'button',disabled:source.enabled,onClick:()=>void save(sources.map((row,i)=>({...row,enabled:i===index})))},source.enabled?'已启用':'启用'),h('button',{type:'button',onClick:()=>move(index,-1)},'上移'),h('button',{type:'button',onClick:()=>move(index,1)},'下移'),h('button',{type:'button',onClick:()=>void save(sources.filter((_,i)=>i!==index))},'删除'))),
      h('div',{className:'hm-source-add'},h('input',{value:draft,placeholder:'https://…/catalog-source.json',onChange:event=>setDraft(event.target.value)}),h('button',{type:'button',onClick:()=>{if(draft)void save([...sources.map(row=>({...row,enabled:false})),{manifestUrl:draft,enabled:true}]);setDraft('');}},'添加并启用')));
  }
  const FAILURE_REASONS={REGISTRY_LOOKUP_FAILED:'应用包不在当前 registry 上——该应用尚未发布到 npm，或客户端 registry 设置不对',DSH_PLUGIN_FAILED:'DSH 安装命令失败，查看宿主日志',LIBRARY_INSTALL_UNAVAILABLE:'当前宿主未提供安装参数（profile / node 路径）',CATALOG_ITEM_MISSING:'目录里已没有这一项，刷新后重试',UNSTABLE_VERSION:'registry 上的最新版是预发布版（rc），客户端未允许安装预发布版',RUNTIME_ARCHIVE_UNAVAILABLE:'运行时归档下载失败，检查网络或来源',OPERATION_TIMEOUT:'10 分钟内没有结果，可稍后重试'};
  const failureReason=code=>FAILURE_REASONS[code]??'详细原因见宿主日志';
  function LibraryOverlay(){
    const[visible,setVisible]=React.useState(libraryVisible),[snapshot,setSnapshot]=React.useState(null),[error,setError]=React.useState(''),[receipt,setReceipt]=React.useState(null),[query,setQuery]=React.useState(''),[appsOnly,setAppsOnly]=React.useState(true),[extra,setExtra]=React.useState([]),[pending,setPending]=React.useState({});
    React.useEffect(()=>{libraryListeners.add(setVisible);return()=>libraryListeners.delete(setVisible);},[]);
    const params=React.useCallback(cursor=>{const p=new URLSearchParams();if(query)p.set('q',query);if(!appsOnly)p.set('category','');if(cursor)p.set('cursor',cursor);const s=p.toString();return s?'?'+s:'';},[query,appsOnly]);
    const load=React.useCallback(async()=>{try{setError('');setExtra([]);setSnapshot(await request('/hanamesh/library'+params()));}catch(e){setError(String(e.message??e));}},[params]);
    const more=async()=>{try{const cursor=(extra.at(-1)??snapshot)?.page?.nextCursor;if(!cursor)return;setExtra(list=>[...list]);const next=await request('/hanamesh/library'+params(cursor));setExtra(list=>[...list,next]);}catch(e){setError(String(e.message??e));}};
    React.useEffect(()=>{if(visible)void load();},[visible,load]);
    // rc.18: install/provision/uninstall are 202 + events. Track the operation per card so the user sees
    // 「安装中…」 and, on failure, the code with a readable reason (user 2026-09-20: clicked install, nothing happened).
    const operate=async(path,body,key)=>{const label=path.endsWith('/install')?'安装':path.endsWith('/provision')?'补齐运行时':'卸载';setError('');setPending(p=>({...p,[key]:{label,text:label+'中…'}}));try{const started=await request(path,{method:'POST',body:JSON.stringify(body)});const {operationId}=started;let after=0;const deadline=Date.now()+600000;let outcome=null;while(!outcome&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,1000));const feed=await request('/hanamesh/library/events?after='+after);after=feed.sequence??after;for(const event of feed.events??[]){if(event.operationId!==operationId)continue;if(event.type.endsWith('-done'))outcome={ok:true};else if(event.type.endsWith('-failed'))outcome={ok:false,code:event.code??'LIBRARY_OPERATION_FAILED'};}}
      if(!outcome)outcome={ok:false,code:'OPERATION_TIMEOUT'};
      setPending(p=>({...p,[key]:outcome.ok?{label,text:label+'完成，重启 DSH 后可打开'}:{label,text:label+'失败：'+outcome.code+'（'+failureReason(outcome.code)+'）',failed:true}}));
      await load();}catch(e){setPending(p=>({...p,[key]:{label,text:label+'失败：'+String(e.message??e),failed:true}}));}};
    const open=async installed=>{try{setError('');const deployment=installed.definition.deployments[0],viewId='hml-'+globalThis.crypto.randomUUID();let next=await request('/apps/open',{method:'POST',body:JSON.stringify({appId:installed.appId,deploymentId:deployment.id,viewId})});const deadline=Date.now()+120000;while(next.instance.status!=='ready'){if(!['reserved','starting'].includes(next.instance.status)||Date.now()>deadline)throw new Error(next.instance.errorCode??'INSTANCE_NOT_READY');await new Promise(resolve=>setTimeout(resolve,250));next=await request('/apps/resume',{method:'POST',body:JSON.stringify({viewId,leaseToken:next.leaseToken})});}setReceipt(next);}catch(e){setError(String(e.message??e));}};
    const close=async()=>{if(receipt)await request('/apps/close',{method:'POST',body:JSON.stringify({viewId:receipt.lease.viewId,leaseToken:receipt.leaseToken})});setReceipt(null);};
    if(!visible)return null;
    const items=[...(snapshot?.items??[]),...extra.flatMap(page=>page.items??[])],installed=snapshot?.installed??[],nextCursor=(extra.at(-1)??snapshot)?.page?.nextCursor??null;
    return h('section',{className:'hm-library-overlay'},h('header',null,h('div',null,h('h1',null,'应用库')),h('button',{type:'button',onClick:()=>setLibraryVisible(false)},'关闭')),
      h('div',{className:'hm-library-toolbar'},h('input',{type:'search',placeholder:'搜索应用',value:query,onChange:e=>setQuery(e.target.value),onKeyDown:e=>{if(e.key==='Enter')void load();}}),h('button',{type:'button',onClick:()=>void load()},'搜索'),h('label',null,h('input',{type:'checkbox',checked:appsOnly,onChange:e=>setAppsOnly(e.target.checked)}),'只看应用')),
      error?h('p',{role:'alert'},error):null,
      receipt?h('div',{className:'hm-app-frame'},h('div',null,h('strong',null,receipt.instance.appId),h('button',{type:'button',onClick:()=>void close()},'关闭视图')),h('iframe',{src:receipt.uiUrl,title:receipt.instance.appId,sandbox:'allow-forms allow-modals allow-popups allow-same-origin allow-scripts'})):
      h('div',{className:'hm-library-grid'},...items.map(item=>{const row=item.installed;let action=h('span',null,item.application?'可安装':'只可浏览');const op=pending[item.id];const busy=op&&!op.failed&&op.text.endsWith('中…');if(busy)action=h('button',{type:'button',disabled:true},op.text);else if(item.application&&!row)action=h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/install',{itemId:item.id},item.id)},op?.failed?'重试安装':'安装');else if(row?.state==='runtime-missing')action=h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/provision',{appId:row.appId,packageName:row.packageName,runtimeItem:row.runtimeItem},item.id)},'补齐运行时');else if(row?.state==='registered')action=h('button',{type:'button',onClick:()=>void open(row)},'打开');else if(row)action=h('span',null,'已安装，重启 DSH 后可打开');return h('article',{key:item.id,'data-hanamesh-library-item':item.id},h('h3',null,item.displayName),h('p',null,item.summary),h('small',null,(item.publisher?.name??'未知发布者')+' · '+(item.latestVersion??'—')),action,op&&!busy?h('p',{role:op.failed?'alert':'status',className:op.failed?'hm-library-failed':'hm-library-ok'},op.text):null);})),
      nextCursor?h('button',{type:'button',className:'hm-library-more',onClick:()=>void more()},'更多'):null,
      installed.length&&!items.length?h('p',null,`已扫描 ${installed.length} 个已安装应用。`):null);
  }
  const name='hanamesh-app-host-client',inject=['slots','locale'];
  // No cross-plugin reads here: the browser-side cordis context never carries host services such as hanameshCore
  // (dsh-client-modules boots its own root context); Core status lives in Core's own Settings section.
  function apply(ctx){ctx.effect(()=>{const style=document.createElement('style');style.textContent='.hm-providers,.hm-library-sources{display:grid;gap:16px}.hm-providers table{width:100%;border-collapse:collapse}.hm-providers th,.hm-providers td{padding:8px;text-align:left;border-bottom:1px solid color-mix(in srgb,currentColor 14%,transparent)}.hm-provider-card{padding:16px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:12px}.hm-provider-row{display:grid;grid-template-columns:minmax(120px,1fr) auto minmax(180px,1fr) auto;gap:8px;align-items:center;margin:8px 0}.hm-source-row{display:grid;grid-template-columns:minmax(0,1fr) repeat(4,auto);gap:8px}.hm-source-row code{overflow-wrap:anywhere}.hm-source-add{display:flex;gap:8px}.hm-source-add input{flex:1}.hm-library-overlay{position:absolute;inset:0;z-index:30;pointer-events:auto;overflow:auto;padding:24px;background:#fff;color:#18181b}.hm-library-overlay button,.hm-library-overlay input{color:#18181b}.hm-library-overlay>header{display:flex;justify-content:space-between;align-items:center}.hm-library-toolbar{display:flex;gap:8px;align-items:center;margin:8px 0}.hm-library-toolbar input[type=search]{flex:1;padding:6px 10px}.hm-library-more{margin:12px auto;display:block}.hm-library-failed{color:#b91c1c;margin:0}.hm-library-ok{color:#166534;margin:0}.hm-library-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}.hm-library-grid article{display:grid;gap:10px;padding:16px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:12px}.hm-app-frame{display:grid;grid-template-rows:auto 1fr;height:calc(100vh - 130px)}.hm-app-frame>div{display:flex;justify-content:space-between}.hm-app-frame iframe{width:100%;height:100%;border:0}';document.head.append(style);return()=>style.remove();},'hanamesh-app-host:style');
    ctx.effect(()=>ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'hanamesh-providers',order:18,label:'供应商'},ProvidersSection)),'hanamesh-app-host:providers');
    ctx.effect(()=>ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'hanamesh-library-sources',order:19,label:'应用库来源'},LibrarySourcesSection)),'hanamesh-app-host:library-sources');
    ctx.effect(()=>ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:'hanamesh-library',order:30},LibraryAction)),'hanamesh-app-host:library-action');
    ctx.effect(()=>ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'hanamesh-library-overlay',order:30},LibraryOverlay)),'hanamesh-app-host:library-overlay');}
  return{name,inject,apply,ProvidersSection,LibrarySourcesSection,LibraryAction,LibraryOverlay};
}});
