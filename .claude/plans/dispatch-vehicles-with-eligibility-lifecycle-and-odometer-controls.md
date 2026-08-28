# Feature: Dispatch vehicles with eligibility, lifecycle, and odometer controls

The following plan is complete for FVD-007. Validate the documented prerequisites and current branch before implementation because the repository history contains a migration-order dependency described below.

Use the established domain, transaction, audit, authorization, design-system, and testing seams. Extend existing abstractions where noted instead of creating parallel implementations.

## Feature Description

FVD-007 delivers the base vehicle-dispatch workflow. Authorized dispatch staff can prepare a draft, edit its operational details, mark it dispatched, complete it with a final odometer reading, or cancel it with a recorded reason.

The workflow admits only current active drivers, current serviceable vehicles, and current active offices. Eligibility is validated when a draft is created or edited, then revalidated immediately before dispatch. A later master-data status change does not prevent completion or cancellation of an already dispatched historical trip.

The `VehicleDispatch` aggregate owns the lifecycle and odometer invariants. Persistence uses opaque public identifiers, exact decimal strings, restrictive master-data foreign keys, transaction-scoped repositories, and durable audit capture.

The interface adds a responsive Dispatch area to the existing collapsible sidebar. It follows the saved FVDMS design system, uses server-rendered pages with focused client leaves, and presents lifecycle actions through accessible confirmation forms.

## User Story

As authorized dispatch staff
I want to prepare and manage a vehicle dispatch through its complete lifecycle
So that trips use eligible drivers and vehicles while preserving reliable odometer and audit history

## Problem Statement

The system manages offices, drivers, and vehicles, but it cannot yet record operational trips. Staff need one governed workflow that prevents invalid assignments, unsafe lifecycle changes, and unreliable odometer history.

Without an aggregate and transaction boundary, clients could assign inactive drivers, dispatch unserviceable vehicles, bypass terminal-state rules, or persist completion without its audit evidence. The resulting record would not be suitable for later conflict detection, reporting, or operational review.

## Solution Statement

Create a dedicated dispatch domain, application, infrastructure, API, and UI module. A `VehicleDispatch` aggregate will own draft-only editing, the accepted state graph, nonnegative odometers, final-reading comparison, derived distance, and terminal immutability.

Use a dispatch-specific transaction that exposes the dispatch, driver, vehicle, office, and audit repositories. Every mutation will lock the dispatch or required master-data rows, recheck authorization and eligibility, persist one business change, and append one allowlisted audit event before commit.

Persist dispatches in a normalized MySQL table. Store master-data references rather than copied labels, then resolve soft-deleted references through historical joins. Reserve nullable travel interval columns for FVD-008, but defer all conflict behavior and override persistence.

Expose strict Route Handlers for collection, detail, draft update, dispatch, completion, cancellation, and preparation options. Build responsive list, create, and detail pages using the established sidebar and semantic design tokens.

## Out of Scope / Non-Goals

- Not included: driver or vehicle schedule-conflict detection, overlap queries, double-booking policy, or final conflict rechecks.
- Not included: `BLOCK` or `WARN_AND_ACK` behavior, override permissions, acknowledgements, reasons, or override records.
- Not included: schedule, conflict, driver-calendar, vehicle-calendar, day, week, or month availability interfaces. FVD-008 owns them.
- Not included: cross-dispatch odometer monotonicity or updating a vehicle's master odometer. FVD-007 compares readings only within one dispatch.
- Not included: offline drafts, synchronization queues, replay, or merge handling. FVD-010 owns offline behavior.
- Not included: reports, exports, utilization dashboards, or background jobs. FVD-009 owns reporting.
- Not included: fuel-issuance linkage, budget effects, procurement, payment, or accounting behavior.
- Not included: dispatch deletion, restoration, reopening, reverse transitions, or arbitrary status updates.
- Not included: named passenger manifests. `passengerCount` remains a nonnegative integer.
- Not included: sequential dispatch reference numbers. Opaque UUIDv7 identifiers remain the resource address.
- Not included: office-scoped user tenancy. The current identity model provides LGU-wide permission access only.
- Not included: new runtime packages, fonts, charts, animation libraries, or table frameworks.
- Not changing: authentication, global multi-factor authentication controls, Cross-Site Request Forgery protection, audit chaining, or the audit-delivery worker.

## Feature Metadata

**Feature Type**: New Capability

**Estimated Complexity**: High

**Primary Systems Affected**: Dispatch domain, application use cases, master-data eligibility, MySQL migration and repositories, immutable audit outbox, authorization, Next.js Route Handlers, protected pages, collapsible navigation, Vitest, MySQL integration tests, and Playwright

**Dependencies**: FVD-003 durable audit capture; FVD-004 office, driver, and vehicle master data; FVD-006 migration numbering and shared decimal enhancements; existing Next.js 16.3.3, React 19.2.8, Kysely 0.29.5, MySQL 8.4, Zod 4.4.3, React Hook Form 7.86.0, Radix Dialog/AlertDialog, Tailwind CSS 4.3.3

**New runtime dependencies**: None

## Related Work

**Implements**: FVD-007 in `docs/tickets/fuel-and-vehicle-dispatch-system.md`

**Epic**: `docs/PRD.md`

**Architecture**: `docs/System_Architecture.md`

**Back-references**:

- `.claude/plans/deliver-authentication-sessions-rbac.md` defines the five dispatch permissions and protected-route controls.
- `.claude/plans/establish-durable-immutable-audit-capture-verification.md` defines transaction-scoped outbox capture and safe audit snapshots.
- `.claude/plans/manage-office-driver-vehicle-master-data.md` defines operational versus historical master-data reads and locking methods.
- `.claude/plans/manage-budget-allocations-fiscal-eligibility.md` defines the current transaction, cursor, Route Handler, and responsive administration patterns.
- FVD-006 commit `103f755` defines migration `000007`, the enhanced shared decimal object, and the collapsible sidebar implementation that FVD-007 must extend.

**Forward-references**:

- FVD-008 will add schedule conflicts, concurrency serialization for double-booking, overrides, and availability calendars.
- FVD-009 will report dispatch counts and vehicle distance from completed dispatches.
- FVD-010 will revalidate this server-authoritative lifecycle during offline synchronization.

## Execution Prerequisite

The analyzed implementation base is `origin/main` at `b7a31a8`. That base does not contain FVD-006.

FVD-006 commit `103f755` was merged into `origin/feature/manage-budget-allocations-fiscal-eligibility` at `60cadce`, rather than into `origin/main`. It owns `20260828_000007_create_fuel_workflow.ts` and updates the shared decimal object and protected sidebar.

Before FVD-007 implementation, land FVD-006 on the implementation base or rebase this branch onto a base containing it. Then create `20260828_000008_create_dispatch_workflow.ts`.

Do not create a dispatch migration numbered `000007`. Do not apply `000008` to an environment that has not first applied `000007`, because `allowUnorderedMigrations` is disabled in the migrator.

This is a release-order dependency, not a functional dependency. The ticket dependency graph still correctly identifies FVD-004 as FVD-007's business prerequisite.

---

## ACCEPTED DECISION CONTRACT

The user accepted all recommended defaults. These decisions are no longer open questions.

### Dispatch lifecycle

- Create every dispatch as `DRAFT`. The create payload never accepts a status.
- Allow core-field edits only while the dispatch is `DRAFT`.
- Allow `DRAFT` to transition to `DISPATCHED` or `CANCELLED`.
- Allow `DISPATCHED` to transition to `COMPLETED` or `CANCELLED`.
- Keep `COMPLETED` and `CANCELLED` immutable and terminal.
- Reject repeated, reverse, skipped, and cross-terminal transitions with a stable business-rule error.
- Add `POST /api/dispatches/:id/dispatch` for the explicit dispatch transition.
- Authorize the dispatch transition with the existing `dispatch.update` permission.
- Require a normalized cancellation reason from 10 through 500 characters.
- Persist `dispatchedAt`, `completedAt`, `cancelledAt`, `cancelledBy`, and `cancellationReason` as authoritative lifecycle evidence.

### Master-data eligibility

- Creation requires a current active driver, current serviceable vehicle, and current active requesting office.
- Draft editing revalidates all three selected references, including references whose identifiers did not change.
- The dispatch transition locks and revalidates all three references immediately before changing state.
- Completion and cancellation remain allowed after a referenced record becomes inactive, unserviceable, or soft-deleted.
- Operational preparation options exclude inactive and soft-deleted drivers, unserviceable and soft-deleted vehicles, and inactive or soft-deleted offices.
- Historical list and detail reads resolve linked labels after master-data soft deletion.
- Dispatch responses never expose driver contact information or internal database identifiers.

### Odometer and travel data

- `odoBefore` is required at draft creation and remains editable only while the dispatch is `DRAFT`.
- `odoAfter` is accepted only by the completion command.
- Both values use exact `DECIMAL(12,1)` semantics and travel through TypeScript and JSON as strings.
- Both values are nonnegative. The final reading must be greater than or equal to the initial reading.
- Derived distance equals `odoAfter - odoBefore`; it is returned as a decimal string and never stored separately.
- Cross-dispatch odometer continuity is deferred. The workflow does not compare against earlier dispatches.
- `entryDate` and `travelDate` must be valid `YYYY-MM-DD` civil dates.
- Do not require travel date to follow entry date, because legitimate delayed encoding may record earlier travel.
- `passengerCount` is a nonnegative integer.
- Normalize destination to 1–255 characters and purpose to 1–500 characters.

### Authorization and object access

- Create requires `dispatch.create`.
- List and detail require `dispatch.read`.
- Draft edit and dispatch transition require `dispatch.update`.
- Completion requires `dispatch.complete`.
- Cancellation requires `dispatch.cancel`.
- Require the exact action permission inside every use case and every Route Handler access boundary.
- Resolve each target through a validated UUIDv7 public identifier after permission checking.
- Return the same generic not-found response for missing or inaccessible objects.
- Keep `DispatchPermissionPolicy` object-aware so office scoping can be added later.
- Do not invent office-level user assignments because the current identity model has no such relationship.
- Record authorization denials through the existing durable denial-audit service.

### FVD-008 boundary

- Add nullable `travelStartAt` and `travelEndAt` database columns now.
- Keep both fields null and unexposed in FVD-007.
- Add the schedule-supporting driver, vehicle, office, and travel-date indexes now.
- Do not add conflict override columns to `vehicle_dispatches`.
- Do not create `vehicle_dispatch_conflict_overrides`.
- Do not perform schedule-conflict queries or acquire conflict-serialization locks.

### Collection behavior

- Default API page size is 50. The server-rendered UI requests 25. The hard maximum is 200.
- Use keyset pagination ordered by `travel_date DESC, public_id DESC`.
- Bind opaque cursors to every active filter and the page size.
- Support free-text search across destination, purpose, driver name, vehicle plate, office name, and office abbreviation.
- Support status, office, inclusive travel-date-from, and inclusive travel-date-to filters.
- Return compact joined office, driver, and vehicle labels for list rows.
- Keep list state in native GET query parameters for deep links and browser navigation.

---

## ACCEPTANCE CRITERIA

- **AC1 — Authorized workflow**: Authorized staff can create, list, open, edit, dispatch, complete, and cancel dispatches.
- **AC2 — Eligibility**: Create, draft update, and dispatch accept only current operational driver, vehicle, and office references.
- **AC3 — State safety**: The accepted state graph is enforced and terminal records cannot mutate.
- **AC4 — Odometer safety**: Readings are exact and nonnegative, final is not below initial, and distance is derived correctly.
- **AC5 — Atomic completion**: Completion locks the dispatch, validates state and odometer, persists the change, and appends audit evidence in one transaction.
- **AC6 — Historical preservation**: Completed and cancelled records remain readable with historical master-data labels after linked soft deletion.
- **AC7 — Object authorization**: Every list, detail, and command enforces its exact permission and opaque-ID access policy.
- **AC8 — Immutable audit**: Every successful create, update, dispatch, complete, and cancel writes exactly one safe outbox event atomically.
- **AC9 — Protected API**: Mutations enforce authentication, JSON content type, trusted origin, Cross-Site Request Forgery protection, strict schemas, and safe errors.
- **AC10 — Responsive interface**: Dispatch list, forms, detail, status, and lifecycle actions remain usable on mobile and desktop.
- **AC11 — Accessible interface**: Controls are keyboard-operable, status is not color-only, errors are announced, focus is managed, and reduced motion is honored.
- **AC12 — Deferred conflict boundary**: FVD-007 preserves future scheduling columns and indexes without implementing FVD-008 behavior.
- **AC13 — Verification**: Domain, application, route, repository, transaction, authorization, accessibility, and end-to-end tests pass.

---

## CONTEXT REFERENCES

### Relevant Codebase Files — Read Before Implementing

#### Product and architecture

- `docs/tickets/fuel-and-vehicle-dispatch-system.md` lines 226–255 — FVD-007 scope, acceptance criteria, and size.
- `docs/tickets/fuel-and-vehicle-dispatch-system.md` lines 259–290 — FVD-008 conflict and availability boundary.
- `docs/tickets/fuel-and-vehicle-dispatch-system.md` lines 432–478 — dependency graph and parallel-work guidance.
- `docs/PRD.md` lines 269–321 — dispatch fields, eligibility, odometer rules, and lifecycle graph.
- `docs/PRD.md` lines 397–440 — audit evidence and historical master-data resolution.
- `docs/PRD.md` lines 561–619 — privacy, security, pagination, and authorization requirements.
- `docs/PRD.md` lines 632–664 — responsive dispatch form sections and usability requirements.
- `docs/PRD.md` lines 678–739 — normalized data, public identifiers, API validation, and concurrency controls.
- `docs/PRD.md` lines 919–946 — release acceptance for dispatch operations and odometer enforcement.
- `docs/System_Architecture.md` lines 56–65 — Clean Architecture responsibilities and thin-controller rule.
- `docs/System_Architecture.md` lines 182–203 — `VehicleDispatch` aggregate and future travel interval.
- `docs/System_Architecture.md` lines 283–297 — derived distance and operational eligibility.
- `docs/System_Architecture.md` lines 500–528 — dispatch table, decimal precision, statuses, and indexes.
- `docs/System_Architecture.md` lines 555–574 — dispatch audit events and safe evidence.
- `docs/System_Architecture.md` lines 622–678 — server-side permissions and authorization.
- `docs/System_Architecture.md` lines 701–710 — documented dispatch API surface.
- `docs/System_Architecture.md` lines 772–816 — DTO validation, error envelopes, and opaque IDs.
- `docs/System_Architecture.md` lines 839–866 — transaction structure and completing-dispatch sequence.
- `docs/System_Architecture.md` lines 1012–1033 — responsive interface and accessibility rules.
- `docs/System_Architecture.md` lines 1037–1078 — required test layers and security coverage.

#### Domain and application patterns

- `src/domain/driver/entities/driver.ts` — operational driver predicate and historical entity behavior.
- `src/domain/vehicle/entities/vehicle.ts` — serviceability predicate and historical entity behavior.
- `src/domain/office/entities/office.ts` — operational office predicate and lifecycle guards.
- `src/domain/budget/entities/budget-allocation.ts` lines 25–117 — aggregate mutation and state-transition pattern.
- `src/domain/shared/value-objects/public-id.ts` — UUIDv7 validation and opaque addressing.
- `src/domain/shared/value-objects/decimal-value.ts` — shared exact-decimal abstraction; use its FVD-006 enhanced version.
- FVD-006 `src/domain/fuel/value-objects/entry-date.ts` at commit `103f755` — strict civil-date parsing pattern.
- `src/application/budget/dto/budget-allocation-dtos.ts` — command, detail, joined-reference, and page DTO pattern.
- `src/application/budget/ports/budget-allocation-repository.ts` lines 18–31 — explicit current, historical, locked, list, and mutation ports.
- `src/application/budget/ports/budget-transaction.ts` lines 5–13 — feature transaction with master-data and audit ports.
- `src/application/budget/services/budget-permission-policy.ts` lines 4–20 — permission-policy assertions.
- `src/application/budget/services/budget-allocation-audit-events.ts` lines 5–52 — allowlisted before/after audit snapshots.
- `src/application/budget/services/budget-use-case-support.ts` lines 15–89 — normalized values and domain-to-application error mapping.
- `src/application/budget/use-cases/update-budget-allocation.ts` lines 24–142 — lock, command discrimination, mutation, and audit order.
- FVD-006 `src/application/fuel/use-cases/post-fuel-issuance.ts` at commit `103f755` — transaction-scoped eligibility locks.
- FVD-006 `src/application/fuel/use-cases/get-fuel-preparation-options.ts` at commit `103f755` — permission-specific preparation options.

#### Infrastructure and persistence patterns

- `src/infrastructure/database/migrator.ts` lines 12–20 — ordered migration behavior.
- `src/infrastructure/database/migrations/20260828_000004_create_master_data.ts` — named checks, restrictive foreign keys, and dispatch permission seeds.
- `src/infrastructure/database/migrations/20260828_000005_create_budget_allocations.ts` — normalized transaction table and reversible migration pattern.
- FVD-006 `src/infrastructure/database/migrations/20260828_000007_create_fuel_workflow.ts` at commit `103f755` — reserved preceding migration.
- `src/infrastructure/database/types.ts` — Kysely table types, database map, string decimals, and UTC dates.
- `src/infrastructure/database/client.ts` lines 14–38 — decimal and UTC coercion behavior.
- `src/infrastructure/database/budget/kysely-budget-allocation-repository.ts` lines 46–419 — joins, row locking, mutation mapping, and keyset pagination.
- FVD-006 `src/infrastructure/database/fuel/kysely-fuel-issuance-repository.ts` at commit `103f755` — lock primary row before joined historical read.
- `src/infrastructure/database/budget/budget-allocation-cursor-codec.ts` — filter-bound opaque cursor pattern.
- `src/infrastructure/database/budget/kysely-budget-transaction.ts` lines 17–29 — transaction-local repository and audit construction.
- `src/infrastructure/database/audit/kysely-audit-outbox-store.ts` lines 53–95 — durable audit append behavior.
- `src/infrastructure/database/uuid-binary.ts` — UUID and `BINARY(16)` conversion.
- `src/infrastructure/composition/budget.ts` — feature-local composition factory.
- `src/infrastructure/composition/root.ts` — root wiring and dependency exposure.

#### API and server-access patterns

- `src/app/api/budget-allocations/route.ts` lines 14–59 — collection parsing, read/create branching, and thin-handler behavior.
- `src/app/api/budget-allocations/[budgetAllocationId]/route.ts` lines 14–52 — Promise route parameters and opaque item behavior.
- FVD-006 `src/app/api/fuel-issuances/route.ts` at commit `103f755` — preparation and posting Route Handler patterns.
- `src/lib/budget/route-schemas.ts` lines 7–165 — strict commands, filters, public IDs, and bounded page sizes.
- `src/lib/budget/page-query.ts` — native GET page state and cursor links.
- `src/lib/budget/server-budget-access.ts` lines 19–82 — authentication, permission denial auditing, and page access.
- `src/lib/auth/route-helpers.ts` — trusted origin, content type, Cross-Site Request Forgery, and JSON body checks.
- `src/lib/http/with-response-handler.ts` lines 24–105 — stable error mapping, no-store responses, request IDs, and safe logging.
- `src/application/shared/errors/application-error.ts` lines 1–98 — validation, conflict, authorization, not-found, and business-rule errors.

#### UI and design patterns

- `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md` lines 1–192 — binding tokens, density, typography, responsive behavior, accessibility, and forbidden patterns.
- `design-system/fuel-and-vehicle-dispatch-management-system/pages/budget-allocation-management.md` — closest persisted page contract.
- FVD-006 `src/components/navigation/protected-navigation.tsx` at commit `103f755` — permission-filtered collapsible sidebar.
- FVD-006 `src/app/(protected)/layout.tsx` at commit `103f755` — protected shell and navigation access object.
- `src/app/(protected)/budget-allocations/page.tsx` lines 21–164 — server-rendered list, permissions, filters, and paging.
- `src/app/(protected)/budget-allocations/[budgetAllocationId]/page.tsx` lines 17–228 — server-rendered detail and lifecycle actions.
- `src/components/budget-allocations/budget-allocation-form.tsx` lines 42–286 — React Hook Form, Zod resolver, first-error focus, and pending state.
- `src/components/budget-allocations/budget-allocation-results.tsx` lines 17–185 — responsive desktop table and mobile cards.
- `src/components/master-data/reference-lifecycle-dialog.tsx` — confirmation, reason, focus-return, and expected-error behavior.
- `src/components/master-data/reference-status-badge.tsx` — semantic icon-plus-text status pattern.
- `src/components/forms/form-status.tsx` — announced pending and error states.

#### Test patterns

- `vitest.config.ts` — unit coverage scope and thresholds.
- `vitest.integration.config.ts` — real MySQL integration suite.
- `playwright.config.ts` — serial Chromium journeys and failure evidence.
- `tests/unit/domain/budget/budget-allocation.test.ts` — aggregate state-transition tests.
- `tests/unit/application/budget/budget-use-cases.test.ts` — authorization, transaction, lifecycle, and audit use-case tests.
- `tests/unit/app/api/budget-allocations/budget-allocation-routes.test.ts` — authentication, Cross-Site Request Forgery, validation, and permissions.
- `tests/unit/components/budget-allocation-components.test.ts` — static responsive component assertions.
- `tests/integration/budget/migration.test.ts` — table, check, index, foreign-key, down, and up assertions.
- `tests/integration/budget/repositories.test.ts` — current and historical joins plus pagination.
- `tests/integration/budget/audit-atomicity.test.ts` lines 80–108 — business-write and audit rollback proof.
- `tests/integration/budget/concurrency.test.ts` lines 87–179 — deterministic row-lock races.
- `tests/e2e/budget-allocations.spec.ts` — complete lifecycle and responsive journeys.
- `tests/e2e/budget-allocation-permissions.spec.ts` — navigation, page, detail, and API authorization.
- `tests/e2e/accessibility.spec.ts` — populated-page and open-dialog accessibility scans.
- `tests/e2e/fixtures/auth.ts` — deterministic dispatch officer and read-only principals.
- `tests/e2e/global-setup.ts` — migrations, users, application server, and audit worker setup.

### Relevant Documentation — Read Before Implementing

- [MySQL 8.4 Locking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
  - Specific section: `SELECT ... FOR UPDATE`
  - Why: lifecycle commands must serialize against one locked dispatch row until commit or rollback.
- [MySQL 8.4 Deadlock Handling](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks-handling.html)
  - Specific section: consistent operation order and indexing
  - Why: create, edit, and dispatch should lock master references in one stable order.
- [MySQL 8.4 Locks Set by Statements](https://dev.mysql.com/doc/refman/8.4/en/innodb-locks-set.html)
  - Specific section: indexed locking reads
  - Why: repositories must lock narrowly through public-ID and primary-key indexes.
- [MySQL 8.4 CHECK Constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html)
  - Specific section: named enforced table checks
  - Why: status, odometer, and lifecycle metadata require database enforcement.
- [MySQL 8.4 Fixed-Point Types](https://dev.mysql.com/doc/refman/8.4/en/precision-math-decimal-characteristics.html)
  - Specific section: `DECIMAL(M,D)` precision and scale
  - Why: odometer readings require exact one-decimal storage without JavaScript-number coercion.
- [Kysely TransactionBuilder](https://kysely-org.github.io/kysely-apidoc/classes/TransactionBuilder.html)
  - Specific section: execute callback
  - Why: a thrown business or audit error must roll back the complete mutation.
- [Kysely SelectQueryBuilder](https://kysely-org.github.io/kysely-apidoc/interfaces/SelectQueryBuilder.html)
  - Specific section: `forUpdate`
  - Why: state transitions must use transaction-bound locking reads.
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
  - Specific section: dynamic Route Handler requests and responses
  - Why: dispatch endpoints must follow the project's Next.js 16 handler conventions.
- [Next.js Dynamic Segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes)
  - Specific section: Promise-based `params`
  - Why: item and action routes must await dynamic route parameters.
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  - Specific section: Server and Client Components
  - Why: pages remain server-rendered while forms, filters, and dialogs are narrow client leaves.
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
  - Specific section: Route Handler conventions
  - Why: local installed-version guidance controls implementation details.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`
  - Specific section: dynamic parameter typing
  - Why: the repository uses the breaking Next.js 16 Promise parameter contract.

### UI/UX Direction

The UI UX Pro Max design-system search was advisory. Its marketing-oriented exaggerated-minimalism output conflicts with the saved FVDMS product system and must not be used.

Treat `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md` as authoritative. Keep the restrained LGU operations aesthetic, Lexend headings, Source Sans 3 interface text, semantic tokens, density 8, motion 2, Lucide icons, dark mode, and 44-pixel targets.

Use the existing shadcn/Radix primitives and Tailwind utility conventions. Avoid raw colors, decorative gradients, oversized marketing typography, hover-only interactions, custom-drawn controls, and unnecessary animation.

### New Files to Create

#### Domain

- `src/domain/dispatch/entities/vehicle-dispatch.ts` — aggregate state, draft editing, dispatch, completion, cancellation, distance, and terminal guards.
- `src/domain/dispatch/value-objects/dispatch-status.ts` — accepted state graph.
- `src/domain/dispatch/value-objects/dispatch-date.ts` — strict civil `YYYY-MM-DD` value.
- `src/domain/dispatch/value-objects/odometer-reading.ts` — exact one-decimal nonnegative value and comparison.
- `src/domain/dispatch/value-objects/passenger-count.ts` — nonnegative integer value.

#### Application

- `src/application/dispatch/dto/dispatch-dtos.ts` — request context, commands, joined reference DTOs, filters, detail, preparation options, and pages.
- `src/application/dispatch/ports/dispatch-repository.ts` — current, historical, locked, list, insert, and update methods.
- `src/application/dispatch/ports/dispatch-transaction.ts` — dispatch, driver, vehicle, office, and audit ports.
- `src/application/dispatch/ports/dispatch-use-case-dependencies.ts` — permissions, clock, ID generation, and transaction dependencies.
- `src/application/dispatch/services/dispatch-permission-policy.ts` — exact action assertions and object-aware access seam.
- `src/application/dispatch/services/dispatch-audit-events.ts` — action names and allowlisted snapshots.
- `src/application/dispatch/services/dispatch-use-case-support.ts` — normalization, field errors, domain error mapping, and DTO assembly.
- `src/application/dispatch/use-cases/create-dispatch.ts`
- `src/application/dispatch/use-cases/get-dispatch.ts`
- `src/application/dispatch/use-cases/list-dispatches.ts`
- `src/application/dispatch/use-cases/get-dispatch-preparation-options.ts`
- `src/application/dispatch/use-cases/update-draft-dispatch.ts`
- `src/application/dispatch/use-cases/dispatch-vehicle.ts`
- `src/application/dispatch/use-cases/complete-dispatch.ts`
- `src/application/dispatch/use-cases/cancel-dispatch.ts`

#### Infrastructure

- `src/infrastructure/database/migrations/20260828_000008_create_dispatch_workflow.ts` — normalized dispatch table, checks, foreign keys, and indexes.
- `src/infrastructure/database/dispatch/dispatch-cursor-codec.ts` — filter-bound keyset cursor.
- `src/infrastructure/database/dispatch/kysely-dispatch-repository.ts` — historical joins, locks, lists, and mutations.
- `src/infrastructure/database/dispatch/create-kysely-dispatch-repositories.ts` — transaction-local repository factory.
- `src/infrastructure/database/dispatch/kysely-dispatch-transaction.ts` — atomic business and audit callback.
- `src/infrastructure/composition/dispatch.ts` — feature-local use-case composition.

#### API and page utilities

- `src/lib/dispatch/route-schemas.ts` — strict create, update, complete, cancel, public-ID, and list schemas.
- `src/lib/dispatch/page-query.ts` — native GET filters and cursor href generation.
- `src/lib/dispatch/server-dispatch-access.ts` — page authentication, permissions, denial auditing, and request context.
- `src/lib/dispatch/dispatch-form-response.ts` — safe field and form error parsing.
- `src/app/api/dispatch-preparation-options/route.ts` — active office, driver, and vehicle selector options.
- `src/app/api/dispatches/route.ts` — collection GET and create POST.
- `src/app/api/dispatches/[dispatchId]/route.ts` — detail GET and draft PATCH.
- `src/app/api/dispatches/[dispatchId]/dispatch/route.ts` — dispatch transition POST.
- `src/app/api/dispatches/[dispatchId]/complete/route.ts` — completion POST.
- `src/app/api/dispatches/[dispatchId]/cancel/route.ts` — cancellation POST.

#### UI

- `design-system/fuel-and-vehicle-dispatch-management-system/pages/dispatch-management.md` — page-specific UI contract.
- `src/app/(protected)/dispatches/page.tsx` — server-rendered list and permissions.
- `src/app/(protected)/dispatches/new/page.tsx` — server-rendered creation shell and preparation options.
- `src/app/(protected)/dispatches/[dispatchId]/page.tsx` — detail, draft edit, lifecycle, and distance presentation.
- `src/app/(protected)/dispatches/loading.tsx` — reduced-motion list/detail skeleton.
- `src/app/(protected)/dispatches/error.tsx` — route-local retry boundary.
- `src/components/dispatches/dispatch-filter-form.tsx`
- `src/components/dispatches/dispatch-form.tsx`
- `src/components/dispatches/dispatch-results.tsx`
- `src/components/dispatches/dispatch-status-badge.tsx`
- `src/components/dispatches/dispatch-lifecycle-panel.tsx`
- `src/components/dispatches/dispatch-confirmation-dialog.tsx`
- `src/components/dispatches/dispatch-completion-dialog.tsx`
- `src/components/dispatches/dispatch-cancellation-dialog.tsx`

#### Tests

- `tests/unit/domain/dispatch/vehicle-dispatch.test.ts`
- `tests/unit/domain/dispatch/dispatch-value-objects.test.ts`
- `tests/unit/application/dispatch/dispatch-use-cases.test.ts`
- `tests/unit/application/dispatch/dispatch-services.test.ts`
- `tests/unit/application/dispatch/dispatch-test-helpers.ts`
- `tests/unit/lib/dispatch/route-schemas.test.ts`
- `tests/unit/lib/dispatch/page-query.test.ts`
- `tests/unit/lib/dispatch/dispatch-form-response.test.ts`
- `tests/unit/infrastructure/database/dispatch-cursor-codec.test.ts`
- `tests/unit/infrastructure/composition/dispatch.test.ts`
- `tests/unit/app/api/dispatches/dispatch-routes.test.ts`
- `tests/unit/components/dispatch-components.test.ts`
- `tests/integration/helpers/dispatch-test-database.ts`
- `tests/integration/dispatch/migration.test.ts`
- `tests/integration/dispatch/repositories.test.ts`
- `tests/integration/dispatch/concurrency.test.ts`
- `tests/integration/dispatch/audit-atomicity.test.ts`
- `tests/e2e/dispatches.spec.ts`
- `tests/e2e/dispatch-permissions.spec.ts`

### Existing Files to Update

- `src/domain/shared/value-objects/decimal-value.ts` — consume FVD-006 comparison, subtraction, precision, and formatting methods; do not duplicate them.
- `src/infrastructure/database/types.ts` — add `VehicleDispatchesTable` and `vehicle_dispatches` to `Database`.
- `src/infrastructure/composition/root.ts` — spread the dispatch composition and expose its policies and use cases.
- FVD-006 `src/components/navigation/protected-navigation.tsx` — add a `dispatch.read`-aware Dispatch link in Operations.
- FVD-006 `src/app/(protected)/layout.tsx` — compute and pass dispatch navigation access without weakening the collapsible shell.
- `tests/integration/helpers/master-data-test-database.ts` — delete dispatches before driver, vehicle, office, and user rows.
- `tests/integration/helpers/budget-test-database.ts` — include foreign-key-safe dispatch cleanup when shared fixtures require it.
- FVD-006 integration helpers — delete dispatches before fuel-adjacent shared master data where applicable.
- `tests/integration/database/migrations.test.ts` — expect migration `000008` and preserve full down/up verification.
- `tests/integration/database/auth-migrations.test.ts` — update only migration-depth assumptions; permission counts do not change.
- `tests/integration/master-data/migration.test.ts` — roll back through dispatch and later migrations before asserting master-data removal.
- `tests/integration/master-data/repositories.test.ts` — use foreign-key-safe cleanup order.
- `tests/integration/budget/migration.test.ts` — update rollback depth and cleanup order.
- FVD-006 integration migration tests — update rollback depth after `000008` exists.
- `tests/e2e/fixtures/auth.ts` — reuse or clarify the deterministic Dispatch Officer credentials.
- `tests/e2e/global-setup.ts` — seed deterministic eligible/ineligible dispatch references and migrate through `000008`.
- `tests/e2e/accessibility.spec.ts` — add populated dispatch list, form, and open lifecycle dialog coverage.
- `README.md` — document dispatch routes, permissions, lifecycle, eligibility timing, odometer behavior, and validation.

### Patterns to Follow

**Naming**

- Use `dispatch` for the module and `dispatches` for routes.
- Use `VehicleDispatch` for the aggregate and `Dispatch` for DTO and service prefixes.
- Use `dispatchId` for opaque route parameters and `publicId` inside the aggregate.
- Use `entryDate`, `travelDate`, `odoBefore`, `odoAfter`, `passengerCount`, and `requestingOfficePublicId` in TypeScript.
- Use `entry_date`, `travel_date`, `odo_before`, `odo_after`, `passenger_count`, and `requesting_office_id` in MySQL.
- Use audit actions `vehicle_dispatch.created`, `.updated`, `.dispatched`, `.completed`, and `.cancelled`.

**Database shape**

- `id BIGINT UNSIGNED` primary key.
- `public_id BINARY(16)` unique and not null.
- Restrictive foreign keys for driver, vehicle, requesting office, creator, and optional cancellation actor.
- `entry_date DATE` and `travel_date DATE` required.
- `travel_start_at DATETIME(6)` and `travel_end_at DATETIME(6)` nullable and reserved.
- `destination VARCHAR(255)` and `purpose VARCHAR(500)` required.
- `odo_before DECIMAL(12,1)` required and `odo_after DECIMAL(12,1)` nullable.
- `passenger_count INT UNSIGNED` required with default zero.
- `status VARCHAR(10)` constrained to the four accepted values.
- Lifecycle timestamps use `DATETIME(6)`.
- Cancellation reason is nullable outside `CANCELLED` and required within that state.
- `created_at` and `updated_at` use `DATETIME(6)`.

Named checks must enforce nonnegative odometers, final-reading order, valid statuses, and lifecycle metadata coherence. A cancelled draft may have no `dispatched_at`; a cancelled dispatched record retains it.

Use indexes on `(travel_date, public_id)`, `(requesting_office_id, travel_date, public_id)`, `(vehicle_id, travel_date, status)`, and `(driver_id, travel_date, status)`. Add only indexes justified by the implemented list predicates.

**Domain entity**

```ts
export class VehicleDispatch {
  updateDetails(input: DraftDispatchDetails, at: Date): void {
    this.status.assertDraft();
    // Replace validated value objects and updatedAt.
  }

  markDispatched(at: Date): void {
    this.status = this.status.dispatch();
    this.dispatchedAt = at;
    this.updatedAt = at;
  }

  complete(odoAfter: OdometerReading, at: Date): void {
    this.status.assertDispatched();
    odoAfter.assertAtLeast(this.odoBefore);
    this.odoAfter = odoAfter;
    this.status = DispatchStatus.completed();
    this.completedAt = at;
    this.updatedAt = at;
  }
}
```

The entity owns lifecycle and within-record odometer rules. Use cases own authorization, external eligibility, repository locking, and audit coordination.

**Mutation and audit order**

```ts
return dependencies.transaction.execute(async (repositories) => {
  const dispatch = await repositories.dispatches.findCurrentByPublicIdForUpdate(publicId);
  if (dispatch === null) throw new NotFoundError();

  // Lock and validate current references when the action requires eligibility.
  // Apply exactly one aggregate command.
  // Persist exactly one business mutation.
  // Append exactly one allowlisted audit event.

  return toDispatchDetailDto(dispatch, historicalReferences);
});
```

Lock the primary dispatch row before loading its multi-table joined detail. Do not place `FOR UPDATE` directly on the historical join.

For create, draft update, and dispatch transition, lock references in a consistent `office → driver → vehicle` order. Use the same order in every use case to reduce deadlock risk.

Completion locks only the dispatch row for FVD-007. Do not lock a vehicle merely to imply a cross-trip odometer or conflict rule that this ticket does not define.

**Repository behavior**

- Current mutation lookups exclude no historical reference by join-side lifecycle.
- Historical detail joins do not filter soft-deleted office, driver, or vehicle rows.
- Preparation options use existing current operational repository methods.
- List joined labels include driver name, vehicle plate and description, and office name and abbreviation.
- Public DTOs never contain internal IDs or driver phone numbers.
- Cursor payload contains version, direction, travel date, public ID, page size, and filter fingerprint.
- Fetch `pageSize + 1` rows to determine the next cursor.

**Error behavior**

- Convert invalid input and domain value failures to `ValidationError` with stable field details.
- Use `BusinessRuleError` with HTTP 422 for illegal transitions, terminal mutations, or failed eligibility.
- Use `NotFoundError` for absent or inaccessible public IDs and missing master-data references.
- Use the existing authentication and authorization error types for missing sessions or permissions.
- Never expose SQL codes, constraint names, internal IDs, contact data, stack traces, or raw domain errors.

**UI behavior**

- Add Dispatch under the Operations sidebar group with a Lucide `Route` or `ClipboardList` icon.
- Preserve desktop collapse, mobile drawer behavior, active-route state, tooltips, and keyboard focus from FVD-006.
- Keep list and detail pages as Server Components.
- Use client leaves only for filters, form controls, and lifecycle dialogs.
- Use a dedicated create page because the dispatch form has several operational sections.
- Divide the form into Dispatch Information, Vehicle and Driver, Travel Details, Odometer and Passengers, and Review.
- Use searchable selectors when existing selector primitives support them. Do not add a new combobox package.
- Use text-plus-icon status badges and plain-language lifecycle guidance.
- Show a responsive table at 640 pixels and above, with complete definition-list cards below 640 pixels.
- Use native GET filters and preserve filters across cursor navigation.
- Show Dispatch only for `DRAFT`, Complete only for `DISPATCHED`, and Cancel for `DRAFT` or `DISPATCHED`.
- Use a confirmation dialog for dispatch, a final-odometer dialog for completion, and an AlertDialog with reason input for cancellation.
- In the completion dialog, show live exact distance only after a valid final reading at least equal to the initial reading.
- Preserve entered values after expected errors, focus the first invalid field, and return focus to the trigger after closing.
- Disable actions only while their own request is pending.
- Terminal detail pages display lifecycle history and derived distance without mutation controls.
- Preserve 44-pixel targets, visible two-pixel focus rings, 200-percent zoom, dark mode, reduced motion, and no viewport overflow.

---

## IMPLEMENTATION PLAN

### Phase 0: Correct the implementation base

Confirm that FVD-006 migration `000007`, the enhanced decimal object, and the collapsible sidebar exist before dispatch work begins. Rebase or integrate the prerequisite without rewriting user-owned history.

### Phase 1: Domain and application contracts

Create exact decimal, civil date, passenger count, status, and aggregate behavior. Define DTOs, ports, authorization, audit, and application error mapping before persistence.

### Phase 2: Migration and persistence

Create migration `000008`, update Kysely types, implement historical joins and keyset lists, and construct transaction-local repositories.

### Phase 3: Use cases and protected API

Implement every read and command with action-specific permissions, consistent locks, eligibility rechecks, atomic audit capture, strict schemas, and thin Route Handlers.

### Phase 4: Design contract and interface

Persist the dispatch page design contract. Build responsive list, create, and detail pages inside the existing collapsible sidebar.

### Phase 5: Concurrency, security, accessibility, and regression validation

Prove transaction serialization, atomic audit rollback, object authorization, terminal immutability, responsive behavior, and the full project gate.

---

## STEP-BY-STEP TASKS

Execute every task in order. Each task is independently testable and must leave its focused checks green.

### Task 0 — VERIFY and correct the FVD-006 implementation base

- **VERIFY**: Confirm migration `20260828_000007_create_fuel_workflow.ts`, FVD-006's enhanced `DecimalValue`, and `ProtectedNavigation` exist on the implementation base.
- **IMPLEMENT**: Rebase onto or integrate a branch containing FVD-006 before creating dispatch migration `000008`.
- **IMPLEMENT**: Preserve unrelated user changes and avoid duplicating FVD-006 files.
- **GOTCHA**: `allowUnorderedMigrations` is false. Applying `000008` before introducing `000007` creates an unrecoverable normal-order upgrade problem.
- **VALIDATE**: `git merge-base --is-ancestor 103f755 HEAD && git log -1 --oneline -- src/infrastructure/database/migrations/20260828_000007_create_fuel_workflow.ts`
- **VALIDATE**: `test -f src/infrastructure/database/migrations/20260828_000007_create_fuel_workflow.ts && test -f src/components/navigation/protected-navigation.tsx`
- **SATISFIES**: implementation prerequisite and migration safety

### Task 1 — CREATE dispatch value objects and aggregate

- **IMPLEMENT**: Add `DispatchDate`, `OdometerReading`, `PassengerCount`, `DispatchStatus`, and `VehicleDispatch`.
- **IMPLEMENT**: Default creation to `DRAFT` and enforce every accepted transition.
- **IMPLEMENT**: Keep core edits draft-only and terminal records immutable.
- **IMPLEMENT**: Enforce exact one-decimal nonnegative odometers and final greater than or equal to initial.
- **IMPLEMENT**: Derive distance through shared decimal subtraction without persisting it.
- **PATTERN**: Mirror `BudgetAllocation` state ownership and FVD-006 `EntryDate` parsing.
- **IMPORTS**: Reuse `PublicId`, `DecimalValue`, and existing domain-error conventions.
- **GOTCHA**: Never convert odometers through `number`, `parseFloat`, or floating-point arithmetic.
- **GOTCHA**: Do not enforce travel-date ordering or cross-dispatch odometer continuity.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/domain/dispatch`
- **SATISFIES**: AC3, AC4, AC6

### Task 2 — CREATE dispatch DTOs, ports, permissions, audit, and support services

- **IMPLEMENT**: Define create, draft-update, complete, cancel, list, detail, and preparation-option contracts.
- **IMPLEMENT**: Define current, historical, locked, mutation, and keyset-list repository methods.
- **IMPLEMENT**: Define a transaction seam containing dispatch, office, driver, vehicle, and audit ports.
- **IMPLEMENT**: Add exact permission assertions for read, create, update, complete, and cancel.
- **IMPLEMENT**: Add safe action names and allowlisted before/after snapshots without contact data.
- **IMPLEMENT**: Normalize destination, purpose, and cancellation reason; map domain failures to stable application errors.
- **PATTERN**: Mirror the budget DTO, permission, audit, transaction, and support services.
- **GOTCHA**: Keep public IDs in DTOs. Internal numeric IDs remain infrastructure-only.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/dispatch/dispatch-services.test.ts`
- **SATISFIES**: AC1, AC2, AC4, AC7, AC8

### Task 3 — CREATE migration 000008 and update database types

- **IMPLEMENT**: Create `vehicle_dispatches` with the accepted normalized fields, lifecycle evidence, exact odometers, and timestamps.
- **IMPLEMENT**: Add restrictive foreign keys to driver, vehicle, requesting office, creator, and optional cancellation actor.
- **IMPLEMENT**: Add named checks for status, odometer values, final-reading order, and lifecycle coherence.
- **IMPLEMENT**: Add list and future-schedule-supporting indexes without conflict columns or tables.
- **IMPLEMENT**: Add `VehicleDispatchesTable` to the Kysely database types.
- **IMPLEMENT**: Make `down()` drop the dispatch table cleanly. No permissions are added or removed.
- **PATTERN**: Mirror migrations `000004`, `000005`, and `000007` after the prerequisite is present.
- **GOTCHA**: Migration runtime imports must remain compatible outside the Next.js alias loader.
- **GOTCHA**: MySQL constraint names are schema-wide. Use dispatch-specific names.
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/dispatch/migration.test.ts`
- **SATISFIES**: AC3, AC4, AC6, AC12

### Task 4 — CREATE the cursor codec and Kysely dispatch repository

- **IMPLEMENT**: Map binary UUIDs, exact decimal strings, civil dates, statuses, lifecycle evidence, and joined labels.
- **IMPLEMENT**: Add historical detail, primary-row locked mutation lookup, insert, draft update, and lifecycle persistence methods.
- **IMPLEMENT**: Preserve master-data labels after office, driver, or vehicle soft deletion.
- **IMPLEMENT**: Add free text, status, office, and inclusive travel-date filters.
- **IMPLEMENT**: Add filter-bound keyset pagination ordered by travel date and public ID descending.
- **IMPLEMENT**: Cap results at 200 and fetch one extra row for the next cursor.
- **PATTERN**: Mirror budget pagination and FVD-006's primary-row lock before historical joins.
- **GOTCHA**: Do not use `FOR UPDATE` on the multi-table detail join.
- **GOTCHA**: Current selectors filter lifecycle. Historical joins do not.
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/dispatch/repositories.test.ts`
- **SATISFIES**: AC1, AC2, AC5, AC6, AC7

### Task 5 — CREATE transaction-local dispatch repositories and composition

- **IMPLEMENT**: Construct dispatch, office, driver, vehicle, and audit repositories from the same Kysely transaction.
- **IMPLEMENT**: Add `KyselyDispatchTransaction` and a frozen `DispatchComposition`.
- **IMPLEMENT**: Inject the existing clock, UUIDv7 generator, and permission policy.
- **IMPLEMENT**: Spread the dispatch composition into the root composition.
- **PATTERN**: Mirror `create-kysely-budget-repositories.ts`, `kysely-budget-transaction.ts`, and `composition/budget.ts`.
- **GOTCHA**: Reuse the existing master-data repositories. Do not add dispatch-specific driver, vehicle, or office persistence abstractions.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/infrastructure/composition/dispatch.test.ts tests/unit/infrastructure/composition/root.test.ts`
- **SATISFIES**: AC2, AC5, AC8

### Task 6 — CREATE dispatch query and mutation use cases

- **IMPLEMENT**: Add create, detail, list, preparation options, draft update, dispatch, complete, and cancel use cases.
- **IMPLEMENT**: Check the exact permission at each use-case boundary before object access.
- **IMPLEMENT**: Create, update, and dispatch inside transactions that lock references in the accepted stable order.
- **IMPLEMENT**: Revalidate all selected references on draft update and immediately before dispatch.
- **IMPLEMENT**: Complete by locking the dispatch, checking `DISPATCHED`, applying the final odometer, persisting, and auditing.
- **IMPLEMENT**: Cancel from `DRAFT` or `DISPATCHED` with normalized reason, actor, time, persistence, and audit.
- **IMPLEMENT**: Return historical joined DTOs and derived distance without driver contact data.
- **PATTERN**: Mirror budget mutation use cases and FVD-006 transactional eligibility checks.
- **GOTCHA**: Completion must ignore later master-data ineligibility and remain possible for a valid `DISPATCHED` record.
- **GOTCHA**: Append audit before the transaction callback returns.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/dispatch`
- **SATISFIES**: AC1 through AC8

### Task 7 — PROVE MySQL locking, concurrency, and audit atomicity

- **IMPLEMENT**: Prove edit versus dispatch serializes on one draft and produces one valid final state.
- **IMPLEMENT**: Prove complete versus cancel serializes on one dispatched row and produces one terminal state.
- **IMPLEMENT**: Prove the losing command observes the committed lifecycle and returns a stable business-rule error.
- **IMPLEMENT**: Prove audit failure rolls back create, update, dispatch, complete, and cancel business changes.
- **IMPLEMENT**: Prove failed commands append no success event and successful commands append exactly one event.
- **PATTERN**: Mirror budget deterministic barriers and audit-atomicity tests.
- **GOTCHA**: Avoid sleep-based races. Coordinate transactions at explicit repository barriers.
- **GOTCHA**: Keep conflict and double-booking concurrency outside this ticket.
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/dispatch/concurrency.test.ts tests/integration/dispatch/audit-atomicity.test.ts`
- **SATISFIES**: AC3, AC5, AC8, AC13

### Task 8 — CREATE strict route, form-response, and page-query schemas

- **IMPLEMENT**: Add strict create and draft-update bodies without a client-controlled status.
- **IMPLEMENT**: Add empty dispatch, final-odometer completion, reasoned cancellation, and UUIDv7 parameter schemas.
- **IMPLEMENT**: Add query, status, office, date range, cursor, and bounded page-size schemas.
- **IMPLEMENT**: Add native GET parsing and filter-preserving cursor links.
- **IMPLEMENT**: Preserve server field errors for form focus and inline validation.
- **PATTERN**: Mirror budget route schemas, page query, cursor codec tests, and form response.
- **GOTCHA**: Normalize empty GET values to `undefined` before Zod validation.
- **GOTCHA**: Parse odometers as strings and civil dates without timezone conversion.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/lib/dispatch tests/unit/infrastructure/database/dispatch-cursor-codec.test.ts`
- **SATISFIES**: AC4, AC7, AC9

### Task 9 — CREATE protected server access and Route Handlers

- **IMPLEMENT**: Authenticate every collection, detail, preparation, and action request.
- **IMPLEMENT**: Record durable authorization denials and require the exact action permission.
- **IMPLEMENT**: Enforce JSON content type, trusted origin, and Cross-Site Request Forgery protection on mutations.
- **IMPLEMENT**: Add collection GET/POST, detail GET/PATCH, dispatch POST, complete POST, cancel POST, and preparation GET handlers.
- **IMPLEMENT**: Await Next.js 16 dynamic parameters and forward validated commands to thin use-case calls.
- **IMPLEMENT**: Return 201 for creation and stable safe envelopes for every other outcome.
- **PATTERN**: Mirror budget Route Handlers and installed Next.js route documentation.
- **GOTCHA**: UI permission filtering is not an authorization boundary.
- **GOTCHA**: Do not return sequential IDs, database constraint text, or inaccessible-object existence.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/app/api/dispatches`
- **SATISFIES**: AC1, AC7, AC9

### Task 10 — CREATE the dispatch page design contract

- **IMPLEMENT**: Add `dispatch-management.md` as a page-level extension of the saved master design system.
- **IMPLEMENT**: Document list hierarchy, filters, responsive table/cards, form sections, detail lifecycle panel, and status semantics.
- **IMPLEMENT**: Document dispatch, completion, and cancellation dialog behavior with pending, error, success, and terminal states.
- **IMPLEMENT**: Document 44-pixel targets, visible focus, first-error focus, focus return, dark mode, reduced motion, and 200-percent zoom.
- **IMPLEMENT**: Record that FVD-008 availability and conflict warnings are intentionally absent.
- **PATTERN**: Mirror the budget page contract while using the UI UX Pro Max and UI Styling findings described above.
- **GOTCHA**: Do not replace the existing Lexend and Source Sans 3 typography with the advisory search output.
- **VALIDATE**: `rg -n "MASTER|Server Component|DRAFT|DISPATCHED|COMPLETED|CANCELLED|44|reduced motion|dark mode|FVD-008" design-system/fuel-and-vehicle-dispatch-management-system/pages/dispatch-management.md`
- **SATISFIES**: AC10, AC11, AC12

### Task 11 — CREATE dispatch form, filters, results, status, and lifecycle components

- **IMPLEMENT**: Build the sectioned create/edit form with operational selectors and accessible field errors.
- **IMPLEMENT**: Build deep-linkable filters and responsive desktop table/mobile cards.
- **IMPLEMENT**: Build non-color status badges and a plain-language lifecycle summary.
- **IMPLEMENT**: Build dispatch confirmation, completion, and cancellation dialogs.
- **IMPLEMENT**: Compute live completion distance with exact decimal logic after valid input.
- **IMPLEMENT**: Preserve values after expected errors, prevent duplicate submissions, and manage focus correctly.
- **PATTERN**: Reuse existing shadcn primitives, form status, result layout, and lifecycle dialog patterns.
- **GOTCHA**: Do not call `router.push` and `router.refresh` concurrently after successful creation.
- **GOTCHA**: Do not add client-only authorization assumptions or expose ineligible options from cached client state.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/components/dispatch-components.test.ts`
- **SATISFIES**: AC1, AC3, AC4, AC10, AC11

### Task 12 — CREATE protected pages and extend the collapsible sidebar

- **IMPLEMENT**: Add dispatch list, create, detail, loading, and error routes as Server Components.
- **IMPLEMENT**: Load list filters, permissions, detail records, and preparation options through server access helpers.
- **IMPLEMENT**: Show only actions allowed by both permission and lifecycle.
- **IMPLEMENT**: Add Dispatch to the Operations group when navigation access includes `dispatch.read`.
- **IMPLEMENT**: Preserve the desktop collapse button, collapsed icon tooltips, mobile drawer, active state, and existing groups.
- **IMPLEMENT**: Keep terminal records readable with reference labels, lifecycle timestamps, cancellation evidence, odometers, and distance.
- **PATTERN**: Mirror budget pages and the FVD-006 protected navigation.
- **GOTCHA**: Do not reintroduce the old top navigation while resolving the FVD-006 base dependency.
- **GOTCHA**: Read-only users may view allowed records but receive no hidden or disabled mutation affordances.
- **VALIDATE**: `pnpm typecheck`
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/components/dispatch-components.test.ts tests/unit/infrastructure/composition/dispatch.test.ts`
- **SATISFIES**: AC1, AC6, AC7, AC10, AC11

### Task 13 — ADD end-to-end workflow, security, and accessibility coverage

- **IMPLEMENT**: Cover create, edit, dispatch, complete, derived distance, and cancel journeys with a Dispatch Officer.
- **IMPLEMENT**: Verify inactive drivers and unserviceable vehicles are absent from selectors and rejected by direct API requests.
- **IMPLEMENT**: Verify terminal records have no actions and reject direct mutation requests.
- **IMPLEMENT**: Verify historical labels remain visible after linked master-data soft deletion.
- **IMPLEMENT**: Verify read-only navigation, list, detail, and denied mutation behavior.
- **IMPLEMENT**: Verify edited public IDs, unauthenticated detail access, Cross-Site Request Forgery failures, and generic not-found responses.
- **IMPLEMENT**: Add Axe scans for populated list, create form, detail, and every open lifecycle dialog.
- **IMPLEMENT**: Cover mobile layout, desktop sidebar collapse, keyboard workflow, dark mode, reduced motion, zoom, and overflow.
- **PATTERN**: Mirror budget lifecycle, permission, and accessibility Playwright suites.
- **GOTCHA**: Use deterministic fixture credentials. Do not embed or enter one-time administrator credentials.
- **VALIDATE**: `pnpm exec playwright test tests/e2e/dispatches.spec.ts tests/e2e/dispatch-permissions.spec.ts tests/e2e/accessibility.spec.ts --project=chromium`
- **SATISFIES**: AC1 through AC13

### Task 14 — UPDATE regression assumptions, cleanup order, and documentation

- **IMPLEMENT**: Update every migration count, rollback depth, and up/down/up assertion for migration `000008`.
- **IMPLEMENT**: Delete dispatch rows before driver, vehicle, office, and user fixtures in every affected helper.
- **IMPLEMENT**: Extend README documentation with routes, permissions, lifecycle, eligibility timing, exact odometers, and deferred conflicts.
- **IMPLEMENT**: Run repository searches for stale migration counts, obsolete top-navigation assumptions, and unsafe cleanup order.
- **GOTCHA**: Do not change permission-count assertions merely because migration `000008` exists; it seeds no permissions.
- **VALIDATE**: `rg -n "00000[1-8]|migration|vehicle_dispatches|dispatch\." tests README.md src/infrastructure/database`
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/database tests/integration/master-data tests/integration/budget tests/integration/dispatch`
- **SATISFIES**: AC6, AC7, AC9, AC13

### Task 15 — RUN the full project gate and local Docker smoke test

- **VERIFY**: Run formatting, lint, type checking, unit coverage, MySQL integration, Chromium end-to-end, and production build checks.
- **VERIFY**: Confirm the Docker application, MySQL, Traefik, and shared network remain healthy.
- **VERIFY**: Apply migrations in order and confirm the dispatch page resolves through `https://fvdms.lan`.
- **VERIFY**: Exercise one draft-to-completed journey and one draft-to-cancelled journey with an authorized deterministic test principal.
- **VERIFY**: Confirm audit events exist for each successful transition and no event exists for rejected commands.
- **GOTCHA**: Do not diagnose a browser redirect loop as container failure until cookies and session state are checked separately.
- **VALIDATE**: `pnpm format:check`
- **VALIDATE**: `pnpm lint`
- **VALIDATE**: `pnpm typecheck`
- **VALIDATE**: `pnpm test:coverage`
- **VALIDATE**: `pnpm test:integration`
- **VALIDATE**: `pnpm exec playwright test --project=chromium`
- **VALIDATE**: `pnpm build`
- **VALIDATE**: `git diff --check`
- **VALIDATE**: `docker compose ps`
- **VALIDATE**: `docker compose exec app pnpm db:status`
- **VALIDATE**: `curl -kI https://fvdms.lan/dispatches`
- **SATISFIES**: AC13 and release readiness

---

## TESTING STRATEGY

### Unit tests

- Test every legal and illegal lifecycle transition.
- Test draft-only editing and terminal immutability.
- Test negative odometers, excess decimal places, final below initial, equality, and exact derived distance.
- Test civil-date syntax without timezone shifting or date-order assumptions.
- Test passenger, destination, purpose, and cancellation-reason boundaries.
- Test every permission assertion and inaccessible-object behavior.
- Test active, inactive, serviceable, unserviceable, current, and deleted eligibility combinations.
- Test preparation-option DTOs and contact-data exclusion.
- Test strict route bodies, UUIDv7 parameters, page limits, cursor fingerprints, and form error mapping.

### MySQL integration tests

- Inspect columns, exact decimal types, checks, foreign keys, and indexes.
- Prove invalid status, negative odometer, final-reading order, and incoherent lifecycle writes fail at the database boundary.
- Prove migration down and up are reversible after all later dependencies are removed.
- Prove current operational options exclude ineligible records.
- Prove historical reads retain soft-deleted office, driver, and vehicle labels.
- Prove keyset paging is stable and cursors reject mismatched filters.
- Prove row locks serialize edit versus dispatch and complete versus cancel.
- Prove outbox failure rolls back every dispatch mutation.

### API and security tests

- Cover unauthenticated, unauthorized, invalid origin, missing token, wrong content type, malformed body, and invalid public ID.
- Cover the exact permission for each action rather than a single broad management permission.
- Cover list and detail read access separately from mutation access.
- Cover edited-public-ID bypass attempts and generic not-found behavior.
- Cover expected validation, business-rule, and conflict envelopes without internal details.
- Cover bounded pagination and no-store response behavior.

### Browser tests

- Complete one draft, edit, dispatch, and completion journey.
- Complete one draft and cancellation journey with a recorded reason.
- Verify exact distance at equality and a nonzero decimal example.
- Verify live ineligible selector behavior and server rejection of stale selections.
- Verify read-only navigation, pages, and absent mutation controls.
- Verify terminal history after linked master-data deletion.
- Verify sidebar desktop collapse and mobile drawer behavior on dispatch routes.
- Verify keyboard use, dialog focus, error announcements, dark mode, reduced motion, zoom, responsive cards, and horizontal overflow.

## Manual Verification Checklist

1. Open `https://fvdms.lan/dispatches` with a Dispatch Officer test session.
2. Collapse and expand the desktop sidebar, then repeat navigation through the mobile drawer.
3. Create a draft using current active master data and a decimal initial odometer.
4. Edit the draft and confirm the detail page shows the updated values.
5. Make one selected master-data record ineligible and confirm dispatch is blocked after revalidation.
6. Restore eligibility, dispatch the trip, and confirm ordinary fields are no longer editable.
7. Complete with a smaller final odometer and confirm a field-level error appears.
8. Complete with a valid final odometer and confirm the exact derived distance.
9. Create another draft, cancel it with a reason, and confirm it remains readable but immutable.
10. Inspect audit history for created, updated, dispatched, completed, and cancelled events.
11. Repeat list and detail access with a read-only principal and confirm mutation controls remain absent.
12. Soft-delete a linked driver or vehicle after completion and confirm its historical label still appears.

## Observability and Operational Notes

- Keep existing structured request logging and request IDs. Do not add raw payload logging.
- Audit snapshots use public IDs and allowlisted operational values only.
- Completion and cancellation failures should identify the stable application error category without leaking current inaccessible state.
- Monitor deadlocks and lock-wait timeouts during integration and later staging validation.
- FVD-008 must reuse the dispatch transaction and schedule indexes rather than bypassing this lifecycle boundary.

## Rollback Strategy

- Before production data exists, rollback migration `000008` only after removing routes and code that reference `vehicle_dispatches`.
- After dispatch data exists, disable new dispatch mutations through deployment rollback while preserving the table and historical rows.
- Never hard-delete completed or cancelled data as a rollback technique.
- Never reorder migration history or enable unordered migrations to bypass the FVD-006 prerequisite.

## Definition of Done

- The FVD-006 implementation prerequisite is present and migration `000008` follows `000007`.
- Every accepted decision is encoded in domain, application, database, API, and UI tests.
- All five dispatch permissions are enforced at server and use-case boundaries.
- Create, update, and dispatch revalidate operational references inside transactions.
- Completion and cancellation remain available for valid historical work after later reference changes.
- Odometer values remain exact and derived distance is never independently persisted.
- Every successful mutation and its audit event commit atomically.
- Historical labels survive master-data soft deletion.
- The collapsible navigation includes Dispatch without regressing desktop or mobile behavior.
- FVD-008 conflict behavior remains absent and clearly deferred.
- The full validation suite and Docker smoke test pass.

## Complexity and Risk Assessment

**Estimated complexity**: High

The ticket crosses every architectural layer and includes two concurrency-sensitive lifecycle transitions. It also depends on a missing prior migration in the current base.

**Highest risks**:

1. Migration `000008` could be applied before FVD-006 migration `000007` unless the base is corrected first.
2. Joined locking reads could lock unnecessary master-data rows or behave differently than intended.
3. Floating-point conversion could corrupt odometer validation or derived distance.
4. Stale draft eligibility could bypass current driver, vehicle, or office state without final dispatch revalidation.
5. Historical joins could accidentally hide soft-deleted master data.
6. UI lifecycle visibility could drift from server permissions or aggregate state.
7. FVD-008 conflict behavior could leak into this ticket and inflate scope.

**Mitigations**:

- Make the FVD-006 base check Task 0 and reserve migration `000008`.
- Lock the primary dispatch row before historical joins and lock master data in one stable order.
- Carry odometers as decimal strings through every layer and test exact arithmetic.
- Revalidate all references inside create, draft update, and dispatch transactions.
- Separate operational selector queries from historical detail queries.
- Treat UI actions as affordances only and enforce every rule server-side.
- Test and document the FVD-008 boundary explicitly.

## Planning Confidence

**Confidence**: 94%

The Product Requirements Document, architecture, ticket acceptance criteria, current code patterns, and official database and framework guidance align strongly. The accepted defaults resolve the explicit dispatch action, cancellation evidence, eligibility timing, date ordering, object scope, odometer continuity, and FVD-008 schema boundary.

The remaining uncertainty is operational rather than conceptual. Implementation must first correct the FVD-006 branch and migration base, then validate the actual merged sidebar and decimal APIs before editing dependent files.
