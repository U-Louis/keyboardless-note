#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
port="${APP_PORT:-5173}"
npm install
printf 'origin http://127.0.0.1:%s\n' "$port"
exec npm run dev -- --host 127.0.0.1 --port "$port"
