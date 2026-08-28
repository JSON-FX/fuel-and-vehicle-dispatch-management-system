# Implementation Report — Manage Budget Allocations and Fiscal Eligibility

**Plan**: `.claude/plans/manage-budget-allocations-fiscal-eligibility.md`

**Ticket**: `FVD-005`

**Branch**: `feature/manage-budget-allocations-fiscal-eligibility`

**Status**: COMPLETE

## Summary

Delivered the budget allocation module from domain rules through the administration interface. Budget Officers can create quarterly draft allocations, activate or terminate them, soft-delete records with a reason, and restore historical records safely.

Added Manila-time fiscal eligibility, database-enforced allocation identity, opaque cursor pagination, and permission-aware operational selectors. An allocation is operational only when it is active, belongs to the current fiscal period, and references a current active office.

Built server-rendered list and detail pages with focused client form and transition components. UI Ux Pro Max and UI Styling guidance informed the responsive layout, semantic lifecycle treatment, accessible targets, keyboard behavior, reduced motion, and token-driven shadcn interface.

Reused the existing Docker environment without changing Compose. The application remains available through Traefik at `https://fvdms.lan` on `dev-net`, with the shared MySQL service and dnsmasq-backed `.lan` resolution.

Also delivered the requested global privileged MFA setting. It is database-backed and disabled by default. Authorized administrators can enable it from `/admin/security`. Enabling it revokes active privileged sessions, while disabling it preserves existing authenticator factors.

## Tasks completed

- Added budget allocation value objects, lifecycle status, entity behavior, and Manila fiscal-period policy under `src/domain/budget`.
- Added DTOs, repository and transaction ports, permission policy, audit builders, shared support, and lifecycle use cases under `src/application/budget`.
- Added migration 000005 with allocation identity, lifecycle checks, soft-delete evidence, indexes, and budget permissions.
- Added a Kysely repository, opaque cursor codec, transaction adapter, and budget composition module.
- Added current and historical reads plus a bounded operational selector for downstream workflows.
- Added protected collection, item, soft-delete, and restore Route Handlers with strict schemas and field-level error mapping.
- Added permission-filtered navigation and server-rendered list and detail pages.
- Added create, edit, lifecycle transition, delete, restore, filter, results, and status components.
- Added loading, error, empty, filtered-empty, historical, read-only, denied, conflict, and request-failure states.
- Added the page design contract at `design-system/fuel-and-vehicle-dispatch-management-system/pages/budget-allocation-management.md`.
- Updated the README with routes, permissions, lifecycle rules, operational eligibility, and validation guidance.
- Fixed stale invalid-session cookies so `fvdms.lan` reaches the sign-in page instead of looping between protected and login routes.
- Added migration 000006, the `auth.settings.manage` permission, authentication settings use cases, a protected API, and the global Security settings page.
- Made privileged password-only sign-in the default while preserving TOTP enrollment, verification, reset, encryption, and replay protection when MFA is enabled.

## Accepted defaults implemented

- New allocations start in `DRAFT`.
- Allocation identity fields can change only while the record remains a draft.
- Draft allocations can become active or cancelled.
- Active allocations can become closed or cancelled.
- Closed and cancelled allocations are terminal.
- Cancellation and deletion reasons must contain between 10 and 500 characters.
- Restoring an active record returns it to draft. Other restored records keep their previous status.
- PPMP references are normalized before uniqueness checks.
- Fiscal years range from 2000 through 9999. Quarters range from one through four.
- Fiscal eligibility uses the effective date in the Asia/Manila time zone.
- Budget records do not carry a monetary amount in this slice.
- `budget.manage` implies read access. Accepted read-only roles receive `budget.read`.
- APIs and pages expose public identifiers rather than database keys.
- Global MFA is disabled by default and can be managed by `SUPER_ADMIN` and `SYSTEM_ADMIN` users.
- Enabling global MFA revokes active privileged sessions and records immutable audit evidence.

## Tests added

- Domain tests cover normalization, fiscal limits, Manila period boundaries, lifecycle transitions, safe restoration, and operational eligibility.
- Application tests cover permissions, transaction boundaries, audit actions, duplicate handling, no-op updates, and failures.
- Route tests cover authentication, authorization, Cross-Site Request Forgery protection, validation, conflicts, lifecycle mapping, deletion, and restoration.
- MySQL tests cover migration up/down/up, repository behavior, uniqueness, history, cursors, fiscal selectors, audit atomicity, and rollback.
- Browser tests cover read-only roles, management permissions, denied roles, the full lifecycle, duplicate recovery, audit visibility, operational selectors, accessibility, responsive layouts, themes, reduced motion, zoom, and keyboard use.
- Proxy tests cover stale invalid-session cookie removal and the redirect-loop regression.
- Authentication settings tests cover permission checks, the disabled default, audited changes, privileged session revocation, password-only sign-in, and retained TOTP enrollment and verification flows.

## Validation results

- `pnpm validate` — PASS from the final tree.
- Formatting, ESLint, and TypeScript — PASS.
- Combined coverage — PASS, 581 checks across 124 files.
- Coverage — 89.48 percent statements, 80.26 percent branches, 93.56 percent functions, and 91.78 percent lines.
- MySQL integration — PASS, 94 checks across 21 files.
- Chromium and axe — PASS, 33 journeys.
- Next.js production build — PASS with all budget pages and APIs server-rendered as required.
- `git diff --check` — PASS.
- Docker application — healthy at `https://fvdms.lan` with database status `available`.
- Docker audit worker — running.
- Database status — migrations 000001 through 000006 applied.
- `pnpm audit:verify:container` — PASS after checking 17 records through sequence 17.

## Deviations from the plan

- Database migration status uses the project's `database-tools` service. The application container intentionally lacks migration credentials under the least-privilege Docker setup.
- A stale local browser session exposed an invalid-session redirect loop. The authentication boundary now redirects with an explicit marker, and the proxy clears the stale secure cookie before rendering login.
- Form field identifiers now include their surface context. This prevents a filter and an open dialog from creating duplicate document identifiers.
- Successful lifecycle actions disable sibling controls until the refreshed server state remounts the action group. This prevents concurrent transitions with a rotated session token.

## Issues encountered

- Existing migration tests assumed migration 000004 was latest. Their assertions now account for budget migration 000005 and authentication settings migration 000006.
- Duplicate fiscal-year and quarter identifiers caused labels to target filter controls instead of the create dialog. A component regression test now requires unique identifiers.
- Lifecycle buttons could remain interactive during a router refresh. Rapid sequential actions could use a stale Cross-Site Request Forgery token.
- The local Firefox session contained an expired application cookie. The resulting redirect loop initially made `fvdms.lan` appear unavailable.
- The host runs Node.js 26 and reports an engine warning. Docker and the project contract use Node.js 24.

## Deferred production work

- FVD-006 through FVD-008 will consume eligible allocations in fuel issuance, dispatch, and reporting workflows.
- Allocation amounts, obligation accounting, amendments, transfers, and bulk import remain outside FVD-005.
- Production infrastructure, backup, retention, and disaster-recovery controls remain assigned to later deployment tickets.

## Skipped items

- The persistent local browser session was not used for authenticated budget mutations because its saved session had expired and no credentials were retained. Equivalent mutation, permission, audit, responsive, and accessibility coverage passed through the disposable real-stack Playwright environment.
