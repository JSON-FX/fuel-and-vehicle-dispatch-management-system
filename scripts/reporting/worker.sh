#!/bin/sh
set -eu

if [ "${FVDMS_CONTAINER:-}" = "1" ]; then
  exec pnpm exec tsx scripts/reporting/worker.ts
fi

exec docker compose run --rm --no-deps reporting-worker ./scripts/reporting/worker.sh
