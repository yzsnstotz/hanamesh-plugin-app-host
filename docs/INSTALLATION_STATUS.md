# Public installation status bridge · contract 1

AppHost 0.6.7 supplies metadata discovery and a separate, explicitly consented read. Discovery never launches a reader. This is an installation observation, not permission to install/upgrade, a Usage consent change, compatibility calculation, or proof of another client.

## Discovery and request

Both the existing website handoff listener and the DSH local library listener add optional `installationStatus` to `GET /hanamesh/library/install-target`:

```json
{"contract":"hanamesh.installation-status","contractVersion":"1","path":"/hanamesh/library/installation-status"}
```

The field is advertised independently of `ready` (which describes controlled installation). Consumers must use the path on that same responder only, and only when the capability/contract is present. Old providers have no capability; do not probe a guessed path.

Only after the person's explicit “检测本机安装状态” click, send `POST` to that path with `credentials:'omit'`, `Content-Type: application/json`, and exactly:

```json
{"contractVersion":"1","consent":"read-installations"}
```

The owning listener enforces its existing exact loopback Host. Origin is required: handoff allows only `library.handoff.allowedOrigins`; the DSH library additionally permits its actual workspace/transport origins. Null/unlisted/missing Origin is rejected, with no CORS grant for the rejected origin. Cookie or Authorization, query fields, iframe control, absolute/protocol-relative/backslash targets, wrong method/content type, invalid JSON, extra fields, unsupported contract or missing exact consent are rejected **before** any directory/CLI/Core read. The body limit is the existing `HANDOFF_BODY_MAX_BYTES` (4096), not a new configurable default. OPTIONS returns 204 with exact approved Origin, POST/content-type and Private Network Access; it performs no read. No credentials or persistent consent are accepted.

Responses use JSON, `Cache-Control:no-store`, nosniff and frame-denying CSP. Allowed origins receive CORS on named refusals. Errors use `{error:{code,message,details?},traceId}`; messages never include raw reader output, paths or exceptions.

## Response

Public types and capability are exported at `@hanamesh/dsh-app-host/installation-status`.

```ts
interface InstallationStatus {
  schemaVersion:1;
  client:'hanamesh'|'dsh';
  checkedAt:string; // current read completion, ISO UTC; not an atomic whole-machine snapshot
  observations:readonly InstallationObservation[];
  traceId?:string;
}
interface InstallationObservation {
  channel:'hanamesh'|'dsh'|'claude'|'codex';
  scope:{id:'current-runtime'|'other-runtime'|'agent-cli'|'desktop-app';
    kind:'responding-runtime'|'unobserved-runtime'|'official-user-profile'|'desktop-app';label:string};
  status:'installed'|'not-installed'|'incomplete'|'unknown';
  version:string|null;
  versionKind:'core'|'agent-distribution';
  components:readonly {name:string;version:string|null;active?:boolean;status?:string}[];
  identity:{pluginName:string;marketplace:string}|null;
  reason:{code:string;message:string;action:string}|null;
  blocked?:readonly {code:string;moduleName?:string}[];
}
```

The five distinct observations are: responding runtime, the other DSH/HanaMesh runtime (always `unknown`, not observed by this responder), Claude Code configured user-level CLI scope, Codex CLI configured local-marketplace user scope, and Codex/ChatGPT desktop App scope (always named `unknown`). CLI labels explicitly exclude project/other isolated profiles and desktop App. A valid absence is absence **only in the named configured scope**; never show it as a machine-wide uninstall. Preserve every responder/scope; ports are not durable instance identities. Conflicts between responders are unknown, never resolved by choosing one installed result.

Current runtime status/version/components come only from the optional public Core protocol `'1'` `getSuiteDeclaration()` **without an argument**, through the existing Core adapter. No registry request, health substitution, physical file-count completeness, version-range/peer/source algorithm or local upgrade selection is added. Complete maps to installed; incomplete stays incomplete; unknown stays unknown with top-level version null but known component versions and sanitized named blocked codes retained. Missing method, malformed declaration and read failure have distinct reasons. Each detection re-reads; Core removal/invalidation cannot reuse an old installed answer. Agent distribution version is independent of Core version. Missing active fields remain absent.

## Explicit agent reader settings

`DshPluginConfig.library.installationReaders` may configure `claude` and/or `codex`. Each reader requires all these fields; **there are no inferred/default values**:

| Field | Required value |
|---|---|
| executable | Absolute path to the person's official CLI executable |
| home | Absolute explicitly selected user's home directory |
| configDir | Absolute existing official config directory for that selected profile (`CLAUDE_CONFIG_DIR` or `CODEX_HOME`) |
| pluginName / marketplace | Exact registered canonical AgentPluginDTO identity; not a guessed hanamesh@hanamesh |
| marketplaceUrl | Exact registered `installation.marketplaceUrl`, canonical credential-free HTTPS, no query/fragment |
| timeoutMs / maxOutputBytes | Required positive safe-integer read budgets; timeout at most Node's 2147483647 limit |

No website body can set these fields, executable arguments, environment or filesystem paths. No PATH/profile discovery or direct reading of private authentication/chat/config inventories is implemented. An absent/invalid reader is an actionable unknown, not “not installed”. Missing directories are not created. Windows readers are explicitly unsupported in this implementation; runtime Core reads still work. Electron hosts need the existing verified standalone `nodeBinary` for the process supervisor; absent Node is named unknown, not an Electron workaround.

Exact verified protocols (other CLI versions return `AGENT_READER_VERSION_UNSUPPORTED`):

| Channel | Verified `--version` result | Fixed subsequent read argv |
|---|---|---|
| Claude Code | `2.1.301 (Claude Code)` | `plugin list --json`; `plugin marketplace list --json` |
| Codex CLI | `codex-cli 0.162.1` | `plugin list --json --disable remote_plugin`; `plugin marketplace list --json --disable remote_plugin` |

The Codex flag was checked through this exact CLI's public `features list`; it excludes remote directory reads. A version match is necessary but not sufficient: both JSON shapes must validate. Claude uses the official installed array's `id`, user `scope`, enabled/version and load diagnostics. Other project-only target rows are unknown for this reader. Codex uses the official `installed` array and its qualified identity, installed/enabled/version. The exact target marketplace must match the registered HTTPS source in marketplace list; Codex's per-install `marketplaceSource` must also be present, supported and consistent. A local/different/unreadable source, duplicate/conflicting target or malformed/truncated/empty raw output is unknown. Only a complete valid clean inventory with no target in the configured scope is not-installed. A known install may have version null; consumers must show version unknown. Official load/payload issues produce incomplete, not successful readiness. No plugin MCP/hook definitions, unrelated inventory or CLI raw diagnostics are returned.

Commands run with an empty stdin in a disposable neutral cwd, only named HOME/config/platform paths, no inherited model/API keys, proxy/auth/askpass/Node preload, and disabled Git credential helpers. No model/install/upgrade/marketplace refresh command runs. A detached IPC anchor owns the command group until output closes; abort, budget exhaustion, overflow, provider disposal or parent IPC disconnect terminates only that live anchor's own group. No released PID/PGID or arbitrary process name is used. Temporary cwd is removed. There is no retry or stale-result cache.

## Refusals, unknown reasons, and lifecycle

HTTP refusals: `HOST_DENIED`, `ORIGIN_DENIED`, `FRAME_CONTROL_DENIED`, `CREDENTIALS_NOT_ACCEPTED` (403), `METHOD_NOT_ALLOWED` (405), `CONTENT_TYPE_REQUIRED` (415), `BODY_TOO_LARGE` (413), `BAD_TARGET`, `INVALID_JSON`, `UNKNOWN_FIELDS`, `INSTALLATION_STATUS_CONTRACT_UNSUPPORTED` (400), `INSTALLATION_STATUS_CONSENT_REQUIRED` (403), `INSTALLATION_STATUS_UNAVAILABLE` (503). A caller/provider cancellation has `INSTALLATION_STATUS_CANCELLED` (499 when still connected); disconnected clients receive no result.

Per-scope unknown reasons always include a safe code/message/action:

- `CORE_SUITE_DECLARATION_MISSING`, `CORE_SUITE_DECLARATION_INVALID`, `CORE_SUITE_READ_FAILED`, `CORE_SUITE_DECLARATION_UNKNOWN`; incomplete: `CORE_SUITE_CURRENT_INCOMPLETE`, plus Core blocked codes.
- `OTHER_RUNTIME_NOT_OBSERVED`, `CODEX_DESKTOP_SCOPE_UNOBSERVABLE`.
- `AGENT_READER_NOT_CONFIGURED`, `AGENT_READER_CONFIG_INVALID`, `AGENT_READER_VERSION_UNSUPPORTED`, `AGENT_READER_PLATFORM_UNSUPPORTED`, `AGENT_READER_NODE_REQUIRED`.
- `AGENT_PROFILE_UNAVAILABLE`, `AGENT_READER_UNAVAILABLE`, `AGENT_READER_PERMISSION_DENIED`, `AGENT_READER_TIMEOUT`, `AGENT_READER_OUTPUT_LIMIT`, `AGENT_READER_DIAGNOSTIC`, `AGENT_READER_FAILED`.
- `AGENT_INVENTORY_INVALID`, `AGENT_INVENTORY_CONFLICT`, `AGENT_SCOPE_UNOBSERVABLE`, `AGENT_MARKETPLACE_SOURCE_UNAVAILABLE`, `AGENT_MARKETPLACE_SOURCE_MISMATCH`.
- An installed record with unobserved version uses `AGENT_VERSION_UNAVAILABLE`; incomplete uses `AGENT_PLUGIN_LOAD_FAILED` / `AGENT_PLUGIN_PAYLOAD_MISSING`.

Start each explicit detection by clearing previous observations. Cancel fetch when the person clears/revokes/leaves, the consumer/identity changes, or the window unmounts. Discard late request generations. A failed read/capability disappearance never keeps old installed status. Do not poll, persist, forward inventory or change Core/Usage recording consent. G's website consumer owns these page lifecycle rules; the bridge cancels on disconnect and module unload and holds no cross-request observation cache.

Official command references: [Claude Code plugin commands](https://code.claude.com/docs/en/plugins/cli-reference), [Codex CLI plugin reference](https://learn.chatgpt.com/docs/cli/reference). [OpenAI local plugin scope documentation](https://developers.openai.com/plugins/build/plugins) describes multiple client scopes; CLI installation is not used here as proof of the desktop App.
