# Shared paths for the P02-APPHOST-01 real-DSH gate. Every DSH call runs under `env -i` with an isolated HOME/DSH_HOME.
RUN=${RUN:-/Users/yzliu/.claude/jobs/68def075/tmp/run}
EVID=/Users/yzliu/work/projects/hanamesh/_deliveries/p02-dispatch-20261002/worktrees/apphost-contract/docs/acceptance/p02-apphost-contract
NODE='/Users/yzliu/Library/Application Support/com.hanamesh.desktop/runtime/bin/node'
PNPM_CJS='/Users/yzliu/Library/Application Support/com.hanamesh.desktop/dependencies/pnpm/bin/pnpm.cjs'
CLI='/Users/yzliu/Library/Application Support/com.hanamesh.desktop/dependencies/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js'
