#!/bin/sh
set -eu

if [ "${FVDMS_CONTAINER:-}" = "1" ]; then
  exec pnpm exec tsx scripts/audit/verify.ts
fi

exec docker compose run --rm --no-deps audit-verifier ./scripts/audit/verify.sh
