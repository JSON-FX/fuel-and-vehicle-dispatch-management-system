# Implementation Report — Establish Durable Immutable Audit Capture and Verification

**Plan**: `.claude/plans/establish-durable-immutable-audit-capture-verification.md`

**Ticket**: `FVD-003`

**Branch**: `feature/establish-durable-immutable-audit-capture-verification`

**Status**: COMPLETE

## Summary

Delivered a shared audit event contract that commits business changes and canonical audit evidence in one MySQL transaction. Authentication and authorization producers now use event-specific allowlists instead of the temporary security-event bridge.

Added one deterministic RFC 8785 and SHA-256 chain, an append-only secondary sink adapter, dedicated runtime credentials, a long-running worker, and a bounded independent verifier. Verification captures a primary high-water mark and detects missing, extra, changed, reordered, duplicate, mismatched, broken-link, wrong-hash, and wrong-head evidence.

Built authorized server-rendered audit search and detail pages with protected APIs, opaque cursor pagination, sensitive-context redaction, and durable access evidence. UI Ux Pro Max and UI Styling guidance shaped the restrained government interface, responsive table and card views, semantic states, typography, keyboard behavior, and accessibility checks.

Extended the Docker environment on the existing `dev-net`. Traefik serves the application at `https://fvdms.lan`, while a non-routed worker continuously finalizes and delivers evidence.

## Tasks completed

- Added the audit event domain, canonical JSON rules, size limits, and deterministic hash framing.
- Replaced `SecurityEventPort` with the shared transaction-scoped `AuditEventPort`.
- Migrated legacy authentication evidence with preserved public identifiers and reversible schema changes.
- Created primary outbox, chain, head, delivery, verification, and secondary sink tables.
- Added separate application, worker, sink-writer, verifier, migrator, and administrator credential boundaries.
- Implemented global chain locking, bounded batches, poison-event halting, restart recovery, and sink retry behavior.
- Implemented captured-head verification with precise mismatch categories and persistent results.
- Added audited authorization denials and event-specific authentication snapshot builders.
- Added protected audit search, detail, and latest-verification APIs with existing response envelopes.
- Added responsive audit pages, structured GET filters, cursor navigation, redacted details, and explicit states.
- Added worker and verifier commands, Docker services, CI coverage, and operating documentation.
- Made `dev:up` repair named-volume ownership and reapply grants after migrations create audit tables.

## Tests added

- Combined coverage runs 394 checks across 86 files.
- MySQL integration runs 60 checks across 13 files with actual restricted database accounts.
- Fifteen Chromium journeys cover authentication, administration, audit search, filters, cursor navigation, details, redaction, access denial, access evidence, themes, reduced motion, keyboard use, responsive layouts, and axe rules.
- Coverage passes at 88.94 percent statements, 80.58 percent branches, 94.08 percent functions, and 90.90 percent lines.
- Audit integration covers rollback, migration backfill, append-only privileges, concurrent workers, worker recovery, sink outage recovery, exact retries, and every planned tamper category.

## Validation results

- `pnpm validate` — PASS from the final tree.
- Formatting, ESLint, and TypeScript — PASS.
- Combined coverage — PASS, 394 checks.
- MySQL integration — PASS, 60 checks.
- Chromium and axe — PASS, 15 journeys.
- Next.js production build — PASS with all audit routes server-rendered as required.
- `docker compose config --quiet` — PASS.
- `pnpm dev:up` — PASS with shared MySQL, Traefik, `dev-net`, a healthy application, and the audit worker.
- `curl https://fvdms.lan/api/health` — PASS with database status `available`.
- `pnpm audit:verify:container` — PASS after checking seven records through sequence seven.
- Live worker logs — PASS with seven finalized records, seven sink deliveries, and no retries or unsafe output.
- The applied FVD-002 migration has no diff.

## Deviations from the plan

- The sink-writer receives `SELECT` and `INSERT` on the sink table instead of only `INSERT`. Exact lost-acknowledgement recovery must read the existing fingerprint before treating a duplicate as successful. The account still cannot update or delete evidence and cannot read the primary audit schema.
- Verification records and compares each source position in addition to sequence and event identity. This closes a reordered-source case that could otherwise preserve a valid sequence-shaped chain.
- Native GET form values preprocess empty strings as absent filters. Browser form submission sends blank controls, while the API contract still rejects malformed non-empty values.
- Local startup runs bootstrap again after migration. A fresh database cannot receive table-specific runtime grants until the audit migration creates those tables.

## Issues encountered

- Integration files left their final chain head for later test files. A shared audit cleanup helper now restores the genesis state after each audit integration file.
- The pnpm store volume was created as root while all development services run as `node`. `dev:up` now initializes that volume ownership before any container-side pnpm operation.
- Optional native bindings for `cpu-features` and `ssh2` cannot compile in the minimal Alpine image. They remain optional, pnpm succeeds, and the required Argon2 binding installs and passes its tests.
- The host runs Node.js 26 and reports an engine warning. Docker and CI use the supported Node.js 24.19.0 runtime.

## Deferred production work

- FVD-011 must place the sink on an independent host and add production credentials, certificates, backups, disaster recovery, and secret rotation.
- FVD-012 must define retention, privacy, archival, legal hold, and final assurance controls.

## Skipped items

- None.
