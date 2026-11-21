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
    "copy23": "Core 未提供套件声明",
    "copy24": "Core 套件声明无法用于精确安装。",
    "copy25": "兼容升级检查未通过，尚未执行安装：",
    "copy26": "检测不到结果",
    "copy27": "套件升级未完成：",
    "copy28": "。请核对当前版本；完全退出后可使用 HanaMesh 设置中的补齐命令修复并重新打开。",
    "copy29": "套件升级未完成或结果尚未确认：",
    "copy30": "。请核对已装版本；不会自动重试。",
    "copy47": "套件安装包来源",
    "copy48": "选择 HanaMesh 总包的 npm 安装包 registry。市场目录源提供浏览清单，在「市场目录源」中单独设置。",
    "copy49": "安装包来源",
    "copy50": "现有配置（默认）",
    "copy51": "Core 当前本机来源",
    "copy52": "现有 registry：",
    "copy53": "已保存选择：",
    "copy54": "现有配置",
    "copy55": "Core 来源：",
    "copy57": "保存选择不会安装。检查、确认和执行前都重新读取当前来源与 Core 兼容声明；来源变化后须重新查看并确认。",
    "copy58": "正在保存…",
    "copy59": "保存套件安装包来源",
    "copy60": "刷新来源状态",
    "copy61": "正在读取套件安装包来源…",
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
    "copy76": "准备一次，后续安装自动使用。无需重启 DSH，也无需填写 Node 路径；不会改动客户端或系统 Node。",
    "copy77": "环境已就绪 · 后续插件操作自动使用独立 Node",
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
    "copy123": "安装命令返回成功，但 profile 读回的版本与固定版本不一致",
    "copy125": "DSH 安装命令失败，请展开技术详情查看原始原因",
    "installAgeRejected": "宿主的依赖发布时间检查未通过。请核对安装目标包含精确版本并保留技术详情；若仍失败，请在 DSH 设置中检查并升级 DSH。",
    "installAffectedPackages": "受影响包：",
    "copy126": "当前宿主未提供安装参数（profile / node 路径）",
    "copy127": "目录里已没有这一项，刷新后重试",
    "copy129": "运行时归档下载失败，检查网络或来源",
    "copy130": "10 分钟内没有结果，可稍后重试",
    "copy131": "HanaMesh 套件自身不能从市场安装或卸载",
    "copy132": "先关闭该应用的所有视图再卸载",
    "copy133": "详细原因见宿主日志",
    "copy134": "；升级未完成，部分组件可能已改变。当前读回：",
    "copy135": "检测不到",
    "copy136": "（未启用）",
    "copy137": "。请完全退出客户端，使用补齐命令（仅 macOS / Linux 终端；Windows 安全命令暂未提供）修复并重新打开：",
    "copy302": "。请完全退出客户端，重新读取总包发布版本后修复并重新打开。",
    "copy138": "；但应用库没能读回 profile（",
    "copy139": "），已安装列表可能仍显示「需重启」",
    "copy140": "；安装前状态未被改动（已逐项读回）",
    "copy141": "；已恢复到原版本 ",
    "copy142": "（已逐项读回）",
    "copy143": "；已恢复到安装前状态（已逐项读回）",
    "copy144": "；恢复失败",
    "copy145": "，未恢复：",
    "copy146": "未知",
    "copy147": "，安装前原件：",
    "copy148": "。未安装成功，也未回到安装前状态，需要人工处理",
    "copy152": "已安装",
    "copy153": "需重启",
    "copy154": "已卸载 · 需重启",
    "copy155": "缺运行时",
    "copy156": "包无效",
    "copy157": "需重新打开客户端",
    "copy158": "插件更改需要重新打开客户端后生效。",
    "copy159": "请完全退出 HanaMesh 客户端或 DSH 后重新打开；关闭窗口不等于退出。",
    "copy160": "中…",
    "copy161": "读回中…",
    "copy162": "完成，已生效，可以直接使用",
    "copy163": "完成，重启 DSH 后生效",
    "copy164": "结果不可追溯，请查看已安装列表后再明确操作",
    "copy165": "失败：",
    "copy166": "升级套件",
    "copy167": "安装",
    "copy168": "套件升级已读回，请完全退出并重新打开客户端。",
    "copy169": "套件版本读回失败，请检查三个组件。",
    "copy170": "安装完成，已加载，可以直接使用（已按精确版本读回）",
    "copy171": "安装完成，已按精确版本读回",
    "copy172": "安装读回失败：",
    "copy173": "安装操作已完成，但目录读回失败：",
    "copy174": "打开中…",
    "copy175": "打开",
    "copy189": "补齐运行时",
    "copy190": "卸载",
    "copy194": "关闭中…",
    "copy195": "关闭视图",
    "copy204": "安装目标开发小界面",
    "copy205": "安装目标",
    "copy206": "输入目录条目 ID 或包名，市场查询当前目录后确认安装。",
    "copy207": "目录条目 ID",
    "copy208": "itemId（可选）",
    "copy209": "包名",
    "copy210": "packageName（可选）",
    "copy211": "查看安装目标",
    "copy213": "插件名",
    "copy216": "测试目录（fixture）",
    "copy217": "当前市场目录",
    "copy218": "确认后安装 HanaMesh 总包及其兼容组件；需要完全退出并重新打开客户端。",
    "copy219": "确认安装",
    "copy220": "取消",
    "copy221": "正在查询市场目录…",
    "copy222": "安装中…",
    "copy223": "安装完成，请查看已安装列表",
    "copy224": "安装完成，已加载，可以直接使用",
    "copy225": "已取消，未安装",
    "copy226": "安装结果不可追溯，请查看已安装列表；不会自动重试",
    "copy227": "已安装，无需重复安装",
    "copy228": "未安装：",
    "copy229": "安装失败",
    "copy230": "目录条目来源",
    "copy232": "测试版；输入与输出仅供当前客户端验证。安装仍须在正常确认框确认。",
    "copy233": "合约调用",
    "copy234": "合约样例输入",
    "copy235": "调用合约",
    "copy236": "合约调用输出",
    "copy237": "尚未调用",
    "copy244": "市场目录暂时无法读取。请检查目录源设置，或等待目录提供方更新后再读取。安装尚未开始。",
    "copy245": "本次操作未能完成。请查看技术详情中的准确原因，检查相关设置后再操作。",
    "copy246": "技术详情",
    "copy254": "Core 来源暂不可用。请检查 Core 插件及其来源设置。",
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
    "copy298": "使用说明",
    "copy300": "高级设置",
    "copy301": "支持 macOS 13.5+（Apple Silicon / Intel）。Windows 的安装、守护与取消验证尚未接通，本流程不声称支持 Windows。",
    "app0": "继续使用",
    "app1": "尚无已注册应用。请在「插件」页的 HanaMesh 市场查找。",
    "app2": "应用运行环境与模型路由",
    "app3": "AppHost 合约验证",
    "cl1Page14": "安装确认",
    "cl1Page15": "我已核对来源与安装目标",
    "cl1Page16": "设置与连接",
    "cl1Page17": "账号与设备",
    "cl1Page18": "模型连接",
    "cl1Page19": "环境与来源",
    "cl1Page20": "HanaMesh / 模型连接",
    "cl1Page21": "连接模型，保持掌控。",
    "cl1Page22": "登录账号不提供模型凭据。沿用宿主连接，按应用分别查看授权。",
    "cl1Page23": "对应页面暂不可用，请确认 HanaMesh Core 已启用。",
    "cl1Page25": "展开后读取当前设置；不会自动保存或安装。",
    "cl1Extra3": "精确版本",
    "copy241": "运行方式",
    "copy242": "Node 版本",
    "copy243": "已有独立 Node 路径"
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
    "copy23": "Core has not provided a suite declaration",
    "copy24": "Core’s suite declaration cannot be used for an exact installation.",
    "copy25": "Compatibility check failed; nothing was installed: ",
    "copy26": "No result available",
    "copy27": "Suite upgrade did not complete: ",
    "copy28": ". Check the current versions. Fully quit the client, use the repair command in HanaMesh settings, then reopen it.",
    "copy29": "Suite upgrade is incomplete or unconfirmed: ",
    "copy30": ". Check the installed versions. No automatic retry will run.",
    "copy47": "Suite package source",
    "copy48": "Choose the npm registry for the HanaMesh bundle. Browseable catalogs are configured separately in Market catalog sources.",
    "copy49": "Package source",
    "copy50": "Existing configuration (default)",
    "copy51": "Core’s current local source",
    "copy52": "Configured registry: ",
    "copy53": "Saved selection: ",
    "copy54": "Existing configuration",
    "copy55": "Core source: ",
    "copy57": "Saving does not install anything. The current source and Core compatibility declaration are read again before checking, confirming and installing. If the source changes, review and confirm again.",
    "copy58": "Saving…",
    "copy59": "Save suite package source",
    "copy60": "Refresh source status",
    "copy61": "Reading suite package source…",
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
    "copy123": "Installation command succeeded, but the version read from the profile differs from the confirmed version",
    "copy125": "DSH installation failed. Expand Technical details for the original cause",
    "installAgeRejected": "The host rejected a dependency release-age check. Verify the exact installation target and retain Technical details. If it still fails, check and upgrade DSH in Settings.",
    "installAffectedPackages": "Affected packages: ",
    "copy126": "This host has not provided installation parameters (profile / Node path)",
    "copy127": "This item is no longer in the catalog. Refresh before trying again",
    "copy129": "Runtime archive download failed. Check the network or source",
    "copy130": "No result within 10 minutes. Check the installed state before trying again",
    "copy131": "The HanaMesh suite cannot be installed or uninstalled through the market",
    "copy132": "Close all views of this app before uninstalling it",
    "copy133": "See the host logs for the detailed reason",
    "copy134": "; upgrade incomplete, and some components may have changed. Current readback: ",
    "copy135": "Not available",
    "copy136": " (disabled)",
    "copy137": ". Fully quit the client and run the repair command (macOS / Linux terminal only; no safe Windows command is supplied), then reopen: ",
    "copy302": ". Fully quit the client, read the published bundle version again, repair and reopen.",
    "copy138": "; the market could not read the profile (",
    "copy139": "), so the installed list may still show Restart required",
    "copy140": "; the pre-install state is unchanged (each item read back)",
    "copy141": "; restored to previous version ",
    "copy142": " (each item read back)",
    "copy143": "; restored to the pre-install state (each item read back)",
    "copy144": "; recovery failed",
    "copy145": "; not restored: ",
    "copy146": "Unknown",
    "copy147": "; original files before installation: ",
    "copy148": ". Installation failed and the previous state was not restored. Manual intervention is required",
    "copy152": "Installed",
    "copy153": "Restart required",
    "copy154": "Uninstalled · restart required",
    "copy155": "Runtime missing",
    "copy156": "Invalid package",
    "copy157": "Reopen the client",
    "copy158": "Plugin changes take effect after reopening the client.",
    "copy159": "Fully quit the HanaMesh client or DSH, then reopen it. Closing a window does not quit the app.",
    "copy160": " in progress…",
    "copy161": "Reading back…",
    "copy162": " complete and active; ready to use",
    "copy163": " complete; restart DSH to apply",
    "copy164": "The result is unavailable. Check the installed list before taking another action",
    "copy165": " failed: ",
    "copy166": "Upgrade suite",
    "copy167": "Install",
    "copy168": "Suite versions read back. Fully quit and reopen the client.",
    "copy169": "Suite version readback failed. Check all three components.",
    "copy170": "Installation complete and loaded; ready to use (exact version read back)",
    "copy171": "Installation complete; exact version read back",
    "copy172": "Installation readback failed: ",
    "copy173": "Installation operation completed, but catalog readback failed: ",
    "copy174": "Opening…",
    "copy175": "Open",
    "copy189": "Prepare runtime",
    "copy190": "Uninstall",
    "copy194": "Closing…",
    "copy195": "Close view",
    "copy204": "Installation target developer panel",
    "copy205": "Installation target",
    "copy206": "Enter a catalog item ID or package name. The market reads the current catalog before asking for confirmation.",
    "copy207": "Catalog item ID",
    "copy208": "itemId (optional)",
    "copy209": "Package name",
    "copy210": "packageName (optional)",
    "copy211": "Review installation target",
    "copy213": "Plugin name",
    "copy216": "Test catalog (fixture)",
    "copy217": "Current market catalog",
    "copy218": "Confirmation installs the HanaMesh bundle and its compatible components. Fully quit and reopen the client afterwards.",
    "copy219": "Confirm installation",
    "copy220": "Cancel",
    "copy221": "Reading market catalog…",
    "copy222": "Installing…",
    "copy223": "Installation complete. Check the installed list",
    "copy224": "Installation complete and loaded; ready to use",
    "copy225": "Cancelled; nothing installed",
    "copy226": "Installation result unavailable. Check the installed list; no automatic retry will run",
    "copy227": "Already installed; no need to install again",
    "copy228": "Not installed: ",
    "copy229": "Installation failed",
    "copy230": "Catalog item source",
    "copy232": "Test build. Inputs and outputs verify only this client. Installations still require normal confirmation.",
    "copy233": "Contract call",
    "copy234": "Contract sample input",
    "copy235": "Call contract",
    "copy236": "Contract output",
    "copy237": "Not called yet",
    "copy244": "The market catalog cannot be read. Check catalog source settings, or read it again after the provider updates it. Installation has not started.",
    "copy245": "This operation could not complete. Check the exact reason in Technical details and review the related settings before trying again.",
    "copy246": "Technical details",
    "copy254": "Core source is not available. Check Core and its source settings.",
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
    "copy298": "How it works",
    "copy300": "Advanced settings",
    "copy301": "Supports macOS 13.5+ (Apple Silicon / Intel). Windows installation, guardian and cancellation verification are not connected; this flow does not support Windows.",
    "app0": "Continue using",
    "app1": "No registered applications. Find apps in Plugins → HanaMesh Market.",
    "app2": "Application environment and model routing",
    "app3": "AppHost contract verification",
    "cl1Page14": "Confirm installation",
    "cl1Page15": "I reviewed the source and installation target",
    "cl1Page16": "Settings and connections",
    "cl1Page17": "Account and device",
    "cl1Page18": "Model connections",
    "cl1Page19": "Environment and sources",
    "cl1Page20": "HanaMesh / Model connections",
    "cl1Page21": "Connect models, stay in control.",
    "cl1Page22": "Signing in does not supply model credentials. Use host connections and review authorization for each app.",
    "cl1Page23": "This page is unavailable. Check that HanaMesh Core is enabled.",
    "cl1Page25": "Expand to read the current settings. Nothing is saved or installed automatically.",
    "cl1Extra3": "Exact version",
    "copy241": "Runtime mode",
    "copy242": "Node version",
    "copy243": "Existing standalone Node path"
  }
};
  const COPY_KEYS=new Map(Object.entries(COPY.zh).map(([key,text])=>[text,key]));
  let localeService=null;
  function t(text){if(typeof text==='function')return text();const key=COPY_KEYS.get(text);if(!key)return text;return localeService?localeService.bind('hanamesh.apphost')(key):COPY.zh[key];}
  function useLocale(){const[,update]=React.useState(0);React.useEffect(()=>localeService?.subscribe(()=>update(n=>n+1)),[]);}
  function FailureNotice({error}){const original=error?.response?.error??error,code=typeof original==='string'?original:original?.code??original?.message??String(original);const details=typeof original==='string'?original:JSON.stringify(original instanceof Error?{message:original.message}:original,null,2);return h('div',{role:'alert',className:'hm-failure'},h('p',null,t(error?.context==='node-progress'?'进度读取已中断，准备可能仍在进行。请点击「刷新状态」查看；不会自动重试。':code==='INVALID_CATALOG_MANIFEST'?'市场目录暂时无法读取。请检查目录源设置，或等待目录提供方更新后再读取。安装尚未开始。':'本次操作未能完成。请查看技术详情中的准确原因，检查相关设置后再操作。')),h('details',null,h('summary',null,t('技术详情')),h('pre',null,details)));}

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
  let targetSelection=null,targetSequence=0,pendingOperations={};
  const targetListeners=new Set(),pendingListeners=new Set();
  const INSTALL_TARGET_CONTRACT_VERSION='1';
  const targetQuery=input=>new URLSearchParams({...input,...(input.installTarget?{installTarget:JSON.stringify(input.installTarget)}:{})});
  const CORE_SUITE_FAILURES={CORE_SUITE_DECLARATION_MISSING:t('Core 未提供套件声明'),CORE_SUITE_DECLARATION_INVALID:t('Core 套件声明无法用于精确安装。')};
  const suiteTargetFailure=target=>target.previewFailed?t('兼容升级检查未通过，尚未执行安装：')+(t(CORE_SUITE_FAILURES[target.error])??target.error??t('检测不到结果')):t(CORE_SUITE_FAILURES[target.error])??(target.details?.stage==='suite-upgrade'?t('套件升级未完成：')+(target.error??t('检测不到结果'))+t('。请核对当前版本；完全退出后可使用 HanaMesh 设置中的补齐命令修复并重新打开。'):t('套件升级未完成或结果尚未确认：')+(target.error??t('检测不到结果'))+t('。请核对已装版本；不会自动重试。'));
  const setTarget=value=>{targetSelection=value;for(const listener of targetListeners)listener(value);};
  const setPending=update=>{pendingOperations=typeof update==='function'?update(pendingOperations):update;for(const listener of pendingListeners)listener(pendingOperations);};
  /** Resolve an exact catalog identity for the local application installation confirmation. */
  async function openInstallTarget(input,{versionSelection=false}={}){
    const sequence=++targetSequence;
    try{
      if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('INVALID_INPUT');
      // rc.8: optional contract declaration; absent keeps v1 semantics, an unsupported version is refused before any request.
      if(input.contractVersion!==undefined&&input.contractVersion!==INSTALL_TARGET_CONTRACT_VERSION)throw new Error('CONTRACT_VERSION_UNSUPPORTED');
      if(Object.keys(input).some(key=>!['itemId','packageName','contractVersion','installTarget'].includes(key)&&!(versionSelection&&key==='version'))||(!input.itemId&&!input.packageName)||
        (input.installTarget!==undefined&&(!input.itemId||!input.installTarget||typeof input.installTarget!=='object'||Array.isArray(input.installTarget)))||
        (input.itemId!==undefined&&(typeof input.itemId!=='string'||!input.itemId.length||input.itemId.length>160||/[\u0000-\u001f\u007f]/.test(input.itemId)))||
        (input.packageName!==undefined&&(typeof input.packageName!=='string'||input.packageName.length>214||!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(input.packageName))))throw new Error('INVALID_INPUT');
      setTarget({status:'resolving',input:{...input}});
      const query=targetQuery(input),resolved=await request((versionSelection?'/hanamesh/library/version-target?':'/hanamesh/library/target?')+query);
      if(sequence!==targetSequence)return{status:'superseded'};
      const item=resolved.item,op=pendingOperations[item.id];
      const status=op?.busy?'installing':['registered','installed','installed-not-loaded'].includes(item.installed?.state)&&!item.upgradeAvailable?'already-installed':'confirmation-required';
      setTarget({...resolved,status});return{status,itemId:item.id,packageName:item.package.name};
    }catch(error){if(sequence===targetSequence)setTarget({status:input?.itemId==='hanamesh:suite-upgrade'?'suite-upgrade-failed':'failed',error:String(error.message??error),diagnostic:{response:error.response,message:String(error.message??error)},...(input?.itemId==='hanamesh:suite-upgrade'?{previewFailed:true,details:error.response?.error?.details}:{})});throw error;}
  }
  function SuiteSourceSettingsSection(){useLocale();
    const[value,setValue]=React.useState(null),[mode,setMode]=React.useState('configured'),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false);
    const errorText=e=>e;
    const load=React.useCallback(async()=>{try{const next=await request('/hanamesh/library/suite-source');setValue(next);setMode(next.mode);setError('');}catch(e){setError(errorText(e));}},[]);
    React.useEffect(()=>{void load();},[load]);
    const save=async()=>{setBusy(true);try{const next=await request('/hanamesh/library/suite-source',{method:'POST',body:JSON.stringify({mode})});setValue(next);setMode(next.mode);setError('');}catch(e){setError(errorText(e));}finally{setBusy(false);}};
    const observation=value?.observation,state=observation?.state;
    return h('section',{className:'hm-node-runtime','data-hanamesh-suite-source':''},h('h2',null,t('套件安装包来源')),
      error?FailureNotice({error}):null,
      value?h('div',{className:'hm-suite-fields'},h('label',null,t('安装包来源'),h('select',{value:mode,disabled:busy,onChange:e=>setMode(e.target.value)},h('option',{value:'configured'},t('现有配置（默认）')),h('option',{value:'core'},t('Core 当前本机来源')))),
        h('button',{type:'button',disabled:busy||mode===value.mode,onClick:()=>void save()},busy?t('正在保存…'):t('保存套件安装包来源')),h('button',{type:'button',disabled:busy,onClick:()=>void load()},t('刷新来源状态')),
        h('p',null,t('现有 registry：'),h('code',null,value.configuredRegistry)),
        h('p',null,t('已保存选择：')+(value.mode==='core'?t('Core 当前本机来源'):t('现有配置'))),
        observation?.observable?h('div',null,h('p',{role:'status'},t('Core 来源：')+state.status+' · '+state.selection),state.registry?h('p',null,h('code',null,state.registry)):null,state.lastError?FailureNotice({error:state.lastError}):null):h('div',null,h('p',{role:'status'},t('Core 来源暂不可用。请检查 Core 插件及其来源设置。')),h('details',null,h('summary',null,t('技术详情')),h('code',null,observation?.code??'CORE_SUITE_SOURCE_MISSING'))),
        h('details',null,h('summary',null,t('使用说明')),h('p',null,t('选择 HanaMesh 总包的 npm 安装包 registry。市场目录源提供浏览清单，在「市场目录源」中单独设置。')),h('p',null,t('保存选择不会安装。检查、确认和执行前都重新读取当前来源与 Core 兼容声明；来源变化后须重新查看并确认。')))):h('p',null,t('正在读取套件安装包来源…')));
  }
  function NodeRuntimeSection(){useLocale();
    const[value,setValue]=React.useState(null),[draft,setDraft]=React.useState(null),[plan,setPlan]=React.useState(null),[error,setError]=React.useState(''),[working,setWorking]=React.useState(false);
    const errorText=e=>e;
    const load=React.useCallback(async()=>{try{const next=await request('/hanamesh/library/node-runtime');setValue(next);setDraft(current=>current??next.settings);setError('');return next;}catch(e){setError(errorText(e));return null;}},[]);
    React.useEffect(()=>{void load();},[load]);
    React.useEffect(()=>{if(!['preparing','committing'].includes(value?.operation?.state))return;let stopped=false,timer;
      const tick=async()=>{try{const next=await request('/hanamesh/library/node-runtime');if(stopped)return;setValue(next);if(['preparing','committing'].includes(next.operation?.state))timer=setTimeout(()=>void tick(),1000);}catch(e){if(!stopped)setError({context:'node-progress',response:e.response,message:e.message??String(e)});}};
      timer=setTimeout(()=>void tick(),1000);return()=>{stopped=true;clearTimeout(timer);};},[value?.operation?.id,value?.operation?.state]);
    const action=async(path,body,receive)=>{setWorking(true);setError('');try{const next=await request('/hanamesh/library/node-runtime/'+path,{method:'POST',body:JSON.stringify(body)});receive?.(next);}catch(e){setError(errorText(e));}finally{setWorking(false);}};
    const busy=working||['preparing','committing'].includes(value?.operation?.state),dirty=draft&&value&&JSON.stringify(draft)!==JSON.stringify(value.settings);
    const edit=(key,val)=>{setDraft({...draft,[key]:val});setPlan(null);};
    const field=(key,label,type='input')=>h('label',{key},label,h(type,{'data-node-setting':key,value:draft[key],disabled:busy,onChange:e=>edit(key,e.target.value)},type==='select'?key==='mode'?[h('option',{key:'managed',value:'managed'},t('插件管理（推荐）')),h('option',{key:'external',value:'external'},t('已有独立 Node（高级）'))]:value.versions.map(v=>h('option',{key:v,value:v},'Node.js '+v)):null));
    const mb=n=>(n/1000000).toFixed(1)+' MB';
    const phase={starting:t('检查位置与空间'),download:t('下载'),verify:t('校验 SHA-256'),extract:t('解压'),check:t('验证独立 Node'),promote:t('保存运行时'),bind:t('保存并启用（已完成校验，不能再取消）'),ready:t('环境已就绪'),restore:t('检查已有环境')};
    const op=value?.operation;
    return h('section',{className:'hm-node-runtime','data-hanamesh-node-runtime':''},h('h2',null,t('安装环境')),
      draft&&value?h('div',{className:'hm-node-fields'},h('button',{type:'button',disabled:busy||dirty||!value.supported||draft.mode!=='managed',onClick:()=>void action('plan',{},setPlan)},t('准备安装环境')),h('button',{type:'button',disabled:working,onClick:()=>void load()},t('刷新状态'))):null,
      h('p',null,t('准备一次，后续安装自动使用。无需重启 DSH，也无需填写 Node 路径；不会改动客户端或系统 Node。')),
      error?FailureNotice({error}):null,
      value?h('p',{role:'status'},value.ready?t('环境已就绪 · 后续插件操作自动使用独立 Node'):value.supported?t('尚未准备安装环境；确认前不会下载。'):t(value.limitations)):h('p',null,t('正在读取安装环境…')),
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

  const FAILURE_REASONS={...CORE_SUITE_FAILURES,INSTALL_READBACK_MISMATCH:t('安装命令返回成功，但 profile 读回的版本与固定版本不一致'),DSH_PLUGIN_FAILED:t('DSH 安装命令失败，请展开技术详情查看原始原因'),LIBRARY_INSTALL_UNAVAILABLE:t('当前宿主未提供安装参数（profile / node 路径）'),CATALOG_ITEM_MISSING:t('目录里已没有这一项，刷新后重试'),RUNTIME_ARCHIVE_UNAVAILABLE:t('运行时归档下载失败，检查网络或来源'),OPERATION_TIMEOUT:t('10 分钟内没有结果，可稍后重试'),PACKAGE_DENIED:t('HanaMesh 套件自身不能从市场安装或卸载'),INSTANCE_IN_USE:t('先关闭该应用的所有视图再卸载')};
  const failureReason=(code,details)=>{
    const diagnostic=code==='DSH_PLUGIN_FAILED'?details?.diagnostic??'':'',pnpmCode=diagnostic.match(/\bERR_PNPM_[A-Z0-9_]+\b/)?.[0];
    if(pnpmCode==='ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION'){
      const packages=[...new Set([...diagnostic.matchAll(/((?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)\s+was published\b/g)].map(match=>match[1]))];
      return pnpmCode+' · '+t('宿主的依赖发布时间检查未通过。请核对安装目标包含精确版本并保留技术详情；若仍失败，请在 DSH 设置中检查并升级 DSH。')+(packages.length?' '+t('受影响包：')+packages.join(', '):'');
    }
    return(pnpmCode?pnpmCode+' · ':'')+(t(FAILURE_REASONS[code])??t('详细原因见宿主日志'));
  };
  const operationNotice=op=>op?h('div',null,h('p',{role:op.failed?'alert':'status',className:op.failed?'hm-library-failed':'hm-library-ok',style:{overflowWrap:'anywhere'}},t(op.text)),op.diagnostic?h('details',null,h('summary',null,t('技术详情')),h('pre',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},op.diagnostic)):null):null;
  const suiteRecoveryText=details=>details?.stage==='suite-upgrade'?t('；升级未完成，部分组件可能已改变。当前读回：')+(details.actual?.components?.map(c=>c.label+' '+(c.version??t('检测不到'))+(c.active?'':t('（未启用）'))).join('；')||t('检测不到'))+(details.command?t('。请完全退出客户端，使用补齐命令（仅 macOS / Linux 终端；Windows 安全命令暂未提供）修复并重新打开：')+details.command:t('。请完全退出客户端，重新读取总包发布版本后修复并重新打开。')):'';
  /** pluginManager applied it, but the profile could not be read back: the installed list may still say 「需重启」. */
  const baselineText=result=>result?.restartBaseline?.updated===false?t('；但应用库没能读回 profile（')+result.restartBaseline.code+t('），已安装列表可能仍显示「需重启」'):'';
  /** rc.10 install recovery result: only an item-by-item readback that matched the baseline is shown as restored. */
  const recoveryText=recovery=>{if(!recovery)return'';
    if(recovery.status==='not-needed')return t('；安装前状态未被改动（已逐项读回）');
    if(recovery.status==='restored')return recovery.mode==='upgrade'?t('；已恢复到原版本 ')+recovery.previousVersion+t('（已逐项读回）'):t('；已恢复到安装前状态（已逐项读回）');
    const residue=(recovery.residue??[]).map(row=>row.item+(row.reason?'·'+row.reason:'')).join('、');
    return t('；恢复失败')+(recovery.error?'：'+recovery.error.code:'')+t('，未恢复：')+(residue||t('未知'))+(recovery.originals?.dir?t('，安装前原件：')+recovery.originals.dir:'')+t('。未安装成功，也未回到安装前状态，需要人工处理');};
  // rc.28 market: fixed filters first (everything / applications / plugins), then every category the catalog itself reported.
  const STATE_TEXT={registered:t('已安装'),installed:t('已安装'),'installed-not-loaded':t('需重启'),'uninstalled-not-unloaded':t('已卸载 · 需重启'),'runtime-missing':t('缺运行时'),invalid:t('包无效')};
  // Mirrors PROTECTED_PACKAGES on the host: the suite is never offered an uninstall button (the host answers 403 anyway).
  function RestartNotice({reason}){useLocale();
    return h('p',{role:'status',className:'hm-restart-notice','data-hanamesh-restart':'required'},h('strong',null,t('需重新打开客户端')),' ',reason??t('插件更改需要重新打开客户端后生效。'),' ',h('span',{className:'hm-restart-hint'},t('请完全退出 HanaMesh 客户端或 DSH 后重新打开；关闭窗口不等于退出。')));
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
    {method:'GET',path:'/hanamesh/library/node-runtime',sample:{}},
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
  function ApplicationContent({visible=true,verification=false}={}){useLocale();
    const[snapshot,setSnapshot]=React.useState(null),[error,setError]=React.useState(''),[receipt,setReceipt]=React.useState(null);
    const[pending,updatePending]=React.useState(pendingOperations),[changed,setChanged]=React.useState(false);
    const[openingAppId,setOpeningAppId]=React.useState(null),[closing,setClosing]=React.useState(false);
    const[acceptedTarget,setAcceptedTarget]=React.useState(null);
    const[target,updateTarget]=React.useState(targetSelection),[targetItemId,setTargetItemId]=React.useState(''),[targetPackageName,setTargetPackageName]=React.useState('');
    const[verificationCall,setVerificationCall]=React.useState('GET /hanamesh/library/node-runtime'),[verificationInput,setVerificationInput]=React.useState('{}'),[verificationOutput,setVerificationOutput]=React.useState(null),[verifying,setVerifying]=React.useState(false);
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
    const load=React.useCallback(async()=>{
      try{setSnapshot(await request('/hanamesh/library/installedPlugins'));setError('');}
      catch(error){setError(error);}
    },[]);
    React.useEffect(()=>{if(visible)void load();},[visible,load]);
    React.useEffect(()=>{if(visible&&['installed','installed-live'].includes(target?.status))void load();},[visible,load,target?.status]);
    // rc.18: install/provision/uninstall are 202 + events. Track the operation per card so the user sees
    // 「安装中…」 and, on failure, the code with a readable reason (user 2026-09-20: clicked install, nothing happened).
    const operate=async(path,body,key,label,awaitReadback=false)=>{label=COPY.zh[Object.keys(COPY.en).find(k=>COPY.en[k]===label)]??label;if(pendingOperations[key]?.busy)return;setError('');setPending(p=>({...p,[key]:{label,text:()=>(t(label)+t('中…')),busy:true}}));try{const started=await request(path,{method:'POST',body:JSON.stringify(body)});const {operationId}=started;let after=0;const deadline=Date.now()+600000;let outcome=started.status==='already-installed'?{ok:true}:null;while(!outcome&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,1000));const feed=await request('/hanamesh/library/events?after='+after);after=feed.sequence??after;for(const event of feed.events??[]){if(event.operationId!==operationId)continue;if(event.type.endsWith('-done'))outcome={ok:true,result:event.result};else if(event.type.endsWith('-failed'))outcome={ok:false,code:event.code??'LIBRARY_OPERATION_FAILED',recovery:event.recovery,details:event.details};}if(feed.resetRequired&&!outcome&&!feed.operations?.includes(operationId))outcome={ok:false,unknown:true,code:'OPERATION_RESULT_UNAVAILABLE'};}
      if(!outcome)outcome={ok:false,code:'OPERATION_TIMEOUT'};
      const liveLoaded=outcome.ok&&outcome.result?.status==='applied';
      if(outcome.ok&&!awaitReadback&&!liveLoaded)setChanged(true);
      setPending(p=>({...p,[key]:outcome.ok?(awaitReadback?{label,text:()=>(t(label)+t('读回中…')),busy:true}:{label,text:()=>(liveLoaded?t(label)+t('完成，已生效，可以直接使用')+baselineText(outcome.result):t(label)+t('完成，重启 DSH 后生效'))}):{label,text:()=>(outcome.unknown?t(label)+t('结果不可追溯，请查看已安装列表后再明确操作'):t(label)+t('失败：')+outcome.code+'（'+failureReason(outcome.code,outcome.details)+'）'+recoveryText(outcome.recovery)+suiteRecoveryText(outcome.details)),failed:true,diagnostic:outcome.details?.diagnostic}}));
      await load();return outcome;}catch(e){const code=String(e.message??e);setPending(p=>({...p,[key]:{label,text:()=>(t(label)+t('失败：')+code),failed:true}}));return{ok:false,code};}};
    const confirmTarget=async()=>{
      const selected=targetSelection;if(selected?.status!=='confirmation-required'||acceptedTarget!==selected||pendingOperations[selected.item.id]?.busy)return;
      setTarget({...selected,status:'installing'});
      const suite=selected.item.kind==='suite-upgrade';
      const reviewed={itemId:selected.item.id,packageName:selected.item.package.name,...(selected.item.installTarget?{installTarget:selected.item.installTarget}:{}),...(selected.item.selectedVersion?{version:selected.item.selectedVersion}:{})};
      const outcome=await operate(suite?'/hanamesh/library/suite/upgrade':selected.item.selectedVersion?'/hanamesh/library/version/install':'/hanamesh/library/install',suite?{planId:selected.item.suiteUpgrade.planId}:reviewed,selected.item.id,suite?t('升级套件'):t('安装'),true);
      if(outcome){
        if(!outcome.ok){if(targetSelection?.item?.id===selected.item.id)setTarget({...targetSelection,status:outcome.unknown?'result-unavailable':suite?'suite-upgrade-failed':'failed',error:outcome.code,details:outcome.details});return;}
        if(suite){
          try{const snapshot=await request('/hanamesh/library/suite/status');if(snapshot.status!=='installed'||snapshot.version!==outcome.result.version||!outcome.result.components.every(c=>snapshot.components.some(p=>p.name===c.name&&p.version===c.to&&p.active)))throw new Error('INSTALL_READBACK_MISMATCH');setPending(p=>({...p,[selected.item.id]:{label:t("升级套件"),text:()=>(t('套件升级已读回，请完全退出并重新打开客户端。'))}}));setChanged(true);setTarget({...selected,status:'installed'});}
          catch(error){setPending(p=>({...p,[selected.item.id]:{label:t("升级套件"),text:()=>(t('套件版本读回失败，请检查三个组件。')),failed:true}}));setTarget({...selected,status:'readback-failed',error:String(error.message??error)});}return;
        }
        try{const fresh=await request((selected.item.selectedVersion?'/hanamesh/library/version-target?':'/hanamesh/library/target?')+targetQuery(reviewed));
          const row=fresh.item?.installed;
          if(row?.packageName!==selected.item.package.name||!['registered','installed','installed-not-loaded'].includes(row.state)||(outcome.result?.version&&row.version!==outcome.result.version))throw new Error('INSTALL_READBACK_MISMATCH');
          const live=outcome.result?.status==='applied';setPending(p=>({...p,[selected.item.id]:{label:t("安装"),text:()=>(live?t('安装完成，已加载，可以直接使用（已按精确版本读回）')+baselineText(outcome.result):t('安装完成，已按精确版本读回'))}}));if(!live)setChanged(true);
          if(targetSelection?.item?.id===selected.item.id)setTarget({...fresh,status:live?'installed-live':'installed'});
        }catch(error){const text=()=>t('安装读回失败：')+String(error.message??error);setPending(p=>({...p,[selected.item.id]:{label:t("安装"),text,failed:true}}));if(targetSelection?.item?.id===selected.item.id)setTarget({...targetSelection,status:'readback-failed',error:t('安装操作已完成，但目录读回失败：')+String(error.message??error)});}
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
      }catch(e){if(pendingReceipt){const lease=pendingReceipt;pendingReceipt=null;await request('/apps/close',{method:'POST',body:JSON.stringify({viewId:lease.lease.viewId,leaseToken:lease.leaseToken}),keepalive:true}).catch(()=>{});}if(mounted.current&&surfaceVisible.current)setError(e);}
      finally{if(opening.current===active){opening.current=null;if(mounted.current)setOpeningAppId(null);}}
    };
    const close=async()=>{if(closing)return;setClosing(true);try{await heldView.current?.close();setReceipt(null);setError('');}catch(e){setError(e);}finally{if(mounted.current)setClosing(false);}};
    if(!visible)return null;
    const restartRequired=changed||Boolean(snapshot?.restartRequired);
    if(!visible)return null;
    const openButton=row=>h('button',{type:'button',disabled:Boolean(openingAppId),onClick:()=>void open(row)},
      openingAppId===row.appId?t('打开中…'):t('打开'));
    const applicationAction=(path,row,label)=>h('button',{type:'button',disabled:pending[row.packageName]?.busy,
      onClick:()=>void operate(path,{appId:row.appId,packageName:row.packageName,runtimeItem:row.runtimeItem},row.packageName,label)},t(label));
    return h('section',{className:'hm-applications'},h('h2',null,t('继续使用')),
      error?FailureNotice({error}):null,
      changed||snapshot?.restartRequired?h(RestartNotice):null,
      receipt?h('div',{className:'hm-app-frame'},h('div',null,h('strong',null,receipt.instance.appId),
        h('button',{type:'button',disabled:closing,onClick:()=>void close()},closing?t('关闭中…'):t('关闭视图'))),
        h('iframe',{ref:frame,src:receipt.uiUrl,title:receipt.instance.appId,sandbox:'allow-forms allow-modals allow-popups allow-same-origin allow-scripts'})):
      target?.status==='readback-failed'?null:h('div',{className:'hm-application-grid'},...(snapshot?.apps??[]).map(row=>h('article',{key:row.packageName,'data-hanamesh-installed':row.packageName},
        h('h3',null,row.name??row.packageName),h('p',null,row.packageName+' · '+(row.version??'—')),
        h('p',null,t(STATE_TEXT[row.state]??row.state)),row.state==='registered'?openButton(row):null,
        row.state==='runtime-missing'?applicationAction('/hanamesh/library/provision',row,'补齐运行时'):null,
        row.appId&&['registered','runtime-missing'].includes(row.state)?applicationAction('/hanamesh/library/uninstall',row,'卸载'):null,
        operationNotice(pending[row.packageName]))),
        snapshot?.apps?.length===0?h('p',{role:'status'},t('尚无已注册应用。请在「插件」页的 HanaMesh 市场查找。')):null),
      verification===true?h('section',{className:'hm-install-target','aria-label':t('安装目标开发小界面')},h('h2',null,t('安装目标')),
        h('p',null,t('输入目录条目 ID 或包名，市场查询当前目录后确认安装。')),
        h('form',{onSubmit:event=>{event.preventDefault();void openInstallTarget({...(targetItemId.trim()?{itemId:targetItemId.trim()}:{}),...(targetPackageName.trim()?{packageName:targetPackageName.trim()}:{} )}).catch(()=>{});}},
          h('input',{'aria-label':t('目录条目 ID'),value:targetItemId,placeholder:t('itemId（可选）'),onChange:event=>setTargetItemId(event.target.value)}),
          h('input',{'aria-label':t('包名'),value:targetPackageName,placeholder:t('packageName（可选）'),onChange:event=>setTargetPackageName(event.target.value)}),h('button',{type:'submit'},t('查看安装目标')))):null,
        target?h('div',{role:target.status==='confirmation-required'?'dialog':'status','aria-label':t('安装确认'),className:'hm-install-target hm-install-review'},h('h2',null,t('安装确认')),
          target.item?h('dl',null,h('dt',null,t('插件名')),h('dd',null,target.item.displayName),h('dt',null,t('包名')),h('dd',null,target.item.package.name),h('dt',null,t('来源')),h('dd',null,target.source?.kind==='fixture'?t('测试目录（fixture）'):target.source?.manifestUrl??t('当前市场目录'))):null,
          target.item?.installTarget?.source==='npm'?h('dl',{'data-npm-confirmation':true},h('dt',null,t('精确版本')),h('dd',null,target.item.installTarget.version)):null,
          target.item?.installTarget?.source==='github'?h('dl',{'data-github-confirmation':true},h('dt',null,t('来源仓库')),h('dd',null,'https://github.com/'+target.item.installTarget.repo),h('dt',null,t('固定 commit')),h('dd',null,target.item.installTarget.ref),...(target.item.installTarget.path?[h('dt',null,t('仓库子目录')),h('dd',null,target.item.installTarget.path)]:[])):null,
          target.item?.installTarget?(target.item.installTarget.allowBuild.length?h('div',{role:'alert','data-build-warning':true},h('strong',null,t('会在本机执行构建脚本')),h('p',null,target.item.installTarget.allowBuild.join(', ')),h('p',null,t('确认后将按名单允许构建；pnpm 会把许可保存到当前 profile。'))):h('p',null,t('未授予构建脚本许可'))):null,
          target.item?.suiteUpgrade?h('dl',{'data-suite-confirmation':true},h('dt',null,t('精确版本')),h('dd',null,target.item.suiteUpgrade.bundle.from+' → '+target.item.suiteUpgrade.bundle.to)):null,
          target.item?.suiteUpgrade?h('ul',null,...target.item.suiteUpgrade.components.map(c=>h('li',{key:c.name},c.label+'：'+c.from+' → '+c.to)),h('li',null,t('确认后安装 HanaMesh 总包及其兼容组件；需要完全退出并重新打开客户端。'))):null,
          target.item?.suiteUpgrade?.registry?h('p',null,'Registry：'+target.item.suiteUpgrade.registry):null,
          ...(target.item?.suiteUpgrade?.blocked??target.details?.blocked??[]).map((row,i)=>h('p',{key:'suite-blocked-'+i,role:'status'},row.code+(row.moduleName?' · '+row.moduleName:'')+(row.bundleVersion?' · HanaMesh '+row.bundleVersion:''))),
          target.status==='confirmation-required'?h('div',null,h('label',{className:'hm-install-ack'},h('input',{type:'checkbox','aria-label':t('我已核对来源与安装目标'),checked:acceptedTarget===target,onChange:event=>setAcceptedTarget(event.currentTarget.checked?target:null)}),t('我已核对来源与安装目标')),h('button',{type:'button',disabled:acceptedTarget!==target,onClick:()=>void confirmTarget()},t('确认安装')),h('button',{type:'button',onClick:()=>{targetSequence++;setTarget({...targetSelection,status:'cancelled'});}},t('取消'))):
          target.status==='failed'?FailureNotice({error:target.diagnostic??target.error}):h('p',{role:['readback-failed','suite-upgrade-failed'].includes(target.status)?'alert':'status'},({resolving:t('正在查询市场目录…'),installing:t('安装中…'),installed:t('安装完成，请查看已安装列表'),'installed-live':t('安装完成，已加载，可以直接使用'),cancelled:t('已取消，未安装'),'result-unavailable':t('安装结果不可追溯，请查看已安装列表；不会自动重试'),'already-installed':t('已安装，无需重复安装'),failed:t('未安装：')+(target.error??pending[target.item?.id]?.text??t('安装失败')),'readback-failed':target.error,'suite-upgrade-failed':suiteTargetFailure(target)})[target.status]),
          target.item?.source?h('div',{'aria-label':t('目录条目来源')},h('p',null,target.item.source.sourceId+' · '+target.item.source.sourceRef),...(target.item.source.sourceLinks??[]).map((link,index)=>h('p',{key:index},h('a',{href:link.sourceUrl,target:'_blank',rel:'noopener noreferrer'},link.sourceId+' · '+link.sourceRef),h('small',null,' '+link.firstSeenAt+' / '+link.lastSeenAt)))):null,
          target.item?operationNotice(pending[target.item.id]):null,
          ['installed','already-installed'].includes(target.status)&&target.item?.installed?.state==='registered'?openButton(target.item.installed):null):null,
      verification===true?h('section',{'aria-label':t('AppHost 合约验证')},h('h2',null,t('AppHost 合约验证')),
        h('p',null,t('测试版；输入与输出仅供当前客户端验证。安装仍须在正常确认框确认。')),
        h('select',{'aria-label':t('合约调用'),value:verificationCall,onChange:event=>{const call=VERIFICATION_CALLS.find(call=>call.method+' '+call.path===event.target.value);if(call){setVerificationCall(event.target.value);setVerificationInput(JSON.stringify(call.sample,null,2));setVerificationOutput(null);}}},...VERIFICATION_CALLS.map(call=>h('option',{key:call.method+' '+call.path,value:call.method+' '+call.path},call.method+' '+call.path))),
        h('textarea',{'aria-label':t('合约样例输入'),value:verificationInput,onChange:event=>setVerificationInput(event.target.value)}),
        h('button',{type:'button',disabled:verifying,onClick:()=>void verify()},t('调用合约')),
        h('pre',{'aria-label':t('合约调用输出')},verificationOutput===null?t('尚未调用'):JSON.stringify(verificationOutput,null,2))):null);
  }
  function ConnectionTabs({selected,navigate}){return h('nav',{className:'hm-connection-tabs','aria-label':t('设置与连接')},...[["hanamesh-account","账号与设备"],["hanamesh-providers","模型连接"],["hanamesh-environment","环境与来源"]].map(([id,label])=>h('button',{type:'button',key:id,'aria-current':id===selected?'page':undefined,onClick:()=>navigate(id)},t(label))));}
  function ProvidersPage({navigate}){useLocale();const[error,setError]=React.useState(false);const go=id=>{try{navigate(id);setError(false);}catch{setError(true);}};return h('div',{className:'hm-apphost-page'},h('div',{className:'hm-apphost-breadcrumb'},t('HanaMesh / 模型连接')),h('header',null,h('div',{className:'hm-apphost-eyebrow'},'MODELS / PROVIDERS'),h('h1',null,t('连接模型，保持掌控。')),h('p',null,t('登录账号不提供模型凭据。沿用宿主连接，按应用分别查看授权。'))),h(ConnectionTabs,{selected:'hanamesh-providers',navigate:go}),error?h('p',{role:'alert'},t('对应页面暂不可用，请确认 HanaMesh Core 已启用。')):null,h('div',{className:'hm-apphost-card'},h(ProvidersSection)),h('footer',null,'HanaMesh · Let every use bloom.'));}
  function EnvironmentContent(){useLocale();const[expanded,setExpanded]=React.useState({});return h('div',{className:'hm-apphost-environment'},h('section',{className:'hm-apphost-card'},h(NodeRuntimeSection)),...[["suite","套件安装包来源",SuiteSourceSettingsSection]].map(([id,label,Component])=>h('details',{key:id,className:'hm-apphost-card',onToggle:event=>{const open=event.currentTarget.open;setExpanded(previous=>({...previous,[id]:open}));}},h('summary',null,t(label)),expanded[id]?h(Component):h('p',null,t('展开后读取当前设置；不会自动保存或安装。')))));}
  function registerAppHostPages(ctx){
    const releases=[];
    releases.push(ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'hanamesh-providers'},()=>h(ProvidersPage,{navigate:id=>ctx.layout.selectPanel(id)}))));
    return()=>{for(const dispose of releases.reverse())dispose();};
  }

const appHostPageStyles=`
.hm-apphost-page{height:100%;overflow:auto;box-sizing:border-box;padding:36px 38px;max-width:1360px;margin:auto;color:var(--dsw-alias-label-primary,CanvasText);background:var(--dsw-alias-bg-base,Canvas);font:14px/1.55 var(--dsw-font-family,system-ui)}.hm-apphost-page *{box-sizing:border-box}.hm-apphost-page h1{font-size:32px;line-height:1.25;letter-spacing:-.025em;margin:0}.hm-apphost-page h2{font-size:17px}.hm-apphost-page p{color:var(--dsw-alias-label-secondary);line-height:1.7}.hm-apphost-breadcrumb{font-size:12px;color:var(--dsw-alias-label-tertiary);margin-bottom:28px}.hm-apphost-eyebrow{font-size:11px;font-weight:700;letter-spacing:.16em;color:var(--dsw-alias-brand-primary);margin-bottom:10px}.hm-apphost-page>header{margin-bottom:28px}.hm-apphost-page button,.hm-apphost-page select,.hm-apphost-page input{font:inherit;color:inherit;min-height:44px;padding:10px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-3);max-width:100%}.hm-apphost-page button{cursor:pointer}.hm-apphost-page button:disabled{opacity:.5;cursor:default}.hm-apphost-page :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}.hm-connection-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:28px 0 24px}.hm-connection-tabs [aria-current=page]{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}.hm-apphost-card{padding:22px;border:1px solid var(--dsw-alias-border-l1);border-radius:18px;background:var(--dsw-alias-bg-layer-2);min-width:0}.hm-apphost-environment{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;align-items:start}.hm-apphost-environment>details summary{cursor:pointer;font-weight:600;min-height:28px}.hm-apphost-page .hm-app-detail{padding:22px;border:1px solid var(--dsw-alias-border-l1);border-radius:18px;background:var(--dsw-alias-bg-layer-2);margin:20px 0;overflow-wrap:anywhere}.hm-apphost-page .hm-app-detail h3{font-size:28px;margin:0 0 12px}.hm-credibility{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.hm-credibility>div{padding:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1)}.hm-credibility span,.hm-credibility small{display:block;font-size:12px;color:var(--dsw-alias-label-tertiary)}.hm-credibility strong{display:block;font:26px/1.8 var(--dsh-font-family-code-default,monospace)}.hm-apphost-page .hm-install-review{padding:22px;border-radius:18px;background:var(--dsw-alias-bg-layer-2);margin:24px 0}.hm-install-ack{display:flex;align-items:center;gap:10px;margin:18px 0}.hm-install-ack input{width:20px;min-height:20px;flex:none;accent-color:var(--dsw-alias-brand-primary)}.hm-apphost-page .hm-website-link{display:inline-block;min-height:44px;color:var(--dsw-alias-brand-primary);padding:10px 0}.hm-apphost-page footer{font-size:11px;color:var(--dsw-alias-label-tertiary);margin-top:26px}
@media(max-width:640px){.hm-apphost-page>header{display:block}.hm-apphost-page>header button{margin-top:16px}.hm-apphost-page{padding:24px 18px}.hm-apphost-page h1{font-size:26px}.hm-apphost-card{padding:18px}}
`;

  const name='hanamesh-app-host-client',inject=['slots','locale'];
  // No cross-plugin reads here: the browser-side cordis context never carries host services such as hanameshCore
  // (dsh-client-modules boots its own root context); Core status lives in Core's own Settings section.
  function localizedSection(ctx,id,order,label,component){return ctx.slots.inject('settings.section',()=>{let dispose;const refresh=()=>{dispose?.();dispose=ctx.slots.register({name:'settings.section',id,order,label:t(label)},component);};refresh();const unsubscribe=localeService?.subscribe(refresh);return()=>{unsubscribe?.();dispose?.();};});}
  const APP_STYLES='.hm-applications,.hm-node-runtime,.hm-providers{min-width:0;max-width:100%;color:var(--dsw-alias-label-primary,CanvasText);font:14px/1.55 system-ui}.hm-application-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.hm-application-grid article{border:1px solid var(--dsw-alias-border-l1);border-radius:14px;padding:16px;background:var(--dsw-alias-bg-layer-2)}.hm-applications button,.hm-node-runtime button,.hm-providers button,.hm-node-runtime input,.hm-node-runtime select,.hm-providers input,.hm-providers select{font:inherit;color:inherit;min-height:40px;padding:8px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2);max-width:100%}.hm-applications button:disabled,.hm-node-runtime button:disabled{opacity:.5}.hm-app-frame{position:fixed;inset:0;z-index:1001;background:var(--dsw-alias-bg-layer-2);padding:12px 16px;display:grid;grid-template-rows:auto 1fr;gap:12px}.hm-app-frame>div{display:flex;justify-content:space-between}.hm-app-frame iframe{width:100%;height:100%;border:0}.hm-node-runtime,.hm-node-fields{display:grid;gap:12px}.hm-node-runtime label{display:grid;gap:6px}.hm-node-runtime progress{width:100%}.hm-node-confirm{padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px}.hm-node-confirm dl{display:grid;grid-template-columns:120px minmax(0,1fr);gap:8px}.hm-node-confirm dd{margin:0;overflow-wrap:anywhere}.hm-providers table{width:100%;border-collapse:collapse}.hm-providers td,.hm-providers th{padding:8px;text-align:left;border-bottom:1px solid var(--dsw-alias-border-l1)}.hm-providers td{overflow-wrap:anywhere}.hm-providers select,.hm-providers input{width:100%}.hm-failure pre{white-space:pre-wrap;overflow-wrap:anywhere}.hm-applications :focus-visible,.hm-node-runtime :focus-visible,.hm-providers :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}@media(max-width:640px){.hm-application-grid{grid-template-columns:minmax(0,1fr)}.hm-providers table,.hm-providers tbody,.hm-providers tr,.hm-providers td{display:block}.hm-providers thead{display:none}.hm-providers td:before{content:attr(data-label);display:block;font-weight:600}.hm-node-confirm dl{grid-template-columns:minmax(0,1fr)}}';
  function apply(ctx,{verification=false}={}){
    localeService=ctx.locale??null;
    if(localeService)ctx.effect(()=>localeService.register('hanamesh.apphost',COPY),'hanamesh-app-host:locale');
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=appHostPageStyles+APP_STYLES;
      document.head.append(style);return()=>style.remove();},'hanamesh-app-host:style');
    ctx.inject?.(['layout'],page=>{page.effect(()=>registerAppHostPages(page),'hanamesh-app-host:pages');});
    ctx.effect(()=>ctx.slots.inject('hanamesh.environment.content',()=>ctx.slots.register({name:'hanamesh.environment.content',id:'apphost',order:10},EnvironmentContent)),'hanamesh-app-host:environment-content');
    ctx.effect(()=>localizedSection(ctx,'hanamesh-providers',18,"供应商",ProvidersSection),'hanamesh-app-host:providers');
    ctx.effect(()=>localizedSection(ctx,'hanamesh-suite-source',19.5,"套件安装包来源",SuiteSourceSettingsSection),'hanamesh-app-host:suite-source');
    ctx.effect(()=>localizedSection(ctx,'hanamesh-node-runtime',20,"安装环境",NodeRuntimeSection),'hanamesh-app-host:node-runtime');

    ctx.effect(()=>ctx.slots.inject('hanamesh.home.continue',()=>ctx.slots.register({name:'hanamesh.home.continue',id:'applications',order:10},ApplicationContent)),'hanamesh-app-host:applications');
    const config=props=>h(RuntimeConfiguration,{...props,verification});
    for(const key of ['@hanamesh/dsh-app-host#hanamesh-app-host','@hanamesh/hanamesh#hanamesh-app-host']){
      ctx.effect(()=>ctx.slots.inject('plugins.row.config',()=>ctx.slots.register({name:'plugins.row.config',key},config)),'hanamesh-app-host:runtime-config:'+key);
    }
    ctx.effect(()=>ctx.slots.inject('plugins.bundle.config',()=>ctx.slots.register({name:'plugins.bundle.config',key:'@hanamesh/dsh-app-host'},config)),'hanamesh-app-host:bundle-config');
  }
  function RuntimeConfiguration({view='page',verification=false}={}){
    if(view==='summary')return h('span',null,t('应用运行环境与模型路由'));
    return h('div',null,h(ApplicationContent,{verification}),h(NodeRuntimeSection),h(ProvidersSection));
  }
  return{name,inject,apply,INSTALL_TARGET_CONTRACT_VERSION,ProvidersSection,SuiteSourceSettingsSection,NodeRuntimeSection,ApplicationContent,RuntimeConfiguration,openInstallTarget,registerAppHostPages,EnvironmentContent};
}});
