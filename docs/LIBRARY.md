# 应用安装与运行时

在 DSH 插件页的 HanaMesh 市场选择应用并确认。Market 把已审核的安装目标和精确版本交给 AppHost 的 Cordis 服务。AppHost 使用当前 profile 的正式 DSH CLI 安装，读回已保存的包与精确版本，验证应用定义，并在同一次操作内供给声明的运行时。完成后显示结果及完全退出、重新打开客户端的提示。

应用定义验证、安装读回或运行时供给失败时，AppHost 通过正式 CLI 补偿，并重新检查选中包、版本、依赖和锁。恢复结果会随失败返回。安装、卸载和运行时补齐共享 AppHost 的 profile 写入限制。已安装应用可从 HanaMesh 首页的「继续使用」或 AppHost 插件配置打开、补齐运行时或卸载。

## Cordis 服务

`hanameshApps.installApplication({target, version, registry?})` 供可信宿主插件在用户确认后调用。目标是带精确版本的 npm 安装目标或带完整提交 SHA 的 GitHub 安装目标。对于 npm，Market 传入本次已审核的 registry。GitHub 目标使用固定提交。成功回执为 `{status:'ready',appId,packageName,version,restartRequired}`。这个状态表示安装及运行时读回已完成。包激活仍可能需要重新打开 DSH。

AppHost 的安装环境使用同一正式 DSH CLI、profile 和独立 Node。关于认证的工作区安装接口、已审目录目标与恢复结果，请参阅[安装目标](INSTALL_TARGET.md)。

## HanaMesh 套件

Core 的协议 `'1'` 声明负责套件状态、组件兼容性和精确升级目标。AppHost 在当前 profile 消费其 `completeness`、组件版本与具名阻断原因。Core 缺席或事实无法读取时，套件显示 `unknown`。总包缺席时，当前客户端可以显示 Core 给出的旧组件判定。总包、Core、Usage、AppHost 及当前 Brand 包受普通安装与卸载保护。

「套件安装包来源」可选择现有 registry 或 Core 当前提供的本机来源。预览、确认和执行都复读来源与套件声明。来源或精确目标变化后需要重新确认。
