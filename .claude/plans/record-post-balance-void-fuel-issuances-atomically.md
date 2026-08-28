# Feature: Record, post, balance, and void fuel issuances atomically

The following plan is implementation-ready. Validate the referenced files and the current branch before changing code.

Preserve the accepted decisions below. Do not reopen them during implementation unless the repository has materially changed.

## Feature Description

FVD-006 delivers the first complete fuel-issuance workflow. Authorized PSMD staff can create and edit drafts, review active operational references, post an issuance, inspect its immutable ledger effect, and view reconciled Diesel and Gasoline balances.

Posting is the authoritative boundary. It allocates the monthly RIS number, rechecks every operational reference, calculates the amount with decimal arithmetic, changes the aggregate state, appends the issuance ledger entry, and records the audit event in one MySQL transaction.

Authorized administrators can void a posted issuance with a reason. Voiding preserves every original fact and appends one compensating ledger adjustment instead of editing history.

The interface extends the current protected shell. It uses the saved FVDMS design system, server-rendered pages, focused client components, accessible confirmation dialogs, responsive tables and cards, and explicit loading, empty, denied, conflict, and terminal states.

## User Story

As a PSMD staff member

I want to prepare, review, and post fuel issuances against active operational records

So that each transaction receives a reliable RIS number and produces a reconciled, auditable fuel balance

## Problem Statement

The system now governs users, master data, budget allocations, and immutable audit evidence. It still lacks the operational transaction that connects those foundations to accountable fuel movement.

Generating a RIS number separately from posting would allow duplicates or orphaned numbers. Using JavaScript numbers could corrupt monetary totals. Treating balances as editable snapshots would weaken the ledger, while deleting a mistaken issuance would erase evidence.

Drafts also need a safe preparation boundary. Staff must use current drivers, serviceable vehicles, and eligible allocations, but those references can change before posting. The server must therefore recheck them under locks when the transaction becomes authoritative.

## Solution Statement

Create a FuelIssuance aggregate with DRAFT, POSTED, and VOIDED lifecycle rules. Drafts accept business fields only and may hold a null actual quantity. Posted and voided records keep their RIS number, actual quantity, unit price, authoritative total, and posting timestamp permanently.

Add monthly sequence, issuance, and append-only ledger tables. Use named database constraints for lifecycle completeness, quantity rules, fuel types, uniqueness, and one issuance or compensation ledger row per fuel issuance.

Build application use cases around a fuel-specific transaction seam. Posting and voiding lock the issuance and required reference records, append the audit event through the existing durable outbox, and commit all effects together.

Expose protected collection, detail, draft-update, post, void, and balance Route Handlers. Keep decimal values as strings at every API boundary. Never accept RIS, authoritative total, status, or actor fields from the client.

Build list, new-draft, detail, and balance pages. Keep data loading in Server Components and use client leaves only for filters, draft forms, selector refreshes, and post or void dialogs.

## Out of Scope / Non-Goals

- Not included: manual opening-balance, receipt, or general-adjustment commands, routes, or screens.
- Not included: a supplier, purchase-receiving, tank-inventory, procurement, payment, or general-accounting workflow.
- Not included: blocking a post because the computed closing fuel balance would become negative.
- Not included: a budget amount, ceiling, obligation, remaining allocation balance, or utilization percentage.
- Not included: a fuel price-history table or price-administration workflow.
- Not included: configurable vehicle fuel limits, anomaly rules, approval chains, attachments, or a printable RIS form.
- Not included: reporting exports or background report jobs. FVD-009 owns reporting and Excel work.
- Not included: offline storage, mutation replay, synchronization identifiers, or conflict recovery. FVD-010 owns synchronization.
- Not included: server-side draft deletion or cancellation.
- Not included: editing or deleting any ledger row through an application repository or API.
- Not included: changing existing fuel-permission role assignments.
- Not included: a protected-shell redesign, sidebar, new font, new chart library, TanStack Table, GSAP, or new form dependency.
- Not changing: authentication, optional global MFA, Cross-Site Request Forgery protection, session handling, audit chaining, or sink delivery.

## Feature Metadata

**Ticket**: FVD-006

**Feature Type**: New vertical capability

**Estimated Complexity**: High

**Primary Systems Affected**: Fuel domain and application layer, MySQL schema, transaction composition, master-data and budget integration, audit capture, protected APIs, Next.js pages, shadcn/Radix UI, Vitest, MySQL integration tests, Playwright

**Direct Dependencies**: FVD-003 durable audit capture, FVD-004 office/driver/vehicle master data, FVD-005 fiscal budget eligibility

**Existing Runtime Dependencies**: Next.js 16.3.3, React 19.2.8, Kysely 0.29.5, MySQL 8.4, decimal.js, Zod 4.4.3, React Hook Form 7.86.0, Radix Dialog/AlertDialog, Tailwind CSS 4.3.3

**New Runtime Dependencies**: None

**Estimated Change Size**: About 2,500–3,500 lines including database, route, component, integration, and browser tests. This exceeds the ticket estimate because the current repository requires complete atomicity, permission, accessibility, and migration proof.

## Related Work

**Implements**: `docs/tickets/fuel-and-vehicle-dispatch-system.md:190-222`

**Epic**: `docs/PRD.md`

**Architecture**: `docs/System_Architecture.md`

**Back-references**:

- `.claude/plans/establish-durable-immutable-audit-capture-verification.md` defines transaction-scoped audit capture and outbox verification.
- `.claude/reports/manage-office-driver-vehicle-master-data-report.md:9-34` records current and historical reference lookups plus operational selector rules.
- `.claude/plans/manage-budget-allocations-fiscal-eligibility.md:1104-1114` requires entry-date eligibility and confirms that allocations have no monetary amount.
- `.claude/reports/manage-budget-allocations-fiscal-eligibility-report.md:9-57` records the completed allocation lifecycle and selector contract.

**Forward-references**:

- FVD-009 consumes immutable issuance, amount, allocation, office, and ledger facts for reports and exports.
- FVD-010 adds offline draft storage, replay identifiers, and server-authoritative synchronization.
- FVD-011 and FVD-012 depend on the completed operational and reporting seams.

**Execution dependency**:

- Implement from a branch containing FVD-005 commit `0ddfdc5` or its merged equivalent.
- Do not implement against a base missing migration 000006, budget repositories, global MFA settings, or the budget-allocation UI.
- Create the FVD-006 branch only after confirming the FVD-005 pull request integration state.

---

## ACCEPTED DECISION CONTRACT

The user accepted every recommended default on 2026-08-28. These are requirements, not open questions.

### Draft lifecycle

- Add `PATCH /api/fuel-issuances/:fuelIssuanceId`.
- Permit business-field edits only while the issuance is DRAFT.
- Keep POSTED and VOIDED business facts immutable.
- Do not add draft deletion or cancellation.
- Validate current operational references when creating or editing a draft.
- Revalidate and lock the same references again during posting.

### Requested and issued liters

- Allow `issuedLiters` to be null in every draft.
- Require positive actual issued liters for every posting.
- Prefill standard-request actual liters from requested liters in the UI.
- Require staff to confirm or change the actual value before posting.
- Keep `requestedLiters` null for full-tank records.
- Keep positive requested liters mandatory for non-full-tank drafts.

### Ledger scope and negative balances

- FVD-006 creates one negative ISSUANCE row when posting.
- FVD-006 creates one positive ADJUSTMENT row when voiding.
- The balance query understands OPENING, RECEIPT, ISSUANCE, and ADJUSTMENT rows.
- Tests may insert opening, receipt, and independent adjustment fixtures directly.
- Do not add user-facing write paths for those three source types.
- Show negative balances clearly, but do not reject posting solely for insufficient ledger stock.

### Decimal calculation

- Treat API decimal values as strings.
- Multiply the persisted actual issued liters by the persisted transaction unit price.
- Never round either input before multiplication.
- Round the product once to two decimal places with decimal.js `ROUND_HALF_UP`.
- Store and return the authoritative total with two fixed decimal places.

### RIS sequence

- Derive the RIS year and month from the authoritative `entryDate` in Asia/Manila.
- Format RIS as `YYYY-MM-XXX`, where three digits are the minimum width.
- Reset the counter for each calendar month.
- Permit values above 999. Sequence 1000 becomes `YYYY-MM-1000`.
- Allocate the number only inside the posting transaction.
- Roll the sequence increment back if any posting step fails.

### Balance period

- Accept inclusive `startDate` and `endDate` calendar dates.
- Accept an optional Diesel or Gasoline filter.
- Calculate opening from all signed ledger entries before `startDate`.
- Return opening, receipts, adjustments, issuances, net movement, and closing.
- Return separate Diesel and Gasoline summaries when the fuel type is absent.
- Use the ledger effective business date for period membership.

### Additional inherited decisions

- Keep unit price required and editable while DRAFT.
- Make unit price immutable when the issuance becomes POSTED.
- Keep the current permission assignments. Only SUPER_ADMIN currently holds `fuel.void`.
- Keep operational access LGU-wide because the current identity model has no office-scoped user assignment.
- Use the saved FVDMS design system as the visual authority.

---

## ACCEPTANCE CRITERIA

- **AC1 — Draft preparation**: An authorized creator can create, review, and edit a DRAFT using current operational driver, vehicle, office-linked allocation, and fuel data.
- **AC2 — Server ownership**: Destination defaults to AOR, while client-supplied RIS, authoritative total, status, and actor fields are rejected.
- **AC3 — Draft invariants**: A full-tank draft has no requested quantity; a standard draft has positive requested liters; either draft may have null actual liters.
- **AC4 — Posting input**: Every post requires positive actual issued liters, with standard requests prefilled for explicit user confirmation.
- **AC5 — Atomic RIS**: Posting locks and advances the entry-date monthly sequence without duplicate RIS numbers under concurrency.
- **AC6 — RIS format**: Numbers use `YYYY-MM-XXX`, reset monthly, and continue beyond 999 with minimum-width padding.
- **AC7 — Decimal total**: The server calculates actual liters times unit price with decimal arithmetic and one `ROUND_HALF_UP` operation.
- **AC8 — Posting revalidation**: Driver, vehicle, allocation, allocation office, fiscal period, fuel facts, and lifecycle are rechecked within one transaction.
- **AC9 — Immutable posting evidence**: Each successful post produces exactly one negative ISSUANCE ledger row and one audit event.
- **AC10 — Rollback**: A failure in sequence, reference validation, issuance persistence, ledger append, or audit append leaves no partial posting effect.
- **AC11 — Balance reconciliation**: Inclusive period summaries reconcile opening plus receipts plus adjustments minus issuances into closing by fuel type.
- **AC12 — Reasoned void**: An authorized user can void one POSTED issuance with a normalized reason and one positive compensation entry.
- **AC13 — Historical preservation**: Voiding never alters or removes the original issuance or original ledger row.
- **AC14 — Ledger immutability**: No ledger update or delete method, command, Route Handler, or UI control exists.
- **AC15 — Authorization**: Create, read, post, and void controls and endpoints enforce their existing permissions independently.
- **AC16 — Accessible interface**: Fuel pages are responsive, keyboard-operable, token-driven, dark-mode complete, reduced-motion safe, and explicit about status and pending work.
- **AC17 — Verification**: Domain, API, repository, concurrency, rollback, calculation, ledger, authorization, component, accessibility, and browser tests pass through `pnpm validate`.

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: READ THESE BEFORE IMPLEMENTING

#### Product, ticket, and architecture

- `docs/tickets/fuel-and-vehicle-dispatch-system.md:190-222` — FVD-006 scope, acceptance criteria, seams, estimate, and dependencies.
- `docs/tickets/fuel-and-vehicle-dispatch-system.md:432-469` — feature dependency graph.
- `docs/PRD.md:68-75` — ledger and audit success requirements.
- `docs/PRD.md:96-107` — product exclusions.
- `docs/PRD.md:113-115` — PSMD persona.
- `docs/PRD.md:143-165` — fuel fields, required validation, and derived vehicle type.
- `docs/PRD.md:169-224` — RIS, full-tank behavior, unit price, and authoritative amount.
- `docs/PRD.md:228-265` — fuel types, balance equation, immutable history, and void compensation.
- `docs/PRD.md:632-653` — fuel page sections and prominent lifecycle information.
- `docs/PRD.md:700-739` — historical foreign keys and protected API requirements.
- `docs/PRD.md:743-758` — future offline drafts, excluded here.
- `docs/PRD.md:921-939` — product success measures.
- `docs/System_Architecture.md:156-180` — FuelIssuance aggregate.
- `docs/System_Architecture.md:215-281` — ledger authority, RIS, full tank, decimal arithmetic, and transaction-owned price.
- `docs/System_Architecture.md:299-302` — fiscal allocation linkage.
- `docs/System_Architecture.md:436-498` — proposed sequence, issuance, and ledger tables.
- `docs/System_Architecture.md:555-618` — audit events and durable delivery.
- `docs/System_Architecture.md:653-700` — permissions and route surface.
- `docs/System_Architecture.md:795-855` — commands, repositories, and posting transaction.
- `docs/System_Architecture.md:1012-1033` — fuel UI and accessibility direction.
- `docs/System_Architecture.md:1191-1206` — future supplier, approval, limits, printable RIS, and anomaly work.

#### Domain and application patterns

- `src/domain/shared/value-objects/decimal-value.ts:1-29` — existing decimal.js boundary to extend without exposing JavaScript numbers.
- `src/domain/budget/entities/budget-allocation.ts:25-117` — aggregate lifecycle and reconstruction pattern.
- `src/domain/budget/policies/manila-fiscal-period-policy.ts:6-79` — civil-date and Asia/Manila fiscal policy.
- `src/application/budget/dto/budget-allocation-dtos.ts:37-43` — downstream operational allocation option.
- `src/application/driver/dto/driver-dtos.ts:22-25` — operational driver option.
- `src/application/vehicle/dto/vehicle-dtos.ts:24-28` — operational vehicle option that must add vehicle type.
- `src/application/budget/ports/budget-allocation-repository.ts:18-31` — current, historical, operational, and locked lookup contract.
- `src/application/driver/ports/driver-repository.ts:8-20` — driver current and locked lookup contract.
- `src/application/vehicle/ports/vehicle-repository.ts:8-20` — vehicle current and locked lookup contract.
- `src/application/office/ports/office-repository.ts:8-20` — office current and locked lookup contract.
- `src/application/budget/ports/budget-transaction.ts:5-13` — transaction-scoped repository bundle.
- `src/application/budget/use-cases/create-budget-allocation.ts:20-59` — mutation and audit in one transaction.
- `src/application/budget/use-cases/update-budget-allocation.ts:24-142` — locked update and domain-error mapping.
- `src/application/budget/use-cases/list-operational-budget-allocations.ts:17-41` — explicit effective-date selector.
- `src/application/budget/services/budget-allocation-audit-events.ts:23-52` — allowlisted audit snapshot with decimal-safe strings.

#### Infrastructure and persistence patterns

- `src/infrastructure/database/client.ts:14-30` — UTC DATETIME behavior and decimal strings.
- `src/infrastructure/database/types.ts:201-235` — Kysely table type conventions.
- `src/infrastructure/database/migrations/20260828_000002_create_authentication_and_rbac.ts:9-72` — fuel permission catalog and current role assignments.
- `src/infrastructure/database/migrations/20260828_000005_create_budget_allocations.ts:7-149` — named checks, indexes, foreign keys, and migration style.
- `src/infrastructure/database/budget/kysely-budget-allocation-repository.ts:228-351` — operational SQL and `FOR UPDATE` lookups.
- `src/infrastructure/database/budget/kysely-budget-allocation-repository.ts:440-450` — duplicate-constraint error mapping.
- `src/infrastructure/database/budget/budget-allocation-cursor-codec.ts:23-117` — signed cursor with filter fingerprint.
- `src/infrastructure/database/budget/kysely-budget-transaction.ts:17-29` — Kysely transaction wrapper.
- `src/infrastructure/database/budget/create-kysely-budget-repositories.ts:18-27` — transaction-scoped audit repository composition.
- `src/infrastructure/composition/budget.ts:19-50` — use-case composition.
- `src/infrastructure/composition/root.ts:35-55` and `src/infrastructure/composition/root.ts:160-163` — root dependency aggregation.

#### API and server access patterns

- `src/lib/budget/route-schemas.ts:7-165` — strict Zod bodies, filters, limits, and discriminated actions.
- `src/lib/budget/page-query.ts` — URL query parsing for protected pages.
- `src/lib/budget/server-budget-access.ts:19-82` — permission checks and denial audit events.
- `src/app/api/budget-allocations/route.ts:14-60` — authenticated GET/POST, CSRF validation, and envelopes.
- `src/app/api/budget-allocations/[budgetAllocationId]/route.ts:14-52` — dynamic Promise params and PATCH handling.
- `src/app/(protected)/budget-allocations/page.tsx:21-121` — Server Component page composition.
- `src/app/(protected)/budget-allocations/[budgetAllocationId]/page.tsx:17-119` — detail data loading and permission-aware controls.
- `src/app/(protected)/budget-allocations/error.tsx:9-38` — route error boundary and focus behavior.

#### UI and design patterns

- `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md` — authoritative typography, color, spacing, motion, and accessibility system.
- `design-system/fuel-and-vehicle-dispatch-management-system/pages/master-data-management.md` — established administrative layout language.
- `design-system/fuel-and-vehicle-dispatch-management-system/pages/budget-allocation-management.md` — closest page-level management contract.
- `src/app/(protected)/layout.tsx:18-35` and `src/app/(protected)/layout.tsx:97-122` — permission-aware top navigation.
- `src/components/master-data/responsive-reference-results.tsx:3-25` — desktop table and mobile card switch.
- `src/components/budget-allocations/budget-allocation-results.tsx:17-128` — accessible result counts, states, and pagination.
- `src/components/budget-allocations/budget-allocation-transition-dialog.tsx:70-230` — pending dialogs, error focus, and router refresh.
- `src/components/forms/form-status.tsx` — live success and failure feedback.
- `src/components/master-data/form-field-error.tsx` — field-error relationship.
- `src/components/ui/input.tsx:5-17` — input focus and disabled styling.
- `src/components/ui/native-select.tsx:5-14` — native select behavior.
- `src/components/ui/button.tsx:7-30` — button variants and target sizing.
- `src/components/ui/alert-dialog.tsx` — destructive confirmation primitive.
- `src/components/ui/card.tsx` and `src/components/ui/table.tsx` — saved surface and data-display primitives.

#### Test patterns

- `package.json:10-36` — project validation pipeline.
- `vitest.config.ts:11-29` — unit coverage thresholds.
- `vitest.integration.config.ts:11-18` — serial shared-MySQL integration suite.
- `playwright.config.ts:3-18` — serial Chromium browser suite.
- `tests/integration/budget/concurrency.test.ts:87-179` — competing transaction proof.
- `tests/integration/budget/audit-atomicity.test.ts:80-107` — injected audit failure rollback.
- `tests/integration/database/migrations.test.ts:214-268` — migration-count and latest-migration assumptions.
- `tests/e2e/budget-allocations.spec.ts:51-242` — lifecycle, focus, and helper patterns.
- `tests/e2e/budget-allocation-permissions.spec.ts` — read/manage separation.
- `tests/e2e/accessibility.spec.ts:64-105` — keyboard and automated accessibility checks.
- `tests/e2e/global-setup.ts:51-263` — shared users, references, and allocation fixtures.

### New Files to Create

#### Domain

- `src/domain/fuel/entities/fuel-issuance.ts`
- `src/domain/fuel/entities/fuel-ledger-entry.ts`
- `src/domain/fuel/value-objects/fuel-issuance-status.ts`
- `src/domain/fuel/value-objects/fuel-type.ts`
- `src/domain/fuel/value-objects/ris-number.ts`
- `src/domain/fuel/value-objects/fuel-quantity.ts`
- `src/domain/fuel/value-objects/unit-price.ts`
- `src/domain/fuel/value-objects/fuel-total.ts`
- `src/domain/fuel/value-objects/purchase-request-number.ts`
- `src/domain/fuel/value-objects/entry-date.ts`

#### Application

- `src/application/fuel/dto/fuel-dtos.ts`
- `src/application/fuel/ports/fuel-issuance-repository.ts`
- `src/application/fuel/ports/fuel-ledger-repository.ts`
- `src/application/fuel/ports/fuel-sequence-repository.ts`
- `src/application/fuel/ports/fuel-transaction.ts`
- `src/application/fuel/ports/fuel-use-case-dependencies.ts`
- `src/application/fuel/services/fuel-permission-policy.ts`
- `src/application/fuel/services/fuel-audit-events.ts`
- `src/application/fuel/services/fuel-use-case-support.ts`
- `src/application/fuel/use-cases/create-fuel-issuance.ts`
- `src/application/fuel/use-cases/update-draft-fuel-issuance.ts`
- `src/application/fuel/use-cases/get-fuel-issuance.ts`
- `src/application/fuel/use-cases/list-fuel-issuances.ts`
- `src/application/fuel/use-cases/post-fuel-issuance.ts`
- `src/application/fuel/use-cases/void-fuel-issuance.ts`
- `src/application/fuel/use-cases/get-fuel-balances.ts`

#### Infrastructure

- `src/infrastructure/database/migrations/20260828_000007_create_fuel_workflow.ts`
- `src/infrastructure/database/fuel/fuel-issuance-cursor-codec.ts`
- `src/infrastructure/database/fuel/kysely-fuel-issuance-repository.ts`
- `src/infrastructure/database/fuel/kysely-fuel-ledger-repository.ts`
- `src/infrastructure/database/fuel/kysely-fuel-sequence-repository.ts`
- `src/infrastructure/database/fuel/create-kysely-fuel-repositories.ts`
- `src/infrastructure/database/fuel/kysely-fuel-transaction.ts`
- `src/infrastructure/composition/fuel.ts`

#### Route and page utilities

- `src/lib/fuel/route-schemas.ts`
- `src/lib/fuel/page-query.ts`
- `src/lib/fuel/fuel-form-response.ts`
- `src/lib/fuel/server-fuel-access.ts`

#### Route Handlers

- `src/app/api/fuel-issuances/route.ts`
- `src/app/api/fuel-issuances/[fuelIssuanceId]/route.ts`
- `src/app/api/fuel-issuances/[fuelIssuanceId]/post/route.ts`
- `src/app/api/fuel-issuances/[fuelIssuanceId]/void/route.ts`
- `src/app/api/fuel-balances/route.ts`

#### Protected pages

- `src/app/(protected)/fuel-issuances/page.tsx`
- `src/app/(protected)/fuel-issuances/loading.tsx`
- `src/app/(protected)/fuel-issuances/error.tsx`
- `src/app/(protected)/fuel-issuances/new/page.tsx`
- `src/app/(protected)/fuel-issuances/[fuelIssuanceId]/page.tsx`
- `src/app/(protected)/fuel-issuances/balances/page.tsx`

#### UI components

- `src/components/fuel-issuances/fuel-issuance-filter-form.tsx`
- `src/components/fuel-issuances/fuel-issuance-results.tsx`
- `src/components/fuel-issuances/fuel-issuance-status-badge.tsx`
- `src/components/fuel-issuances/fuel-issuance-draft-form.tsx`
- `src/components/fuel-issuances/fuel-issuance-post-dialog.tsx`
- `src/components/fuel-issuances/fuel-issuance-void-dialog.tsx`
- `src/components/fuel-issuances/fuel-issuance-detail.tsx`
- `src/components/fuel-issuances/fuel-balance-filter-form.tsx`
- `src/components/fuel-issuances/fuel-balance-summary.tsx`
- `design-system/fuel-and-vehicle-dispatch-management-system/pages/fuel-issuance-management.md`

#### Tests

- `tests/unit/domain/fuel/*`
- `tests/unit/application/fuel/*`
- `tests/unit/lib/fuel/*`
- `tests/unit/app/api/fuel-issuances/*`
- `tests/unit/app/api/fuel-balances/route.test.ts`
- `tests/unit/components/fuel-issuance-components.test.tsx`
- `tests/integration/fuel/migration.test.ts`
- `tests/integration/fuel/repositories.test.ts`
- `tests/integration/fuel/posting.test.ts`
- `tests/integration/fuel/concurrency.test.ts`
- `tests/integration/fuel/audit-atomicity.test.ts`
- `tests/integration/fuel/balances.test.ts`
- `tests/integration/fuel/void.test.ts`
- `tests/e2e/fuel-issuances.spec.ts`
- `tests/e2e/fuel-issuance-permissions.spec.ts`

### Existing Files to Update

- `src/domain/shared/value-objects/decimal-value.ts`
- `src/application/vehicle/dto/vehicle-dtos.ts`
- `src/infrastructure/database/master-data/kysely-vehicle-repository.ts`
- `src/infrastructure/database/client.ts`
- `src/infrastructure/database/types.ts`
- `src/infrastructure/composition/root.ts`
- `src/app/(protected)/layout.tsx`
- `tests/integration/helpers/budget-test-database.ts`
- `tests/integration/helpers/master-data-test-database.ts`
- `tests/integration/database/migrations.test.ts`
- `tests/integration/database/auth-migrations.test.ts`
- `tests/integration/master-data/migration.test.ts`
- `tests/integration/budget/migration.test.ts`
- `tests/e2e/global-setup.ts`
- `tests/e2e/fixtures/auth.ts`
- `tests/e2e/accessibility.spec.ts`
- `README.md`

### Relevant Documentation TO READ BEFORE IMPLEMENTING

#### Repository-local Next.js 16.3.3 guides

- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — Web Request/Response APIs, supported methods, and uncached GET behavior.
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` — Server Component defaults and focused client boundaries.
- `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md` — expected errors versus route error boundaries.

#### Official external references

- [Next.js Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) — Route Handlers are public security boundaries; Server Components should call composition directly.
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — keep data reads on the server and interactivity in client leaves.
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) — Request/Response route conventions.
- [MySQL 8.4 Locking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html) — `SELECT ... FOR UPDATE` locks live until transaction completion.
- [MySQL 8.4 Locks Set by Statements](https://dev.mysql.com/doc/refman/8.4/en/innodb-locks-set.html) — indexes determine the scope of locking reads.
- [MySQL 8.4 CHECK Constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html) — named enforced constraints validate inserts and updates.
- [decimal.js API](https://mikemcl.github.io/decimal.js/#toDP) — `toDecimalPlaces` and `ROUND_HALF_UP` behavior.
- [shadcn Dialog](https://ui.shadcn.com/docs/components/aria/dialog) — accessible focus, labeling, and modal behavior.

### Patterns to Follow

#### Civil dates stay strings

Use `YYYY-MM-DD` domain values for `entryDate`, `startDate`, and `endDate`. Configure mysql2 with `dateStrings: ['DATE']` so MySQL DATE columns never cross a JavaScript timezone conversion.

Keep DATETIME values as UTC `Date` objects. Use `entryDate` for RIS and fiscal rules, while ledger `occurredAt` represents the effective Manila start-of-day instant and `createdAt` records the write time.

#### Decimal values never become JavaScript numbers

Extend the shared DecimalValue only with safe operations needed by fuel wrappers. Keep parsing, comparison, addition, negation, multiplication, rounding, and fixed-scale serialization inside decimal.js.

Use these storage scales:

- Requested and issued liters: `DECIMAL(10,3)`.
- Ledger absolute and signed quantities: `DECIMAL(12,3)`.
- Unit price: `DECIMAL(12,2)`.
- Total amount: `DECIMAL(14,2)`.

Reject scientific notation, non-string API values, zero, negatives where positive values are required, and excess input scale. Do not coerce with `Number`, `parseFloat`, or React Hook Form `valueAsNumber`.

#### Draft and terminal state database checks

Correct the architecture table's nullability conflict. RIS, issued liters, total, and posting timestamp must be nullable for DRAFT rows.

Use one named lifecycle check that guarantees:

- DRAFT: no RIS, total, posting time, void time, void reason, or void actor; actual liters may be null or positive.
- POSTED: RIS, positive actual liters, positive total, and posting time exist; void evidence is null.
- VOIDED: every posted fact remains and void time, normalized reason, and void actor exist.

Keep unit price positive for every lifecycle state. Keep requested liters null for full tank and positive for a standard request.

#### Monthly sequence locking

Use a unique `(sequence_year, sequence_month)` index. Insert-or-find the month row safely, lock that indexed row with `FOR UPDATE`, increment inside the transaction, and return the next integer.

Do not cap `last_number` at 999. Format with `padStart(3, '0')`, which preserves larger values.

Hold the lock until the posting transaction commits. A rollback must restore the previous counter and leave no reserved RIS gap.

#### Fixed lock order

Every posting transaction uses one lock order:

1. Fuel issuance.
2. Monthly sequence row.
3. Driver.
4. Vehicle.
5. Budget allocation.
6. Allocation office.

Keep the transaction short. Do not perform browser calls, network requests, or unrelated reads while locks are held.

#### Append-only ledger repository

Expose `append`, `listForIssuance`, and `summarize`. Do not define update, delete, replace, or generic save methods.

Use a unique `(fuel_issuance_id, transaction_type)` constraint for linked entries. It permits one ISSUANCE and one void ADJUSTMENT for the same issuance while nullable foreign keys allow future independent entry sources.

Store a positive absolute `quantity` plus a signed `signedQuantity`. ISSUANCE must be negative. OPENING, RECEIPT, and void compensation are positive. General adjustment fixtures may be positive or negative, but their absolute and signed values must agree.

#### Server pages call composition directly

Server Components should call fuel use cases from the root composition. They must not fetch their own Route Handlers.

Route Handlers remain public boundaries. They independently enforce authentication, the exact permission, CSRF for mutations, strict DTO parsing, bounded lists, and safe error envelopes.

#### Transaction wrapper pattern from the repository

Mirror the existing single-handle transaction boundary from `src/infrastructure/database/budget/kysely-budget-transaction.ts:17-29`:

```ts
execute<T>(work: (repositories: BudgetRepositories) => Promise<T>): Promise<T> {
  return this.database
    .transaction()
    .execute((transaction) =>
      work(createKyselyBudgetRepositories(transaction, this.auditOptions)),
    );
}
```

The fuel version changes the repository bundle, not the transaction shape. Sequence, issuance, ledger, reference locks, and audit outbox must all come from `transaction`.

#### Mutation and audit pattern from the repository

Follow the one-callback write and audit structure from `src/application/budget/use-cases/create-budget-allocation.ts:37-58`:

```ts
return this.dependencies.transaction.execute(async (repositories) => {
  const office = await repositories.offices.findCurrentByPublicIdForUpdate(
    details.officePublicId.toString(),
  );
  if (office === null) throw new NotFoundError();
  assertOperationalOffice(office);
  await repositories.allocations.insert(allocation);
  await repositories.auditEvents.append(buildBudgetAllocationAuditEvent(/* ... */));
  return toBudgetAllocationAdminDto(allocation, officeDto(office), false);
});
```

The fuel posting callback is larger, but it must preserve the same atomic boundary and safe domain-error behavior.

#### Route security pattern from the repository

Apply authentication before mutation validation, then enforce CSRF and a strict schema. The current pattern lives at `src/app/api/budget-allocations/route.ts:34-60`:

```ts
const authenticated = await authenticateBudgetRequest(
  currentRequest,
  composition,
  'manage',
  requestId,
  '/api/budget-allocations',
);
assertSecureJsonMutation({
  request: currentRequest,
  allowedOrigin: composition.authAllowedOrigin,
  csrfTokenHash: authenticated.csrfTokenHash,
  tokenGenerator: composition.secureTokenGenerator,
});
const command = createBudgetAllocationSchema.parse(await parseJsonBody(currentRequest));
```

Use fuel-specific access helpers, permissions, paths, and schemas. Do not reuse budget names or expose a generic mutation helper that weakens the explicit permission boundary.

#### UI design authority

Use Lexend and Source Sans 3, the restrained LGU palette, semantic tokens, compact operational surfaces, and low motion from `MASTER.md`.

The UI skill search suggested Fira typography, orange/blue marketing colors, an OLED-dark direction, gradients, and landing-page motion. Reject those suggestions because they conflict with the persisted project design system and the administrative product context.

Use the UI skills only to strengthen accessibility, responsive behavior, feedback, field grouping, target sizing, and state coverage.

---

## IMPLEMENTATION PLAN

### Phase 1: Domain contract and lifecycle

Define civil dates, fuel types, quantities, prices, totals, RIS formatting, issuance lifecycle, and immutable ledger entries. Extend DecimalValue without leaking numeric coercion.

**Depends on**: Existing shared errors, identifiers, clock, and decimal.js boundary.

**Exit condition**: Unit tests prove every lifecycle, full-tank, scale, rounding, and RIS rule.

### Phase 2: Persistence and transactions

Add migration 000007, Kysely types, fuel repositories, signed cursors, sequence locking, balance aggregation, and the transaction-scoped repository bundle.

**Depends on**: Phase 1 and migrations 000001 through 000006.

**Exit condition**: Migration and repository tests prove checks, mapping, locking, immutability, and period summaries.

### Phase 3: Application and protected API

Add permissions, audit builders, create/update/read/list/post/void/balance use cases, root composition, strict schemas, server access helpers, and Route Handlers.

**Depends on**: Phases 1 and 2 plus FVD-003 audit capture and FVD-004/FVD-005 locked reference repositories.

**Exit condition**: Unit and integration tests prove authorization, atomicity, concurrency, rollback, and safe request contracts.

### Phase 4: Page design contract and interface

Write the fuel page contract, add navigation, build Server Component pages, and add focused client components for filtering, editing, dependent selectors, posting, and voiding.

**Depends on**: Stable Phase 3 DTOs and use-case contracts.

**Exit condition**: Component and browser tests cover all roles, states, viewport modes, focus flows, and ledger effects.

### Phase 5: Shared regression updates and validation

Update shared migration expectations, database cleanup order, global browser fixtures, accessibility coverage, README documentation, and full audit verification.

**Depends on**: Phases 1 through 4.

**Exit condition**: `pnpm validate`, Docker health checks, and audit verification pass from a clean tree.

---

## STEP-BY-STEP TASKS

Each task is intended to be one reviewable implementation unit. Run its focused validation before starting the next task.

### Task 1 — UPDATE the decimal boundary and CREATE fuel value objects

**Files**: `src/domain/shared/value-objects/decimal-value.ts`; `src/domain/fuel/value-objects/*`; corresponding unit tests.

**IMPLEMENT**: String-only decimal parsing, scale guards, comparison, addition, negation, multiplication, explicit two-place `ROUND_HALF_UP`, fixed serialization, civil entry date, fuel type, status, request number, quantity, unit price, total, and RIS formatting.

**PATTERN**: Preserve the small immutable wrapper style in `decimal-value.ts:1-29` and the validation style used by existing domain value objects.

**GOTCHA**: Do not cap the RIS at 999. Do not accept exponent notation or a JavaScript number through route schemas.

**VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/domain/fuel`

**SATISFIES**: AC3, AC4, AC6, AC7.

### Task 2 — CREATE the FuelIssuance and FuelLedgerEntry entities

**Files**: `src/domain/fuel/entities/fuel-issuance.ts`; `src/domain/fuel/entities/fuel-ledger-entry.ts`; domain tests.

**IMPLEMENT**: Draft creation and reconstruction, draft-only edits, posting transition, terminal void transition, destination AOR default, full-tank rules, immutable posted facts, one negative issuance factory, and one positive compensation factory.

**PATTERN**: Mirror lifecycle commands and reconstruction from `budget-allocation.ts:25-117`. Return new domain state or mutate only through named legal transitions, matching existing conventions.

**GOTCHA**: Draft edit inputs must not contain RIS, total, status, actor, or timestamps. Voiding must preserve every posted fact.

**VALIDATE**: Run the domain test command from Task 1.

**SATISFIES**: AC1, AC2, AC3, AC8, AC12, AC13.

### Task 3 — CREATE fuel DTOs, ports, permissions, and audit builders

**Files**: `src/application/fuel/dto/fuel-dtos.ts`; all `src/application/fuel/ports/*`; all `src/application/fuel/services/*`; unit tests.

**IMPLEMENT**: String-valued decimal DTOs, list/detail/balance DTOs, explicit commands, read/create/post/void policy checks, allowlisted create/update/post/void snapshots, transaction repository bundle, and append-only ledger contract.

**PATTERN**: Follow budget DTO, permission policy, audit-event, and transaction ports. Use public identifiers at application boundaries.

**GOTCHA**: Never put driver contact data, session data, secrets, or unrestricted request bodies in audit metadata.

**VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/fuel`

**SATISFIES**: AC2, AC9, AC14, AC15.

### Task 4 — CREATE migration 000007 and UPDATE database types

**Files**: `src/infrastructure/database/migrations/20260828_000007_create_fuel_workflow.ts`; `src/infrastructure/database/types.ts`; `src/infrastructure/database/client.ts`; migration tests.

**IMPLEMENT**: `fuel_sequence_monthly`, `fuel_issuances`, and `fuel_ledger_entries`; public identifiers; foreign keys; named checks; RIS uniqueness; lifecycle nullability; void evidence; effective ledger date; immutable entry types; quantity sign consistency; indexes for list, balance, sequence, and references.

**PATTERN**: Match migration 000005 naming, timestamps, checks, indexes, and reversible down order. Add `dateStrings: ['DATE']` without changing DATETIME behavior.

**GOTCHA**: The architecture's NOT NULL draft columns are inconsistent with the workflow. Apply the accepted lifecycle constraint instead. Do not add a 999 sequence maximum.

**VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/fuel/migration.test.ts`

**SATISFIES**: AC3, AC5, AC6, AC9, AC12, AC13, AC14.

### Task 5 — CREATE sequence, issuance, ledger, and cursor repositories

**Files**: `src/infrastructure/database/fuel/*`; repository and balance tests.

**IMPLEMENT**: Insert/read/locked read/draft update/post/void/list methods; insert-or-lock-and-increment sequence logic; append/list/summarize ledger methods; signed filter-bound cursor; duplicate and lifecycle constraint error mapping.

**PATTERN**: Mirror the budget repository's mapping, `FOR UPDATE`, query limits, and cursor fingerprint. Keep decimal and DATE columns as strings.

**GOTCHA**: The sequence upsert must tolerate two first-of-month transactions. Ensure the unique indexed row is the one locked. The ledger repository must have no mutation method.

**VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/fuel/repositories.test.ts tests/integration/fuel/balances.test.ts`

**SATISFIES**: AC5, AC6, AC9, AC11, AC14.

### Task 6 — CREATE the fuel transaction and root composition

**Files**: `src/infrastructure/database/fuel/create-kysely-fuel-repositories.ts`; `src/infrastructure/database/fuel/kysely-fuel-transaction.ts`; `src/infrastructure/composition/fuel.ts`; `src/infrastructure/composition/root.ts`; composition tests.

**IMPLEMENT**: One transaction bundle containing issuance, sequence, ledger, driver, vehicle, allocation, office, and audit repositories. Export all fuel use cases through root composition.

**PATTERN**: Mirror the budget Kysely transaction and repository factory. Construct the audit outbox repository from the same transaction handle.

**GOTCHA**: Never create a second database connection inside the callback. Every posting and voiding write must share the transaction.

**VALIDATE**: Run application unit tests and focused repository integration tests.

**SATISFIES**: AC8, AC9, AC10, AC12.

### Task 7 — CREATE draft creation, editing, read, and list use cases

**Files**: create, update, get, and list use cases; vehicle DTO and repository; unit and integration tests.

**IMPLEMENT**: Create DRAFT, default AOR, validate operational references, validate allocation against entry date, edit business fields only in DRAFT, expose derived vehicle type, resolve historical references for details, and list with bounded filters.

**PATTERN**: Reuse operational-selector policies and including-deleted detail lookups from FVD-004/FVD-005. Extend the operational vehicle DTO rather than creating a fuel-only duplicate.

**GOTCHA**: A selector result is advisory. Draft validation does not replace posting-time locking. Avoid driver contact data in every fuel DTO.

**VALIDATE**: Run application fuel tests and repository integration tests.

**SATISFIES**: AC1, AC2, AC3, AC15.

### Task 8 — CREATE the atomic posting use case

**Files**: `src/application/fuel/use-cases/post-fuel-issuance.ts`; application tests; posting integration tests.

**IMPLEMENT**: Require `fuel.post`; lock in the fixed order; require DRAFT; reserve the entry-date RIS; recheck active driver, serviceable vehicle, active allocation, active office, and Manila fiscal period; require actual liters; calculate rounded total; post aggregate; append one negative ledger row and one audit event; commit.

**PATTERN**: Follow budget transaction-scoped mutation and audit patterns. Map expected lifecycle and eligibility failures to safe business errors.

**GOTCHA**: Unit price is the stored draft fact, not a live price lookup. A negative resulting fuel balance remains allowed. Do not catch an error in a way that commits the sequence increment.

**VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/fuel/posting.test.ts tests/integration/fuel/audit-atomicity.test.ts`

**SATISFIES**: AC4, AC5, AC6, AC7, AC8, AC9, AC10.

### Task 9 — PROVE posting concurrency and rollback behavior

**Files**: `tests/integration/fuel/concurrency.test.ts`; `tests/integration/fuel/audit-atomicity.test.ts`; required test helpers.

**IMPLEMENT**: Concurrent different-draft posts in one month, concurrent same-draft posts, first-row monthly contention, monthly reset, sequence above 999, audit failure, ledger failure, stale driver, stale vehicle, stale allocation, stale office, and fiscal-date mismatch cases.

**PATTERN**: Use real parallel Kysely transactions as in `tests/integration/budget/concurrency.test.ts:87-179`. Inject failing audit or ledger adapters as in the budget atomicity suite.

**GOTCHA**: Assert database effects after both promises settle. One competing same-draft post must win; the loser must produce no second sequence, ledger, or audit effect.

**VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/fuel/concurrency.test.ts tests/integration/fuel/audit-atomicity.test.ts`

**SATISFIES**: AC5, AC9, AC10.

### Task 10 — CREATE voiding and balance use cases

**Files**: void and balance use cases; ledger repository aggregation; void and balance tests.

**IMPLEMENT**: Require `fuel.void`; normalize a 10–500 character reason; lock POSTED issuance; mark VOIDED; append one positive ADJUSTMENT equal to original actual liters; audit the reason; summarize inclusive periods with pre-period opening and per-type totals.

**PATTERN**: Use terminal transition handling from budget and signed decimal aggregation in SQL. Return separate type summaries when no filter exists.

**GOTCHA**: Concurrent voids need one winner. The unique linked entry constraint is defense in depth. Never rewrite the original negative issuance row.

**VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/fuel/void.test.ts tests/integration/fuel/balances.test.ts`

**SATISFIES**: AC11, AC12, AC13, AC14.

### Task 11 — CREATE strict schemas, server access, and Route Handlers

**Files**: `src/lib/fuel/*`; all five fuel Route Handler files; route and library tests.

**IMPLEMENT**: Strict create/update/post/void bodies; calendar-date and filter parsing; optional fuel type; bounded page size; safe form responses; denial auditing; authentication; exact permissions; CSRF on mutations; dynamic Promise params; safe status codes.

**PATTERN**: Mirror budget handlers and server access. Use `GET`, `POST`, and `PATCH` exactly as documented in the accepted contract.

**GOTCHA**: Reject unknown keys, especially RIS, total, status, and actors. Do not create ledger mutation routes. Avoid leaking whether a protected object exists to an unauthorized caller.

**VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/lib/fuel tests/unit/app/api/fuel-issuances tests/unit/app/api/fuel-balances`

**SATISFIES**: AC1, AC2, AC4, AC11, AC12, AC14, AC15.

### Task 12 — CREATE the fuel page design contract

**Files**: `design-system/fuel-and-vehicle-dispatch-management-system/pages/fuel-issuance-management.md`.

**IMPLEMENT**: Page goals, roles, information hierarchy, six draft sections, status/RIS emphasis, filter contracts, desktop table, mobile cards, detail groups, balance summaries, dialogs, pending behavior, empty/error/conflict states, and responsive/accessibility acceptance checks.

**PATTERN**: Inherit MASTER.md and the master-data/budget page contracts. Record UI Ux Pro Max and UI Styling decisions without replacing the saved tokens.

**GOTCHA**: Do not introduce marketing visuals, gradients, an OLED theme, Fira fonts, or a new navigation shell.

**VALIDATE**: Review the contract against AC1, AC4, AC11, AC12, AC15, and AC16 before coding pages.

**SATISFIES**: AC16.

### Task 13 — CREATE list, new, detail, balance, loading, and error pages

**Files**: all protected page files; `src/app/(protected)/layout.tsx`; Server Component tests where appropriate.

**IMPLEMENT**: One permission-filtered Fuel navigation link; server-loaded list; full-page draft form; historical detail; post/void controls based on exact permissions; immutable ledger display; read-only balance page; route loading skeleton and focused error recovery.

**PATTERN**: Query composition directly in Server Components. Follow budget list/detail boundaries and responsive result treatment.

**GOTCHA**: A read-only user can inspect data without receiving hidden mutation capability. Avoid calling internal Route Handlers from Server Components.

**VALIDATE**: `pnpm typecheck` and focused component tests.

**SATISFIES**: AC1, AC11, AC13, AC15, AC16.

### Task 14 — CREATE draft, selector, post, void, result, and balance components

**Files**: all `src/components/fuel-issuances/*`; component tests.

**IMPLEMENT**: Five visible draft groups plus review actions; conditional full-tank request field; decimal string fields with `inputMode="decimal"`; entry-date budget refresh with abort protection; standard actual-liter prefill; desktop table and complete mobile cards; status badges; definition-list detail; post and void AlertDialogs; live balance summaries.

**PATTERN**: Reuse inputs, native selects, cards, tables, badges, form status, and field error components. Keep buttons at least 44 pixels and preserve visible focus.

**GOTCHA**: Clear an allocation that becomes invalid after entry-date change. Announce selector loading and results. Keep dialogs open and move focus to meaningful feedback on server errors.

**VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/components/fuel-issuance-components.test.tsx`

**SATISFIES**: AC1, AC3, AC4, AC11, AC12, AC15, AC16.

### Task 15 — ADD end-to-end role, lifecycle, ledger, and accessibility journeys

**Files**: fuel Playwright specs; accessibility spec; global setup and auth fixtures.

**IMPLEMENT**: PSMD standard draft/edit/post; full-tank actual requirement; stale selector handling; read-only viewer/auditor/budget officer; SUPER_ADMIN reasoned void; balance changes; immutable ledger display; denied controls and APIs; keyboard dialog flows; automated accessibility scans.

**PATTERN**: Follow `budget-allocations.spec.ts:51-242` for lifecycle setup, focused assertions, and stable selectors.

**GOTCHA**: Use unique fixture identifiers. Do not depend on suite order beyond the configured serial runner. Test at 375, 768, 1024, and 1440 widths plus 200 percent zoom.

**VALIDATE**: `pnpm exec playwright test --project=chromium tests/e2e/fuel-issuances.spec.ts tests/e2e/fuel-issuance-permissions.spec.ts tests/e2e/accessibility.spec.ts`

**SATISFIES**: AC1 through AC17.

### Task 16 — UPDATE shared migration, cleanup, fixture, and README assumptions

**Files**: shared integration helpers; migration suites; browser setup; README.

**IMPLEMENT**: Migration count seven; latest migration semantics; deletion order ledger → issuance → sequence → budget → master data → users; Docker migration documentation; fuel routes and permission behavior; development URLs.

**PATTERN**: Keep cleanup explicit because the shared MySQL integration suite runs serially against one database.

**GOTCHA**: Existing suites may identify 000006 as latest. Update assumptions without weakening earlier migration assertions or foreign-key checks.

**VALIDATE**: Run the full integration suite and `git diff --check`.

**SATISFIES**: AC10, AC17.

### Task 17 — RUN the complete quality gate

**Files**: No planned production changes. Fix only failures caused by this ticket and add regression tests with each correction.

**IMPLEMENT**: Formatting, lint, type checking, coverage, all MySQL integration tests, all Chromium and accessibility journeys, production build, audit-chain verification, Docker health, and final diff review.

**PATTERN**: Use the repository's `pnpm validate` as the authoritative gate.

**GOTCHA**: Testcontainers port-binding timeouts are infrastructure failures only after the unit and integration evidence is separated clearly. Do not label a failing browser suite green.

**VALIDATE**: Run every command in the Validation Commands section.

**SATISFIES**: AC17.

---

## TESTING STRATEGY

### Unit Tests

#### Domain

- Default destination is AOR.
- Full tank requires null requested liters.
- Standard requests require positive requested liters.
- Draft actual liters may be null or positive.
- Draft fields are editable only before posting.
- POSTED and VOIDED business facts are immutable.
- Only POSTED can void and VOIDED is terminal.
- Fuel type accepts only Diesel and Gasoline.
- Quantity and price reject excess scale, zero, negatives, exponent notation, and numeric input.
- Total examples exercise below-half, exactly-half, and above-half `ROUND_HALF_UP` behavior.
- RIS formatting covers 1, 9, 10, 999, 1000, month boundaries, and Manila entry dates.
- Issuance and compensation ledger factories use correct signs and references.

#### Application

- Permission policy separates create, read, post, and void.
- Current role assignments remain unchanged.
- Create and update never accept server-owned fields.
- Draft use cases validate current operational references.
- Posting uses stored unit price and provided actual liters.
- Posting locks in the documented order.
- Audit metadata is allowlisted and string-safe.
- Void normalizes and validates a 10–500 character reason.
- Balance queries validate inclusive period order and optional fuel type.

#### Route and library

- Unauthenticated requests return 401.
- Authenticated but unauthorized requests return 403 and denial audit evidence.
- Mutations reject missing or invalid CSRF tokens.
- Unknown keys and client-owned authoritative fields fail strict schemas.
- Invalid public identifiers and dates fail safely.
- List size is bounded and cursor tampering or filter mismatch is rejected.
- Business conflicts return stable safe responses without database detail leakage.
- No ledger PATCH or DELETE surface exists.

#### Components

- Labels, descriptions, errors, and IDs remain associated.
- Full-tank mode hides or disables requested liters without losing clear meaning.
- Entry-date changes cancel stale allocation requests and clear invalid selection.
- Decimal strings reach the request unchanged.
- Pending buttons disable repeat submission and expose progress.
- Post and void dialogs restore or move focus correctly.
- Results provide equivalent desktop and mobile content.
- Empty, filtered-empty, loading, error, denied, stale, conflict, and terminal states are explicit.

### Integration Tests

#### Migration and repositories

- All tables, columns, foreign keys, checks, unique constraints, and indexes match the plan.
- Down migration removes children before parents.
- DATE maps to `YYYY-MM-DD`; DATETIME maps to UTC Date; DECIMAL maps to string.
- Historical details resolve deactivated or soft-deleted driver, vehicle, office, and allocation references.
- Ledger repository contains no update or delete contract.

#### Sequence and concurrency

- Same-month posts receive unique contiguous numbers.
- Different months start at one.
- Entry date, not server posting date, chooses the sequence month.
- Sequence 1000 formats without failure.
- Competing first-of-month inserts do not duplicate rows.
- Competing posts of one draft produce one winner and one safe conflict.

#### Atomic posting

- Success writes issuance, one ISSUANCE ledger row, and one audit event.
- Audit failure rolls back sequence, issuance state, and ledger.
- Ledger failure rolls back sequence, issuance state, and audit.
- Invalid driver, vehicle, allocation, office, or fiscal period rolls back everything.
- Full-tank and standard posting both require actual liters.
- Negative balance does not reject an otherwise valid post.

#### Void and balance

- Only authorized users void.
- Only POSTED issuances void.
- One void appends one positive ADJUSTMENT and one audit event.
- Concurrent voids create only one compensation.
- Original issuance and ledger rows stay unchanged.
- Opening includes every signed entry before startDate.
- Inclusive start and end boundaries are correct.
- Receipts, adjustments, issuances, net movement, and closing reconcile.
- Diesel and Gasoline remain isolated, with two summaries when the filter is absent.

### End-to-End Tests

- PSMD creates, edits, reviews, and posts a standard issuance.
- RIS and authoritative total do not exist as editable fields.
- Full tank cannot post until actual liters are entered.
- Entry-date changes refresh eligible allocations.
- Inactive drivers and unserviceable vehicles do not appear.
- Posted detail shows one immutable issuance ledger entry.
- SUPER_ADMIN voids with a reason and sees the compensation.
- Balance totals change after post and reverse after void.
- Viewer, auditor, and budget officer can read but cannot mutate.
- SYSTEM_ADMIN and DISPATCH_OFFICER follow their existing fuel permission assignments.
- Keyboard-only creation, posting, voiding, filtering, and error recovery work.
- Automated accessibility checks pass in light and dark presentation where supported.

### Edge Cases

- Leap day and year-boundary entry dates.
- Manila month differs from UTC month near midnight.
- Quantity has three decimals and price has two.
- Product lands exactly on a half-cent.
- Requested liters and actual liters differ.
- Reference becomes invalid between draft display and posting.
- Allocation remains active but its office becomes inactive.
- Allocation quarter does not match entry date.
- Two posts initialize the same sequence month simultaneously.
- One post fails after reserving its number.
- A second tab posts or voids before the first tab confirms.
- Query range has no entries but still returns zeroed type summaries.
- Opening is negative and the period has no movement.
- Long RIS sequence exceeds three digits.

---

## VALIDATION COMMANDS

Run from `/Users/jsonse/Documents/development/fuel-and-dispatch`.

### Level 1: Syntax and style

```bash
pnpm format:check
pnpm lint
pnpm typecheck
git diff --check
```

### Level 2: Focused unit tests

```bash
pnpm exec vitest run --config vitest.config.ts tests/unit/domain/fuel
pnpm exec vitest run --config vitest.config.ts tests/unit/application/fuel
pnpm exec vitest run --config vitest.config.ts tests/unit/lib/fuel
pnpm exec vitest run --config vitest.config.ts tests/unit/app/api/fuel-issuances tests/unit/app/api/fuel-balances
pnpm exec vitest run --config vitest.config.ts tests/unit/components/fuel-issuance-components.test.tsx
```

### Level 3: Focused MySQL integration tests

```bash
pnpm exec vitest run --config vitest.integration.config.ts tests/integration/fuel
```

### Level 4: Focused browser tests

```bash
pnpm exec playwright test --project=chromium tests/e2e/fuel-issuances.spec.ts tests/e2e/fuel-issuance-permissions.spec.ts tests/e2e/accessibility.spec.ts
```

### Level 5: Full project gate

```bash
pnpm test:coverage
pnpm test:integration
pnpm exec playwright test --project=chromium
pnpm build
pnpm validate
```

### Level 6: Local Docker and audit verification

```bash
docker compose ps
curl -k --fail https://fvdms.lan/api/health
pnpm audit:verify:container
```

Confirm that the app container is healthy, the shared MySQL connection is reachable, migrations include 000007, and `fvdms.lan` resolves through the existing dnsmasq and Traefik setup.

---

## COMPLETION CHECKLIST

- [ ] FVD-006 is implemented from a branch containing FVD-005.
- [ ] Every accepted default is represented in domain, database, API, UI, and tests.
- [ ] Draft create and PATCH edit work only in DRAFT.
- [ ] RIS and authoritative total remain server-owned.
- [ ] Standard and full-tank posting require positive actual liters.
- [ ] Decimal calculation rounds once with `ROUND_HALF_UP`.
- [ ] Entry-date Manila month controls the RIS sequence.
- [ ] Sequence locking survives first-row and same-month concurrency.
- [ ] Posting rechecks and locks every operational reference.
- [ ] One post creates exactly one issuance ledger row and audit event.
- [ ] Every failure rolls back sequence, issuance, ledger, and audit effects.
- [ ] Void requires existing permission and a normalized reason.
- [ ] One void creates one compensation without changing original history.
- [ ] Ledger repositories and routes provide no edit or delete path.
- [ ] Inclusive balances reconcile both fuel types and expose negative totals.
- [ ] Current role assignments remain unchanged.
- [ ] Server Components call composition directly.
- [ ] Protected Route Handlers enforce authentication, permission, CSRF, validation, and safe errors.
- [ ] The page contract extends MASTER.md without conflicting visual choices.
- [ ] Responsive table/card content is equivalent.
- [ ] Keyboard, focus, live-region, dark-mode, reduced-motion, zoom, and viewport checks pass.
- [ ] Shared migration and cleanup assumptions include migration 000007.
- [ ] README documents the feature and local Docker verification.
- [ ] `pnpm validate` passes.
- [ ] `pnpm audit:verify:container` passes.
- [ ] `git diff --check` passes.

---

## OPEN QUESTIONS / ASSUMPTIONS

### Confirmed assumptions

- All six clarification defaults were accepted on 2026-08-28.
- Unit price remains a required draft-owned historical fact and becomes immutable at posting.
- The current permission seed is authoritative. `fuel.void` remains SUPER_ADMIN-only unless a later ticket changes role configuration.
- `fuel.export` is not used by this ticket because FVD-009 owns exports.
- Database status and fuel-type columns follow the repository's VARCHAR plus CHECK pattern instead of MySQL ENUM.
- Posted details resolve linked master-data labels historically. They do not snapshot every label onto the issuance row.
- Ledger `occurredAt` is the effective business instant derived from the civil entry date. `createdAt` remains the actual append time.
- No database trigger is needed. The acceptance criterion requires no ledger update/delete repository or API, and tests verify that boundary.

### Critical open questions

None. Implementation may proceed without another product interview.

---

## NOTES

### Posting data flow

```text
POST /api/fuel-issuances/:id/post
  -> authenticate + fuel.post + CSRF + strict body
  -> PostFuelIssuance
     -> one Kysely transaction
        -> lock DRAFT issuance
        -> lock/increment entry-date monthly sequence
        -> lock driver -> vehicle -> allocation -> office
        -> recheck operational and fiscal rules
        -> calculate ROUND_HALF_UP total
        -> mark POSTED with RIS
        -> append negative ISSUANCE ledger entry
        -> append durable audit event/outbox row
     -> commit all or roll back all
  -> safe DTO response
```

### Void data flow

```text
POST /api/fuel-issuances/:id/void
  -> authenticate + fuel.void + CSRF + strict reason
  -> VoidFuelIssuance
     -> one Kysely transaction
        -> lock POSTED issuance
        -> mark VOIDED with reason, actor, and timestamp
        -> append positive ADJUSTMENT compensation
        -> append durable audit event/outbox row
     -> commit all or roll back all
```

### Balance equation

```text
opening = sum(signed_quantity where effective_date < startDate)
receipts = sum(RECEIPT within inclusive range)
adjustments = sum(signed ADJUSTMENT within inclusive range)
issuances = sum(absolute ISSUANCE quantity within inclusive range)
netMovement = receipts + adjustments - issuances
closing = opening + netMovement
```

OPENING fixtures are positive ledger facts and already contribute through `signed_quantity`. They remain reported inside opening or the selected range according to their effective date.

### Schema state correction

The architecture sketch marks RIS, issued liters, and total as non-null. That cannot represent a valid full-tank draft. Migration 000007 must use nullable columns plus an enforced lifecycle check.

This is a clarification of the documented aggregate, not a new lifecycle. DRAFT, POSTED, and VOIDED remain the only states.

### UI layout contract

The new draft page uses a full page instead of a dialog because the form has dependent selectors and five business groups:

1. Transaction: entry date and purchase request.
2. Driver and vehicle: active selectors plus derived type and plate.
3. Travel: destination and purpose.
4. Fuel: fuel type, request mode, quantity, and unit price.
5. Allocation and review: effective selector, summary, and save action.

The detail page emphasizes status and RIS, then presents the same facts in definition lists. The action rail shows Edit for DRAFT, Post for authorized DRAFT, and Void for authorized POSTED records.

The balance page is read-only. It provides inclusive dates, optional fuel type, and separate summary cards or rows without inventing charts.

### Primary implementation risks

1. Sequence initialization and row locking can race on the first post of a month. Prove the upsert and lock with real concurrent transactions.
2. Draft nullability can drift between domain, Zod, MySQL, and DTOs. Encode the same lifecycle in each layer and test the database independently.
3. JavaScript number coercion can silently alter quantities or totals. Keep decimal values as strings through forms, routes, domain wrappers, repositories, and audit snapshots.
4. Posting may partially commit if any repository or audit adapter escapes the Kysely transaction. Build every adapter from the transaction handle and inject rollback failures.
5. Civil dates can select the wrong RIS month or fiscal quarter. Keep DATE strings and centralize Asia/Manila conversion.
6. Void retries can double-compensate. Combine an issuance lock, terminal transition, and unique linked-entry constraint.
7. Shared integration cleanup can fail after new foreign keys. Delete ledger and issuance rows before their parents in every helper.
8. Permission-aware rendering can hide a button without securing the route. Test both UI absence and direct endpoint denial.

### Confidence score

**9/10**. The ticket, PRD, architecture, prerequisite reports, code patterns, official references, and accepted defaults define a complete implementation path.

The remaining uncertainty is implementation-level MySQL contention behavior. The plan contains dedicated concurrency and rollback tests for that risk.

## AMENDMENTS

None at plan creation.
