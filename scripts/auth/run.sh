#!/bin/sh
set -eu

operation="${1:?An authentication operation is required.}"
shift

case "$operation" in
  create-initial-admin) ;;
  *)
    echo "Unsupported authentication operation: $operation" >&2
    exit 2
    ;;
esac

if [ "${FVDMS_CONTAINER:-}" = "1" ]; then
  exec pnpm exec tsx scripts/auth/create-initial-admin.ts "$@"
fi

exec docker compose run --rm --no-deps app pnpm exec tsx scripts/auth/create-initial-admin.ts "$@"
