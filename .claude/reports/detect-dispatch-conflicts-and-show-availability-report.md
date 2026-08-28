# Implementation Report — Detect Dispatch Conflicts and Show Availability

**Plan**: `.claude/plans/detect-dispatch-conflicts-and-show-availability.md`

**Ticket**: `FVD-008`

**Branch**: `feature/detect-dispatch-conflicts-show-availability`

**Status**: COMPLETE

## Summary

Delivered server-authoritative same-day driver and vehicle conflict detection across dispatch creation, draft updates, and dispatch transitions. The implementation supports global `BLOCK` and `WARN_AND_ACK` policies, exact override permission checks, stable conflict fingerprints, immutable acknowledgment evidence, and atomic audit capture.

Authorized users can now inspect day, week, and month schedules. Dispatch forms provide advisory availability without weakening the final transactional check. Administrators can manage the global policy through a protected settings page.

The two user annotations were included in the accepted plan and implementation. The dispatch filter now uses the concise `Search dispatches` label, preserves the searchable scope in its placeholder, and aligns with the neighboring desktop controls. Responsive result cards and stacked header actions prevent horizontal overflow at 200 percent zoom.

## Tasks completed

- Added scheduling policies, conflict types, normalized override reasons, reservation rules, conflict fingerprints, and safe conflict response contracts.
- Added migration 000009 with the global policy singleton, append-only override records, query indexes, restrictive foreign keys, two permissions, and initial role grants.
- Added Kysely repositories for schedule reads, current locking conflict reads, settings, and immutable override evidence.
- Extended dispatch transactions with the fixed office, driver, vehicle, and dispatch lock order plus retry-safe deadlock handling.
- Integrated final conflict recomputation into create, draft update, and dispatch transition transactions.
- Added exact authorization for conflict overrides and schedule settings, including durable authorization-denial evidence.
- Added bounded schedule and availability use cases for dispatches, drivers, and vehicles.
- Added strict authenticated APIs for conflicts, schedules, resource schedules, and global settings.
- Added `/dispatches/schedule` with day, week, month, agenda, filters, resource availability, truncation, loading, error, denied, invalid, and empty states.
- Added advisory form guidance with stale-request cancellation and polite announcements.
- Added a conflict review dialog with policy-specific states, fingerprint refresh handling, review confirmation, and reason validation.
- Added the protected `/admin/dispatch-settings` page and Administration sidebar destination.
- Added read-only conflict acknowledgment history to dispatch details.
- Updated the dispatch design contract, added the settings design contract, and documented the feature in the README.
- Updated shared integration cleanup order for the new restrictive scheduling foreign keys.
- Made the pinned Corepack package available to the non-root Docker runtime user, removing one-shot migration downloads.

## Tests added

- Domain tests cover policies, statuses, conflict types, reason normalization, and reservation behavior.
- Application tests cover policy outcomes, exact permissions, stale fingerprints, reused evidence, empty-conflict rejection, schedule queries, and audit payloads.
- Route tests cover strict schemas, bounded dates, duplicate and unknown parameters, Cross-Site Request Forgery protection, safe conflict contexts, and exact authorization.
- MySQL tests cover migration reversal, repositories, status rules, self-exclusion, independent occupancy, transaction rollback, and concurrent resource serialization.
- Browser tests cover advisory conflicts, protected resubmission, immutable history, schedule views, global settings, permission denial, policy confirmation, and settings reset.
- Accessibility tests cover the concise filter label, desktop input alignment, responsive schedules, keyboard states, zoom, overflow, themes, and automated Web Content Accessibility Guidelines checks.
- Docker dependency tests cover the shared Corepack cache and existing named-volume recovery behavior.

## Validation results

- Formatting, ESLint, and TypeScript — PASS.
- Combined coverage — PASS, 838 checks across 168 files.
- Coverage — 88.97 percent statements, 80.92 percent branches, 94.45 percent functions, and 91.70 percent lines.
- MySQL integration — PASS, 132 checks across 34 files.
- Chromium and axe — PASS, 57 journeys.
- Next.js production build — PASS with all new pages and APIs server-rendered as required.
- Docker application and audit worker — healthy.
- Database status — migrations 000001 through 000009 applied.
- `https://fvdms.lan/dispatches/schedule` — reachable and redirects unauthenticated requests to sign-in.

## Deviations from the plan

- The dispatch results table remains in responsive card form until the large breakpoint. This prevents horizontal overflow at 200 percent zoom while preserving the full desktop table.
- The two dispatch header actions stack until the large breakpoint. This keeps the page header usable under browser zoom.
- Docker verification exposed a Corepack cache ownership defect. The Dockerfile now shares the pinned pnpm cache with the runtime user, so tool containers do not download pnpm during startup.

## Issues encountered

- Older integration cleanup deleted dispatches before new override evidence. Every affected reset now deletes override rows first and clears the settings actor before deleting users.
- The first zoom fix removed the wide results table but left the header actions overflowing. The final layout also stacks those actions until enough width exists.
- Late browser tests found privileged sessions left active by earlier journeys. Those journeys now sign out explicitly, and the complete 57-test sequence passes.
- Running TypeScript while a Next.js build updates generated route types can create a transient race. Final TypeScript and build checks ran sequentially.
- The host shell uses Node.js 26 and reports an engine warning. Docker and the project contract use Node.js 24.

## Deferred production work

- Time-of-day and interval overlap scheduling remain outside FVD-008.
- Maintenance windows, leave, holidays, recurring schedules, and route-duration estimates remain deferred.
- Offline conflict handling remains assigned to FVD-010 and must reuse the same authoritative resolver.
- Utilization reporting and exports remain assigned to FVD-009.

## Skipped items

- The full mutation workflow was not repeated with retained credentials against the persistent `fvdms.lan` database. Equivalent authenticated lifecycle, permission, concurrency, audit, accessibility, and responsive coverage passed through the disposable real-stack Playwright environment.
