# Implementation Report — Provide Operational Reports and Secure Excel Exports

**Plan**: `.claude/plans/provide-operational-reports-and-secure-excel-exports.md`

**Ticket**: `FVD-009`

**Branch**: `feature/provide-operational-reports-secure-excel-exports`

**Status**: COMPLETE

## Summary

Delivered nine permission-aware operational reports for fuel, dispatch, vehicle utilization, and budget-allocation activity. Every report uses normalized filters, exact stored facts, decimal-safe totals, Asia/Manila calendar periods, stable cursor pagination, and bounded query execution.

Authorized users can create private XLSX exports through one durable job lifecycle. Small non-annual exports complete synchronously. Annual and larger exports run through a dedicated reporting worker with leases, retries, timeouts, row and file limits, retention cleanup, and safe failure evidence.

Downloads require a fresh ownership and permission check. The application issues a five-minute one-time token, stores only its SHA-256 hash, and never exposes an internal storage key or public file path.

The `/reports` interface follows the established FVDMS design system. It remains usable across desktop, mobile, keyboard, reduced-motion, theme, zoom, empty, denied, invalid, loading, and failure states.

## Tasks completed

- Verified the merged FVD-008 base and created the accepted FVD-009 feature branch.
- Added the reporting page design contract and reused the existing visual tokens and component patterns.
- Added ExcelJS 4.4.0 with remediated transitive versions and a clean production dependency audit.
- Added the shared report catalogue, period resolver, authorization policy, filters, cursors, rows, totals, and public data transfer objects.
- Added reversible migration 000010 for durable export jobs, one-time download tokens, queue indexes, and the Dispatch Officer export grant.
- Added dedicated reporting database configuration, a bounded Kysely client, read-only local grants, and production writer-alias safeguards.
- Added exact bounded query projections for both detail reports and all seven summaries.
- Added durable queue claiming with transactional leases, bounded retry backoff, maximum attempts, abandoned-job recovery, and idempotent completion.
- Added spreadsheet text protection and an ExcelJS streaming writer with metadata, filters, fixed headings, frozen rows, numeric formats, and server-calculated totals.
- Added private filesystem storage with path containment, restrictive file modes, temporary files, atomic publication, checksums, size limits, and retention cleanup.
- Added report reads, export requests, synchronous execution, queued execution, job inspection, download-link issuance, and one-time download use cases.
- Added a dedicated reporting worker that claims one job at a time and rechecks the requester and permissions before generation.
- Added strict authenticated report, export-job, download-link, and download Route Handlers.
- Added the reports Server Component, native URL filters, report summaries, responsive detail results, export dialog, recent jobs, polling, and download actions.
- Added the Reports destination under the permission-aware Oversight navigation group.
- Added the reporting worker, shared private volume, resource limits, environment variables, startup wiring, and logs to the existing Docker stack.
- Updated integration cleanup and migration rollback fixtures for the restrictive reporting foreign keys.
- Documented report meanings, permissions, endpoints, thresholds, file safety, retention, recovery, worker operations, and the FVD-011 production isolation requirement.

## Tests added

- Application tests cover all report definitions, periods, status rules, normalized filters, permissions, ownership, export thresholds, token expiry, retries, and audit events.
- Query tests cover all nine report outputs, exact totals, historical labels, stable pagination, cursor binding, and row estimation.
- Workbook tests cover all nine row shapes, totals, metadata, formula protection, streaming behavior, row limits, and file limits.
- Storage and download tests cover containment, restrictive permissions, atomic publication, checksums, expiry, ownership, current permissions, one-time use, and replay rejection.
- MySQL tests cover migration reversal, read-only reporting grants, source-table reads, denied writes, denied queue reads, job claims, leases, abandoned work, exhausted attempts, and immutable failure evidence.
- Route tests cover strict schemas, duplicate and unknown parameters, bounded pagination, Cross-Site Request Forgery protection, safe public job data, and exact authorization.
- Browser tests cover report-family permissions, responsive results, synchronous fuel export, annual queued export, private download, replay rejection, and audit evidence.
- Navigation and accessibility tests cover desktop, collapsed, mobile, keyboard, zoom, themes, reduced motion, and automated Web Content Accessibility Guidelines checks.

## Validation results

- Formatting, ESLint, and TypeScript — PASS.
- Combined coverage — PASS, 923 checks across 187 files.
- Coverage — 88.00 percent statements, 80.31 percent branches, 93.14 percent functions, and 90.75 percent lines.
- MySQL integration — PASS, 153 checks across 39 files.
- Chromium and axe — PASS, 66 journeys.
- Next.js production build — PASS with the reports page and all reporting APIs server-rendered.
- Production dependency audit — PASS with no known vulnerabilities.
- Docker Compose configuration — PASS.
- Database status — migrations 000001 through 000010 applied.
- Docker application, audit worker, and reporting worker — running. The reporting worker emitted its startup event.
- `https://fvdms.lan/api/health` — HTTP 200.
- `https://fvdms.lan/reports` — reachable and redirects unauthenticated requests to sign-in.

## Deviations from the plan

- The reporting repository uses a bounded paged asynchronous row stream. This preserves constant application memory without depending on a driver-specific stream implementation.
- A Kysely plugin adds MySQL `MAX_EXECUTION_TIME` hints to reporting reads. This enforces the configured database query limit in addition to application timeouts.
- Production startup also rejects matching reporting and writer host, port, and database values unless the explicit writer-alias exception is enabled. This strengthens the accepted FVD-011 boundary.
- Recent export jobs remount after a router refresh when job identifiers or states change. This prevents stale empty or queued states after synchronous completion.

## Issues encountered

- Existing integration cleanup removed users before the new export ownership rows. Reporting rows are now deleted first in every affected fixture.
- Adding migration 000010 changed older rollback-test depth assumptions. Those tests now isolate their intended migration boundary.
- The first reports refresh retained stale client state. The page now keys the recent-job component from the authoritative server result.
- Initial coverage missed several reporting permission and workbook branches. Focused tests raised the complete project suite above every configured threshold.
- The host shell uses Node.js 26 and reports an engine warning. Docker and the project contract use Node.js 24.19.0.

## Deferred production work

- FVD-011 must provide the production reporting replica or scheduled snapshot.
- FVD-011 must also provide production private storage and deployment monitoring.
- Scheduled reports, email delivery, charts, ad hoc builders, and additional export formats remain outside FVD-009.

## Skipped items

- The persistent local database was not populated with retained user credentials for a manual authenticated export. Equivalent authorization, synchronous export, queued worker, download, replay, audit, accessibility, and responsive flows passed against the disposable real-stack browser environment.
