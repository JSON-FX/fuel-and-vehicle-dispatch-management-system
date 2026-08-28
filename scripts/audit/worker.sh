#!/bin/sh
set -eu

if [ "${FVDMS_CONTAINER:-}" = "1" ]; then
  exec pnpm exec tsx scripts/audit/worker.ts
fi

exec docker compose run --rm --no-deps audit-worker ./scripts/audit/worker.sh
