/* Browser bundle for DSH client-modules. The Node condition of exports["./client"] remains the SDK. */
window.__ModuleLoader__.load({id:'@hanamesh/dsh-app-host',factory:function(require){'use strict';
  const React=require('react');
  const h=React.createElement;
  const request=async(path,init={})=>{
    const response=await globalThis.fetch.bind(globalThis)(path,{...init,headers:{'x-hanamesh-client':'workspace-v1',...(init.body?{'content-type':'application/json'}:{}),...init.headers}});
    const value=await response.json();if(!response.ok){const error=new Error(value?.error?.code??`HTTP_${response.status}`);error.response=value;throw error;}return value;
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
  let targetSelection=null,targetSequence=0,pendingOperations={};
  const targetListeners=new Set(),pendingListeners=new Set();
  const INSTALL_TARGET_HASH='#hanamesh-install?',INSTALL_TARGET_CONTRACT_VERSION='1';
  const CORE_SUITE_FAILURES={CORE_SUITE_DECLARATION_MISSING:'Core 未提供套件声明',CORE_SUITE_DECLARATION_INVALID:'Core 套件声明无法用于精确安装。'};
  const suiteTargetFailure=target=>target.previewFailed?'兼容升级检查未通过，尚未执行安装：'+(CORE_SUITE_FAILURES[target.error]??target.error??'检测不到结果'):CORE_SUITE_FAILURES[target.error]??(target.details?.stage==='suite-upgrade'?'套件升级未完成：'+(target.error??'检测不到结果')+'。请核对当前版本；完全退出后可使用 HanaMesh 设置中的补齐命令修复并重新打开。':'套件升级未完成或结果尚未确认：'+(target.error??'检测不到结果')+'。请核对已装版本；不会自动重试。');
  const setTarget=value=>{targetSelection=value;for(const listener of targetListeners)listener(value);};
  const setPending=update=>{pendingOperations=typeof update==='function'?update(pendingOperations):update;for(const listener of pendingListeners)listener(pendingOperations);};
  /** Public client entry: identifiers only; the market fetches its own catalog and owns confirmation. */
  async function openInstallTarget(input,{handoffId}={}){
    const sequence=++targetSequence;if(entryVisible)setLibraryVisible(true);
    try{
      if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('INVALID_INPUT');
      // rc.8: optional contract declaration; absent keeps v1 semantics, an unsupported version is refused before any request.
      if(input.contractVersion!==undefined&&input.contractVersion!==INSTALL_TARGET_CONTRACT_VERSION)throw new Error('CONTRACT_VERSION_UNSUPPORTED');
      if(Object.keys(input).some(key=>!['itemId','packageName','contractVersion'].includes(key))||(!input.itemId&&!input.packageName)||
        (input.itemId!==undefined&&(typeof input.itemId!=='string'||!input.itemId.length||input.itemId.length>160||/[\u0000-\u001f\u007f]/.test(input.itemId)))||
        (input.packageName!==undefined&&(typeof input.packageName!=='string'||input.packageName.length>214||!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(input.packageName))))throw new Error('INVALID_INPUT');
      setTarget({status:'resolving',input:{...input}});
      const query=new URLSearchParams(input),resolved=await request('/hanamesh/library/target?'+query);
      if(sequence!==targetSequence)return{status:'superseded'};
      const item=resolved.item,op=pendingOperations[item.id];
      const status=op?.busy?'installing':['registered','installed','installed-not-loaded'].includes(item.installed?.state)&&!item.upgradeAvailable?'already-installed':'confirmation-required';
      setTarget({...resolved,status,...(handoffId?{handoffId}:{})});return{status,itemId:item.id,packageName:item.package.name};
    }catch(error){if(sequence===targetSequence)setTarget({status:input.itemId==='hanamesh:suite-upgrade'?'suite-upgrade-failed':'failed',error:String(error.message??error),...(input.itemId==='hanamesh:suite-upgrade'?{previewFailed:true,details:error.response?.error?.details}:{})});throw error;}
  }
  // Website handoff (C-MARKET 2026-10-15): the library's own loopback listener queued a target from an allowed website;
  // this window shows it with the normal confirmation. Only the person's 「确认安装」 installs.
  // Failures on this path are shown (market + settings, `handoffIssue`) and logged; the website gets the real reason from
  // the handoff state (HANDOFF_OPEN_FAILED / HANDOFF_NOT_PICKED_UP / HANDOFF_EXPIRED), never a made-up 「已取消」.
  // The poll interval is the setting library.handoff.pollMs, delivered with every poll.
  // Until the first poll delivers the saved value, the setting's default (HANDOFF_DEFAULTS.pollMs; a test keeps them equal).
  const HANDOFF_DEFAULT_POLL_MS=1500;
  const handled=new Set(),issueListeners=new Set();let handoffIssue=null,handoffPollMs=HANDOFF_DEFAULT_POLL_MS;
  const errorCode=error=>{const text=String(error?.message??error);return /^[A-Z][A-Z0-9_]{0,63}$/.test(text)?text:'CLIENT_ERROR';};
  const setHandoffIssue=value=>{handoffIssue=value;for(const listener of issueListeners)listener(value);};
  const noteHandoffIssue=(text,error)=>{const line='网站交接：'+text+'（'+String(error?.message??error)+'）';try{globalThis.console?.warn?.('hanamesh-app-host '+line);}catch{}setHandoffIssue({text:line,at:Date.now()});};
  const reportHandoff=async(handoffId,state,error)=>{if(!handoffId)return;
    try{await request('/hanamesh/library/handoffs/state',{method:'POST',body:JSON.stringify({handoffId,state,...(error?{error}:{})})});}
    catch(failure){noteHandoffIssue({shown:'没能告诉网站「确认框已弹出」',cancelled:'没能告诉网站「已取消」，网站会在作废时间到后显示过期',failed:'没能告诉网站「确认框打不开」'}[state],failure);}};
  async function pollHandoffs(){
    const value=await request('/hanamesh/library/handoffs');handoffPollMs=value.pollMs;
    if(handoffIssue?.poll)setHandoffIssue(null);
    for(const row of value.handoffs??[]){
      if(row.state!=='pending'||handled.has(row.handoffId))continue;handled.add(row.handoffId);
      const input={...(row.itemId?{itemId:row.itemId}:{}),...(row.packageName&&row.itemId!=='hanamesh:suite-upgrade'?{packageName:row.packageName}:{}),contractVersion:INSTALL_TARGET_CONTRACT_VERSION};
      let opened=false;
      try{await openInstallTarget(input,{handoffId:row.handoffId});opened=true;}
      catch(error){noteHandoffIssue('确认框打不开',error);await reportHandoff(row.handoffId,'failed',{code:errorCode(error)});}
      if(opened)await reportHandoff(row.handoffId,'shown');
      return;
    }
  }
  const pollHandoffsVisibly=async()=>{try{await pollHandoffs();}catch(error){const line='网站交接：读取交接失败，网站上的「安装」会一直等到过期（'+String(error?.message??error)+'）';try{globalThis.console?.warn?.('hanamesh-app-host '+line);}catch{}setHandoffIssue({text:line,poll:true,at:Date.now()});}};
  function consumeInstallTargetHash(){
    const hash=globalThis.location?.hash;if(!hash?.startsWith(INSTALL_TARGET_HASH))return;
    const params=new URLSearchParams(hash.slice(INSTALL_TARGET_HASH.length));
    if(new Set(params.keys()).size!==[...params.keys()].length){targetSequence++;if(entryVisible)setLibraryVisible(true);setTarget({status:'failed',error:'INVALID_INPUT'});return;}
    void openInstallTarget(Object.fromEntries(params)).catch(()=>{});
  }
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
  function HandoffIssueNotice(){
    const[issue,setIssue]=React.useState(handoffIssue);
    React.useEffect(()=>{issueListeners.add(setIssue);return()=>issueListeners.delete(setIssue);},[]);
    return issue?h('p',{role:'alert',className:'hm-library-failed','data-hanamesh-handoff-issue':''},issue.text):null;
  }
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
  function NodeRuntimeSection(){
    const[value,setValue]=React.useState(null),[draft,setDraft]=React.useState(null),[plan,setPlan]=React.useState(null),[error,setError]=React.useState(''),[working,setWorking]=React.useState(false);
    const errorText=e=>e.response?.error?.message??String(e.message??e);
    const load=React.useCallback(async()=>{try{const next=await request('/hanamesh/library/node-runtime');setValue(next);setDraft(current=>current??next.settings);setError('');return next;}catch(e){setError(errorText(e));return null;}},[]);
    React.useEffect(()=>{void load();},[load]);
    React.useEffect(()=>{if(!['preparing','committing'].includes(value?.operation?.state))return;let stopped=false,timer;
      const tick=async()=>{try{const next=await request('/hanamesh/library/node-runtime');if(stopped)return;setValue(next);if(['preparing','committing'].includes(next.operation?.state))timer=setTimeout(()=>void tick(),1000);}catch(e){if(!stopped)setError('进度读取中断：'+errorText(e)+'。准备可能仍在进行，请点击「刷新状态」查看；不会自动重试。');}};
      timer=setTimeout(()=>void tick(),1000);return()=>{stopped=true;clearTimeout(timer);};},[value?.operation?.id,value?.operation?.state]);
    const action=async(path,body,receive)=>{setWorking(true);setError('');try{const next=await request('/hanamesh/library/node-runtime/'+path,{method:'POST',body:JSON.stringify(body)});receive?.(next);}catch(e){setError(errorText(e));}finally{setWorking(false);}};
    const busy=working||['preparing','committing'].includes(value?.operation?.state),dirty=draft&&value&&JSON.stringify(draft)!==JSON.stringify(value.settings);
    const edit=(key,val)=>{setDraft({...draft,[key]:val});setPlan(null);};
    const field=(key,label,type='input')=>h('label',{key},label,h(type,{'data-node-setting':key,value:draft[key],disabled:busy,onChange:e=>edit(key,e.target.value)},type==='select'?key==='mode'?[h('option',{key:'managed',value:'managed'},'插件管理（推荐）'),h('option',{key:'external',value:'external'},'已有独立 Node（高级）')]:value.versions.map(v=>h('option',{key:v,value:v},'Node.js '+v)):null));
    const mb=n=>(n/1000000).toFixed(1)+' MB';
    const phase={starting:'检查位置与空间',download:'下载',verify:'校验 SHA-256',extract:'解压',check:'验证独立 Node',promote:'保存运行时',bind:'保存并启用（已完成校验，不能再取消）',ready:'环境已就绪',restore:'检查已有环境'};
    const op=value?.operation;
    return h('section',{className:'hm-node-runtime','data-hanamesh-node-runtime':''},h('h2',null,'安装环境'),
      h('p',null,'准备一次，后续安装自动使用。无需重启 DSH，也无需填写 Node 路径；不会改动客户端或系统 Node。'),
      error?h('p',{role:'alert'},error):null,
      value?h('p',{role:'status'},value.ready?'环境已就绪 · 后续插件操作自动使用独立 Node':value.supported?'尚未准备安装环境；确认前不会下载。':value.limitations):h('p',null,'正在读取安装环境…'),
      draft&&value?h('div',{className:'hm-node-fields'},field('mode',value.names.mode,'select'),field('version',value.names.version,'select'),field('sourceBase',value.names.sourceBase),field('storageRoot',value.names.storageRoot),field('externalBinary',value.names.externalBinary),
        h('small',null,'已有路径仅在高级方式生效。下载来源必须使用 HTTPS；版本只能选择已校验发行。修改设置后先保存，再重新确认。'),
        h('button',{type:'button',disabled:busy||!dirty,onClick:()=>void action('settings',{settings:draft},next=>{setValue(next);setDraft(next.settings);setPlan(null);})},'保存环境设置'),
        h('button',{type:'button',disabled:busy||dirty||!value.supported||draft.mode!=='managed',onClick:()=>void action('plan',{},setPlan)},'准备安装环境'),
        h('button',{type:'button',disabled:working,onClick:()=>void load()},'刷新状态')):null,
      plan?h('div',{className:'hm-node-confirm',role:'region','aria-label':'确认准备安装环境'},h('h3',null,'确认下载并准备'),
        h('p',null,'平台 '+plan.platform+' · Node.js '+plan.version+' · 最低 '+(plan.minimumOS??'macOS 13.5')),
        h('dl',null,h('dt',null,'下载来源'),h('dd',null,plan.source),h('dt',null,'下载体积'),h('dd',null,mb(plan.bytes)),h('dt',null,'解压后文件'),h('dd',null,mb(plan.unpackedBytes)),h('dt',null,'准备所需空间'),h('dd',null,mb(plan.requiredBytes)),h('dt',null,'存放位置'),h('dd',null,plan.root)),
        h('p',null,plan.license+'。确认后只从上述来源下载；不自动重试或换源。'),
        h('details',null,h('summary',null,'完整校验值与检查说明'),h('code',null,'SHA-256 '+plan.sha256),h('p',null,'校验归档 SHA、文件所有权、平台与精确版本；Electron 包装脚本不会通过。')),
        h('button',{type:'button',disabled:busy||dirty,onClick:()=>void action('prepare',{planId:plan.planId,confirm:true},next=>{setPlan(null);setValue({...value,...next});})},'确认下载并准备'),
        h('button',{type:'button',disabled:busy,onClick:()=>setPlan(null)},'暂不准备')):null,
      op?h('div',{className:'hm-node-progress','aria-live':'polite'},h('p',null,phase[op.phase]??'准备安装环境',op.state==='preparing'?'…':''),
        op.state==='preparing'&&op.phase==='download'?h('div',null,h('progress',{value:op.bytes??0,...(op.total?{max:op.total}:{})}),h('p',null,mb(op.bytes??0)+(op.total?' / '+mb(op.total):''))):null,
        op.error?h('p',{role:'alert'},op.error.message):null,
        op.state==='preparing'?h('button',{type:'button',disabled:working,onClick:()=>void action('cancel',{operationId:op.id},()=>void load())},'取消准备'):null,
        op.error?h('details',null,h('summary',null,'诊断详情'),h('code',null,op.error.code)):null):null,
      value?.executable?h('details',null,h('summary',null,'当前自动绑定的路径'),h('code',null,value.executable)):null,
      h('p',null,'支持 macOS 13.5+（Apple Silicon / Intel）。Windows 的安装、守护与取消验证尚未接通，本流程不声称支持 Windows。'));
  }

  /** Website handoff settings: every setting named with its default and editable; the fixed rules listed with their reason. */
  function HandoffSettingsSection(){
    const[value,setValue]=React.useState(null),[draft,setDraft]=React.useState(null),[error,setError]=React.useState('');
    const load=React.useCallback(async()=>{try{const next=await request('/hanamesh/library/handoff-settings');setValue(next);setDraft({...next.settings,ports:next.settings.ports.join(', '),allowedOrigins:next.settings.allowedOrigins.join('\n')});setError('');}catch(e){setError(String(e.message??e));}},[]);
    React.useEffect(()=>{void load();},[load]);
    const save=async()=>{try{const next=await request('/hanamesh/library/handoff-settings',{method:'POST',body:JSON.stringify({enabled:draft.enabled,ttlMs:Number(draft.ttlMs),pollMs:Number(draft.pollMs),
      ports:draft.ports.split(/[\s,，]+/).filter(Boolean).map(Number),allowedOrigins:draft.allowedOrigins.split(/\s+/).filter(Boolean)})});setValue(next);setError('');}catch(e){setError(String(e.message??e)+(e.response?.error?.message?'：'+e.response.error.message:''));}};
    const listener=value?.listener,defaults=value?.defaults,names=value?.names;
    const status=!listener?'读取中…':listener.status==='listening'?'正在 '+listener.origin+' 接收网站交接':listener.status==='disabled'?'已关闭：网站上的「安装」按钮找不到本客户端':listener.status==='unavailable'?listener.need:'未启动';
    return h('section',{className:'hm-library-sources'},h('h2',null,'网站安装交接'),
      h('p',null,'网站（如 market.hanamesh.com）点「安装」时，会在下列本机端口上找到本客户端，把要装的插件交给应用库；应用库在这里弹出确认，你确认后才安装。'),
      h('p',null,'安装前需要独立 Node.js 24。请打开 AppHost「安装环境」点击「准备安装环境」，核对来源、版本和体积后确认；完成后自动可用，无需重启或填写路径。已有独立 Node 可在安装环境高级设置中指定，不支持 Electron 包装脚本。'),
      h('p',{role:'status'},status),error?h('p',{role:'alert'},error):null,h(HandoffIssueNotice,null),
      draft&&defaults?h('div',{className:'hm-handoff-settings'},
        h('label',null,h('input',{type:'checkbox',checked:draft.enabled,onChange:event=>setDraft({...draft,enabled:event.target.checked})}),' 启用（'+names.enabled+'，默认 '+(defaults.enabled?'开':'关')+'）'),
        h('label',null,'端口（'+names.ports+'，默认 '+defaults.ports.join(', ')+'；按顺序取第一个空闲的）',h('input',{value:draft.ports,onChange:event=>setDraft({...draft,ports:event.target.value})})),
        h('label',null,'允许交接的网站（'+names.allowedOrigins+'，每行一个，默认 '+defaults.allowedOrigins.join('、')+'）',h('textarea',{rows:3,value:draft.allowedOrigins,onChange:event=>setDraft({...draft,allowedOrigins:event.target.value})})),
        h('label',null,'未确认多久后作废，毫秒（'+names.ttlMs+'，默认 '+defaults.ttlMs+' = '+defaults.ttlMs/60000+' 分钟）',h('input',{value:String(draft.ttlMs),onChange:event=>setDraft({...draft,ttlMs:event.target.value})})),
        h('label',null,'应用库多久查一次新的交接，毫秒（'+names.pollMs+'，默认 '+defaults.pollMs+'）',h('input',{value:String(draft.pollMs),onChange:event=>setDraft({...draft,pollMs:event.target.value})})),
        h('button',{type:'button',onClick:()=>void save()},'保存并重新监听')):null,
      value?.rules?h('div',{className:'hm-handoff-rules'},h('h3',null,'固定规则（不能关）'),h('ul',null,...value.rules.map(row=>h('li',{key:row.rule},row.rule,h('br',null),h('small',null,'为什么：'+row.why))))):null);
  }
  const FAILURE_REASONS={...CORE_SUITE_FAILURES,INSTALL_READBACK_MISMATCH:'安装命令返回成功，但 profile 读回的版本与固定版本不一致',REGISTRY_LOOKUP_FAILED:'包不在当前 registry 上——尚未发布到 npm，或客户端 registry 设置不对',DSH_PLUGIN_FAILED:'DSH 安装命令失败，查看宿主日志',LIBRARY_INSTALL_UNAVAILABLE:'当前宿主未提供安装参数（profile / node 路径）',CATALOG_ITEM_MISSING:'目录里已没有这一项，刷新后重试',UNSTABLE_VERSION:'registry 上的最新版是预发布版（rc），客户端未允许安装预发布版',RUNTIME_ARCHIVE_UNAVAILABLE:'运行时归档下载失败，检查网络或来源',OPERATION_TIMEOUT:'10 分钟内没有结果，可稍后重试',PACKAGE_DENIED:'HanaMesh 套件自身不能从市场安装或卸载',INSTANCE_IN_USE:'先关闭该应用的所有视图再卸载'};
  const failureReason=code=>FAILURE_REASONS[code]??'详细原因见宿主日志';
  const suiteRecoveryText=details=>details?.stage==='suite-upgrade'?'；升级未完成，部分组件可能已改变。当前读回：'+(details.actual?.components?.map(c=>c.label+' '+(c.version??'检测不到')+(c.active?'':'（未启用）')).join('；')||'检测不到')+'。请完全退出客户端，使用补齐命令（仅 macOS / Linux 终端；Windows 安全命令暂未提供）修复并重新打开：'+details.command:'';
  /** pluginManager applied it, but the profile could not be read back: the installed list may still say 「需重启」. */
  const baselineText=result=>result?.restartBaseline?.updated===false?'；但应用库没能读回 profile（'+result.restartBaseline.code+'），已安装列表可能仍显示「需重启」':'';
  /** rc.10 install recovery result: only an item-by-item readback that matched the baseline is shown as restored. */
  const recoveryText=recovery=>{if(!recovery)return'';
    if(recovery.status==='not-needed')return'；安装前状态未被改动（已逐项读回）';
    if(recovery.status==='restored')return recovery.mode==='upgrade'?'；已恢复到原版本 '+recovery.previousVersion+'（已逐项读回）':'；已恢复到安装前状态（已逐项读回）';
    const residue=(recovery.residue??[]).map(row=>row.item+(row.reason?'·'+row.reason:'')).join('、');
    return'；恢复失败'+(recovery.error?'：'+recovery.error.code:'')+'，未恢复：'+(residue||'未知')+(recovery.originals?.dir?'，安装前原件：'+recovery.originals.dir:'')+'。未安装成功，也未回到安装前状态，需要人工处理';};
  // rc.28 market: fixed filters first (everything / applications / plugins), then every category the catalog itself reported.
  const BASE_FILTERS=[['','全部'],['hanamesh-app','应用'],['plugin','插件']];
  const KIND_TEXT={application:'应用',plugin:'插件',listing:'仅收录'};
  const STATE_TEXT={registered:'已安装',installed:'已安装','installed-not-loaded':'需重启','uninstalled-not-unloaded':'已卸载 · 需重启','runtime-missing':'缺运行时',invalid:'包无效'};
  // Mirrors PROTECTED_PACKAGES on the host: the suite is never offered an uninstall button (the host answers 403 anyway).
  const PROTECTED=new Set(['@hanamesh/dsh-app-host','hanamesh-core','hanamesh-usage','hanamesh-brand','@hanamesh/dsh-core','@hanamesh/dsh-usage']);
  function RestartNotice({reason}){
    return h('p',{role:'status',className:'hm-restart-notice','data-hanamesh-restart':'required'},h('strong',null,'需重新打开客户端'),' ',reason??'插件更改需要重新打开客户端后生效。',' ',h('span',{className:'hm-restart-hint'},'请完全退出 HanaMesh 客户端或 DSH 后重新打开；关闭窗口不等于退出。'));
  }

  // rc.32: the same market page serves two surfaces — the shell overlay behind the sidebar 「市场」 button
  // (`embedded` false) and the Extension Management 「市场」 tab through the `market` seat (`embedded` true,
  // always visible, no close button, `preferredSubsectionId` decides which subsection comes first).
  // A view is a lease, not a permanent anonymous reference. The host's returned expiry determines
  // the renew cadence; serial requests use the same credential and cleanup explicitly releases it.
  function holdViewLease(receipt,onError){
    const lease={viewId:receipt.lease.viewId,leaseToken:receipt.leaseToken};
    let expiresAt=receipt.lease.expiresAt,timer,controller,closed=false,renewing=false,closeTask;
    const terminal=new Set(['LEASE_EXPIRED','LEASE_NOT_OWNED','INSTANCE_NOT_READY','HOST_CLOSED','UNAUTHENTICATED','FORBIDDEN']);
    const schedule=()=>{if(!closed&&expiresAt>Date.now())timer=setTimeout(()=>void renew(),Math.max(1,Math.floor((expiresAt-Date.now())/3)));};
    const renew=async()=>{
      if(closed||renewing)return;
      renewing=true;clearTimeout(timer);
      controller=new AbortController();
      try{const next=await request('/apps/heartbeat',{method:'POST',body:JSON.stringify(lease),signal:controller.signal});
        if(closed)return;expiresAt=next.expiresAt;schedule();
      }catch(error){if(closed)return;const code=String(error.message??error);onError(code,terminal.has(code));if(!terminal.has(code))schedule();}
      finally{renewing=false;}
    };
    schedule();
    return{renew,close(){
      closed=true;clearTimeout(timer);controller?.abort();
      return closeTask??=request('/apps/close',{method:'POST',body:JSON.stringify(lease),keepalive:true}).catch(error=>{closeTask=undefined;throw error;});
    }};
  }
  const VERIFICATION_CALLS=[
    {method:'GET',path:'/hanamesh/library/install-target',sample:{}},
    {method:'GET',path:'/hanamesh/library',sample:{category:''}},
    {method:'GET',path:'/hanamesh/library/target',sample:{itemId:'example.notes',packageName:'example-notes',contractVersion:'1'}},
    {method:'POST',path:'/hanamesh/library/install',sample:{itemId:'example.notes',packageName:'example-notes',contractVersion:'1'}},
    {method:'GET',path:'/hanamesh/library/events',sample:{after:0}},
    {method:'GET',path:'/hanamesh/library/installedPlugins',sample:{}},
    {method:'GET',path:'/hanamesh/apps',sample:{}},
    {method:'POST',path:'/apps/open',sample:{appId:'notes',deploymentId:'local',viewId:'verification-view'}},
    {method:'POST',path:'/apps/resume',sample:{viewId:'verification-view',leaseToken:''}},
    {method:'POST',path:'/apps/heartbeat',sample:{viewId:'verification-view',leaseToken:''}},
    {method:'POST',path:'/apps/close',sample:{viewId:'verification-view',leaseToken:''}},
  ];
  function LibraryOverlay({embedded,preferredSubsectionId,verification=false}={}){
    const[visible,setVisible]=React.useState(embedded?true:libraryVisible),[snapshot,setSnapshot]=React.useState(null),[error,setError]=React.useState(''),[receipt,setReceipt]=React.useState(null),[query,setQuery]=React.useState(''),[filter,setFilter]=React.useState(''),[extra,setExtra]=React.useState([]),[pending,updatePending]=React.useState(pendingOperations),[seenCategories,setSeenCategories]=React.useState([]),[changed,setChanged]=React.useState(false),[openingAppId,setOpeningAppId]=React.useState(null),[closing,setClosing]=React.useState(false);
    const[target,updateTarget]=React.useState(targetSelection),[targetItemId,setTargetItemId]=React.useState(''),[targetPackageName,setTargetPackageName]=React.useState('');
    const[verificationCall,setVerificationCall]=React.useState('GET /hanamesh/library/install-target'),[verificationInput,setVerificationInput]=React.useState('{}'),[verificationOutput,setVerificationOutput]=React.useState(null),[verifying,setVerifying]=React.useState(false);
    const verificationBusy=React.useRef(false);
    const verify=async()=>{
      if(verification!==true||verificationBusy.current)return;
      verificationBusy.current=true;setVerifying(true);
      try{
        const call=VERIFICATION_CALLS.find(call=>call.method+' '+call.path===verificationCall);
        const input=JSON.parse(verificationInput);
        if(!call||!input||typeof input!=='object'||Array.isArray(input))throw new Error('INVALID_INPUT');
        // Even the test panel sends installations through the normal explicit confirmation.
        const result=call.path==='/hanamesh/library/install'?await openInstallTarget(input):call.method==='POST'?await request(call.path,{method:'POST',body:JSON.stringify(input)}):await request(call.path+(Object.keys(input).length?'?'+new URLSearchParams(input):''));
        setVerificationOutput(result);
      }catch(error){setVerificationOutput(error.response??{error:{code:String(error.message??error)}});}
      finally{verificationBusy.current=false;setVerifying(false);}
    };
    React.useEffect(()=>{targetListeners.add(updateTarget);pendingListeners.add(updatePending);return()=>{targetListeners.delete(updateTarget);pendingListeners.delete(updatePending);};},[]);
    React.useEffect(()=>{if(embedded)return;libraryListeners.add(setVisible);return()=>libraryListeners.delete(setVisible);},[embedded]);
    const heldView=React.useRef(null),mounted=React.useRef(true),surfaceVisible=React.useRef(visible),surfaceEpoch=React.useRef(0),opening=React.useRef(null);
    surfaceVisible.current=visible;
    const frame=React.useRef(null);
    React.useEffect(()=>{
      if(!receipt?.uiUrl||!globalThis.location?.href?.startsWith('dsh-app://app/'))return;
      const url=new URL(receipt.uiUrl),challenge=url.pathname.slice('/__hanamesh_bootstrap/'.length);
      if(!url.pathname.startsWith('/__hanamesh_bootstrap/'))return;
      let active=true,issued=false;
      const receive=async event=>{
        const exact=event.origin===url.origin&&event.source===frame.current?.contentWindow;
        if(!exact||event.data?.challenge!==challenge)return;
        console.info('HM_WORKSPACE_PROOF',JSON.stringify({origin:event.origin,window:true,type:event.data.type}));
        if(event.data.type==='hm-bootstrap-ready')event.source.postMessage({type:'hm-bootstrap-parent',challenge},url.origin);
        if(event.data.type==='hm-bootstrap-proof'&&!issued){
          issued=true;
          try {
            const result=await request('/apps/bootstrap-authorize',{method:'POST',body:JSON.stringify({viewId:receipt.lease.viewId,
              leaseToken:receipt.leaseToken,gatewayOrigin:url.origin,challenge})});
            if(active&&event.source===frame.current?.contentWindow)event.source.postMessage({type:'hm-bootstrap-authorize',challenge,authorization:result.authorization},url.origin);
          }catch(error){if(active){setError(String(error.message??'GATEWAY_AUTHORIZATION_DENIED'));console.info('HM_WORKSPACE_AUTHORIZATION_DENIED');}}
        }
      };
      globalThis.addEventListener('message',receive);return()=>{active=false;globalThis.removeEventListener('message',receive);};
    },[receipt]);

    React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    React.useEffect(()=>{
      if(!receipt)return;
      const view=holdViewLease(receipt,(code,terminal)=>{setError(code);if(terminal)setReceipt(null);});
      if(!visible){void view.close().catch(()=>{});setReceipt(null);return;}
      heldView.current=view;
      const release=()=>{void view.close().catch(()=>{});};
      const pagehide=()=>{release();setReceipt(null);};
      const foreground=()=>{if(document.visibilityState==='visible')void view.renew();};
      globalThis.addEventListener?.('pagehide',pagehide);
      globalThis.addEventListener?.('pageshow',foreground);
      document.addEventListener?.('visibilitychange',foreground);
      return()=>{if(heldView.current===view)heldView.current=null;globalThis.removeEventListener?.('pagehide',pagehide);globalThis.removeEventListener?.('pageshow',foreground);document.removeEventListener?.('visibilitychange',foreground);release();};
    },[receipt]);
    React.useEffect(()=>{
      surfaceEpoch.current+=1;
      if(!visible){opening.current=null;setOpeningAppId(null);void heldView.current?.close().catch(()=>{});setReceipt(null);}
    },[visible]);
    // `plugin` is a client-side view (every npm entry that is not an application); every other filter is a provider category.
    const params=React.useCallback(cursor=>{const p=new URLSearchParams();if(query)p.set('q',query);p.set('category',filter==='plugin'?'':filter);if(cursor)p.set('cursor',cursor);return'?'+p.toString();},[query,filter]);
    const remember=page=>setSeenCategories(list=>[...new Set([...list,...(page.categories??[])])].sort());
    const load=React.useCallback(async()=>{try{setError('');setExtra([]);const page=await request('/hanamesh/library'+params());setSnapshot(page);remember(page);}catch(e){setError(String(e.message??e));}},[params]);
    const more=async()=>{try{const cursor=(extra.at(-1)??snapshot)?.page?.nextCursor;if(!cursor)return;const next=await request('/hanamesh/library'+params(cursor));setExtra(list=>[...list,next]);remember(next);}catch(e){if(String(e.message??e)==='CATALOG_CHANGED'){setSnapshot(null);setExtra([]);}setError(String(e.message??e));}};
    React.useEffect(()=>{if(visible)void load();},[visible,load]);
    React.useEffect(()=>{if(visible&&['installed','installed-live'].includes(target?.status))void load();},[visible,load,target?.status]);
    // rc.18: install/provision/uninstall are 202 + events. Track the operation per card so the user sees
    // 「安装中…」 and, on failure, the code with a readable reason (user 2026-09-20: clicked install, nothing happened).
    const operate=async(path,body,key,label,awaitReadback=false)=>{if(pendingOperations[key]?.busy)return;setError('');setPending(p=>({...p,[key]:{label,text:label+'中…',busy:true}}));try{const started=await request(path,{method:'POST',body:JSON.stringify(body)});const {operationId}=started;let after=0;const deadline=Date.now()+600000;let outcome=started.status==='already-installed'?{ok:true}:null;while(!outcome&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,1000));const feed=await request('/hanamesh/library/events?after='+after);after=feed.sequence??after;for(const event of feed.events??[]){if(event.operationId!==operationId)continue;if(event.type.endsWith('-done'))outcome={ok:true,result:event.result};else if(event.type.endsWith('-failed'))outcome={ok:false,code:event.code??'LIBRARY_OPERATION_FAILED',recovery:event.recovery,details:event.details};}if(feed.resetRequired&&!outcome&&!feed.operations?.includes(operationId))outcome={ok:false,unknown:true,code:'OPERATION_RESULT_UNAVAILABLE'};}
      if(!outcome)outcome={ok:false,code:'OPERATION_TIMEOUT'};
      const liveLoaded=outcome.ok&&outcome.result?.status==='applied';
      if(outcome.ok&&!awaitReadback&&!liveLoaded)setChanged(true);
      setPending(p=>({...p,[key]:outcome.ok?(awaitReadback?{label,text:label+'读回中…',busy:true}:{label,text:liveLoaded?label+'完成，已生效，可以直接使用'+baselineText(outcome.result):label+'完成，重启 DSH 后生效'}):{label,text:outcome.unknown?label+'结果不可追溯，请查看已安装列表后再明确操作':label+'失败：'+outcome.code+'（'+failureReason(outcome.code)+'）'+recoveryText(outcome.recovery)+suiteRecoveryText(outcome.details),failed:true}}));
      await load();return outcome;}catch(e){const code=String(e.message??e);setPending(p=>({...p,[key]:{label,text:label+'失败：'+code,failed:true}}));return{ok:false,code};}};
    const confirmTarget=async()=>{
      const selected=targetSelection;if(selected?.status!=='confirmation-required'||pendingOperations[selected.item.id]?.busy)return;
      setTarget({...selected,status:'installing'});
      const suite=selected.item.kind==='suite-upgrade';
      const outcome=await operate(suite?'/hanamesh/library/suite/upgrade':'/hanamesh/library/install',suite?{planId:selected.item.suiteUpgrade.planId}:{itemId:selected.item.id,packageName:selected.item.package.name},selected.item.id,suite?'升级套件':'安装',true);
      if(outcome){
        if(!outcome.ok){if(targetSelection?.item?.id===selected.item.id)setTarget({...targetSelection,status:outcome.unknown?'result-unavailable':suite?'suite-upgrade-failed':'failed',error:outcome.code,details:outcome.details});return;}
        if(suite){
          try{const snapshot=await request('/hanamesh/library/installedPlugins');if(!outcome.result.components.every(c=>snapshot.plugins.some(p=>p.packageName===c.name&&p.version===c.to&&p.active)))throw new Error('INSTALL_READBACK_MISMATCH');setPending(p=>({...p,[selected.item.id]:{label:'升级套件',text:'套件升级已读回，请完全退出并重新打开客户端。'}}));setChanged(true);setTarget({...selected,status:'installed'});}
          catch(error){setPending(p=>({...p,[selected.item.id]:{label:'升级套件',text:'套件版本读回失败，请检查三个组件。',failed:true}}));setTarget({...selected,status:'readback-failed',error:String(error.message??error)});}return;
        }
        try{const fresh=await request('/hanamesh/library/target?'+new URLSearchParams({itemId:selected.item.id,packageName:selected.item.package.name}));
          const row=fresh.item?.installed;
          if(row?.packageName!==selected.item.package.name||!['registered','installed','installed-not-loaded'].includes(row.state)||(outcome.result?.version&&row.version!==outcome.result.version))throw new Error('INSTALL_READBACK_MISMATCH');
          const live=outcome.result?.status==='applied';setPending(p=>({...p,[selected.item.id]:{label:'安装',text:live?'安装完成，已加载，可以直接使用（已按精确版本读回）'+baselineText(outcome.result):'安装完成，已按精确版本读回'}}));if(!live)setChanged(true);
          if(targetSelection?.item?.id===selected.item.id)setTarget({...fresh,status:live?'installed-live':'installed'});
        }catch(error){const text='安装读回失败：'+String(error.message??error);setPending(p=>({...p,[selected.item.id]:{label:'安装',text,failed:true}}));if(targetSelection?.item?.id===selected.item.id)setTarget({...targetSelection,status:'readback-failed',error:'安装操作已完成，但目录读回失败：'+String(error.message??error)});}
      }
    };
    const open=async installed=>{
      if(opening.current)return;
      const active={appId:installed.appId};opening.current=active;setOpeningAppId(installed.appId);
      const epoch=surfaceEpoch.current;
      let pendingReceipt=null;
      const abandoned=async next=>{
        if(mounted.current&&surfaceVisible.current&&surfaceEpoch.current===epoch)return false;
        await request('/apps/close',{method:'POST',body:JSON.stringify({viewId:next.lease.viewId,leaseToken:next.leaseToken}),keepalive:true});pendingReceipt=null;return true;
      };
      try{setError('');const deployment=installed.definition.deployments[0],viewId='hml-'+globalThis.crypto.randomUUID();
        let next=await request('/apps/open',{method:'POST',body:JSON.stringify({appId:installed.appId,deploymentId:deployment.id,viewId})});
        pendingReceipt=next;
        const deadline=Date.now()+120000;
        let renewAt=Date.now()+Math.max(1,Math.floor((next.lease.expiresAt-Date.now())/3));
        while(true){
          if(await abandoned(next))return;
          if(next.instance.status==='ready'){setReceipt(next);pendingReceipt=null;return;}
          if(!['reserved','starting'].includes(next.instance.status)||Date.now()>deadline)throw new Error(next.instance.errorCode??'INSTANCE_NOT_READY');
          await new Promise(resolve=>setTimeout(resolve,250));
          if(await abandoned(next))return;
          if(Date.now()>=renewAt){
            const lease=await request('/apps/heartbeat',{method:'POST',body:JSON.stringify({viewId,leaseToken:next.leaseToken})});
            next={...next,lease};renewAt=Date.now()+Math.max(1,Math.floor((lease.expiresAt-Date.now())/3));
          }
          const status=await request('/hanamesh/apps');
          if(await abandoned(next))return;
          const instance=(status.instances??[]).find(item=>item.id===next.instance.id);
          if(!instance)throw new Error('INSTANCE_NOT_READY');
          if(instance.status==='ready'){
            next=await request('/apps/resume',{method:'POST',body:JSON.stringify({viewId,leaseToken:next.leaseToken})});
            if(next.instance.status!=='ready')throw new Error(next.instance.errorCode??'INSTANCE_NOT_READY');
          }
          else next={...next,instance:{...next.instance,status:instance.status,errorCode:instance.errorCode}};
        }
      }catch(e){if(pendingReceipt){const lease=pendingReceipt;pendingReceipt=null;await request('/apps/close',{method:'POST',body:JSON.stringify({viewId:lease.lease.viewId,leaseToken:lease.leaseToken}),keepalive:true}).catch(()=>{});}if(mounted.current&&surfaceVisible.current)setError(String(e.message??e));}
      finally{if(opening.current===active){opening.current=null;if(mounted.current)setOpeningAppId(null);}}
    };
    const close=async()=>{if(closing)return;setClosing(true);try{await heldView.current?.close();setReceipt(null);setError('');}catch(e){setError(String(e.message??e));}finally{if(mounted.current)setClosing(false);}};
    if(!visible)return null;
    const pages=[snapshot,...extra].filter(Boolean),all=pages.flatMap(page=>page.items??[]),items=filter==='plugin'?all.filter(item=>item.kind==='plugin'||item.kind==='suite'):all,installed=snapshot?.installed??[],plugins=snapshot?.plugins??[],nextCursor=(extra.at(-1)??snapshot)?.page?.nextCursor??null;
    const restartRequired=changed||Boolean(snapshot?.restartRequired);
    const filters=[...BASE_FILTERS,...seenCategories.filter(c=>c!=='hanamesh-app').map(c=>[c,c])];
    const openButton=row=>h('button',{type:'button',disabled:Boolean(openingAppId),onClick:()=>void open(row)},openingAppId===row.appId?'打开中…':'打开');
    const card=item=>{const row=item.installed,op=pending[item.id],busy=op&&!op.failed&&op.text.endsWith('中…');const installBody={itemId:item.id,...(item.package?.name?{packageName:item.package.name}:{})};
      let action=h('span',null,'仅收录，不可安装'),state=null;
      if(row)state=h('span',{className:'hm-market-state','data-hanamesh-state':row.state},(STATE_TEXT[row.state]??row.state)+(row.version?' '+row.version:''));
      if(item.kind==='suite')return h('article',{key:item.id,'data-hanamesh-library-item':item.id,'data-hanamesh-kind':'suite'},h('h3',null,'HanaMesh 套件'),h('p',null,item.summary),h('p',null,item.suite?.status==='installed'?'已安装 · Core '+item.suite.version:item.suite?.status==='incomplete'?'套件不完整，请查看组件状态':'套件状态未知，请查看 Core 声明与阻断原因'),item.suite?.completeness?h('p',null,'Core 完整性：'+item.suite.completeness):null,...(item.suite?.components??[]).map(c=>h('p',{key:c.name},c.requiredRange?c.label+' · 要求 '+c.requiredRange+' · 实际 '+(c.actualVersion??'检测不到')+' · '+c.status:c.label+' · '+(c.version??'检测不到')+(c.active?'':' · 未启用'))),...(item.suite?.blocked??[]).map((row,i)=>h('p',{key:'blocked-'+i,role:'status'},row.code+(row.moduleName?' · '+row.moduleName:'')+(row.coreVersion?' · '+row.coreVersion:''))),item.suiteUpgradeUnavailable?h('p',{role:'status'},item.suiteUpgradeUnavailable):null,h('button',{type:'button',disabled:Boolean(item.suiteUpgradeUnavailable),onClick:()=>void openInstallTarget({itemId:'hanamesh:suite-upgrade'}).catch(()=>{})},'检查兼容升级'));
      if(busy)action=h('button',{type:'button',disabled:true},op.text);
      else if(item.kind!=='listing'&&!row)action=h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/install',installBody,item.id,'安装')},op?.failed?'重试安装':'安装');
      else if(row&&item.upgradeAvailable)action=h('span',{className:'hm-market-actions'},h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/install',installBody,item.id,'升级')},'升级到 '+item.latestVersion),row.state==='registered'?openButton(row):null);
      else if(row?.state==='runtime-missing')action=h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/provision',{appId:row.appId,packageName:row.packageName,runtimeItem:row.runtimeItem},item.id,'补齐运行时')},'补齐运行时');
      else if(row?.state==='registered')action=h('span',{className:'hm-market-actions'},openButton(row),h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/uninstall',{appId:row.appId,packageName:row.packageName,runtimeItem:row.runtimeItem},item.id,'卸载')},'卸载'));
      else if(row?.state==='installed')action=PROTECTED.has(row.packageName)?h('span',null,'HanaMesh 套件'):h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/plugins/uninstall',{packageName:row.packageName},item.id,'卸载')},'卸载');
      else if(row?.state==='uninstalled-not-unloaded')action=h('span',null,'已卸载，重启 DSH 后生效');
      else if(row)action=h('span',null,'已安装，重启 DSH 后生效');
      return h('article',{key:item.id,'data-hanamesh-library-item':item.id,'data-hanamesh-kind':item.kind},h('h3',null,item.displayName),h('p',null,item.summary),
        h('small',null,KIND_TEXT[item.kind]+' · '+(item.publisher?.name??'未知发布者')+' · '+(item.latestVersion??'—')+((item.categories??[]).length?' · '+item.categories.join('、'):'')),
        state,action,op&&!busy?h('p',{role:op.failed?'alert':'status',className:op.failed?'hm-library-failed':'hm-library-ok'},op.text):null);};
    const catalogSection=receipt?h('div',{className:'hm-app-frame'},h('div',null,h('strong',null,receipt.instance.appId),h('button',{type:'button',disabled:closing,onClick:()=>void close()},closing?'关闭中…':'关闭视图')),h('iframe',{ref:frame,src:receipt.uiUrl,title:receipt.instance.appId,sandbox:'allow-forms allow-modals allow-popups allow-same-origin allow-scripts'})):
      h('div',{className:'hm-library-grid',key:'catalog'},...items.map(card));
    const moreButton=nextCursor&&!receipt?h('button',{type:'button',className:'hm-library-more',key:'more',onClick:()=>void more()},'更多'):null;
    const installedSection=!receipt&&(installed.length||plugins.length)?h('section',{className:'hm-market-installed',key:'installed'},h('h2',null,'已安装'),h('ul',null,
        ...installed.map(row=>h('li',{key:'app:'+row.packageName,'data-hanamesh-installed':row.packageName},'应用 · '+(row.name??row.packageName)+' · '+row.packageName+' '+(row.version??'')+' · '+(STATE_TEXT[row.state]??row.state))),
        ...plugins.filter(row=>!PROTECTED.has(row.packageName)).map(row=>h('li',{key:'plugin:'+row.packageName,'data-hanamesh-installed':row.packageName},'插件 · '+row.packageName+' '+(row.version??'')+' · '+(STATE_TEXT[row.state]??row.state)+(row.bundle&&!row.active&&row.state==='installed'?'（未启用为 profile 层）':''),
          row.state==='installed'&&!PROTECTED.has(row.packageName)&&!pending['plugin:'+row.packageName]?h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/plugins/uninstall',{packageName:row.packageName},'plugin:'+row.packageName,'卸载')},'卸载'):pending['plugin:'+row.packageName]?h('span',{className:pending['plugin:'+row.packageName].failed?'hm-library-failed':'hm-library-ok'},' '+pending['plugin:'+row.packageName].text):null)))):null;
    // The seat owner may ask for a subsection to come first; `installed` is the only one it names today.
    const body=preferredSubsectionId==='installed'?[installedSection,catalogSection,moreButton]:[catalogSection,moreButton,installedSection];
    return h('section',{className:embedded?'hm-market hm-market-embedded':'hm-library-overlay hm-market'},
      h('header',null,h('div',null,h('h1',null,'HanaMesh 市场')),embedded?null:h('button',{type:'button',onClick:()=>setLibraryVisible(false)},'关闭')),
      h(MarketConflictNotice,null),h(HandoffIssueNotice,null),
      snapshot?.restartBaseline?.known===false?h('p',{role:'alert',className:'hm-library-failed'},'启动时没能读取 profile（'+snapshot.restartBaseline.code+'），「需重启」状态无法判断，下面的状态都按已加载显示'):null,
      verification===true?h('section',{className:'hm-install-target','aria-label':'安装目标开发小界面'},h('h2',null,'安装目标'),
        h('p',null,'输入目录条目 ID 或包名，市场查询当前目录后确认安装。'),
        h('form',{onSubmit:event=>{event.preventDefault();void openInstallTarget({...(targetItemId.trim()?{itemId:targetItemId.trim()}:{}),...(targetPackageName.trim()?{packageName:targetPackageName.trim()}:{} )}).catch(()=>{});}},
          h('input',{'aria-label':'目录条目 ID',value:targetItemId,placeholder:'itemId（可选）',onChange:event=>setTargetItemId(event.target.value)}),
          h('input',{'aria-label':'包名',value:targetPackageName,placeholder:'packageName（可选）',onChange:event=>setTargetPackageName(event.target.value)}),h('button',{type:'submit'},'查看安装目标'))):null,
        target?h('div',{role:target.status==='confirmation-required'?'dialog':'status','aria-label':'市场安装确认'},
          target.item?h('dl',null,h('dt',null,'插件名'),h('dd',null,target.item.displayName),h('dt',null,'包名'),h('dd',null,target.item.package.name),h('dt',null,'版本'),h('dd',null,target.item.latestVersion??'目录未提供版本'),h('dt',null,'来源'),h('dd',null,target.source?.kind==='fixture'?'测试目录（fixture）':target.source?.manifestUrl??'当前市场目录')):null,
          target.item?.suiteUpgrade?h('ul',null,...target.item.suiteUpgrade.components.map(c=>h('li',{key:c.name},c.label+'：'+c.from+' → '+c.to)),h('li',null,'确认后升级三个官方组件；需要完全退出并重新打开客户端。')):null,
          target.item?.suiteUpgrade?.registry?h('p',null,'Registry：'+target.item.suiteUpgrade.registry):null,
          ...(target.item?.suiteUpgrade?.blocked??target.details?.blocked??[]).map((row,i)=>h('p',{key:'suite-blocked-'+i,role:'status'},row.code+(row.moduleName?' · '+row.moduleName:'')+(row.coreVersion?' · '+row.coreVersion:''))),
          target.status==='confirmation-required'?h('div',null,h('button',{type:'button',onClick:()=>void confirmTarget()},'确认安装'),h('button',{type:'button',onClick:()=>{targetSequence++;void reportHandoff(targetSelection?.handoffId,'cancelled');setTarget({...targetSelection,status:'cancelled'});}},'取消')):
          h('p',{role:['failed','readback-failed','suite-upgrade-failed'].includes(target.status)?'alert':'status'},({resolving:'正在查询市场目录…',installing:'安装中…',installed:'安装完成，请查看已安装列表','installed-live':'安装完成，已加载，可以直接使用',cancelled:'已取消，未安装','result-unavailable':'安装结果不可追溯，请查看已安装列表；不会自动重试','already-installed':'已安装，无需重复安装',failed:'未安装：'+(target.error??pending[target.item?.id]?.text??'安装失败'),'readback-failed':target.error,'suite-upgrade-failed':suiteTargetFailure(target)})[target.status]),
          target.item?.source?h('div',{'aria-label':'目录条目来源'},h('p',null,target.item.source.sourceId+' · '+target.item.source.sourceRef),...(target.item.source.sourceLinks??[]).map((link,index)=>h('p',{key:index},h('a',{href:link.sourceUrl,target:'_blank',rel:'noopener noreferrer'},link.sourceId+' · '+link.sourceRef),h('small',null,' '+link.firstSeenAt+' / '+link.lastSeenAt)))):null,
          target.item&&pending[target.item.id]?h('p',{role:pending[target.item.id].failed?'alert':'status'},pending[target.item.id].text):null,
          ['installed','already-installed'].includes(target.status)&&target.item?.installed?.state==='registered'?openButton(target.item.installed):null):null,
      verification===true?h('section',{'aria-label':'C-MARKET 合约验证'},h('h2',null,'C-MARKET 合约验证'),
        h('p',null,'测试版；输入与输出仅供当前客户端验证。安装仍须在正常确认框确认。'),
        h('select',{'aria-label':'合约调用',value:verificationCall,onChange:event=>{const call=VERIFICATION_CALLS.find(call=>call.method+' '+call.path===event.target.value);if(call){setVerificationCall(event.target.value);setVerificationInput(JSON.stringify(call.sample,null,2));setVerificationOutput(null);}}},...VERIFICATION_CALLS.map(call=>h('option',{key:call.method+' '+call.path,value:call.method+' '+call.path},call.method+' '+call.path))),
        h('textarea',{'aria-label':'合约样例输入',value:verificationInput,onChange:event=>setVerificationInput(event.target.value)}),
        h('button',{type:'button',disabled:verifying,onClick:()=>void verify()},'调用合约'),
        h('pre',{'aria-label':'合约调用输出'},verificationOutput===null?'尚未调用':JSON.stringify(verificationOutput,null,2))):null,
      h('div',{className:'hm-library-toolbar'},h('input',{type:'search',placeholder:'搜索应用与插件',value:query,onChange:e=>setQuery(e.target.value),onKeyDown:e=>{if(e.key==='Enter')void load();}}),h('button',{type:'button',onClick:()=>void load()},'搜索'),
        h('select',{'aria-label':'类别',value:filter,onChange:e=>setFilter(e.target.value)},...filters.map(([value,label])=>h('option',{key:value||'all',value},label)))),
      restartRequired?h(RestartNotice,null):null,
      error?h('p',{role:'alert'},error):null,
      ...body);
  }
  /** The `market` seat object read by the shell's Extension Management panel. */
  function createMarketSeat({verification=false}={}){
    return{
      render(options){return h(LibraryOverlay,{embedded:true,preferredSubsectionId:options?.preferredSubsectionId,...(verification===true||options?.verification===true?{verification:true}:{})});},
      setSettingsVisible(visible){setEntryVisible(visible!==false);},
      openInstallTarget,
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
  function claimMarketSeat(ctx,{verification=false}={}){
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
      try{dispose=ctx.provide(MARKET_SEAT,createMarketSeat({verification}));}catch{standDown();}
    })();
    return()=>{released=true;setMarketConflict('');setEntryVisible(true);dispose?.();};
  }
  const name='hanamesh-app-host-client',inject=['slots','locale'];
  // No cross-plugin reads here: the browser-side cordis context never carries host services such as hanameshCore
  // (dsh-client-modules boots its own root context); Core status lives in Core's own Settings section.
  function apply(ctx,{verification=false}={}){ctx.effect(()=>{const style=document.createElement('style');style.textContent='.hm-node-runtime{display:grid;gap:12px;max-width:900px;color:inherit}.hm-node-fields{display:grid;gap:10px}.hm-node-fields label{display:grid;gap:6px}.hm-node-runtime input,.hm-node-runtime select,.hm-node-runtime button{font:inherit;color:inherit;background:transparent;border:1px solid color-mix(in srgb,currentColor 30%,transparent);border-radius:8px;min-height:44px;padding:8px 12px;box-sizing:border-box;max-width:100%}.hm-node-runtime button{cursor:pointer}.hm-node-runtime button:hover:not(:disabled){background:color-mix(in srgb,currentColor 9%,transparent)}.hm-node-runtime button:focus-visible{outline:2px solid currentColor;outline-offset:2px}.hm-node-runtime button:disabled{opacity:.5;cursor:default}.hm-node-confirm,.hm-node-progress{border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:12px;padding:16px}.hm-node-confirm dl{display:grid;grid-template-columns:100px minmax(0,1fr);gap:8px}.hm-node-runtime dd{margin:0}.hm-node-runtime code,.hm-node-runtime dd{overflow-wrap:anywhere}.hm-node-runtime progress{width:100%}.hm-node-runtime [role=alert]{border-left:3px solid currentColor;padding-left:10px}'+'.hm-providers,.hm-library-sources{display:grid;gap:16px}.hm-providers table{width:100%;border-collapse:collapse}.hm-providers th,.hm-providers td{padding:8px;text-align:left;border-bottom:1px solid color-mix(in srgb,currentColor 14%,transparent)}.hm-provider-card{padding:16px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:12px}.hm-provider-row{display:grid;grid-template-columns:minmax(120px,1fr) auto minmax(180px,1fr) auto;gap:8px;align-items:center;margin:8px 0}.hm-source-row{display:grid;grid-template-columns:minmax(0,1fr) repeat(4,auto);gap:8px}.hm-source-row code{overflow-wrap:anywhere}.hm-source-add{display:flex;gap:8px}.hm-source-add input{flex:1}.hm-library-overlay{position:absolute;inset:0;z-index:30;pointer-events:auto;overflow:auto;padding:24px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}.hm-library-overlay button,.hm-library-overlay input,.hm-library-overlay select,.hm-market-embedded button,.hm-market-embedded input,.hm-market-embedded select{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}.hm-library-overlay>header{display:flex;justify-content:space-between;align-items:center}.hm-library-toolbar{display:flex;gap:8px;align-items:center;margin:8px 0}.hm-library-toolbar input[type=search]{flex:1;padding:6px 10px}.hm-library-more{margin:12px auto;display:block}.hm-library-failed{color:var(--dsw-alias-state-error-primary);margin:0}.hm-library-ok{color:var(--dsw-alias-state-success-primary);margin:0}.hm-restart-notice{padding:10px 12px;border:1px solid var(--dsw-alias-state-warn-primary);border-radius:8px;background:var(--dsw-alias-state-warn-tertiary);margin:8px 0}.hm-restart-link{margin-left:4px;font-weight:600}.hm-market-state{font-size:12px;color:var(--dsw-alias-label-secondary)}.hm-market-actions{display:flex;gap:8px;flex-wrap:wrap}.hm-market-embedded{display:block}.hm-market-embedded>header{display:flex;justify-content:space-between;align-items:center}.hm-market-conflict{padding:10px 12px;border:1px solid var(--dsw-alias-state-business-primary);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,transparent);margin:8px 0}.hm-install-target{display:grid;gap:8px;padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;margin:12px 0}.hm-install-target form{display:flex;gap:8px;flex-wrap:wrap}.hm-install-target input{flex:1;min-width:180px;padding:6px 10px}.hm-install-target dl{display:grid;grid-template-columns:80px 1fr;gap:6px}.hm-install-target dd{margin:0;overflow-wrap:anywhere}.hm-market-installed{margin-top:24px}.hm-market-installed ul{padding-left:18px;display:grid;gap:6px}.hm-library-toolbar select{padding:6px 10px}.hm-library-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}.hm-library-grid article{display:grid;gap:10px;padding:16px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:12px}.hm-app-frame{display:grid;grid-template-rows:auto 1fr;height:calc(100vh - 130px)}.hm-market-embedded>.hm-app-frame{position:fixed;inset:0;z-index:1001;height:100vh;box-sizing:border-box;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);padding:12px 16px}.hm-app-frame>div{display:flex;justify-content:space-between}.hm-app-frame iframe{width:100%;height:100%;border:0}';document.head.append(style);return()=>style.remove();},'hanamesh-app-host:style');
    ctx.effect(()=>ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'hanamesh-providers',order:18,label:'供应商'},ProvidersSection)),'hanamesh-app-host:providers');
    ctx.effect(()=>ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'hanamesh-library-sources',order:19,label:'市场目录源'},LibrarySourcesSection)),'hanamesh-app-host:library-sources');
    ctx.effect(()=>ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'hanamesh-node-runtime',order:20,label:'安装环境'},NodeRuntimeSection)),'hanamesh-app-host:node-runtime');
    ctx.effect(()=>ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'hanamesh-library-handoff',order:20,label:'网站安装交接'},HandoffSettingsSection)),'hanamesh-app-host:library-handoff');
    ctx.effect(()=>ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:'hanamesh-library',order:30},LibraryAction)),'hanamesh-app-host:library-action');
    ctx.effect(()=>ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'hanamesh-library-overlay',order:30},verification===true?()=>h(LibraryOverlay,{verification:true}):LibraryOverlay)),'hanamesh-app-host:library-overlay');
    ctx.effect(()=>claimMarketSeat(ctx,{verification}),'hanamesh-app-host:market-seat');
    ctx.effect(()=>{let stopped=false,timer;const tick=async()=>{await pollHandoffsVisibly();if(!stopped)timer=setTimeout(()=>void tick(),handoffPollMs);};void tick();return()=>{stopped=true;clearTimeout(timer);};},'hanamesh-app-host:website-handoff');
    ctx.effect(()=>{globalThis.addEventListener?.('hashchange',consumeInstallTargetHash);consumeInstallTargetHash();return()=>globalThis.removeEventListener?.('hashchange',consumeInstallTargetHash);},'hanamesh-app-host:install-target-navigation');}
  return{name,inject,apply,ProvidersSection,LibrarySourcesSection,HandoffSettingsSection,NodeRuntimeSection,LibraryAction,LibraryOverlay,MarketConflictNotice,createMarketSeat,openInstallTarget,
    MARKET_SEAT,MARKET_CONFLICT_TEXT,INSTALL_TARGET_HASH,INSTALL_TARGET_CONTRACT_VERSION,marketState:()=>({conflict:marketConflict,entryVisible})};
}});
