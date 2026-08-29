#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
infrastructure_compose="$project_root/../infra/docker-compose.yml"

docker compose -f "$infrastructure_compose" up -d traefik mysql
cd "$project_root"
docker compose run --rm --no-deps --user root database-tools chown -R node:node /pnpm/store
pnpm db:bootstrap
pnpm db:migrate
pnpm db:bootstrap
docker compose up -d --wait app audit-worker reporting-worker
