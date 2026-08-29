# Fuel and Vehicle Dispatch Management System

This repository contains the secure application foundation, operational workflows, reporting, private exports, and durable audit systems for FVDMS. It uses Next.js 16, TypeScript, Kysely, MySQL, and Docker.

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
- `docker compose ps` shows `fvdms` as healthy. It also shows the audit and reporting workers as running.
- No application or database port is published directly to the host.

Follow application, audit-worker, and reporting-worker logs:

```sh
pnpm dev:logs
```

Stop the FVDMS application and both workers:

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

## Operational reports and private XLSX exports

Authorized users open `/reports` from the Oversight navigation group. Report filters use native
GET parameters, inclusive Asia/Manila civil dates, and stable cursor pagination. The reporting
page exposes only report families allowed by the current user's read permissions.

The nine initial reports use these business rules:

| Report                             | Included records and measure                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| Fuel issuance detail               | POSTED and VOIDED issuances. VOIDED rows retain their stored quantities and prices. |
| Dispatch detail                    | DRAFT, DISPATCHED, COMPLETED, and CANCELLED dispatches.                             |
| Fuel consumption by office         | POSTED fuel quantities and amounts grouped by the stored requesting office.         |
| Fuel consumption by vehicle        | POSTED fuel quantities and amounts grouped by the stored vehicle.                   |
| Fuel type totals                   | POSTED fuel quantities and amounts grouped by fuel type.                            |
| Total fuel amount by period        | POSTED fuel amounts grouped by civil reporting period.                              |
| Dispatch count by office           | DISPATCHED and COMPLETED dispatches grouped by the stored requesting office.        |
| Vehicle utilization                | COMPLETED dispatch distance grouped by the stored vehicle.                          |
| Fuel activity by budget allocation | POSTED fuel quantities and amounts grouped by the stored allocation.                |

Detail status filters must remain within each report's included statuses. Summary reports do not
accept status overrides. Historical labels, quantities, unit prices, and odometer readings come
from persisted transaction facts. They are not reconstructed from current reference data.

Reading fuel reports requires `fuel.read`. Reading dispatch reports requires `dispatch.read`.
Fuel exports also require `fuel.export`. Dispatch and budget-allocation activity exports require
`report.export`. The migration grants `report.export` to Dispatch Officers. Existing administrator
roles keep their seeded permissions.

The reporting endpoints are:

- `GET /api/reports/{reportType}` for bounded report results.
- `POST /api/report-exports` to request a private workbook.
- `GET /api/report-exports` and `GET /api/report-exports/{publicId}` for the requester's jobs.
- `POST /api/report-exports/{publicId}/download-link` for a short-lived, one-time link.
- `GET /api/report-exports/{publicId}/download?token=...` for the authorized file stream.

Small exports up to 1,000 estimated rows complete in the request. Annual exports and larger jobs
run through `fvdms-reporting-worker`. Every export is capped at 100,000 rows, 50 MiB, and 15
minutes. A lease lasts 16 minutes and supports recovery after an interrupted worker. Jobs make at
most three attempts.

Workbooks contain `Report` and `Filters` worksheets. They include normalized filters, the period,
generation time, headings, exact numeric cells, and server-calculated totals. Text cells are
neutralized when leading controls, ASCII formula prefixes, or full-width formula variants could
trigger spreadsheet evaluation.

Files live only in the private `report-exports` volume. They expire after seven days. Download
links expire after five minutes or at file expiry, whichever comes first. Tokens are stored only
as hashes and are consumed once. Request, completion, terminal failure, and download authorization
all create immutable audit events.

Restart only the reporting worker with:

```sh
docker compose restart reporting-worker
```

Use `pnpm dev:logs` to diagnose failed jobs. Retryable infrastructure failures return to the queue
with bounded backoff. An expired lease is reclaimed by a later worker claim. Terminal validation,
permission, row-limit, file-limit, and exhausted failures remain failed and require a new request
after the cause is corrected.

If a completed job has no file, preserve the database and worker logs. Treat it as an integrity
incident before requesting a replacement. Cleanup retries file deletion failures and removes stale
temporary files. Do not delete job or token rows manually while investigating.

Review production package advisories with `pnpm audit --prod`. Apply a compatible patched version
and run the complete validation suite before release. Do not suppress an advisory without a written
risk decision.

Local development uses a separate read-only `fvdms_reporter` account on the shared MySQL host. This
proves grants and the reporting adapter boundary, but it does not isolate load from primary writes.
Production must use the replica or snapshot required by FVD-011. Production startup rejects a
writer alias unless a reviewed deployment exception explicitly enables it.

Validate reporting with:

```sh
pnpm exec vitest run --config vitest.config.ts tests/unit/application/reporting tests/unit/infrastructure/reporting tests/unit/lib/reporting tests/unit/app/api/reports tests/unit/app/api/report-exports tests/unit/components/reporting
pnpm exec vitest run --config vitest.integration.config.ts tests/integration/reporting
pnpm exec playwright test --project=chromium tests/e2e/reports.spec.ts tests/e2e/report-permissions.spec.ts tests/e2e/protected-navigation.spec.ts tests/e2e/accessibility.spec.ts
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

Seed 100 through 500 synthetic operational records for local visual review:

```sh
pnpm db:seed-demo -- --count 300
```

The count is split between fuel issuances and vehicle dispatches. The command also creates clearly marked offices, drivers, vehicles, and period-correct budget allocations. It requires an active Super Administrator as the recorded seed actor, refuses production mode, and refuses a second demo batch until the database is reset.

Permanently remove all local operational and authentication data, then reapply the latest migrations:

```sh
pnpm db:fresh -- --confirm FVDMS_FRESH_DATABASE
```

The exact confirmation token is required. The command refuses `NODE_ENV=production` and leaves only the migrated baseline schema, roles, permissions, and settings. Create a new initial Super Administrator after the reset before signing in again.

The application, reporting, migration, worker, sink-writer, and verifier accounts have separate grants. Only the migration account can change FVDMS schemas. None is the shared MySQL administrator.

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
