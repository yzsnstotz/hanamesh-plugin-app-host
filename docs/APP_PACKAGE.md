# HanaMesh 应用 npm 包规范（契约 v2）

应用是 DSH bundle，而不是 app-host 的私有配置片段：这样 DSH 自己的 profile/lockfile 是唯一包安装事实，Cordis 可以在同一次启动里加载 bundle、注册静态 `app.json`，应用库也能用标准 npm 版本与完整性语义安装和卸载。app-host 只消费注册后的定义与 lib-provision 账本，不扫描任意脚本或猜测入口。

## 必需结构

包名必须是 `@hanamesh/app-<name>`，`type` 必须是 `module`，稳定版本发布到 `latest`。同一版本的任意字节不得改变；内容变化必须升版本。`app.json` 的 `id` 是持久数据与 runtime 根身份，一经发布永不改变。

```json
{
  "name": "@hanamesh/app-example",
  "version": "1.0.0",
  "type": "module",
  "files": ["app.json", "dsh.js", "cordis.patch.yml", "README.md", "LICENSE"],
  "peerDependencies": { "@hanamesh/dsh-app-host": "0.1.0-rc.43" },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } },
  "hanamesh": { "app": "./app.json", "contractVersion": 2 }
}
```

生产包不得有 `dependencies` 或 `optionalDependencies`；应用运行时由 `app.json.deployments[].runtime` 的固定 manifest 和 sha256 管理，不能藏在 npm 生命周期脚本里。包必须精确携带上述五个文件，不纳入构建缓存、源码树或生成日志。

`app.json` 必须通过 app-host 导出的 `validateDefinition`；runtime 部署必须省略 `command`。`cordis.patch.yml` 只允许一次 `insert`，其 `id` 与 `name` 都指向本包。`dsh.js` 不超过 30 行，只读取同包 `app.json`、在 `hanameshApps` 出现时调用 `register(definition)` 并在作用域结束时 `unregister`，不得下载、安装、启动进程或接受动态 config。

## 契约 v2 最小入口（rc.43 起，`hanamesh.contractVersion: 2`）

应用 bundle 与 app-host 都是 profile 里的独立 Loader 条目，DSH 卸载 HanaMesh 套件时不会连带卸载已装应用。因此入口**不得**把 `hanameshApps` 写成顶层 `inject`，而是在 `apply` 里用 Cordis 公开的 `ctx.inject` 订阅：

```js
import { readFile } from 'node:fs/promises';
export const name = '@hanamesh/app-example';
export async function apply(ctx, config = {}) {
  if (Object.keys(config).length) throw new Error('Application bundle does not accept config.');
  const definition = JSON.parse(await readFile(new URL('./app.json', import.meta.url), 'utf8'));
  ctx.inject(['hanameshApps'], scoped => {
    const apps = scoped.get('hanameshApps');
    const { appId, registrationId } = apps.register(definition);
    return () => apps.unregister(appId, registrationId);
  });
}
```

行为（由 `tests/app-package-lifecycle.test.mjs` 在真实 Cordis 根、`docs/acceptance/p02-apphost-contract/` 在真实 DSH 0.1.5-alpha.1 上验证）：

- **宿主缺席：** bundle 自身是 active 的 Loader 条目，只是不注册任何东西；DSH 正常启动，HanaMesh 页面与路由不存在。
- **宿主到来 / 恢复 / 重载：** 每次 `hanameshApps` 出现，订阅作用域执行一次 `register`；同一宿主生命里只有一份定义，不重复写事件。
- **宿主离开：** 作用域随服务一起结束；宿主自己的 `dispose` 停掉全部自有进程，此时 `unregister` 是 no-op（`reason:'host-closing'`）。
- **应用被卸载 / bundle 重载：** `unregister(appId, registrationId)` 先撤下定义（不能再新开），再经正常停止路径停掉该应用全部自有 runtime；实例记录、应用数据目录与 storage-domain 记录保留，重装后复用同一单实例槽位与数据目录。只撤下返回该 `registrationId` 的那一次 `register`：id 每次注册随机生成、永不复用，所以同一份定义重新注册（同版本重装、bundle 重载）后，旧注册迟到或重复的 disposer 返回 `removed:false, reason:'registration-replaced'`，不撤新注册、不停新进程。`definitionHash` 只是定义内容指纹，不是注册身份，传给 `unregister` 会以 `INVALID_REQUEST` 拒绝。撤销与并发打开的顺序由宿主的串行队列决定：撤销前已开始落盘的预留会被一并停掉；撤销时仍在排队的打开以 `APP_NOT_REGISTERED`（404）拒绝，不会新建实例或进程；撤销在同一个串行步骤内把该应用的运行实例落盘为 `stopping`，所以 bundle 重载时新注册立刻发起的打开得到可重试的 `INSTANCE_STOPPING`（409），停止事件之后重试即在同一槽位、同一数据目录启动新进程；其他应用的实例不受影响。
- **错误不被吞：** `app.json` 解析失败在 `apply` 顶层抛出，按 DSH 规则让启动失败并指明本包；定义校验失败（`validateDefinition`）与重复 `appId` 在订阅作用域里抛出，由 Cordis 以 error 级日志报出、不注册任何东西；其中定义校验失败在市场「已安装」列表里同时显示为「包无效」与错误码（扫描用同一 `validateDefinition`）。配置不为空同样在顶层抛出。

版本门：`peerDependencies["@hanamesh/dsh-app-host"]` 必须精确为 `0.1.0-rc.43` 或更新（`registrationId` 自 rc.43 起才存在；rc.42 候选的 `unregister(appId, definitionHash)` 形状已作废、从未发布），`package.json` 写 `"hanamesh": { "app": "./app.json", "contractVersion": 2 }`。app-host 导出 `checkAppPackageEntry(entry, packageJson)` 供应用仓自己的测试调用：顶层 `inject` 含 `hanameshApps`（数组或映射形式）或 `contractVersion` 不是 2 时抛错；它不执行入口。

### v1 入口（已废弃，仅供识别旧包）

v1 入口写 `export const inject = ['hanameshApps']` 并直接 `ctx.hanameshApps.register(definition)`。宿主在时可用；但 `dsh plugin remove hanamesh-core`（或单独移除 app-host）后，该 bundle 永远等待 `hanameshApps`，DSH 0.1.5-alpha.1 把未激活的 Loader 条目当作启动失败，整个 DSH 起不来（P02-U03，2026-10-02）。app-host 无法替一个已不在场的宿主修好旧包：它只能在宿主在场时提示。rc.42 起「已安装」扫描给每个应用包返回 `contractVersion` 与 `hostLifecycle`（`host-optional` = v2；`host-required` = v1 或未声明），市场「已安装」列表对 `host-required` 应用注明「卸载 HanaMesh 套件前请先卸载此应用」。旧包只能由其应用仓按上面的 v2 入口重新发版修复。

预发布版本只用于隔离验收且不得成为 `latest`；应用库生产路径只接受 registry `latest` 返回的稳定精确版本。发布者必须同时保留 npm 包完整性、runtime 三方来源与 sha256、以及与 app-host 精确 peer 版本对应的可复核构建记录。
