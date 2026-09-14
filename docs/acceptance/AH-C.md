# app-host 0.1.0-rc.4 · 凭据声明与注入（AH-C1–C6）· 2026-09-14

**状态：DELIVERED（本机 session 实现 + 离线真实子进程验证；真实 DSH 宿主装 rc.4 + vibe rc.3 的联验待 plugin-auth-apikey 回收时做）。rc.3 ✅ 不动。**

来源：[凭据决策](../../../../Docs/Projects/hanamesh/decisions/2026-09-14-credentials-oauth-and-apikey.md) §3.3、brief `modules/app-host/DEV_BRIEF.md` 末段。改动：`src/descriptor.js`（`credentialEnv` 校验）、`src/manager.js`（`credentialResolver` 座位、启动前解析、只注入声明名、HOME 内 0600 文件、事件、失败不挡启动）、`src/runtime.js`（注入值/文件内容进 redact 集合，redact 键名匹配增加 AUTH/OAUTH/CREDENTIAL）、`src/index.d.ts`（类型）、`tests/fixtures/app.mjs`（回显声明 env 与 HOME 文件）、`tests/credentials.test.mjs`、`scripts/mutations.mjs`（M05）。

| ID | 结果 | 证据 |
|---|---|---|
| AH-C1 | PASS · UNIT | 宿主控制名（`DSH_TOKEN`、`HOME`）、重复、与静态 env 重名、`../`/绝对路径、未知 kind 全部 `INVALID_CREDENTIAL_ENV`；合法声明经 `list()` 原样带出 |
| AH-C2 | PASS · 真实子进程 | resolver 给的 `EXAMPLE_API_KEY`/`LANGCHAIN_PROVIDER` 在子进程 env 可见（fixture `/identity` 回显）；`.codex/auth.json` 写进 `<dataDir>/home`，mode 0600 |
| AH-C3 | PASS | 未声明的 `UNDECLARED_KEY` 不进子进程；事件 `credential.env-rejected {names:[UNDECLARED_KEY, file:../escape.txt]}`、`credential.injected {names:[EXAMPLE_API_KEY, LANGCHAIN_PROVIDER, file:.codex/auth.json]}` |
| AH-C4 | PASS | `../escape.txt` 被拒，dataDir 下不存在该文件 |
| AH-C5 | PASS | resolver 抛 `BROKER_DOWN` → 实例仍 `ready`，事件 `credential.resolver-failed {code:BROKER_DOWN}` |
| AH-C6 | PASS | 无 resolver / disposer 后：不注入、无 `credential.*` 事件；rc.3 全部 51 测试通过（回归） |
| 日志脱敏 | PASS | 子进程 stdout 打印 key → `logTail` 只见 `[REDACTED]` |
| M05 变异 | DETECTED | 去掉「只注入声明名」过滤 → AH-C2 变红；5/5 变异（含原 4 条）全部检出，见 `docs/acceptance/mutations/` |
| 真实 DSH 宿主 | NOT_RUN | 装进隔离 profile + `plugin-auth-apikey` 作为 resolver + vibe rc.3 打开——归 Wave 5 回收 |

命令：`npm run build && npm test && npm run test:types && npm run check:consistency && npm run test:mutation`（Node 24.13.1，darwin-arm64）。一次观察：`test:mutation` 首跑时 M02 基线在紧接全量测试后失败一次（疑为端口/时序抖动），单独重跑 `tests/crash.test.mjs` 8/8 与再次整跑 5/5 均通过；未改任何判据。

产物：`artifacts/hanamesh-dsh-app-host-0.1.0-rc.4.tgz` sha256 `9c3418757737669d078dba253f019039ba0440aed1e5aae736f9aa6ce66a7949`。
