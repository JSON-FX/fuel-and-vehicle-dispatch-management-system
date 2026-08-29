# Feature: Provide operational reports and secure Excel exports

The following plan is complete for FVD-009. Validate the merged FVD-008 base, migration order, package-security gate, and local reporting infrastructure before changing code.

Use the existing fuel, dispatch, budget, authorization, audit, database, worker, design-system, and testing seams. Add one reporting application module instead of placing reporting logic in pages or controllers.

## Feature Description

FVD-009 adds bounded operational reports for fuel issuance, dispatch activity, fuel summaries, vehicle utilization, and budget-allocation activity.

Authorized users can filter reports by office and calendar period. The dashboard shows only report families the current user may read.

Small exports complete during the request when their estimated row count is at most 1,000. Annual or larger exports create durable MySQL jobs for a dedicated worker.

Every generated XLSX file remains outside the public web root. The requester must remain authenticated and authorized before receiving a one-time, user-bound download link.

Export requests, completions, failures, and download authorizations create immutable audit evidence. Report queries, worker execution, files, and downloads all have explicit bounds.

## User Story

As authorized operations, budget, and audit staff
I want trustworthy filtered reports and safe Excel exports
So that I can review fuel and dispatch activity without weakening transaction history, privacy, or system availability

## Problem Statement

The application records authoritative fuel, budget, and dispatch facts, but it does not yet provide the reporting workflows required by the Product Requirements Document.

Naive reporting would create several risks. Large queries could exhaust application memory, generated spreadsheets could execute user-controlled formulas, public files could bypass authorization, and summary calculations could reinterpret historical prices or quantities.

The reporting design must preserve stored business facts, use exact decimal calculations, keep large work away from request handlers, and issue files only to the user who requested them.

## Solution Statement

Create a reporting application module with typed report definitions, period resolution, permission policy, query ports, export orchestration, job processing, file storage, and download authorization.

Create migration `20260829_000010_create_reporting_and_exports.ts`. It adds durable `export_jobs` and one-time `export_download_tokens`, the indexes required by the queue, and the accepted Dispatch Officer grant for `report.export`.

Use a separate Kysely reporting connection. Local Docker points this connection to the existing shared MySQL service through a read-only database user. Production configuration must point it at the reporting replica or snapshot supplied by FVD-011.

Use Kysely's MySQL row stream and an ExcelJS streaming workbook writer. Commit rows as they are produced, calculate totals with `DecimalValue`, and never build a complete workbook or result set in memory.

Store files through a `PrivateExportStorage` port. The local adapter writes to a private shared Docker volume with temporary files, restrictive permissions, atomic rename, path containment, retention cleanup, and no route under `public/`.

Use random one-time download tokens stored only as SHA-256 hashes. Token issuance and consumption recheck the active session, exact permission, job ownership, job state, and file expiry.

Render `/reports` as a Server Component driven by native GET parameters. Keep client code limited to export submission, job polling, and download actions.

## Out of Scope / Non-Goals

- Not included: creating a production reporting replica, snapshot pipeline, object-store bucket, or production deployment topology. FVD-011 owns those resources.
- Not included: Redis, BullMQ, RabbitMQ, or another external queue service.
- Not included: charts, charting dependencies, pivots, forecasting, geographic maps, or ad hoc report builders.
- Not included: scheduled or emailed reports.
- Not included: CSV, PDF, OpenDocument, or editable report templates.
- Not included: cross-user export administration or downloading another user's file, including for Super Administrators.
- Not included: password, Time-based One-Time Password, or multi-factor authentication prompts during download. Reauthorization uses the active authenticated session and current permissions.
- Not included: office-scoped tenancy. The current system remains Local Government Unit-wide and permission-based.
- Not included: adding a monetary ceiling or percentage to budget allocations. The report shows actual fuel activity grouped by allocation.
- Not included: treating draft fuel issuances as financial activity.
- Not included: changing the stored fuel, price, dispatch, odometer, or conflict rules from FVD-006 through FVD-008.
- Not included: modifying historical migrations or exposing internal database identifiers.
- Not included: keeping files forever. Completed files expire after seven days.
- Not changing: the default-disabled global multi-factor authentication setting.
- Not changing: the audit outbox, chain, delivery, or verification architecture.

## Feature Metadata

**Feature Type**: New Capability / Reporting Infrastructure

**Estimated Complexity**: High

**Primary Systems Affected**: Reporting application services, MySQL migrations and queue claims, Kysely reporting queries, fuel and dispatch projections, exact decimal calculations, private file storage, background worker, immutable audit outbox, role-based access control, Next.js Route Handlers, protected pages, responsive report UI, Vitest, MySQL integration tests, Playwright, and Docker Compose

**Dependencies**: FVD-006 and FVD-008 merged through pull request #8; FVD-003 durable audit capture; FVD-004 master data; FVD-005 budget allocations; existing Next.js 16.3.3, React 19.2.8, Kysely 0.29.5, MySQL 8.4, mysql2 3.24.2, Decimal.js 10.6.0, Zod 4.4.3, Tailwind CSS 4.3.3, Vitest 4.1.11, and Playwright 1.62.1

**New runtime dependency**: `exceljs@4.4.0`, subject to the mandatory supply-chain and Node 24 gate in Task 2

## Related Work

**Implements**: FVD-009 in `docs/tickets/fuel-and-vehicle-dispatch-system.md`

**Epic**: `docs/PRD.md`

**Architecture**: `docs/System_Architecture.md`

**Back-references**:

- `.claude/plans/record-post-balance-void-fuel-issuances-atomically.md` defines stored quantities, stored prices, ledgers, status transitions, and the `fuel.export` seam.
- `.claude/plans/manage-budget-allocations-fiscal-eligibility.md` confirms budget allocations have no monetary ceiling. FVD-009 must report fuel activity rather than an invented percentage.
- `.claude/plans/dispatch-vehicles-with-eligibility-lifecycle-and-odometer-controls.md` defines dispatch statuses, passenger counts, odometer evidence, and completed distance.
- `.claude/plans/detect-dispatch-conflicts-and-show-availability.md` defines schedule behavior and confirms reporting consumes dispatch facts without replacing conflict rules.
- `.claude/plans/establish-durable-immutable-audit-capture-verification.md` defines transaction-scoped audit capture and worker conventions.
- `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md` defines the persistent visual tokens and interaction constraints.

**Forward-references**:

- FVD-011 must configure a production reporting replica or scheduled snapshot and production private storage.
- FVD-012 may extend report authorization, retention, monitoring, and operational runbooks without changing report contracts.
- A later budget-policy ticket may add a monetary allocation ceiling and a true utilization percentage through a separate migration.

## Execution Prerequisite

Pull request #8 is merged into `origin/main` at merge commit `3cb8afc56f0c51259e0d2c00d61eea2ea54e2548`.

The analyzed checkout is the clean FVD-008 feature branch at `8b608c2`. Local `main` may still trail `origin/main`.

Before implementation, fetch `origin`, fast-forward local `main` to `origin/main`, and create the FVD-009 branch from `3cb8afc` or a later verified `origin/main` commit.

Use migration number `000010`. Do not edit or reorder migrations `000001` through `000009`.

Recommended branch name: `feature/provide-operational-reports-secure-excel-exports`.

---

## ACCEPTED DECISION CONTRACT

The user accepted all recommended defaults on 2026-08-29. These decisions are binding for implementation.

### Report catalogue and business meanings

Implement these nine report types:

| Code                         | Interface label                    | Authoritative records                            | Key measures                                |
| ---------------------------- | ---------------------------------- | ------------------------------------------------ | ------------------------------------------- |
| `FUEL_ISSUANCE`              | Fuel issuance detail               | `POSTED` and `VOIDED` fuel issuances             | Stored liters, unit price, and total amount |
| `DISPATCH`                   | Dispatch detail                    | All dispatch lifecycle states allowed by filters | Stored passenger and odometer evidence      |
| `FUEL_BY_OFFICE`             | Fuel consumption by office         | `POSTED` fuel issuances only                     | Liters and amount by requesting office      |
| `FUEL_BY_VEHICLE`            | Fuel consumption by vehicle        | `POSTED` fuel issuances only                     | Liters and amount by vehicle                |
| `FUEL_TYPE_TOTALS`           | Fuel type totals                   | `POSTED` fuel issuances only                     | Liters and amount by fuel type              |
| `FUEL_AMOUNT_BY_PERIOD`      | Total fuel amount by period        | `POSTED` fuel issuances only                     | Exact amount grouped by calendar bucket     |
| `DISPATCH_COUNT_BY_OFFICE`   | Dispatch count by office           | `DISPATCHED` and `COMPLETED` dispatches only     | Count by requesting office                  |
| `VEHICLE_UTILIZATION`        | Vehicle utilization                | `COMPLETED` dispatches only                      | Trip count and completed odometer distance  |
| `BUDGET_ALLOCATION_ACTIVITY` | Fuel activity by budget allocation | `POSTED` fuel issuances only                     | Issued liters and amount by allocation      |

- Keep `VEHICLE_UTILIZATION` as the Product Requirements Document's vehicle-utilization summary and the architecture's ODO/distance output.
- Do not add a tenth ODO report.
- Do not call budget activity a percentage or remaining balance.
- Preserve historical labels through existing soft-delete-aware joins.
- Use stored fuel transaction quantities and prices. Never recalculate historical amount from a current price.
- Calculate summaries and totals with decimal arithmetic. Never use JavaScript binary floating-point for business totals.

### Period and date behavior

- Support `WEEKLY`, `MONTHLY`, `QUARTERLY`, `ANNUAL`, and `CUSTOM`.
- Resolve all calendar periods in `Asia/Manila`.
- Define weeks as Monday through Sunday.
- Define quarters as calendar quarters beginning January, April, July, and October.
- Define annual periods as January 1 through December 31.
- Require inclusive `startDate` and `endDate` for `CUSTOM`.
- Accept a civil reference date for the four named periods and resolve its full range on the server.
- Display the resolved inclusive range in the page and workbook.
- Reject inverted, malformed, duplicate, unsupported, or unbounded date parameters.
- Use the stored transaction date appropriate to each domain: fuel entry date for fuel reports and travel date for dispatch reports.

### Detail and summary status behavior

- Fuel detail includes `POSTED` and `VOIDED` so reversals remain visible.
- Fuel detail offers an optional status filter limited to `POSTED` and `VOIDED`.
- Fuel summaries count only `POSTED`. A voided issuance contributes zero current consumption and amount.
- Dispatch detail may filter `DRAFT`, `DISPATCHED`, `COMPLETED`, and `CANCELLED`.
- Dispatch count summaries use only `DISPATCHED` and `COMPLETED`.
- Vehicle utilization uses only `COMPLETED` records with valid odometer evidence.
- Do not derive summary status rules from the filters used by detail reports.

### Read and export authorization

- Use `fuel.read` for all fuel report views and budget-allocation activity views.
- Use `dispatch.read` for all dispatch report views.
- Show only dashboard sections the current principal may read.
- Use `fuel.export` for XLSX exports of `FUEL_ISSUANCE`, `FUEL_BY_OFFICE`, `FUEL_BY_VEHICLE`, `FUEL_TYPE_TOTALS`, and `FUEL_AMOUNT_BY_PERIOD`.
- Use `report.export` for `DISPATCH`, `DISPATCH_COUNT_BY_OFFICE`, `VEHICLE_UTILIZATION`, and `BUDGET_ALLOCATION_ACTIVITY` exports.
- Every export also requires the report's underlying read permission.
- Grant `report.export` to `DISPATCH_OFFICER` in migration `000010`.
- Preserve the existing grants for `PSMD_STAFF`, `BUDGET_OFFICER`, `AUDITOR`, and `SUPER_ADMIN`.
- Viewers remain read-only and cannot export unless a role administrator later grants an export permission.
- Recheck permissions at request, worker claim, download-link issuance, and token consumption.
- Every user may list, inspect, and download only their own export jobs.
- A Super Administrator does not bypass export ownership.

### Report query contract and bounds

- Define one discriminated `ReportType` union and one report-definition catalogue.
- Centralize labels, required read permission, required export permission, columns, totals, and status rules in the catalogue.
- Return decimal values as strings from application DTOs.
- Return `generatedAt`, `dataAsOf`, resolved period, applied office, row count, next cursor, and `truncated` metadata.
- Use cursor pagination with a default page size of 100 and maximum of 200.
- Bind opaque cursors to report type, normalized filters, ordering, and last sort keys.
- Reject a cursor reused with different filters.
- Use stable ordering with public ID as the final tie-breaker.
- Reject exports estimated above 100,000 rows.
- Abort an export if actual rows exceed 100,000 or the file exceeds 50 MiB.
- Keep all query inputs parameterized.

### Synchronous and queued exports

- Every export request first creates an `export_jobs` record.
- Generate synchronously when the estimate is at most 1,000 rows and the period is not annual.
- Queue every annual export, even when its estimate is small.
- Queue non-annual exports estimated above 1,000 rows.
- Return `201 Created` with a completed job for synchronous generation.
- Return `202 Accepted` with a queued job for background generation.
- Do not stream a generated workbook directly from the export-creation response.
- Use one durable MySQL queue. Do not add Redis or BullMQ.
- Run one reporting worker locally and in the initial production topology.
- Poll at a bounded interval and claim one job at a time.
- Attempt a job at most three times.
- Enforce a 15-minute generation timeout.
- Use a lease longer than the timeout and recover abandoned leases.
- Keep files for seven days after completion.
- Mark expired completed jobs `EXPIRED` after removing their files.

### Queue consistency and retries

- Use `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, and `EXPIRED` states.
- Claim jobs transactionally with `SELECT ... FOR UPDATE SKIP LOCKED` and a supporting status/availability index.
- Store lease owner, lease expiry, attempt count, maximum attempts, and next-available time.
- Return transient database, storage, and timeout failures to `QUEUED` with bounded backoff while attempts remain.
- Mark validation, authorization, configuration, row-limit, file-limit, and exhausted failures `FAILED`.
- Store a safe failure code and safe user message. Never persist stack traces, SQL, local paths, or credentials in user-visible fields.
- Check the requester's current active status and permissions again before generation.
- Fail safely if the requester is disabled or loses permissions after queueing.
- Make completion idempotent so a recovered worker cannot publish two files for one job.

### Reporting connection and production boundary

- Create a dedicated reporting Kysely connection and repository factory.
- Configure it through `REPORTING_DATABASE_*` variables with bounded pool and query timeout values.
- In local Docker, point it to the existing shared MySQL service through a read-only `fvdms_reporter` database user.
- Keep queue claims and export-job writes on the primary application database.
- Use the reporting connection only for report reads and estimates.
- Treat same-host local reporting as a development convenience, not production isolation.
- Require FVD-011 production configuration to point reporting reads at a replica or scheduled snapshot.
- Fail startup in production when reporting configuration silently aliases the primary writer without an explicit, audited deployment exception.

### Private file storage

- Define `PrivateExportStorage` in the application layer.
- Implement local filesystem storage under `REPORT_STORAGE_ROOT`.
- Mount the same named private volume into the application and reporting-worker containers.
- Never write export files under `public/`, source directories, or a Traefik-mounted directory.
- Use an opaque storage key rather than user-controlled path segments.
- Resolve and verify real paths remain under the configured root.
- Write to a unique temporary file with mode `0600`, flush and close it, then rename atomically.
- Store byte length and SHA-256 checksum after completion.
- Delete a finalized file when the database completion transaction rolls back.
- Remove temporary files after failures and abandoned attempts.
- Run bounded expiry cleanup in the worker loop.

### XLSX content and spreadsheet safety

- Use the ExcelJS streaming writer with shared strings disabled unless measurement proves bounded use.
- Commit every row, worksheet, and workbook.
- Use one `Report` worksheet and one `Filters` worksheet.
- Put report title, resolved period, office, generation time, data-as-of time, and row count in workbook metadata.
- Include the required Product Requirements Document columns, stable headings, autofilter, frozen headings, bounded widths, and server-calculated totals.
- Write legitimate numeric measures as Excel number cells with fixed number formats after Decimal bounds validation.
- Keep the authoritative application values and all calculations as decimal strings.
- Never put formulas in generated cells. Totals are calculated by the server and written as numbers.
- Treat all user-controlled labels and free text as strings.
- Normalize leading whitespace and control characters before checking dangerous prefixes.
- Protect ASCII `=`, `+`, `-`, and `@` and equivalent full-width prefixes by adding a leading apostrophe and forcing text format.
- Include tab, carriage return, and line feed in the defensive prefix check.
- Do not mistake negative system-generated numeric values for user-controlled text.
- Round-trip representative workbooks in tests and assert dangerous cells remain string values, not formula values.

### Package security decision

- Pin `exceljs@4.4.0`; do not use a floating range.
- Before keeping it, run `pnpm audit --prod`, inspect `pnpm why tmp uuid`, and execute a Node 24 streaming write/read spike.
- Use compatible package overrides only when tests prove ExcelJS behavior remains correct.
- Do not suppress a high or critical advisory without a documented rationale.
- If the current `tmp` or `uuid` advisory cannot be removed or shown unreachable for the server-only writer path, stop Task 2 and select a maintained server-side XLSX writer through an amendment before implementation continues.
- Do not switch to an unofficial ExcelJS fork without explicit review.

### Download reauthorization and one-time links

- Reauthorization means active session, current read permission, current export permission, job ownership, completed state, and unexpired file.
- Do not prompt for password or multi-factor authentication.
- Generate 32 random bytes and return the raw token only once.
- Store only the SHA-256 token hash.
- Bind each token to one export job and one user.
- Expire tokens after five minutes.
- Consume tokens atomically and permit exactly one successful authorization.
- Require the same active browser session when consuming the link.
- Recheck ownership and permissions during consumption.
- Return generic not-found or unavailable responses that do not reveal another user's jobs.
- Set XLSX content type, attachment disposition, `Cache-Control: no-store`, and `X-Content-Type-Options: nosniff`.
- Do not reveal storage keys or local paths in APIs, logs, or filenames.

### Audit semantics

- Use `report.export.requested` when the durable job is created.
- Use `report.export.completed` after the final file exists and the job becomes completed.
- Use `report.export.failed` only on terminal failure.
- Use `report.export.download_authorized` when a valid token is consumed before streaming begins.
- Do not claim the entire byte transfer completed when the server can only prove authorization and stream initiation.
- Include job public ID, report type, normalized period, office public ID when present, mode, row count, file size, checksum, attempt, and safe failure code where applicable.
- Exclude raw token, token hash, storage key, file path, SQL, stack trace, and sensitive free text.
- Capture request and synchronous completion audit in the same transaction as the job transitions they describe.
- Capture worker completion or terminal failure in the same transaction as the corresponding job transition.

### Reporting interface

- Add one `Reports` link under the existing `Oversight` navigation group.
- Do not add nine sidebar links.
- Protect `/reports` when the principal has `fuel.read` or `dispatch.read`.
- Render the page as a Server Component and use native GET parameters for report, office, period, reference date, custom dates, cursor, and detail status.
- Default to an `Overview` presentation that includes only authorized summaries.
- Use a concise filter card with visible labels and consistent control alignment.
- Show the resolved inclusive period before the results.
- Use summary cards and semantic tables. Do not add a chart dependency.
- Render detail data as a desktop table and accessible mobile cards.
- Provide an export dialog only when the exact export permission is present.
- Show recent own jobs with status, report label, requested time, attempt, expiry, failure message, and download action.
- Poll only while the page has queued or running jobs. Stop on completion, terminal state, unmount, or hidden-tab backoff.
- Support loading, initial, filtered empty, invalid filter, denied, query failure, truncated, queued, running, completed, failed, and expired states.
- Preserve Lexend headings, Source Sans 3 body text, existing semantic colors, sidebar behavior, dark mode, restrained motion, and visible focus.
- Verify widths 375, 768, 1024, and 1440 pixels, plus 200-percent zoom.

---

## ACCEPTANCE CRITERIA

- **AC1 — Report filters**: Authorized users can filter fuel and dispatch reports by office, supported period, and inclusive date range.
- **AC2 — Initial catalogue**: The dashboard supports both detail reports and all seven Product Requirements Document summaries.
- **AC3 — Historical correctness**: Fuel reports use stored quantities, unit prices, and amounts; dispatch reports use stored status and odometer evidence.
- **AC4 — Status correctness**: Fuel summaries use posted activity, dispatch summaries use dispatched/completed activity, and vehicle utilization uses completed trips.
- **AC5 — Exact calculations**: Totals and summaries use decimal arithmetic and deterministic calendar buckets in Asia/Manila.
- **AC6 — Bounded reads**: Report APIs enforce normalized filters, stable cursor pagination, maximum page size, row limits, and time limits.
- **AC7 — Workbook content**: XLSX files include required headings, filters, totals, resolved period, generation time, data-as-of time, and row count.
- **AC8 — Formula protection**: User-controlled spreadsheet text cannot become an executable formula, including dangerous prefixes hidden by whitespace or control characters.
- **AC9 — Synchronous threshold**: Non-annual exports estimated at 1,000 rows or fewer generate synchronously through a durable job record.
- **AC10 — Durable queue**: Annual and larger exports use durable jobs, leases, bounded retries, timeouts, and a dedicated worker.
- **AC11 — Reporting isolation**: Heavy reads use the reporting adapter; production refuses an accidental primary-writer alias without an explicit deployment exception.
- **AC12 — Private files**: Generated files remain private, bounded, checksummed, retained for seven days, and deleted on expiry.
- **AC13 — Download authorization**: Only the active requester can mint and consume a five-minute, one-time download token after current permission checks.
- **AC14 — Permission policy**: Views, export requests, worker execution, and downloads enforce the accepted underlying and export permissions.
- **AC15 — Audit evidence**: Request, completion, terminal failure, and download authorization create safe immutable audit events.
- **AC16 — Responsive dashboard**: `/reports` provides accessible filters, summaries, detail results, export actions, and job states across supported widths and modes.
- **AC17 — Failure safety**: Query, workbook, storage, audit, timeout, cancellation, cleanup, and retry failures leave consistent job and file state.
- **AC18 — Complete validation**: Unit, integration, route, security, lifecycle, formula-injection, accessibility, end-to-end, build, and Docker checks pass.

## CONTEXT REFERENCES

### Requirement anchors

- `docs/tickets/fuel-and-vehicle-dispatch-system.md:294-325` defines FVD-009 scope, acceptance criteria, seams, size, and prerequisites.
- `docs/PRD.md:515-538` defines report filtering and Excel behavior.
- `docs/PRD.md:573-575` requires background heavy work and bounded result sizes.
- `docs/PRD.md:621-625` requires reporting isolation and bounded queues.
- `docs/PRD.md:762-819` defines export processing, exact detail columns, and seven summaries.
- `docs/PRD.md:919-959` defines release acceptance and quality gates.
- `docs/System_Architecture.md:920-944` defines report inputs, outputs, jobs, private downloads, and formula protection.
- `docs/System_Architecture.md:1037-1071` defines reporting and export tests.
- `docs/System_Architecture.md:1082-1155` defines worker, private storage, reporting replica, and resource limits.
- `docs/System_Architecture.md:1236-1255` defines SEC-02, SCALE-04, and SCALE-05.
- `docs/System_Architecture.md:1267-1269` requires an explicit retention policy before production.

### Existing domain and persistence anchors

- `src/application/fuel/dto/fuel-dtos.ts:40-99` defines fuel detail and query DTO patterns.
- `src/application/fuel/dto/fuel-dtos.ts:163-196` defines decimal-string result projections.
- `src/infrastructure/database/fuel/kysely-fuel-issuance-repository.ts:175-305` defines bounded fuel query and historical join patterns.
- `src/infrastructure/database/fuel/kysely-fuel-ledger-repository.ts:62-106` defines exact fuel aggregate queries.
- `src/domain/shared/value-objects/decimal-value.ts:4-76` defines exact decimal arithmetic and output rules.
- `src/application/dispatch/dto/dispatch-dtos.ts:35-58` defines dispatch query and status DTO patterns.
- `src/application/dispatch/dto/dispatch-dtos.ts:245-269` defines completed distance output.
- `src/domain/dispatch/entities/vehicle-dispatch.ts:81-83` defines authoritative distance behavior.
- `src/infrastructure/database/dispatch/kysely-dispatch-repository.ts:140-270` defines historical dispatch projections and filters.
- `src/infrastructure/database/dispatch/kysely-dispatch-schedule-repository.ts:91-147` must not be reused as vehicle utilization because it counts reserving statuses.
- `src/infrastructure/database/types.ts:203-216` confirms budget allocations contain fiscal metadata but no amount ceiling.

### Existing authorization, audit, and worker anchors

- `src/infrastructure/database/migrations/20260828_000002_create_authentication_and_rbac.ts:19-72` defines existing report permissions and role grants.
- `src/infrastructure/database/migrations/20260828_000005_create_budget_allocations.ts:8-21` defines budget read grants.
- `src/lib/auth/authenticated-request.ts:43-70` defines authenticated principal and permission checks.
- `src/application/auth/dto/authentication-dtos.ts:1-18` confirms principals currently have no office scope.
- `src/application/audit/dto/audit-event-dtos.ts:8-22` defines audit event drafts.
- `src/infrastructure/database/audit/kysely-audit-outbox-store.ts:53-96` defines transaction-scoped audit insertion.
- `src/application/fuel/use-cases/post-fuel-issuance.ts:39-113` defines mutation plus audit transaction behavior.
- `scripts/audit/worker.ts:19-110` defines signal handling, bounded polling, and worker shutdown.
- `src/infrastructure/composition/audit.ts:32-103` defines dedicated worker composition.
- `src/infrastructure/database/audit/client.ts:7-27` defines dedicated database client behavior.

### Existing configuration and Docker anchors

- `src/infrastructure/config/environment.ts:124-272` defines typed environment parsing.
- `src/infrastructure/config/environment.ts:358-423` defines database and worker settings.
- `src/infrastructure/config/environment.ts:467-503` defines environment assembly and production checks.
- `src/infrastructure/database/bootstrap.ts:9-84` defines database bootstrap and grants.
- `scripts/database/bootstrap.ts:21-44` defines bootstrap command behavior.
- `compose.yaml:3-69` defines the application container and Traefik labels.
- `compose.yaml:71-112` defines the audit worker pattern.
- `compose.yaml:195-202` defines project volumes and external `dev-net`.

### Existing HTTP, page, and component anchors

- `src/infrastructure/composition/root.ts:65-182` defines root dependency composition.
- `src/app/api/fuel-issuances/route.ts:11-55` defines authenticated GET/POST handlers.
- `src/app/api/dispatches/route.ts:15-70` defines strict query and mutation handler patterns.
- `src/lib/http/with-response-handler.ts:24-86` supports native `Response` objects needed for file streaming.
- `src/app/(protected)/layout.tsx:6-24` defines protected-route permission mapping.
- `src/components/navigation/protected-navigation.tsx:365-410` defines grouped sidebar destinations.
- `src/app/(protected)/fuel-issuances/page.tsx:21-114` defines Server Component filtering and pagination.
- `src/components/master-data/responsive-reference-results.tsx:3-31` defines table/card responsive switching.
- `src/components/fuel-issuances/fuel-issuance-results.tsx:17-152` defines responsive operational results.
- `src/components/dispatches/dispatch-filter-form.tsx:11-106` defines native GET filter layout.

### Installed Next.js guidance

- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md:12-36` recommends Server Components for server data and client leaves for interaction.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md:67-121` requires awaiting `searchParams` and treats them as request-time input.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md:166-190` documents filtering and pagination through `searchParams`.
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md:13-51` defines App Router handlers through Web Request and Response APIs.
- `node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md:134-140` recommends production-like end-to-end execution and supports configured web servers.

### External research decisions

- ExcelJS `v4.4.0` is the latest stable release and documents streaming XLSX output. It remains the selected writer because it supports row commitment and workbook formatting.
- ExcelJS has current open issues concerning stale `tmp` and `uuid` dependencies. Task 2 therefore makes the dependency gate mandatory rather than treating installation as complete by itself.
- Kysely's stream API yields rows without loading the entire result. The installed MySQL adapter delegates to `mysql2` object-mode streaming and yields one row at a time.
- MySQL documents `SKIP LOCKED` as suitable for queue-like tables. It is not used for ordinary report consistency reads.
- OWASP identifies formula injection through dangerous leading characters and separators. The sanitizer extends the ticket's four required ASCII prefixes to leading controls and full-width equivalents.
- Node's filesystem streams support bounded writes. The adapter adds restrictive permissions, path containment, cleanup, and atomic rename.

### Design-system decisions

- `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md` remains authoritative.
- Create `design-system/fuel-and-vehicle-dispatch-management-system/pages/reporting-dashboard.md` before UI implementation.
- Keep Lexend for headings and Source Sans 3 for body text.
- Keep the light government operations-console character, semantic tokens, dark-mode equivalents, and low-motion behavior.
- Reject generated dark-only styling, Fira fonts, large decorative charts, and dashboard clutter.

### Existing test anchors

- `tests/unit/app/api/fuel-issuances/fuel-routes.test.ts:6-110` defines route mocking and authentication tests.
- `tests/unit/components/fuel-issuance-components.test.ts:51-86` defines component rendering patterns.
- `tests/integration/fuel/balances.test.ts:20-147` defines MySQL aggregate correctness tests.
- `tests/integration/dispatch/dispatch-repository.test.ts:24-228` defines dispatch repository integration tests.
- `tests/e2e/fixtures/auth.ts:4-41` defines deterministic authenticated browser principals.
- `tests/e2e/audit-trail.spec.ts:89-121` defines responsive and accessibility checks.
- `tests/e2e/protected-navigation.spec.ts:6-58` defines permission-aware sidebar assertions.
- `tests/e2e/global-setup.ts:59-84` and `:520-578` define application and worker startup.
- `playwright.config.ts:3-18` defines Chromium execution and base URL.

---

## TECHNICAL DESIGN

### Application boundaries

Create a new `src/application/reporting` module. It owns report definitions, filters, periods, permissions, query DTOs, export commands, job lifecycle, download decisions, and audit drafts.

Fuel, dispatch, and budget modules remain authoritative writers. Reporting only reads their persisted facts through projections.

The application layer depends on these ports:

- `ReportQueryRepository`
- `ExportJobRepository`
- `ReportingTransaction`
- `ReportExporter`
- `PrivateExportStorage`
- `ExportDownloadTokenService`
- `Clock`
- `UuidGenerator`
- existing authorization and audit ports

### Report DTO contract

Define `ReportFilters` with report type, optional office public ID, period type, reference date or custom dates, optional detail status, cursor, and page size.

Define a discriminated `ReportResult` union. Each member contains its typed rows, typed totals, resolved filters, generation metadata, cursor metadata, and truncation state.

Keep detail and summary row types separate. Do not return loose records or arbitrary column dictionaries across the application boundary.

### Query implementation

Implement one repository method per report type and shared filter helpers. Use explicit projections and `CASE` expressions for each status rule.

Use `COUNT(*)` estimates with the same normalized predicates as the export query. Cap estimate work and treat an estimate above 100,000 as rejection without counting the exact remainder.

For pages, use stable keyset queries. For exports, use Kysely `.stream()` over the reporting connection and stop when the hard row or timeout bound is reached.

Use `AbortController` or Kysely abort options for timeout cancellation where supported. Destroy or release the reporting connection after an aborted MySQL stream.

### Export job state flow

```text
request
  -> QUEUED durable row + requested audit
  -> synchronous eligible: RUNNING -> COMPLETED
  -> asynchronous: worker claim -> RUNNING
       -> transient failure with attempts left -> QUEUED
       -> success -> COMPLETED
       -> terminal failure -> FAILED
  -> retention cleanup -> EXPIRED
```

Synchronous generation uses the same state-transition service as the worker. It does not use a separate temporary export contract.

### Database schema

`export_jobs` contains:

- internal unsigned bigint primary key and opaque UUIDv7 public ID
- requester user foreign key
- report type and normalized period type
- normalized filter JSON and deterministic filter hash
- mode `SYNCHRONOUS` or `QUEUED`
- state with named check constraint
- estimated and actual row counts
- attempt count and maximum attempts
- available time, lease owner, lease expiry, started time, and finished time
- opaque storage key, safe filename, MIME type, byte length, and SHA-256 checksum
- file expiry time
- safe failure code and message
- created and updated timestamps

Indexes cover requester plus creation time, state plus availability plus lease, expiry cleanup, and public ID uniqueness.

`export_download_tokens` contains:

- internal unsigned bigint primary key
- export job foreign key
- user foreign key
- binary SHA-256 token hash with unique constraint
- expiry, consumption, and creation timestamps

Use restrictive foreign keys. Expiry cleanup deletes tokens before jobs when a later retention policy removes job metadata.

### HTTP routes

- `GET /api/reports/[reportType]`
- `POST /api/report-exports`
- `GET /api/report-exports`
- `GET /api/report-exports/[exportJobId]`
- `POST /api/report-exports/[exportJobId]/download-link`
- `GET /api/report-exports/[exportJobId]/download?token=...`

Every route uses strict schemas, opaque UUIDv7 identifiers, standard error envelopes where JSON is returned, and exact permission checks.

The download route returns a native streaming `Response`. It does not wrap workbook bytes in JSON.

### Workbook structure

The `Report` sheet contains a title block, metadata block, blank separator, heading row, data rows, and totals row.

The `Filters` sheet contains report type, period type, resolved start and end dates, office, status, generated time, data-as-of time, row count, and whether the result reached a hard bound.

Workbook filenames use safe server labels and timestamps. They never include raw destination, driver, office, purpose, or user input.

### UI structure

The page header contains title, concise description, and export action when allowed.

The filter card contains report, office, period, reference date or custom range, and detail status where applicable. Summary and detail views share the same resolved-filter banner.

The overview uses compact summary cards and ranked semantic tables. It does not fetch report families the user cannot read.

The recent exports section is below the report results. It polls queued or running jobs with backoff and provides a Download action only for completed, unexpired own jobs.

---

## FILE CHANGES

### New application files

- `src/application/reporting/dto/report-dtos.ts`
- `src/application/reporting/dto/export-job-dtos.ts`
- `src/application/reporting/ports/report-query-repository.ts`
- `src/application/reporting/ports/export-job-repository.ts`
- `src/application/reporting/ports/report-exporter.ts`
- `src/application/reporting/ports/private-export-storage.ts`
- `src/application/reporting/ports/reporting-transaction.ts`
- `src/application/reporting/ports/export-download-token-service.ts`
- `src/application/reporting/services/report-catalogue.ts`
- `src/application/reporting/services/report-period-policy.ts`
- `src/application/reporting/services/report-permission-policy.ts`
- `src/application/reporting/services/report-audit-events.ts`
- `src/application/reporting/services/export-job-state-machine.ts`
- `src/application/reporting/services/export-job-worker.ts`
- `src/application/reporting/use-cases/get-report.ts`
- `src/application/reporting/use-cases/request-report-export.ts`
- `src/application/reporting/use-cases/list-own-export-jobs.ts`
- `src/application/reporting/use-cases/get-own-export-job.ts`
- `src/application/reporting/use-cases/issue-export-download-link.ts`
- `src/application/reporting/use-cases/download-export.ts`

### New infrastructure files

- `src/infrastructure/database/migrations/20260829_000010_create_reporting_and_exports.ts`
- `src/infrastructure/database/reporting/client.ts`
- `src/infrastructure/database/reporting/create-kysely-reporting-repositories.ts`
- `src/infrastructure/database/reporting/kysely-report-query-repository.ts`
- `src/infrastructure/database/reporting/kysely-export-job-repository.ts`
- `src/infrastructure/database/reporting/kysely-reporting-transaction.ts`
- `src/infrastructure/reporting/exceljs-report-exporter.ts`
- `src/infrastructure/reporting/spreadsheet-text-sanitizer.ts`
- `src/infrastructure/reporting/local-private-export-storage.ts`
- `src/infrastructure/reporting/node-export-download-token-service.ts`
- `src/infrastructure/composition/reporting.ts`
- `scripts/reporting/worker.ts`
- `scripts/reporting/worker.sh`

### New Route Handlers and page files

- `src/app/api/reports/[reportType]/route.ts`
- `src/app/api/report-exports/route.ts`
- `src/app/api/report-exports/[exportJobId]/route.ts`
- `src/app/api/report-exports/[exportJobId]/download-link/route.ts`
- `src/app/api/report-exports/[exportJobId]/download/route.ts`
- `src/app/(protected)/reports/page.tsx`
- `src/app/(protected)/reports/loading.tsx`
- `src/app/(protected)/reports/error.tsx`
- `src/lib/reporting/page-query.ts`
- `src/lib/reporting/route-schemas.ts`
- `src/lib/reporting/server-report-access.ts`

### New interface files

- `src/components/reporting/report-filter-form.tsx`
- `src/components/reporting/report-overview.tsx`
- `src/components/reporting/report-period-summary.tsx`
- `src/components/reporting/fuel-report-results.tsx`
- `src/components/reporting/dispatch-report-results.tsx`
- `src/components/reporting/summary-report-results.tsx`
- `src/components/reporting/budget-allocation-activity-results.tsx`
- `src/components/reporting/report-export-dialog.tsx`
- `src/components/reporting/recent-export-jobs.tsx`
- `src/components/reporting/export-job-status-badge.tsx`
- `src/components/reporting/export-download-button.tsx`
- `design-system/fuel-and-vehicle-dispatch-management-system/pages/reporting-dashboard.md`

### New tests

- `tests/unit/application/reporting/report-services.test.ts`
- `tests/unit/application/reporting/report-use-cases.test.ts`
- `tests/unit/infrastructure/reporting/spreadsheet-text-sanitizer.test.ts`
- `tests/unit/infrastructure/reporting/exceljs-report-exporter.test.ts`
- `tests/unit/infrastructure/reporting/local-private-export-storage.test.ts`
- `tests/unit/lib/reporting/page-query.test.ts`
- `tests/unit/lib/reporting/route-schemas.test.ts`
- `tests/unit/app/api/reports/report-routes.test.ts`
- `tests/unit/app/api/report-exports/report-export-routes.test.ts`
- `tests/unit/components/reporting/report-components.test.ts`
- `tests/integration/reporting/migration.test.ts`
- `tests/integration/reporting/report-query-repository.test.ts`
- `tests/integration/reporting/export-job-repository.test.ts`
- `tests/integration/reporting/export-job-worker.test.ts`
- `tests/integration/reporting/export-audit-atomicity.test.ts`
- `tests/e2e/reports.spec.ts`
- `tests/e2e/report-permissions.spec.ts`

### Existing files to update

- `package.json`
- `pnpm-lock.yaml`
- `.env.example`
- `README.md`
- `compose.yaml`
- `src/infrastructure/config/environment.ts`
- `src/infrastructure/database/types.ts`
- `src/infrastructure/database/bootstrap.ts`
- `src/infrastructure/composition/root.ts`
- `src/app/(protected)/layout.tsx`
- `src/components/navigation/protected-navigation.tsx`
- test database cleanup, migration counts, fixtures, and `tests/e2e/global-setup.ts`

### Files not to change

- Existing migrations `000001` through `000009`
- Fuel and dispatch business-state rules except for read-only reporting projections
- Audit chain/hash algorithms
- Authentication session or multi-factor authentication behavior
- Public static directories for export storage

---

## IMPLEMENTATION PLAN

### Phase 0: Base, dependency, and design verification

Create the branch from merged FVD-008, validate ExcelJS safely, and persist the reporting page contract.

### Phase 1: Reporting contracts and database schema

Create report definitions, period and permission policies, job lifecycle contracts, migration `000010`, and database types.

### Phase 2: Query, queue, storage, and workbook adapters

Implement bounded report projections, durable job claims, private files, safe XLSX generation, and reporting composition.

### Phase 3: Export and download workflows

Implement synchronous and queued orchestration, retries, audit evidence, short-lived links, and private streaming.

### Phase 4: API and responsive interface

Add strict Route Handlers, Server Component reporting pages, responsive results, export dialog, and recent-job actions.

### Phase 5: Security, lifecycle, accessibility, and release validation

Prove report correctness, injection safety, ownership, concurrency, cleanup, resource bounds, responsive behavior, and Docker health.

---

## STEP-BY-STEP TASKS

Execute every task in order. Each task is atomic and independently testable.

### Task 0 — VERIFY the merged base and create the FVD-009 branch

- **IMPLEMENT**: Fetch `origin` and confirm pull request #8 remains merged into `origin/main` at or after `3cb8afc`.
- **IMPLEMENT**: Confirm the working tree is clean before switching branches.
- **IMPLEMENT**: Fast-forward local `main` to `origin/main` and create `feature/provide-operational-reports-secure-excel-exports`.
- **IMPLEMENT**: Confirm migration `000009`, FVD-006 fuel files, and FVD-008 dispatch files are present.
- **GOTCHA**: Do not implement FVD-009 on the merged FVD-008 feature branch.
- **GOTCHA**: Preserve unrelated user changes if the tree is no longer clean.
- **VALIDATE**: `git status --short --branch`
- **VALIDATE**: `git log --oneline --decorate -5`
- **VALIDATE**: `test -f src/infrastructure/database/migrations/20260829_000009_create_dispatch_scheduling.ts`
- **SATISFIES**: Implementation prerequisite

### Task 1 — CREATE the reporting design override

- **CREATE**: `design-system/fuel-and-vehicle-dispatch-management-system/pages/reporting-dashboard.md`.
- **IMPLEMENT**: Document overview, detail, summary, filter, export, recent-job, and download states.
- **IMPLEMENT**: Document desktop table and mobile card behavior at 375, 768, 1024, and 1440 pixels.
- **IMPLEMENT**: Document loading, empty, filtered-empty, invalid, denied, failed, truncated, queued, running, completed, expired, and cleanup states.
- **IMPLEMENT**: Preserve the master typography, semantic colors, collapsible sidebar, dark mode, low motion, focus, and 200-percent zoom behavior.
- **IMPLEMENT**: Use compact cards and semantic tables without chart decoration.
- **GOTCHA**: Do not use the design-search output as a replacement for the persisted project design system.
- **GOTCHA**: Do not hide report data or actions only because the viewport is narrow.
- **VALIDATE**: `rg -n "Overview|Filters|queued|expired|375|768|1024|1440|200 percent|dark|focus" design-system/fuel-and-vehicle-dispatch-management-system/pages/reporting-dashboard.md`
- **SATISFIES**: AC16

### Task 2 — ADD ExcelJS through a mandatory package-security gate

- **UPDATE**: `package.json` and `pnpm-lock.yaml` with exact `exceljs@4.4.0`.
- **IMPLEMENT**: Run production dependency audit and inspect the resolved `tmp` and `uuid` graph.
- **IMPLEMENT**: Add only compatible `pnpm.overrides` that remove known vulnerable versions and retain passing write/read behavior.
- **IMPLEMENT**: Create a disposable Node 24 spike that writes more than 1,000 streamed rows, commits them, reads the workbook, and removes the file.
- **IMPLEMENT**: Remove the spike after transferring its assertions into the exporter tests.
- **GOTCHA**: An installed package is not an accepted dependency until the audit and Node 24 spike pass.
- **GOTCHA**: Do not use `pnpm audit fix --force` or accept an unofficial fork silently.
- **GOTCHA**: If a high or critical advisory remains unresolved, stop and amend this plan with a reviewed writer replacement.
- **VALIDATE**: `pnpm audit --prod`
- **VALIDATE**: `pnpm why exceljs tmp uuid`
- **VALIDATE**: `pnpm typecheck`
- **SATISFIES**: AC7, AC8, AC17, AC18

### Task 3 — CREATE report types, catalogue, periods, permissions, and DTOs

- **CREATE**: Reporting DTO, catalogue, period, permission, and port files listed under New application files.
- **IMPLEMENT**: Define all nine report discriminants and their exact status, date, permission, column, and total rules.
- **IMPLEMENT**: Resolve named periods in Asia/Manila and custom inclusive ranges.
- **IMPLEMENT**: Validate office, dates, status, cursor, and page size independently from HTTP.
- **IMPLEMENT**: Return discriminated row and totals DTOs with decimal strings.
- **IMPLEMENT**: Define job states, modes, safe failure codes, transition commands, and download contracts.
- **IMPLEMENT**: Bind opaque cursors to normalized filters and stable sort keys.
- **PATTERN**: Mirror existing fuel, dispatch, shared value-object, and application-port boundaries.
- **GOTCHA**: Do not create a loose generic `Record<string, unknown>` report result.
- **GOTCHA**: Do not calculate periods with host-local `Date` parsing.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/reporting/report-services.test.ts tests/unit/lib/reporting/page-query.test.ts`
- **VALIDATE**: `pnpm typecheck`
- **SATISFIES**: AC1 through AC6, AC14

### Task 4 — CREATE migration 000010 and update database types

- **CREATE**: `src/infrastructure/database/migrations/20260829_000010_create_reporting_and_exports.ts`.
- **CREATE**: `export_jobs` and `export_download_tokens` with accepted fields, checks, restrictive foreign keys, and named indexes.
- **IMPLEMENT**: Add fixed state, mode, report type, period type, checksum, expiry, attempts, lease, and safe failure constraints.
- **IMPLEMENT**: Grant existing `report.export` to `DISPATCH_OFFICER` and `SUPER_ADMIN` explicitly where migration conventions require it.
- **UPDATE**: `src/infrastructure/database/types.ts` with the two tables.
- **IMPLEMENT**: Delete new role grants safely during down migration, then drop tokens before jobs.
- **PATTERN**: Mirror migrations `000003`, `000005`, and `000009`.
- **GOTCHA**: Do not add another `report.export` permission row. It already exists.
- **GOTCHA**: Do not store raw download tokens or user-controlled file paths.
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/reporting/migration.test.ts`
- **VALIDATE**: `pnpm typecheck`
- **SATISFIES**: AC10, AC12 through AC15, AC17

### Task 5 — CREATE the dedicated reporting database client and bootstrap grants

- **CREATE**: `src/infrastructure/database/reporting/client.ts` and repository factory.
- **UPDATE**: Environment parsing with reporting host, port, database, user, password, pool, timeout, and production-isolation variables.
- **UPDATE**: Database bootstrap to create or update a least-privilege `fvdms_reporter` user for local development.
- **IMPLEMENT**: Grant only required `SELECT` access to reporting source tables and no export-job or audit write rights.
- **IMPLEMENT**: Keep queue and audit writes on the application connection.
- **IMPLEMENT**: Add production validation that rejects an accidental writer alias without explicit deployment exception.
- **IMPLEMENT**: Close the reporting pool during application and worker shutdown.
- **PATTERN**: Mirror the dedicated audit client and typed environment validation.
- **GOTCHA**: Local same-host MySQL is not proof of production reporting isolation.
- **GOTCHA**: Do not reuse the application writer credentials for the reporting pool.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/infrastructure/config/environment.test.ts tests/unit/infrastructure/composition/reporting.test.ts`
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/reporting/report-query-repository.test.ts`
- **SATISFIES**: AC6, AC11, AC14, AC17

### Task 6 — CREATE exact bounded report queries

- **CREATE**: `kysely-report-query-repository.ts` with one typed method per report.
- **IMPLEMENT**: Use stored entry date, liters, unit price, total amount, travel date, statuses, passenger counts, and odometer readings.
- **IMPLEMENT**: Apply the accepted status rules independently for detail and summary reports.
- **IMPLEMENT**: Group exact decimals in SQL where safe and normalize them through `DecimalValue` before application output.
- **IMPLEMENT**: Compute completed vehicle distance from stored odometer evidence only.
- **IMPLEMENT**: Group budget activity by allocation without inventing ceilings or percentages.
- **IMPLEMENT**: Preserve historical labels through safe left joins and existing deleted-record patterns.
- **IMPLEMENT**: Add stable keyset ordering, page cap, query timeout, capped estimate, and export stream methods.
- **IMPLEMENT**: Ensure export filters and count estimates use the same normalized predicate builder.
- **GOTCHA**: Do not reuse schedule occupancy for utilization because it includes draft reservations.
- **GOTCHA**: Do not use current reference values to recalculate historical fuel amounts.
- **GOTCHA**: Do not materialize all streamed rows before passing them to the exporter.
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/reporting/report-query-repository.test.ts`
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/reporting/report-use-cases.test.ts`
- **SATISFIES**: AC1 through AC6, AC11

### Task 7 — CREATE the durable export job repository and transaction

- **CREATE**: `kysely-export-job-repository.ts` and `kysely-reporting-transaction.ts`.
- **IMPLEMENT**: Create jobs, list own jobs, get own jobs, transition state, claim due work, renew lease, retry, complete, fail, expire, and consume tokens.
- **IMPLEMENT**: Claim with a short transaction and `FOR UPDATE SKIP LOCKED` over the indexed queue predicate.
- **IMPLEMENT**: Increment attempts at claim time and preserve maximum attempts.
- **IMPLEMENT**: Recover expired leases and use bounded retry delay.
- **IMPLEMENT**: Enforce allowed transitions through compare-and-set predicates and application state machine.
- **IMPLEMENT**: Insert requested, completed, failed, and download-authorized audit drafts in the same database transaction as their job transitions.
- **IMPLEMENT**: Atomically consume a token only when it is unexpired and unused.
- **GOTCHA**: Do not hold a database transaction open while generating a workbook.
- **GOTCHA**: `SKIP LOCKED` is for queue claims, not report consistency.
- **GOTCHA**: Do not retry a terminal validation, permission, row-limit, or file-limit failure.
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/reporting/export-job-repository.test.ts tests/integration/reporting/export-audit-atomicity.test.ts`
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/reporting/report-services.test.ts`
- **SATISFIES**: AC9, AC10, AC15, AC17

### Task 8 — CREATE spreadsheet text sanitization and streaming workbook generation

- **CREATE**: `spreadsheet-text-sanitizer.ts` and `exceljs-report-exporter.ts`.
- **IMPLEMENT**: Map every report definition to stable headings, widths, number formats, and totals.
- **IMPLEMENT**: Write Report and Filters worksheets with required metadata, autofilter, frozen headings, and server totals.
- **IMPLEMENT**: Stream rows and commit each row, worksheet, and workbook.
- **IMPLEMENT**: Keep shared strings disabled unless a memory test proves a stricter safe bound.
- **IMPLEMENT**: Write exact legitimate numeric measures as number cells with fixed formats after bounds checking.
- **IMPLEMENT**: Sanitize every user-controlled text value after leading whitespace and control normalization.
- **IMPLEMENT**: Protect ASCII and full-width dangerous prefixes with apostrophe plus text format.
- **IMPLEMENT**: Reject row count over 100,000, output over 50 MiB, and elapsed generation over 15 minutes.
- **IMPLEMENT**: Return row count, bytes, checksum, and safe workbook filename.
- **GOTCHA**: Do not assign ExcelJS formula objects anywhere.
- **GOTCHA**: A visual apostrophe alone is insufficient unless the round-tripped cell type remains a string.
- **GOTCHA**: Do not use workbook formulas for totals.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/infrastructure/reporting/spreadsheet-text-sanitizer.test.ts tests/unit/infrastructure/reporting/exceljs-report-exporter.test.ts`
- **SATISFIES**: AC3, AC5, AC7 through AC10, AC17

### Task 9 — CREATE private local storage and token adapters

- **CREATE**: `local-private-export-storage.ts` and `node-export-download-token-service.ts`.
- **IMPLEMENT**: Generate opaque storage keys and safe filenames on the server.
- **IMPLEMENT**: Verify configured root, resolved parents, and final paths remain contained.
- **IMPLEMENT**: Create temporary files with `0600`, stream output, close, checksum, and atomically rename.
- **IMPLEMENT**: Open completed files as Node read streams without returning the local path.
- **IMPLEMENT**: Delete temporary, rollback, failed, and expired files idempotently.
- **IMPLEMENT**: Generate random 32-byte tokens, hash with SHA-256, and compare only through indexed hashes.
- **IMPLEMENT**: Keep raw tokens out of logging and database persistence.
- **GOTCHA**: Do not use user data in storage keys or directory names.
- **GOTCHA**: Do not follow symlinks outside the configured root.
- **GOTCHA**: Deletion failure must remain observable and retryable without exposing a path to users.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/infrastructure/reporting/local-private-export-storage.test.ts tests/unit/infrastructure/reporting/node-export-download-token-service.test.ts`
- **SATISFIES**: AC8, AC12, AC13, AC17

### Task 10 — CREATE report read and export-request use cases

- **CREATE**: `get-report.ts` and `request-report-export.ts`.
- **IMPLEMENT**: Authorize report reads through the report catalogue before querying.
- **IMPLEMENT**: Normalize filters once and pass the same contract to estimates, queries, jobs, audit, and workbook metadata.
- **IMPLEMENT**: Enforce underlying read plus exact export permission before creating a job.
- **IMPLEMENT**: Reject estimates above 100,000 rows before inserting a runnable job.
- **IMPLEMENT**: Insert the job and requested audit atomically.
- **IMPLEMENT**: Run eligible small exports synchronously through the shared execution service.
- **IMPLEMENT**: Return a completed job with `201` or a queued job with `202`.
- **IMPLEMENT**: Preserve a durable failed job when a synchronous generation reaches terminal failure.
- **GOTCHA**: Do not let client input choose the permission or synchronous mode.
- **GOTCHA**: Annual exports always queue.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/reporting/report-use-cases.test.ts`
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/reporting/export-audit-atomicity.test.ts`
- **SATISFIES**: AC1, AC6, AC9 through AC11, AC14, AC15, AC17

### Task 11 — CREATE the export execution service and reporting worker

- **CREATE**: `export-job-worker.ts`, reporting composition, and worker scripts.
- **IMPLEMENT**: Claim one job, recheck requester activity and permissions, stream the report, finalize storage, and complete the job.
- **IMPLEMENT**: Use one worker, one active job, three attempts, 15-minute timeout, and a lease longer than the timeout.
- **IMPLEMENT**: Renew the lease only while generation is healthy.
- **IMPLEMENT**: Return transient failures to queued state with bounded delay.
- **IMPLEMENT**: Record terminal failure and safe audit evidence after attempts exhaust or a nonretryable failure occurs.
- **IMPLEMENT**: Delete finalized files when completion or audit transaction fails.
- **IMPLEMENT**: Run bounded cleanup for expired files, tokens, stale temporary files, and abandoned leases.
- **IMPLEMENT**: Handle termination signals and close application, reporting, and storage resources.
- **PATTERN**: Mirror the audit worker's polling, signal, composition, and shell entrypoint.
- **GOTCHA**: Do not claim the next job before the current stream and cleanup settle.
- **GOTCHA**: Do not expose stack traces in job status or audit metadata.
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/reporting/export-job-worker.test.ts tests/integration/reporting/export-audit-atomicity.test.ts`
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/reporting/report-services.test.ts tests/unit/scripts/reporting-worker.test.ts`
- **SATISFIES**: AC10 through AC12, AC14, AC15, AC17

### Task 12 — CREATE own-job, download-link, and download use cases

- **CREATE**: List, get, issue-link, and download use cases.
- **IMPLEMENT**: Return only jobs owned by the current user.
- **IMPLEMENT**: Recheck active session, report read permission, export permission, ownership, completion, and file expiry before token issuance.
- **IMPLEMENT**: Store a five-minute hashed token and return the raw token once.
- **IMPLEMENT**: During download, require the same active user and repeat ownership and permission checks.
- **IMPLEMENT**: Atomically consume the token and append `report.export.download_authorized` before opening the file stream.
- **IMPLEMENT**: Return safe content metadata and the private stream through an application result.
- **IMPLEMENT**: Map missing, foreign, consumed, expired, deleted, or unauthorized files to safe generic outcomes.
- **GOTCHA**: Do not authorize by token alone.
- **GOTCHA**: Do not permit Super Administrator cross-user downloads.
- **GOTCHA**: Audit authorization and stream initiation, not unverifiable full transfer completion.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/reporting/report-use-cases.test.ts`
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/reporting/export-job-repository.test.ts tests/integration/reporting/export-audit-atomicity.test.ts`
- **SATISFIES**: AC12 through AC15, AC17

### Task 13 — CREATE strict report and export Route Handlers

- **CREATE**: The six Route Handler files listed under New Route Handlers.
- **CREATE**: Strict route schemas and server access helpers.
- **IMPLEMENT**: Await dynamic params and parse request-time inputs according to installed Next.js 16 guidance.
- **IMPLEMENT**: Reject duplicate, unknown, oversized, malformed, unsupported, or unbounded query and JSON fields.
- **IMPLEMENT**: Require authentication and exact server-side permissions on every route.
- **IMPLEMENT**: Enforce trusted origin, JSON content type, and Cross-Site Request Forgery protection on export POST and download-link POST.
- **IMPLEMENT**: Return `201` for synchronous completion and `202` for queued work.
- **IMPLEMENT**: Stream downloads through native `Response` with safe attachment headers and no-store directives.
- **IMPLEMENT**: Keep token and storage details out of JSON errors.
- **PATTERN**: Mirror fuel, dispatch, settings, and native Response handler patterns.
- **GOTCHA**: A GET report route is read-only, but the tokenized GET download still consumes server state atomically.
- **GOTCHA**: Never accept requester ID, owner ID, job state, storage key, or filename from the client.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/app/api/reports/report-routes.test.ts tests/unit/app/api/report-exports/report-export-routes.test.ts tests/unit/lib/reporting/route-schemas.test.ts`
- **SATISFIES**: AC1, AC6, AC9, AC13, AC14, AC17

### Task 14 — CREATE the reporting Server Component page and filter contract

- **CREATE**: `/reports` page, loading, error, page-query, and server access files.
- **IMPLEMENT**: Protect the page when the principal has `fuel.read` or `dispatch.read`.
- **IMPLEMENT**: Await `searchParams`, normalize them, and render a helpful invalid-query state.
- **IMPLEMENT**: Default to Overview and fetch only report families the current principal may read.
- **IMPLEMENT**: Keep report, office, period, date, status, and cursor in native GET parameters.
- **IMPLEMENT**: Display the resolved inclusive range, generation time, data-as-of time, row count, and truncation warning.
- **IMPLEMENT**: Preserve filters across pagination and report changes where valid.
- **IMPLEMENT**: Add one permission-aware Reports link under Oversight.
- **GOTCHA**: Do not make the full page a Client Component.
- **GOTCHA**: Do not request unauthorized report families and hide them after fetching.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/lib/reporting/page-query.test.ts tests/unit/components/navigation/protected-navigation.test.ts`
- **VALIDATE**: `pnpm typecheck`
- **SATISFIES**: AC1, AC2, AC6, AC14, AC16

### Task 15 — CREATE responsive report summaries and detail results

- **CREATE**: Filter, overview, summary, fuel, dispatch, budget, and period components.
- **IMPLEMENT**: Use visible concise labels and align controls at desktop widths.
- **IMPLEMENT**: Render summary cards and semantic tables without charts.
- **IMPLEMENT**: Render detail reports as desktop tables and mobile cards.
- **IMPLEMENT**: Include status, dates, offices, vehicles, drivers, destinations, purposes, fuel measures, and odometer measures only where the report definition permits.
- **IMPLEMENT**: Present decimals with locale-aware display while preserving exact source strings.
- **IMPLEMENT**: Show loading, initial, empty, filtered-empty, invalid, denied, failure, and truncated states.
- **IMPLEMENT**: Keep color-independent status text, keyboard focus, dark mode, and reduced motion.
- **GOTCHA**: Do not imply budget percentage or remaining value.
- **GOTCHA**: Do not truncate accessible names or rely on placeholders as labels.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/components/reporting/report-components.test.ts`
- **VALIDATE**: `pnpm typecheck`
- **SATISFIES**: AC1 through AC5, AC16

### Task 16 — CREATE export, job polling, and download interface leaves

- **CREATE**: Export dialog, recent jobs, status badge, and download button.
- **IMPLEMENT**: Show export only when the exact report export permission is present.
- **IMPLEMENT**: Submit the normalized current filters with the session Cross-Site Request Forgery token.
- **IMPLEMENT**: Announce synchronous completion or queued acceptance through accessible status text.
- **IMPLEMENT**: Poll only own queued or running jobs with cancellation and hidden-tab backoff.
- **IMPLEMENT**: Stop polling on completion, failure, expiry, unmount, or permission loss.
- **IMPLEMENT**: Mint a download link only after an explicit user action, then navigate immediately to the one-time link.
- **IMPLEMENT**: Show request time, report, period, mode, status, attempts, expiry, safe failure message, and download availability.
- **IMPLEMENT**: Prevent duplicate submissions while the current request is pending.
- **GOTCHA**: Do not store raw download tokens in local storage, session storage, or component logs.
- **GOTCHA**: Do not poll completed or expired jobs indefinitely.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/components/reporting/report-components.test.ts`
- **SATISFIES**: AC9, AC10, AC13, AC14, AC16, AC17

### Task 17 — UPDATE Docker Compose, local environment, and end-to-end startup

- **UPDATE**: `compose.yaml` with a reporting worker and private named export volume.
- **UPDATE**: Application and reporting worker mounts so both access the private volume but Traefik does not.
- **UPDATE**: `.env.example`, typed environment, and README with reporting settings and defaults.
- **IMPLEMENT**: Join the existing external `dev-net` and reuse shared MySQL, Traefik, dnsmasq, and `fvdms.lan`.
- **IMPLEMENT**: Add health-aware worker startup and bounded memory/CPU limits consistent with architecture guidance.
- **UPDATE**: `tests/e2e/global-setup.ts` to start and stop the reporting worker with the application and audit worker.
- **IMPLEMENT**: Keep local reporting credentials least-privilege and generated through bootstrap.
- **GOTCHA**: Do not add a second MySQL container or new reverse proxy.
- **GOTCHA**: Do not mount private exports into a host-public or static directory.
- **VALIDATE**: `docker compose config --quiet`
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/infrastructure/config/environment.test.ts tests/unit/scripts/reporting-worker.test.ts`
- **SATISFIES**: AC10 through AC12, AC17

### Task 18 — ADD correctness, security, lifecycle, and concurrency integration coverage

- **UPDATE**: Migration count, rollback depth, cleanup order, role permissions, and database fixtures.
- **IMPLEMENT**: Prove all nine reports, office filters, named periods, custom ranges, status rules, historical values, exact totals, stable ordering, and cursor binding.
- **IMPLEMENT**: Prove synchronous boundary at 1,000, annual always queued, row cap, file cap, timeout, three attempts, lease recovery, and terminal failure.
- **IMPLEMENT**: Race multiple worker claims and prove one worker owns a job.
- **IMPLEMENT**: Prove completion-audit rollback removes the finalized file and does not publish a completed job.
- **IMPLEMENT**: Prove disabled or deauthorized requesters cannot run queued work or download completed work.
- **IMPLEMENT**: Prove ownership blocks cross-user list, detail, token, and download access, including Super Administrator attempts.
- **IMPLEMENT**: Prove one-time token consumption, five-minute expiry, file expiry, checksum, cleanup, and missing-file behavior.
- **IMPLEMENT**: Prove formula strings, leading controls, full-width variants, and workbook round-trip cell types.
- **GOTCHA**: A sequential queue test does not prove `SKIP LOCKED` behavior.
- **GOTCHA**: Tests must clean token rows, job rows, files, and leases without touching unrelated user data.
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/reporting`
- **SATISFIES**: AC1 through AC15, AC17

### Task 19 — ADD route, end-to-end, responsive, and accessibility coverage

- **UPDATE**: Deterministic principals with accepted read and export permission combinations.
- **CREATE**: Reports and report-permissions Playwright suites.
- **IMPLEMENT**: Cover Overview, every report type, office filter, each period, custom dates, status filters, pagination, empty, invalid, failed, and truncated states.
- **IMPLEMENT**: Cover synchronous completion, queued lifecycle, polling, failure, expiry, link minting, one-time download, and permission loss.
- **IMPLEMENT**: Cover direct API bypass, altered report type, altered office, unknown fields, duplicate parameters, foreign job IDs, raw-token replay, missing Cross-Site Request Forgery token, and unauthenticated requests.
- **IMPLEMENT**: Cover PSMD Staff, Dispatch Officer, Budget Officer, Viewer, Auditor, System Administrator, and Super Administrator expectations.
- **IMPLEMENT**: Cover keyboard-only filters and dialog, focus return, live regions, Axe, dark mode, reduced motion, 200-percent zoom, and widths 375/768/1024/1440.
- **IMPLEMENT**: Verify the Reports sidebar item remains grouped, permission-aware, active, and usable with desktop collapse and mobile drawer.
- **IMPLEMENT**: Use deterministic fixtures. Do not create or enter one-time administrator credentials.
- **VALIDATE**: `pnpm exec playwright test --project=chromium tests/e2e/reports.spec.ts tests/e2e/report-permissions.spec.ts tests/e2e/protected-navigation.spec.ts tests/e2e/accessibility.spec.ts`
- **SATISFIES**: AC1 through AC18

### Task 20 — UPDATE documentation and run the complete release gate

- **UPDATE**: README with report meanings, status rules, permissions, endpoints, worker, thresholds, storage, retention, formula protection, and local commands.
- **UPDATE**: Any Product Requirements Document implementation status or design note that still says reporting is absent, without rewriting accepted requirements.
- **IMPLEMENT**: Document local same-host reporting and the FVD-011 production replica requirement.
- **IMPLEMENT**: Document operational recovery for failed jobs, expired leases, missing files, cleanup failure, and package advisories.
- **VERIFY**: Run formatting, lint, type checking, coverage, MySQL integration, Chromium end-to-end, production build, migration, Docker, and HTTPS smoke checks.
- **VERIFY**: Exercise one small fuel export, one queued annual export, one authorized download, one replay rejection, and one cleanup cycle with deterministic test principals.
- **VERIFY**: Confirm request, completion, terminal failure, and download authorization appear in audit evidence.
- **GOTCHA**: Browser cookies can create redirect loops even when Docker, Domain Name System, Traefik, and MySQL are healthy.
- **GOTCHA**: Do not use a real initial-admin one-time password for automated verification.
- **VALIDATE**: `pnpm format:check`
- **VALIDATE**: `pnpm lint`
- **VALIDATE**: `pnpm typecheck`
- **VALIDATE**: `pnpm test:coverage`
- **VALIDATE**: `pnpm test:integration`
- **VALIDATE**: `pnpm exec playwright test --project=chromium`
- **VALIDATE**: `pnpm build`
- **VALIDATE**: `pnpm validate`
- **VALIDATE**: `git diff --check`
- **VALIDATE**: `pnpm db:migrate`
- **VALIDATE**: `pnpm db:status`
- **VALIDATE**: `pnpm dev:up`
- **VALIDATE**: `docker compose ps`
- **VALIDATE**: `curl -k -I https://fvdms.lan/reports`
- **SATISFIES**: AC18 and release readiness

---

## TESTING STRATEGY

### Unit tests

- Report catalogue maps every type to exact read, export, status, date, columns, and totals behavior.
- Period policy resolves week, month, quarter, annual, custom, leap-year, year-boundary, and Asia/Manila dates.
- Page and route schemas reject duplicates, unknown fields, malformed dates, inverted ranges, unsupported status, invalid cursor, and oversized page size.
- Permission policy proves all accepted role and permission combinations without relying on UI visibility.
- Job state machine accepts only legal transitions and classifies retryable versus terminal failure.
- Export request proves synchronous and queued thresholds, annual behavior, row cap, and audit drafts.
- Spreadsheet sanitizer covers ASCII prefixes, whitespace, control characters, full-width variants, normal text, legitimate numeric values, and empty values.
- Excel exporter round-trips headings, filters, metadata, numeric types, text types, totals, frozen rows, and autofilter.
- Private storage covers containment, symlink rejection, mode, temp cleanup, atomic rename, checksum, size cap, and idempotent deletion.
- Token service proves entropy length, hashing, raw-token non-persistence, expiry, and safe comparison.
- Components cover every visual state and permission-gated action.

### MySQL integration tests

- Migration creates exact tables, checks, indexes, foreign keys, existing permission grant, and reversible down/up behavior.
- Read-only reporting credentials can query required source tables but cannot mutate business, job, token, or audit tables.
- Each report proves exact filters, status rules, grouping, stored values, historical labels, totals, stable sort, and cursor behavior.
- Export estimates use the same predicates as export streams.
- Queue claims prove `SKIP LOCKED`, lease ownership, attempt increments, retry delay, recovery, and compare-and-set transitions.
- Audit and job transitions roll back atomically.
- Completion failure deletes finalized files.
- Token consumption and download audit are atomic.
- Retention cleanup handles files, tokens, jobs, missing files, and retryable deletion failures.

### Route tests

- Authentication and exact read/export permissions are required.
- Strict GET and JSON schemas reject ambiguous or malicious input.
- State-changing POST routes enforce trusted origin, JSON content type, and Cross-Site Request Forgery protection.
- Export response status distinguishes synchronous completion from queued work.
- Own-job routes do not disclose foreign existence.
- Download response uses correct content type, disposition, no-store, and nosniff headers.
- Token replay, expiry, ownership, permission loss, disabled user, deleted file, and malformed job ID fail safely.

### End-to-end tests

- Every authorized report is discoverable and filterable through native URLs.
- The overview hides unauthorized families and never flashes restricted data.
- Small and annual exports show their correct lifecycle.
- Recent jobs update without unbounded polling.
- One-time download succeeds once and replay fails.
- Viewers remain read-only.
- Reports remain usable with the collapsible desktop sidebar and mobile drawer.
- Tables switch to complete mobile cards without losing required data or actions.
- Keyboard, focus, live regions, Axe, dark mode, reduced motion, zoom, and supported widths pass.

### Performance and resource tests

- Measure worker memory while generating near 100,000 rows and prove memory remains bounded.
- Prove writer row commitment and MySQL streaming do not retain the full dataset.
- Prove query, generation, file size, retry, worker concurrency, and polling limits.
- Prove cancellation releases the MySQL stream and removes temporary files.
- Record representative small synchronous and large queued durations without setting brittle timing assertions.

---

## VALIDATION COMMANDS

### Focused unit and component validation

```bash
pnpm exec vitest run \
  tests/unit/application/reporting \
  tests/unit/infrastructure/reporting \
  tests/unit/lib/reporting \
  tests/unit/app/api/reports \
  tests/unit/app/api/report-exports \
  tests/unit/components/reporting \
  --config vitest.config.ts
```

### Focused MySQL validation

```bash
pnpm exec vitest run tests/integration/reporting --config vitest.integration.config.ts
```

### Focused browser validation

```bash
pnpm exec playwright test \
  tests/e2e/reports.spec.ts \
  tests/e2e/report-permissions.spec.ts \
  tests/e2e/protected-navigation.spec.ts \
  --project=chromium
```

### Dependency and package validation

```bash
pnpm audit --prod
pnpm why exceljs tmp uuid
```

### Standard project gate

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm test:integration
pnpm exec playwright test --project=chromium
pnpm build
pnpm validate
git diff --check
```

### Docker and local HTTPS gate

```bash
pnpm db:migrate
pnpm db:status
pnpm dev:up
docker compose ps
curl -k -I https://fvdms.lan/reports
```

---

## ACCEPTANCE CRITERIA CHECKLIST

- [ ] AC1 Report filters work for office, supported period, and inclusive dates.
- [ ] AC2 Both detail reports and all seven summaries are present.
- [ ] AC3 Historical reports use stored authoritative facts.
- [ ] AC4 Detail and summary status rules match the accepted contract.
- [ ] AC5 Decimal totals and Asia/Manila buckets are exact.
- [ ] AC6 Report reads enforce strict pagination and resource bounds.
- [ ] AC7 Workbooks contain all required headings and metadata.
- [ ] AC8 Formula-injection defenses pass round-trip tests.
- [ ] AC9 Small non-annual exports complete synchronously through durable jobs.
- [ ] AC10 Annual and large exports use the durable bounded worker.
- [ ] AC11 Report reads use the dedicated reporting adapter.
- [ ] AC12 Files remain private, bounded, checksummed, and retained for seven days.
- [ ] AC13 Download tokens are requester-bound, five-minute, and one-time.
- [ ] AC14 Exact read and export permissions are enforced throughout the lifecycle.
- [ ] AC15 All four required audit actions create safe immutable evidence.
- [ ] AC16 The dashboard is responsive, accessible, and complete across states.
- [ ] AC17 Failures leave consistent database and file state.
- [ ] AC18 The complete validation and Docker gates pass.

## COMPLETION CHECKLIST

- [ ] Branch starts from current `origin/main` containing merged FVD-008.
- [ ] Migration `000010` is ordered, reversible, and fully tested.
- [ ] ExcelJS dependency security and Node 24 gates pass.
- [ ] All nine report definitions share one authoritative catalogue.
- [ ] Report queries use exact persisted data and bounded reporting reads.
- [ ] Synchronous and queued exports share one durable job lifecycle.
- [ ] Worker retries, timeouts, leases, and cleanup are bounded.
- [ ] Private files never enter a public directory.
- [ ] Download tokens are hashed, current-session-bound, and one-time.
- [ ] User-controlled workbook cells cannot execute formulas.
- [ ] Every job and download action enforces ownership and permissions.
- [ ] Audit evidence is atomic with job transitions.
- [ ] Reports UI follows the page design override and existing master system.
- [ ] Unit, integration, route, browser, accessibility, build, and Docker checks pass.
- [ ] README documents operations, recovery, retention, and FVD-011 production requirements.

## OPEN QUESTIONS / ASSUMPTIONS

No critical product questions remain. The accepted defaults resolve report meanings, permissions, job architecture, download reauthorization, thresholds, retries, retention, and time zone.

Implementation assumptions:

- Pull request #8 remains the latest merged prerequisite when implementation begins.
- FVD-011 will provide the production reporting replica or snapshot without changing the `ReportQueryRepository` contract.
- ExcelJS remains acceptable only if Task 2 clears the current dependency-security and Node 24 gates.
- Existing Local Government Unit-wide permission behavior remains intentional until a separate office-scoping ticket changes it.
- Export job metadata may remain after file expiry for audit and user history. File retention is seven days.
- A later retention policy may archive or delete old job metadata after preserving required audit evidence.

## NOTES (open canvas)

### Critical security invariants

- A raw download token is never stored.
- A token without an active authorized owner session is useless.
- A valid token is consumed once.
- A completed job without current permission is not downloadable.
- A file path never crosses the application boundary.
- A user-controlled string never becomes an XLSX formula.
- A worker does not trust authorization captured at request time.

### Critical data invariants

- Fuel summaries use posted records only.
- Fuel detail preserves posted and voided evidence.
- Dispatch summaries use dispatched and completed records.
- Vehicle utilization uses completed distance only.
- Historical amount comes from stored unit price and total amount.
- Budget activity is actual issued liters and amount, not a percentage.
- All money and quantity totals use decimal arithmetic.

### Critical operations invariants

- One worker processes one job at a time initially.
- Jobs have at most three attempts and 15 minutes per attempt.
- Annual reports never run inside the request.
- No export exceeds 100,000 rows or 50 MiB.
- Completed files expire after seven days.
- Local same-host reporting is not accepted as production isolation.
- Production reporting remains blocked on FVD-011 infrastructure.

### Plan confidence

**Confidence**: 8.8/10

The report catalogue, permissions, lifecycle, storage, audit, and interface decisions are fully specified against implemented seams.

The remaining uncertainty is limited to ExcelJS dependency remediation on Node 24 and production reporting infrastructure owned by FVD-011. Task 2 and the production configuration guard make both risks explicit before implementation can progress incorrectly.

## AMENDMENTS

None at plan creation.
