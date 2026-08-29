#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$project_root"
exec docker compose logs --follow app audit-worker reporting-worker
