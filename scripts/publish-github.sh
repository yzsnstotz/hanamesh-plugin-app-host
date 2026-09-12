#!/usr/bin/env bash
# Explicit operator action only. This script was not run by the delivery agent.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v gh >/dev/null || { echo 'GitHub CLI (gh) is required; no remote changes made.' >&2; exit 1; }
command -v git >/dev/null || exit 1
gh auth status
login="$(gh api user --jq .login)"
[[ "$login" == 'yzsnstotz' ]] || { echo 'Refusing: authenticated owner is not yzsnstotz.' >&2; exit 1; }
[[ "${1:-}" == '--create-private' ]] || { echo 'Run with --create-private to create yzsnstotz/hanamesh-plugin-app-host and push this candidate.' >&2; exit 1; }
[[ -d .git ]] || { git init -b main; git add .; git commit -m 'app-host 0.1.0-rc.1: tested core; DSH integration pending'; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Refusing: commit or discard local changes first.' >&2; exit 1; }
if git remote get-url origin >/dev/null 2>&1; then
  echo 'Refusing: origin already exists; inspect it before creating any remote repository.' >&2; exit 1
fi
# Do not fall back to an unrelated repo, overwrite a remote, or assume a 404 is success.
if gh repo view yzsnstotz/hanamesh-plugin-app-host >/dev/null 2>&1; then
  echo 'Repository already exists; refusing automatic overwrite. Review the existing remote manually.' >&2; exit 1
fi
gh repo create yzsnstotz/hanamesh-plugin-app-host --private --source=. --remote=origin \
  --description 'HanaMesh app-host 0.1.0-rc.1 — tested core candidate; verified DSH bridge pending' --push
gh repo view yzsnstotz/hanamesh-plugin-app-host --json nameWithOwner,url,isPrivate
