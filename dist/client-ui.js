/* Browser bundle for DSH client-modules. The Node condition of exports["./client"] remains the SDK. */
window.__ModuleLoader__.load({id:'@hanamesh/dsh-app-host',factory:function(require){'use strict';
  const React=require('react');
  const h=React.createElement;
  // Owned dictionaries; host locale remains the only language preference.
  const COPY={
  "zh": {
    "copy0": "自动",
    "copy1": "手动指定",
    "copy2": "无可用供应商",
    "copy3": "已停用",
    "copy4": "应用自管",
    "copy5": "应用默认（",
    "copy6": "应用默认",
    "copy7": "恢复",
    "copy8": "停用",
    "copy9": "供应商",
    "copy10": "查看可用的模型服务并选择应用使用的模型。密钥值不会显示。",
    "copy11": "名称",
    "copy12": "来源",
    "copy13": "状态",
    "copy14": "密钥提示",
    "copy15": "模型",
    "copy16": "在 DSH「模型」中管理模型服务；Coding OAuth 的开关在该插件的设置页。",
    "copy17": "应用使用的服务",
    "copy18": "应用会自动使用已配置且支持的供应商。可在下方选择模型；保留「应用默认」则使用应用的默认模型。「停用」会停止向该应用提供此服务。",
    "copy19": "应用",
    "copy21": "用途",
    "copy22": "尚无需要模型服务的已安装应用。",
    "copy64": "插件管理（推荐）",
    "copy65": "已有独立 Node（高级）",
    "copy66": "检查位置与空间",
    "copy67": "下载",
    "copy68": "校验 SHA-256",
    "copy69": "解压",
    "copy70": "验证独立 Node",
    "copy71": "保存运行时",
    "copy72": "保存并启用（已完成校验，不能再取消）",
    "copy73": "环境已就绪",
    "copy74": "检查已有环境",
    "copy75": "安装环境",
    "copy76": "应用运行使用独立 Node.js 24。点「准备安装环境」核对并确认；无需重启 DSH，也无需填写 Node 路径。",
    "copy77": "环境已就绪 · 应用运行自动使用独立 Node",
    "copy78": "尚未准备安装环境；确认前不会下载。",
    "copy79": "正在读取安装环境…",
    "copy80": "已有路径仅在高级方式生效。下载来源必须使用 HTTPS；版本只能选择已校验发行。修改设置后先保存，再重新确认。",
    "copy81": "保存环境设置",
    "copy82": "准备安装环境",
    "copy83": "刷新状态",
    "copy84": "确认准备安装环境",
    "copy85": "确认下载并准备",
    "copy86": "平台 ",
    "copy87": " · 最低 ",
    "copy88": "下载来源",
    "copy89": "下载体积",
    "copy90": "解压后文件",
    "copy91": "准备所需空间",
    "copy92": "存放位置",
    "copy93": "。确认后只从上述来源下载；不自动重试或换源。",
    "copy94": "完整校验值与检查说明",
    "copy95": "校验归档 SHA、文件所有权、平台与精确版本；Electron 包装脚本不会通过。",
    "copy96": "暂不准备",
    "copy97": "取消准备",
    "copy98": "诊断详情",
    "copy99": "当前自动绑定的路径",
    "copy100": "支持 macOS 13.5+（Apple Silicon / Intel）；Windows 暂不支持。",
    "copy174": "打开中…",
    "copy175": "打开",
    "copy189": "补齐运行时",
    "copy194": "关闭中…",
    "copy195": "关闭视图",
    "copy245": "本次操作未能完成。请查看技术详情中的准确原因，检查相关设置后再操作。",
    "copy246": "技术详情",
    "copy247": "安装环境管理方式",
    "copy248": "独立 Node 固定版本",
    "copy249": "Node 下载来源",
    "copy250": "独立 Node 存放位置",
    "copy251": "已有独立 Node 路径（高级）",
    "copy253": "Node.js MIT；归档内 LICENSE 保留其第三方声明",
    "copy255": "运行时记录与已校验的官方发行记录不一致。",
    "copy256": "请填写完整的安装环境设置。",
    "copy257": "请选择已校验的固定 Node 版本，不能填写 latest。",
    "copy258": "下载来源必须是没有账号、密码、查询参数的 HTTPS 地址。",
    "copy259": "请选择绝对的专用存放目录。",
    "copy260": "已有独立 Node 路径必须是绝对路径。",
    "copy278": "进度读取已中断，准备可能仍在进行。请点击「刷新状态」查看；不会自动重试。",
    "copy279": "DSH 模型设置",
    "copy280": "Coding OAuth 本地网关",
    "copy281": "已配置",
    "copy282": "尚未配置",
    "copy283": "暂时无法连接",
    "copy284": "网关已关闭",
    "copy285": "状态暂不可用",
    "copy286": "来源暂不可用",
    "copy287": "原始记录",
    "copy288": "操作",
    "copy289": "应用启动时按当前配置与应用声明匹配供应商并注入；这里只选择模型或撤回、恢复该连接的授权，不改变来源开关。",
    "copy300": "高级设置",
    "copy301": "支持 macOS 13.5+（Apple Silicon / Intel）。Windows 的安装、守护与取消验证尚未接通，本流程不声称支持 Windows。",
    "runtimeView0": "继续使用",
    "runtimeView1": "移除运行环境",
    "runtimeView2": "尚无已注册应用。请在「插件」页的 HanaMesh 市场查找。",
    "runtimeView3": "应用运行环境与模型路由",
    "runtimeView4": "已就绪",
    "runtimeView5": "缺少运行时",
    "runtimeView6": "完全退出后重新打开",
    "runtimeView7": "应用运行环境",
    "runtimeView8": "应用运行使用独立 Node.js 24。点「准备安装环境」核对并确认；无需重启 DSH，也无需填写 Node 路径。",
    "runtimeView9": "环境已就绪 · 应用运行自动使用独立 Node",
    "运行方式": "运行方式",
    "Node 版本": "Node 版本",
    "已有独立 Node 路径": "已有独立 Node 路径",
    "安装环境管理方式": "安装环境管理方式",
    "独立 Node 固定版本": "独立 Node 固定版本",
    "Node 下载来源": "Node 下载来源",
    "独立 Node 存放位置": "独立 Node 存放位置",
    "已有独立 Node 路径（高级）": "已有独立 Node 路径（高级）"
  },
  "en": {
    "copy0": "Automatic",
    "copy1": "Manually assigned",
    "copy2": "No available provider",
    "copy3": "Disabled",
    "copy4": "App-managed",
    "copy5": "App default (",
    "copy6": "App default",
    "copy7": "Restore",
    "copy8": "Disable",
    "copy9": "Providers",
    "copy10": "View available model services and choose a model for each app. Key values are never shown.",
    "copy11": "Name",
    "copy12": "Source",
    "copy13": "Status",
    "copy14": "Key hint",
    "copy15": "Models",
    "copy16": "Manage model services in DSH Models. Manage Coding OAuth in its own plugin settings.",
    "copy17": "Services used by apps",
    "copy18": "Apps automatically use configured providers they support. Choose a model below, or keep App default to use the app’s default model. Revoke stops this service from being supplied to the app.",
    "copy19": "App",
    "copy21": "Purpose",
    "copy22": "No installed apps need a model service yet.",
    "copy64": "Plugin-managed (recommended)",
    "copy65": "Existing standalone Node (advanced)",
    "copy66": "Checking location and space",
    "copy67": "Downloading",
    "copy68": "Verifying SHA-256",
    "copy69": "Extracting",
    "copy70": "Verifying standalone Node",
    "copy71": "Saving runtime",
    "copy72": "Saving and enabling (verified; cancellation is no longer available)",
    "copy73": "Environment ready",
    "copy74": "Checking existing environment",
    "copy75": "Installation environment",
    "copy76": "Prepare once for future installations. No DSH restart or Node path entry is needed. The client and system Node are unchanged.",
    "copy77": "Environment ready · future plugin operations use standalone Node automatically",
    "copy78": "Installation environment is not prepared. Nothing downloads before confirmation.",
    "copy79": "Reading installation environment…",
    "copy80": "The existing path is used only in advanced mode. Downloads require HTTPS and a verified release. After changing settings, save and confirm a new plan.",
    "copy81": "Save environment settings",
    "copy82": "Prepare installation environment",
    "copy83": "Refresh status",
    "copy84": "Confirm installation environment preparation",
    "copy85": "Confirm download and preparation",
    "copy86": "Platform ",
    "copy87": " · Minimum ",
    "copy88": "Download source",
    "copy89": "Download size",
    "copy90": "Extracted files",
    "copy91": "Space required",
    "copy92": "Storage location",
    "copy93": ". After confirmation, only the source above is used. No automatic retry or source switching.",
    "copy94": "Full checksum and verification details",
    "copy95": "Checks archive SHA, file ownership, platform and exact version. Electron wrapper scripts are rejected.",
    "copy96": "Not now",
    "copy97": "Cancel preparation",
    "copy98": "Technical details",
    "copy99": "Automatically selected executable",
    "copy100": "Supports macOS 13.5+ (Apple Silicon / Intel). Windows is not supported.",
    "copy174": "Opening…",
    "copy175": "Open",
    "copy189": "Prepare runtime",
    "copy194": "Closing…",
    "copy195": "Close view",
    "copy245": "This operation could not complete. Check the exact reason in Technical details and review the related settings before trying again.",
    "copy246": "Technical details",
    "copy247": "Environment management mode",
    "copy248": "Pinned standalone Node version",
    "copy249": "Node download source",
    "copy250": "Standalone Node storage location",
    "copy251": "Existing standalone Node path (advanced)",
    "copy253": "Node.js MIT; the archive LICENSE retains third-party notices",
    "copy255": "The runtime record does not match a verified official release.",
    "copy256": "Complete every installation environment setting.",
    "copy257": "Select a verified pinned Node version. The value latest is not accepted.",
    "copy258": "The download source must be an HTTPS URL without credentials or query parameters.",
    "copy259": "Choose an absolute path to a dedicated storage directory.",
    "copy260": "The existing standalone Node path must be absolute.",
    "copy278": "Progress updates stopped; preparation may still be running. Select Refresh status to check. No automatic retry will run.",
    "copy279": "DSH model settings",
    "copy280": "Coding OAuth local gateway",
    "copy281": "Configured",
    "copy282": "Not configured",
    "copy283": "Cannot connect right now",
    "copy284": "Gateway is off",
    "copy285": "Status unavailable",
    "copy286": "Source unavailable",
    "copy287": "Original record",
    "copy288": "Actions",
    "copy289": "At app startup, providers are matched to current configuration and the app declaration and injected. This page only selects models or revokes/restores authorization for that connection; source switches are unchanged.",
    "copy300": "Advanced settings",
    "copy301": "Supports macOS 13.5+ (Apple Silicon / Intel). Windows installation, guardian and cancellation verification are not connected; this flow does not support Windows.",
    "runtimeView0": "Continue using",
    "runtimeView1": "Remove runtime",
    "runtimeView2": "No applications are registered. Browse the HanaMesh tab on Plugins.",
    "runtimeView3": "Application runtime and model routing",
    "runtimeView4": "Ready",
    "runtimeView5": "Runtime missing",
    "runtimeView6": "Quit and reopen DSH",
    "runtimeView7": "Application runtime",
    "runtimeView8": "Apps use standalone Node.js 24. Choose Prepare installation environment to review and confirm. No DSH restart or Node path entry is needed.",
    "runtimeView9": "Environment ready · applications use standalone Node",
    "运行方式": "Runtime mode",
    "Node 版本": "Node version",
    "已有独立 Node 路径": "Existing standalone Node path",
    "安装环境管理方式": "Environment management mode",
    "独立 Node 固定版本": "Pinned standalone Node version",
    "Node 下载来源": "Node download source",
    "独立 Node 存放位置": "Standalone Node storage location",
    "已有独立 Node 路径（高级）": "Existing standalone Node path (advanced)"
  }
};
  const COPY_KEYS=new Map(Object.entries(COPY.zh).map(([key,text])=>[text,key]));
  let localeService=null;
  function t(text){if(typeof text==='function')return text();const key=COPY_KEYS.get(text);if(!key)return text;return localeService?localeService.bind('hanamesh.apphost')(key):COPY.zh[key];}
  function useLocale(){const[,update]=React.useState(0);React.useEffect(()=>localeService?.subscribe(()=>update(n=>n+1)),[]);}
  function FailureNotice({error}){const original=error?.response?.error??error,code=typeof original==='string'?original:original?.code??original?.message??String(original);const details=typeof original==='string'?original:JSON.stringify(original instanceof Error?{message:original.message}:original,null,2);return h('div',{role:'alert',className:'hm-failure'},h('p',null,t(error?.context==='node-progress'?'进度读取已中断，准备可能仍在进行。请点击「刷新状态」查看；不会自动重试。':'本次操作未能完成。请查看技术详情中的准确原因，检查相关设置后再操作。')),h('details',null,h('summary',null,t('技术详情')),h('pre',null,details)));}

  const request=async(path,init={})=>{
    const response=await globalThis.fetch.bind(globalThis)(path,{...init,headers:{'x-hanamesh-client':'workspace-v1',...(init.body?{'content-type':'application/json'}:{}),...init.headers}});
    const value=await response.json();if(!response.ok){const error=new Error(value?.error?.code??`HTTP_${response.status}`);error.response=value;throw error;}return value;
  };
  const entryId=entry=>entry.projection==='file'?`file:${entry.base??'home'}:${entry.path}`:`env:${entry.env}`;
  function ProvidersSection(){useLocale();
    const[providers,setProviders]=React.useState([]),[apps,setApps]=React.useState([]),[plans,setPlans]=React.useState({}),[error,setError]=React.useState('');
    const load=React.useCallback(async()=>{try{setError('');const[p,a]=await Promise.all([request('/hanamesh/router/providers'),request('/hanamesh/apps')]);
      setProviders(p.providers??[]);setApps(a.apps??[]);const rows=await Promise.all((a.apps??[]).map(async app=>[app.id,await request('/hanamesh/router/plan?appId='+encodeURIComponent(app.id))]));setPlans(Object.fromEntries(rows));}catch(e){setError(e);}},[]);
    React.useEffect(()=>{void load();},[load]);
    const mutate=async(path,body)=>{try{setError('');await request(path,{method:'POST',body:JSON.stringify(body)});await load();}catch(e){setError(e);}};
    const knownLabel=(labels,key,unknown)=>typeof key==='string'&&Object.hasOwn(labels,key)?labels[key]:unknown;
    const providerStates={configured:t('已配置'),absent:t('尚未配置'),unreachable:t('暂时无法连接'),'gateway-off':t('网关已关闭')};
    const providerSources={'dsh-models':t('DSH 模型设置'),'coding-oauth-gateway':t('Coding OAuth 本地网关')};
    const sourceRows=providers.map(provider=>h('tr',{key:provider.id},h('td',{'data-label':t('名称')},provider.displayName),h('td',{'data-label':t('来源')},knownLabel(providerSources,provider.source,t('来源暂不可用')),h('details',null,h('summary',null,t('原始记录')),h('pre',null,JSON.stringify({id:provider.id,source:provider.source,state:provider.state},null,2)))),h('td',{'data-label':t('状态')},knownLabel(providerStates,provider.state,t('状态暂不可用'))),h('td',{'data-label':t('密钥提示')},provider.keyHint??'—'),h('td',{'data-label':t('模型')},(provider.models??[]).join('、')||'—')));
    const stateText={auto:t('自动'),granted:t('手动指定'),missing:t('无可用供应商'),revoked:t('已停用'),'app-owned':t('应用自管')};
    const subjectText=item=>item.granted?(item.granted.kind==='provider'?item.granted.providerId:item.granted.ref??item.granted.key):'—';
    const acceptable=entry=>providers.find(p=>p.state==='configured'&&(!entry.providers?.length||entry.providers.includes(p.id)||(p.id==='coding-oauth-gateway'&&entry.providers.includes('openai'))));
    // One compact table for every app: app × slot → routed provider. Scales to many apps; no per-app card, no manual picker.
    const routeRows=apps.flatMap(app=>{const plan=plans[app.id];if(!plan)return[];const slots=(plan.items??[]).filter(item=>!item.derived);return slots.map((item,index)=>{const id=entryId(item.entry);
      const routed=item.state==='auto'||item.state==='granted',current=item.model??'',options=[...new Set([...(item.models??[]),...(current?[current]:[])])];
      const modelCell=!routed?'—':options.length?h('select',{value:current,onChange:e=>void mutate('/hanamesh/router/model',{appId:app.id,entryId:id,model:e.target.value})},h('option',{value:''},item.defaultModel?(t("应用默认（") + (item.defaultModel) + "）"):t('应用默认')),...options.map(m=>h('option',{key:m,value:m},m))):
        h('input',{type:'text',defaultValue:current,placeholder:item.defaultModel?(t("应用默认（") + (item.defaultModel) + "）"):t('应用默认'),onBlur:e=>{if(e.target.value.trim()!==current)void mutate('/hanamesh/router/model',{appId:app.id,entryId:id,model:e.target.value.trim()});}});
      return h('tr',{key:`${app.id}:${id}`},h('td',{'data-label':t('应用')},app.name),h('td',{'data-label':t('用途')},item.entry.purpose??'—'),h('td',{'data-label':t('供应商')},subjectText(item)),h('td',{'data-label':t('模型')},modelCell),h('td',{'data-label':t('状态')},knownLabel(stateText,item.state,t('状态暂不可用')),h('details',null,h('summary',null,t('原始记录')),h('pre',null,JSON.stringify({connection:item.entry.env??item.entry.path,state:item.state},null,2)))),
        h('td',{'data-label':t('操作')},item.state==='revoked'?h('button',{type:'button',onClick:()=>{const provider=acceptable(item.entry);if(provider)void mutate('/hanamesh/router/grant',{appId:app.id,entryId:id,subject:provider.ref?{kind:'api-key',ref:provider.ref}:{kind:'provider',providerId:provider.id}});}},t('恢复')):
          (item.state==='auto'||item.state==='granted')?h('button',{type:'button',onClick:()=>void mutate('/hanamesh/router/revoke',{appId:app.id,entryId:id})},t('停用')):null));});});
    return h('section',{className:'hm-providers'},h('h2',null,t('供应商')),h('p',null,t('查看可用的模型服务并选择应用使用的模型。密钥值不会显示。')),error?FailureNotice({error}):null,
      h('table',{className:'hm-provider-records'},h('thead',null,h('tr',null,...[t('名称'),t('来源'),t('状态'),t('密钥提示'),t('模型')].map(label=>h('th',{key:label},label)))),h('tbody',null,...sourceRows)),
      h('p',{className:'hm-provider-hint'},t('在 DSH「模型」中管理模型服务；Coding OAuth 的开关在该插件的设置页。')),
      h('h3',null,t('应用使用的服务')),
      h('p',{className:'hm-provider-hint'},t('应用会自动使用已配置且支持的供应商。可在下方选择模型；保留「应用默认」则使用应用的默认模型。「停用」会停止向该应用提供此服务。')),
      h('details',null,h('summary',null,t('技术详情')),h('p',null,t('应用启动时按当前配置与应用声明匹配供应商并注入；这里只选择模型或撤回、恢复该连接的授权，不改变来源开关。'))),
      routeRows.length?h('table',{className:'hm-provider-records'},h('thead',null,h('tr',null,...[t('应用'),t('用途'),t('供应商'),t('模型'),t('状态'),''].map((label,index)=>h('th',{key:index},label)))),h('tbody',null,...routeRows)):h('p',{className:'hm-provider-hint'},t('尚无需要模型服务的已安装应用。')));
  }
  function NodeRuntimeSection(){useLocale();
    const[value,setValue]=React.useState(null),[draft,setDraft]=React.useState(null),[plan,setPlan]=React.useState(null),[error,setError]=React.useState(''),[working,setWorking]=React.useState(false);
    const errorText=e=>e;
    const load=React.useCallback(async()=>{try{const next=await request('/hanamesh/apps/node-runtime');setValue(next);setDraft(current=>current??next.settings);setError('');return next;}catch(e){setError(errorText(e));return null;}},[]);
    React.useEffect(()=>{void load();},[load]);
    React.useEffect(()=>{if(!['preparing','committing'].includes(value?.operation?.state))return;let stopped=false,timer;
      const tick=async()=>{try{const next=await request('/hanamesh/apps/node-runtime');if(stopped)return;setValue(next);if(['preparing','committing'].includes(next.operation?.state))timer=setTimeout(()=>void tick(),1000);}catch(e){if(!stopped)setError({context:'node-progress',response:e.response,message:e.message??String(e)});}};
      timer=setTimeout(()=>void tick(),1000);return()=>{stopped=true;clearTimeout(timer);};},[value?.operation?.id,value?.operation?.state]);
    const action=async(path,body,receive)=>{setWorking(true);setError('');try{const next=await request('/hanamesh/apps/node-runtime/'+path,{method:'POST',body:JSON.stringify(body)});receive?.(next);}catch(e){setError(errorText(e));}finally{setWorking(false);}};
    const busy=working||['preparing','committing'].includes(value?.operation?.state),dirty=draft&&value&&JSON.stringify(draft)!==JSON.stringify(value.settings);
    const edit=(key,val)=>{setDraft({...draft,[key]:val});setPlan(null);};
    const field=(key,label,type='input')=>h('label',{key},label,h(type,{'data-node-setting':key,value:draft[key],disabled:busy,onChange:e=>edit(key,e.target.value)},type==='select'?key==='mode'?[h('option',{key:'managed',value:'managed'},t('插件管理（推荐）')),h('option',{key:'external',value:'external'},t('已有独立 Node（高级）'))]:value.versions.map(v=>h('option',{key:v,value:v},'Node.js '+v)):null));
    const mb=n=>(n/1000000).toFixed(1)+' MB';
    const phase={starting:t('检查位置与空间'),download:t('下载'),verify:t('校验 SHA-256'),extract:t('解压'),check:t('验证独立 Node'),promote:t('保存运行时'),bind:t('保存并启用（已完成校验，不能再取消）'),ready:t('环境已就绪'),restore:t('检查已有环境')};
    const op=value?.operation;
    return h('section',{className:'hm-node-runtime','data-hanamesh-node-runtime':''},h('h2',null,t('应用运行环境')),
      draft&&value?h('div',{className:'hm-node-fields'},h('button',{type:'button',disabled:busy||dirty||!value.supported||draft.mode!=='managed',onClick:()=>void action('plan',{},setPlan)},t('准备安装环境')),h('button',{type:'button',disabled:working,onClick:()=>void load()},t('刷新状态'))):null,
      h('p',null,t('应用运行使用独立 Node.js 24。点「准备安装环境」核对并确认；无需重启 DSH，也无需填写 Node 路径。')),
      error?FailureNotice({error}):null,
      value?h('p',{role:'status'},value.ready?t('环境已就绪 · 应用运行自动使用独立 Node'):value.supported?t('尚未准备安装环境；确认前不会下载。'):t(value.limitations)):h('p',null,t('正在读取安装环境…')),
      draft&&value?h('div',{className:'hm-node-fields'},field('mode',t(value.names.mode),'select'),field('version',t(value.names.version),'select'),
        h('button',{type:'button',disabled:busy||!dirty,onClick:()=>void action('settings',{settings:draft},next=>{setValue(next);setDraft(next.settings);setPlan(null);})},t('保存环境设置')),
        h('details',null,h('summary',null,t('高级设置')),field('sourceBase',t(value.names.sourceBase)),field('storageRoot',t(value.names.storageRoot)),field('externalBinary',t(value.names.externalBinary)),
        h('small',null,t('已有路径仅在高级方式生效。下载来源必须使用 HTTPS；版本只能选择已校验发行。修改设置后先保存，再重新确认。')))):null,
      plan?h('div',{className:'hm-node-confirm',role:'region','aria-label':t('确认准备安装环境')},h('h3',null,t('确认下载并准备')),
        h('p',null,t('平台 ')+plan.platform+' · Node.js '+plan.version+t(' · 最低 ')+(plan.minimumOS??'macOS 13.5')),
        h('dl',null,h('dt',null,t('下载来源')),h('dd',null,plan.source),h('dt',null,t('下载体积')),h('dd',null,mb(plan.bytes)),h('dt',null,t('解压后文件')),h('dd',null,mb(plan.unpackedBytes)),h('dt',null,t('准备所需空间')),h('dd',null,mb(plan.requiredBytes)),h('dt',null,t('存放位置')),h('dd',null,plan.root)),
        h('p',null,t(plan.license)+t('。确认后只从上述来源下载；不自动重试或换源。')),
        h('details',null,h('summary',null,t('完整校验值与检查说明')),h('code',null,'SHA-256 '+plan.sha256),h('p',null,t('校验归档 SHA、文件所有权、平台与精确版本；Electron 包装脚本不会通过。'))),
        h('button',{type:'button',disabled:busy||dirty,onClick:()=>void action('prepare',{planId:plan.planId,confirm:true},next=>{setPlan(null);setValue({...value,...next});})},t('确认下载并准备')),
        h('button',{type:'button',disabled:busy,onClick:()=>setPlan(null)},t('暂不准备'))):null,
      op?h('div',{className:'hm-node-progress','aria-live':'polite'},h('p',null,phase[op.phase]??t('准备安装环境'),op.state==='preparing'?'…':''),
        op.state==='preparing'&&op.phase==='download'?h('div',null,h('progress',{value:op.bytes??0,...(op.total?{max:op.total}:{})}),h('p',null,mb(op.bytes??0)+(op.total?' / '+mb(op.total):''))):null,
        op.error?FailureNotice({error:op.error}):null,
        op.state==='preparing'?h('button',{type:'button',disabled:working,onClick:()=>void action('cancel',{operationId:op.id},()=>void load())},t('取消准备')):null,
        op.error?h('details',null,h('summary',null,t('诊断详情')),h('code',null,op.error.code)):null):null,
      value?.executable?h('details',null,h('summary',null,t('当前自动绑定的路径')),h('code',null,value.executable)):null,
      h('p',null,t('支持 macOS 13.5+（Apple Silicon / Intel）；Windows 暂不支持。')),h('details',null,h('summary',null,t('技术详情')),h('p',null,t('支持 macOS 13.5+（Apple Silicon / Intel）。Windows 的安装、守护与取消验证尚未接通，本流程不声称支持 Windows。'))));
  }

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
  function RestartNotice(){return h('p',{role:'status'},t('完全退出后重新打开'));}
  function ApplicationContent({visible=true}={}){useLocale();
    const[snapshot,setSnapshot]=React.useState(null),[error,setError]=React.useState(''),[receipt,setReceipt]=React.useState(null),[openingAppId,setOpeningAppId]=React.useState(null),[closing,setClosing]=React.useState(false),[working,setWorking]=React.useState(false);
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
    const load=React.useCallback(async()=>{try{setSnapshot(await request('/hanamesh/apps/runtime'));setError('');}catch(error){setError(error);}},[]);
    React.useEffect(()=>{if(visible)void load();},[visible,load]);
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
      }catch(e){if(pendingReceipt){const lease=pendingReceipt;pendingReceipt=null;await request('/apps/close',{method:'POST',body:JSON.stringify({viewId:lease.lease.viewId,leaseToken:lease.leaseToken}),keepalive:true}).catch(()=>{});}if(mounted.current&&surfaceVisible.current)setError(e);}
      finally{if(opening.current===active){opening.current=null;if(mounted.current)setOpeningAppId(null);}}
    };
    const close=async()=>{if(closing)return;setClosing(true);try{await heldView.current?.close();setReceipt(null);setError('');}catch(e){setError(e);}finally{if(mounted.current)setClosing(false);}};
    if(!visible)return null;
    const runtimeAction=async(path,row)=>{if(working)return;setWorking(true);try{setError('');await request(path,{method:'POST',body:JSON.stringify({appId:row.appId,packageName:row.packageName,runtimeItem:row.runtimeItem,...(path.endsWith('/remove')?{confirm:true}:{})})});await load();}catch(error){setError(error);}finally{setWorking(false);}};
    return h('section',{className:'hm-applications'},h('h2',null,t('继续使用')),error?FailureNotice({error}):null,
      receipt?h('div',{className:'hm-app-frame'},h('div',null,h('strong',null,receipt.instance.appId),h('button',{type:'button',disabled:closing,onClick:()=>void close()},closing?t('关闭中…'):t('关闭视图'))),h('iframe',{ref:frame,src:receipt.uiUrl,title:receipt.instance.appId,sandbox:'allow-forms allow-modals allow-popups allow-same-origin allow-scripts'})):
      h('div',{className:'hm-application-grid'},...(snapshot?.apps??[]).map(row=>h('article',{key:row.appId??row.packageName,'data-hanamesh-application':row.appId},h('h3',null,row.name??row.packageName),h('p',null,row.packageName+' · '+(row.version??'—')),row.state==='installed-not-loaded'?h(RestartNotice):h('p',null,t(({registered:'已就绪','runtime-missing':'缺少运行时','installed-not-loaded':'完全退出后重新打开'})[row.state]??row.state)),row.state==='registered'?h('button',{type:'button',disabled:Boolean(openingAppId),onClick:()=>void open(row)},openingAppId===row.appId?t('打开中…'):t('打开')):row.state==='runtime-missing'?h('button',{type:'button',disabled:working,onClick:()=>void runtimeAction('/apps/runtime/provision',row)},t('补齐运行时')):null,row.runtimeItem?h('button',{type:'button',disabled:working,onClick:()=>{if(globalThis.confirm?.('仅移除该应用声明的运行环境；应用数据会保留。继续吗？'))void runtimeAction('/apps/runtime/remove',row);}},t('移除运行环境')):null)),snapshot&&(snapshot.apps??[]).length===0?h('p',{role:'status'},t('尚无已注册应用。请在「插件」页的 HanaMesh 市场查找。')):null));
  }
  const APP_STYLES='.hm-applications,.hm-node-runtime,.hm-providers{min-width:0;max-width:100%;color:var(--dsw-alias-label-primary,CanvasText);font:14px/1.55 system-ui}.hm-application-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.hm-application-grid article{border:1px solid var(--dsw-alias-border-l1);border-radius:14px;padding:16px;background:var(--dsw-alias-bg-layer-2)}.hm-applications button,.hm-node-runtime button,.hm-providers button,.hm-node-runtime input,.hm-node-runtime select,.hm-providers input,.hm-providers select{font:inherit;color:inherit;min-height:40px;padding:8px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2);max-width:100%}.hm-applications button:disabled,.hm-node-runtime button:disabled{opacity:.5}.hm-app-frame{position:fixed;inset:0;z-index:1001;background:var(--dsw-alias-bg-layer-2);padding:12px 16px;display:grid;grid-template-rows:auto 1fr;gap:12px}.hm-app-frame>div{display:flex;justify-content:space-between}.hm-app-frame iframe{width:100%;height:100%;border:0}.hm-node-runtime,.hm-node-fields{display:grid;gap:12px}.hm-node-runtime label{display:grid;gap:6px}.hm-node-runtime progress{width:100%}.hm-node-confirm{padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px}.hm-node-confirm dl{display:grid;grid-template-columns:120px minmax(0,1fr);gap:8px}.hm-node-confirm dd{margin:0;overflow-wrap:anywhere}.hm-providers table{width:100%;border-collapse:collapse}.hm-providers td,.hm-providers th{padding:8px;text-align:left;border-bottom:1px solid var(--dsw-alias-border-l1)}.hm-providers td{overflow-wrap:anywhere}.hm-providers select,.hm-providers input{width:100%}.hm-failure pre{white-space:pre-wrap;overflow-wrap:anywhere}.hm-applications :focus-visible,.hm-node-runtime :focus-visible,.hm-providers :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}@media(max-width:640px){.hm-application-grid{grid-template-columns:minmax(0,1fr)}.hm-providers table,.hm-providers tbody,.hm-providers tr,.hm-providers td{display:block}.hm-providers thead{display:none}.hm-providers td:before{content:attr(data-label);display:block;font-weight:600}.hm-node-confirm dl{grid-template-columns:minmax(0,1fr)}}';
  const name='hanamesh-app-host-client',inject=['slots','locale'];
  function apply(ctx){localeService=ctx.locale??null;if(localeService)ctx.effect(()=>localeService.register('hanamesh.apphost',COPY),'hanamesh-app-host:locale');
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=APP_STYLES;document.head.append(style);return()=>style.remove();},'hanamesh-app-host:style');
    ctx.effect(()=>ctx.slots.inject('hanamesh.home.continue',()=>ctx.slots.register({name:'hanamesh.home.continue',id:'applications',order:10},ApplicationContent)),'hanamesh-app-host:applications');
    ctx.effect(()=>ctx.slots.inject('hanamesh.account.models',()=>ctx.slots.register({name:'hanamesh.account.models',id:'apphost-models',order:10},ProvidersSection)),'hanamesh-app-host:models');
    for(const key of ['@hanamesh/dsh-app-host#hanamesh-app-host','@hanamesh/hanamesh#hanamesh-app-host'])ctx.effect(()=>ctx.slots.inject('plugins.row.config',()=>ctx.slots.register({name:'plugins.row.config',key},RuntimeConfiguration)),'hanamesh-app-host:runtime-config:'+key);
    ctx.effect(()=>ctx.slots.inject('plugins.bundle.config',()=>ctx.slots.register({name:'plugins.bundle.config',key:'@hanamesh/dsh-app-host'},RuntimeConfiguration)),'hanamesh-app-host:bundle-config');
  }
  function RuntimeConfiguration({view='page'}={}){if(view==='summary')return h('span',null,t('应用运行环境与模型路由'));return h('div',null,h(ApplicationContent),h(NodeRuntimeSection),h(ProvidersSection));}
  return{name,inject,apply,ProvidersSection,NodeRuntimeSection,ApplicationContent,RuntimeConfiguration};
}});
