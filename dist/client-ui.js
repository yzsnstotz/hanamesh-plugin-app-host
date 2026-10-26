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
    "copy20": "槽位",
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
    "copy31": "网站交接：",
    "copy32": "没能告诉网站「确认框已弹出」",
    "copy33": "没能告诉网站「已取消」，网站会在作废时间到后显示过期",
    "copy34": "没能告诉网站「确认框打不开」",
    "copy35": "确认框打不开",
    "copy36": "网站交接：读取交接失败，网站上的「安装」会一直等到过期（",
    "copy37": "检测到 DSH Market（dshmarket）：「扩展管理」的市场标签只能由一个插件提供，这次没有由 HanaMesh 市场接管。两者只能其一——要用 HanaMesh 市场请先卸载 dshmarket 并重启 DSH；要用 dshmarket 就从下方侧栏的「市场」入口使用 HanaMesh 市场。",
    "copy38": "市场",
    "copy39": "市场目录源",
    "copy40": "可保存多个来源，但浏览时只启用一个。",
    "copy41": "已启用",
    "copy42": "启用",
    "copy43": "上移",
    "copy44": "下移",
    "copy45": "删除",
    "copy46": "添加并启用",
    "copy47": "套件安装包来源",
    "copy48": "选择三个官方套件组件的 npm 安装包 registry。市场目录源提供浏览清单，在「市场目录源」中单独设置。",
    "copy49": "安装包来源",
    "copy50": "现有配置（默认）",
    "copy51": "Core 当前本机来源",
    "copy52": "现有 registry：",
    "copy53": "已保存选择：",
    "copy54": "现有配置",
    "copy55": "Core 来源：",
    "copy56": " · 尚不可观察，请检查 Core 插件及其来源设置。",
    "copy57": "保存选择不会安装。检查、确认和执行前都重新读取当前来源与 Core 兼容声明；来源变化后须重新查看并确认。",
    "copy58": "正在保存…",
    "copy59": "保存套件安装包来源",
    "copy60": "刷新来源状态",
    "copy61": "正在读取套件安装包来源…",
    "copy62": "进度读取中断：",
    "copy63": "。准备可能仍在进行，请点击「刷新状态」查看；不会自动重试。",
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
    "copy101": "读取中…",
    "copy102": "正在 ",
    "copy103": " 接收网站交接",
    "copy104": "已关闭：网站上的「安装」按钮找不到本客户端",
    "copy105": "未启动",
    "copy106": "网站安装交接",
    "copy107": "网站（如 market.hanamesh.com）点「安装」时，会在下列本机端口上找到本客户端，把要装的插件交给应用库；应用库在这里弹出确认，你确认后才安装。",
    "copy108": "安装前需要独立 Node.js 24。请打开 AppHost「安装环境」点击「准备安装环境」，核对来源、版本和体积后确认；完成后自动可用，无需重启或填写路径。已有独立 Node 可在安装环境高级设置中指定，不支持 Electron 包装脚本。",
    "copy109": " 启用（",
    "copy110": "，默认 ",
    "copy111": "开",
    "copy112": "关",
    "copy113": "端口（",
    "copy114": "；按顺序取第一个空闲的）",
    "copy115": "允许交接的网站（",
    "copy116": "，每行一个，默认 ",
    "copy117": "未确认多久后作废，毫秒（",
    "copy118": " 分钟）",
    "copy119": "应用库多久查一次新的交接，毫秒（",
    "copy120": "保存并重新监听",
    "copy121": "固定规则（不能关）",
    "copy122": "为什么：",
    "copy123": "安装命令返回成功，但 profile 读回的版本与固定版本不一致",
    "copy124": "包不在当前 registry 上——尚未发布到 npm，或客户端 registry 设置不对",
    "copy125": "DSH 安装命令失败，请展开技术详情查看原始原因",
    "installAgeRejected": "宿主的依赖发布时间检查未通过（默认需发布满 24 小时，以技术详情中的 cutoff 为准）。已知 DSH 0.2.0-rc.2 内置 pnpm 11.7.0 对同名多条白名单只认第一条。请在 DSH 设置中检查当前版本并升级 DSH，或等待受影响版本满足规则后手动重试。",
    "installAffectedPackages": "受影响包：",
    "copy126": "当前宿主未提供安装参数（profile / node 路径）",
    "copy127": "目录里已没有这一项，刷新后重试",
    "copy128": "registry 上的最新版是预发布版（rc），客户端未允许安装预发布版",
    "copy129": "运行时归档下载失败，检查网络或来源",
    "copy130": "10 分钟内没有结果，可稍后重试",
    "copy131": "HanaMesh 套件自身不能从市场安装或卸载",
    "copy132": "先关闭该应用的所有视图再卸载",
    "copy133": "详细原因见宿主日志",
    "copy134": "；升级未完成，部分组件可能已改变。当前读回：",
    "copy135": "检测不到",
    "copy136": "（未启用）",
    "copy137": "。请完全退出客户端，使用补齐命令（仅 macOS / Linux 终端；Windows 安全命令暂未提供）修复并重新打开：",
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
    "copy149": "全部",
    "copy150": "插件",
    "copy151": "仅收录",
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
    "copy176": "仅收录，不可安装",
    "copy177": "HanaMesh 套件",
    "copy178": "已安装 · Core ",
    "copy179": "套件不完整，请查看组件状态",
    "copy180": "套件状态未知，请查看 Core 声明与阻断原因",
    "copy181": "Core 完整性：",
    "copy182": " · 要求 ",
    "copy183": " · 实际 ",
    "copy184": " · 未启用",
    "copy185": "检查兼容升级",
    "copy186": "重试安装",
    "copy187": "升级",
    "copy188": "升级到 ",
    "copy189": "补齐运行时",
    "copy190": "卸载",
    "copy191": "已卸载，重启 DSH 后生效",
    "copy192": "已安装，重启 DSH 后生效",
    "copy193": "未知发布者",
    "copy194": "关闭中…",
    "copy195": "关闭视图",
    "copy196": "更多",
    "copy197": "应用 · ",
    "copy198": "插件 · ",
    "copy199": "（未启用为 profile 层）",
    "copy200": "HanaMesh 市场",
    "copy201": "关闭",
    "copy202": "启动时没能读取 profile（",
    "copy203": "），「需重启」状态无法判断，下面的状态都按已加载显示",
    "copy204": "安装目标开发小界面",
    "copy205": "安装目标",
    "copy206": "输入目录条目 ID 或包名，市场查询当前目录后确认安装。",
    "copy207": "目录条目 ID",
    "copy208": "itemId（可选）",
    "copy209": "包名",
    "copy210": "packageName（可选）",
    "copy211": "查看安装目标",
    "copy212": "市场安装确认",
    "copy213": "插件名",
    "copy214": "版本",
    "copy215": "目录未提供版本",
    "copy216": "测试目录（fixture）",
    "copy217": "当前市场目录",
    "copy218": "确认后升级三个官方组件；需要完全退出并重新打开客户端。",
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
    "copy231": "C-MARKET 合约验证",
    "copy232": "测试版；输入与输出仅供当前客户端验证。安装仍须在正常确认框确认。",
    "copy233": "合约调用",
    "copy234": "合约样例输入",
    "copy235": "调用合约",
    "copy236": "合约调用输出",
    "copy237": "尚未调用",
    "copy238": "搜索应用与插件",
    "copy239": "搜索",
    "copy240": "类别",
    "copy241": "运行方式",
    "copy242": "Node 版本",
    "copy243": "已有独立 Node 路径",
    "copy244": "市场目录暂时无法读取。请检查目录源设置，或等待目录提供方更新后再读取。安装尚未开始。",
    "copy245": "本次操作未能完成。请查看技术详情中的准确原因，检查相关设置后再操作。",
    "copy246": "技术详情",
    "copy247": "安装环境管理方式",
    "copy248": "独立 Node 固定版本",
    "copy249": "Node 下载来源",
    "copy250": "独立 Node 存放位置",
    "copy251": "已有独立 Node 路径（高级）",
    "copy252": "一键准备支持 macOS 13.5+ arm64 / x64；Windows 尚不支持。下载仅在确认后开始；不重试、不切换来源。",
    "copy253": "Node.js MIT；归档内 LICENSE 保留其第三方声明",
    "copy254": "Core 来源暂不可用。请检查 Core 插件及其来源设置。",
    "copy255": "运行时记录与已校验的官方发行记录不一致。",
    "copy256": "请填写完整的安装环境设置。",
    "copy257": "请选择已校验的固定 Node 版本，不能填写 latest。",
    "copy258": "下载来源必须是没有账号、密码、查询参数的 HTTPS 地址。",
    "copy259": "请选择绝对的专用存放目录。",
    "copy260": "已有独立 Node 路径必须是绝对路径。",
    "copy261": "准备安装环境未完成。请查看技术详情中的准确原因；未自动换源或重试。",
    "copy262": "只在本机 127.0.0.1 上监听，请求的 Host 必须是 127.0.0.1 或 localhost 加监听端口",
    "copy263": "防止别的机器或 DNS 重绑定的网页冒充本机",
    "copy264": "只有「允许交接的网站」里的网站能探测本客户端、交接安装、读交接状态；别的网站什么也读不到",
    "copy265": "否则任何网页都能知道你装了什么客户端、缺什么，用来识别你",
    "copy266": "网站交接只会在应用库里弹出确认；只有你点「确认安装」才会安装",
    "copy267": "网站不能替你决定装什么",
    "copy268": "交接状态只给发起它的那个网站看",
    "copy269": "一个网站不能读另一个网站的交接",
    "copy270": "交接请求体不超过 4096 字节",
    "copy271": "合法请求只有插件 id、包名、合约版本三项，最长不到 500 字节；更大的一定不是交接",
    "copy272": "端口在 1024–65535 之间、互不重复，至少一个",
    "copy273": "1024 以下要管理员权限；没有端口就没有地方让网站找到",
    "copy274": "网站必须写成来源（协议 + 域名 [+ 端口]），http 只允许 127.0.0.1 / localhost",
    "copy275": "浏览器按来源校验；明文 http 的公网网站可被中间人冒充",
    "copy276": "轮询间隔是 1–2147483647 毫秒的整数，作废时间必须大于轮询间隔",
    "copy277": "计时器超过上限会立即触发；作废早于第一次轮询，交接永远不会被看到",
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
    "copy290": "网站点「安装」后，本客户端会请你确认；确认后才安装。",
    "copy291": "安装前请先在「安装环境」准备所需环境。",
    "copy292": "启用网站安装交接",
    "copy293": "本机端口",
    "copy294": "允许的网站（每行一个）",
    "copy295": "确认等待时间（毫秒）",
    "copy296": "检查新交接的间隔（毫秒）",
    "copy297": "设置名称与默认值",
    "copy298": "使用说明",
    "copy300": "高级设置",
    "copy301": "支持 macOS 13.5+（Apple Silicon / Intel）。Windows 的安装、守护与取消验证尚未接通，本流程不声称支持 Windows。"
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
    "copy20": "Slot",
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
    "copy31": "Website handoff: ",
    "copy32": "Could not tell the website that confirmation is open",
    "copy33": "Could not report cancellation; the website will show expiry when the request expires",
    "copy34": "Could not tell the website that confirmation failed to open",
    "copy35": "Could not open confirmation",
    "copy36": "Website handoff could not be read. The website installation request will wait until expiry (",
    "copy37": "DSH Market (dshmarket) is installed. Only one plugin can provide the Extension Management market tab, so HanaMesh did not take that tab. To use the HanaMesh tab, uninstall dshmarket and restart DSH. To keep dshmarket, open HanaMesh from Market in the sidebar.",
    "copy38": "Market",
    "copy39": "Market catalog sources",
    "copy40": "Save multiple sources; only one is active while browsing.",
    "copy41": "Enabled",
    "copy42": "Enable",
    "copy43": "Move up",
    "copy44": "Move down",
    "copy45": "Remove",
    "copy46": "Add and enable",
    "copy47": "Suite package source",
    "copy48": "Choose the npm registry for the three official suite components. Browseable catalogs are configured separately in Market catalog sources.",
    "copy49": "Package source",
    "copy50": "Existing configuration (default)",
    "copy51": "Core’s current local source",
    "copy52": "Configured registry: ",
    "copy53": "Saved selection: ",
    "copy54": "Existing configuration",
    "copy55": "Core source: ",
    "copy56": " · Source is not observable. Check Core and its source settings.",
    "copy57": "Saving does not install anything. The current source and Core compatibility declaration are read again before checking, confirming and installing. If the source changes, review and confirm again.",
    "copy58": "Saving…",
    "copy59": "Save suite package source",
    "copy60": "Refresh source status",
    "copy61": "Reading suite package source…",
    "copy62": "Progress updates stopped: ",
    "copy63": ". Preparation may still be running. Select Refresh status to check. No automatic retry will run.",
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
    "copy101": "Reading…",
    "copy102": "Receiving website handoffs at ",
    "copy103": " ",
    "copy104": "Disabled: the website Install button cannot find this client",
    "copy105": "Not started",
    "copy106": "Website installation handoff",
    "copy107": "When Install is selected on a website such as market.hanamesh.com, the website finds this client on the local ports below. The market opens confirmation here; nothing installs until you confirm.",
    "copy108": "Installation requires standalone Node.js 24. In AppHost Installation environment, select Prepare installation environment, review the source, version and size, then confirm. It becomes usable without restarting or entering a path. An existing standalone Node can be set in advanced settings. Electron wrappers are not supported.",
    "copy109": " Enable (",
    "copy110": ", default ",
    "copy111": "On",
    "copy112": "Off",
    "copy113": "Ports (",
    "copy114": "; the first available port is used)",
    "copy115": "Allowed websites (",
    "copy116": ", one per line, default ",
    "copy117": "Unconfirmed request lifetime, milliseconds (",
    "copy118": " minutes)",
    "copy119": "Check for new handoffs every, milliseconds (",
    "copy120": "Save and restart listener",
    "copy121": "Required rules",
    "copy122": "Reason: ",
    "copy123": "Installation command succeeded, but the version read from the profile differs from the confirmed version",
    "copy124": "Package not found in the current registry. It may not be published, or the registry setting may be incorrect",
    "copy125": "DSH installation failed. Expand Technical details for the original cause",
    "installAgeRejected": "The host rejected a dependency's release age (the default requires 24 hours since publication; see the actual cutoff in Technical details). Known issue: pnpm 11.7.0 bundled with DSH 0.2.0-rc.2 only recognizes the first allowlist entry for a package name. Check your version in DSH Settings and upgrade DSH, or wait until the affected versions meet the rule before trying again manually.",
    "installAffectedPackages": "Affected packages: ",
    "copy126": "This host has not provided installation parameters (profile / Node path)",
    "copy127": "This item is no longer in the catalog. Refresh before trying again",
    "copy128": "The latest registry version is a prerelease, which this client has not allowed",
    "copy129": "Runtime archive download failed. Check the network or source",
    "copy130": "No result within 10 minutes. Check the installed state before trying again",
    "copy131": "The HanaMesh suite cannot be installed or uninstalled through the market",
    "copy132": "Close all views of this app before uninstalling it",
    "copy133": "See the host logs for the detailed reason",
    "copy134": "; upgrade incomplete, and some components may have changed. Current readback: ",
    "copy135": "Not available",
    "copy136": " (disabled)",
    "copy137": ". Fully quit the client and run the repair command (macOS / Linux terminal only; no safe Windows command is supplied), then reopen: ",
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
    "copy149": "All",
    "copy150": "Plugins",
    "copy151": "Listed only",
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
    "copy176": "Listed only; not installable",
    "copy177": "HanaMesh suite",
    "copy178": "Installed · Core ",
    "copy179": "Suite incomplete. Check component status",
    "copy180": "Suite status unknown. Check the Core declaration and blocking reasons",
    "copy181": "Core completeness: ",
    "copy182": " · Required ",
    "copy183": " · Actual ",
    "copy184": " · Disabled",
    "copy185": "Check compatible upgrade",
    "copy186": "Retry installation",
    "copy187": "Upgrade",
    "copy188": "Upgrade to ",
    "copy189": "Prepare runtime",
    "copy190": "Uninstall",
    "copy191": "Uninstalled; restart DSH to apply",
    "copy192": "Installed; restart DSH to apply",
    "copy193": "Unknown publisher",
    "copy194": "Closing…",
    "copy195": "Close view",
    "copy196": "More",
    "copy197": "App · ",
    "copy198": "Plugin · ",
    "copy199": " (not enabled in profile)",
    "copy200": "HanaMesh Market",
    "copy201": "Close",
    "copy202": "The profile could not be read at startup (",
    "copy203": "). Restart requirements are unknown; the states below reflect loaded components",
    "copy204": "Installation target developer panel",
    "copy205": "Installation target",
    "copy206": "Enter a catalog item ID or package name. The market reads the current catalog before asking for confirmation.",
    "copy207": "Catalog item ID",
    "copy208": "itemId (optional)",
    "copy209": "Package name",
    "copy210": "packageName (optional)",
    "copy211": "Review installation target",
    "copy212": "Confirm market installation",
    "copy213": "Plugin name",
    "copy214": "Version",
    "copy215": "No version provided by catalog",
    "copy216": "Test catalog (fixture)",
    "copy217": "Current market catalog",
    "copy218": "Confirmation upgrades three official components. Fully quit and reopen the client afterwards.",
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
    "copy231": "C-MARKET contract verification",
    "copy232": "Test build. Inputs and outputs verify only this client. Installations still require normal confirmation.",
    "copy233": "Contract call",
    "copy234": "Contract sample input",
    "copy235": "Call contract",
    "copy236": "Contract output",
    "copy237": "Not called yet",
    "copy238": "Search apps and plugins",
    "copy239": "Search",
    "copy240": "Category",
    "copy241": "Runtime mode",
    "copy242": "Node version",
    "copy243": "Existing standalone Node path",
    "copy244": "The market catalog cannot be read. Check catalog source settings, or read it again after the provider updates it. Installation has not started.",
    "copy245": "This operation could not complete. Check the exact reason in Technical details and review the related settings before trying again.",
    "copy246": "Technical details",
    "copy247": "Environment management mode",
    "copy248": "Pinned standalone Node version",
    "copy249": "Node download source",
    "copy250": "Standalone Node storage location",
    "copy251": "Existing standalone Node path (advanced)",
    "copy252": "One-click preparation supports macOS 13.5+ arm64 / x64. Windows is not supported. Download starts only after confirmation, without retries or source switching.",
    "copy253": "Node.js MIT; the archive LICENSE retains third-party notices",
    "copy254": "Core source is not available. Check Core and its source settings.",
    "copy255": "The runtime record does not match a verified official release.",
    "copy256": "Complete every installation environment setting.",
    "copy257": "Select a verified pinned Node version. The value latest is not accepted.",
    "copy258": "The download source must be an HTTPS URL without credentials or query parameters.",
    "copy259": "Choose an absolute path to a dedicated storage directory.",
    "copy260": "The existing standalone Node path must be absolute.",
    "copy261": "Installation environment preparation did not complete. See Technical details for the exact reason. No automatic source switching or retry occurred.",
    "copy262": "Listen only on 127.0.0.1. The request Host must be 127.0.0.1 or localhost with the listening port.",
    "copy263": "Prevents remote machines or DNS-rebinding pages from impersonating this machine.",
    "copy264": "Only allowed websites can discover this client, hand off installation or read handoff status.",
    "copy265": "Prevents unrelated websites from identifying you through installed clients or missing capabilities.",
    "copy266": "Website handoffs only open market confirmation. Installation requires your Confirm installation action.",
    "copy267": "A website cannot decide what to install for you.",
    "copy268": "Handoff status is visible only to the website that created it.",
    "copy269": "One website cannot read another website’s handoffs.",
    "copy270": "Handoff request body must not exceed 4096 bytes.",
    "copy271": "A valid handoff contains only item ID, package name and contract version, under 500 bytes; a larger request is not a valid handoff.",
    "copy272": "Provide at least one distinct port between 1024 and 65535.",
    "copy273": "Lower ports need administrator permissions. Without a port the website cannot find this client.",
    "copy274": "Websites must be origins (scheme + domain [+ port]). HTTP is allowed only for 127.0.0.1 / localhost.",
    "copy275": "Browsers verify origins. Public HTTP websites can be impersonated by intermediaries.",
    "copy276": "Polling interval must be an integer from 1 to 2147483647 milliseconds. Expiry must be longer than the polling interval.",
    "copy277": "Oversized timers fire immediately. A handoff expiring before its first poll cannot be shown.",
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
    "copy290": "When you select Install on a website, this client asks you to confirm before installing.",
    "copy291": "Before installing, prepare the required environment in Installation environment.",
    "copy292": "Enable website installation handoff",
    "copy293": "Local ports",
    "copy294": "Allowed websites (one per line)",
    "copy295": "Confirmation wait (milliseconds)",
    "copy296": "Check for new handoffs (milliseconds)",
    "copy297": "Setting names and defaults",
    "copy298": "How it works",
    "copy300": "Advanced settings",
    "copy301": "Supports macOS 13.5+ (Apple Silicon / Intel). Windows installation, guardian and cancellation verification are not connected; this flow does not support Windows."
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
  let libraryVisible=false;const libraryListeners=new Set();
  const setLibraryVisible=value=>{libraryVisible=value;for(const listener of libraryListeners)listener(value);};
  let targetSelection=null,targetSequence=0,pendingOperations={};
  const targetListeners=new Set(),pendingListeners=new Set();
  const INSTALL_TARGET_HASH='#hanamesh-install?',INSTALL_TARGET_CONTRACT_VERSION='1';
  const CORE_SUITE_FAILURES={CORE_SUITE_DECLARATION_MISSING:t('Core 未提供套件声明'),CORE_SUITE_DECLARATION_INVALID:t('Core 套件声明无法用于精确安装。')};
  const suiteTargetFailure=target=>target.previewFailed?t('兼容升级检查未通过，尚未执行安装：')+(t(CORE_SUITE_FAILURES[target.error])??target.error??t('检测不到结果')):t(CORE_SUITE_FAILURES[target.error])??(target.details?.stage==='suite-upgrade'?t('套件升级未完成：')+(target.error??t('检测不到结果'))+t('。请核对当前版本；完全退出后可使用 HanaMesh 设置中的补齐命令修复并重新打开。'):t('套件升级未完成或结果尚未确认：')+(target.error??t('检测不到结果'))+t('。请核对已装版本；不会自动重试。'));
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
    }catch(error){if(sequence===targetSequence)setTarget({status:input.itemId==='hanamesh:suite-upgrade'?'suite-upgrade-failed':'failed',error:String(error.message??error),diagnostic:{response:error.response,message:String(error.message??error)},...(input.itemId==='hanamesh:suite-upgrade'?{previewFailed:true,details:error.response?.error?.details}:{})});throw error;}
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
  const noteHandoffIssue=(text,error)=>{text=COPY.zh[Object.keys(COPY.en).find(k=>COPY.en[k]===text)]??text;const line=()=>t('网站交接：')+t(text)+'（'+String(error?.message??error)+'）';try{globalThis.console?.warn?.('hanamesh-app-host '+t(line));}catch{}setHandoffIssue({text:line,cause:error.response?.error??{message:String(error.message??error)},at:Date.now()});};
  const reportHandoff=async(handoffId,state,error)=>{if(!handoffId)return;
    try{await request('/hanamesh/library/handoffs/state',{method:'POST',body:JSON.stringify({handoffId,state,...(error?{error}:{})})});}
    catch(failure){noteHandoffIssue({shown:t('没能告诉网站「确认框已弹出」'),cancelled:t('没能告诉网站「已取消」，网站会在作废时间到后显示过期'),failed:t('没能告诉网站「确认框打不开」')}[state],failure);}};
  async function pollHandoffs(){
    const value=await request('/hanamesh/library/handoffs');handoffPollMs=value.pollMs;
    if(handoffIssue?.poll)setHandoffIssue(null);
    for(const row of value.handoffs??[]){
      if(row.state!=='pending'||handled.has(row.handoffId))continue;handled.add(row.handoffId);
      const input={...(row.itemId?{itemId:row.itemId}:{}),...(row.packageName&&row.itemId!=='hanamesh:suite-upgrade'?{packageName:row.packageName}:{}),contractVersion:INSTALL_TARGET_CONTRACT_VERSION};
      let opened=false;
      try{await openInstallTarget(input,{handoffId:row.handoffId});opened=true;}
      catch(error){noteHandoffIssue(t('确认框打不开'),error);await reportHandoff(row.handoffId,'failed',{code:errorCode(error)});}
      if(opened)await reportHandoff(row.handoffId,'shown');
      return;
    }
  }
  const pollHandoffsVisibly=async()=>{try{await pollHandoffs();}catch(error){const line=()=>t('网站交接：读取交接失败，网站上的「安装」会一直等到过期（')+String(error?.message??error)+'）';try{globalThis.console?.warn?.('hanamesh-app-host '+t(line));}catch{}setHandoffIssue({text:line,cause:error.response?.error??{message:String(error.message??error)},poll:true,at:Date.now()});}};
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
  const MARKET_CONFLICT_TEXT=t('检测到 DSH Market（dshmarket）：「扩展管理」的市场标签只能由一个插件提供，这次没有由 HanaMesh 市场接管。两者只能其一——要用 HanaMesh 市场请先卸载 dshmarket 并重启 DSH；要用 dshmarket 就从下方侧栏的「市场」入口使用 HanaMesh 市场。');
  let marketConflict='';const conflictListeners=new Set();
  const setMarketConflict=value=>{marketConflict=value;for(const listener of conflictListeners)listener(value);};
  // The seat owner asks us to stand down our own entry points while it renders the market itself.
  let entryVisible=true;const entryListeners=new Set();
  const setEntryVisible=value=>{entryVisible=value;if(!value)setLibraryVisible(false);for(const listener of entryListeners)listener(value);};
  function HandoffIssueNotice(){useLocale();
    const[issue,setIssue]=React.useState(handoffIssue);
    React.useEffect(()=>{issueListeners.add(setIssue);return()=>issueListeners.delete(setIssue);},[]);
    return issue?h('div',{role:'alert',className:'hm-library-failed','data-hanamesh-handoff-issue':''},h('p',null,t(issue.text)),h('details',null,h('summary',null,t('技术详情')),h('pre',null,JSON.stringify(issue.cause,null,2)))):null;
  }
  function MarketConflictNotice(){useLocale();
    const[text,setText]=React.useState(marketConflict);
    React.useEffect(()=>{conflictListeners.add(setText);return()=>conflictListeners.delete(setText);},[]);
    if(!text)return null;
    return h('p',{role:'status',className:'hm-market-conflict','data-hanamesh-market-conflict':DSHMARKET_PACKAGE},t(text));
  }
  function LibraryAction(){useLocale();
    const[shown,setShown]=React.useState(entryVisible);
    React.useEffect(()=>{entryListeners.add(setShown);return()=>entryListeners.delete(setShown);},[]);
    if(!shown)return null;
    return h('button',{type:'button',className:'hm-library-action',onClick:()=>setLibraryVisible(true)},t('市场'));
  }
  function LibrarySourcesSection(){useLocale();
    const[sources,setSources]=React.useState([]),[draft,setDraft]=React.useState(''),[error,setError]=React.useState('');
    const load=React.useCallback(async()=>{try{const value=await request('/hanamesh/library/sources');setSources(value.sources??[]);setError('');}catch(e){setError(e);}},[]);
    React.useEffect(()=>{void load();},[load]);
    const save=async next=>{try{await request('/hanamesh/library/sources',{method:'POST',body:JSON.stringify({sources:next})});await load();}catch(e){setError(e);}};
    const move=(index,delta)=>{const next=[...sources],target=index+delta;if(target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];void save(next);};
    return h('section',{className:'hm-library-sources'},h('h2',null,t('市场目录源')),
h('div',{className:'hm-source-add'},h('input',{value:draft,placeholder:'https://…/catalog-source.json',onChange:event=>setDraft(event.target.value)}),h('button',{type:'button',onClick:()=>{if(draft)void save([...sources.map(row=>({...row,enabled:false})),{manifestUrl:draft,enabled:true}]);setDraft('');}},t('添加并启用'))),h('p',null,t('可保存多个来源，但浏览时只启用一个。')),error?FailureNotice({error}):null,
      ...sources.map((source,index)=>h('div',{className:'hm-source-row',key:source.manifestUrl},h('code',null,source.manifestUrl),h('button',{type:'button',disabled:source.enabled,onClick:()=>void save(sources.map((row,i)=>({...row,enabled:i===index})))},source.enabled?t('已启用'):t('启用')),h('button',{type:'button',onClick:()=>move(index,-1)},t('上移')),h('button',{type:'button',onClick:()=>move(index,1)},t('下移')),h('button',{type:'button',onClick:()=>void save(sources.filter((_,i)=>i!==index))},t('删除')))));
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
        h('details',null,h('summary',null,t('使用说明')),h('p',null,t('选择三个官方套件组件的 npm 安装包 registry。市场目录源提供浏览清单，在「市场目录源」中单独设置。')),h('p',null,t('保存选择不会安装。检查、确认和执行前都重新读取当前来源与 Core 兼容声明；来源变化后须重新查看并确认。')))):h('p',null,t('正在读取套件安装包来源…')));
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

  /** Website handoff settings: every setting named with its default and editable; the fixed rules listed with their reason. */
  function HandoffSettingsSection(){useLocale();
    const[value,setValue]=React.useState(null),[draft,setDraft]=React.useState(null),[error,setError]=React.useState('');
    const load=React.useCallback(async()=>{try{const next=await request('/hanamesh/library/handoff-settings');setValue(next);setDraft({...next.settings,ports:next.settings.ports.join(', '),allowedOrigins:next.settings.allowedOrigins.join('\n')});setError('');}catch(e){setError(e);}},[]);
    React.useEffect(()=>{void load();},[load]);
    const save=async()=>{try{const next=await request('/hanamesh/library/handoff-settings',{method:'POST',body:JSON.stringify({enabled:draft.enabled,ttlMs:Number(draft.ttlMs),pollMs:Number(draft.pollMs),
      ports:draft.ports.split(/[\s,，]+/).filter(Boolean).map(Number),allowedOrigins:draft.allowedOrigins.split(/\s+/).filter(Boolean)})});setValue(next);setError('');}catch(e){setError(String(e.message??e)+(e.response?.error?.message?'：'+e.response.error.message:''));}};
    const listener=value?.listener,defaults=value?.defaults,names=value?.names;
    const status=!listener?t('读取中…'):listener.status==='listening'?t('正在 ')+listener.origin+t(' 接收网站交接'):listener.status==='disabled'?t('已关闭：网站上的「安装」按钮找不到本客户端'):listener.status==='unavailable'?t('未启动'):t('未启动');
    return h('section',{className:'hm-library-sources'},h('h2',null,t('网站安装交接')),
      draft&&defaults?h('div',{className:'hm-handoff-settings'},
        h('label',null,h('input',{type:'checkbox',checked:draft.enabled,onChange:event=>setDraft({...draft,enabled:event.target.checked})}),t('启用网站安装交接')),
        h('button',{type:'button',onClick:()=>void save()},t('保存并重新监听')),
        h('label',null,t('本机端口'),h('input',{value:draft.ports,onChange:event=>setDraft({...draft,ports:event.target.value})})),
        h('label',null,t('允许的网站（每行一个）'),h('textarea',{rows:3,value:draft.allowedOrigins,onChange:event=>setDraft({...draft,allowedOrigins:event.target.value})})),
        h('label',null,t('确认等待时间（毫秒）'),h('input',{value:String(draft.ttlMs),onChange:event=>setDraft({...draft,ttlMs:event.target.value})})),
        h('label',null,t('检查新交接的间隔（毫秒）'),h('input',{value:String(draft.pollMs),onChange:event=>setDraft({...draft,pollMs:event.target.value})}))):null,
      h('p',{role:'status'},status),listener?.status==='unavailable'?FailureNotice({error:listener.need}):null,error?FailureNotice({error}):null,h(HandoffIssueNotice,null),
      h('p',null,t('网站点「安装」后，本客户端会请你确认；确认后才安装。')),
      h('p',null,t('安装前请先在「安装环境」准备所需环境。')),
      h('details',null,h('summary',null,t('使用说明')),h('p',null,t('安装前需要独立 Node.js 24。请打开 AppHost「安装环境」点击「准备安装环境」，核对来源、版本和体积后确认；完成后自动可用，无需重启或填写路径。已有独立 Node 可在安装环境高级设置中指定，不支持 Electron 包装脚本。'))),
      h('details',{className:'hm-handoff-rules'},h('summary',null,t('技术详情')),
        defaults&&names?h('div',null,h('h3',null,t('设置名称与默认值')),h('dl',null,...['enabled','ports','allowedOrigins','ttlMs','pollMs'].flatMap(key=>[h('dt',{key:key+'-name'},names[key]),h('dd',{key:key+'-value'},Array.isArray(defaults[key])?defaults[key].join(', '):typeof defaults[key]==='boolean'?(defaults[key]?t('开'):t('关')):String(defaults[key]))]))):null,
        value?.rules?h('div',null,h('h3',null,t('固定规则（不能关）')),h('ul',null,...value.rules.map(row=>h('li',{key:row.rule},t(row.rule),h('br',null),h('small',null,t('为什么：')+t(row.why)))))):null));
  }
  const FAILURE_REASONS={...CORE_SUITE_FAILURES,INSTALL_READBACK_MISMATCH:t('安装命令返回成功，但 profile 读回的版本与固定版本不一致'),REGISTRY_LOOKUP_FAILED:t('无法查询 DSH 配置的 registry；检查 DSH 源设置与网络，展开技术详情后手动重试'),REGISTRY_LOOKUP_TIMEOUT:t('registry 查询超过 30 秒；检查 DSH 源设置与网络后手动重试'),REGISTRY_CONFIG_UNAVAILABLE:t('DSH 未提供可读的源配置；检查客户端插件管理器，展开技术详情'),DSH_PLUGIN_FAILED:t('DSH 安装命令失败，请展开技术详情查看原始原因'),LIBRARY_INSTALL_UNAVAILABLE:t('当前宿主未提供安装参数（profile / node 路径）'),CATALOG_ITEM_MISSING:t('目录里已没有这一项，刷新后重试'),UNSTABLE_VERSION:t('registry 上的最新版是预发布版（rc），客户端未允许安装预发布版'),RUNTIME_ARCHIVE_UNAVAILABLE:t('运行时归档下载失败，检查网络或来源'),OPERATION_TIMEOUT:t('10 分钟内没有结果，可稍后重试'),PACKAGE_DENIED:t('HanaMesh 套件自身不能从市场安装或卸载'),INSTANCE_IN_USE:t('先关闭该应用的所有视图再卸载')};
  const failureReason=(code,details)=>{
    const diagnostic=code==='DSH_PLUGIN_FAILED'?details?.diagnostic??'':'',pnpmCode=diagnostic.match(/\bERR_PNPM_[A-Z0-9_]+\b/)?.[0];
    if(pnpmCode==='ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION'){
      const packages=[...new Set([...diagnostic.matchAll(/((?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)\s+was published\b/g)].map(match=>match[1]))];
      return pnpmCode+' · '+t('宿主的依赖发布时间检查未通过（默认需发布满 24 小时，以技术详情中的 cutoff 为准）。已知 DSH 0.2.0-rc.2 内置 pnpm 11.7.0 对同名多条白名单只认第一条。请在 DSH 设置中检查当前版本并升级 DSH，或等待受影响版本满足规则后手动重试。')+(packages.length?' '+t('受影响包：')+packages.join(', '):'');
    }
    return(pnpmCode?pnpmCode+' · ':'')+(t(FAILURE_REASONS[code])??t('详细原因见宿主日志'));
  };
  const operationNotice=op=>op?h('div',null,h('p',{role:op.failed?'alert':'status',className:op.failed?'hm-library-failed':'hm-library-ok',style:{overflowWrap:'anywhere'}},t(op.text)),op.diagnostic?h('details',null,h('summary',null,t('技术详情')),h('pre',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},op.diagnostic)):null):null;
  const suiteRecoveryText=details=>details?.stage==='suite-upgrade'?t('；升级未完成，部分组件可能已改变。当前读回：')+(details.actual?.components?.map(c=>c.label+' '+(c.version??t('检测不到'))+(c.active?'':t('（未启用）'))).join('；')||t('检测不到'))+t('。请完全退出客户端，使用补齐命令（仅 macOS / Linux 终端；Windows 安全命令暂未提供）修复并重新打开：')+details.command:'';
  /** pluginManager applied it, but the profile could not be read back: the installed list may still say 「需重启」. */
  const baselineText=result=>result?.restartBaseline?.updated===false?t('；但应用库没能读回 profile（')+result.restartBaseline.code+t('），已安装列表可能仍显示「需重启」'):'';
  /** rc.10 install recovery result: only an item-by-item readback that matched the baseline is shown as restored. */
  const recoveryText=recovery=>{if(!recovery)return'';
    if(recovery.status==='not-needed')return t('；安装前状态未被改动（已逐项读回）');
    if(recovery.status==='restored')return recovery.mode==='upgrade'?t('；已恢复到原版本 ')+recovery.previousVersion+t('（已逐项读回）'):t('；已恢复到安装前状态（已逐项读回）');
    const residue=(recovery.residue??[]).map(row=>row.item+(row.reason?'·'+row.reason:'')).join('、');
    return t('；恢复失败')+(recovery.error?'：'+recovery.error.code:'')+t('，未恢复：')+(residue||t('未知'))+(recovery.originals?.dir?t('，安装前原件：')+recovery.originals.dir:'')+t('。未安装成功，也未回到安装前状态，需要人工处理');};
  // rc.28 market: fixed filters first (everything / applications / plugins), then every category the catalog itself reported.
  const BASE_FILTERS=[['',t('全部')],['hanamesh-app',t('应用')],['plugin',t('插件')]];
  const KIND_TEXT={application:t('应用'),plugin:t('插件'),listing:t('仅收录')};
  const STATE_TEXT={registered:t('已安装'),installed:t('已安装'),'installed-not-loaded':t('需重启'),'uninstalled-not-unloaded':t('已卸载 · 需重启'),'runtime-missing':t('缺运行时'),invalid:t('包无效')};
  // Mirrors PROTECTED_PACKAGES on the host: the suite is never offered an uninstall button (the host answers 403 anyway).
  const PROTECTED=new Set(['@hanamesh/core','@hanamesh/usage','@hanamesh/brand','@hanamesh/dsh-app-host','hanamesh-core','hanamesh-usage','hanamesh-brand','@hanamesh/dsh-core','@hanamesh/dsh-usage']);
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
  function LibraryOverlay({embedded,preferredSubsectionId,verification=false}={}){useLocale();
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
    const load=React.useCallback(async()=>{try{setError('');setExtra([]);const page=await request('/hanamesh/library'+params());setSnapshot(page);remember(page);}catch(e){setError(e);}},[params]);
    const more=async()=>{try{const cursor=(extra.at(-1)??snapshot)?.page?.nextCursor;if(!cursor)return;const next=await request('/hanamesh/library'+params(cursor));setExtra(list=>[...list,next]);remember(next);}catch(e){if(String(e.message??e)==='CATALOG_CHANGED'){setSnapshot(null);setExtra([]);}setError(e);}};
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
      const selected=targetSelection;if(selected?.status!=='confirmation-required'||pendingOperations[selected.item.id]?.busy)return;
      setTarget({...selected,status:'installing'});
      const suite=selected.item.kind==='suite-upgrade';
      const outcome=await operate(suite?'/hanamesh/library/suite/upgrade':'/hanamesh/library/install',suite?{planId:selected.item.suiteUpgrade.planId}:{itemId:selected.item.id,packageName:selected.item.package.name},selected.item.id,suite?t('升级套件'):t('安装'),true);
      if(outcome){
        if(!outcome.ok){if(targetSelection?.item?.id===selected.item.id)setTarget({...targetSelection,status:outcome.unknown?'result-unavailable':suite?'suite-upgrade-failed':'failed',error:outcome.code,details:outcome.details});return;}
        if(suite){
          try{const snapshot=await request('/hanamesh/library/installedPlugins');if(!outcome.result.components.every(c=>snapshot.plugins.some(p=>p.packageName===c.name&&p.version===c.to&&p.active)))throw new Error('INSTALL_READBACK_MISMATCH');setPending(p=>({...p,[selected.item.id]:{label:t("升级套件"),text:()=>(t('套件升级已读回，请完全退出并重新打开客户端。'))}}));setChanged(true);setTarget({...selected,status:'installed'});}
          catch(error){setPending(p=>({...p,[selected.item.id]:{label:t("升级套件"),text:()=>(t('套件版本读回失败，请检查三个组件。')),failed:true}}));setTarget({...selected,status:'readback-failed',error:String(error.message??error)});}return;
        }
        try{const fresh=await request('/hanamesh/library/target?'+new URLSearchParams({itemId:selected.item.id,packageName:selected.item.package.name}));
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
    const pages=[snapshot,...extra].filter(Boolean),all=pages.flatMap(page=>page.items??[]),items=filter==='plugin'?all.filter(item=>item.kind==='plugin'||item.kind==='suite'):all,installed=snapshot?.installed??[],plugins=snapshot?.plugins??[],nextCursor=(extra.at(-1)??snapshot)?.page?.nextCursor??null;
    const restartRequired=changed||Boolean(snapshot?.restartRequired);
    const filters=[...BASE_FILTERS,...seenCategories.filter(c=>c!=='hanamesh-app').map(c=>[c,c])];
    const openButton=row=>h('button',{type:'button',disabled:Boolean(openingAppId),onClick:()=>void open(row)},openingAppId===row.appId?t('打开中…'):t('打开'));
    const card=item=>{const row=item.installed,op=pending[item.id],busy=op?.busy;const installBody={itemId:item.id,...(item.package?.name?{packageName:item.package.name}:{})};
      let action=h('span',null,t('仅收录，不可安装')),state=null;
      if(row)state=h('span',{className:'hm-market-state','data-hanamesh-state':row.state},(t(STATE_TEXT[row.state]??row.state))+(row.version?' '+row.version:''));
      if(item.kind==='suite')return h('article',{key:item.id,'data-hanamesh-library-item':item.id,'data-hanamesh-kind':'suite'},h('h3',null,t('HanaMesh 套件')),h('p',null,item.summary),h('p',null,item.suite?.status==='installed'?t('已安装 · Core ')+item.suite.version:item.suite?.status==='incomplete'?t('套件不完整，请查看组件状态'):t('套件状态未知，请查看 Core 声明与阻断原因')),item.suite?.completeness?h('p',null,t('Core 完整性：')+item.suite.completeness):null,...(item.suite?.components??[]).map(c=>h('p',{key:c.name},c.requiredRange?c.label+t(' · 要求 ')+c.requiredRange+t(' · 实际 ')+(c.actualVersion??t('检测不到'))+' · '+c.status:c.label+' · '+(c.version??t('检测不到'))+(c.active?'':t(' · 未启用')))),...(item.suite?.blocked??[]).map((row,i)=>h('p',{key:'blocked-'+i,role:'status'},row.code+(row.moduleName?' · '+row.moduleName:'')+(row.coreVersion?' · '+row.coreVersion:''))),item.suiteUpgradeUnavailable?h('p',{role:'status'},item.suiteUpgradeUnavailable):null,h('button',{type:'button',disabled:Boolean(item.suiteUpgradeUnavailable),onClick:()=>void openInstallTarget({itemId:'hanamesh:suite-upgrade'}).catch(()=>{})},t('检查兼容升级')));
      if(busy)action=h('button',{type:'button',disabled:true},t(op.text));
      else if(item.kind!=='listing'&&!row)action=h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/install',installBody,item.id,t('安装'))},op?.failed?t('重试安装'):t('安装'));
      else if(row&&item.upgradeAvailable)action=h('span',{className:'hm-market-actions'},h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/install',installBody,item.id,t('升级'))},t('升级到 ')+item.latestVersion),row.state==='registered'?openButton(row):null);
      else if(row?.state==='runtime-missing')action=h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/provision',{appId:row.appId,packageName:row.packageName,runtimeItem:row.runtimeItem},item.id,t('补齐运行时'))},t('补齐运行时'));
      else if(row?.state==='registered')action=h('span',{className:'hm-market-actions'},openButton(row),h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/uninstall',{appId:row.appId,packageName:row.packageName,runtimeItem:row.runtimeItem},item.id,t('卸载'))},t('卸载')));
      else if(row?.state==='installed')action=PROTECTED.has(row.packageName)?h('span',null,t('HanaMesh 套件')):h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/plugins/uninstall',{packageName:row.packageName},item.id,t('卸载'))},t('卸载'));
      else if(row?.state==='uninstalled-not-unloaded')action=h('span',null,t('已卸载，重启 DSH 后生效'));
      else if(row)action=h('span',null,t('已安装，重启 DSH 后生效'));
      return h('article',{key:item.id,'data-hanamesh-library-item':item.id,'data-hanamesh-kind':item.kind},h('h3',null,item.displayName),h('p',null,item.summary),
        h('small',null,t(KIND_TEXT[item.kind])+' · '+(item.publisher?.name??t('未知发布者'))+' · '+(item.latestVersion??'—')+((item.categories??[]).length?' · '+item.categories.join('、'):'')),
        state,action,op&&!busy?operationNotice(op):null);};
    const catalogSection=receipt?h('div',{className:'hm-app-frame'},h('div',null,h('strong',null,receipt.instance.appId),h('button',{type:'button',disabled:closing,onClick:()=>void close()},closing?t('关闭中…'):t('关闭视图'))),h('iframe',{ref:frame,src:receipt.uiUrl,title:receipt.instance.appId,sandbox:'allow-forms allow-modals allow-popups allow-same-origin allow-scripts'})):
      h('div',{className:'hm-library-grid',key:'catalog'},...items.map(card));
    const moreButton=nextCursor&&!receipt?h('button',{type:'button',className:'hm-library-more',key:'more',onClick:()=>void more()},t('更多')):null;
    const installedSection=!receipt&&(installed.length||plugins.length)?h('section',{className:'hm-market-installed',key:'installed'},h('h2',null,t('已安装')),h('ul',null,
        ...installed.map(row=>h('li',{key:'app:'+row.packageName,'data-hanamesh-installed':row.packageName},t('应用 · ')+(row.name??row.packageName)+' · '+row.packageName+' '+(row.version??'')+' · '+(t(STATE_TEXT[row.state]??row.state)))),
        ...plugins.filter(row=>!PROTECTED.has(row.packageName)).map(row=>h('li',{key:'plugin:'+row.packageName,'data-hanamesh-installed':row.packageName},t('插件 · ')+row.packageName+' '+(row.version??'')+' · '+(t(STATE_TEXT[row.state]??row.state))+(row.bundle&&!row.active&&row.state==='installed'?t('（未启用为 profile 层）'):''),
          row.state==='installed'&&!PROTECTED.has(row.packageName)&&!pending['plugin:'+row.packageName]?h('button',{type:'button',onClick:()=>void operate('/hanamesh/library/plugins/uninstall',{packageName:row.packageName},'plugin:'+row.packageName,t('卸载'))},t('卸载')):pending['plugin:'+row.packageName]?operationNotice(pending['plugin:'+row.packageName]):null)))):null;
    // The seat owner may ask for a subsection to come first; `installed` is the only one it names today.
    const body=preferredSubsectionId==='installed'?[installedSection,catalogSection,moreButton]:[catalogSection,moreButton,installedSection];
    return h('section',{className:embedded?'hm-market hm-market-embedded':'hm-library-overlay hm-market'},
      h('header',null,h('div',null,h('h1',null,t('HanaMesh 市场'))),embedded?null:h('button',{type:'button',onClick:()=>setLibraryVisible(false)},t('关闭'))),
      h(MarketConflictNotice,null),h(HandoffIssueNotice,null),
      snapshot?.restartBaseline?.known===false?h('p',{role:'alert',className:'hm-library-failed'},t('启动时没能读取 profile（')+snapshot.restartBaseline.code+t('），「需重启」状态无法判断，下面的状态都按已加载显示')):null,
      verification===true?h('section',{className:'hm-install-target','aria-label':t('安装目标开发小界面')},h('h2',null,t('安装目标')),
        h('p',null,t('输入目录条目 ID 或包名，市场查询当前目录后确认安装。')),
        h('form',{onSubmit:event=>{event.preventDefault();void openInstallTarget({...(targetItemId.trim()?{itemId:targetItemId.trim()}:{}),...(targetPackageName.trim()?{packageName:targetPackageName.trim()}:{} )}).catch(()=>{});}},
          h('input',{'aria-label':t('目录条目 ID'),value:targetItemId,placeholder:t('itemId（可选）'),onChange:event=>setTargetItemId(event.target.value)}),
          h('input',{'aria-label':t('包名'),value:targetPackageName,placeholder:t('packageName（可选）'),onChange:event=>setTargetPackageName(event.target.value)}),h('button',{type:'submit'},t('查看安装目标')))):null,
        target?h('div',{role:target.status==='confirmation-required'?'dialog':'status','aria-label':t('市场安装确认')},
          target.item?h('dl',null,h('dt',null,t('插件名')),h('dd',null,target.item.displayName),h('dt',null,t('包名')),h('dd',null,target.item.package.name),h('dt',null,t('版本')),h('dd',null,target.item.latestVersion??t('目录未提供版本')),h('dt',null,t('来源')),h('dd',null,target.source?.kind==='fixture'?t('测试目录（fixture）'):target.source?.manifestUrl??t('当前市场目录'))):null,
          target.item?.suiteUpgrade?h('ul',null,...target.item.suiteUpgrade.components.map(c=>h('li',{key:c.name},c.label+'：'+c.from+' → '+c.to)),h('li',null,t('确认后升级三个官方组件；需要完全退出并重新打开客户端。'))):null,
          target.item?.suiteUpgrade?.registry?h('p',null,'Registry：'+target.item.suiteUpgrade.registry):null,
          ...(target.item?.suiteUpgrade?.blocked??target.details?.blocked??[]).map((row,i)=>h('p',{key:'suite-blocked-'+i,role:'status'},row.code+(row.moduleName?' · '+row.moduleName:'')+(row.coreVersion?' · '+row.coreVersion:''))),
          target.status==='confirmation-required'?h('div',null,h('button',{type:'button',onClick:()=>void confirmTarget()},t('确认安装')),h('button',{type:'button',onClick:()=>{targetSequence++;void reportHandoff(targetSelection?.handoffId,'cancelled');setTarget({...targetSelection,status:'cancelled'});}},t('取消'))):
          target.status==='failed'?FailureNotice({error:target.diagnostic??target.error}):h('p',{role:['readback-failed','suite-upgrade-failed'].includes(target.status)?'alert':'status'},({resolving:t('正在查询市场目录…'),installing:t('安装中…'),installed:t('安装完成，请查看已安装列表'),'installed-live':t('安装完成，已加载，可以直接使用'),cancelled:t('已取消，未安装'),'result-unavailable':t('安装结果不可追溯，请查看已安装列表；不会自动重试'),'already-installed':t('已安装，无需重复安装'),failed:t('未安装：')+(target.error??pending[target.item?.id]?.text??t('安装失败')),'readback-failed':target.error,'suite-upgrade-failed':suiteTargetFailure(target)})[target.status]),
          target.item?.source?h('div',{'aria-label':t('目录条目来源')},h('p',null,target.item.source.sourceId+' · '+target.item.source.sourceRef),...(target.item.source.sourceLinks??[]).map((link,index)=>h('p',{key:index},h('a',{href:link.sourceUrl,target:'_blank',rel:'noopener noreferrer'},link.sourceId+' · '+link.sourceRef),h('small',null,' '+link.firstSeenAt+' / '+link.lastSeenAt)))):null,
          target.item?operationNotice(pending[target.item.id]):null,
          ['installed','already-installed'].includes(target.status)&&target.item?.installed?.state==='registered'?openButton(target.item.installed):null):null,
      verification===true?h('section',{'aria-label':t('C-MARKET 合约验证')},h('h2',null,t('C-MARKET 合约验证')),
        h('p',null,t('测试版；输入与输出仅供当前客户端验证。安装仍须在正常确认框确认。')),
        h('select',{'aria-label':t('合约调用'),value:verificationCall,onChange:event=>{const call=VERIFICATION_CALLS.find(call=>call.method+' '+call.path===event.target.value);if(call){setVerificationCall(event.target.value);setVerificationInput(JSON.stringify(call.sample,null,2));setVerificationOutput(null);}}},...VERIFICATION_CALLS.map(call=>h('option',{key:call.method+' '+call.path,value:call.method+' '+call.path},call.method+' '+call.path))),
        h('textarea',{'aria-label':t('合约样例输入'),value:verificationInput,onChange:event=>setVerificationInput(event.target.value)}),
        h('button',{type:'button',disabled:verifying,onClick:()=>void verify()},t('调用合约')),
        h('pre',{'aria-label':t('合约调用输出')},verificationOutput===null?t('尚未调用'):JSON.stringify(verificationOutput,null,2))):null,
      h('div',{className:'hm-library-toolbar'},h('input',{type:'search',placeholder:t('搜索应用与插件'),value:query,onChange:e=>setQuery(e.target.value),onKeyDown:e=>{if(e.key==='Enter')void load();}}),h('button',{type:'button',onClick:()=>void load()},t('搜索')),
        h('select',{'aria-label':t('类别'),value:filter,onChange:e=>setFilter(e.target.value)},...filters.map(([value,label])=>h('option',{key:value||'all',value},t(label))))),
      restartRequired?h(RestartNotice,null):null,
      error?FailureNotice({error}):null,
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
  function localizedSection(ctx,id,order,label,component){return ctx.slots.inject('settings.section',()=>{let dispose;const refresh=()=>{dispose?.();dispose=ctx.slots.register({name:'settings.section',id,order,label:t(label)},component);};refresh();const unsubscribe=localeService?.subscribe(refresh);return()=>{unsubscribe?.();dispose?.();};});}
  function apply(ctx,{verification=false}={}){localeService=ctx.locale??null;if(localeService)ctx.effect(()=>localeService.register('hanamesh.apphost',COPY),'hanamesh-app-host:locale');ctx.effect(()=>{const style=document.createElement('style');style.textContent='.hm-node-runtime{display:grid;gap:12px;max-width:900px;color:inherit}.hm-node-fields{display:grid;gap:10px}.hm-node-fields label{display:grid;gap:6px}.hm-node-runtime input,.hm-node-runtime select,.hm-node-runtime button{font:inherit;color:inherit;background:transparent;border:1px solid color-mix(in srgb,currentColor 30%,transparent);border-radius:8px;min-height:44px;padding:8px 12px;box-sizing:border-box;max-width:100%}.hm-node-runtime button{cursor:pointer}.hm-node-runtime button:hover:not(:disabled){background:color-mix(in srgb,currentColor 9%,transparent)}.hm-node-runtime button:focus-visible{outline:2px solid currentColor;outline-offset:2px}.hm-node-runtime button:disabled{opacity:.5;cursor:default}.hm-node-confirm,.hm-node-progress{border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:12px;padding:16px}.hm-node-confirm dl{display:grid;grid-template-columns:100px minmax(0,1fr);gap:8px}.hm-node-runtime dd{margin:0}.hm-node-runtime code,.hm-node-runtime dd{overflow-wrap:anywhere}.hm-node-runtime progress{width:100%}.hm-node-runtime [role=alert]{border-left:3px solid currentColor;padding-left:10px}'+'.hm-providers,.hm-library-sources{display:grid;gap:16px}.hm-providers table{width:100%;border-collapse:collapse}.hm-providers th,.hm-providers td{padding:8px;text-align:left;border-bottom:1px solid color-mix(in srgb,currentColor 14%,transparent)}.hm-provider-card{padding:16px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:12px}.hm-provider-row{display:grid;grid-template-columns:minmax(120px,1fr) auto minmax(180px,1fr) auto;gap:8px;align-items:center;margin:8px 0}.hm-source-row{display:grid;grid-template-columns:minmax(0,1fr) repeat(4,auto);gap:8px}.hm-source-row code{overflow-wrap:anywhere}.hm-source-add{display:flex;gap:8px}.hm-source-add input{flex:1}.hm-library-overlay{position:absolute;inset:0;z-index:30;pointer-events:auto;overflow:auto;padding:24px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}.hm-library-overlay button,.hm-library-overlay input,.hm-library-overlay select,.hm-market-embedded button,.hm-market-embedded input,.hm-market-embedded select{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}.hm-library-overlay>header{display:flex;justify-content:space-between;align-items:center}.hm-library-toolbar{display:flex;gap:8px;align-items:center;margin:8px 0}.hm-library-toolbar input[type=search]{flex:1;padding:6px 10px}.hm-library-more{margin:12px auto;display:block}.hm-library-failed{color:var(--dsw-alias-state-error-primary);margin:0}.hm-library-ok{color:var(--dsw-alias-state-success-primary);margin:0}.hm-restart-notice{padding:10px 12px;border:1px solid var(--dsw-alias-state-warn-primary);border-radius:8px;background:var(--dsw-alias-state-warn-tertiary);margin:8px 0}.hm-restart-link{margin-left:4px;font-weight:600}.hm-market-state{font-size:12px;color:var(--dsw-alias-label-secondary)}.hm-market-actions{display:flex;gap:8px;flex-wrap:wrap}.hm-market-embedded{display:block}.hm-market-embedded>header{display:flex;justify-content:space-between;align-items:center}.hm-market-conflict{padding:10px 12px;border:1px solid var(--dsw-alias-state-business-primary);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,transparent);margin:8px 0}.hm-install-target{display:grid;gap:8px;padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;margin:12px 0}.hm-install-target form{display:flex;gap:8px;flex-wrap:wrap}.hm-install-target input{flex:1;min-width:180px;padding:6px 10px}.hm-install-target dl{display:grid;grid-template-columns:80px 1fr;gap:6px}.hm-install-target dd{margin:0;overflow-wrap:anywhere}.hm-market-installed{margin-top:24px}.hm-market-installed ul{padding-left:18px;display:grid;gap:6px}.hm-library-toolbar select{padding:6px 10px}.hm-library-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}.hm-library-grid article{display:grid;gap:10px;padding:16px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:12px}.hm-app-frame{display:grid;grid-template-rows:auto 1fr;height:calc(100vh - 130px)}.hm-market-embedded>.hm-app-frame{position:fixed;inset:0;z-index:1001;height:100vh;box-sizing:border-box;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);padding:12px 16px}.hm-app-frame>div{display:flex;justify-content:space-between}.hm-app-frame iframe{width:100%;height:100%;border:0}';style.textContent+='/* Only AppHost surfaces: never resize the host settings shell. */\n.hm-node-runtime,.hm-library-sources,.hm-providers,.hm-market{min-width:0;width:100%;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere}\n.hm-node-runtime>*,.hm-library-sources>*,.hm-node-fields>*,.hm-handoff-settings>*,.hm-library-toolbar>*{min-width:0;max-width:100%;box-sizing:border-box}\n.hm-library-sources input,.hm-library-sources textarea,.hm-library-sources select,.hm-node-runtime input,.hm-node-runtime select{min-width:0;width:100%;max-width:100%;box-sizing:border-box;font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-2)}\n.hm-library-sources button,.hm-market button{min-height:44px;max-width:100%;white-space:normal;font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 12px}\n.hm-library-sources button:focus-visible,.hm-market button:focus-visible{outline:2px solid currentColor;outline-offset:2px}\n.hm-handoff-settings{display:grid;gap:12px}.hm-handoff-settings label{display:grid;gap:6px}.hm-handoff-settings input[type=checkbox]{width:auto}\n.hm-node-confirm,.hm-node-progress{min-width:0;max-width:100%;box-sizing:border-box}\n.hm-failure pre{max-width:100%;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.hm-failure summary{cursor:pointer}.hm-failure p{margin:8px 0}\n.hm-library-toolbar,.hm-source-add{flex-wrap:wrap}.hm-library-toolbar input[type=search]{min-width:0;width:100%;flex:1 1 180px}\n.hm-library-grid{grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))}\n.hm-providers{overflow-x:auto}.hm-source-row{grid-template-columns:minmax(0,1fr);gap:6px}\n@media(max-width:640px){.hm-library-overlay{padding:12px}.hm-node-confirm{padding:10px}.hm-node-confirm dl,.hm-install-target dl{grid-template-columns:minmax(0,1fr)}.hm-node-confirm dt{font-weight:600}.hm-node-confirm dd{margin-bottom:6px}.hm-library-toolbar select{width:100%}}\n';style.textContent+='\n.hm-provider-records td{overflow-wrap:anywhere}.hm-providers select,.hm-providers input{min-width:0;max-width:100%;width:100%;box-sizing:border-box}.hm-provider-records details>summary{cursor:pointer;min-height:44px;display:flex;align-items:center}.hm-provider-records pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}\n@media(max-width:640px){.hm-providers{overflow:visible}.hm-provider-records,.hm-provider-records tbody{display:block}.hm-provider-records thead{display:none}.hm-provider-records tr{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;margin:10px 0}.hm-provider-records td{display:block;min-width:0;padding:0;border:0}.hm-provider-records td::before{content:attr(data-label);display:block;font-weight:600;margin-bottom:4px}.hm-provider-records td:empty{display:none}}\n';style.textContent+="\n.hm-providers,.hm-library-sources,.hm-node-runtime{overflow-wrap:normal;word-break:normal}\n.hm-providers h2,.hm-library-sources h2,.hm-node-runtime h2{margin:0;font-weight:600;line-height:1.5}\n.hm-providers p,.hm-library-sources p,.hm-node-runtime p{margin:0;line-height:1.6}\n.hm-suite-fields,.hm-suite-fields>label,.hm-handoff-settings,.hm-source-add{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;min-width:0}\n.hm-suite-fields>*,.hm-source-add>*,.hm-providers>*,.hm-library-sources details,.hm-node-runtime details{min-width:0;max-width:100%;box-sizing:border-box}\n.hm-library-sources input,.hm-library-sources textarea,.hm-library-sources select,.hm-suite-fields select,.hm-providers select,.hm-providers input{display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box;min-height:44px;padding:8px;font:inherit;border:1px solid var(--dsw-alias-border-l2);border-radius:8px}\n.hm-library-sources input[type=checkbox]{display:inline-block;width:20px;min-height:20px;max-width:20px}\n.hm-library-sources summary,.hm-providers summary,.hm-node-runtime summary{min-height:44px;display:flex;align-items:center;cursor:pointer}\n.hm-library-sources code,.hm-library-sources dd,.hm-providers pre{overflow-wrap:anywhere;white-space:pre-wrap}\n.hm-handoff-settings>button,.hm-suite-fields>button{width:100%}\n@media(max-width:640px){.hm-provider-records tr{padding:8px}.hm-node-fields{grid-template-columns:minmax(0,1fr)}}\n";document.head.append(style);return()=>style.remove();},'hanamesh-app-host:style');
    ctx.effect(()=>localizedSection(ctx,'hanamesh-providers',18,"供应商",ProvidersSection),'hanamesh-app-host:providers');
    ctx.effect(()=>localizedSection(ctx,'hanamesh-library-sources',19,"市场目录源",LibrarySourcesSection),'hanamesh-app-host:library-sources');
    ctx.effect(()=>localizedSection(ctx,'hanamesh-suite-source',19.5,"套件安装包来源",SuiteSourceSettingsSection),'hanamesh-app-host:suite-source');
    ctx.effect(()=>localizedSection(ctx,'hanamesh-node-runtime',20,"安装环境",NodeRuntimeSection),'hanamesh-app-host:node-runtime');
    ctx.effect(()=>localizedSection(ctx,'hanamesh-library-handoff',20,"网站安装交接",HandoffSettingsSection),'hanamesh-app-host:library-handoff');
    ctx.effect(()=>ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:'hanamesh-library',order:30},LibraryAction)),'hanamesh-app-host:library-action');
    ctx.effect(()=>ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'hanamesh-library-overlay',order:30},verification===true?()=>h(LibraryOverlay,{verification:true}):LibraryOverlay)),'hanamesh-app-host:library-overlay');
    ctx.effect(()=>claimMarketSeat(ctx,{verification}),'hanamesh-app-host:market-seat');
    ctx.effect(()=>{let stopped=false,timer;const tick=async()=>{await pollHandoffsVisibly();if(!stopped)timer=setTimeout(()=>void tick(),handoffPollMs);};void tick();return()=>{stopped=true;clearTimeout(timer);};},'hanamesh-app-host:website-handoff');
    ctx.effect(()=>{globalThis.addEventListener?.('hashchange',consumeInstallTargetHash);consumeInstallTargetHash();return()=>globalThis.removeEventListener?.('hashchange',consumeInstallTargetHash);},'hanamesh-app-host:install-target-navigation');}
  return{name,inject,apply,ProvidersSection,SuiteSourceSettingsSection,LibrarySourcesSection,HandoffSettingsSection,NodeRuntimeSection,LibraryAction,LibraryOverlay,MarketConflictNotice,createMarketSeat,openInstallTarget,
    MARKET_SEAT,MARKET_CONFLICT_TEXT,INSTALL_TARGET_HASH,INSTALL_TARGET_CONTRACT_VERSION,marketState:()=>({conflict:marketConflict,entryVisible})};
}});
