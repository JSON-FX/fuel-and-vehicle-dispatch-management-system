# Feature: Manage budget allocations and fiscal eligibility

The following plan should be complete, but validate documentation, codebase patterns, and task sanity before implementation.

Pay special attention to existing names, DTOs, value objects, transaction seams, and migration behavior. Import from the established files instead of creating parallel abstractions.

## Feature Description

FVD-005 adds an office-linked PPMP budget-allocation module. Authorized users can list, create, edit, activate, close, cancel, soft-delete, restore, and historically resolve allocations without weakening the immutable-audit or authorization boundaries established by FVD-002 through FVD-004.

An allocation is identified by its normalized PPMP number, office, quarter, and fiscal year. New allocations begin in DRAFT. Only current ACTIVE allocations whose office and fiscal period remain eligible can appear in downstream fuel selectors.

The module uses a replaceable fiscal-period policy. The first policy accepts years from 2000 through 9999, uses quarters one through four, and evaluates selector eligibility against an explicit effective date or the current Asia/Manila civil date.

This ticket includes the responsive budget-allocation administration interface. It follows the saved FVDMS design system and the FVD-004 master-data interaction patterns. It does not introduce an allocation amount because neither the ticket, Product Requirements Document, nor architecture defines one.

## User Story

As a Budget Officer
I want to maintain office-linked PPMP allocations and their lifecycle
So that fuel staff can select only the allocation eligible for the transaction period while historical references remain intact

## Problem Statement

The system has office master data and immutable audit capture, but it cannot yet represent the fiscal allocation that a future fuel issuance must reference. Without a governed allocation aggregate, fuel workflows could select the wrong quarter, use a closed allocation, lose historical PPMP context, or enforce fiscal rules inside controllers.

The lifecycle is more constrained than ordinary active or inactive master data. Allocation identity fields are mutable only during draft preparation. Activation makes the record eligible only for its fiscal period, while closure and cancellation must preserve a terminal historical state.

## Solution Statement

Create a dedicated budget domain and application module. A BudgetAllocation aggregate owns lifecycle invariants, normalized identity fields, and safe restoration. A FiscalPeriodPolicy interface owns year, quarter, and effective-date eligibility rules.

Persist allocations in a new normalized MySQL table with named check constraints, a database-enforced identity tuple, opaque UUIDv7 public identifiers, explicit soft-delete evidence, and foreign keys to offices and users. Use a budget-specific transaction containing the allocation repository, the existing office repository, and AuditEventPort so each successful mutation and audit event commit atomically.

Expose the documented collection, item, soft-delete, and restore endpoints. Preserve the documented PATCH item route by using a discriminated command payload for update, activate, close, and cancel actions. Add read-only and management authorization through budget.read and budget.manage.

Build server-rendered list and detail pages with focused client leaves for dialogs and forms. Reuse the saved design tokens, local shadcn/Radix primitives, responsive table/card treatment, error focus, explicit lifecycle language, dark mode, and reduced-motion behavior.

## Out of Scope / Non-Goals

- Not included: allocation amounts, monetary ceilings, appropriations, encumbrances, remaining balances, or percentage utilization. The authoritative FVD-005 field list contains no amount.
- Not included: fuel issuance creation, posting, balance calculation, or voiding. FVD-006 owns those workflows.
- Not included: fuel form integration beyond the stable operational-selector contract. FVD-006 consumes and rechecks that selector.
- Not included: utilization reports, dashboards, Excel exports, or background export jobs. FVD-009 owns reporting.
- Not included: offline storage, synchronization, replay, or conflict handling. FVD-010 owns those concerns.
- Not included: procurement, supplier payment, general accounting, approval workflows, or office-level budget-user assignments.
- Not included: physical deletion or tuple reuse after soft deletion.
- Not included: Redis or in-memory allocation caching. The architecture marks caching as a later optimization.
- Not included: a sidebar or protected-shell redesign. Add one permission-filtered link to the current navigation.
- Not changing: authentication, Cross-Site Request Forgery protection, session handling, denial auditing, audit chaining, or audit sink delivery.
- Not changing: FVD-004 office lifecycle behavior. Budget selectors join the current office state instead.
- Not adding: a generic reference-data aggregate, generic CRUD repository, new font, new chart, GSAP, TanStack Table, or new form dependency.

## Feature Metadata

**Feature Type**: New Capability

**Estimated Complexity**: High

**Primary Systems Affected**: Budget domain, application use cases and policy, MySQL migration and repository, office integration, permission seeding, immutable audit capture, Next.js Route Handlers, protected pages, shadcn/Radix UI, Vitest, MySQL integration tests, Playwright

**Dependencies**: FVD-003 durable audit capture; FVD-004 office master data and operational selectors; existing Next.js 16.3.3, React 19.2.8, Kysely 0.29.5, MySQL 8.4, Zod 4.4.3, React Hook Form 7.86.0, Radix Dialog/AlertDialog, Tailwind CSS 4.3.3

**New runtime dependencies**: None

## Related Work

**Implements**: FVD-005 in docs/tickets/fuel-and-vehicle-dispatch-system.md

**Epic**: docs/PRD.md

**Architecture**: docs/System_Architecture.md

**Back-references**:

- .claude/plans/deliver-authentication-sessions-rbac.md - Defines budget.manage, role assignments, protected-route security, and safe response envelopes.
- .claude/plans/establish-durable-immutable-audit-capture-verification.md - Defines transaction-scoped audit capture, allowlisted snapshots, and durable verification.
- .claude/plans/manage-office-driver-vehicle-master-data.md - Defines current/historical office repositories, read/manage policies, stable cursors, soft-delete evidence, and administration UI patterns.
- .claude/reports/manage-office-driver-vehicle-master-data-report.md - Records the completed FVD-004 seams and the router navigation/token gotchas that FVD-005 must preserve.

**Forward-references**:

- FVD-006 will consume the operational selector and recheck eligibility inside fuel-posting transactions.
- FVD-009 will group fuel activity by allocation and office without assuming a monetary allocation ceiling.
- FVD-010 will revalidate allocation eligibility during server-authoritative synchronization.

**Execution dependency**:

- Before implementation, verify FVD-004 is present in the implementation branch. Do not implement against a base that lacks migration 000004, office repositories, or the master-data UI primitives.

---

## ACCEPTED DECISION CONTRACT

These decisions were accepted during the Phase 2 clarification gate. They are no longer open questions.

### Allocation lifecycle

- Create every allocation as DRAFT. The create payload does not accept status.
- Allow identity-field edits only while the allocation is current and DRAFT.
- Allow DRAFT to transition to ACTIVE or CANCELLED.
- Allow ACTIVE to transition to CLOSED or CANCELLED.
- Keep CLOSED and CANCELLED terminal. They cannot reopen or return to DRAFT through an update.
- Require a normalized reason between 10 and 500 characters for cancellation.
- Require a normalized reason between 10 and 500 characters for soft deletion.
- Confirm activation and closure, but do not require a reason for them.
- Permit soft deletion from any current status. Soft deletion immediately removes the allocation from every operational selector.
- Preserve the documented PATCH item endpoint. Use an explicit action discriminator rather than accepting an arbitrary status value.

### Fiscal policy

- Quarter is an integer from one through four.
- Fiscal year is a four-digit integer from 2000 through 9999.
- Fiscal civil-time calculations use Asia/Manila.
- An operational-selector request may provide effectiveDate as an ISO calendar date in YYYY-MM-DD form.
- When effectiveDate is absent, resolve the current Asia/Manila calendar date through the injected clock.
- An allocation is period-eligible only when its fiscal year and quarter equal the policy result for the effective date.
- Creation and draft editing validate the value ranges. They may prepare future or historical periods.
- Activation does not require the period to be current. An ACTIVE future allocation remains ineligible until its matching period.

### Office eligibility

- Creation, office reassignment, and activation require a current operational office.
- Reassignment is available only while the allocation remains DRAFT.
- Operational selection joins the office dynamically and requires the office to remain current and ACTIVE.
- Deactivating or deleting an office preserves allocation history but removes its allocations from operational selectors.
- Historical allocation reads must resolve the linked office through an including-deleted lookup.

### Restoration

- Restore a deleted DRAFT allocation as DRAFT.
- Restore a deleted ACTIVE allocation as DRAFT.
- Restore deleted CLOSED or CANCELLED allocations with their terminal status preserved.
- Restoration never makes an allocation newly operational.
- The database tuple remains reserved while deleted, so restoration cannot collide with a replacement record.

### Authorization

- Add budget.read.
- Assign budget.read to SUPER_ADMIN, SYSTEM_ADMIN, BUDGET_OFFICER, PSMD_STAFF, VIEWER, and AUDITOR.
- Keep budget.manage assigned to SUPER_ADMIN, SYSTEM_ADMIN, and BUDGET_OFFICER.
- Make budget.manage imply read in BudgetPermissionPolicy.
- Require budget.read or budget.manage for collection, detail, historical, and operational-selector reads.
- Require budget.manage for create, update, transition, soft-delete, and restore.
- Treat access as LGU-wide. Office-scoped user assignments are not part of the current identity model.

### PPMP normalization

- Trim leading and trailing whitespace.
- Collapse internal whitespace to one space.
- Uppercase alphabetic characters.
- Preserve punctuation and leading zeros.
- Enforce a length from one through 80 after normalization.
- Reserve normalized tuples across current and soft-deleted rows.

---

## ACCEPTANCE CRITERIA

- **AC1 — Administration**: Authorized budget managers can list, create, edit draft details, activate, close, cancel, soft-delete, and restore allocations.
- **AC2 — Read access**: Authorized budget readers can list and open current, terminal, and deleted historical allocations without receiving mutation controls.
- **AC3 — Identity validation**: PPMP, office, quarter, and fiscal year are validated and the normalized tuple remains unique under concurrent creates and updates.
- **AC4 — Lifecycle safety**: Only the accepted transitions succeed; terminal states cannot reopen; non-draft identity fields cannot change; cancellation and deletion require reasons.
- **AC5 — Fiscal policy seam**: Year, quarter, Manila date resolution, and eligibility live behind a replaceable policy interface rather than routes or repositories.
- **AC6 — Operational eligibility**: Only current ACTIVE allocations linked to current ACTIVE offices and matching the requested effective fiscal period appear in selectors.
- **AC7 — Historical preservation**: Closed, cancelled, and soft-deleted allocations and their office labels remain resolvable for downstream historical references.
- **AC8 — Safe restoration**: Restoration follows the accepted DRAFT/ACTIVE/terminal mapping and never silently re-enables an allocation.
- **AC9 — Immutable audit**: Every successful sensitive mutation creates exactly one safe immutable audit event in the same transaction.
- **AC10 — API security**: Protected endpoints enforce authentication, object-level authorization, opaque public identifiers, Cross-Site Request Forgery protection, bounded pagination, safe validation, and non-leaking errors.
- **AC11 — Accessible interface**: The list, detail, forms, and dialogs are responsive, keyboard-operable, token-driven, dark-mode complete, reduced-motion safe, and explicit about status and eligibility.
- **AC12 — Verification**: Domain, policy, API, repository, concurrency, authorization, audit, component, accessibility, and browser tests pass with the full project gate.

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

#### Product and architecture

- docs/tickets/fuel-and-vehicle-dispatch-system.md (lines 158-186) - FVD-005 scope, acceptance criteria, seams, and direct dependencies.
- docs/tickets/fuel-and-vehicle-dispatch-system.md (lines 432-481) - Dependency graph and the FVD-005 to FVD-006 handoff.
- docs/PRD.md (lines 53-66) - Objective linking fuel records to a budget allocation.
- docs/PRD.md (lines 121-131) - Budget Officer and read-only personas.
- docs/PRD.md (lines 327-337) - Authoritative allocation fields and quarter rule.
- docs/PRD.md (lines 397-438) - Immutable audit and soft-delete requirements.
- docs/PRD.md (lines 618-625) - Privacy and hard pagination limits.
- docs/PRD.md (lines 715-739) - Opaque IDs, object authorization, Cross-Site Request Forgery protection, DTO validation, safe errors, and concurrency controls.
- docs/PRD.md (lines 774-819) - Downstream reporting labels and utilization grouping.
- docs/System_Architecture.md (lines 22-65) - Clean Architecture responsibilities and thin-controller rule.
- docs/System_Architecture.md (lines 69-151) - Required budget module and route placement.
- docs/System_Architecture.md (lines 205-213) - BudgetAllocation as a distinct reference aggregate.
- docs/System_Architecture.md (lines 299-302) - Office relationship and configurable fiscal rules.
- docs/System_Architecture.md (lines 339-398) - Relationship, columns, statuses, and unique tuple.
- docs/System_Architecture.md (lines 555-590) - Mandatory budget audit events and safe event fields.
- docs/System_Architecture.md (lines 650-678) - budget.manage and server-side authorization.
- docs/System_Architecture.md (lines 682-741) - Documented budget API surface.
- docs/System_Architecture.md (lines 761-791) - Explicit soft-delete repository contract and safe error envelope.
- docs/System_Architecture.md (lines 841-855) - FVD-006 transactional eligibility recheck.

#### Domain and application patterns

- src/domain/office/entities/office.ts (lines 19-83) - Entity lifecycle, current-record guard, operational predicate, and safe restoration.
- src/domain/office/value-objects/office-name.ts (lines 3-18) - Small normalized value-object factory.
- src/domain/shared/value-objects/public-id.ts (lines 4-21) - UUIDv7 validation and opaque resource addressing.
- src/application/office/dto/office-dtos.ts (lines 8-69) - Admin and operational DTO separation plus ISO date serialization.
- src/application/office/ports/office-repository.ts (lines 8-20) - Current, historical, locked, administrative, and operational repository methods.
- src/application/office/use-cases/create-office.ts (lines 13-45) - Permission check, clock, transaction, persistence, and audit order.
- src/application/office/use-cases/update-office.ts (lines 18-66) - Locked update and distinct audit actions.
- src/application/office/use-cases/soft-delete-office.ts (lines 11-52) - Reason validation, actor evidence, and audit atomicity.
- src/application/office/use-cases/restore-office.ts (lines 10-39) - Deleted-only locked restore and audit capture.
- src/application/master-data/services/master-data-permission-policy.ts (lines 5-22) - Manage-implies-read authorization pattern.
- src/application/master-data/ports/master-data-transaction.ts (lines 1-15) - Feature transaction containing business repositories and AuditEventPort.
- src/application/master-data/services/master-data-audit-events.ts (lines 1-52) - Safe audit-action builder and naming convention.
- src/application/shared/errors/application-error.ts - Stable validation, conflict, authorization, not-found, and business-rule errors.

#### Infrastructure and persistence patterns

- src/infrastructure/database/migrations/20260828_000004_create_master_data.ts (lines 1-235) - Named checks, deletion metadata, indexes, permission seeding, and rollback cleanup.
- src/infrastructure/database/types.ts (lines 1-211) - Kysely table types, string-backed BIGINT identifiers, and date aliases.
- src/infrastructure/database/master-data/kysely-office-repository.ts (lines 1-283) - Mapping, joins, keyset lists, FOR UPDATE lookups, and conflict translation.
- src/infrastructure/database/master-data/master-data-cursor-codec.ts (lines 11-95) - Opaque cursor validation and filter fingerprint.
- src/infrastructure/database/master-data/master-data-repository-utils.ts (lines 19-35) - Named duplicate-constraint translation to a safe 409.
- src/infrastructure/database/master-data/create-kysely-master-data-repositories.ts - Transaction-local repository factory.
- src/infrastructure/database/master-data/kysely-master-data-transaction.ts (lines 17-29) - Transaction-bound repository and audit construction.
- src/infrastructure/composition/master-data.ts (lines 1-88) - Feature-local composition object.
- src/infrastructure/composition/root.ts (lines 120-235) - Root composition wiring and policy injection.
- src/infrastructure/database/client.ts (lines 14-30) - Current MySQL coercion behavior and UTC Date handling.
- src/infrastructure/database/uuid-binary.ts - BINARY(16) UUID mapping.

#### API and server access patterns

- src/app/api/offices/route.ts (lines 10-64) - Collection parsing, mode authorization, secure JSON mutation, and use-case dispatch.
- src/app/api/offices/[officeId]/route.ts - Opaque item parameter, GET/PATCH behavior, and safe response handling.
- src/app/api/offices/[officeId]/soft-delete/route.ts - Reasoned soft-delete route.
- src/app/api/offices/[officeId]/restore/route.ts - Empty-body restoration route.
- src/lib/master-data/route-schemas.ts (lines 9-126) - Normalized text, UUIDv7, bounded list, admin/operational discrimination, and reason schemas.
- src/lib/master-data/page-query.ts (lines 8-54) - Native GET page-state parsing and filter-preserving cursor links.
- src/lib/master-data/server-master-data-access.ts (lines 23-90) - Authentication, read/manage checks, durable denials, and request context.
- src/lib/auth/route-helpers.ts (lines 1-34) - Origin, content type, Cross-Site Request Forgery, and JSON body checks.
- src/lib/http/with-response-handler.ts (lines 24-105) - Error mapping, no-store responses, request IDs, and safe logging.

#### UI and design patterns

- design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md (lines 1-192) - Binding tokens, density, typography, shadcn usage, 44-pixel targets, dark mode, reduced motion, and forbidden patterns.
- design-system/fuel-and-vehicle-dispatch-management-system/pages/master-data-management.md (lines 1-41) - Closest page contract for Server Components, client leaves, dialogs, tables/cards, and complete states.
- src/app/(protected)/layout.tsx (lines 8-93) - Permission-filtered navigation and protected page shell.
- src/app/(protected)/admin/(reference-data)/drivers/page.tsx (lines 19-133) - Server list page, page-query parsing, permissions, filters, and results.
- src/app/(protected)/admin/(reference-data)/drivers/[driverId]/page.tsx (lines 43-145) - Opaque-ID detail page and lifecycle actions.
- src/app/(protected)/admin/(reference-data)/loading.tsx (lines 3-30) - Reduced-motion loading skeleton.
- src/app/(protected)/admin/(reference-data)/error.tsx (lines 9-36) - Route-local request failure and retry.
- src/components/drivers/driver-form.tsx (lines 69-203) - React Hook Form, Zod resolver, field errors, pending states, and create navigation.
- src/components/master-data/reference-form-dialog.tsx (lines 14-40) - Ordinary create dialog shell.
- src/components/master-data/reference-lifecycle-dialog.tsx (lines 43-117) - Confirmations, reason handling, request errors, and focus behavior.
- src/components/master-data/responsive-reference-results.tsx (lines 3-27) - Desktop table and mobile card slots.
- src/components/master-data/reference-pagination.tsx - Non-link cursor ends and preserved navigation.
- src/components/master-data/reference-status-badge.tsx (lines 6-36) - Text, icon, and semantic token status treatment.
- src/components/master-data/form-field-error.tsx (lines 1-13) - Stable field-error association.
- src/components/forms/form-status.tsx (lines 5-33) - Live error and pending status.
- .claude/reports/manage-office-driver-vehicle-master-data-report.md (lines 60-73) - Do not combine router.push and router.refresh after create; preserve Strict Mode guards.

#### Test patterns

- vitest.config.ts (lines 11-30) - Unit coverage scope and 80-percent thresholds.
- vitest.coverage.config.ts (lines 11-34) - Combined unit/integration coverage gate.
- playwright.config.ts (lines 3-18) - Serial Chromium journeys and retained failure evidence.
- tests/unit/domain/office/office.test.ts (lines 12-57) - Entity lifecycle test shape.
- tests/unit/application/office/office-use-cases.test.ts (lines 33-192) - Permission, audit, no-op, and lifecycle use-case tests.
- tests/unit/app/api/offices/offices-route.test.ts (lines 65-126) - Authentication, authorization, Cross-Site Request Forgery, validation, and conflict route tests.
- tests/unit/components/master-data-components.test.ts (lines 13-88) - Static responsive component assertions.
- tests/integration/master-data/migration.test.ts (lines 21-131) - Schema, constraint, permission, and rollback inspection.
- tests/integration/master-data/repositories.test.ts (lines 107-212) - Current/historical/selector repository behavior.
- tests/integration/master-data/concurrency.test.ts (lines 57-194) - Exactly-one-winner create/update races.
- tests/integration/master-data/audit-atomicity.test.ts (lines 54-92) - Business-write and audit rollback proof.
- tests/e2e/master-data.spec.ts (lines 23-245) - Real lifecycle, responsive, focus, audit, and historical workflows.
- tests/e2e/master-data-permissions.spec.ts (lines 5-53) - Navigation, page, and API authorization.
- tests/e2e/accessibility.spec.ts (lines 34-68) - Axe coverage for populated pages and open dialogs.
- tests/e2e/audit-trail.spec.ts (lines 89-121) - Keyboard, dark mode, reduced motion, zoom, and overflow checks.
- tests/e2e/fixtures/auth.ts (lines 4-21) - Existing deterministic principals.
- tests/e2e/global-setup.ts (lines 71-360) - User seeding, migrations, app server, and audit worker.

### New Files to Create

#### Domain

- src/domain/budget/entities/budget-allocation.ts - Aggregate, lifecycle graph, current guard, restoration mapping, and operational state predicate.
- src/domain/budget/value-objects/ppmp-number.ts - Accepted normalization and one-to-80 length.
- src/domain/budget/value-objects/quarter.ts - Integer one-through-four invariant.
- src/domain/budget/value-objects/fiscal-year.ts - Four-digit 2000-through-9999 invariant.
- src/domain/budget/value-objects/budget-allocation-status.ts - DRAFT, ACTIVE, CLOSED, CANCELLED behavior.
- src/domain/budget/policies/fiscal-period-policy.ts - Replaceable policy interface and period value.
- src/domain/budget/policies/manila-fiscal-period-policy.ts - Initial calendar-quarter policy using Asia/Manila.

#### Application

- src/application/budget/dto/budget-allocation-dtos.ts - Request context, commands, admin DTOs, operational options, filters, and pages.
- src/application/budget/ports/budget-allocation-repository.ts - Explicit current, historical, locked, mutation, and list contracts.
- src/application/budget/ports/budget-transaction.ts - Allocation, office, and audit transaction seam.
- src/application/budget/ports/budget-use-case-dependencies.ts - Clock, IDs, fiscal policy, permissions, and transaction dependencies.
- src/application/budget/services/budget-permission-policy.ts - Read/manage rules and manage-implies-read.
- src/application/budget/services/budget-allocation-audit-events.ts - Safe action names and allowlisted snapshots.
- src/application/budget/use-cases/create-budget-allocation.ts
- src/application/budget/use-cases/get-budget-allocation.ts
- src/application/budget/use-cases/list-budget-allocations.ts
- src/application/budget/use-cases/list-operational-budget-allocations.ts
- src/application/budget/use-cases/update-budget-allocation.ts - Discriminated update, activate, close, and cancel command handling.
- src/application/budget/use-cases/soft-delete-budget-allocation.ts
- src/application/budget/use-cases/restore-budget-allocation.ts

#### Infrastructure

- src/infrastructure/database/migrations/20260828_000005_create_budget_allocations.ts - Table, checks, indexes, budget.read, assignments, and reversible down migration.
- src/infrastructure/database/budget/budget-allocation-cursor-codec.ts - Filter-bound opaque cursor.
- src/infrastructure/database/budget/kysely-budget-allocation-repository.ts - Mapping, joins, lists, locks, mutations, and conflict translation.
- src/infrastructure/database/budget/create-kysely-budget-repositories.ts - Transaction-local allocation and office repositories.
- src/infrastructure/database/budget/kysely-budget-transaction.ts - Business and audit atomicity.
- src/infrastructure/composition/budget.ts - Budget use-case composition.

#### API and page utilities

- src/lib/budget/route-schemas.ts - Discriminated mutation schemas, list schemas, effectiveDate, reasons, and UUIDv7.
- src/lib/budget/page-query.ts - Native GET filters and cursor hrefs.
- src/lib/budget/server-budget-access.ts - Server authentication, read/manage authorization, denial auditing, request context, and page reads.
- src/lib/budget/budget-form-response.ts - Field-level error parsing if master-data response mapping cannot be reused directly.

#### Route Handlers

- src/app/api/budget-allocations/route.ts - GET admin/operational modes and POST create.
- src/app/api/budget-allocations/[budgetAllocationId]/route.ts - GET and discriminated PATCH.
- src/app/api/budget-allocations/[budgetAllocationId]/soft-delete/route.ts
- src/app/api/budget-allocations/[budgetAllocationId]/restore/route.ts

#### UI

- design-system/fuel-and-vehicle-dispatch-management-system/pages/budget-allocation-management.md - Page-specific design contract.
- src/app/(protected)/budget-allocations/page.tsx
- src/app/(protected)/budget-allocations/[budgetAllocationId]/page.tsx
- src/app/(protected)/budget-allocations/loading.tsx
- src/app/(protected)/budget-allocations/error.tsx
- src/components/budget-allocations/budget-allocation-filter-form.tsx
- src/components/budget-allocations/budget-allocation-form.tsx
- src/components/budget-allocations/budget-allocation-results.tsx
- src/components/budget-allocations/budget-allocation-status-badge.tsx
- src/components/budget-allocations/budget-allocation-transition-dialog.tsx

#### Tests

- tests/unit/domain/budget/budget-allocation.test.ts
- tests/unit/domain/budget/fiscal-period-policy.test.ts
- tests/unit/application/budget/budget-use-cases.test.ts
- tests/unit/application/budget/budget-services.test.ts
- tests/unit/application/budget/budget-test-helpers.ts
- tests/unit/lib/budget/route-schemas.test.ts
- tests/unit/lib/budget/page-query.test.ts
- tests/unit/lib/budget/budget-form-response.test.ts
- tests/unit/infrastructure/database/budget-allocation-cursor-codec.test.ts
- tests/unit/infrastructure/composition/budget.test.ts
- tests/unit/app/api/budget-allocations/budget-allocation-routes.test.ts
- tests/unit/components/budget-allocation-components.test.ts
- tests/integration/helpers/budget-test-database.ts
- tests/integration/budget/migration.test.ts
- tests/integration/budget/repositories.test.ts
- tests/integration/budget/concurrency.test.ts
- tests/integration/budget/audit-atomicity.test.ts
- tests/e2e/budget-allocations.spec.ts
- tests/e2e/budget-allocation-permissions.spec.ts

### Existing Files to Update

- src/infrastructure/database/types.ts - Add BudgetAllocationsTable and budget_allocations to Database.
- src/infrastructure/composition/root.ts - Spread the budget composition and expose its policies/use cases.
- src/app/(protected)/layout.tsx - Add a budget.read-aware Budget allocations link with a Lucide icon.
- tests/integration/helpers/master-data-test-database.ts - Delete budget allocations before offices and users.
- tests/integration/database/migrations.test.ts - Expect migration 000005 and preserve up/down/up assertions.
- tests/integration/database/auth-migrations.test.ts - Update permission count and rollback depth assumptions.
- tests/integration/master-data/migration.test.ts - Roll back through 000005 before asserting migration 000004 removal.
- tests/integration/master-data/repositories.test.ts - Use foreign-key-safe cleanup order.
- tests/e2e/fixtures/auth.ts - Add Budget Officer and PSMD selector-reader credentials.
- tests/e2e/global-setup.ts - Seed deterministic budget principals and allocation fixtures after migration 000005.
- tests/e2e/accessibility.spec.ts - Add populated budget page and open dialog coverage.
- README.md - Document routes, permissions, fiscal policy, lifecycle, selectors, and validation.

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [Kysely SelectQueryBuilder forUpdate](https://kysely-org.github.io/kysely-apidoc/interfaces/SelectQueryBuilder.html)
  - Specific section: forUpdate
  - Why: Item transitions and lifecycle mutations require row locking.
- [Kysely Transaction API](https://kysely-org.github.io/kysely-apidoc/classes/Transaction.html)
  - Specific section: transaction-bound query methods
  - Why: Allocation, office checks, and AuditEventPort must share one transaction.
- [MySQL 8.4 CHECK Constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html)
  - Specific section: named enforced table checks
  - Why: Quarter, year, status, and deletion metadata require database enforcement.
- [MySQL 8.4 InnoDB Locks Set by Statements](https://dev.mysql.com/doc/refman/8.4/en/innodb-locks-set.html)
  - Specific section: locking reads and unique-index behavior
  - Why: Concurrent transitions and identity races need explicit locking expectations.
- [MySQL 8.4 Foreign Key Constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html)
  - Specific section: restrictions, indexes, and referential checks
  - Why: Allocation history must retain office and actor references without cascade deletion.
- [Radix accessibility overview](https://www.radix-ui.com/primitives/docs/overview/accessibility)
  - Specific section: keyboard navigation and focus management
  - Why: Transition and lifecycle dialogs must retain accessible focus behavior.
- [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog)
  - Specific section: Accessibility and Keyboard Interactions
  - Why: Create/edit dialogs require trapping, Escape behavior, labels, and focus return.
- [Tailwind state variants](https://tailwindcss.com/docs/hover-focus-and-other-states)
  - Specific section: focus-visible, dark mode, and prefers-reduced-motion
  - Why: Status controls and pending states must work across input and theme preferences.
- [W3C WCAG 2.2 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced)
  - Specific section: 44-by-44 target guidance
  - Why: The saved FVDMS design contract adopts 44-pixel targets.
- [W3C WCAG 2.2 Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
  - Specific section: minimum indicator area and contrast
  - Why: Every filter, dialog action, and table link needs a visible focus state.
- node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
  - Specific section: Server and Client Components
  - Why: Keep pages server-rendered and client boundaries narrow.
- node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md
  - Specific section: expected errors and error boundaries
  - Why: Validation/conflict errors remain values while unexpected failures use error.tsx.
- node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
  - Specific section: Route Handler request and response behavior
  - Why: This project deliberately keeps the established Route Handler plus CSRF pattern.
- node_modules/next/dist/docs/01-app/02-guides/forms.md
  - Specific section: validation and pending states
  - Why: Forms need server validation, preserved values, and duplicate-submission protection.
- node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md
  - Specific section: instant loading states
  - Why: Route-local loading UI must remain interruptible and accessible.
- node_modules/next/dist/docs/03-architecture/accessibility.md
  - Specific section: route announcements
  - Why: Each list/detail route needs a unique H1 and useful title.

### Patterns to Follow

**Naming conventions**

- Use budget-allocation for files and routes.
- Use BudgetAllocation for the domain entity and DTO prefix.
- Use budgetAllocationId for opaque public route parameters.
- Use ppmpNumber, officePublicId, quarter, fiscalYear, status, createdAt, and updatedAt in TypeScript.
- Use ppmp_number, office_id, fiscal_year, deleted_by_user_id, and delete_reason in MySQL.
- Use action names budget_allocation.created, .updated, .activated, .closed, .cancelled, .deleted, and .restored.

**Domain entity pattern**

```ts
export class BudgetAllocation {
  updateDetails(details: DraftDetails, at: Date): void {
    this.assertCurrent();
    this.status.assertDraft();
    // Assign normalized value objects and updatedAt.
  }

  activate(at: Date): void {
    this.assertCurrent();
    this.status = this.status.activate();
    this.updatedAt = at;
  }

  restore(at: Date): void {
    this.assertDeleted();
    this.status = this.status.isActive() ? BudgetAllocationStatus.draft() : this.status;
    this.clearDeletionEvidence();
    this.updatedAt = at;
  }
}
```

Keep fiscal and office eligibility outside the entity because they depend on a policy, clock, and another aggregate. The entity owns status transitions and current/deleted guards.

**Fiscal policy pattern**

```ts
export interface FiscalPeriod {
  readonly fiscalYear: number;
  readonly quarter: 1 | 2 | 3 | 4;
}

export interface FiscalPeriodPolicy {
  validate(input: FiscalPeriod): void;
  resolve(date: Date): FiscalPeriod;
  isEligible(allocation: FiscalPeriod, effectiveDate: Date): boolean;
}
```

The Manila implementation must use an explicit Asia/Manila formatter. Do not use the host timezone or Date.getMonth directly. Parse supplied YYYY-MM-DD values as civil dates without shifting them through a browser timezone.

**Mutation and audit order**

```ts
return dependencies.transaction.execute(async (repositories) => {
  const allocation = await repositories.allocations.findCurrentByPublicIdForUpdate(publicId);
  if (allocation === null) throw new NotFoundError();

  // Validate accepted state and, when required, lock/check the office.
  // Apply exactly one command.
  // Persist exactly one business mutation.
  // Append exactly one allowlisted audit event.

  return toBudgetAllocationAdminDto(allocation, office);
});
```

Never append the audit event after the transaction returns. Never publish full internal IDs or SQL details.

**HTTP command shape**

```ts
type PatchBudgetAllocationCommand =
  | {
      readonly action: 'update';
      readonly ppmpNumber?: string;
      readonly officePublicId?: string;
      readonly quarter?: number;
      readonly fiscalYear?: number;
    }
  | { readonly action: 'activate' }
  | { readonly action: 'close' }
  | { readonly action: 'cancel'; readonly reason: string };
```

Use one strict Zod discriminated union. The route parses and forwards the command. The application use case decides legal transitions, office checks, audit names, and error behavior.

**Error handling**

- Convert domain and fiscal-policy failures to stable ApplicationError subclasses before they reach withResponseHandler.
- Use ValidationError with field details for malformed PPMP, office, quarter, fiscal year, effective date, and reasons.
- Use ConflictError for the named unique tuple violation.
- Use BusinessRuleError with HTTP 422 for illegal transitions, non-draft edits, inactive-office activation, and fiscal-policy violations that are not input-shape errors.
- Use NotFoundError for absent, wrong-lifecycle, or inaccessible public IDs.
- Do not expose MySQL codes, constraint text, SQL, stack traces, or internal IDs.

**Repository and pagination**

- Use the database unique constraint as the concurrency authority.
- Use FOR UPDATE for item mutation and restore lookups.
- Lock/check the office inside create, reassignment, and activation transactions.
- Keep the tuple reserved after soft deletion.
- Join offices for list and detail DTOs. Historical joins must not filter deleted offices.
- Search normalized PPMP, office name, and abbreviation.
- Admin filters: query, fiscalYear, quarter, status, lifecycle, cursor, pageSize.
- Operational filters: query, effectiveDate, cursor, pageSize.
- API default page size: 50. UI page size: 25. Hard maximum: 200.
- Stable order: fiscal_year descending, quarter descending, ppmp_number ascending, public_id ascending.
- Cursor payload: version, direction, fiscalYear, quarter, ppmpNumber, publicId, and filter fingerprint.
- Fingerprint every filter, mode, effective-date-derived fiscal period, and page size.
- Fetch pageSize plus one to detect the next cursor.

**UI styling and interaction**

- Treat design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md as authoritative.
- The UI Ux Pro Max search was advisory. Its exaggerated-minimalism, Fira-font, marketing, and scroll-reveal output conflicts with the persisted FVDMS design and must not be used.
- Keep Lexend headings, Source Sans 3 interface text, semantic tokens, variance 3, motion 2, and density 8.
- Use existing shadcn new-york components and Lucide icons.
- Keep pages as Server Components. Use client leaves only for forms and dialogs.
- Create in an ordinary Dialog and navigate to the opaque-ID detail page after success.
- Do not call router.push and router.refresh concurrently.
- Use AlertDialog for activate, close, cancel, soft-delete, and restore confirmations.
- Keep the dialog open after expected errors and preserve entered values.
- Focus the first invalid field and return focus to the trigger on close.
- Disable actions only while their request is pending.
- Render statuses with text and an icon. Deleted lifecycle overrides the status visual.
- Render eligibility separately as Available for fuel or Not available for fuel with a plain-language reason.
- Use native GET filters so list state remains deep-linkable.
- Use a named table scroll region from 640 pixels upward and complete definition-list cards below 640 pixels.
- Preserve 44-pixel targets, two-pixel focus rings, 200-percent zoom, dark mode, reduced motion, and no viewport overflow.

---

## IMPLEMENTATION PLAN

### Phase 1: Contract and domain foundation

Lock the accepted lifecycle, normalization, fiscal policy, permission, DTO, and error contracts before persistence or UI work.

**Tasks:**

- Add budget value objects, status, aggregate, and Manila fiscal policy.
- Add budget DTOs, permission policy, repository ports, transaction port, audit builders, and application dependency interface.
- Add unit tests that pin every accepted default and illegal transition.

### Phase 2: Persistence, authorization, and composition

**Depends on:** Phase 1

Create migration 000005, repository mappings, locks, keyset pagination, permission seeding, transaction-bound office/audit reuse, and composition.

**Tasks:**

- Add the normalized budget_allocations table and budget.read assignments.
- Add database types, repository, cursor codec, repository factory, and transaction adapter.
- Add use cases for create, reads, operational selectors, discriminated update/transition commands, deletion, and restoration.
- Wire the budget composition into the root.
- Add MySQL migration, repository, concurrency, and audit-atomicity tests.

### Phase 3: Protected API

**Depends on:** Phase 2

Expose safe collection, item, soft-delete, and restore Route Handlers with read/manage authorization and field-level errors.

**Tasks:**

- Add Zod route contracts and page-query helpers.
- Add server request access and denial auditing.
- Add API routes and route-level tests.

### Phase 4: Design contract and interface

**Depends on:** Phase 3

Create the page-specific design contract, responsive pages, client form leaves, status/eligibility presentation, and transition dialogs.

**Tasks:**

- Add the top-level budget navigation link.
- Add list/detail/loading/error Server Components.
- Add create/edit/filter/results/status/transition components.
- Add static rendering, Playwright lifecycle, permissions, audit, accessibility, and responsive coverage.

### Phase 5: Regression updates and full validation

**Depends on:** Phases 1 through 4

Update migration-count assumptions, cleanup order, deterministic fixtures, documentation, and run the full project gate.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order. Each task is atomic and independently testable.

### Task 1 — CREATE the budget domain and fiscal policy

- **IMPLEMENT**: Add PpmpNumber, Quarter, FiscalYear, BudgetAllocationStatus, BudgetAllocation, FiscalPeriodPolicy, and ManilaFiscalPeriodPolicy.
- **IMPLEMENT**: Default creation to DRAFT and enforce the accepted transition graph.
- **IMPLEMENT**: Enforce current/deleted guards, draft-only identity edits, and accepted restore mapping.
- **IMPLEMENT**: Normalize PPMP values exactly as accepted.
- **IMPLEMENT**: Resolve the current period with Asia/Manila and validate years 2000 through 9999.
- **PATTERN**: Mirror src/domain/office/entities/office.ts:19-83 and src/domain/office/value-objects/office-name.ts:3-18.
- **IMPORTS**: DomainError, PublicId, and injected Clock-compatible Date input only.
- **GOTCHA**: Do not use host-local Date.getMonth. Do not put office repository access inside the domain.
- **VALIDATE**: pnpm exec vitest run --config vitest.config.ts tests/unit/domain/budget
- **SATISFIES**: AC3, AC4, AC5, AC8

### Task 2 — CREATE application DTOs, permissions, ports, and audit contracts

- **IMPLEMENT**: Define admin DTOs, compact operational options, list filters/pages, request context, create command, and discriminated PATCH command.
- **IMPLEMENT**: Define BudgetAllocationRepository with explicit current, historical, locked, mutation, admin list, and operational list methods.
- **IMPLEMENT**: Define BudgetTransaction with allocations, offices, and AuditEventPort.
- **IMPLEMENT**: Add BudgetPermissionPolicy with manage-implies-read and stable authorization errors.
- **IMPLEMENT**: Add allowlisted budget-allocation snapshots and the seven audit action names.
- **PATTERN**: Mirror src/application/office/dto/office-dtos.ts:8-69, src/application/office/ports/office-repository.ts:8-20, and src/application/master-data/ports/master-data-transaction.ts:1-15.
- **IMPORTS**: AuditEventPort, OfficeRepository, Clock, PublicIdGenerator, AuthenticatedPrincipal, and ApplicationError subclasses.
- **GOTCHA**: Admin DTOs may include lifecycle evidence. Operational DTOs must expose only stable public labels and identifiers.
- **VALIDATE**: pnpm exec vitest run --config vitest.config.ts tests/unit/application/budget/budget-services.test.ts
- **SATISFIES**: AC2, AC5, AC6, AC7, AC9, AC10

### Task 3 — CREATE migration 000005 and update Kysely database types

- **IMPLEMENT**: Create budget_allocations with internal BIGINT ID, BINARY(16) public ID, PPMP, office FK, quarter, year, status, deletion evidence, and DATETIME(6) timestamps.
- **IMPLEMENT**: Add named unique constraints for public ID and the normalized PPMP/office/quarter/year tuple.
- **IMPLEMENT**: Add named checks for quarter, fiscal year, statuses, and all-or-none deletion metadata.
- **IMPLEMENT**: Add restrictive office and deleting-user foreign keys.
- **IMPLEMENT**: Add admin and operational indexes matching list predicates and stable order.
- **IMPLEMENT**: Seed budget.read and the accepted six role assignments. Remove assignments and permission safely in down().
- **IMPLEMENT**: Add BudgetAllocationsTable and database mapping.
- **PATTERN**: Mirror src/infrastructure/database/migrations/20260828_000004_create_master_data.ts:47-235.
- **IMPORTS**: Kysely, sql, UUID parse, and type-only Database.
- **GOTCHA**: Migration runtime code must remain self-contained. Type-only alias imports are erased, but runtime alias imports can fail when migration files load outside Next.js.
- **GOTCHA**: Constraint names are schema-wide in MySQL. Use budget-specific names.
- **VALIDATE**: pnpm exec vitest run --config vitest.integration.config.ts tests/integration/budget/migration.test.ts
- **SATISFIES**: AC2, AC3, AC6, AC7, AC10

### Task 4 — CREATE the cursor codec and Kysely repository

- **IMPLEMENT**: Map binary UUIDs, internal office IDs, statuses, deletion actor, and UTC timestamps without leaking internal IDs.
- **IMPLEMENT**: Resolve current, including-deleted, current-for-update, and deleted-for-update records.
- **IMPLEMENT**: Join current or historical office labels as appropriate.
- **IMPLEMENT**: Add insert, draft-detail update, status update, soft-delete, and restore methods.
- **IMPLEMENT**: Add admin and operational keyset lists with the accepted filters, order, page sizes, and fingerprinted cursors.
- **IMPLEMENT**: Translate only the named tuple constraint into a field-safe ConflictError.
- **PATTERN**: Mirror src/infrastructure/database/master-data/kysely-office-repository.ts and master-data-cursor-codec.ts:11-95.
- **IMPORTS**: Kysely Database/Transaction, UUID binary helpers, value objects, BudgetAllocation, ValidationError, ConflictError.
- **GOTCHA**: Operational queries must join current ACTIVE offices and enforce period/status/lifecycle predicates server-side even if callers pass other filters.
- **GOTCHA**: Historical queries must not accidentally filter deleted or inactive offices.
- **VALIDATE**: pnpm exec vitest run --config vitest.integration.config.ts tests/integration/budget/repositories.test.ts
- **SATISFIES**: AC3, AC6, AC7, AC8, AC10

### Task 5 — CREATE the budget transaction and composition

- **IMPLEMENT**: Build transaction-local allocation and office repositories plus transaction-scoped AuditEventPort.
- **IMPLEMENT**: Add KyselyBudgetTransaction and a frozen BudgetComposition containing policies and use cases.
- **IMPLEMENT**: Spread BudgetComposition into the root without adding repository construction directly to the root.
- **PATTERN**: Mirror create-kysely-master-data-repositories.ts, kysely-master-data-transaction.ts:17-29, and infrastructure/composition/master-data.ts.
- **IMPORTS**: createKyselyAuditEventPort or established audit factory, KyselyOfficeRepository, clock, UUIDv7 generator, and policy instances.
- **GOTCHA**: Reusing the office repository is required. Do not create a second office persistence abstraction.
- **VALIDATE**: pnpm exec vitest run --config vitest.config.ts tests/unit/infrastructure/composition/budget.test.ts tests/unit/infrastructure/composition/root.test.ts
- **SATISFIES**: AC5, AC6, AC9

### Task 6 — CREATE budget use cases with transaction-scoped audit capture

- **IMPLEMENT**: Create, get, admin list, operational list, update/transition, soft-delete, and restore use cases.
- **IMPLEMENT**: Require an operational locked office for create, reassignment, and activation.
- **IMPLEMENT**: Apply one discriminated PATCH command per transaction and append exactly one matching audit event.
- **IMPLEMENT**: Store cancellation and deletion reasons in safe audit metadata. Persist only deletion evidence in the allocation table.
- **IMPLEMENT**: Evaluate operational selectors through FiscalPeriodPolicy using effectiveDate or the current Manila date.
- **IMPLEMENT**: Return field ValidationError, tuple ConflictError, illegal-transition BusinessRuleError, or NotFoundError as appropriate.
- **PATTERN**: Mirror create-office.ts:13-45, update-office.ts:18-66, soft-delete-office.ts:11-52, and restore-office.ts:10-39.
- **GOTCHA**: withResponseHandler does not map raw DomainError. Convert domain/policy failures to an ApplicationError within the application boundary.
- **GOTCHA**: An audit append failure must roll back the allocation mutation and any office-dependent work.
- **VALIDATE**: pnpm exec vitest run --config vitest.config.ts tests/unit/application/budget
- **SATISFIES**: AC1 through AC10

### Task 7 — ADD MySQL concurrency and audit-atomicity proof

- **IMPLEMENT**: Prove identical concurrent creates yield exactly one success and one stable 409.
- **IMPLEMENT**: Prove concurrent tuple updates yield exactly one winner.
- **IMPLEMENT**: Prove concurrent close/cancel operations serialize and the loser observes a terminal state with 422.
- **IMPLEMENT**: Prove office deactivation/deletion removes allocations from operational lists without rewriting allocation rows.
- **IMPLEMENT**: Prove audit failure rolls back every business mutation and duplicate failures create no audit event.
- **PATTERN**: Mirror tests/integration/master-data/concurrency.test.ts:57-194 and audit-atomicity.test.ts:54-92.
- **GOTCHA**: Use deterministic barriers only around the intended race. Avoid timing-only sleeps.
- **VALIDATE**: pnpm exec vitest run --config vitest.integration.config.ts tests/integration/budget/concurrency.test.ts tests/integration/budget/audit-atomicity.test.ts
- **SATISFIES**: AC3, AC4, AC6, AC9, AC12

### Task 8 — CREATE strict route, form-response, and page-query schemas

- **IMPLEMENT**: Add strict create and discriminated PATCH schemas.
- **IMPLEMENT**: Add UUIDv7 item, cancellation/deletion reason, empty restore, admin list, and operational list schemas.
- **IMPLEMENT**: Parse effectiveDate only as YYYY-MM-DD and convert it through the fiscal policy without browser timezone shifts.
- **IMPLEMENT**: Add query, fiscalYear, quarter, status, lifecycle, cursor, and page-size normalization.
- **IMPLEMENT**: Add native GET page helpers that preserve every filter across cursor links.
- **IMPLEMENT**: Preserve server field details for form error focus.
- **PATTERN**: Mirror src/lib/master-data/route-schemas.ts:9-126, page-query.ts:8-54, and master-data-form-response.ts.
- **GOTCHA**: Empty native GET values must become undefined before Zod validation.
- **GOTCHA**: Operational cursor fingerprints must contain the policy-resolved period, not only the raw optional date.
- **VALIDATE**: pnpm exec vitest run --config vitest.config.ts tests/unit/lib/budget tests/unit/infrastructure/database/budget-allocation-cursor-codec.test.ts
- **SATISFIES**: AC3, AC5, AC6, AC10

### Task 9 — CREATE server access and protected Route Handlers

- **IMPLEMENT**: Authenticate every route and record durable authorization denials.
- **IMPLEMENT**: Require read permission for GET collection/item/operational modes and manage permission for mutations.
- **IMPLEMENT**: Enforce JSON content type, allowed origin, and CSRF token for POST/PATCH mutations.
- **IMPLEMENT**: Route GET mode to the correct admin or operational use case.
- **IMPLEMENT**: Route PATCH discriminated commands to UpdateBudgetAllocation without owning lifecycle rules.
- **IMPLEMENT**: Use status 201 for create and safe success envelopes for other commands.
- **PATTERN**: Mirror src/app/api/offices/route.ts:10-64 and the office item/lifecycle handlers.
- **GOTCHA**: UI hiding is not authorization. Recheck permissions in the use case.
- **GOTCHA**: Never address or return sequential allocation or office IDs.
- **VALIDATE**: pnpm exec vitest run --config vitest.config.ts tests/unit/app/api/budget-allocations
- **SATISFIES**: AC1, AC2, AC6, AC7, AC10

### Task 10 — CREATE the budget page design contract

- **IMPLEMENT**: Add budget-allocation-management.md that inherits MASTER.md without changing tokens, typography, or shell.
- **IMPLEMENT**: Document top-level route, deep-linkable GET filters, Server Component boundaries, field order, lifecycle actions, status/eligibility separation, and complete UI states.
- **IMPLEMENT**: Document responsive table/cards, 44-pixel targets, focus return, first-error focus, dark mode, reduced motion, and 200-percent zoom.
- **PATTERN**: Mirror pages/master-data-management.md:1-41.
- **IMPORTS**: No runtime imports.
- **GOTCHA**: Do not persist the advisory generated marketing design. The saved MASTER remains authoritative.
- **VALIDATE**: pnpm exec prettier --check design-system/fuel-and-vehicle-dispatch-management-system/pages/budget-allocation-management.md
- **SATISFIES**: AC11

### Task 11 — CREATE budget list/detail/loading/error Server Components

- **IMPLEMENT**: Add /budget-allocations list and opaque-ID detail pages.
- **IMPLEMENT**: Authenticate and authorize on the server, parse page state, read through composition, and render read-only or management actions by permission.
- **IMPLEMENT**: List filters: PPMP/office query, fiscal year, quarter, allocation status, and record lifecycle.
- **IMPLEMENT**: Render explicit loading, request error, denied, invalid-filter, empty, filtered-empty, populated, deleted, terminal, and cursor-end states.
- **IMPLEMENT**: Add a budget.read-aware protected navigation link with a consistent Lucide icon.
- **PATTERN**: Mirror drivers/page.tsx, drivers/[driverId]/page.tsx, and audit/page.tsx request-state handling.
- **GOTCHA**: Route-local loading/error files are required because the FVD-004 reference-data boundaries do not wrap this top-level module.
- **GOTCHA**: Every route needs a unique H1 for Next route announcements.
- **VALIDATE**: pnpm typecheck
- **SATISFIES**: AC1, AC2, AC7, AC11

### Task 12 — CREATE budget forms, results, status, and transition dialogs

- **IMPLEMENT**: Use React Hook Form and Zod for PPMP, office, quarter, and fiscal-year fields.
- **IMPLEMENT**: Create uses active office options, quarter choices exactly one through four, and a numeric fiscal-year input with inputMode numeric.
- **IMPLEMENT**: Keep create in ReferenceFormDialog, then navigate to the detail page without an immediate refresh.
- **IMPLEMENT**: Use responsive results with PPMP, office, period, status, eligibility, lifecycle, updated time, and action in both desktop and mobile layouts.
- **IMPLEMENT**: Add status and eligibility text plus Lucide icons. Deleted state takes visual precedence.
- **IMPLEMENT**: Add confirmed activate, close, cancel, delete, and restore actions. Show reason input only for cancel/delete.
- **IMPLEMENT**: Preserve values, keep dialogs open on expected errors, focus the first invalid field, return focus on close, and announce pending/errors.
- **PATTERN**: Mirror driver-form.tsx:69-203 and master-data presentation primitives.
- **GOTCHA**: Do not render an allocation amount or utilization percentage.
- **GOTCHA**: Do not allow read-only users to receive enabled mutation controls.
- **VALIDATE**: pnpm exec vitest run --config vitest.config.ts tests/unit/components/budget-allocation-components.test.ts
- **SATISFIES**: AC1, AC2, AC4, AC6, AC8, AC11

### Task 13 — ADD browser lifecycle, permission, audit, and accessibility journeys

- **IMPLEMENT**: Seed a Budget Officer, PSMD selector reader, viewer, auditor, and deterministic allocations across statuses and periods.
- **IMPLEMENT**: Test create, draft edit, activate, close, cancel reason, delete reason, deleted filter/detail, and accepted restore mapping.
- **IMPLEMENT**: Test illegal edits/transitions, duplicate tuple preservation, server fiscal validation, and first-invalid focus.
- **IMPLEMENT**: Test operational selector inclusion/exclusion for status, lifecycle, effective date, and office state.
- **IMPLEMENT**: Test budget.read/manage navigation, pages, and API authorization.
- **IMPLEMENT**: Poll the existing audit UI for every budget_allocation.* event.
- **IMPLEMENT**: Test axe, keyboard flow, dialog focus return, dark mode, reduced motion, 375/768/1024/1440 widths, 200-percent zoom, and no viewport overflow.
- **PATTERN**: Mirror master-data.spec.ts, master-data-permissions.spec.ts, accessibility.spec.ts, and audit-trail.spec.ts.
- **GOTCHA**: Playwright is serial and shares fixtures. Keep lifecycle ordering deterministic.
- **VALIDATE**: pnpm exec playwright test --project=chromium tests/e2e/budget-allocations.spec.ts tests/e2e/budget-allocation-permissions.spec.ts tests/e2e/accessibility.spec.ts
- **SATISFIES**: AC1 through AC12

### Task 14 — UPDATE migration regressions, cleanup, README, and audit verification

- **IMPLEMENT**: Update migration counts, latest-migration assumptions, rollback depths, and expected permission totals.
- **IMPLEMENT**: Delete budget allocations before offices/users in every integration cleanup helper.
- **IMPLEMENT**: Verify up/down/up leaves migration 000004 and its data safe when expected.
- **IMPLEMENT**: Document routes, permissions, status graph, fiscal policy, operational selector, soft-delete behavior, and validation commands.
- **IMPLEMENT**: Run the container audit verifier after real mutations to ensure the chain includes the new events.
- **PATTERN**: Mirror the FVD-004 README and migration regression updates.
- **GOTCHA**: A single migrateDown now removes migration 000005, not 000004.
- **VALIDATE**: pnpm exec vitest run --config vitest.integration.config.ts tests/integration/database tests/integration/master-data tests/integration/budget
- **SATISFIES**: AC7, AC9, AC10, AC12

### Task 15 — RUN the complete quality gate

- **IMPLEMENT**: Run focused tests first, then the full validation command from the final tree.
- **IMPLEMENT**: Confirm Docker app health at https://fvdms.lan, migration 000005 status, audit worker health, and an end-to-end budget flow.
- **IMPLEMENT**: Inspect git diff and generated files for accidental secrets, raw colors, runtime migration aliases, internal IDs, or unrelated changes.
- **PATTERN**: Use package.json scripts and scripts/dev helpers.
- **GOTCHA**: The host may report Node 26 warnings. Project and Docker contracts require Node 24.
- **VALIDATE**: pnpm validate && git diff --check
- **SATISFIES**: AC12

---

## TESTING STRATEGY

### Unit Tests

#### Domain

- PPMP trims, collapses whitespace, uppercases, preserves punctuation/leading zeros, and enforces one through 80 characters.
- Quarter accepts only integers one through four.
- Fiscal year accepts only integers 2000 through 9999.
- New allocations default to DRAFT.
- DRAFT permits identity edits, activation, cancellation, and deletion.
- ACTIVE permits closure, cancellation, and deletion but rejects identity edits and activation.
- CLOSED and CANCELLED reject transitions and identity edits.
- Restore maps DRAFT to DRAFT, ACTIVE to DRAFT, CLOSED to CLOSED, and CANCELLED to CANCELLED.
- Current/deleted guards reject invalid lifecycle operations.

#### Fiscal policy

- Every calendar month maps to the expected quarter.
- Asia/Manila year and day boundaries are explicit.
- The policy does not change when the host process timezone changes.
- Effective YYYY-MM-DD values remain civil dates without UTC shifting.
- Missing effectiveDate uses the injected clock and current Manila period.
- Eligibility requires exact fiscal year and quarter.
- The policy is replaceable through the interface in use-case tests.

#### Application

- budget.manage implies read.
- Each accepted role succeeds or fails according to the migration contract.
- Creation locks/checks an operational office and emits one created event.
- Draft updates allow partial identity changes and emit one updated event.
- Activation/close/cancel enforce state, reason, office, and event behavior.
- Soft-delete and restore enforce lifecycle and emit one event.
- Audit failures roll back mutations.
- No-op or empty commands fail predictably and do not emit audit.
- Operational selector delegates period resolution to FiscalPeriodPolicy.
- DTOs never expose internal IDs.

#### Route and library

- Authentication, authorization, denial auditing, content type, origin, Cross-Site Request Forgery, UUIDv7, and safe response envelopes.
- Strict bodies reject unknown keys.
- Action discriminators require only action-appropriate fields.
- Quarter/year/effective-date/reason errors retain field details.
- Page size 201 fails.
- Invalid/replayed cursor with changed filters, mode, date, or page size fails.
- Form response parsing preserves expected values and safe field errors.

#### Components

- Visible labels and stable description/error associations.
- Quarter options are exactly one through four.
- Status and eligibility use explicit text and icons.
- Desktop and mobile results contain every important field/action.
- Pagination ends are non-links.
- Read-only details omit mutation actions.
- Native GET filters preserve values.

### Integration Tests

#### Migration

- Table, column types, nullability, named checks, unique tuple, indexes, foreign keys, and deletion evidence.
- budget.read exists with exactly the accepted assignments.
- Migration down removes its role assignments, permission, and allocation table without damaging prior permissions/tables.
- Up/down/up remains deterministic.

#### Repository

- Admin list filters PPMP, office name/abbreviation, year, quarter, status, and lifecycle.
- Current and including-deleted detail paths resolve the correct office label.
- Default lists exclude deleted rows.
- Operational lists include only current ACTIVE allocations matching the effective period and current ACTIVE office.
- Inactive/deleted offices remove allocations from selectors but not historical reads.
- Forward/backward cursor pages remain stable with duplicate adjacent sort fields.
- Changing cursor-bound filters fails.

#### Concurrency

- Identical normalized create tuple: exactly one winner.
- Conflicting draft tuple updates: exactly one winner.
- Close versus cancel: row lock serializes transitions and leaves one terminal result.
- Duplicate failures return safe conflicts and append no audit event.

#### Atomicity

- Allocation insert/update/status/delete/restore and audit append commit together.
- Audit append failure rolls back the allocation mutation.
- Office eligibility failure leaves no allocation or audit event.
- Failed business persistence leaves no outbox event.

### End-to-End Tests

- Budget Officer can complete every lifecycle action.
- PSMD staff can read operational selector options but cannot manage.
- Viewer and auditor can read historical pages without mutation controls.
- Unauthorized dispatch-only user has no navigation and receives 403.
- Unauthenticated requests receive 401.
- Duplicate and fiscal-policy failures retain dialog values and focus the relevant field.
- Closed, cancelled, deleted, future, past, inactive-office, and mismatched-quarter allocations do not appear in the current selector.
- Supplying a matching effectiveDate returns the correct historical/future ACTIVE option.
- Existing audit trail displays finalized allocation events.
- Dark, reduced-motion, keyboard, zoom, widths, and overflow scenarios remain usable.

### Edge Cases

- PPMP values differ only by case or repeated whitespace.
- PPMP contains punctuation and leading zeros.
- Quarter is zero, five, decimal, numeric string, empty string, or repeated query value.
- Fiscal year is 1999, 10000, decimal, missing, or nonnumeric.
- Effective date is invalid, a timestamp rather than a date, leap day, Manila year boundary, or absent.
- Office becomes inactive/deleted between form display and submission.
- Allocation changes after form display and before mutation.
- Active allocation is deleted and restored.
- Terminal allocation is deleted and restored.
- Cancellation reason contains only whitespace, is too short, or exceeds 500 characters.
- Cursor is malformed, noncanonical base64url, from another mode, or from another effective period.
- Allocation and office names create long mobile content at 200-percent zoom.

---

## VALIDATION COMMANDS

Execute each level. Do not substitute a partial green run for the final full gate.

### Level 1: Syntax and style

```bash
pnpm format:check
pnpm lint
pnpm typecheck
git diff --check
```

### Level 2: Focused unit tests

```bash
pnpm exec vitest run --config vitest.config.ts tests/unit/domain/budget
pnpm exec vitest run --config vitest.config.ts tests/unit/application/budget
pnpm exec vitest run --config vitest.config.ts tests/unit/lib/budget
pnpm exec vitest run --config vitest.config.ts tests/unit/infrastructure/database/budget-allocation-cursor-codec.test.ts
pnpm exec vitest run --config vitest.config.ts tests/unit/infrastructure/composition/budget.test.ts
pnpm exec vitest run --config vitest.config.ts tests/unit/app/api/budget-allocations
pnpm exec vitest run --config vitest.config.ts tests/unit/components/budget-allocation-components.test.ts
```

### Level 3: Focused MySQL integration tests

```bash
pnpm exec vitest run --config vitest.integration.config.ts tests/integration/budget
pnpm exec vitest run --config vitest.integration.config.ts tests/integration/database tests/integration/master-data
```

### Level 4: Focused browser tests

```bash
pnpm exec playwright test --project=chromium tests/e2e/budget-allocations.spec.ts tests/e2e/budget-allocation-permissions.spec.ts tests/e2e/accessibility.spec.ts
```

### Level 5: Full project gate

```bash
pnpm validate
git diff --check
```

### Level 6: Local Docker verification

```bash
docker compose ps
docker compose exec app pnpm db:status
docker compose logs --tail=100 app audit-worker
pnpm audit:verify:container
```

Manual browser checks at https://fvdms.lan:

1. Sign in as a seeded Budget Officer.
2. Create a draft for an active office and current quarter.
3. Edit the draft and activate it.
4. Confirm it appears for a matching effective date.
5. Confirm it disappears for a mismatched date.
6. Close it and confirm it disappears but remains historically readable.
7. Create another draft, cancel it with a reason, and confirm terminal behavior.
8. Soft-delete an active allocation, restore it, and confirm it returns as DRAFT.
9. Inspect the audit trail for every action.
10. Repeat a read-only check as PSMD staff, viewer, and auditor.

---

## COMPLETION CHECKLIST

- [ ] FVD-004 exists in the implementation base.
- [ ] All accepted decisions are implemented without reopening them.
- [ ] No allocation amount or downstream fuel/reporting scope was added.
- [ ] Domain invariants and Manila fiscal policy are complete.
- [ ] Migration 000005 is reversible and database constraints are verified.
- [ ] budget.read assignments and manage-implies-read behavior match the plan.
- [ ] Repository current/historical/locked/operational paths are distinct.
- [ ] Operational selection checks status, lifecycle, fiscal period, and office state.
- [ ] Every mutation and audit event is atomic.
- [ ] API routes enforce authentication, authorization, CSRF, UUIDv7, and safe errors.
- [ ] List/detail pages preserve Server Component boundaries.
- [ ] Forms and dialogs preserve values, errors, focus, and pending behavior.
- [ ] Responsive table/cards contain the same essential information.
- [ ] Dark mode, reduced motion, keyboard, zoom, and viewport checks pass.
- [ ] Migration regression tests and cleanup order are updated.
- [ ] README and page design contract are updated.
- [ ] Focused unit, integration, and browser tests pass.
- [ ] pnpm validate passes from the final tree.
- [ ] git diff --check passes.
- [ ] Docker health, migration status, audit worker, and audit verification pass.
- [ ] Implementation report records any real deviation before commit.

---

## OPEN QUESTIONS / ASSUMPTIONS

No blocking product questions remain. The user accepted all recommended defaults.

- **Accepted — lifecycle**: DRAFT-first, draft-only identity edits, DRAFT to ACTIVE/CANCELLED, ACTIVE to CLOSED/CANCELLED, terminal states do not reopen.
- **Accepted — reasons**: cancellation and soft deletion require a normalized 10-to-500-character reason; activation and closure require confirmation only.
- **Accepted — route contract**: keep the documented PATCH item endpoint with a discriminated action payload.
- **Accepted — fiscal policy**: years 2000 through 9999, quarters one through four, effective-date eligibility, and Asia/Manila current-date fallback.
- **Accepted — office rule**: create, reassignment, activation, and operational selection require a current ACTIVE office.
- **Accepted — restore rule**: DRAFT stays DRAFT, ACTIVE becomes DRAFT, and CLOSED/CANCELLED remain terminal.
- **Accepted — permissions**: budget.read for administrators, Budget Officers, PSMD staff, viewers, and auditors; budget.manage remains LGU-wide for its existing manager roles.
- **Accepted — PPMP normalization**: trim, collapse whitespace, uppercase, preserve punctuation/leading zeros, and reserve deleted tuples.
- **Inherited — no monetary amount**: the ticket, PRD, and architecture define no allocation amount. Do not invent one.
- **Assumed — soft-delete availability**: any current allocation may be soft-deleted because the ticket requires lifecycle deletion and FVD-004 permits deletion across current statuses. Restore safety prevents silent reactivation.
- **Assumed — cancellation reason storage**: keep cancellation reason in immutable audit metadata rather than adding an undocumented allocation-table column.

Confirm the two labeled assumptions before execution only if implementation evidence contradicts the inherited FVD-004 or audit patterns. Otherwise execute them as written.

---

## NOTES

### Architecture flow

```text
Budget page / downstream fuel form
              |
              v
Protected Route Handler
  authenticate -> authorize -> validate -> map command
              |
              v
Budget application use case
  fiscal policy -> lifecycle -> office eligibility
              |
              v
BudgetTransaction
  lock allocation/office
  write budget_allocations
  append audit_events outbox
  commit atomically
              |
              +--> admin/historical DTO
              |
              +--> operational option only when
                   ACTIVE + current + matching period + active office
```

### Why PATCH remains the status endpoint

The architecture explicitly publishes GET, POST, PATCH, soft-delete, and restore routes for budget allocations. The accepted default preserves that surface. A strict action discriminator retains command intent and prevents arbitrary status assignment without adding undocumented activate, close, or cancel routes.

The use case must still treat each action as a domain command. The route only parses and forwards the union.

### Why operational selection accepts effectiveDate

FVD-006 must validate a budget allocation against the authoritative fuel transaction date, not the server wall clock. Accepting an optional civil effective date makes the selector reusable for transaction entry while preserving a convenient current-period default for standalone administration checks.

FVD-006 must recheck eligibility inside its posting transaction. A selector response is never authoritative proof that posting may proceed.

### Why no allocation amount exists

The current product contract defines only PPMP number, office, quarter, fiscal year, and status. Adding an amount would force unresolved currency, amendment, carryover, encumbrance, and utilization semantics into this ticket.

FVD-009 can initially report total fuel activity grouped by allocation. A later product decision can add a ceiling through a dedicated migration and financial contract.

### UI design decision

UI Ux Pro Max and UI Styling were applied during planning. Their accessibility, focus, responsive, dark-mode, and feedback guidance reinforces the persisted FVDMS system.

The generated search also suggested exaggerated minimalism, Fira fonts, and scroll reveals. Those recommendations were rejected because the saved design system explicitly defines a restrained internal government application, Lexend/Source Sans 3, low motion, dense scanning, no marketing hero, and no GSAP.

### Primary implementation risks

1. Deriving fiscal periods from the host timezone instead of Asia/Manila.
2. Restoring a formerly ACTIVE allocation directly to ACTIVE.
3. Treating selector visibility as authoritative during FVD-006 posting.
4. Filtering deleted/inactive offices out of historical allocation reads.
5. Letting a route or generic status field bypass the transition graph.
6. Appending audit evidence outside the business transaction.
7. Breaking older migration tests that assume migration 000004 is latest.
8. Cleaning offices before budget allocations and violating the new foreign key.
9. Returning DomainError directly to withResponseHandler.
10. Reintroducing overlapping router.push and router.refresh requests after create.

### Confidence score

**9/10** for one-pass implementation.

The codebase now has strong FVD-004 precedents for nearly every seam. The remaining complexity is concentrated in the new fiscal policy, lifecycle graph, and foreign-key-aware concurrency tests. Those contracts are explicit in this plan.

## AMENDMENTS

(none)
