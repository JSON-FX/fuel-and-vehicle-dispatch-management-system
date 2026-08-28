# Implementation Report — Record, Post, Balance, and Void Fuel Issuances Atomically

**Plan**: `.claude/plans/record-post-balance-void-fuel-issuances-atomically.md`

**Ticket**: `FVD-006`

**Branch**: `feature/record-post-balance-void-fuel-issuances-atomically`

**Status**: COMPLETE

## Summary

Delivered the complete fuel-issuance workflow from domain rules through the protected interface. Authorized PSMD staff can prepare and edit drafts, post one atomic monthly RIS, inspect immutable ledger evidence, and review inclusive Diesel or Gasoline balances.

SUPER_ADMIN users can void a posted issuance with a required reason. Voiding preserves the original record and negative issuance movement, then appends one equal positive adjustment inside the same transaction as the audit event.

The interface follows the saved FVDMS design system and the UI Ux Pro Max and UI Styling guidance. It uses server-rendered pages, focused client leaves, responsive tables and cards, accessible confirmation dialogs, semantic states, decimal strings, and live allocation refreshes with abort protection.

The protected shell now uses a permission-aware sidebar instead of the crowded top navigation. Frequent operations remain visible, Master data and Administration use collapsible groups, and smaller screens receive the same hierarchy in a focus-managed left drawer. Desktop users can collapse the sidebar into a 72-pixel icon rail without losing direct access to any permitted destination.

## Tasks completed

- Added fuel value objects, issuance and ledger entities, lifecycle invariants, decimal arithmetic, and audit-safe snapshots under `src/domain/fuel` and `src/domain/shared`.
- Added fuel DTOs, ports, permission policy, support services, and create, update, list, detail, post, void, balance, and preparation-option use cases under `src/application/fuel`.
- Added migration 000007 with monthly sequences, fuel issuances, append-only ledger entries, lifecycle checks, foreign keys, and query indexes.
- Added Kysely issuance, sequence, ledger, cursor, transaction, repository composition, and root composition adapters.
- Enforced the lock order issuance, sequence, driver, vehicle, allocation, and office. The initial issuance lock targets only its table row before reference enrichment.
- Added strict authenticated Route Handlers for collection, detail, posting, voiding, balances, and fuel-scoped preparation options.
- Added permission-filtered Fuel navigation plus list, new, detail, balance, loading, error, denied, empty, and terminal states.
- Replaced the protected top navigation with an adaptive grouped sidebar, active-route context,
  a mobile drawer, and separated account controls.
- Added the full-screen sidebar toggle beside the FVDMS title, a compact icon rail, accessible
  icon labels and tooltips, group separators, and a layout transition that respects reduced
  motion.
- Added draft, filter, responsive results, lifecycle status, post, void, detail, immutable ledger, and balance components.
- Added entry-date allocation refresh with request cancellation, stale-selection clearing, loading announcements, and error recovery.
- Added the page contract at `design-system/fuel-and-vehicle-dispatch-management-system/pages/fuel-issuance-management.md`.
- Updated the README with routes, permissions, transaction behavior, ledger semantics, Docker migration steps, and validation commands.
- Updated shared migration and integration cleanup assumptions for the seventh migration and new foreign-key dependencies.

## Tests added

- Domain tests cover draft rules, full-tank behavior, decimal precision, posting immutability, one-time voiding, RIS formatting, and signed ledger entries.
- Application tests cover permissions, reference eligibility, list and detail mapping, preparation options, validation, fixed lock order, posting, void compensation, balances, and audit capture.
- Route tests cover authentication, exact authorization, Cross-Site Request Forgery protection, strict schemas, server-owned fields, preparation refresh, posting, voiding, and balances.
- MySQL tests cover migration up and down, repositories, cursors, atomic rollback, monthly sequence contention, same-draft races, reference revalidation, posting, voiding, and balance reconciliation.
- Browser tests cover standard create, edit, and post; live selector refresh; full-tank posting requirements; reasoned voiding; immutable movements; balances; exact role permissions; dialog keyboard behavior; focus recovery; accessibility; themes; reduced motion; zoom; and responsive widths.
- Navigation tests cover permission filtering, grouped destinations, nested active routes,
  expanded and compact desktop states, exact rail width, mobile dismissal, focus return, drawer
  navigation, accessibility, and viewport overflow.

## Validation results

- `pnpm validate` — PASS from the final implementation tree.
- Formatting, ESLint, and TypeScript — PASS.
- Combined coverage — PASS, 678 checks across 142 files.
- Coverage — 89.19 percent statements, 80.50 percent branches, 94.33 percent functions, and 91.73 percent lines.
- MySQL integration — PASS, 109 checks across 27 files.
- Chromium and axe — PASS, 45 journeys.
- Next.js production build — PASS with all fuel pages and APIs server-rendered as required.
- `git diff --check` — PASS.
- Docker application — healthy at `https://fvdms.lan`; protected fuel pages redirect unauthenticated users to sign-in.
- Docker audit worker — running.
- Database status — migrations 000001 through 000007 applied.
- `pnpm audit:verify:container` — PASS after checking 21 records through sequence 21.

## Deviations from the plan

- Added `GET /api/fuel-preparation-options` as a fuel-scoped selector endpoint. This keeps entry-date refresh authorization tied to `fuel.create` instead of requiring an unrelated budget permission.
- Draft database columns for RIS, actual liters, total, and posting metadata remain nullable. This implements the accepted lifecycle correction documented by the plan instead of the inconsistent architecture sketch.
- Draft edits return to the canonical detail route after a successful save. Remaining on `?edit=1` hid the posting action and weakened the review-before-post workflow.
- Error summaries in post and void dialogs receive focus after server failures. This implements the plan's keyboard recovery requirement without changing the shared form-status component.
- A user-approved pre-commit refinement replaced the growing top navigation with the grouped
  adaptive sidebar documented in the master design system.

## Issues encountered

- Initial branch coverage was below the 80 percent threshold. Focused query, form-response, use-case, and route tests raised branch coverage without weakening the gate.
- Migration 000007 changed latest-migration and rollback-depth assumptions in older suites. Those assertions now preserve every earlier migration check while accounting for the fuel schema.
- Shared MySQL fixtures initially deleted users before fuel rows. Every affected cleanup now follows ledger, issuance, sequence, budget, master-data, then user dependency order.
- A draft edit refreshed the edit route instead of returning to detail. The browser lifecycle exposed the missing posting control, and the form now replaces the URL with the detail route.
- A joined `FOR UPDATE` query could lock reference rows before the documented order. The repository now locks only the issuance row before the sequence and explicit reference locks.
- The host runs Node.js 26 and reports an engine warning. Docker and the project contract use Node.js 24.

## Deferred production work

- Offline draft persistence and replay remain assigned to FVD-010.
- Fuel receipts, stocktaking adjustments, import, export, and richer inventory controls remain outside FVD-006.
- Production infrastructure, backups, retention, and disaster recovery remain assigned to later deployment tickets.

## Skipped items

- The complete mutation lifecycle was not repeated with retained credentials against the persistent `fvdms.lan` database. Equivalent authenticated lifecycle, permission, concurrency, audit, accessibility, and responsive coverage passed through the disposable real-stack Playwright environment.
