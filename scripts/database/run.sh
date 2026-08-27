#!/bin/sh
set -eu

operation="${1:?A database operation is required.}"

case "$operation" in
  bootstrap|migrate|rollback|status) ;;
  *)
    echo "Unsupported database operation: $operation" >&2
    exit 2
    ;;
esac

if [ "${FVDMS_CONTAINER:-}" = "1" ]; then
  exec pnpm exec tsx "scripts/database/${operation}.ts"
fi

exec docker compose run --rm --no-deps app pnpm exec tsx "scripts/database/${operation}.ts"
