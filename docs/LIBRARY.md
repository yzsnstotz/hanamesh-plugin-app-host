# HanaMesh 应用库

## 范围

应用库是 app-host 自带的 DSH 页面，不依赖第三方市场。它读取一个启用的目录源，同时独立扫描当前 profile 已安装的应用包；由 Community Market 安装的同一包会被接管，不做宿主市场探测。

## 目录源

- `library.fixture` 只用于受控验收；内容必须符合 `schemas/catalog-provider-page.schema.json`。
- `library.sources` 可有多项，但浏览时必须恰好启用一项。远端 manifest 只接受标准端口 HTTPS、无凭据/query/fragment；endpoint 必须同源。
- 请求固定 `Accept: application/json` 与 `Accept-Encoding: identity`；最多三次同源跳转，拒绝压缩响应与超过 2 MiB 的响应。
- 只有 `categories` 含 `hanamesh-app` 且 `package.registry` 为 `npm` 的条目可安装；repository-only 与普通插件只展示。

## Profile 与安装

钉版本 DSH 没有向插件公开 profile 目录或 profile 名，因此启用安装时 `library.profileDir`（绝对路径）和 `library.profileName` 必填。Electron 下还必须由 dsh-runtime/core 提供绝对 `nodeBinary`；应用库不会回退到 `process.execPath`。

安装先向 registry 的 `latest` 端点复核精确稳定版本，再用显式 Node 执行 DSH 自己的 `bin.js plugin --profile <name> add --save-exact <package>@<version>`。成功后读取包内 `app.json`；如果描述符声明 runtime，则调用随包内联的锁定 `@hanamesh/lib-provision@0.1.0-rc.1`。生产默认拒绝 prerelease；隔离 Verdaccio 验收可显式设 `allowPrerelease: true`。

安装/卸载完成只返回 `restart-required`，绝不静默重启 DSH。卸载只删除包与 lib-provision 账本认领的 runtime 文件，保留 `<dataRoot>` 下应用数据；彻底删除需用户手动处理对应数据目录。

## 状态与路由

已安装扫描给出 `registered`、`installed-not-loaded`、`runtime-missing` 或 `invalid`。浏览器路由为 `/hanamesh/library`、`/hanamesh/library/sources`、`/hanamesh/library/install`、`/hanamesh/library/provision`、`/hanamesh/library/uninstall` 和 `/hanamesh/library/events`，全部复用 app-host 的 Host/Origin/iframe/auth/CSRF 防护链。

应用打开仍只走 app-host 的视图租约 API；页面只保存临时 receipt，不拥有第二份实例状态。

## 锁定产物

私有依赖同时保留精确 peer 与 `file:vendor/` 开发依赖。build 从 vendor tgz 提取 `lib/**` 到 `dist/provision/`，并带入 notices 与 `LICENSE` 标记；来源和 SHA-256 记录在 `docs/PROVENANCE.json`。
