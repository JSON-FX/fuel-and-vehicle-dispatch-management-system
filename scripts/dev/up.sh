#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
infrastructure_compose="$project_root/../infra/docker-compose.yml"

docker compose -f "$infrastructure_compose" up -d traefik mysql
cd "$project_root"
pnpm db:bootstrap
pnpm db:migrate
docker compose up -d app
