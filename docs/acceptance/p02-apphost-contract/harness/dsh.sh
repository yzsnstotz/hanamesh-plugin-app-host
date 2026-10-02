#!/bin/bash
# usage: dsh.sh <scenario> <dsh args...>
set -euo pipefail
. "$(dirname "$0")/env.sh"
S=$1; shift; H="$RUN/home-$S"
mkdir -p "$H/dsh" "$H/.cache" "$H/.config" "$RUN/bin" "$RUN/tmp/$S" "$RUN/cache/npm-$S" "$RUN/cache/pnpm-store"
if [ ! -x "$RUN/bin/pnpm" ]; then
  printf '#!/bin/bash\nexec %q %q "$@" --store-dir %q\n' "$NODE" "$PNPM_CJS" "$RUN/cache/pnpm-store" > "$RUN/bin/pnpm"; chmod +x "$RUN/bin/pnpm"
  ln -f "$NODE" "$RUN/bin/node"
fi
exec env -i HOME="$H" DSH_HOME="$H/dsh" PATH="$RUN/bin:/usr/bin:/bin:/usr/sbin:/sbin" TMPDIR="$RUN/tmp/$S" XDG_CACHE_HOME="$H/.cache" \
  XDG_CONFIG_HOME="$H/.config" npm_config_cache="$RUN/cache/npm-$S" NPM_CONFIG_USERCONFIG="$H/.npmrc" DSH_TELEMETRY_DISABLED=1 \
  "$RUN/bin/node" "$CLI" "$@"
