# app-host 仓库行为边界

当前本地候选版本 0.1.0-rc.6；真实 DSH profile 已跑，但只有用户可以签 ACCEPTED。不要把通过本地 fixture 等同于真实宿主 ACCEPTED。

## 只维护本模块

维护实例事实、视图租约、应用进程所有权、受控网关和公开契约；不接管工作台 UI、runtime driver、应用安装授权、钱包 signer 或模型凭据。保持宿主与协议/服务、客户端产品解耦。优先复用上游公开扩展点，不 fork、不改 DSH 内核；实际 API 不可读时明确阻塞，不猜名字实现“兼容层”。

## 不变量

同一 view 不叠加匿名引用；恢复只匹配完整持久身份；端口不是身份；generation 变化立即使旧 token 和旧网关票据失效。先持久预留再 spawn；终止确认后才写 stopped。所有与一次状态变更有关的记录和通知必须在同一完整镜像发布。只停精确自有子进程组；attach 永不发信号。只有经过已注册配置的命令/参数/环境可用于启动；浏览器只能传公开标识和租约字段。

不写自创 DSH session 事件；不对应用注入脚本、SDK、特权 postMessage；不改应用 auth/CSRF/CORS；网关正文保持字节相同，安全响应头只调整 XFO 和具名 frame-ancestors。不得为了测试绕过浏览器管理员策略。

## 验证与修改纪律

修改前读 README、CONTRACT、SECURITY、consistency.json 和 acceptance/REPORT。运行 build、test、mutation、类型检查与干净目录 tarball 验证；X02/X03 用真正 SIGKILL，抛异常不算。默认测试独立临时路径和随机回环端口，不触碰 ~/.dsh 或 3080，不用进程名批量 kill。新补真实 DSH 验收必须指定独立 DSH_HOME 和已锁定 profile。

当前源码并非从指定原型提取。拿到私有原型后核实 commit/path/license，再决定映射或替换；不要编造继承关系。候选契约不可直接宣称兼容未见过的原型描述符。

只有用户可以标 ACCEPTED。存在 H01/H11 阻塞时保持 PARTIAL，不把 rc 产物登记成可解锁 workspace 的正式版本。只改本模块代码、证据和自己的交接记录，不覆盖其他模块的 STATUS/checkpoint。模型实际使用按事实记录，禁止冒称已切换 Opus 或完成多模型审查。
