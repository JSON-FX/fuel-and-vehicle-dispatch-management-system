# Fuel and Vehicle Dispatch Management System

This repository contains the secure application foundation, account access, budget allocation, reference-data, and durable audit systems for FVDMS. It uses Next.js 16, TypeScript, Kysely, MySQL, and Docker.

The current system includes database-backed sessions, forced password replacement, optional privileged-account TOTP, role-based access control, account administration, and an independently verified audit chain.

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
- `docker compose ps` shows `fvdms` as healthy and `fvdms-audit-worker` as running.
- No application or database port is published directly to the host.

Follow application and audit-worker logs:

```sh
pnpm dev:logs
```

Stop the FVDMS application and audit worker:

```sh
pnpm dev:down
```

This command does not stop shared Traefik, dnsmasq, or MySQL.

## Create the initial administrator

Apply all migrations before creating the first administrator. The command refuses to run after an active `SUPER_ADMIN` exists.

```sh
pnpm auth:create-initial-admin \
  --full-name "System Administrator" \
  --username system.admin \
  --email system.admin@example.lan
```

When the application container is already running, use:

```sh
pnpm auth:create-initial-admin:container \
  --full-name "System Administrator" \
  --username system.admin \
  --email system.admin@example.lan
```

The command generates a temporary password and prints it once. Store or deliver it through an approved secure channel. The administrator must replace it at the first login.

Open [https://fvdms.lan/login](https://fvdms.lan/login) to sign in. Username and password are sufficient while the global MFA requirement remains disabled.

## Authentication configuration

The accepted local defaults are documented in `.env.example` and supplied by `compose.yaml`. Generate independent encryption and HMAC keys for every non-local environment:

```sh
openssl rand -base64 32
```

`AUTH_TOTP_ENCRYPTION_KEYS` is a JSON object keyed by positive version numbers. Keep old keys while factors still use them. Set `AUTH_TOTP_ACTIVE_KEY_VERSION` to the version used for new encryption.

`AUTH_RATE_LIMIT_HMAC_KEY` must be a separate 32-byte key. Neither key may use a `NEXT_PUBLIC_` name or enter client bundles, logs, or source control.

Multi-factor authentication is disabled by default. A `SUPER_ADMIN` or `SYSTEM_ADMIN` can enable it from `/admin/security`. Enabling the setting revokes every active privileged session. Privileged users must then enroll or enter a current authenticator code at their next sign-in. Disabling it preserves existing TOTP factors for later use.

Administrators perform password reset, TOTP reset, session revocation, user lifecycle, and role changes from the protected user and role pages. Reset actions require a reason. Temporary passwords appear once in a persistent acknowledgment dialog.

## Office, driver, and vehicle reference data

Managers maintain dispatch reference data from protected administration pages. The server checks every page and API request independently of navigation visibility.

| Resource | Administration page | API collection  | Manage permission | Selector permission                |
| -------- | ------------------- | --------------- | ----------------- | ---------------------------------- |
| Offices  | `/admin/offices`    | `/api/offices`  | `office.manage`   | `office.read` or `office.manage`   |
| Drivers  | `/admin/drivers`    | `/api/drivers`  | `driver.manage`   | `driver.read` or `driver.manage`   |
| Vehicles | `/admin/vehicles`   | `/api/vehicles` | `vehicle.manage`  | `vehicle.read` or `vehicle.manage` |

Create and update requests use the resource collection and item routes. Soft delete uses `POST /api/{resource}/{publicId}/soft-delete` with a reason. Restore uses `POST /api/{resource}/{publicId}/restore`.

New offices and drivers begin active. New vehicles begin serviceable. Restored offices and drivers remain inactive until reviewed. Restored vehicles remain unserviceable until reviewed. Deleted names, abbreviations, and plate numbers stay reserved because records are never physically deleted.

Operational selectors use `GET /api/{resource}?mode=operational`. They return only current and eligible records. Driver selector results never include contact numbers. Administration lists default to 25 records per page. All list APIs use bounded cursor pagination with a default of 50 and a maximum of 200.

Validate this module with the standard project commands:

```sh
pnpm test:unit
pnpm test:integration
pnpm exec playwright test --project=chromium tests/e2e/master-data.spec.ts tests/e2e/master-data-permissions.spec.ts tests/e2e/accessibility.spec.ts
pnpm validate
```

## Budget allocations and fiscal eligibility

Authorized users review allocations at `/budget-allocations` and opaque-ID detail routes.
Budget Officers use `budget.manage` to create and change allocations. Administrators,
Budget Officers, PSMD staff, viewers, and auditors receive `budget.read`. The server checks
these permissions for every page and API request.

The collection endpoint is `/api/budget-allocations`. Item reads and status commands use
`/api/budget-allocations/{publicId}`. Soft delete uses
`POST /api/budget-allocations/{publicId}/soft-delete` with a reason. Restore uses
`POST /api/budget-allocations/{publicId}/restore`.

Every allocation starts as DRAFT. Identity fields include the PPMP number, office, fiscal
year, and quarter. They remain editable only while the record is DRAFT. The status graph is:

```text
DRAFT ──> ACTIVE ──> CLOSED
  │          │
  └──────────┴─────> CANCELLED
```

CLOSED and CANCELLED are terminal. Cancellation requires an audit reason. Any current
status may be soft-deleted with a reason. Restoring a formerly ACTIVE record returns it as
DRAFT. Restoring DRAFT, CLOSED, or CANCELLED preserves that status. Deleted identity tuples
stay reserved.

Fiscal eligibility uses the Asia/Manila civil calendar. Fiscal years accept 2000 through
9999, and quarters accept exactly one through four. An allocation is operational only when
all four conditions are true:

- The allocation is current and ACTIVE.
- Its fiscal year and quarter match the effective date.
- Its linked office is current.
- Its linked office is ACTIVE.

Operational consumers use
`GET /api/budget-allocations?mode=operational&effectiveDate=YYYY-MM-DD`. Omitting
`effectiveDate` uses the current Manila date. Selection is advisory. A downstream posting
transaction must recheck eligibility before it commits.

Budget allocation mutations and their audit outbox events commit atomically. No allocation
amount, ceiling, or utilization percentage exists in this module.

Validate the focused module with:

```sh
pnpm exec vitest run --config vitest.config.ts tests/unit/domain/budget tests/unit/application/budget tests/unit/lib/budget tests/unit/app/api/budget-allocations tests/unit/components/budget-allocation-components.test.ts
pnpm exec vitest run --config vitest.integration.config.ts tests/integration/budget
pnpm exec playwright test --project=chromium tests/e2e/budget-allocations.spec.ts tests/e2e/budget-allocation-permissions.spec.ts tests/e2e/accessibility.spec.ts
pnpm validate
```

## Fuel issuance workflow and balances

Users with `fuel.read` review records at `/fuel-issuances`, detail routes, and the read-only
balance page at `/fuel-issuances/balances`. PSMD staff use `fuel.create` to prepare and edit
drafts. Posting requires `fuel.post`. Voiding requires the independent `fuel.void` permission,
which remains assigned only to SUPER_ADMIN by default.

The collection API is `/api/fuel-issuances`. Item reads and complete draft replacements use
`/api/fuel-issuances/{publicId}`. Posting uses
`POST /api/fuel-issuances/{publicId}/post` with an actual-liter decimal string. Voiding uses
`POST /api/fuel-issuances/{publicId}/void` with a 10-to-500-character reason. Balance reads use
`GET /api/fuel-balances?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` with an optional `fuelType`.
Draft forms refresh eligible selectors through
`GET /api/fuel-preparation-options?entryDate=YYYY-MM-DD`, guarded by `fuel.create`.

Every record begins as DRAFT. Posting rechecks the driver, vehicle, allocation, allocation
office, fiscal period, and lifecycle inside one MySQL transaction. It then reserves the
entry-date monthly RIS, calculates the authoritative total, appends one negative ISSUANCE
ledger row, and records one audit event. A failure rolls back every effect, including the RIS
counter.

Voiding preserves the posted record and its original negative ledger row. It appends one equal
positive ADJUSTMENT and records the normalized reason. No ledger update or delete API exists.
Balances use inclusive civil dates and may be negative. A negative balance is reported rather
than blocking a posting.

Apply migration `20260828_000007_create_fuel_workflow` through the normal Docker flow:

```sh
pnpm dev:up
pnpm db:status
```

Validate the focused module with:

```sh
pnpm exec vitest run --config vitest.config.ts tests/unit/domain/fuel tests/unit/application/fuel tests/unit/lib/fuel tests/unit/app/api/fuel-issuances tests/unit/components/fuel-issuance-components.test.ts
pnpm exec vitest run --config vitest.integration.config.ts tests/integration/fuel
pnpm exec playwright test --project=chromium tests/e2e/fuel-issuances.spec.ts tests/e2e/fuel-issuance-permissions.spec.ts tests/e2e/accessibility.spec.ts
pnpm validate
```

## Vehicle dispatch workflow

Users with `dispatch.read` review records at `/dispatches` and opaque-ID detail routes.
Dispatch Officers use `dispatch.create` to prepare drafts and `dispatch.update` to edit or
dispatch them. Completion requires `dispatch.complete`. Cancellation requires the independent
`dispatch.cancel` permission.

The collection API is `/api/dispatches`. Item reads and complete draft replacements use
`/api/dispatches/{publicId}`. Schedule and availability APIs are:

- `GET /api/dispatches/conflicts` for advisory driver and vehicle availability.
- `GET /api/dispatches/schedule` for a bounded general schedule.
- `GET /api/drivers/{publicId}/schedule` and `/api/vehicles/{publicId}/schedule` for resource calendars.
- `GET` and `PATCH /api/dispatch-schedule-settings` for authorized global policy administration.

The lifecycle actions are:

- `POST /api/dispatches/{publicId}/dispatch` with `{}` or strict conflict acknowledgment evidence.
- `POST /api/dispatches/{publicId}/complete` with the final odometer as a decimal string.
- `POST /api/dispatches/{publicId}/cancel` with a 10-to-500-character reason.

Create forms load current operational offices, drivers, and vehicles through
`GET /api/dispatch-preparation-options`. Reference selection is advisory. Create, draft update,
and dispatch commands recheck the selected office, driver, and vehicle inside their MySQL
transaction. Completion and cancellation do not reject a historical record merely because a
linked reference later became inactive, unserviceable, or deleted.

Every record starts as DRAFT. Draft details are editable until the explicit dispatch action.
The accepted lifecycle is:

```text
DRAFT ──> DISPATCHED ──> COMPLETED
  │            │
  └────────────┴───────> CANCELLED
```

COMPLETED and CANCELLED are terminal. Cancellation records a normalized reason and actor.
Completion records an exact final odometer. Initial and final readings use `DECIMAL(12,1)` and
remain decimal strings through the browser, API, domain, and database. Distance is derived with
exact decimal subtraction and is never persisted.

FVD-008 treats DRAFT, DISPATCHED, and COMPLETED records as same-day reservations. CANCELLED
records release their resources. The rule is deliberately conservative because trip start and
end times remain unset. A later interval-scheduling change can replace same-day matching without
changing the conflict-policy boundary.

The schedule is available at `/dispatches/schedule` in day, Monday-to-Sunday week, and six-row
month views. Native GET parameters hold the date, view, office, driver, vehicle, and status.
Views return at most 200 records across no more than 42 inclusive dates. Resource occupancy is
calculated separately, so a truncated event list never produces a false `Available` state.

The global policy is managed at `/admin/dispatch-settings` by users with
`dispatch.settings.manage`. `WARN_AND_ACK` is the default. It lets users with
`dispatch.conflict.override` proceed only after reviewing current conflicts and recording a
10-to-500-character reason. `BLOCK` rejects every conflict and cannot be bypassed by an old or
edited acknowledgment. Dispatch Officers and Super Administrators initially receive override
permission. System Administrators and Super Administrators initially receive settings permission.

Advisory availability never authorizes a write. Create, draft update, and dispatch transition
commands lock the selected resources, read the current global policy, and query conflicts again
inside one MySQL transaction. A changed fingerprint returns the latest conflict summary for a
new review. A retry-required concurrency response means the transaction rolled back safely;
reload the schedule and submit again.

Migration `20260829_000009_create_dispatch_scheduling` stores the singleton policy and append-only
conflict evidence. Dispatch details show this history without treating older evidence as a current
override. The migration leaves the future travel-time columns null and unexposed.

Validate the focused module with:

```sh
pnpm exec vitest run --config vitest.config.ts tests/unit/domain/dispatch tests/unit/application/dispatch tests/unit/lib/dispatch tests/unit/app/api/dispatches tests/unit/components/dispatch-components.test.ts tests/unit/components/dispatch-schedule-components.test.ts
pnpm exec vitest run --config vitest.integration.config.ts tests/integration/dispatch
pnpm exec playwright test --project=chromium tests/e2e/dispatches.spec.ts tests/e2e/dispatch-permissions.spec.ts tests/e2e/accessibility.spec.ts
pnpm validate
```

## Database operations

The shared local MySQL service is named `mysql` on the external `dev-net` network. FVDMS creates its application database, primary audit schema, secondary audit schema, and dedicated accounts.

Run database commands from the repository root:

```sh
pnpm db:bootstrap
pnpm db:migrate
pnpm db:status
pnpm db:rollback
```

These commands run in the short-lived `database-tools` container. Repeated bootstrap and migrate calls are safe.

The application, migration, worker, sink-writer, and verifier accounts have separate grants. Only the migration account can change FVDMS schemas. None is the shared MySQL administrator.

## Durable audit operations

Business and authentication use cases append a validated audit event inside their existing MySQL transaction. A successful response therefore depends on the primary outbox commit. It does not wait for chaining, sink delivery, or verification.

Every producer must use an event-specific builder with allowlisted fields. Events may contain public identifiers, stable action codes, exact UTC times, and bounded audit-safe JSON. Never include credentials, tokens, cookies, encryption material, raw request bodies, SQL, or arbitrary object serialization.

The worker performs two independent bounded operations:

1. It finalizes ordered outbox rows into a global RFC 8785 and SHA-256 hash chain.
2. It delivers exact append-only copies to the secondary audit sink.

The worker is not routed through Traefik and publishes no port. Stop it with `pnpm dev:down`, or restart only that process with:

```sh
docker compose restart audit-worker
```

Sink outages do not block business capture or primary chain progress. Delivery retries use bounded backoff and exact fingerprint checks. The sink writer may select a fingerprint and insert a row, but it cannot update or delete evidence.

A poison outbox event stops finalization at the first invalid source position. The worker does not skip, rewrite, or repair it. Preserve the database and logs, investigate the producing code and transaction, then follow an approved incident procedure.

Run one verification through its dedicated container:

```sh
pnpm audit:verify:container
```

Exit code `0` means the captured primary range and sink match. Exit code `1` means a safe mismatch category was recorded. Exit code `2` means infrastructure prevented verification. A failed run never changes audit evidence.

The `/audit` page is read-only and requires `audit.read`. Sensitive request context also requires `audit.read_sensitive`. Every successful search or detail read appends one `audit.accessed` event.

Local development places both audit schemas on the same shared MySQL host. This separation proves credentials, append-only behavior, and adapter boundaries. It is not an independent backup or production trust boundary. Production must place the sink on an independently controlled host or service through the existing `AuditSink` port.

Generate a different random password for every database account outside local development:

```sh
openssl rand -base64 32
```

Do not place passwords in images, client variables, logs, or committed environment files. Retention, archival, legal holds, and production secondary-host operations remain deferred to FVD-012 and FVD-011.

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

Install Chromium once, then run the isolated browser suite:

```sh
pnpm exec playwright install chromium
pnpm exec playwright test --project=chromium
```

The browser setup starts its own MySQL 8.4.11 container and Next.js process on `http://localhost:3100`. It does not read or mutate the shared local database.

Run coverage or the complete validation suite:

```sh
pnpm test:coverage
pnpm validate
```

The complete suite checks formatting, linting, types, coverage, restricted-account integration behavior, browser accessibility, and the production build. GitHub Actions runs the same checks after the repository is pushed to a remote.

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

## Security scope and non-goals

FVDMS stores only hashes of browser session, challenge, and CSRF tokens. TOTP secrets use versioned AES-256-GCM encryption. Authentication responses use `Cache-Control: no-store`, exact-origin checks, synchronizer CSRF tokens, generic credential failures, and durable account/source throttles.

This ticket does not provide self-service email recovery, SMS recovery, single sign-on, trusted-device bypasses, production secret distribution, retention automation, or production deployment. Dispatch workflows, audit exports, and operational dashboards remain separate tickets.

## Audit implementation references

- [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [Node.js cryptography documentation](https://nodejs.org/api/crypto.html)
- [Kysely transactions](https://kysely.dev/docs/getting-started)
- [MySQL account-management statements](https://dev.mysql.com/doc/refman/8.4/en/account-management-statements.html)
