#!/bin/bash
set -e

cd /app

# Install deps on first boot or whenever package-lock changed.
if [ ! -d node_modules ] || [ ! -f node_modules/.install-stamp ] || \
   [ package-lock.json -nt node_modules/.install-stamp ]; then
  echo "[dev] installing npm deps…"
  npm ci --no-audit --no-fund --prefer-offline || npm install --no-audit --no-fund
  touch node_modules/.install-stamp
fi

echo "[dev] starting Quasar dev server on 0.0.0.0:9000…"
exec "$@"
