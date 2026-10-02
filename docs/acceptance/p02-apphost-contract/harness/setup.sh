#!/bin/bash
# usage: setup.sh <scenario> <profile> <apphost tgz> — fresh isolated web profile for the Core suite + fixture app.
# Test-profile scaffold only (not a product path): private packages resolve to local tarballs through pnpm overrides, and
# peer metadata comes from regstub.mjs (local registry + the unpublished app-host candidate under test: rc.42, rc.43 for the R-Q1 rerun);
# Core's documented serverOrigin/websiteOrigin knobs point at a loopback stub that records request shapes and answers 503 so nothing reaches production.
set -euo pipefail
. "$(dirname "$0")/env.sh"
S=$1; P=$2; AH=$3; H="$RUN/home-$S"; PR="$H/dsh/profiles/$P"
"$(dirname "$0")/dsh.sh" $S --profile $P --from-default-profile web --dump-config > "$RUN/$S-$P-init.yml" 2>&1
mkdir -p "$PR/.inputs"; cp "$AH" "$RUN"/inputs/hanamesh-lib-provision-0.1.0-rc.1.tgz "$RUN"/inputs/zod-4.5.4.tgz "$RUN"/inputs/hanamesh-usage-0.2.0-rc.10.tgz "$RUN"/inputs/hanamesh-core-0.2.0-rc.46.tgz "$PR/.inputs/"
printf 'confirmModulesPurge=false\nregistry=http://127.0.0.1:35415/\n' > "$PR/.npmrc"
cat >> "$PR/pnpm-workspace.yaml" <<EOT
overrides:
  hanamesh-usage: file:$PR/.inputs/hanamesh-usage-0.2.0-rc.10.tgz
  '@hanamesh/dsh-app-host': file:$PR/.inputs/$(basename "$AH")
  '@hanamesh/lib-provision': file:$PR/.inputs/hanamesh-lib-provision-0.1.0-rc.1.tgz
  zod: file:$PR/.inputs/zod-4.5.4.tgz
EOT
cat > "$PR/cordis.patch.yml" <<'EOT'
# P02-APPHOST-01 isolation: Core's documented origin knobs → loopback request-recording stub (no production traffic).
- id: hanamesh-core
  config:
    serverOrigin: http://127.0.0.1:35414
    websiteOrigin: http://127.0.0.1:35414
    allowSystemBrowser: false
EOT
"$(dirname "$0")/dsh.sh" $S plugin --profile $P add "file:$PR/.inputs/hanamesh-lib-provision-0.1.0-rc.1.tgz" "file:$PR/.inputs/zod-4.5.4.tgz"
{ cat "$PR/.npmrc" "$PR/pnpm-workspace.yaml" "$PR/cordis.patch.yml"; shasum -a 256 "$PR"/.inputs/*; } | sed "s#$RUN#\$RUN#g" > "$EVID/logs/$S-$P-scaffold.txt"
echo setup_ok
