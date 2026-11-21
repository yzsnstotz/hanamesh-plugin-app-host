# AppHost 应用安装合约

AppHost 在已认证的 DSH 工作区解析、安装和读回固定应用包。请求沿用 AppHost 的授权、Host、Origin 和 iframe 边界。写请求带同源 Origin、JSON 正文与 `X-HanaMesh-Client: workspace-v1`。

| 端点 | 作用 |
| --- | --- |
| GET `/hanamesh/library/target` | 以目录条目 ID 或包名解析精确目标。可声明 `contractVersion: '1'`。 |
| POST `/hanamesh/library/install` | 重新核对目录目标后，经公开 DSH CLI 安装精确包。GitHub 安装提交完整已确认目标。 |
| GET `/hanamesh/library/events` | 按操作 ID 区分受理、完成和失败。游标丢失时返回 `resetRequired`。 |
| GET `/hanamesh/library/installedPlugins` | 列出该 profile 实际读取到的应用、插件及是否需要重启。 |
| POST `/hanamesh/library/provision`、`/hanamesh/library/uninstall` | 按应用、包名与受管 runtime 标识补齐运行时或卸载。 |

安装确认展示精确 npm 版本，或 GitHub 仓库、完整 commit、子目录及批准的本机构建名单。执行前复读目标。安装失败记录原始阶段、诊断、补偿结果和残留，完成后读回精确包身份与版本。

`@hanamesh/dsh-app-host/install-target/schema.json` 定义版本 1 的数据。`@hanamesh/dsh-app-host/install-target/suite` 暴露 `runProviderSuite()`、`validate()` 与 `loadContract()`。套件在独立回环端口验证安装目标、鉴权、确认、结果读回及失败恢复。正常包可运行：

```sh
node node_modules/@hanamesh/dsh-app-host/dist/install-target/run.js provider
```

测试构建通过 AppHost 原生插件配置打开合约验证面板，默认读取安装环境。输入可编辑，面板显示完整的成功或拒绝响应。安装调用仍需核对来源并显式确认。
