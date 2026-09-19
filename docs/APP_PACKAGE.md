# HanaMesh 应用 npm 包规范 v1

应用是 DSH bundle，而不是 app-host 的私有配置片段：这样 DSH 自己的 profile/lockfile 是唯一包安装事实，Cordis 可以在同一次启动里加载 bundle、注册静态 `app.json`，应用库也能用标准 npm 版本与完整性语义安装和卸载。app-host 只消费注册后的定义与 lib-provision 账本，不扫描任意脚本或猜测入口。

## 必需结构

包名必须是 `@hanamesh/app-<name>`，`type` 必须是 `module`，稳定版本发布到 `latest`。同一版本的任意字节不得改变；内容变化必须升版本。`app.json` 的 `id` 是持久数据与 runtime 根身份，一经发布永不改变。

```json
{
  "name": "@hanamesh/app-example",
  "version": "1.0.0",
  "type": "module",
  "files": ["app.json", "dsh.js", "cordis.patch.yml", "README.md", "LICENSE"],
  "peerDependencies": { "@hanamesh/dsh-app-host": "0.1.0-rc.12" },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } },
  "hanamesh": { "app": "./app.json", "contractVersion": 1 }
}
```

生产包不得有 `dependencies` 或 `optionalDependencies`；应用运行时由 `app.json.deployments[].runtime` 的固定 manifest 和 sha256 管理，不能藏在 npm 生命周期脚本里。包必须精确携带上述五个文件，不纳入构建缓存、源码树或生成日志。

`app.json` 必须通过 app-host 导出的 `validateDefinition`；runtime 部署必须省略 `command`。`cordis.patch.yml` 只允许一次 `insert`，其 `id` 与 `name` 都指向本包。`dsh.js` 不超过 30 行，只读取同包 `app.json`、调用 `ctx.hanameshApps.register(definition)`，不得下载、安装、启动进程或接受动态 config。

最小入口：

```js
import { readFile } from 'node:fs/promises';
export const name = '@hanamesh/app-example';
export const inject = ['hanameshApps'];
export async function apply(ctx, config = {}) {
  if (Object.keys(config).length) throw new Error('Application bundle does not accept config.');
  const definition = JSON.parse(await readFile(new URL('./app.json', import.meta.url), 'utf8'));
  ctx.hanameshApps.register(definition);
}
```

预发布版本只用于隔离验收且不得成为 `latest`；应用库生产路径只接受 registry `latest` 返回的稳定精确版本。发布者必须同时保留 npm 包完整性、runtime 三方来源与 sha256、以及与 app-host 精确 peer 版本对应的可复核构建记录。
