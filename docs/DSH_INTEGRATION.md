# DSH 集成

AppHost 是未修改上游 DSH 的普通插件，注入 `webServer`、`storageDomain`、`connection`。缺失连接服务时不激活、不公开路由。应用/Router/Node runtime 各自存储和资源在卸载时按精确所有权释放；失败激活同样清理已取得的资源。

客户端只注册 Core 的应用继续使用与模型槽，以及原生插件配置槽。市场与网站交接由独立 `@hanamesh/market` 提供。应用打开、启动中只读查询、ready 后单次 resume、心跳、前台续租、关闭/隐藏卸载精确释放和 Desktop bootstrap 证明均继续由本包完成。

受管独立 Node 使用现有校验及 lib-provision，不更改客户端或系统 Node。配置和 HTTP 约束见 CONTRACT.md；边界见 SECURITY.md。真实 DSH rc.4/rc.3/rc.1 与浏览器截图须另附验收证据，单元 harness 不代替真实客户端。
