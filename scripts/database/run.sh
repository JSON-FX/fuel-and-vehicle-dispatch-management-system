#!/bin/sh
set -eu

operation="${1:?A database operation is required.}"
shift

case "$operation" in
  bootstrap|fresh|migrate|rollback|seed-demo|status) ;;
  *)
    echo "Unsupported database operation: $operation" >&2
    exit 2
    ;;
esac

if [ "$operation" = "fresh" ] && [ "${NODE_ENV:-}" = "production" ]; then
  echo "Database refresh is disabled when NODE_ENV is production." >&2
  exit 1
fi

if [ "${FVDMS_CONTAINER:-}" = "1" ]; then
  exec pnpm exec tsx "scripts/database/${operation}.ts" "$@"
fi

if [ -n "${NODE_ENV:-}" ]; then
  exec docker compose run --rm --no-deps -e NODE_ENV="$NODE_ENV" database-tools pnpm exec tsx "scripts/database/${operation}.ts" "$@"
fi

exec docker compose run --rm --no-deps database-tools pnpm exec tsx "scripts/database/${operation}.ts" "$@"
