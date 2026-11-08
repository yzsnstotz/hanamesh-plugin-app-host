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

Responses use JSON, `Cache-Control:no-store`, nosniff and frame-denying CSP. After the listener's preliminary Host/target/frame checks and successful allowed-Origin admission, subsequent named refusals carry CORS; preliminary safety refusals can omit CORS. Errors use `{error:{code,message,details?},traceId}`; messages never include raw reader output, paths or exceptions.

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
  versionKind:'suite-bundle'|'agent-distribution';
  components:readonly {name:string;version:string|null;active?:boolean;status?:string}[];
  identity:{pluginName:string;marketplace:string}|null;
  reason:{code:string;message:string;action:string}|null;
  blocked?:readonly {code:string;moduleName?:string}[];
}
```

The five distinct observations are: responding runtime, the other DSH/HanaMesh runtime (always `unknown`, not observed by this responder), Claude Code current-user CLI scope, Codex CLI current-user local-marketplace scope, and Codex/ChatGPT desktop App scope (always named `unknown`). CLI labels explicitly exclude project/other isolated profiles and desktop App. A valid absence is absence **only in the named current-user scope**; never show it as a machine-wide uninstall. Preserve every responder/scope; ports are not durable instance identities. Conflicts between responders are unknown, never resolved by choosing one installed result.

Current runtime status/version/components come only from the optional public Core protocol `'1'` `getSuiteDeclaration()` **without an argument**, through the existing Core adapter. No registry request, health substitution, physical file-count completeness, version-range/peer/source algorithm or local upgrade selection is added. Complete maps to installed; incomplete stays incomplete; unknown stays unknown with top-level version null but known component versions and sanitized named blocked codes retained. Missing method, malformed declaration and read failure have distinct reasons. Each detection re-reads; Core removal/invalidation cannot reuse an old installed answer. Agent distribution version is independent of the DSH suite bundle version. Missing active fields remain absent.

## Automatic official CLI discovery

AppHost 0.6.23 discovers Claude Code and Codex for the current OS user after the consented request. There is no manual reader setting; the former `library.installationReaders` option and public reader configuration type are removed. Browser requests cannot supply paths, commands, environment or profile selection. The registered suite identity is `hanamesh@hanamesh`, with the exact HTTPS source `https://github.com/yzsnstotz/hanamesh-plugins`, as in the existing suite catalog contract.

Selection is deterministic: the first executable in the inherited absolute PATH directories wins; if absent on macOS/Linux, query the user's interactive login shell once (`-ilc`), taking only a framed PATH value. This follows [VS Code's shell environment practice](https://code.visualstudio.com/docs/configure/command-line#_how-do-i-detect-when-a-shell-was-launched-by-vs-code). No environment dump is collected. Shell startup noise and stderr never enter public output. Next search the fixed layouts below in listed order. Finally, scan the listed manager version directories in order, newest Node SemVer first within each directory. Relative/empty PATH segments are excluded. Do not run every candidate or switch to a second CLI when the selected command fails, is old or returns an invalid inventory. Executable names alone are not a signature guarantee; the fixed official version syntax and inventory schema are validated before returning facts.

| Layout | Searched locations and source |
|---|---|
| Official native / standalone | `~/.local/bin/claude[.exe]` ([Claude setup](https://code.claude.com/docs/en/setup#auto-updates)); native launcher symlinks resolve through normal OS execution. Codex `~/.local/bin/codex`, `CODEX_INSTALL_DIR`, Windows `%LOCALAPPDATA%/Programs/OpenAI/Codex/bin/codex.exe` ([official installer variables](https://learn.chatgpt.com/docs/config-file/environment-variables#installer-variables), [installation](https://learn.chatgpt.com/docs/cli)). Standalone release binaries in custom directories are found through inherited/login PATH or `CODEX_INSTALL_DIR`; unlinked archives are not guessed. |
| Legacy Claude local | `~/.claude/local/claude`, `~/.claude/local/node_modules/.bin/claude`. These are historical npm-local layouts, not the current native default; [upstream issue with the original launcher path](https://github.com/anthropics/claude-code/issues/2824). No `.claude.json` or installMethod file is read. |
| npm global | `npm_config_prefix` / `NPM_CONFIG_PREFIX` (`bin` on POSIX, prefix itself on Windows), `~/.npm-global/bin`, `~/.npm/bin`, `%APPDATA%/npm`, `%ProgramFiles%/nodejs`; system prefixes and active Node manager bins below. [npm folder rules](https://docs.npmjs.com/cli/v11/configuring-npm/folders/). No npmrc read or npm config command. |
| pnpm global | `PNPM_HOME` and its `bin`, `~/.local/share/pnpm[/bin]`, `~/Library/pnpm[/bin]`, `%LOCALAPPDATA%/pnpm`. [pnpm setup](https://pnpm.io/cli/setup). Both earlier direct-bin and current bin-subdirectory layouts are recognized. |
| Yarn Classic | `~/.yarn/bin`, `~/.config/yarn/global/node_modules/.bin`, custom prefix via PATH/login shell. [Yarn global](https://classic.yarnpkg.com/lang/en/docs/cli/global/). |
| Volta / asdf / mise | `VOLTA_HOME/bin` or `~/.volta/bin`, `%LOCALAPPDATA%/Volta/bin`; `ASDF_DATA_DIR/shims` or `~/.asdf/shims`; `MISE_DATA_DIR/shims` or `~/.local/share/mise/shims`. [Volta](https://docs.volta.sh/guide/understanding), [asdf](https://asdf-vm.com/manage/configuration.html), [mise](https://mise.jdx.dev/directories.html). |
| Homebrew / system | `/opt/homebrew/bin`, `/usr/local/bin`, `/home/linuxbrew/.linuxbrew/bin`, `/usr/bin`, `/bin`. [Homebrew prefixes](https://docs.brew.sh/Installation); [Claude Homebrew setup](https://code.claude.com/docs/en/setup), [Codex distribution](https://learn.chatgpt.com/docs/cli). Brew-linked native binaries use the same discovery path. |
| nvm / fnm / installed manager versions | `NVM_BIN`, `NVM_SYMLINK`; `NVM_DIR/versions/node/*/bin` or `~/.nvm/versions/node/*/bin`; Windows `NVM_HOME/*`; `FNM_MULTISHELL_PATH`; `FNM_DIR/node-versions/*/installation[/bin]`, `~/.local/share/fnm/node-versions/*/installation/bin`, `~/Library/Application Support/fnm/node-versions/*/installation/bin`, `%APPDATA%/fnm/node-versions/*/installation`; asdf `installs/nodejs/*/bin`, mise `installs/node/*/bin`. Only SemVer directory names are scanned. [nvm](https://github.com/nvm-sh/nvm), [fnm](https://github.com/Schniz/fnm/blob/master/docs/commands.md), [asdf](https://asdf-vm.com/manage/configuration.html), [mise](https://mise.jdx.dev/directories.html). |
| Windows native links / npm shims | `%LOCALAPPDATA%/Microsoft/WinGet/Links` ([Claude WinGet](https://code.claude.com/docs/en/setup)). `.exe` precedes `.cmd` per directory. A `.cmd` is never sent to a shell: resolve only the adjacent official npm `node_modules/@anthropic-ai/claude-code/cli.js` or `node_modules/@openai/codex/bin/codex.js`, run it with the verified standalone Node. Missing JS is a named failure, not a guessed shell command. |

HOME is the host user's HOME/USERPROFILE. Honor existing `CLAUDE_CONFIG_DIR` / `CODEX_HOME` environment paths, otherwise use `~/.claude` / `~/.codex`. These directories must already exist; discovery never creates them, reads their contents, or reads credentials, sessions or private configuration files. Only official read commands observe plugin inventory. The named profile scope is not a machine-wide inventory. Electron hosts retain the existing verified standalone Node requirement.

Named automatic read budgets are `INSTALLATION_READ_BUDGET.timeoutMs=2000` and `maxOutputBytes=20000`, retaining the existing installation-command fixtures' values without extending deadlines or adding retries. **待追认:** the former product configuration had required budgets but no defaults; adopting those existing fixture values for automatic product reads requires owner acknowledgement. They are code constants documented here, with no manual reader form.

Minimum CLI version and fixed syntax (no new upper bound):

| Channel | Minimum version / accepted `--version` syntax | Fixed subsequent read argv |
|---|---|---|
| Claude Code | `>=2.1.301`, `MAJOR.MINOR.PATCH (Claude Code)` | `plugin list --json`; `plugin marketplace list --json` |
| Codex CLI | `>=0.162.1`, `codex-cli MAJOR.MINOR.PATCH` | `plugin list --json --disable remote_plugin`; `plugin marketplace list --json --disable remote_plugin` |

Malformed version output is `AGENT_READER_VERSION_INVALID`; below-minimum versions are `AGENT_READER_VERSION_UNSUPPORTED`; JSON parse/shape failure is `AGENT_INVENTORY_INVALID`. New versions such as 2.1.319 / 0.167.0 must pass exactly the existing inventory validation.

The Codex flag was checked through this exact CLI's public `features list`; it excludes remote directory reads. Passing the version floor is necessary but not sufficient: both JSON shapes must validate. Claude uses the official installed array's `id`, user `scope`, enabled/version and load diagnostics. Other project-only target rows are unknown for this reader. Codex uses the official `installed` array and its qualified identity, installed/enabled/version. The exact target marketplace must match the registered HTTPS source in marketplace list; Codex's per-install `marketplaceSource` must also be present, supported and consistent. A local/different/unreadable source, duplicate/conflicting target or malformed/truncated/empty raw output is unknown. Only a complete valid clean inventory with no target in the observed user scope is not-installed. A known install may have version null; consumers must show version unknown. Official load/payload issues produce incomplete, not successful readiness. No plugin MCP/hook definitions, unrelated inventory or CLI raw diagnostics are returned.

Commands run with an empty stdin in a disposable neutral cwd, only named HOME/config/platform paths, only allowlisted Node-manager path variables (VOLTA_HOME, ASDF_DATA_DIR, MISE_DATA_DIR, FNM_DIR, NVM_DIR, NVM_HOME, NVM_SYMLINK, PNPM_HOME), no inherited model/API keys, proxy/auth/askpass/Node preload, and disabled Git credential helpers. No model/install/upgrade/marketplace refresh command runs. On POSIX, a detached IPC reaper owns the neutral cwd outside a separate live command-group anchor. The anchor remains alive until output closes; abort, budget exhaustion, overflow, provider disposal or parent IPC disconnect makes the surviving reaper terminate only that live anchor's group. The reaper waits for group close before removing the cwd, so active writers cannot race deletion, including after caller death. No released PID/PGID or arbitrary process name is used. The caller also performs exact-path cleanup when alive. On Windows the same live anchor/reaper ownership uses the OS taskkill tree operation for its precise owned anchor; no process-name match or command-shell execution. Windows/Linux runtime evidence is separate from macOS fixture execution. There is no retry or stale-result cache. Automatic recovery after an internal reaper/anchor itself is externally SIGKILLed or suffers a native crash is outside this lifecycle guarantee; an external intervention can leave command processes or temporary files and is never reported as an installed/absent inventory.

## Refusals, unknown reasons, and lifecycle

HTTP refusals: `HOST_DENIED`, `ORIGIN_DENIED`, `FRAME_CONTROL_DENIED`, `CREDENTIALS_NOT_ACCEPTED` (403), `METHOD_NOT_ALLOWED` (405), `CONTENT_TYPE_REQUIRED` (415), `BODY_TOO_LARGE` (413), `BAD_TARGET`, `INVALID_JSON`, `UNKNOWN_FIELDS`, `INSTALLATION_STATUS_CONTRACT_UNSUPPORTED` (400), `INSTALLATION_STATUS_CONSENT_REQUIRED` (403), `INSTALLATION_STATUS_UNAVAILABLE` (503). A caller/provider cancellation has `INSTALLATION_STATUS_CANCELLED` (499 when still connected); disconnected clients receive no result.

Per-scope unknown reasons always include a safe code/message/action:

- `CORE_SUITE_DECLARATION_MISSING`, `CORE_SUITE_DECLARATION_INVALID`, `CORE_SUITE_READ_FAILED`, `CORE_SUITE_DECLARATION_UNKNOWN`; incomplete: `CORE_SUITE_CURRENT_INCOMPLETE`, plus Core blocked codes.
- `OTHER_RUNTIME_NOT_OBSERVED`, `CODEX_DESKTOP_SCOPE_UNOBSERVABLE`.
- `AGENT_READER_VERSION_INVALID`, `AGENT_READER_VERSION_UNSUPPORTED`, `AGENT_READER_NODE_REQUIRED`, `AGENT_SHELL_ENV_UNAVAILABLE`, `AGENT_READER_ENTRYPOINT_UNAVAILABLE`, `AGENT_READER_DISCOVERY_INVALID`.
- `AGENT_PROFILE_UNAVAILABLE`, `AGENT_READER_UNAVAILABLE`, `AGENT_READER_PERMISSION_DENIED`, `AGENT_READER_TIMEOUT`, `AGENT_READER_OUTPUT_LIMIT`, `AGENT_READER_DIAGNOSTIC`, `AGENT_READER_CLEANUP_FAILED`, `AGENT_READER_FAILED`.
- `AGENT_INVENTORY_INVALID`, `AGENT_INVENTORY_CONFLICT`, `AGENT_SCOPE_UNOBSERVABLE`, `AGENT_MARKETPLACE_SOURCE_UNAVAILABLE`, `AGENT_MARKETPLACE_SOURCE_MISMATCH`.
- An installed record with unobserved version uses `AGENT_VERSION_UNAVAILABLE`; incomplete uses `AGENT_PLUGIN_LOAD_FAILED` / `AGENT_PLUGIN_PAYLOAD_MISSING`.

Start each explicit detection by clearing previous observations. Cancel fetch when the person clears/revokes/leaves, the consumer/identity changes, or the window unmounts. Discard late request generations. A failed read/capability disappearance never keeps old installed status. Do not poll, persist, forward inventory or change Core/Usage recording consent. G's website consumer owns these page lifecycle rules; the bridge cancels on disconnect and module unload and holds no cross-request observation cache.

Official command references: [Claude Code plugin commands](https://code.claude.com/docs/en/plugins/cli-reference), [Codex CLI plugin reference](https://learn.chatgpt.com/docs/cli/reference). [OpenAI local plugin scope documentation](https://developers.openai.com/plugins/build/plugins) describes multiple client scopes; CLI installation is not used here as proof of the desktop App.

For DSH/HanaMesh runtime observations, versionKind is suite-bundle and version is the installed @hanamesh/hanamesh version. Component rows retain their physical versions. Agent distribution observations retain their existing semantics.
