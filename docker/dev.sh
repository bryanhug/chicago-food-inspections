#!/bin/sh
set -eu
cd /app

lock_hash=$(sha256sum package-lock.json | awk '{print $1}')
stamp="node_modules/.install-stamp"
if [ ! -d node_modules/convex ] || [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$lock_hash" ]; then
  npm ci
  echo "$lock_hash" > "$stamp"
fi

export CONVEX_AGENT_MODE="${CONVEX_AGENT_MODE:-anonymous}"

npx convex dev --once

npx convex dev &
convex_pid=$!
npm run dev &
web_pid=$!

shutdown() {
  kill "$convex_pid" "$web_pid" 2>/dev/null || true
}
trap shutdown INT TERM EXIT
wait "$web_pid"
