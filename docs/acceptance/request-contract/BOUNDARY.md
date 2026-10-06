# P02-APPHOST-REQUEST-01 · 请求边界核查

本节点只增加可复跑的SOURCE/FIXTURE证据。生产src、package/lock、API、profile、schemas、build与devkit/provision pins均未修改；不生成新候选tgz，不将F4宣称修复。基线为已独立通过AppHost rc6/source 2788ecfc29e2d63d96094ec114d63119b3e207f4。正式产品仍为AppHost rc2/source 5881527d6eea459a1ce24ca06e1a6ee68218dd49；七个相关源码/包内/built文件逐byte相同，见source-inputs.json。

## 已有公开HTTP契约

| 字段/步骤 | 值来源与约束 |
| --- | --- |
| 请求目标 | 客户端相对路径 `/hanamesh/library/provision`，POST，JSON `{appId,packageName,runtimeItem}`；来自已安装扫描，不以目录版本覆盖已装manifest |
| Host | AppHost `parentOrigin` 的host；默认当前 `webServer.port` 的 `http://127.0.0.1:<port>`；只有宿主配置能设置parentOrigin，必须精确HTTP数字回环 |
| Origin | 由真正浏览器的workspace页面/物理载体提供；必须逐字等于parentOrigin。客户端代码没有设置Origin，不能从renderer参数伪造HTTPOrigin |
| 标记 | 客户端写 `x-hanamesh-client: workspace-v1`；该常量单独不能证明来源或认证 |
| frame | `sec-fetch-dest: iframe`拒绝；Connection另拒绝cross-site元数据 |
| 认证 | `browserAuthentication`调用公共 `connection.requestRejection(req)`；Connection自己的Host/Origin fence及真实签名cookie决定，不解析token或读私有connection/browserAuth状态 |
| 授权 | 获取 `dsh-browser`主体后逐请求调用authorize；当前DSH单用户实现只授该主体。回调拒绝仍403/FORBIDDEN |
| 供应 | 原library.service异步operation → installer读取实际已装app.json/核appId与runtimeItem → 内联provision校验归档/落位/自己的ledger。202仅表示已接收，必须等待done/failed事件 |

`src/client-ui.js:5–7,202`、`src/dsh.js:98–108,118,130,163–181`、`src/library/routes.js:9–16`是AppHost当前 owning source；七个边界文件的固定摘要见source-inputs.json。

## 公开载体缺口及归属

真实产品独立VERIFY d54fb5d只证明：正式rc6目录补齐按钮一次后AX/真实像素显示CSRF_DENIED，Vibe仍不能打开。未采真实Chromium请求头/HTTP状态，本节点也未操作正式GUI，不能称正式实测403或断定删Origin为唯一根因。

SOURCE/FIXTURE隔离实测：带真实Connection生成的测试cookie但无Origin，Connection.requestRejection返回undefined/admit给operator peer，AppHost仍403/CSRF_DENIED、供应操作0。原样dsh-app://app由Connection拒403，AppHost先拒ORIGIN_DENIED。精确HTTPOrigin+cookie+标记能202并完整供应fixture；缺认证、假标记、外来源、iframe与授权拒绝均不执行。

公共HostConnectionHandle.admit只返回 `{peer}` 或 `{rejection}`；没有把原始native renderer provenance变成AppHost精确workspace来源证明的字段/参数。`connection/request`明确只描述已经通过Connection admission的共享/api请求，不是AppHost这些raw webServer exact routes。Connection.fetch.register/createSharedFetchHandler及rpc.handle已有公共通道，但物理载体先负责可信/认证；移动路径本身不能证明来源，也不能用admit接受无Origin来删AppHost的CSRF条件。

因此当前没有可在本origin单独实施且保持原信任语义的生产修复。最小下一项由PM协调现任Desktop公共载体writer：交付与实际浏览器/原生sender相绑定、已由现有公开Connection承认的请求载体及公开参数证据，或使用现有真正HTTP workspace载体保留浏览器自然产生的合法Origin。不能合成HTTPOrigin、信任任意renderer、删Origin后把cookie当工作台来源证明、改Core/DSH私有源或为AppHost加Desktop专用分支。

PM新路线优先复用既有同源Host HTTP入口承载原生窗口，AppHost已有协议/公开启动配置可用，详见PUBLIC_CONFIG.md。本轮不提出新的Admission/header/provenance架构；实际HTTP承载、正常认证、有效Node/profile/CLI参数由原Desktop writer核。参数与请求边界各有独立证据，不能用市场可浏览代运行时可启动。

## 复跑

固定Node24.13.1/npm11.8.0/pnpm10.33.0/TS5.8.3，先全新隔离run与HOME/DSH_HOME/TMP，env只取run.py列出的allowlist。安装前实际执行export npm_config_cache=$(mktemp -d)。

```sh
python3 docs/acceptance/request-contract/run.py /absolute/new/run install /bin/zsh -c 'export npm_config_cache=$(mktemp -d); npm ci'
python3 docs/acceptance/request-contract/run.py /absolute/new/run build npm run build
python3 docs/acceptance/request-contract/run.py /absolute/new/run probe node docs/acceptance/request-contract/probe.mjs /absolute/new/run/_evidence/request-contract/probe.json
```

probe创建新的临时profile、测试应用描述符、本地归档及credential provider double；Connection本身生成测试签名cookie且不输出token/cookie/记录值。真实Cordis/Connection/AppHost loader、存储、HTTP、原library与provision代码执行；fixture不是Vibe或真实产品。ledger只由原provision创建，不手造；finally正常dispose与删自己的临时树。14项为一个正例+13负例，原28条相关回归另跑通过。第一次fixture描述符缺readiness marker的失败原log/json保留，补齐后重跑exit0。

## 规则/边界

read-laws environment-matrix限制本机组件结果不外推产品/OS；当前CARD官方rc2精确pins与CONTRACT §0优先于law旧Tauri/peer范围。reference-learnings：parallel-windows-drift-on-origin-contract-mock-must-copy-host-fence要求从真实Connection读取拒绝语义；isolated-profile-must-sanitize-inherited-credentials要求allowlist；harness-passes-do-not-prove-host-integration限制fixture不代产品；browser-fetch-must-keep-its-receiver用于核客户端已有bind(globalThis)。没有codegen-pair声明；dist只由build生成，未手改。

索引weight未写、未pull/flush/docs-sync：本卡只own origin证据与REPORT/BLOCKED且docs两次500停止第三次同状态push。独立评审、正式P02目录补齐/Vibe打开、OAuth、模型、资金、干净机均NOT_RUN；模型预计0/实际0。新dependency/peer/vendor/config与生产改动0。
