# Feature: Detect dispatch conflicts and show driver and vehicle availability

The following plan is complete for FVD-008. Validate the current branch, migration order, and documented implementation base before changing code.

Use the established dispatch aggregate, transaction, audit, authorization, design-system, and testing seams. Extend the FVD-007 module instead of creating a parallel scheduling subsystem.

## Feature Description

FVD-008 extends vehicle dispatch with server-authoritative same-day conflict detection. It prevents silent double booking of drivers and vehicles while preserving an explicit, permission-controlled exception workflow.

The initial scheduler uses `travelDate` as the entire occupied period. The existing nullable `travelStartAt` and `travelEndAt` columns remain reserved for a later interval-scheduling ticket and stay unexposed.

The system supports two global policies. `BLOCK` rejects every conflicting mutation. `WARN_AND_ACK` returns safe conflict details and allows an authorized user to continue only after reviewing the current conflict set and providing a reason.

Every accepted override produces append-only operational acknowledgment rows and immutable audit evidence. The final mutation recomputes conflicts under resource locks and rejects stale or edited acknowledgment payloads.

Authorized users receive day, week, and month schedule views for drivers and vehicles. The dispatch form shows advisory availability before submission, while the server remains the only authority.

## User Story

As authorized dispatch staff
I want to see driver and vehicle schedules before saving a dispatch
So that I can avoid double booking or record an approved operational exception with defensible evidence

## Problem Statement

FVD-007 records dispatch lifecycle and odometer facts, but it does not coordinate competing reservations. Two users can currently prepare records for the same driver or vehicle on the same date without receiving any warning.

Client-only availability is insufficient because it can become stale, be bypassed, or race with another request. The application needs a final transactional conflict check, a clear policy outcome, an explicit override contract, and bounded schedule queries.

## Solution Statement

Add dispatch scheduling value objects, conflict DTOs, repository ports, use cases, persistence adapters, APIs, and user interfaces inside the existing dispatch module.

Create migration `20260829_000009_create_dispatch_scheduling.ts`. It adds a global schedule-policy singleton, append-only conflict-override records, and two explicit permissions. It does not alter migration `000008` or add duplicate override columns to `vehicle_dispatches`.

Serialize authoritative checks by locking the selected office, driver, and vehicle rows in the existing order. Read the effective policy with a compatible shared lock, then perform a current locking conflict query before persistence.

Return typed conflict context through the standard error envelope with HTTP `409`. The context contains the effective policy, safe conflicting dispatch summaries, override capability, and a deterministic server-generated fingerprint.

Use native GET parameters for schedule dates, views, and filters. Render the schedule page as a Server Component with responsive semantic calendars and mobile agenda fallbacks.

## Out of Scope / Non-Goals

- Not included: time-of-day scheduling, time-zone interval overlap, editing `travelStartAt`, or editing `travelEndAt`.
- Not included: per-office, per-role, per-vehicle, or workflow-specific conflict policies. A single global policy is the accepted FVD-008 scope.
- Not included: maintenance windows, driver leave, holidays, recurring schedules, route duration, or travel-time estimates.
- Not included: drag-and-drop rescheduling, resize handles, resource timelines, or a client-heavy calendar library.
- Not included: offline conflict acknowledgment or synchronization. FVD-010 must re-run the same server-authoritative workflow.
- Not included: utilization reports, Excel exports, charts, or background jobs. FVD-009 owns reporting.
- Not included: approval chains beyond the accepted override permission and reason.
- Not included: editing or deleting conflict acknowledgment history.
- Not included: changing dispatch lifecycle states, odometer rules, cancellation rules, or master-data eligibility.
- Not included: office-scoped user tenancy. The current authorization model remains LGU-wide and permission-based.
- Not included: changing authentication, the global multi-factor authentication setting, audit chaining, or audit delivery.
- Not changing: `COMPLETED` and `CANCELLED` terminal-state behavior.
- Not changing: opaque UUIDv7 public identifiers or the existing safe dispatch label projections.

## Feature Metadata

**Feature Type**: Enhancement / New Capability

**Estimated Complexity**: High

**Primary Systems Affected**: Dispatch domain and application services, MySQL migration and locking, Kysely repositories, immutable audit outbox, role-based access control, HTTP error contracts, Next.js Route Handlers, protected pages, responsive schedule UI, administrative settings, Vitest, MySQL integration tests, and Playwright

**Dependencies**: FVD-007 merged through pull request #7; FVD-003 durable audit capture; FVD-004 office, driver, and vehicle master data; existing Next.js 16.3.3, React 19.2.8, Kysely 0.29.5, MySQL 8.4, Zod 4.4.3, React Hook Form 7.86.0, Radix Dialog/AlertDialog, Lucide React, and Tailwind CSS 4.3.3

**New runtime dependencies**: None

## Related Work

**Implements**: FVD-008 in `docs/tickets/fuel-and-vehicle-dispatch-system.md`

**Epic**: `docs/PRD.md`

**Architecture**: `docs/System_Architecture.md`

**Back-references**:

- `.claude/plans/dispatch-vehicles-with-eligibility-lifecycle-and-odometer-controls.md` defines the aggregate, lifecycle, transaction, routes, UI, reserved interval columns, and schedule indexes extended here.
- `.claude/reports/dispatch-vehicles-with-eligibility-lifecycle-and-odometer-controls-report.md` records the implemented FVD-007 deviations and validation evidence.
- `.claude/plans/deliver-authentication-sessions-rbac.md` defines role administration and permission assignment behavior.
- `.claude/plans/establish-durable-immutable-audit-capture-verification.md` defines transaction-scoped audit capture and safe metadata.
- `.claude/plans/manage-office-driver-vehicle-master-data.md` defines current locked resource reads and historical label resolution.
- `.claude/plans/manage-budget-allocations-fiscal-eligibility.md` defines singleton policy and administrative settings patterns reused here.

**Forward-references**:

- FVD-009 will consume schedule queries for dispatch reporting and utilization exports.
- FVD-010 must call the same authoritative conflict resolver during synchronized mutations.
- A later interval-scheduling ticket may expose the reserved timestamps and replace same-day matching with overlap rules.
- A later policy ticket may add office-specific settings without changing the conflict-policy port.

## Execution Prerequisite

Pull request #7 is merged into `origin/main` at merge commit `b48b63b`. The analyzed feature commit is `16ec465`.

The current checkout is the clean, merged FVD-007 feature branch. Before implementation, fetch `origin`, update local `main` to `origin/main`, and create a new FVD-008 branch from that updated base.

Use migration number `000009`. Do not edit or reorder migrations `000001` through `000008`. The migrator does not allow unordered migrations.

Recommended branch name: `feature/detect-dispatch-conflicts-show-availability`.

---

## ACCEPTED DECISION CONTRACT

The user accepted all recommended defaults on 2026-08-29. These decisions are binding for implementation.

### Conflict granularity and reserving statuses

- Match conflicts by exact `travelDate` for FVD-008.
- Keep `travelStartAt` and `travelEndAt` null and unexposed.
- Treat `DRAFT`, `DISPATCHED`, and `COMPLETED` as same-day reservations.
- Treat `CANCELLED` as released and non-conflicting.
- Continue showing cancelled records when the user explicitly includes that status in a schedule view.
- Explain the conservative completed-trip behavior in the interface. Without time intervals, the system cannot prove a second same-day trip is non-overlapping.
- A legitimate second same-day trip proceeds through `WARN_AND_ACK` when authorized. It never proceeds silently.

### Conflict type

- Report `DRIVER` when only the selected driver matches another reserving dispatch.
- Report `VEHICLE` when only the selected vehicle matches another reserving dispatch.
- Merge matches against the same conflicting dispatch into `DRIVER_AND_VEHICLE`.
- Exclude the target dispatch itself during draft update and dispatch-transition rechecks.
- Sort conflicts by travel date, conflicting dispatch public ID, then conflict type before fingerprinting or returning them.

### Global policy

- Persist one global `dispatch_schedule_settings` row with `id = 1`.
- Support only `BLOCK` and `WARN_AND_ACK`.
- Seed `WARN_AND_ACK` as the initial policy.
- Manage the setting through an audited administrator page and protected GET/PATCH API.
- Read the policy inside the authoritative mutation transaction.
- Record the effective policy on every override row.
- Defer office-specific settings because the architecture lists them as later enhancement work.

### Permissions and initial role grants

- Add `dispatch.conflict.override` for operational conflict acknowledgment.
- Grant `dispatch.conflict.override` initially to `DISPATCH_OFFICER` and `SUPER_ADMIN`.
- Add `dispatch.settings.manage` for reading and changing the global schedule policy.
- Grant `dispatch.settings.manage` initially to `SYSTEM_ADMIN` and `SUPER_ADMIN`.
- Use `dispatch.read` for schedule pages and schedule APIs.
- Use the existing `dispatch.create` and `dispatch.update` checks for the underlying mutations.
- Do not infer override authority from create, update, read, role name, or UI visibility.
- Role administrators may later remove or grant these permissions through the existing role-management workflow.

### Authoritative conflict workflow

- Advisory reads never acquire serialization locks and never authorize a mutation.
- Create, draft update, and the `DRAFT` to `DISPATCHED` transition perform authoritative conflict checks.
- Lock current master-data references before the final conflict query.
- Read the policy with `FOR SHARE` so the effective policy cannot change before the mutation commits.
- Use a current locking conflict read. Do not use a plain consistent read under MySQL `REPEATABLE READ`.
- `BLOCK` always returns a conflict response. An acknowledgment payload cannot bypass it.
- `WARN_AND_ACK` without an acknowledgment returns a conflict response.
- `WARN_AND_ACK` with acknowledgment requires `dispatch.conflict.override`, an accepted review checkbox, a normalized reason, and the current fingerprint.
- An acknowledgment submitted when no conflict exists is invalid and creates no evidence.
- A stale or edited fingerprint returns the newly computed conflict response and requires another review.
- A successful mutation and all override and audit rows commit atomically.

### Conflict fingerprint

- Generate a deterministic SHA-256 fingerprint through an application port and Node infrastructure adapter.
- Include a schema version, effective policy, settings update timestamp, candidate travel date, candidate driver ID, candidate vehicle ID, excluded dispatch ID, and sorted conflict ID/type pairs.
- Return the fingerprint only with the safe conflict response.
- Accept the fingerprint back only as stale-review evidence. It is not authentication, authorization, or conflict truth.
- Recompute conflicts and the fingerprint inside the final transaction. Never trust client-supplied conflict identifiers.

### Existing acknowledgments and dispatch transition

- Append one operational override row for each conflicting dispatch in an accepted command.
- Never update or delete an older override row after rescheduling.
- Create and draft-update commands acknowledge their current conflict set.
- The dispatch transition rechecks conflicts to protect drafts created before FVD-008 and drafts whose surroundings changed later.
- Under `WARN_AND_ACK`, the transition may reuse existing evidence only when every current conflicting dispatch and conflict type has a matching prior acknowledgment for that dispatch.
- A new or changed conflict requires a fresh acknowledgment and reason.
- Under `BLOCK`, existing acknowledgments do not bypass the current policy.

### Operational acknowledgment history

- Show a read-only `Schedule conflict acknowledgments` section on dispatch detail.
- Show the conflicting dispatch link, conflict type, effective policy, reason, actor public ID, and acknowledgment time.
- Resolve dispatch labels historically, including soft-deleted driver, vehicle, and office references.
- Do not expose internal IDs, driver contact information, IP addresses, or user-agent values.
- Keep the immutable audit trail as the authoritative compliance record.

### Schedule interface

- Add `/dispatches/schedule` as a protected Server Component page.
- Link Schedule from the Dispatch page header. Do not add a second Operations sidebar destination.
- Store `view`, `date`, office, driver, vehicle, and status filters in native GET parameters.
- Render day as a grouped agenda.
- Render week as seven labeled columns from 768 pixels upward and a grouped agenda below 768 pixels.
- Render month as a semantic calendar table or seven-column date grid from 640 pixels upward and a grouped agenda below 640 pixels.
- Use ordinary links for previous, today, next, view changes, and dispatch details.
- Do not implement drag-and-drop or an ARIA application grid.
- Show explicit availability only when a driver or vehicle is selected.
- Without a selected resource, show schedule records and conflict counts rather than claiming broad availability.
- Keep schedule records capped at 200 and show a truncation warning. Compute occupancy separately so truncation never creates a false `Available` state.

### Inline form availability

- Run advisory checks after travel date, driver, and vehicle values are complete.
- Cancel stale advisory requests with `AbortController`.
- Announce loading, available, conflicting, and failed states through a polite live region.
- Preserve form values and permit authoritative submission even when the advisory request fails.
- Open a Radix Dialog after an authoritative `409 DISPATCH_SCHEDULE_CONFLICT`.
- Show all safe conflict details with text and icons, never color alone.
- Require a reviewed checkbox and a 10-to-500-character reason before resubmission.
- Reset the reviewed checkbox and return focus to the changed conflict summary when the server returns a fresh fingerprint.

### Dispatch list filter annotations

- Replace the lengthy visible label `Destination, purpose, driver, vehicle, or office` with the concise label `Search dispatches`.
- Keep the searchable fields discoverable through concise placeholder or helper text without relying on placeholder text as the accessible label.
- Align the search input's top edge and height with Status, Requesting office, Travel date from, and Travel date to at desktop widths.
- Preserve the existing stacked mobile layout, visible focus treatment, and native GET filter behavior.
- Add a responsive regression assertion for the search field label and control alignment.

---

## ACCEPTANCE CRITERIA

- **AC1 — Driver conflicts**: Creating, editing, or dispatching detects another reserving dispatch using the same driver and travel date.
- **AC2 — Vehicle conflicts**: Creating, editing, or dispatching detects another reserving dispatch using the same vehicle and travel date.
- **AC3 — Combined conflicts**: A single conflicting dispatch matching both resources is returned once as `DRIVER_AND_VEHICLE`.
- **AC4 — Reservation policy**: `DRAFT`, `DISPATCHED`, and `COMPLETED` reserve the day; `CANCELLED` does not.
- **AC5 — Policy behavior**: `BLOCK` always rejects. `WARN_AND_ACK` requires explicit confirmation, reason, permission, and a current fingerprint.
- **AC6 — Concurrency safety**: Resource locks and a current conflict read prevent concurrent unacknowledged double booking.
- **AC7 — Stale acknowledgment safety**: A changed policy, candidate, or conflict set returns a fresh `409` and requires another review.
- **AC8 — Atomic evidence**: Accepted mutations, override rows, normal dispatch audit, and conflict-override audit commit or roll back together.
- **AC9 — Immutable history**: Override rows are append-only and remain readable after later schedule changes or master-data deletion.
- **AC10 — Global administration**: Authorized administrators can read and change the global policy, initially `WARN_AND_ACK`, with immutable audit evidence.
- **AC11 — Authorization**: Schedule reads, overrides, settings changes, and dispatch objects enforce their exact server-side permissions.
- **AC12 — Protected API**: State changes enforce authentication, strict JSON schemas, trusted origin, Cross-Site Request Forgery protection, opaque identifiers, and safe errors.
- **AC13 — Schedule queries**: Day, week, and month schedules filter by office, driver, vehicle, and status with bounded results.
- **AC14 — Availability guidance**: The form shows advisory driver and vehicle availability before save without treating it as authoritative.
- **AC15 — Responsive interface**: Schedules remain usable at 375, 768, 1024, and 1440 pixels with an agenda fallback.
- **AC16 — Accessible interface**: Calendars, filters, dialogs, errors, status, and live updates are keyboard and screen-reader accessible.
- **AC17 — Historical detail**: Dispatch detail shows read-only acknowledgment evidence and authorization-aware conflict links.
- **AC18 — No interval scope leak**: Reserved travel timestamps remain null and unexposed.
- **AC19 — Verification**: Domain, application, API, repository, migration, concurrency, audit, authorization, accessibility, and end-to-end tests pass.

---

## CONTEXT REFERENCES

### Relevant Codebase Files — Read Before Implementing

#### Product and architecture

- `docs/tickets/fuel-and-vehicle-dispatch-system.md` lines 259–290 — FVD-008 scope, acceptance criteria, seams, estimate, and prerequisite.
- `docs/tickets/fuel-and-vehicle-dispatch-system.md` lines 432–478 — dependency graph and release sequence.
- `docs/PRD.md` lines 442–481 — conflict details, policies, final recheck, permissions, and bypass resistance.
- `docs/PRD.md` lines 483–511 — driver and vehicle day/week/month schedules and inline availability.
- `docs/PRD.md` lines 559–627 — performance, accessibility, integrity, privacy, and collection bounds.
- `docs/PRD.md` lines 632–742 — responsive UI, normalized data, API security, and authoritative synchronization.
- `docs/PRD.md` lines 823–876 — audit requirements and double-booking threat mitigations.
- `docs/PRD.md` lines 919–945 — release acceptance for schedules, conflicts, permitted overrides, and blocked conflicts.
- `docs/PRD.md` lines 983–1003 — non-negotiable engineering constraints.
- `docs/System_Architecture.md` lines 56–65 — Clean Architecture responsibilities and thin Route Handlers.
- `docs/System_Architecture.md` lines 182–203 — dispatch planning interval and reserved timestamps.
- `docs/System_Architecture.md` lines 305–360 — normalized scheduling tables and relationships.
- `docs/System_Architecture.md` lines 500–550 — dispatch schedule indexes and conflict-override schema.
- `docs/System_Architecture.md` lines 555–618 — immutable audit and durable outbox behavior.
- `docs/System_Architecture.md` lines 622–678 — role-based permission checks and server authority.
- `docs/System_Architecture.md` lines 701–710 — schedule and conflict API surface.
- `docs/System_Architecture.md` lines 743–759 — scheduling use cases and typed conflict workflow.
- `docs/System_Architecture.md` lines 772–816 — safe error envelope, DTOs, and opaque identifiers.
- `docs/System_Architecture.md` lines 839–866 — transaction and dispatch locking boundaries.
- `docs/System_Architecture.md` lines 948–1008 — conflict error category, safe logging, and security controls.
- `docs/System_Architecture.md` lines 1012–1078 — interface, accessibility, test, and security expectations.
- `docs/System_Architecture.md` lines 1191–1195 — office-specific policy as a future enhancement.

#### FVD-007 dispatch domain and application

- `src/domain/dispatch/entities/vehicle-dispatch.ts` lines 8–32 and 34–97 — draft schedule fields and draft-only edit behavior.
- `src/domain/dispatch/value-objects/dispatch-status.ts` — accepted lifecycle and status predicates.
- `src/domain/dispatch/value-objects/dispatch-date.ts` — strict civil-date parsing without time-zone shifting.
- `src/application/dispatch/dto/dispatch-dtos.ts` lines 33–55, 83–110, and 116–140 — detail, command, preparation, and response mapping.
- `src/application/dispatch/ports/dispatch-repository.ts` lines 8–15 — repository seam to extend with read and lock-order support.
- `src/application/dispatch/ports/dispatch-transaction.ts` lines 7–16 — transaction repository bundle.
- `src/application/dispatch/ports/dispatch-use-case-dependencies.ts` lines 6–11 — common dispatch dependency object.
- `src/application/dispatch/services/dispatch-permission-policy.ts` lines 5–48 — explicit permission assertions.
- `src/application/dispatch/services/dispatch-audit-events.ts` lines 5–61 — allowlisted dispatch snapshots and action names.
- `src/application/dispatch/services/dispatch-use-case-support.ts` lines 18–118 — validation and domain-error mapping.
- `src/application/dispatch/use-cases/create-dispatch.ts` lines 28–83 — current resource-lock, insert, and audit sequence.
- `src/application/dispatch/use-cases/update-draft-dispatch.ts` lines 27–80 — current update lock order and audit sequence.
- `src/application/dispatch/use-cases/dispatch-vehicle.ts` lines 25–75 — transition revalidation and transaction boundary.
- `src/application/dispatch/use-cases/get-dispatch.ts` lines 9–23 — detail query and object authorization.
- `src/application/dispatch/use-cases/list-dispatches.ts` lines 9–24 — query permission and DTO mapping.

#### Persistence and composition

- `src/infrastructure/database/migrations/20260828_000008_create_dispatch_workflow.ts` lines 5–139 — immutable predecessor schema, reserved timestamps, and schedule indexes.
- `src/infrastructure/database/migrations/20260828_000006_create_authentication_settings.ts` lines 7–91 — singleton setting, permissions, role grants, and reversible migration pattern.
- `src/infrastructure/database/migrations/20260828_000005_create_budget_allocations.ts` lines 90–149 — later permission seeding pattern.
- `src/infrastructure/database/types.ts` lines 268–317 — dispatch table and database registry types.
- `src/infrastructure/database/dispatch/kysely-dispatch-repository.ts` lines 23–61 — public lookup and current dispatch row lock.
- `src/infrastructure/database/dispatch/kysely-dispatch-repository.ts` lines 63–138 — insert and update mapping.
- `src/infrastructure/database/dispatch/kysely-dispatch-repository.ts` lines 140–270 — bounded list and historical joined labels.
- `src/infrastructure/database/dispatch/kysely-dispatch-transaction.ts` lines 17–29 — Kysely transaction boundary.
- `src/infrastructure/database/dispatch/create-kysely-dispatch-repositories.ts` lines 20–30 — transaction-scoped repository factory.
- `src/infrastructure/database/auth/kysely-authentication-settings-repository.ts` lines 12–52 — singleton settings repository.
- `src/infrastructure/composition/dispatch.ts` lines 20–57 — dispatch permission, dependency, and use-case wiring.
- `src/infrastructure/composition/root.ts` lines 65–72 and 122–176 — application composition integration.

#### API, errors, and authorization

- `src/application/shared/errors/application-error.ts` lines 6–85 — error categories and existing conflict status.
- `src/lib/http/api-response.ts` lines 3–49 — standard success and error envelopes.
- `src/lib/http/with-response-handler.ts` lines 24–105 — application-error mapping and structured logging.
- `src/lib/dispatch/route-schemas.ts` lines 17–125 — strict civil dates, UUIDv7 IDs, bodies, and query validation.
- `src/lib/dispatch/page-query.ts` lines 5–48 — duplicate-parameter rejection and page query mapping.
- `src/lib/dispatch/server-dispatch-access.ts` lines 10–51 and 54–92 — dispatch access actions and audited denial.
- `src/lib/dispatch/dispatch-form-response.ts` lines 1–39 — current browser response parser that must preserve typed conflict context.
- `src/app/api/dispatches/route.ts` lines 17–58 — collection read and secure create mutation.
- `src/app/api/dispatches/[dispatchId]/route.ts` lines 14–52 — strict detail and update route.
- `src/app/api/dispatches/[dispatchId]/dispatch/route.ts` — dispatch transition body and secure mutation pattern.
- `src/app/api/authentication-settings/route.ts` lines 18–61 — protected singleton settings GET/PATCH pattern.

#### Existing interface and design system

- `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md` lines 15–23 and 114–210 — Server Component, responsive, accessibility, motion, and token rules.
- `design-system/fuel-and-vehicle-dispatch-management-system/pages/dispatch-management.md` lines 6–86 — existing dispatch page contract and the FVD-008 boundary to replace.
- `src/app/(protected)/dispatches/page.tsx` lines 21–112 — server-rendered list and parallel query pattern.
- `src/app/(protected)/dispatches/new/page.tsx` lines 12–50 — Server Component create page with client form leaf.
- `src/app/(protected)/dispatches/[dispatchId]/page.tsx` lines 16–86 — permission-aware detail and edit page.
- `src/components/dispatches/dispatch-draft-form.tsx` lines 34–95, 97–268, and 328–365 — controlled form, strict validation, preserved values, and first-error focus.
- `src/components/dispatches/dispatch-filter-form.tsx` lines 11–80 — native GET filters.
- `src/components/dispatches/dispatch-results.tsx` lines 21–143 — responsive table and mobile cards.
- `src/components/dispatches/dispatch-detail.tsx` lines 16–153 — lifecycle actions and definition lists.
- `src/components/dispatches/dispatch-confirm-dialog.tsx` lines 26–86 — retained dialog state and error focus.
- `src/components/admin/authentication-settings-form.tsx` — global settings control pattern.
- `src/app/(protected)/admin/security/page.tsx` lines 8–61 — protected administrator settings page.
- `src/components/ui/dialog.tsx` lines 29–53 — Radix focus trap, Escape behavior, and close target.
- `src/components/navigation/protected-navigation.tsx` lines 363–410 — permission-filtered navigation groups.
- `src/app/(protected)/layout.tsx` lines 6–23 — server-derived navigation access.
- `src/app/globals.css` lines 5–114 — semantic tokens and global focus treatment.

#### Test patterns

- `tests/unit/domain/dispatch/vehicle-dispatch.test.ts` — aggregate test style.
- `tests/unit/application/dispatch/dispatch-test-helpers.ts` lines 65–268 — in-memory repository and dependency harness.
- `tests/unit/application/dispatch/dispatch-use-cases.test.ts` lines 21–170 — command workflow assertions.
- `tests/unit/application/dispatch/dispatch-services.test.ts` lines 55–192 — permissions and audit snapshots.
- `tests/unit/app/api/dispatches/dispatch-routes.test.ts` lines 1–225 — route authentication, strict payload, denial, and Cross-Site Request Forgery tests.
- `tests/unit/lib/dispatch/route-schemas.test.ts` lines 25–83 — strict route schemas.
- `tests/unit/components/dispatch-components.test.ts` lines 65–192 — static component contracts.
- `tests/integration/dispatch/migration.test.ts` lines 21–150 — migration schema, down, and up assertions.
- `tests/integration/dispatch/repositories.test.ts` lines 74–228 — mapping, filters, pagination, and historical labels.
- `tests/integration/dispatch/concurrency.test.ts` lines 28–75 and 100–163 — controlled transaction races and row locks.
- `tests/integration/dispatch/audit-atomicity.test.ts` lines 54–120 — rollback on audit failure.
- `tests/integration/helpers/dispatch-test-database.ts` lines 26–152 — database setup, fixtures, and cleanup order.
- `tests/e2e/dispatches.spec.ts` lines 7–126 — browser lifecycle workflow.
- `tests/e2e/dispatch-permissions.spec.ts` lines 8–101 — direct bypass and permission checks.
- `tests/e2e/accessibility.spec.ts` lines 140–239 — responsive, dark-mode, reduced-motion, zoom, keyboard, and Axe checks.
- `tests/e2e/global-setup.ts` lines 147–273 and 355–384 — deterministic roles, users, and dispatch fixtures.

### New Files to Create

#### Domain and application

- `src/domain/dispatch/value-objects/dispatch-conflict-policy.ts` — `BLOCK` and `WARN_AND_ACK` value object.
- `src/domain/dispatch/value-objects/dispatch-conflict-type.ts` — driver, vehicle, and combined conflict type.
- `src/domain/dispatch/value-objects/dispatch-override-reason.ts` — normalized 10-to-500-character reason.
- `src/domain/dispatch/policies/dispatch-reservation-policy.ts` — accepted reserving-status predicate.
- `src/application/dispatch/ports/dispatch-schedule-repository.ts` — advisory, current-locking conflict, occupancy, and bounded schedule queries.
- `src/application/dispatch/ports/dispatch-conflict-override-repository.ts` — append-only acknowledgment and historical lookup contract.
- `src/application/dispatch/ports/dispatch-schedule-settings-repository.ts` — singleton current/shared-lock read and update contract.
- `src/application/dispatch/ports/dispatch-conflict-fingerprint-port.ts` — deterministic fingerprint boundary.
- `src/application/dispatch/services/dispatch-conflict-resolution.ts` — shared policy, fingerprint, permission, and evidence decision flow.
- `src/application/dispatch/services/dispatch-schedule-audit-events.ts` — override and settings-change audit builders.
- `src/application/dispatch/use-cases/check-dispatch-schedule-availability.ts` — advisory conflict query.
- `src/application/dispatch/use-cases/get-dispatch-schedule.ts` — bounded general calendar query.
- `src/application/dispatch/use-cases/get-driver-schedule.ts` — driver-specific schedule query.
- `src/application/dispatch/use-cases/get-vehicle-schedule.ts` — vehicle-specific schedule query.
- `src/application/dispatch/use-cases/get-dispatch-schedule-settings.ts` — authorized global settings read.
- `src/application/dispatch/use-cases/update-dispatch-schedule-settings.ts` — atomic settings update and audit.

#### Infrastructure and migration

- `src/infrastructure/database/migrations/20260829_000009_create_dispatch_scheduling.ts` — settings, overrides, permissions, role grants, constraints, indexes, and rollback.
- `src/infrastructure/database/dispatch/kysely-dispatch-schedule-repository.ts` — conflict, occupancy, and schedule SQL.
- `src/infrastructure/database/dispatch/kysely-dispatch-conflict-override-repository.ts` — append-only override persistence and history.
- `src/infrastructure/database/dispatch/kysely-dispatch-schedule-settings-repository.ts` — singleton policy persistence and locking reads.
- `src/infrastructure/dispatch/node-sha256-dispatch-conflict-fingerprinter.ts` — stable SHA-256 adapter.

#### API and interface

- `src/app/api/dispatches/conflicts/route.ts` — advisory conflict endpoint.
- `src/app/api/dispatches/schedule/route.ts` — bounded general schedule endpoint.
- `src/app/api/drivers/[driverId]/schedule/route.ts` — driver schedule endpoint.
- `src/app/api/vehicles/[vehicleId]/schedule/route.ts` — vehicle schedule endpoint.
- `src/app/api/dispatch-schedule-settings/route.ts` — administrator policy GET/PATCH endpoint.
- `src/app/(protected)/dispatches/schedule/page.tsx` — server-rendered schedule page.
- `src/app/(protected)/dispatches/schedule/loading.tsx` — reserved-space loading state.
- `src/app/(protected)/dispatches/schedule/error.tsx` — recoverable schedule error state.
- `src/app/(protected)/admin/dispatch-settings/page.tsx` — global policy administrator page.
- `src/app/(protected)/admin/dispatch-settings/loading.tsx` — settings loading state.
- `src/app/(protected)/admin/dispatch-settings/error.tsx` — settings error state.
- `src/components/admin/dispatch-schedule-settings-form.tsx` — accessible `BLOCK`/`WARN_AND_ACK` control.
- `src/components/dispatches/dispatch-schedule-filter-form.tsx` — native GET schedule filters.
- `src/components/dispatches/dispatch-calendar.tsx` — semantic day, week, month, and agenda views.
- `src/components/dispatches/dispatch-availability-guidance.tsx` — advisory form status client leaf.
- `src/components/dispatches/dispatch-conflict-dialog.tsx` — authoritative acknowledgment dialog.
- `src/components/dispatches/dispatch-conflict-history.tsx` — read-only operational evidence.
- `src/lib/dispatch/schedule-page-query.ts` — duplicate-safe page query parsing.
- `src/lib/dispatch/calendar-date.ts` — UTC civil-date range and Asia/Manila today helpers.
- `design-system/fuel-and-vehicle-dispatch-management-system/pages/dispatch-schedule-settings.md` — page-specific administrator design contract.

#### Tests

- `tests/unit/domain/dispatch/dispatch-scheduling.test.ts`
- `tests/unit/application/dispatch/dispatch-conflict-resolution.test.ts`
- `tests/unit/application/dispatch/dispatch-schedule-use-cases.test.ts`
- `tests/unit/infrastructure/dispatch-conflict-fingerprinter.test.ts`
- `tests/unit/lib/dispatch/schedule-page-query.test.ts`
- `tests/unit/lib/dispatch/calendar-date.test.ts`
- `tests/unit/components/dispatch-schedule-components.test.ts`
- `tests/unit/app/api/dispatches/dispatch-schedule-routes.test.ts`
- `tests/integration/dispatch/schedule-repositories.test.ts`
- `tests/integration/dispatch/schedule-concurrency.test.ts`
- `tests/integration/dispatch/schedule-audit-atomicity.test.ts`
- `tests/e2e/dispatch-conflicts-and-availability.spec.ts`
- `tests/e2e/dispatch-schedule-settings.spec.ts`

### Relevant Documentation — Read Before Implementing

- [MySQL 8.4 Locking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
  - Specific section: `SELECT ... FOR SHARE` and `SELECT ... FOR UPDATE` current reads.
  - Why: A plain consistent read does not protect final conflict decisions.
- [MySQL 8.4 Transaction Isolation Levels](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html)
  - Specific section: `REPEATABLE READ` consistent snapshots and locking reads.
  - Why: The current dispatch lookup can establish a snapshot before the final conflict query.
- [Next.js 16 page `searchParams`](https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional)
  - Specific section: Promise-based `searchParams`.
  - Why: Schedule filters and view navigation are server-rendered from native GET parameters.
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
  - Specific section: choosing client leaves only for state and browser APIs.
  - Why: The calendar stays server-rendered while advisory checks and dialogs remain interactive leaves.
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
  - Specific section: supported methods and request handling.
  - Why: Schedule reads and protected settings mutations use App Router handlers.
- [WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  - Specific section: programmatically determinable status updates without moving focus.
  - Why: Advisory loading, availability, conflict, and failure messages use live regions.
- [WAI ARIA22 `role=status`](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
  - Specific section: status messages announced by assistive technology.
  - Why: Inline availability updates must not steal keyboard focus.
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` lines 12–36 and 178–190 — installed Next.js 16.3.3 boundary guidance.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` lines 67–121 and 166–185 — installed Promise-based page parameters.
- `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` lines 24–42 and 144–163 — installed Link behavior.
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` lines 13–51 — installed Route Handler behavior.
- `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md` lines 7–10 — use Playwright for async Server Components.
- `node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md` lines 115–140 — production-like browser testing.

### Patterns to Follow

**Naming conventions**:

- Use kebab-case filenames, PascalCase classes and components, camelCase DTO fields, and snake_case database columns.
- Keep permission codes in resource-to-action order: `dispatch.conflict.override` and `dispatch.settings.manage`.
- Keep API fields as public identifiers. Never expose internal `BIGINT` keys.

**Error handling**:

- Add one typed `DispatchScheduleConflictError` with stable code `DISPATCH_SCHEDULE_CONFLICT` and HTTP `409`.
- Extend the shared error envelope with an optional allowlisted JSON `context` field.
- Return validation failures as `422`, authorization failures as audited `403`, inaccessible resources as generic `404`, and transaction retry requirements as safe `409`.
- Never place SQL, stack traces, raw exception objects, internal IDs, contact numbers, or unbounded records in error context.

**Logging pattern**:

- Keep request ID, route, operation, outcome, duration, and stable error code.
- Do not log acknowledgment reasons, full conflict records, driver contact information, or raw payloads.
- Audit successful overrides and settings changes through the durable outbox instead of operational logs.

**Transaction pattern**:

```text
authorize action
  -> parse and normalize candidate
  -> resolve target without locking when resource IDs are needed
  -> lock office, driver, vehicle in stable order
  -> lock/reload target dispatch when applicable
  -> re-authorize and verify lifecycle
  -> read global policy FOR SHARE
  -> current locking conflict query, excluding target
  -> apply BLOCK or WARN_AND_ACK decision
  -> insert/update dispatch
  -> append override rows when accepted
  -> append normal dispatch audit and override audit
  -> commit
```

**Conflict response shape**:

```json
{
  "success": false,
  "error": {
    "code": "DISPATCH_SCHEDULE_CONFLICT",
    "message": "The selected driver or vehicle is already scheduled.",
    "context": {
      "policy": "WARN_AND_ACK",
      "canOverride": true,
      "fingerprint": "<sha256-hex>",
      "conflicts": [
        {
          "dispatchPublicId": "<uuidv7>",
          "conflictType": "DRIVER_AND_VEHICLE",
          "travelDate": "2026-08-29",
          "status": "DISPATCHED",
          "destination": "Maramag",
          "purpose": "Official travel",
          "driver": { "publicId": "<uuidv7>", "name": "..." },
          "vehicle": {
            "publicId": "<uuidv7>",
            "plateNumber": "...",
            "modelBrand": "...",
            "vehicleType": "..."
          }
        }
      ]
    }
  },
  "requestId": "..."
}
```

**Acknowledgment command shape**:

```json
{
  "conflictOverride": {
    "acknowledged": true,
    "reason": "Reviewed the shared schedule and approved the second trip.",
    "fingerprint": "<sha256-hex>"
  }
}
```

The create and update payloads include this optional object beside their existing fields. The dispatch-transition route accepts either `{}` or the same optional object.

**Schedule query pattern**:

- Derive `from` and `to` from `view` and anchor `date` on the server page.
- Accept at most 42 inclusive civil dates.
- Cap event records at 200 and return `truncated` when more records exist.
- Calculate resource occupancy independently from the event limit.
- Apply office, driver, vehicle, and status to displayed records.
- Do not let the status display filter weaken authoritative occupancy or conflict checks.

**UI pattern**:

- Keep pages and static calendar rendering as Server Components.
- Use client components only for advisory fetch state, settings mutation, and acknowledgment dialogs.
- Use semantic tokens, Lucide icons, visible labels, 44-pixel targets, and two-pixel focus rings.
- Keep state text alongside every color or icon.
- Preserve Radix focus trapping, Escape dismissal, and focus return.

---

## IMPLEMENTATION PLAN

### Phase 0: Base and contract verification

Confirm the merged FVD-007 implementation, accepted FVD-008 decisions, migration order, and current validation baseline.

### Phase 1: Scheduling domain, DTO, and error contracts

Create conflict policy, type, reason, reservation, fingerprint, schedule query, conflict response, acknowledgment, and safe error contracts.

### Phase 2: Database schema and persistence ports

Add migration `000009`, Kysely types, singleton settings, append-only overrides, permissions, repositories, and historical projections.

### Phase 3: Authoritative mutation integration

Integrate resource serialization, current conflict reads, policy decisions, fingerprint rechecks, append-only evidence, and audit into create, update, and dispatch.

### Phase 4: Schedule and settings APIs

Add advisory, general schedule, resource-specific schedule, and global settings handlers with strict authorization and query bounds.

### Phase 5: Responsive interface

Add schedule pages, filters, calendars, mobile agendas, inline guidance, acknowledgment dialogs, administrator settings, and conflict history.

### Phase 6: Concurrency, security, accessibility, and regression validation

Prove race safety, atomic audit, payload bypass resistance, permission behavior, responsive accessibility, Docker migration health, and complete project validation.

---

## STEP-BY-STEP TASKS

Execute every task in order. Each task is atomic and independently testable.

### Task 0 — VERIFY merged base and create the FVD-008 branch

- **IMPLEMENT**: Fetch `origin` and confirm pull request #7 is merged into `origin/main` at or after `b48b63b`.
- **IMPLEMENT**: Confirm the working tree is clean before switching branches.
- **IMPLEMENT**: Fast-forward local `main` to `origin/main` and create `feature/detect-dispatch-conflicts-show-availability`.
- **IMPLEMENT**: Confirm migration `000008` and all FVD-007 dispatch files are present.
- **GOTCHA**: Do not commit FVD-008 on the merged FVD-007 feature branch.
- **GOTCHA**: Preserve unrelated user changes if the tree is no longer clean.
- **VALIDATE**: `git status --short --branch`
- **VALIDATE**: `git log --oneline --decorate -5`
- **VALIDATE**: `test -f src/infrastructure/database/migrations/20260828_000008_create_dispatch_workflow.ts`
- **SATISFIES**: Implementation prerequisite

### Task 1 — UPDATE the dispatch design contracts before implementation

- **UPDATE**: `design-system/fuel-and-vehicle-dispatch-management-system/pages/dispatch-management.md`.
- **CREATE**: `design-system/fuel-and-vehicle-dispatch-management-system/pages/dispatch-schedule-settings.md`.
- **IMPLEMENT**: Replace the FVD-008-absent statement with the accepted schedule, availability, conflict, dialog, and history contracts.
- **IMPLEMENT**: Document day/week/month layouts, mobile agenda fallbacks, native GET navigation, truncation, empty/error states, and availability semantics.
- **IMPLEMENT**: Document `BLOCK`, `WARN_AND_ACK`, changed-fingerprint review, and read-only acknowledgment history.
- **IMPLEMENT**: Preserve the master tokens, Lexend and Source Sans 3, sidebar, low motion, dark mode, and responsive breakpoints.
- **IMPLEMENT**: Record the accepted dispatch-list filter revision: use `Search dispatches` as the visible label and align its input with the neighboring desktop controls.
- **GOTCHA**: Do not adopt the UI search tool's generated dark-only or Fira-font suggestion. The persisted project design system overrides it.
- **GOTCHA**: Do not create a drag-and-drop calendar or custom ARIA application grid.
- **VALIDATE**: `rg -n "day|week|month|WARN_AND_ACK|BLOCK|fingerprint|agenda|375|200 percent" design-system/fuel-and-vehicle-dispatch-management-system/pages/dispatch-management.md design-system/fuel-and-vehicle-dispatch-management-system/pages/dispatch-schedule-settings.md`
- **SATISFIES**: AC13 through AC18

### Task 2 — CREATE scheduling value objects, policy, DTOs, ports, and typed errors

- **CREATE**: Conflict policy, conflict type, override reason, and reservation policy files under `src/domain/dispatch`.
- **UPDATE**: `src/application/dispatch/dto/dispatch-dtos.ts` with candidate, conflict, fingerprint, acknowledgment, override history, schedule query, occupancy, result, and settings DTOs.
- **CREATE**: Schedule, override, settings, and fingerprint ports.
- **UPDATE**: `src/application/dispatch/ports/dispatch-transaction.ts` and `dispatch-use-case-dependencies.ts`.
- **UPDATE**: `src/application/shared/errors/application-error.ts`, `src/lib/http/api-response.ts`, and `src/lib/http/with-response-handler.ts` for allowlisted structured conflict context.
- **IMPLEMENT**: Keep the context JSON-safe and immutable.
- **IMPLEMENT**: Define `DISPATCH_SCHEDULE_CONFLICT` and a separate recoverable transaction-retry code.
- **PATTERN**: Mirror current dispatch value objects, DTOs, ports, and application-error mapping.
- **GOTCHA**: Do not put database, Kysely, Node crypto, Request, Response, or React types in domain/application contracts.
- **GOTCHA**: Do not squeeze full conflict records into field validation details.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/domain/dispatch tests/unit/application/dispatch/dispatch-services.test.ts`
- **VALIDATE**: `pnpm typecheck`
- **SATISFIES**: AC1 through AC7, AC11, AC12

### Task 3 — CREATE migration 000009 and update database types

- **CREATE**: `src/infrastructure/database/migrations/20260829_000009_create_dispatch_scheduling.ts`.
- **CREATE**: Singleton `dispatch_schedule_settings` with `id = 1`, policy check, updater reference, timestamp, and seeded `WARN_AND_ACK` row.
- **CREATE**: Append-only `vehicle_dispatch_conflict_overrides` with restrictive foreign keys and architecture-defined indexes.
- **IMPLEMENT**: Add checks for conflict type, policy, and 10-to-500-character acknowledgment reason.
- **IMPLEMENT**: Add `dispatch.conflict.override` and `dispatch.settings.manage` with fixed UUIDv7 public IDs.
- **IMPLEMENT**: Grant the accepted initial roles explicitly, including `SUPER_ADMIN` because later permissions are not inherited from migration `000002`.
- **UPDATE**: `src/infrastructure/database/types.ts` with settings and override table interfaces and database keys.
- **IMPLEMENT**: Delete role grants and permissions safely during down migration, then drop dependent tables in reverse order.
- **PATTERN**: Mirror migrations `000005`, `000006`, and `000008`.
- **GOTCHA**: Do not edit migration `000008` or add `conflict_override_*` columns to `vehicle_dispatches`.
- **GOTCHA**: Do not add uniqueness that blocks legitimate later re-acknowledgment.
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/dispatch/migration.test.ts`
- **VALIDATE**: `pnpm typecheck`
- **SATISFIES**: AC5, AC8 through AC12, AC18

### Task 4 — CREATE Kysely schedule, settings, override, and fingerprint adapters

- **CREATE**: The three Kysely repositories and Node SHA-256 fingerprinter listed under New Files.
- **IMPLEMENT**: Resolve conflicts against `DRAFT`, `DISPATCHED`, and `COMPLETED`; exclude `CANCELLED`.
- **IMPLEMENT**: Merge driver and vehicle matches for the same dispatch into one conflict record.
- **IMPLEMENT**: Exclude the current dispatch public ID during update and transition checks.
- **IMPLEMENT**: Provide a nonlocking advisory query and a current `FOR SHARE` conflict query for mutations.
- **IMPLEMENT**: Add bounded date-range schedule queries with safe historical joins, occupancy summaries, and a 200-event cap.
- **IMPLEMENT**: Add singleton plain read, shared-lock read, and update methods.
- **IMPLEMENT**: Add append-only batch insert, current-evidence lookup, and historical detail-list methods for overrides.
- **IMPLEMENT**: Fingerprint stable canonical fields with SHA-256 and lowercase hexadecimal output.
- **PATTERN**: Mirror `KyselyDispatchRepository`, authentication settings, UUID conversion, and transaction-scoped construction.
- **GOTCHA**: A plain SELECT after an earlier consistent read may return a stale `REPEATABLE READ` snapshot.
- **GOTCHA**: Do not return driver contact numbers or internal IDs from any joined query.
- **GOTCHA**: Do not infer availability from a truncated event list.
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/dispatch/schedule-repositories.test.ts`
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/infrastructure/dispatch-conflict-fingerprinter.test.ts`
- **SATISFIES**: AC1 through AC4, AC7, AC9, AC13, AC17

### Task 5 — UPDATE dispatch transaction wiring and lock ordering

- **UPDATE**: `create-kysely-dispatch-repositories.ts`, `kysely-dispatch-transaction.ts`, `dispatch.ts`, and `root.ts`.
- **IMPLEMENT**: Expose schedule, override, and settings repositories inside the existing dispatch transaction.
- **IMPLEMENT**: Inject the fingerprint port through the dispatch dependency object.
- **IMPLEMENT**: Map MySQL deadlock and lock-wait timeout errors to a safe recoverable `409` after rollback.
- **REFACTOR**: Update and dispatch-transition workflows must discover resource IDs before taking the target dispatch lock.
- **IMPLEMENT**: Lock office, driver, and vehicle in the accepted stable order, then lock/reload the target dispatch.
- **IMPLEMENT**: Reauthorize and revalidate lifecycle after the locked reload.
- **IMPLEMENT**: If transition resource IDs changed between discovery and lock, return a retry-required conflict instead of proceeding under stale locks.
- **PATTERN**: Preserve the existing transaction-scoped repository factory and audit options.
- **GOTCHA**: Locking the dispatch before a conflicting row can create a cycle when another update holds that conflicting dispatch and waits on the resource.
- **GOTCHA**: Do not automatically retry a partially executed use-case callback. Roll back and return a recoverable error.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/infrastructure/composition/dispatch.test.ts`
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/dispatch/concurrency.test.ts tests/integration/dispatch/schedule-concurrency.test.ts`
- **SATISFIES**: AC6 through AC8, AC19

### Task 6 — CREATE shared conflict resolution and audit services

- **CREATE**: `dispatch-conflict-resolution.ts` and `dispatch-schedule-audit-events.ts`.
- **IMPLEMENT**: Convert current repository conflicts into safe DTOs before errors cross the application boundary.
- **IMPLEMENT**: Apply `BLOCK`, missing acknowledgment, missing permission, invalid reason, stale fingerprint, and successful acknowledgment branches explicitly.
- **IMPLEMENT**: Reject an acknowledgment when the final conflict set is empty.
- **IMPLEMENT**: Detect whether existing evidence covers every current conflicting dispatch and conflict type during dispatch transition.
- **IMPLEMENT**: Return pending override rows and one allowlisted override-audit event draft to the caller after approval.
- **IMPLEMENT**: Audit settings changes with before and after policy values and no fabricated entity public ID.
- **IMPLEMENT**: Keep reasons out of ordinary logs but include the normalized reason in protected audit metadata and operational override evidence.
- **PATTERN**: Mirror `dispatch-audit-events.ts` and `buildAuthenticationAuditEvent` for singleton setting changes.
- **GOTCHA**: A prior `WARN_AND_ACK` record never bypasses current `BLOCK` policy.
- **GOTCHA**: The fingerprint is stale-review evidence, not an authorization token.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/dispatch/dispatch-conflict-resolution.test.ts tests/unit/application/dispatch/dispatch-services.test.ts`
- **SATISFIES**: AC3, AC5, AC7 through AC10

### Task 7 — UPDATE create, draft update, and dispatch transition workflows

- **UPDATE**: `create-dispatch.ts`, `update-draft-dispatch.ts`, and `dispatch-vehicle.ts`.
- **UPDATE**: Command DTOs and route schemas with the optional strict `conflictOverride` object.
- **IMPLEMENT**: Run the final conflict resolver only after resources and policy are locked.
- **IMPLEMENT**: Create or update the dispatch only after the policy branch permits continuation.
- **IMPLEMENT**: Append one override row per current conflict when a new acknowledgment is accepted.
- **IMPLEMENT**: Append the existing normal mutation audit plus one conflict-override audit event in the same transaction.
- **IMPLEMENT**: Recheck the dispatch transition and reuse matching evidence only under current `WARN_AND_ACK`.
- **IMPLEMENT**: Preserve values, statuses, eligibility, timestamps, and historical behavior from FVD-007.
- **GOTCHA**: Do not skip conflict checks when the selected resources are unchanged during draft update.
- **GOTCHA**: Do not persist override evidence before the related dispatch insert/update is guaranteed inside the same transaction.
- **GOTCHA**: Do not accept client-provided conflict IDs, types, policy, or capability flags.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/dispatch/dispatch-use-cases.test.ts tests/unit/application/dispatch/dispatch-conflict-resolution.test.ts`
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/dispatch/schedule-audit-atomicity.test.ts`
- **SATISFIES**: AC1 through AC12

### Task 8 — CREATE advisory, schedule, and settings use cases

- **CREATE**: The six query/settings use cases listed under New Files.
- **IMPLEMENT**: Require `dispatch.read` for schedule and resource-calendar queries.
- **IMPLEMENT**: Return advisory conflicts, policy, capability, and fingerprint without acquiring resource locks.
- **IMPLEMENT**: Require `dispatch.settings.manage` for both settings read and update.
- **IMPLEMENT**: Update settings and append audit evidence in one dispatch transaction.
- **IMPLEMENT**: Return day/week/month range metadata, bounded events, occupancy, conflict markers, and `truncated`.
- **IMPLEMENT**: Reuse one schedule query service behind general, driver, and vehicle endpoints.
- **IMPLEMENT**: Apply object-aware dispatch authorization to every returned detail link.
- **GOTCHA**: Presentation status filters do not weaken the occupancy calculation.
- **GOTCHA**: Settings no-op updates should return the current record without a duplicate audit event.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/dispatch/dispatch-schedule-use-cases.test.ts`
- **SATISFIES**: AC10, AC11, AC13, AC14, AC17

### Task 9 — CREATE strict schedule, conflict, resource-calendar, and settings APIs

- **CREATE**: The five Route Handler files listed under New Files.
- **UPDATE**: `route-schemas.ts` with conflict, schedule, resource schedule, settings, and acknowledgment schemas.
- **UPDATE**: `server-dispatch-access.ts` with read, override, and settings actions where needed.
- **IMPLEMENT**: Reject duplicate, unknown, oversized, malformed, or out-of-range query parameters.
- **IMPLEMENT**: Enforce a maximum 42-day inclusive schedule range and maximum 200 returned events.
- **IMPLEMENT**: Await dynamic params and search params according to installed Next.js 16 rules.
- **IMPLEMENT**: Require authentication and exact server-side permission on every endpoint.
- **IMPLEMENT**: Enforce trusted origin, JSON content type, and Cross-Site Request Forgery checks on settings PATCH and existing dispatch mutations.
- **IMPLEMENT**: Return structured `409` conflict context through the standard envelope.
- **IMPLEMENT**: Keep resource-calendar public IDs UUIDv7-only and return generic not-found responses.
- **PATTERN**: Mirror existing dispatch and authentication settings handlers.
- **GOTCHA**: GET advisory and schedule routes are read-only and do not need Cross-Site Request Forgery tokens.
- **GOTCHA**: Edited override payloads must never select which conflicts are acknowledged.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/app/api/dispatches/dispatch-routes.test.ts tests/unit/app/api/dispatches/dispatch-schedule-routes.test.ts tests/unit/lib/dispatch/route-schemas.test.ts`
- **SATISFIES**: AC1 through AC7, AC10 through AC14

### Task 10 — UPDATE browser response parsing and build inline availability guidance

- **UPDATE**: `dispatch-form-response.ts` to preserve allowlisted conflict context from the standard envelope.
- **CREATE**: `dispatch-availability-guidance.tsx`.
- **UPDATE**: `dispatch-draft-form.tsx` to pass complete candidate selections and respond to authoritative conflicts.
- **IMPLEMENT**: Run advisory requests only when travel date, driver, and vehicle are valid.
- **IMPLEMENT**: Abort obsolete requests when any candidate field changes or the component unmounts.
- **IMPLEMENT**: Show waiting, loading, available, conflicting, blocked, and recoverable failure states.
- **IMPLEMENT**: Use `role="status"` or an equivalent polite live region without moving focus.
- **IMPLEMENT**: Keep Save available after advisory failure because final submission remains authoritative.
- **IMPLEMENT**: Do not reveal conflict detail links unless the user has read access.
- **PATTERN**: Mirror current form status, error association, and disabled-submit behavior.
- **GOTCHA**: Do not debounce with an unbounded timer or allow an older response to replace newer candidate state.
- **GOTCHA**: Do not cache advisory results as proof for final submission.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/components/dispatch-components.test.ts tests/unit/components/dispatch-schedule-components.test.ts`
- **SATISFIES**: AC12, AC14, AC16

### Task 11 — CREATE the authoritative conflict acknowledgment dialog

- **CREATE**: `dispatch-conflict-dialog.tsx`.
- **UPDATE**: Draft form and dispatch confirmation dialog to open it after a typed `409`.
- **IMPLEMENT**: Show effective policy, conflict type, status, travel date, destination, purpose, driver, and vehicle.
- **IMPLEMENT**: Show a non-actionable blocked state under `BLOCK`.
- **IMPLEMENT**: Show a non-actionable permission state when `canOverride` is false.
- **IMPLEMENT**: Under permitted `WARN_AND_ACK`, require a reviewed checkbox and 10-to-500-character reason.
- **IMPLEMENT**: Resubmit the original candidate with only acknowledged, reason, and fingerprint evidence.
- **IMPLEMENT**: On changed conflicts, replace the summary, clear reviewed state, keep or safely preserve the reason, and focus the new summary.
- **IMPLEMENT**: Disable only the active dialog action and preserve Radix focus return.
- **PATTERN**: Mirror dispatch completion and cancellation dialog focus behavior.
- **GOTCHA**: Closing the dialog must not silently submit or discard the underlying draft values.
- **GOTCHA**: Color, warning icon, or toast alone is insufficient conflict disclosure.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/components/dispatch-schedule-components.test.ts`
- **SATISFIES**: AC5, AC7, AC11, AC12, AC14, AC16

### Task 12 — CREATE civil-date helpers, schedule query parsing, and schedule UI

- **CREATE**: `calendar-date.ts`, `schedule-page-query.ts`, schedule filters, calendar component, page, loading, and error files.
- **IMPLEMENT**: Derive Asia/Manila `today` without shifting stored civil dates.
- **IMPLEMENT**: Derive inclusive day, Monday-through-Sunday week, and six-row month-grid ranges with UTC date arithmetic.
- **IMPLEMENT**: Keep all view and filter state in native GET parameters.
- **IMPLEMENT**: Provide Previous, Today, Next, Day, Week, and Month as ordinary links with current-state text.
- **IMPLEMENT**: Render day agenda, responsive week columns/agenda, and responsive month grid/agenda.
- **IMPLEMENT**: Show selected-resource availability, occupied dates, conflict markers, status, and authorization-aware detail links.
- **IMPLEMENT**: Show loading, empty, filtered-empty, denied, invalid-query, failure, populated, and truncated states.
- **IMPLEMENT**: Add a Schedule link to the Dispatch list header without adding another sidebar item.
- **UPDATE**: Revise the existing dispatch filter label to `Search dispatches` and keep its input aligned with the other filter controls at desktop widths.
- **PATTERN**: Mirror dispatch list Server Component queries, filters, status badge, responsive results, and semantic tokens.
- **GOTCHA**: Do not use JavaScript local-date parsing that can shift `YYYY-MM-DD` values.
- **GOTCHA**: Do not claim a date is available when no resource is selected.
- **GOTCHA**: Do not hide required records or actions at mobile widths; use the agenda fallback.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/lib/dispatch/calendar-date.test.ts tests/unit/lib/dispatch/schedule-page-query.test.ts tests/unit/components/dispatch-schedule-components.test.ts`
- **VALIDATE**: `pnpm typecheck`
- **SATISFIES**: AC13 through AC16, AC18

### Task 13 — CREATE global dispatch policy administration

- **CREATE**: Administrator page, loading/error states, and `dispatch-schedule-settings-form.tsx`.
- **UPDATE**: Protected layout and navigation access with a `Dispatch settings` Administration item.
- **IMPLEMENT**: Show a global badge, current policy, plain-language consequences, updater, and update time.
- **IMPLEMENT**: Allow only `BLOCK` or `WARN_AND_ACK` and require explicit confirmation before saving `BLOCK`.
- **IMPLEMENT**: Use the existing session Cross-Site Request Forgery token and protected settings API.
- **IMPLEMENT**: Preserve pending, success, validation, denial, and server failure states through accessible live feedback.
- **IMPLEMENT**: Render a clear denied state without leaking current settings.
- **PATTERN**: Mirror authentication settings and existing Administration navigation.
- **GOTCHA**: A user with `auth.settings.manage` does not automatically have `dispatch.settings.manage`, and vice versa.
- **GOTCHA**: Do not place the setting only in client state or an environment variable.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/components/dispatch-schedule-components.test.ts tests/unit/components/protected-navigation.test.ts`
- **SATISFIES**: AC10 through AC12, AC16

### Task 14 — ADD read-only acknowledgment history to dispatch detail

- **CREATE**: `dispatch-conflict-history.tsx`.
- **UPDATE**: Dispatch detail DTO, detail use case, repository projection, page, and component.
- **IMPLEMENT**: Load acknowledgment records only after dispatch object authorization succeeds.
- **IMPLEMENT**: Show conflict link, type, policy, normalized reason, actor public ID, and acknowledgment timestamp.
- **IMPLEMENT**: Preserve records after rescheduling and distinguish historical evidence from current conflicts.
- **IMPLEMENT**: Use text and icons for conflict type and policy.
- **IMPLEMENT**: Show an explicit empty state when no overrides exist.
- **GOTCHA**: Do not imply an old acknowledgment means the current schedule remains overridden.
- **GOTCHA**: Do not expose internal IDs, driver contacts, IP addresses, or user agents.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/dispatch/dispatch-schedule-use-cases.test.ts tests/unit/components/dispatch-schedule-components.test.ts`
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/dispatch/schedule-repositories.test.ts`
- **SATISFIES**: AC9, AC11, AC17

### Task 15 — ADD migration, repository, concurrency, and audit integration coverage

- **UPDATE**: Existing migration, repository, concurrency, audit, and helper tests for migration `000009`.
- **CREATE**: Schedule repository, concurrency, and audit atomicity integration suites.
- **IMPLEMENT**: Prove table columns, checks, restrictive foreign keys, indexes, permissions, initial grants, and default policy.
- **IMPLEMENT**: Prove down/up reversibility and update every migration count and rollback depth.
- **IMPLEMENT**: Prove driver-only, vehicle-only, combined, self-excluded, status, date, and historical-label queries.
- **IMPLEMENT**: Prove `COMPLETED` conflicts and `CANCELLED` does not.
- **IMPLEMENT**: Prove schedule filters, occupancy independence from truncation, 42-day range, and 200-event cap.
- **IMPLEMENT**: Race same-driver, same-vehicle, create/create, create/update, and update/update operations under both policies.
- **IMPLEMENT**: Prove at most one unacknowledged conflicting write succeeds.
- **IMPLEMENT**: Prove stale fingerprints, policy changes, lock waits, deadlocks, and audit failures roll back safely.
- **IMPLEMENT**: Delete override rows before dispatch rows and reset singleton settings in test cleanup.
- **GOTCHA**: Run final conflict queries as locking current reads. A green sequential test does not prove concurrency safety.
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/dispatch`
- **SATISFIES**: AC1 through AC10, AC13, AC17 through AC19

### Task 16 — ADD API, end-to-end, security, and accessibility coverage

- **UPDATE**: Route, fixture, dispatch workflow, permission, and accessibility suites.
- **CREATE**: Conflict/availability and dispatch-settings Playwright suites.
- **IMPLEMENT**: Cover advisory driver-only, vehicle-only, combined, available, failure, and stale-request states.
- **IMPLEMENT**: Cover `WARN_AND_ACK` review, reason, permission, successful override, changed fingerprint, and history.
- **IMPLEMENT**: Cover `BLOCK` and direct payload bypass attempts.
- **IMPLEMENT**: Cover day/week/month navigation and every schedule filter.
- **IMPLEMENT**: Cover Dispatch Officer, Super Administrator, System Administrator, Viewer, and Auditor permission expectations.
- **IMPLEMENT**: Cover altered UUIDs, fingerprints, policies, conflict types, unknown fields, missing Cross-Site Request Forgery tokens, and unauthenticated requests.
- **IMPLEMENT**: Cover keyboard-only dialog use, focus return, live regions, Axe, dark mode, reduced motion, 200-percent zoom, and widths 375/768/1024/1440.
- **IMPLEMENT**: Assert the dispatch search field keeps its concise visible label and shares the neighboring controls' top alignment at desktop widths.
- **IMPLEMENT**: Use deterministic Playwright principals and fixtures. Do not create or enter one-time administrator credentials.
- **VALIDATE**: `pnpm exec playwright test --project=chromium tests/e2e/dispatches.spec.ts tests/e2e/dispatch-permissions.spec.ts tests/e2e/dispatch-conflicts-and-availability.spec.ts tests/e2e/dispatch-schedule-settings.spec.ts tests/e2e/accessibility.spec.ts`
- **SATISFIES**: AC1 through AC19

### Task 17 — UPDATE documentation and regression assumptions

- **UPDATE**: `README.md` with permissions, policy administration, APIs, conflict contract, schedule views, status semantics, and local verification.
- **UPDATE**: Migration-count and role-permission expectations throughout tests.
- **UPDATE**: Any dispatch documentation that still says FVD-008 is absent.
- **IMPLEMENT**: Document the date-only conservative reservation rule and future interval seam.
- **IMPLEMENT**: Document that advisory availability never replaces final server checks.
- **IMPLEMENT**: Document safe recovery from a retry-required concurrency response.
- **IMPLEMENT**: Search for stale permission catalogs, migration counts, cleanup order, and conflict-deferred statements.
- **GOTCHA**: Do not edit old migration contents to make new permissions appear historical.
- **VALIDATE**: `rg -n "FVD-008|000009|dispatch\.conflict\.override|dispatch\.settings\.manage|WARN_AND_ACK|BLOCK|conflict.*absent|migration" README.md docs design-system src tests .claude/plans`
- **SATISFIES**: AC10, AC18, AC19

### Task 18 — RUN the full project gate and Docker smoke validation

- **VERIFY**: Run formatting, lint, type checking, unit coverage, MySQL integration, Chromium end-to-end, and production build checks.
- **VERIFY**: Apply migration `000009` through the Docker database-tools workflow and confirm ordered status.
- **VERIFY**: Confirm application, MySQL, audit worker, Traefik, dnsmasq path, and shared `dev-net` remain healthy.
- **VERIFY**: Confirm `https://fvdms.lan/dispatches/schedule` resolves through Traefik.
- **VERIFY**: Exercise one available create, one warned override, one blocked rejection, one schedule view, and one settings change with deterministic test principals.
- **VERIFY**: Confirm successful overrides and settings changes appear in audit evidence, while rejected commands create no business mutation or override row.
- **GOTCHA**: Browser cookies can create redirect loops even when Docker, DNS, and Traefik are healthy.
- **GOTCHA**: Do not use a real initial-admin one-time password for automated smoke tests.
- **VALIDATE**: `pnpm format:check`
- **VALIDATE**: `pnpm lint`
- **VALIDATE**: `pnpm typecheck`
- **VALIDATE**: `pnpm test:coverage`
- **VALIDATE**: `pnpm test:integration`
- **VALIDATE**: `pnpm exec playwright test --project=chromium`
- **VALIDATE**: `pnpm build`
- **VALIDATE**: `git diff --check`
- **VALIDATE**: `pnpm db:migrate`
- **VALIDATE**: `pnpm db:status`
- **VALIDATE**: `pnpm dev:up`
- **VALIDATE**: `docker compose ps`
- **VALIDATE**: `curl -k -I https://fvdms.lan/dispatches/schedule`
- **SATISFIES**: AC19 and release readiness

---

## TESTING STRATEGY

### Unit Tests

- Test policy and conflict-type parsing, equality, invalid inputs, and string output.
- Test override reason trimming, whitespace normalization, minimum, maximum, and control-character boundaries.
- Test reservation status for all four dispatch states.
- Test driver-only, vehicle-only, and combined conflict merging.
- Test stable fingerprint ordering and every fingerprint input field.
- Test `BLOCK`, permitted warning, missing permission, missing review, invalid reason, stale fingerprint, and empty-conflict acknowledgment branches.
- Test existing evidence coverage for dispatch transition.
- Test settings permission, no-op update, changed update, and audit event shape.
- Test structured error mapping and safe context serialization.
- Test strict route bodies, UUIDv7 IDs, duplicate queries, 42-day maximum, and 200-event ceiling.
- Test Asia/Manila today, leap years, month boundaries, Monday week boundaries, and six-row month grids.
- Test form, calendar, dialog, settings, history, loading, empty, denied, error, and truncated static contracts.

### Integration Tests

- Inspect migration tables, exact enums/checks, reason length, restrictive foreign keys, and indexes.
- Prove seeded default policy and exact initial role grants.
- Prove migration down/up/down/up behavior with dependent rows removed in correct order.
- Prove advisory query results without locks and authoritative results with current locking reads.
- Prove driver, vehicle, combined, completed, cancelled, self-excluded, and historical-label behavior.
- Prove general, driver, and vehicle schedule queries produce the same bounded semantics.
- Prove occupancy remains correct when event output is truncated.
- Prove settings shared locks prevent mid-transaction policy changes without serializing unrelated dispatch reads.
- Prove override rows are append-only and older evidence survives rescheduling.
- Prove dispatch transition reuses exact current evidence and requires fresh evidence for changed conflicts.
- Prove outbox failure rolls back dispatch, override, and settings mutations.
- Prove deadlocks and lock timeouts return safe retry outcomes after rollback.

### Concurrency Tests

- Simultaneous create with the same driver and different vehicles.
- Simultaneous create with the same vehicle and different drivers.
- Simultaneous create matching both resources.
- Create racing with draft update.
- Two draft updates swapping or converging on resources.
- Advisory read followed by a conflicting committed insert before final submission.
- Two `WARN_AND_ACK` requests with stale fingerprints.
- Policy update racing with a dispatch mutation.
- Dispatch transition racing with draft update.
- Audit failure after conflict approval but before commit.

Every race must prove there is no silently accepted unacknowledged double booking.

### API and Security Tests

- Require authentication on all schedule, conflict, resource calendar, and settings endpoints.
- Require exact permissions for schedule reads, settings management, and conflict override.
- Reject missing or invalid Cross-Site Request Forgery evidence on mutations.
- Reject unknown body keys, arrays, duplicate queries, malformed dates, invalid UUID versions, and oversized reasons.
- Reject client-supplied policy, conflict IDs, conflict types, capability flags, and internal IDs.
- Return fresh conflict context for stale fingerprints.
- Ensure `BLOCK` cannot be bypassed by a valid prior warning acknowledgment.
- Ensure unauthorized conflict detail links are absent or generic.
- Ensure responses and logs never include contact numbers, SQL, stacks, credentials, cookies, tokens, or internal IDs.

### End-to-End Tests

- Create a dispatch on an available day.
- See advisory availability after valid selections.
- Receive driver-only, vehicle-only, and combined warnings.
- Complete the explicit review and reason flow under `WARN_AND_ACK`.
- See a changed-conflict response and review again.
- Fail a conflicting mutation under `BLOCK`.
- Fail an override as a user without `dispatch.conflict.override`.
- Open day, week, and month schedules and navigate previous/today/next.
- Filter schedules by office, driver, vehicle, and status.
- Open authorization-aware dispatch detail links.
- View read-only acknowledgment history.
- Change the global policy as an authorized administrator and observe audit evidence.
- Verify responsive agenda fallbacks, dark mode, reduced motion, zoom, keyboard flow, focus return, and Axe.

### Edge Cases

- A conflict against a soft-deleted driver or vehicle label on a historical dispatch.
- A `COMPLETED` dispatch on the same date.
- A `CANCELLED` dispatch on the same date.
- A conflict that changes from `DRIVER` to `DRIVER_AND_VEHICLE`.
- Multiple conflicting dispatches with stable ordering.
- Exactly 10- and 500-character reasons.
- A policy change between advisory read and final submission.
- A conflicting dispatch cancelled between advisory and final submission.
- A new conflict inserted between advisory and final submission.
- Existing pre-FVD-008 draft conflicts at the dispatch transition.
- No selected resource on the schedule page.
- No events, filtered no events, exactly 200 events, and more than 200 events.
- Leap-day, year boundary, month starting Sunday, and six-week month grids.
- Stale client request resolving after a newer selection.

---

## VALIDATION COMMANDS

Execute every command and require zero unexpected failures.

### Level 1: Syntax and Style

```bash
pnpm format:check
pnpm lint
pnpm typecheck
git diff --check
```

### Level 2: Focused Unit Tests

```bash
pnpm exec vitest run --config vitest.config.ts \
  tests/unit/domain/dispatch \
  tests/unit/application/dispatch \
  tests/unit/infrastructure/dispatch-conflict-fingerprinter.test.ts \
  tests/unit/lib/dispatch \
  tests/unit/app/api/dispatches \
  tests/unit/infrastructure/composition/dispatch.test.ts \
  tests/unit/components/dispatch-components.test.ts \
  tests/unit/components/dispatch-schedule-components.test.ts \
  tests/unit/components/protected-navigation.test.ts
```

### Level 3: MySQL Integration Tests

```bash
pnpm exec vitest run --config vitest.integration.config.ts tests/integration/dispatch
pnpm exec vitest run --config vitest.integration.config.ts tests/integration/database tests/integration/auth tests/integration/master-data tests/integration/budget tests/integration/fuel tests/integration/dispatch
```

### Level 4: Browser Tests

```bash
pnpm exec playwright test --project=chromium \
  tests/e2e/dispatches.spec.ts \
  tests/e2e/dispatch-permissions.spec.ts \
  tests/e2e/dispatch-conflicts-and-availability.spec.ts \
  tests/e2e/dispatch-schedule-settings.spec.ts \
  tests/e2e/accessibility.spec.ts
```

### Level 5: Full Project Gate

```bash
pnpm test:coverage
pnpm test:integration
pnpm exec playwright test --project=chromium
pnpm build
pnpm validate
```

### Level 6: Docker and Local LAN Smoke Test

```bash
pnpm db:migrate
pnpm db:status
pnpm dev:up
docker compose ps
curl -k -I https://fvdms.lan/dispatches/schedule
```

Manual checks:

1. Confirm the schedule URL resolves through Traefik and redirects to login when unauthenticated.
2. Use deterministic Playwright principals for authenticated mutation checks.
3. Verify one available create, one accepted warning, and one blocked conflict.
4. Verify day, week, and month layouts at 375, 768, 1024, and 1440 pixels.
5. Verify keyboard-only dialog operation, focus return, dark mode, reduced motion, and 200-percent zoom.
6. Verify audit records for successful overrides and policy changes.

---

## ACCEPTANCE CRITERIA CHECKLIST

- [ ] Driver conflicts are detected before create, update, and dispatch transition.
- [ ] Vehicle conflicts are detected before create, update, and dispatch transition.
- [ ] Combined conflicts are merged correctly.
- [ ] `DRAFT`, `DISPATCHED`, and `COMPLETED` reserve the day.
- [ ] `CANCELLED` does not reserve the day.
- [ ] `BLOCK` always rejects conflicts.
- [ ] `WARN_AND_ACK` requires permission, review, reason, and current fingerprint.
- [ ] Final conflict checks use stable resource locks and current locking reads.
- [ ] Concurrent requests cannot silently double book a resource.
- [ ] Accepted overrides create append-only operational records and immutable audit events atomically.
- [ ] The global policy defaults to `WARN_AND_ACK` and is administratively configurable.
- [ ] New permissions are seeded to the accepted initial roles.
- [ ] Day, week, and month schedules filter by office, driver, vehicle, and status.
- [ ] Inline advisory availability appears before save and remains non-authoritative.
- [ ] Structured conflict errors contain only safe public data.
- [ ] Edited and stale acknowledgment payloads cannot bypass the server.
- [ ] Dispatch detail shows read-only acknowledgment history.
- [ ] Reserved interval timestamps remain null and unexposed.
- [ ] UI follows the persisted design system and passes responsive accessibility checks.
- [ ] Coverage, integration, browser, build, and Docker validation pass.

---

## COMPLETION CHECKLIST

- [ ] Implementation starts from updated `main` after merged FVD-007.
- [ ] Migration `000009` is reversible and ordered.
- [ ] Every task is completed in sequence.
- [ ] Every task's focused validation passes immediately.
- [ ] Lock ordering and current-read behavior are reviewed against MySQL documentation.
- [ ] All conflict branches are covered by unit tests.
- [ ] All critical races are covered by controlled MySQL tests.
- [ ] Override and settings audit atomicity are proven.
- [ ] Direct API bypass attempts fail safely.
- [ ] Schedule and dialog accessibility are verified with Axe and keyboard tests.
- [ ] Full project validation passes.
- [ ] Docker migration and `fvdms.lan` smoke tests pass.
- [ ] Documentation and design contracts match the delivered behavior.
- [ ] An implementation report records any plan divergence.

---

## OPEN QUESTIONS / ASSUMPTIONS

No critical user questions remain.

Accepted assumptions:

- The global policy is sufficient for FVD-008. Per-office policy remains future work.
- Same-day scheduling is intentionally conservative until interval fields become user-visible.
- `COMPLETED` remains a reservation for its travel date, while `CANCELLED` releases it.
- `dispatch.conflict.override` ships to Dispatch Officer and Super Administrator.
- `dispatch.settings.manage` ships to System Administrator and Super Administrator.
- A SHA-256 fingerprint detects stale review but never replaces server recomputation.
- The dispatch transition rechecks schedule safety for legacy and changed surroundings.
- A mostly server-rendered calendar is preferable to a new calendar dependency.
- Override evidence appears on dispatch detail and remains append-only.

If implementation discovers that MySQL locking reads cannot avoid a deadlock cycle under the proposed reordered workflow, stop before weakening the final check. Record the exact race and amend this plan with a verified lock order or bounded transaction-boundary retry strategy.

## NOTES (open canvas)

### Why completed dispatches reserve the day

FVD-008 has date granularity only. A completed trip proves the resource was occupied during some unknown portion of that date.

Treating the resource as immediately available would silently assume non-overlap. The accepted conservative rule raises a warning or block instead. An authorized user can record a legitimate second trip under `WARN_AND_ACK`.

### Why the fingerprint is not a security token

The fingerprint gives the browser a compact way to identify the reviewed conflict snapshot. It detects changes between warning and resubmission.

The server still locks resources, re-reads the policy, recomputes conflicts, verifies permission, and compares the new fingerprint. Possessing or editing a fingerprint never grants authority.

### Why the calendar stays server-rendered

The schedule is bounded, filter-driven operational data. Native GET navigation keeps links shareable, browser history predictable, and client JavaScript small.

Day, week, and month views do not require drag-and-drop. Semantic links, headings, lists, and tables provide stronger keyboard and screen-reader behavior than a custom interactive grid.

### Locking sequence

```text
Create
  lock office -> lock driver -> lock vehicle
  -> policy FOR SHARE -> conflicts current locking read
  -> insert dispatch -> override rows -> audit -> commit

Update
  read target for identity -> lock new office -> lock new driver -> lock new vehicle
  -> lock/reload target -> policy FOR SHARE -> conflicts current locking read excluding target
  -> update -> override rows -> audit -> commit

Dispatch transition
  read target for resource discovery -> lock office -> lock driver -> lock vehicle
  -> lock/reload target and compare discovered resources
  -> policy FOR SHARE -> conflicts current locking read excluding target
  -> transition -> any new override rows -> audit -> commit
```

Completion and cancellation do not change schedule reservations in FVD-008. They keep the FVD-007 lock order and lifecycle behavior.

### Rollback strategy

Migration `000009` can be rolled back only after removing conflict override rows and any code that requires schedule settings or new permissions.

Rolling back the feature does not remove `travel_start_at`, `travel_end_at`, or schedule indexes because migration `000008` owns them.

## AMENDMENTS
