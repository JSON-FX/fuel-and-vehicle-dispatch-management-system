# Fuel and Vehicle Dispatch Management System

This repository contains the secure application foundation for FVDMS. It uses Next.js 16, TypeScript, Kysely, MySQL, and Docker.

The current foundation includes a database-aware health endpoint. Authentication, audit trails, dispatch workflows, dashboards, and production operations are deferred to later tickets.

## Prerequisites

- Docker Desktop with Docker Compose.
- Node.js 24 for host-side checks. The development image pins Node.js 24.19.0.
- pnpm 11.24.0 through Corepack.
- The shared infrastructure repository at `/Users/jsonse/Documents/development/infra`.
- dnsmasq and the local mkcert certificate authority described in the shared infrastructure guide.

The Compose setup uses development-only credentials. Never reuse them outside local development.

## Start local development

Install host dependencies once:

```sh
corepack enable
pnpm install --frozen-lockfile
```

Start shared Traefik and MySQL, bootstrap the database, apply migrations, and start FVDMS:

```sh
pnpm dev:up
```

Expected results:

- The application is available at `https://fvdms.lan`.
- `https://fvdms.lan/api/health` returns a success envelope with database status `available`.
- `docker compose ps` shows `fvdms` as healthy.
- No application or database port is published directly to the host.

Follow application logs:

```sh
pnpm dev:logs
```

Stop only the FVDMS project container:

```sh
pnpm dev:down
```

This command does not stop shared Traefik, dnsmasq, or MySQL.

## Database operations

The shared local MySQL service is named `mysql` on the external `dev-net` network. FVDMS creates only its database and two least-privilege users.

Run database commands from the repository root:

```sh
pnpm db:bootstrap
pnpm db:migrate
pnpm db:status
pnpm db:rollback
```

These commands run in a short-lived project container. Repeated bootstrap and migrate calls are safe.

The runtime user can read and write application data. Only the migration user can change the FVDMS schema. Neither user is the shared MySQL administrator.

## Tests and validation

Run the fast unit suite:

```sh
pnpm test:unit
```

Run isolated integration tests:

```sh
pnpm test:integration
```

Integration tests start their own `mysql:8.4.11` Testcontainer. They never use the shared local database.

Run coverage or the complete validation suite:

```sh
pnpm test:coverage
pnpm validate
```

The complete suite checks formatting, linting, types, coverage, integration behavior, and the production build. GitHub Actions runs the same checks after the repository is pushed to a remote.

## Architecture boundaries

Dependencies point inward:

```text
src/app and src/lib/http
        ↓
src/application
        ↓
src/domain

src/infrastructure implements application ports.
src/infrastructure/composition/root.ts wires concrete adapters to use cases.
```

Later modules should follow these placement rules:

- Put business rules and value objects in `src/domain`.
- Put use cases, data transfer objects, and required interfaces in `src/application`.
- Put MySQL, logging, identifiers, and other external adapters in `src/infrastructure`.
- Put Next.js route handlers in `src/app` and reusable HTTP mapping in `src/lib/http`.
- Map persistence rows inside repository adapters. Never return Kysely rows from application ports.

Domain and application modules must not import Next.js, Kysely, mysql2, Pino, Docker code, or environment globals.

## TLS and dnsmasq troubleshooting

Confirm that dnsmasq resolves the local host:

```sh
dscacheutil -q host -a name fvdms.lan
```

The expected address is `127.0.0.1`. Follow the shared infrastructure guide if resolution fails.

The shared certificate Subject Alternative Name list contains `=fvdms.lan`. Regenerate it after certificate changes:

```sh
cd /Users/jsonse/Documents/development/infra/certs
./regen.sh
```

Traefik usually reloads the certificate. If it still serves an older fingerprint, restart only Traefik:

```sh
docker compose -f /Users/jsonse/Documents/development/infra/docker-compose.yml restart traefik
```

Do not copy, mount, print, or commit the shared certificate private key. Firefox may require the separate trust step described by the shared infrastructure guide.

## Deferred work

FVD-001 does not implement authentication, authorization policies, audit records, dispatch features, fleet dashboards, or production deployment procedures. Later tickets must add those capabilities within the boundaries above.
