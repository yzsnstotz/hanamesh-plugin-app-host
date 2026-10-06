# 请求契约证据节点清理

构建清理：本人lsof +D逐项确认零占用后，删除本task node_modules、隔离HOME/DSH_HOME/TMP及安装时本人mktemp新建的npm cache。保全task source/Git/跟踪dist、fresh clone/Git、全部_evidence、原rc2包与他人最新canonical rc6包。生产字节未改，没有新候选或重复包可删，没有删除他人构建/在用路径；signalsSent0。详cleanup.json。

首次清理脚本要求npm cache也在run下，但macOS mktemp实际创建的是记录于npm-cache-path的系统临时路径；包含断言在任何删除前停止exit1。核同一安装命令捕获的精确自有路径并重新逐项lsof后才删；不是猜临时目录批量清盘。cleanup-attempt1.json保留该失误。

fresh clone冻结证据首节点fd243fc59d2d35a3c9e2de5a648802c2e5be1b6f。项目strict-env preflight exit0；git-readiness脚本exit0但表格列明任务branch、无v0.2.0-rc.6 tag、main旧5881527不等任务头，未冒称发布收口通过。作者MD/MJS/PY/JSON无尾空白；全diff --check exit2仅原始npm/TAP日志保留的尾空白，原byte不改。完整源码/元功能/上游pins保全。
