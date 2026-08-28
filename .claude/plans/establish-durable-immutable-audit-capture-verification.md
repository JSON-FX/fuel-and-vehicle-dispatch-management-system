# Feature: Establish durable immutable audit capture and verification

The following plan is implementation-ready. Recheck the current branch, installed Next.js documentation, package compatibility, and FVD-002 merge state before changing code.

Pay special attention to transaction boundaries, exact canonical bytes, database privileges, global chain ordering, poison-event handling, and audited access to the audit trail.

## Feature Description

FVD-003 adds the mandatory audit subsystem before operational modules. It replaces the temporary authentication security-event store with a shared audit event contract. Business use cases append immutable events to a primary outbox inside their existing MySQL transaction.

A long-running Node.js worker converts locally durable outbox events into one globally ordered SHA-256 chain. It then copies exact chain records to an append-only secondary sink through dedicated credentials. A separate verification command compares the captured high-water mark across primary and sink records. It detects missing, changed, reordered, duplicate, and mismatched records.

Authorized auditors receive a read-only `/api/audit-events` API and `/audit` page. Search and detail access are themselves appended as `audit.accessed` events. The page follows the persisted FVDMS design system and exposes the latest completed verification status without browser controls that can run verification.

## User Story

As an authorized government auditor,
I want a searchable and independently verifiable history of security and business actions,
so that accountability evidence remains durable, ordered, and resistant to undetected alteration.

## Problem Statement

FVD-002 records authentication evidence in `auth_security_events`. That table proves the application can append evidence within authentication transactions. It does not provide the shared event model, immutable chain, separate sink, verification process, least-privilege database roles, or auditor interface required by the architecture.

Later operational tickets need one stable port that every business transaction can use. If audit capture is delayed until after a business commit, the request can succeed without evidence. If chaining happens in the request, worker or sink outages can block operations and increase lock duration.

The design must separate synchronous durability from asynchronous integrity processing. It must also avoid relying on MySQL JSON serialization because the exact bytes being hashed must remain stable.

## Solution Statement

Create `AuditEventPort` in the application layer. Its typed event contract carries a UUIDv7 public ID, schema version, UTC time, actor, action, entity reference, request ID, network context, and event-specific audit-safe snapshots. Replace `SecurityEventPort` in authentication transactions with this shared port. Backfill existing `auth_security_events` into the new outbox while preserving public IDs, then remove the temporary table in the new reversible migration.

Use two new schemas on the existing MySQL host: `fvdms_audit` for primary capture and chain state, and `fvdms_audit_sink` for the local secondary adapter. The runtime application account receives only `INSERT` on the primary outbox and read access needed by auditor queries. It receives no `UPDATE` or `DELETE` audit privilege. Worker, sink-writer, verifier, and migration accounts receive separate minimal grants.

Canonicalize versioned event payloads at the capture boundary with RFC 8785 using `canonicalize@4.0.0`. Store the exact canonical UTF-8 text in the outbox and final chain as `LONGTEXT`. The worker validates and hashes those stored bytes. Its domain-separated binary preimage contains the chain format version, unsigned sequence, previous 32-byte hash, canonical byte length, and canonical bytes. Store hashes as `BINARY(32)` and use 32 zero bytes for genesis.

Serialize global chain advancement through one `audit_chain_heads` row locked with `SELECT ... FOR UPDATE`. The worker processes a bounded deterministic batch. It never skips an invalid or corrupt event. Sink delivery is independently retryable and cannot make a business request fail. Verification captures a primary high-water mark first, then checks every position through that mark against the primary chain and sink.

## Out of Scope / Non-Goals

- Not included: audit retention, legal-hold workflows, archival media, or purge automation. FVD-012 owns privacy, retention, archival, and final assurance.
- Not included: production secondary-host provisioning, certificates, backup, disaster recovery, or secret rotation. FVD-011 owns production deployment hardening.
- Not included: signing hashes with a hardware-backed key, Merkle trees, blockchain, third-party notarization, or an external Security Information and Event Management service.
- Not included: live streaming, dashboards, anomaly detection, alerts, exports, reports, or arbitrary full-payload text search.
- Not included: a browser button to run verification, repair a chain, skip a poison event, replay an event, or mutate audit data.
- Not included: operational-domain audit producers beyond the authentication and authorization events already present in FVD-002. Later tickets use the shared port.
- Not changing: opaque MySQL sessions, existing API envelopes, request IDs, public UUIDv7 identifiers, `BIGINT` string handling, shared local MySQL, Traefik, dnsmasq, `dev-net`, or `https://fvdms.lan`.
- Not using: MySQL JSON reserialization as hash input, offset pagination for audit history, `SKIP LOCKED` to order the global chain, in-memory queues, or an application account with schema-wide audit writes.
- Local limitation: both audit schemas use the shared development MySQL host. This proves credentials and adapter boundaries, but it is not an independent failure domain.

## Feature Metadata

**Feature Type**: New security and compliance capability

**Estimated Complexity**: High

**Primary Systems Affected**: Audit domain and application services, authentication transaction ports, Kysely/MySQL schemas, database bootstrap, worker and verification commands, composition, authorization handling, Next.js Route Handlers, protected navigation, audit UI, Docker Compose, Vitest, Testcontainers, Playwright, and developer documentation

**Dependencies**: FVD-001; FVD-002; `canonicalize@4.0.0`; Node.js 24 built-in `crypto`; existing Kysely 0.29.5, mysql2 3.24.2, Zod, Pino, UUID, Next.js 16.3.3, Tailwind CSS, shadcn/ui, Lucide, Testcontainers, Vitest, Playwright, and axe dependencies

## Confirmed Ticket-Level Decisions

The user accepted all recommended defaults on 2026-08-28.

- Use `fvdms_audit` and `fvdms_audit_sink` on the existing local shared MySQL host.
- Give the application, worker, sink writer, verifier, and migrator separate least-privilege credentials.
- Keep the sink behind an interface. Production may point that adapter at another MySQL host without changing application contracts.
- Run a long-lived Node worker container with bounded MySQL polling.
- Serialize one global chain through a locked chain-head row.
- Retry sink outages independently. Never fail an acknowledged business request because the sink is unavailable.
- Halt at the first invalid or corrupt outbox event. Never skip it automatically.
- Replace `SecurityEventPort` with a shared `AuditEventPort`.
- Backfill `auth_security_events`, preserve every event public ID, and remove the temporary table.
- Use RFC 8785 canonical JSON, one global chain, binary SHA-256 hashes, and an all-zero genesis hash.
- Verify a captured high-water mark so concurrent new events do not produce false mismatches.
- Expose `/api/audit-events`, `/api/audit-events/:eventId`, `/api/audit-verification/latest`, `/audit`, and `/audit/:eventId`.
- Use structured filters and opaque cursor pagination with a maximum page size of 100.
- Append `audit.accessed` for each successful search and detail read. The read result and access event share one transaction.
- Show only the latest completed verification result in the UI. Do not expose a run control.
- Use event-specific snapshot allowlists. Never serialize request bodies, persistence rows, credentials, tokens, or complete data-transfer objects.
- Show sensitive network and metadata context only on the permission-controlled detail view.

## Related Work

**Implements**: FVD-003 in `docs/tickets/fuel-and-vehicle-dispatch-system.md:90`

**Epic**: `docs/PRD.md`

**Inherited architecture**: `docs/System_Architecture.md`

**Back-references**

- `.claude/plans/bootstrap-secure-application-foundation.md` establishes the Clean Architecture seams, Kysely conventions, safe API envelope, Docker topology, and UI governance.
- `.claude/plans/deliver-authentication-sessions-rbac.md:1155` defines the temporary audit bridge that this ticket replaces.
- `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md` remains mandatory for the audit page.

**Forward-references**

- FVD-004 through FVD-010 will append operational events through `AuditEventPort` within their business transactions.
- FVD-011 will provision a genuinely separate sink host, rotate production credentials, and add deployment controls.
- FVD-012 will define retention, privacy, archival, legal hold, and final assurance.

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING

#### Requirements and binding architecture

- `docs/tickets/fuel-and-vehicle-dispatch-system.md:90` defines FVD-003 scope, acceptance criteria, seams, size, and dependencies.
- `docs/PRD.md:129` defines the auditor persona and accountability need.
- `docs/PRD.md:399` defines FR-AUDIT-001 and the required audit trail.
- `docs/PRD.md:565` defines NFR-002 auditability expectations.
- `docs/PRD.md:609` defines NFR-013 object-level authorization.
- `docs/PRD.md:618` defines NFR-016 privacy controls for IP addresses and audit snapshots.
- `docs/PRD.md:823` defines audit-event content and handling rules.
- `docs/PRD.md:983` lists non-negotiable engineering and security constraints.
- `docs/System_Architecture.md:56` limits HTTP controllers to boundary concerns.
- `docs/System_Architecture.md:69` defines target domain, application, infrastructure, API, page, and worker locations.
- `docs/System_Architecture.md:555` defines mandatory audit fields, event families, and controls.
- `docs/System_Architecture.md:622` requires failed authorization and authentication evidence.
- `docs/System_Architecture.md:839` defines atomic business and audit transaction boundaries.
- `docs/System_Architecture.md:948` defines error and structured logging controls.
- `docs/System_Architecture.md:986` defines security controls around audit access and credentials.
- `docs/System_Architecture.md:1037` defines unit, integration, end-to-end, and security test responsibilities.
- `docs/System_Architecture.md:1124` defines deployment, worker, and sink expectations.
- `docs/System_Architecture.md:1210` locks the stack and Clean Architecture style.
- `docs/System_Architecture.md:1238` defines SEC-01 as a release-blocking audit-integrity finding.

#### Existing audit bridge and transaction seams

- `src/application/auth/ports/security-event-port.ts:1` is the narrow temporary event contract to replace.
- `src/application/auth/ports/auth-transaction.ts:11` places the current event port inside the authentication transaction.
- `src/infrastructure/database/auth/kysely-security-event-store.ts:11` appends authentication events through the transaction-scoped Kysely handle.
- `src/infrastructure/database/auth/kysely-auth-transaction.ts:8` uses Kysely callback transactions and automatic rollback.
- `src/infrastructure/database/auth/create-kysely-auth-repositories.ts:16` constructs repositories from the same database or transaction handle.
- `src/infrastructure/database/migrations/20260828_000002_create_authentication_and_rbac.ts:256` creates the temporary `auth_security_events` table that must be backfilled and removed only in the new migration.
- `src/infrastructure/database/types.ts:136` contains the temporary security-event persistence type.
- `src/application/auth/use-cases/login.ts:185` shows failed and successful login evidence paths.
- `src/application/auth/services/authorize-permission.ts:5` currently throws a denial without durable evidence.
- `src/lib/auth/authenticated-request.ts:26` is the request-context seam for auditing authorization failures.
- `tests/integration/auth/security-controls.test.ts:118` proves current business and event rollback behavior.
- `tests/integration/auth/auth-repositories.test.ts:1` shows authentication repository integration patterns.

#### Database, composition, HTTP, Docker, and UI patterns

- `src/infrastructure/database/bootstrap.ts:9` creates schemas, users, and grants. Extend its pure statement builder and tests.
- `scripts/database/bootstrap.ts:6` executes bootstrap statements through the administrator connection.
- `src/infrastructure/config/environment.ts:8` validates identifiers and typed credentials.
- `src/infrastructure/database/client.ts:14` configures UTC, lossless `BIGINT`, connection pools, and Kysely.
- `src/infrastructure/database/migrator.ts:10` discovers ordered migrations. Add one new migration rather than editing an applied one.
- `tests/integration/helpers/mysql-container.ts:9` starts isolated MySQL 8.4.11 and must support multiple schemas and restricted accounts.
- `tests/integration/database/migrations.test.ts:98` currently expects two migrations and must be updated for the third.
- `src/infrastructure/composition/root.ts:52` exposes the application composition. Move audit assembly into a focused composition module.
- `src/lib/http/with-response-handler.ts:24` preserves no-store, request IDs, envelopes, and safe errors.
- `src/app/api/users/route.ts:12` shows Zod query parsing, authentication, permission checks, and application delegation.
- `src/app/(protected)/admin/users/page.tsx:19` shows Server Component reads, responsive table/card views, and pagination.
- `src/app/(protected)/layout.tsx:8` owns protected navigation and must add the permission-aware audit link.
- `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md:15` requires restrained, data-dense government software and Server Components by default.
- `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md:114` requires visible labels, local shadcn primitives, focus handling, and explicit states.
- `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md:136` defines required viewport, zoom, keyboard, reduced-motion, and contrast checks.
- `src/app/globals.css:5` contains semantic theme tokens. Do not add raw page colors.
- `src/components/ui/table.tsx:1`, `src/components/ui/badge.tsx:1`, and `src/components/ui/card.tsx:1` are the local data-display primitives.
- `compose.yaml:3` defines the existing app on external `dev-net` behind Traefik at `fvdms.lan`.
- `scripts/dev/up.sh:7` starts shared Traefik/MySQL, bootstraps, migrates, and then starts the app.
- `package.json:1` contains Node, package, worker-script, and validation configuration.
- `vitest.integration.config.ts:11` requires serial isolated MySQL integration tests.
- `tests/e2e/global-setup.ts:1` provisions an isolated browser-test environment.
- `.github/workflows/ci.yml:15` runs the existing validation gate.

### Mandatory Skill and Framework Reading Before Implementation

- `/Users/jsonse/.agents/skills/ui-ux-pro-max/SKILL.md` governs the audit-page design search and page-specific design recommendation.
- `/Users/jsonse/.agents/skills/ui-styling/SKILL.md` governs accessible local shadcn/ui and Tailwind implementation.
- `/Users/jsonse/.agents/skills/ui-styling/references/shadcn-components.md` defines table, badge, input, alert, and feedback composition.
- `/Users/jsonse/.agents/skills/ui-styling/references/shadcn-accessibility.md` defines labels, descriptions, live regions, focus, keyboard behavior, and status semantics.
- `/Users/jsonse/.agents/skills/ui-styling/references/tailwind-responsive.md` defines mobile-first behavior and viewport validation.
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md:51` confirms `GET` Route Handlers are not cached by default.
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md:12` defines Server Component defaults and narrow client boundaries.
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md:1121` defines Route Handler authorization and warns against client-only checks.

### New Files to Create

The implementation agent may split a file only when a smaller unit materially improves boundaries. Keep framework-free rules in domain/application modules and database details in infrastructure.

#### Audit domain and application contracts

- `src/domain/audit/entities/audit-event.ts` - Validates immutable event identity, action, entity reference, occurrence time, and schema version.
- `src/domain/audit/value-objects/audit-json-value.ts` - Defines the accepted recursive JSON value set and rejects ambiguous numeric or unsupported values.
- `src/domain/audit/value-objects/audit-action.ts` - Normalizes stable dotted action names such as `auth.login.failed` and `audit.accessed`.
- `src/domain/audit/entities/audit-chain-record.ts` - Represents a sequence, previous hash, record hash, canonical payload, and source event.
- Matching `tests/unit/domain/audit/**` files.
- `src/application/audit/dto/audit-event-dtos.ts` - Capture, search, detail, cursor-page, and verification-status data-transfer objects.
- `src/application/audit/ports/audit-event-port.ts` - Shared append contract used inside business transactions.
- `src/application/audit/ports/audit-read-transaction.ts` - Transaction boundary that combines a read repository with `AuditEventPort` for `audit.accessed`.
- `src/application/audit/ports/audit-query-repository.ts` - Read-only cursor search, detail, and latest-verification queries.
- `src/application/audit/ports/audit-chain-repository.ts` - Outbox, chain-head lock, append, and delivery-state operations for the worker.
- `src/application/audit/ports/audit-sink.ts` - Append-only sink contract with exact-retry semantics.
- `src/application/audit/ports/audit-verification-repository.ts` - High-water mark, primary/sink scan, and completed-run persistence.
- `src/application/audit/ports/audit-canonicalizer.ts` - Canonical UTF-8 generation behind a focused application port.
- `src/application/audit/ports/audit-hasher.ts` - SHA-256 preimage and hash contract.
- `src/application/audit/use-cases/search-audit-events.ts` - Permission-independent read workflow that atomically appends `audit.accessed`.
- `src/application/audit/use-cases/get-audit-event.ts` - Detail lookup that atomically appends `audit.accessed`.
- `src/application/audit/use-cases/get-latest-audit-verification.ts` - Read-only completed verification summary.
- `src/application/audit/services/audit-chain-worker.ts` - Bounded chain-finalization loop with poison-event halt behavior.
- `src/application/audit/services/audit-sink-delivery-worker.ts` - Independent bounded sink delivery and retry loop.
- `src/application/audit/services/verify-audit-chain.ts` - High-water-mark verification and mismatch classification.
- Matching `tests/unit/application/audit/**` files with fake repositories, fake clock, and fixed vectors.

#### Audit infrastructure and operations

- `src/infrastructure/audit/rfc8785-audit-canonicalizer.ts` - Wraps `canonicalize` and enforces the accepted JSON subset.
- `src/infrastructure/audit/node-sha256-audit-hasher.ts` - Builds the versioned binary preimage and returns 32-byte hashes.
- `src/infrastructure/database/audit/types.ts` - Persistence-only primary and sink table types.
- `src/infrastructure/database/audit/kysely-audit-outbox-store.ts` - Transaction-scoped primary outbox adapter implementing `AuditEventPort`.
- `src/infrastructure/database/audit/kysely-audit-query-repository.ts` - Structured, cursor-based read adapter.
- `src/infrastructure/database/audit/kysely-audit-read-transaction.ts` - Runs the audit query and `audit.accessed` append on one primary connection transaction.
- `src/infrastructure/database/audit/kysely-audit-chain-repository.ts` - Locks the head, loads deterministic outbox batches, appends final records, and maintains operational delivery state.
- `src/infrastructure/database/audit/kysely-audit-sink.ts` - Insert-only secondary adapter with deterministic retry fingerprints.
- `src/infrastructure/database/audit/kysely-audit-verification-repository.ts` - Streams bounded primary and sink pages and records final results.
- `src/infrastructure/database/audit/client.ts` - Dedicated worker, sink-writer, and verifier Kysely connection factories.
- `src/infrastructure/database/migrations/20260828_000003_create_durable_audit_subsystem.ts` - Creates qualified audit tables, seeds the chain head, backfills auth events, and drops the temporary table.
- `src/infrastructure/composition/audit.ts` - Focused factories for web reads, worker services, and verification.
- `scripts/audit/worker.ts` and `scripts/audit/worker.sh` - Long-running finalization and delivery process with signal-aware shutdown.
- `scripts/audit/verify.ts` and `scripts/audit/verify.sh` - One-shot verifier command with nonzero exit for integrity failure or incomplete verification.

#### HTTP, page, and browser coverage

- `src/app/api/audit-events/route.ts` - Authorized structured cursor search.
- `src/app/api/audit-events/[eventId]/route.ts` - Authorized detail read by public ID.
- `src/app/api/audit-verification/latest/route.ts` - Authorized latest completed result.
- `src/app/(protected)/audit/page.tsx` - Server-rendered search result page.
- `src/app/(protected)/audit/[eventId]/page.tsx` - Server-rendered event detail and context page.
- `src/components/audit/audit-filter-form.tsx` - GET filter form with visible labels and progressive enhancement.
- `src/components/audit/audit-event-table.tsx` - Desktop table and mobile-card representations.
- `src/components/audit/audit-verification-status.tsx` - Text-and-icon status summary without execution controls.
- `design-system/fuel-and-vehicle-dispatch-management-system/pages/audit-trail.md` - Page-specific design decisions that inherit the master system.
- `tests/e2e/audit-trail.spec.ts` - Authorized search/detail, denied access, responsive layout, keyboard, and audit-access evidence.

#### Integration coverage

- `tests/integration/audit/audit-outbox.test.ts` - Atomic append, rollback, input limits, public-ID preservation, and no pre-acknowledgment gap.
- `tests/integration/audit/audit-privileges.test.ts` - Real restricted-account grants and forbidden update/delete behavior.
- `tests/integration/audit/audit-chain-worker.test.ts` - Ordering, chain head lock, multiple workers, deterministic hashes, poison records, and recovery.
- `tests/integration/audit/audit-sink.test.ts` - Insert-only delivery, exact retries, outage recovery, duplicates, and mismatches.
- `tests/integration/audit/audit-verification.test.ts` - Missing, changed, reordered, duplicate, hash, payload, and high-water-mark cases.
- `tests/integration/audit/audit-queries.test.ts` - Structured filters, cursors, redaction, and atomic `audit.accessed` events.
- `tests/integration/helpers/audit-test-database.ts` - Creates the primary/sink schemas and opens actual app, worker, sink, verifier, and migration connections.

### Existing Files to Update

- `package.json` - Pin `canonicalize`, add worker/verifier scripts, and include audit tests in validation.
- `pnpm-lock.yaml` - Record the exact canonicalizer dependency graph.
- `.env.example` - Document schema names, dedicated users, passwords, batch sizes, poll intervals, and payload limits.
- `compose.yaml` - Add dedicated audit credentials and a non-routed `audit-worker` service on `dev-net`.
- `README.md` - Document capture guarantees, local topology, worker state, verifier use, troubleshooting, and production limitations.
- `scripts/dev/up.sh` - Bootstrap and migrate all schemas before starting both the app and worker.
- `scripts/dev/logs.sh` and `scripts/dev/down.sh` - Include the worker without affecting shared infrastructure.
- `src/infrastructure/config/environment.ts` - Add typed primary/sink schema names, credentials, batch sizes, poll intervals, retry bounds, and maximum canonical payload bytes.
- `src/infrastructure/database/bootstrap.ts` - Create both schemas and dedicated accounts with exact grants.
- `src/infrastructure/database/types.ts` - Remove `auth_security_events` after backfill and import or compose audit persistence types without leaking them inward.
- `src/infrastructure/database/migrator.ts` - Keep one ordered migration history while allowing qualified audit-schema objects.
- `src/infrastructure/database/client.ts` - Expose safe shared connection construction without duplicating UTC and `BIGINT` configuration.
- `src/application/auth/ports/auth-transaction.ts` - Replace `securityEvents` with `auditEvents: AuditEventPort`.
- `src/application/auth/use-cases/**` and `src/application/auth/services/**` event producers - Map authentication evidence into the new contract and event-specific snapshot builders.
- `src/application/auth/services/authorize-permission.ts` - Preserve the pure policy decision or split it from an audited request-context denial workflow.
- `src/infrastructure/database/auth/create-kysely-auth-repositories.ts` - Construct the qualified audit outbox adapter from the same transaction handle.
- `src/infrastructure/database/auth/kysely-auth-transaction.ts` - Preserve one connection transaction across main and primary audit schemas.
- `src/infrastructure/database/auth/kysely-security-event-store.ts` - Remove after all callers and backfill are complete.
- `src/infrastructure/composition/root.ts` - Compose web audit use cases through the focused audit factory.
- `src/lib/auth/authenticated-request.ts` - Append failed authorization with actor, permission, request, route, source address, and user agent context.
- `src/app/(protected)/layout.tsx` - Add an `audit.read` navigation item only for permitted principals.
- `tests/unit/application/auth/**`, `tests/unit/lib/auth/authenticated-request.test.ts`, and `tests/unit/infrastructure/composition/root.test.ts` - Update contract and denial evidence expectations.
- `tests/integration/database/auth-migrations.test.ts` and `tests/integration/database/migrations.test.ts` - Assert backfill, removal, rollback, reapply, and the third migration.
- `tests/integration/auth/security-controls.test.ts` - Keep authentication and evidence rollback coverage against the new outbox.
- `tests/integration/helpers/mysql-container.ts` and `tests/integration/helpers/test-database.ts` - Support administrator bootstrap and multiple schemas without weakening isolated test ownership.
- `tests/e2e/global-setup.ts` and `tests/e2e/fixtures/auth.ts` - Seed an auditor and run the worker during browser tests.
- `.github/workflows/ci.yml` - Run audit integration, worker, verifier, and browser checks without shared local services.

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING

Research was refreshed on 2026-08-28. Prefer primary sources and the installed framework documentation.

- [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.html)
  - Specific sections: input data constraints, deterministic property sorting, serialization, and Appendix G.
  - Why: Defines the canonical JSON rules and lists the JavaScript `canonicalize` implementation.
- [RFC 8785 errata](https://www.rfc-editor.org/errata/rfc8785)
  - Specific item: negative-zero rejection for input consistency.
  - Why: The capture boundary must reject `-0` instead of silently producing an ambiguous payload.
- [`canonicalize` official repository](https://github.com/erdtman/canonicalize)
  - Specific sections: API, TypeScript support, and test vectors.
  - Why: Pin the RFC 8785 implementation and add project-specific boundary validation around it.
- [Node.js 24 crypto API](https://nodejs.org/download/release/v24.16.0/docs/api/crypto.html#cryptocreatehashalgorithm-options)
  - Specific method: `createHash('sha256')`.
  - Why: Provides the built-in binary SHA-256 primitive. No separate hashing dependency is needed.
- [MySQL 8.4 locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
  - Specific sections: `FOR UPDATE`, transaction duration, and `SKIP LOCKED` limitations.
  - Why: The global chain head requires a serializing row lock. `SKIP LOCKED` is queue-like and cannot define one total order.
- [MySQL 8.4 privileges](https://dev.mysql.com/doc/refman/8.4/en/privileges-provided.html)
  - Specific privileges: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, `INDEX`, and `REFERENCES`.
  - Why: Dedicated users need exact positive grants. MySQL grants are additive.
- [MySQL 8.4 `GRANT` statement](https://dev.mysql.com/doc/refman/8.4/en/grant.html)
  - Specific sections: database-level and table-level privileges.
  - Why: Separate schemas avoid trying to deny audit writes inherited from the main application schema.
- [MySQL 8.4 JSON data type](https://dev.mysql.com/doc/refman/8.4/en/json.html)
  - Specific warning: normalized representation and key ordering may change.
  - Why: Store and hash exact canonical `LONGTEXT`. Never reconstruct hash input from a MySQL JSON value.
- [Kysely transaction API](https://kysely-org.github.io/kysely-apidoc/classes/Kysely.html#transaction)
  - Specific behavior: callback completion commits and thrown errors roll back.
  - Why: The business change and outbox insert must use one callback transaction.
- [Kysely schema recipe](https://github.com/kysely-org/kysely/blob/master/site/docs/recipes/0007-schemas.md)
  - Specific method: `withSchema` and typed qualified tables.
  - Why: The same connection can insert into `fvdms` and `fvdms_audit` atomically.
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
  - Specific sections: `GET`, request query parameters, and dynamic behavior.
  - Why: Audit results use authenticated no-store Route Handlers with parsed structured filters.

### Patterns to Follow

**Transaction-scoped event port:**

```ts
export interface AuditEventPort {
  append(event: AuditEventInput): Promise<void>;
}

export interface AuthRepositories {
  readonly users: UserRepository;
  readonly auditEvents: AuditEventPort;
}
```

Mirror `src/application/auth/ports/auth-transaction.ts:11`. Every business transaction receives an audit adapter built from the same Kysely transaction handle. Application services do not open a second connection or publish after commit.

**Kysely callback transaction:**

```ts
return database.transaction().execute((transaction) => work(createRepositories(transaction)));
```

Mirror `src/infrastructure/database/auth/kysely-auth-transaction.ts:11`. The outbox insert and business changes roll back together on any error.

**Qualified primary audit insert:**

```ts
await transaction
  .withSchema(primaryAuditSchema)
  .insertInto('audit_outbox')
  .values(row)
  .executeTakeFirstOrThrow();
```

Use a validated schema identifier from configuration. Never interpolate unvalidated schema or table names. Keep the primary audit schema on the same MySQL server as the business schema for atomic capture.

**Global chain lock order:**

```text
begin transaction
  -> SELECT singleton chain head FOR UPDATE
  -> read next bounded outbox rows after head source position, ordered ascending
  -> validate that each stored payload is canonical and within contract
  -> derive sequence, previous hash, and record hash
  -> insert immutable chain entries
  -> advance singleton head
commit
```

Every finalizer follows this order. Do not combine `SKIP LOCKED` with a global chain. Do not hold the head lock while writing to the secondary sink.

**Read plus access evidence:**

```ts
return auditReadTransaction.execute(async ({ queries, auditEvents }) => {
  const page = await queries.search(input);
  await auditEvents.append(buildAuditAccessEvent(context, input));
  return page;
});
```

Search/detail results are acknowledged only after their access evidence is durable. A failed lookup or denied permission should follow the explicit security-event rules rather than falsely claim a successful audit-data read.

**Route Handler pattern:**

```ts
return withResponseHandler(composition, async ({ request, requestId }) => {
  const authenticated = await authenticateRequest(request, auditReadDependencies);
  const input = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return composition.searchAuditEvents.execute({
    ...input,
    actor: authenticated.principal,
    requestId,
  });
})(request);
```

Mirror `src/app/api/users/route.ts:18`. Preserve the shared envelope, request ID, `Cache-Control: no-store`, sanitized failures, and authoritative server permission.

**UI pattern:**

- Keep the page a Server Component. Use URL search parameters for filters and pagination.
- Use a dense table from `sm` upward and cards with definition lists below `sm`.
- Keep table headers sticky only inside a bounded scroll region. Preserve visible focus outlines.
- Use visible filters for time range, action, entity type, entity public ID, actor public ID, and request ID.
- Show action, time, actor, entity, request ID, and integrity position in results. Keep IP address, user agent, snapshots, and metadata on the detail page.
- Use semantic tokens, Lexend headings, Source Sans 3 body text, Lucide icons, six-pixel radius, one-pixel borders, and 44-pixel controls.
- Pair integrity color with icon and text. Never use color alone.
- Provide loading, empty, filtered-empty, denied, unavailable, invalid-cursor, and verification-unavailable states.
- Do not add gradients, decorative motion, oversized headings, edit controls, client-only permission decisions, or a verifier run button.

---

## SECURITY AND DATA CONTRACT DESIGN

### Audit Event Contract

- `publicId`: UUIDv7 string generated before append and unique across all event producers.
- `schemaVersion`: integer `1` for this ticket. The version is included in canonical data and hash preimage.
- `occurredAt`: normalized UTC ISO 8601 string with millisecond precision.
- `actorPublicId`: nullable user public ID. It is null for unknown login identities and system processes.
- `action`: stable lowercase dotted code with a bounded length. Examples include `auth.login.failed`, `auth.authorization.denied`, and `audit.accessed`.
- `entity`: nullable object containing a stable lowercase type and public identifier. Never use internal numeric keys.
- `requestId`: required request correlation public ID for request-driven events. Commands and workers generate a correlation ID.
- `ipAddress`: nullable normalized IPv4 or IPv6 binary value at persistence. Validate with Node `net.isIP` before conversion.
- `userAgent`: nullable bounded string. Treat it as untrusted display text and never render it as markup.
- `before`, `after`, and `metadata`: nullable audit-safe JSON values built by event-specific allowlists.
- `reasonCode`: nullable bounded stable code. Do not include free-form exception messages, SQL, stacks, or secrets.
- Reject a canonical payload above 65,536 UTF-8 bytes before inserting the outbox row.

### Audit-Safe JSON Contract

- Accept only null, booleans, strings, finite safe integers, arrays, and objects with string keys.
- Represent decimal, money, `BIGINT`, binary, UUID, and normalized timestamp values as strings.
- Reject `undefined`, functions, symbols, `NaN`, positive or negative infinity, unsafe integers, sparse arrays, cyclic values, raw `Date` instances, and negative zero.
- Reject prototype-pollution keys such as `__proto__`, `prototype`, and `constructor` at every object level.
- Bound nesting depth, array length, object key count, individual string length, and the final canonical byte length.
- Normalize data in event builders before it reaches the port. The infrastructure adapter validates again before persistence.
- Never serialize full request objects, cookies, headers, session tokens, CSRF values, passwords, TOTP material, reset credentials, encryption material, database rows, or generic errors.

### Canonicalization and Hash Contract

- `canonicalize@4.0.0` produces RFC 8785 text from the validated event object before the outbox insert.
- Encode the canonical text as UTF-8 once and store that exact text in both `audit_outbox.canonical_payload` and `audit_chain_entries.canonical_payload` as `LONGTEXT`.
- Format the binary preimage as: ASCII domain tag `FVDMS-AUDIT`, one format-version byte, unsigned 64-bit big-endian sequence, 32-byte previous hash, unsigned 32-bit big-endian canonical-byte length, then canonical UTF-8 bytes.
- Use sequence `1` for the first record and 32 zero bytes as its previous hash.
- Hash the complete preimage with SHA-256. Store `previous_hash` and `record_hash` as `BINARY(32)`.
- Treat the preimage format as immutable. A future change requires a new format version and explicit verifier support.
- The worker may parse and recanonicalize only to prove the stored outbox text is canonical. It hashes the original stored bytes after equality passes.
- Never compute a record hash from a MySQL-normalized payload. Verification reads the stored canonical chain text bytes directly.

### Primary Schema Contract

`fvdms_audit.audit_outbox` is immutable capture evidence:

- Auto-increment source position, unique event public ID, exact canonical payload `LONGTEXT`, indexed summary columns, and capture time.
- The application account has `INSERT` only. The worker has `SELECT` only.
- No normal account has `UPDATE` or `DELETE`.
- The outbox remains after chaining. Delivery state is stored elsewhere.

`fvdms_audit.audit_chain_entries` is the immutable local chain:

- Global unsigned sequence, source outbox position, event public ID, exact canonical payload, previous hash, record hash, and chained time.
- Unique sequence, source position, and event public ID prevent normal duplicate finalization.
- Only the worker account has `INSERT`. No normal account has `UPDATE` or `DELETE`.

`fvdms_audit.audit_chain_heads` is mutable operational state:

- One named singleton row stores last sequence, last outbox position, last record hash, and update time.
- Only the worker account may `SELECT` and `UPDATE` it.
- Every chain batch locks this row first.

`fvdms_audit.audit_sink_deliveries` is mutable operational state:

- One row per primary chain sequence stores attempts, next retry time, last safe error code, delivered time, and sink fingerprint.
- The worker may insert and update this table. It contains no secret or full error text.

`fvdms_audit.audit_verification_runs` is immutable completed evidence:

- Insert one row only after a verification reaches a final state.
- Store public ID, captured high-water mark, verified count, status, first mismatch position/type, start/end time, and safe summary.
- Do not expose a mutable in-progress row as a completed result.

### Secondary Sink Contract

- `fvdms_audit_sink.audit_sink_entries` is insert-only through the sink-writer credential.
- Store the primary sequence, event public ID, exact canonical payload, previous hash, record hash, and delivered time.
- Use a deterministic SHA-256 delivery fingerprint as the primary key. It covers sequence, event ID, payload bytes, and both hashes.
- An exact retry produces the same primary key. Treat its duplicate-key result as success after comparing expected identity.
- Do not make event ID or primary sequence uniquely mutable away. A conflicting second row must remain visible so verification can classify duplicate or mismatch evidence.
- Give the verifier `SELECT` only. Give the app and chain worker no direct sink privilege.

### Worker and Failure Contract

- Run finalization and sink delivery as independent bounded loops in one worker process. Each loop has its own transaction and error boundary.
- Default chain batch size is 100, sink batch size is 100, and idle poll interval is 1,000 milliseconds. Parse each through typed environment configuration.
- Use one chain-head lock to serialize multiple accidental worker replicas safely.
- Keep capture canonicalization and worker hashing deterministic. Unit tests use fixed vectors. Integration tests run competing worker instances.
- If an outbox event violates the contract, roll back the batch, stop chain progress at that source position, emit a stable operational error, and return a non-success worker state. Never skip or rewrite it.
- A sink outage updates retry state with bounded exponential backoff and jitter. It does not undo primary chaining or affect business requests.
- Handle `SIGTERM` and `SIGINT` by stopping new batches, completing or rolling back the current transaction, closing pools, and exiting within the Compose grace period.

### Verification Contract

- Start by reading the primary chain high-water sequence and hash. Verify only positions `1` through that sequence.
- Stream primary and sink rows in bounded pages. Do not load the full audit history into memory.
- Recompute each primary record hash from stored canonical text, expected sequence, and expected previous hash.
- Confirm the primary record links to the next record and the captured head hash.
- Compare sink records by sequence and delivery fingerprint. Detect missing, extra/duplicate, changed payload, previous-hash mismatch, record-hash mismatch, reordered sequence, event-ID mismatch, and captured-head mismatch.
- New records above the captured high-water mark do not fail the run.
- Insert one completed verification record with `PASS` or `FAIL`. Infrastructure errors produce a distinct command failure and no misleading pass result.
- Return exit code zero only for a complete `PASS`. Return nonzero for `FAIL`, incomplete reads, invalid configuration, or database errors.

### Audit Query and Authorization Contract

- Add code-owned permissions `audit.read` and `audit.read_sensitive`. Seed both through the new migration and assign them to `AUDITOR` and `SUPER_ADMIN`. Assign `audit.read` to `SYSTEM_ADMIN` unless the binding role matrix says otherwise during drift check.
- Require `audit.read` for search, detail, and latest verification status.
- Require `audit.read_sensitive` before returning IP address, user agent, before/after snapshots, or metadata.
- Search filters are `from`, `to`, `action`, `entityType`, `entityPublicId`, `actorPublicId`, `requestId`, `cursor`, and `pageSize` from 1 through 100.
- Order by global sequence descending. Encode the last sequence and filter fingerprint into an opaque base64url cursor. Reject a cursor reused with different filters.
- Return public strings for every `BIGINT` sequence and position.
- Search returns only summary fields. Detail returns sensitive fields conditionally.
- Every successful search and existing detail read appends `audit.accessed` in the same primary transaction. Metadata records filter categories and returned count, not full filter values that could contain personal data.
- Authentication failures continue using existing authentication evidence. Authorization denials append `auth.authorization.denied` with actor, required permission, request ID, safe path template, source address, and user agent.
- Avoid recursive evidence. Internal worker/verifier reads and the outbox insert that records `audit.accessed` do not trigger another access event.

### Backfill and Reversibility Contract

- Do not edit migration `20260828_000002_create_authentication_and_rbac.ts`.
- The new migration creates audit schemas through bootstrap first, then creates tables and permissions through qualified names.
- Backfill each `auth_security_events` row into `audit_outbox` with schema version 1 and preserved `public_id`.
- Map `event_type` to `action`, actor to `actorPublicId`, target to entity type `user`, request and reason directly, and legacy metadata through the safe JSON validator.
- Set `occurredAt` from the existing created time. Set capture time to the migration time or original time according to one documented deterministic rule.
- Compare source count, destination count, and public IDs before dropping the old table.
- `down` recreates `auth_security_events`, restores backfilled authentication rows from the outbox, removes FVD-003 permissions, then drops sink and primary audit objects in dependency order.
- Rollback is a development/test guarantee. Production rollback after new operational events requires an explicit data-migration decision and is not an automatic runbook action.

---

## IMPLEMENTATION PLAN

### Phase 1: Contracts, dependency, configuration, and design preparation

Pin the canonicalizer and encode the accepted event, hashing, worker, schema, and UI decisions before persistence work.

**Tasks:**

- Add the dependency and worker/verifier scripts.
- Add typed environment contracts for all schemas, credentials, limits, batches, and polling.
- Create the page-specific audit design override from UI/UX Pro Max and UI Styling while retaining the master design system.
- Implement framework-free audit event and JSON rules with fixed unit vectors.

### Phase 2: Least-privilege schemas and atomic capture

**Depends on:** Phase 1 for stable names, contracts, and configuration.

Create both audit schemas, dedicated credentials, immutable primary/sink tables, mutable operational state, backfill, and the shared transactional outbox adapter.

**Tasks:**

- Extend database bootstrap with separate accounts and exact grants.
- Add the third reversible migration and persistence types.
- Prove grants through actual restricted MySQL accounts.
- Replace the authentication security-event bridge without losing public IDs or rollback behavior.

### Phase 3: Chain, sink, and verification services

**Depends on:** Phase 2 for durable outbox rows and restricted accounts.

Implement canonicalization, versioned hash preimages, serialized global finalization, independent sink delivery, and bounded verification.

**Tasks:**

- Add fixed canonicalization and hashing vectors.
- Add the chain repository and finalizer with a locked singleton head.
- Add insert-only sink delivery with exact-retry handling and bounded backoff.
- Add verification for every required tamper category and high-water-mark concurrency.

### Phase 4: Shared producers, authorization evidence, and audit queries

**Depends on:** Phase 2 for capture and Phase 3 for stable final record fields.

Map FVD-002 evidence into the shared contract. Add audited authorization denials and transactional auditor search/detail workflows.

**Tasks:**

- Update every authentication event builder and transaction repository set.
- Add request-context denial evidence without weakening pure authorization policies.
- Add cursor-based read repositories and atomic `audit.accessed` use cases.
- Compose web, worker, and verifier dependencies through focused factories.

### Phase 5: HTTP, UI, local operations, and full assurance

**Depends on:** Phase 4 for complete use cases and authoritative permissions.

Expose protected no-store APIs and accessible server-rendered pages. Run the worker in Docker, prove the complete security matrix, and document production limitations.

**Tasks:**

- Add audit search, detail, and verification-status Route Handlers.
- Add the protected audit navigation, filter page, responsive results, detail page, and explicit states.
- Add signal-safe scripts and the non-routed worker Compose service.
- Add integration, browser, CI, documentation, and live `fvdms.lan` validation.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order. Write or update the named focused test before its production behavior. Make the test fail for the intended reason, implement the smallest complete behavior, and run the focused validation before continuing.

### 1. UPDATE dependency, scripts, and typed audit configuration

- **UPDATE**: `package.json`, `pnpm-lock.yaml`, `.env.example`, `compose.yaml`, `src/infrastructure/config/environment.ts`, and `tests/unit/infrastructure/config/environment.test.ts`.
- **IMPLEMENT**: Pin `canonicalize@4.0.0`. Add `audit:worker`, `audit:verify`, and container variants. Parse validated schema identifiers, dedicated credentials, 65,536-byte payload limit, batch sizes, poll interval, retry base/max, and verifier page size. Reject equal application and sink-writer identities outside isolated tests.
- **PATTERN**: Existing Zod schemas and typed mappers in `src/infrastructure/config/environment.ts:8` and existing script conventions in `package.json`.
- **IMPORTS**: Use `zod` for configuration. Do not import `process.env` below infrastructure composition or scripts.
- **GOTCHA**: Node 24 is the supported runtime. Keep secrets server-only. Schema names are identifiers, not connection URLs. Do not expose any audit password with `NEXT_PUBLIC_`.
- **VALIDATE**: `pnpm install --frozen-lockfile=false && pnpm exec vitest run --config vitest.config.ts tests/unit/infrastructure/config/environment.test.ts && pnpm typecheck`
- **SATISFIES**: AC #2, #4, #5, #8, and #14.

### 2. CREATE the audit-trail page design override

- **CREATE**: `design-system/fuel-and-vehicle-dispatch-management-system/pages/audit-trail.md`.
- **IMPLEMENT**: Record the audit page's information hierarchy, structured filters, desktop table, mobile cards, detail layout, status language, icons, focus order, keyboard behavior, error/empty/loading states, and responsive rules. Document that sensitive context requires `audit.read_sensitive` and that no control runs verification.
- **PATTERN**: `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md`, existing `pages/user-management.md`, UI/UX Pro Max results, and UI Styling accessibility/responsive references.
- **IMPORTS**: No code imports. Reference only existing semantic tokens, local shadcn primitives, Lucide icons, Lexend, and Source Sans 3.
- **GOTCHA**: The generic UI search suggested a dark marketing style and Fira fonts. Reject those suggestions because the persisted FVDMS master system governs this product. Keep light/dark support and density setting 8.
- **VALIDATE**: `pnpm exec prettier --check design-system/fuel-and-vehicle-dispatch-management-system/pages/audit-trail.md`
- **SATISFIES**: AC #10 and #13.

### 3. CREATE audit domain values and the shared application contract

- **CREATE**: Domain entities/value objects, application DTOs, ports, and unit tests listed in the new-file section.
- **IMPLEMENT**: Define event schema version 1, dotted actions, public entity references, UTC timestamps, recursive audit-safe JSON, search/detail DTOs, opaque cursors, chain records, sink records, verification results, and narrow ports. Enforce all size, depth, count, numeric, prototype-key, and secret-safe boundaries.
- **PATTERN**: `src/domain/shared/value-objects/public-id.ts:1`, `src/application/auth/ports/security-event-port.ts:1`, and constructor-injected application ports.
- **IMPORTS**: Domain modules may import other domain modules only. Application modules may import domain types and shared application ports. Neither layer may import Next.js, Kysely, mysql2, Node cryptography, environment globals, or `canonicalize`.
- **GOTCHA**: TypeScript types do not validate runtime JSON. Reject sparse arrays, negative zero, unsafe numbers, cycles, raw dates, and prototype keys explicitly. Use strings for money, decimal, `BIGINT`, and timestamps.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/domain/audit tests/unit/application/audit/contracts.test.ts && pnpm typecheck`
- **SATISFIES**: AC #1, #4, #7, #8, and #9.

### 4. CREATE RFC 8785 canonicalization and versioned SHA-256 hashing

- **CREATE**: `src/infrastructure/audit/rfc8785-audit-canonicalizer.ts`, `src/infrastructure/audit/node-sha256-audit-hasher.ts`, and their unit tests.
- **IMPLEMENT**: Wrap `canonicalize` behind the application port. Revalidate the accepted subset, produce UTF-8 bytes, enforce the final byte cap, build the exact domain-separated binary preimage, and hash it with SHA-256. Add RFC vectors, Unicode property-order cases, multibyte byte lengths, zero genesis, sequence transitions, and mutation sensitivity.
- **PATTERN**: Existing focused infrastructure adapters under `src/infrastructure/auth/**` and the binary contract in this plan.
- **IMPORTS**: Import `canonicalize` only in its adapter. Import `createHash` from `node:crypto`. Use `Buffer` only in infrastructure.
- **GOTCHA**: The length is the UTF-8 byte count, not JavaScript string length. Do not use delimiters or concatenate ambiguous strings. Do not parse and reserialize stored canonical text during verification.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/infrastructure/audit && pnpm test:coverage`
- **SATISFIES**: AC #4, #6, and #9.

### 5. UPDATE database bootstrap with isolated schemas, users, and grants

- **UPDATE**: `src/infrastructure/database/bootstrap.ts`, `scripts/database/bootstrap.ts`, `src/infrastructure/config/environment.ts`, `tests/unit/infrastructure/database/bootstrap.test.ts`, and `.env.example`.
- **IMPLEMENT**: Create `fvdms_audit` and `fvdms_audit_sink`. Create/alter app, worker, sink-writer, verifier, and migrator accounts. Grant the app `INSERT` on the outbox plus required read-only query tables. Grant the worker only primary reads, chain inserts, and operational-state updates. Grant the sink writer `INSERT` only on sink entries. Grant the verifier `SELECT` on both schemas and `INSERT` on completed runs. Grant the migrator exact DDL and data-migration privileges.
- **PATTERN**: Escaped account/identifier construction in `src/infrastructure/database/bootstrap.ts:5`.
- **IMPORTS**: Continue using `escape` and `escapeId` from `mysql2`. Keep statement generation pure and directly testable.
- **GOTCHA**: MySQL grants are additive. Revoke obsolete broad audit grants before applying table-specific grants. Never give the main app `UPDATE` or `DELETE` on either audit schema. Use explicit table grants where a schema-wide grant would exceed the contract.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/infrastructure/database/bootstrap.test.ts tests/unit/infrastructure/config/environment.test.ts`
- **SATISFIES**: AC #2, #5, and #14.

### 6. CREATE the reversible audit migration and persistence types

- **CREATE**: `src/infrastructure/database/migrations/20260828_000003_create_durable_audit_subsystem.ts`, `src/infrastructure/database/audit/types.ts`, and migration-focused integration assertions.
- **UPDATE**: `src/infrastructure/database/types.ts`, `tests/integration/database/auth-migrations.test.ts`, and `tests/integration/database/migrations.test.ts`.
- **IMPLEMENT**: Create the primary outbox, chain entries, singleton head, sink deliveries, verification runs, and sink entries with exact types, checks, keys, and indexes. Seed `audit.read` and `audit.read_sensitive`. Backfill legacy auth events with preserved public IDs and count/identity checks. Drop the temporary table only after successful checks. Implement a dependency-safe development rollback and deterministic reapply.
- **PATTERN**: Existing migration naming and reversible `up`/`down` style in `src/infrastructure/database/migrations/20260828_000002_create_authentication_and_rbac.ts`.
- **IMPORTS**: Use Kysely schema builders and `sql` only in infrastructure migrations. Use qualified schema APIs or safely escaped fixed identifiers.
- **GOTCHA**: Do not edit the applied FVD-002 migration. Kysely's migration metadata remains in the main database. Preserve legacy event IDs. Store canonical payload as `LONGTEXT`, not MySQL JSON. Seed the all-zero head explicitly.
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/database/migrations.test.ts tests/integration/database/auth-migrations.test.ts`
- **SATISFIES**: AC #2, #3, #5, #11, and #14.

### 7. CREATE the transactional outbox adapter and replace the auth bridge

- **CREATE**: `src/infrastructure/database/audit/kysely-audit-outbox-store.ts` and focused unit/integration tests.
- **UPDATE**: `src/application/auth/ports/auth-transaction.ts`, `src/infrastructure/database/auth/create-kysely-auth-repositories.ts`, `src/infrastructure/database/auth/kysely-auth-transaction.ts`, authentication fakes, and all `securityEvents` references.
- **DELETE**: `src/application/auth/ports/security-event-port.ts` and `src/infrastructure/database/auth/kysely-security-event-store.ts` after no imports remain.
- **IMPLEMENT**: Build the audit outbox adapter from the same transaction handle as authentication repositories. Validate and canonicalize the event before inserting its exact text plus indexed summary columns. Preserve authentication event public IDs and atomic rollback semantics. Rename the repository property to `auditEvents`.
- **PATTERN**: Current transaction factory at `src/infrastructure/database/auth/create-kysely-auth-repositories.ts:16` and adapter at `src/infrastructure/database/auth/kysely-security-event-store.ts:11`.
- **IMPORTS**: Auth application code imports `AuditEventPort` from `src/application/audit`. Infrastructure imports Kysely and audit persistence mapping. Do not create a global audit client inside the adapter.
- **GOTCHA**: A second connection breaks atomicity even on the same server. `withSchema` must run on the callback transaction. An invalid event must roll back the business change, not get logged and ignored.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/auth tests/unit/infrastructure/database && pnpm exec vitest run --config vitest.integration.config.ts tests/integration/auth/security-controls.test.ts tests/integration/audit/audit-outbox.test.ts`
- **SATISFIES**: AC #1, #2, #3, and #8.

### 8. UPDATE authentication producers and CREATE audited authorization denials

- **UPDATE**: Authentication use cases/services that append events, `src/application/auth/services/authorize-permission.ts`, `src/lib/auth/authenticated-request.ts`, related routes if context must be passed, and focused tests.
- **IMPLEMENT**: Map every FVD-002 event to the shared contract through event-specific builders. Record login, logout, password, MFA, user, role, session, and recovery actions without secrets. Append failed authorization with actor, required permission, request ID, safe route template, source address, and user agent. Keep the authorization decision reusable and framework-free.
- **PATTERN**: Existing event append calls in `src/application/auth/use-cases/login.ts:185` and request boundary at `src/lib/auth/authenticated-request.ts:26`.
- **IMPORTS**: Put event builders under application auth or audit modules. HTTP code may parse request context, but it passes plain values inward. Use `node:net` only in an infrastructure or HTTP normalization helper.
- **GOTCHA**: Authorization evidence must be durable before returning 403 when the database is available. Avoid recursion when the denied permission is `audit.read`. Do not store raw cookies, query strings, submitted usernames, or dynamic paths containing personal values.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/auth tests/unit/lib/auth/authenticated-request.test.ts && pnpm exec vitest run --config vitest.integration.config.ts tests/integration/auth/security-controls.test.ts`
- **SATISFIES**: AC #1, #7, #8, and #12.

### 9. CREATE the primary chain repository and finalization service

- **CREATE**: `src/infrastructure/database/audit/kysely-audit-chain-repository.ts`, `src/application/audit/services/audit-chain-worker.ts`, and focused unit tests.
- **IMPLEMENT**: Lock the singleton head, load the next ordered outbox batch, prove each stored payload is valid canonical text, hash its original bytes, derive sequences, append immutable entries, initialize delivery state, and advance the head within one transaction. Return explicit idle, progressed, and halted outcomes.
- **PATTERN**: Kysely callback transactions and MySQL `SELECT ... FOR UPDATE` locking reads.
- **IMPORTS**: Application service imports only ports and domain types. Infrastructure repository imports Kysely and audit row mappers. Inject the canonicalizer, hasher, clock, repository, and policy.
- **GOTCHA**: Lock the head before selecting the batch. Use source position greater than the locked head's last outbox position. Roll back the whole batch on any invalid event. Never invoke the sink while holding the head lock.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/audit/audit-chain-worker.test.ts && pnpm exec vitest run --config vitest.integration.config.ts tests/integration/audit/audit-chain-worker.test.ts`
- **SATISFIES**: AC #4, #6, #8, and #9.

### 10. CREATE the append-only sink adapter and delivery service

- **CREATE**: `src/application/audit/services/audit-sink-delivery-worker.ts`, `src/infrastructure/database/audit/kysely-audit-sink.ts`, and focused tests.
- **IMPLEMENT**: Select due undelivered chain entries in bounded order, compute deterministic delivery fingerprints, append exact records through sink-writer credentials, treat verified exact duplicates as success, and update only primary delivery state. Add bounded exponential retry with jitter for unavailable sinks.
- **PATTERN**: Port/adapter separation used by health and authentication infrastructure. Sink interaction occurs outside the chain-head transaction.
- **IMPORTS**: Application code depends on `AuditSink` and chain/delivery ports. The MySQL adapter uses its dedicated Kysely client. Inject retry randomness or delay calculation for deterministic tests.
- **GOTCHA**: Never use `INSERT ... ON DUPLICATE KEY UPDATE` against the sink. Never grant sink update/delete. A same-fingerprint duplicate requires an identity comparison. Conflicting duplicates remain as evidence for verification.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/audit/audit-sink-delivery-worker.test.ts && pnpm exec vitest run --config vitest.integration.config.ts tests/integration/audit/audit-sink.test.ts`
- **SATISFIES**: AC #5, #6, #8, and #9.

### 11. CREATE bounded chain and sink verification

- **CREATE**: `src/application/audit/services/verify-audit-chain.ts`, `src/infrastructure/database/audit/kysely-audit-verification-repository.ts`, and focused tests.
- **IMPLEMENT**: Capture the primary head, stream both stores through that sequence, recompute primary hashes from exact stored text, verify links and head, compare sink identity/content, classify every mismatch, and append one final verification result. Return explicit pass/fail/infrastructure outcomes.
- **PATTERN**: Constructor-injected use cases and lossless `BIGINT` string conversions in current database clients.
- **IMPORTS**: Application verification imports only ports and the injected hasher. Infrastructure handles Kysely pagination and binary buffers.
- **GOTCHA**: Do not compare only stored hashes. Tampered payload and matching tampered hash must still break the link or recomputation. New records beyond the high-water mark are ignored for this run. Extra sink duplicates within the range must fail.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/audit/verify-audit-chain.test.ts && pnpm exec vitest run --config vitest.integration.config.ts tests/integration/audit/audit-verification.test.ts`
- **SATISFIES**: AC #6, #9, and #11.

### 12. CREATE cursor-based audit query transactions and use cases

- **CREATE**: Audit query/read-transaction adapters, search/detail/latest use cases, cursor codec, and focused tests listed above.
- **IMPLEMENT**: Validate structured filters, bind parameters, order by sequence descending, produce filter-bound opaque cursors, conditionally project sensitive context, and append `audit.accessed` within the same transaction as each successful search/detail read. Return the latest completed verification summary separately.
- **PATTERN**: `src/application/auth/use-cases/list-users.ts`, `src/app/api/users/route.ts:12`, and the transaction-scoped read pattern in this plan.
- **IMPORTS**: Application use cases import DTOs, current-principal data, clock, public-ID generator, and ports. Infrastructure imports Kysely query builders. Keep cursor encoding in a focused server-only adapter if it uses `Buffer`.
- **GOTCHA**: Bind all values. Validate ISO ranges and require `from <= to`. A cursor must be invalid when filters change. Do not expose snapshots or network context to principals lacking `audit.read_sensitive`. Avoid recursively auditing internal repository reads.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/audit/search-audit-events.test.ts tests/unit/application/audit/get-audit-event.test.ts && pnpm exec vitest run --config vitest.integration.config.ts tests/integration/audit/audit-queries.test.ts`
- **SATISFIES**: AC #7, #8, #10, #12, and #13.

### 13. CREATE focused audit composition factories

- **CREATE**: `src/infrastructure/composition/audit.ts` and unit tests.
- **UPDATE**: `src/infrastructure/composition/root.ts`, database client helpers, and composition tests.
- **IMPLEMENT**: Build one web-read composition from the app connection, one worker composition from worker and sink-writer clients, and one verifier composition from read-only clients plus verification-result insert capability. Keep singleton lifecycle and close hooks explicit for scripts/tests.
- **PATTERN**: `src/infrastructure/composition/root.ts:90` and current injected adapter construction.
- **IMPORTS**: Centralize concrete infrastructure imports in composition. Routes and scripts import factory contracts, not Kysely repositories directly.
- **GOTCHA**: Do not give the web process sink-writer credentials. Do not reuse the broad web composition in the worker. Prevent test singleton leakage across environment maps.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/infrastructure/composition && pnpm typecheck`
- **SATISFIES**: AC #2, #5, #7, and #14.

### 14. CREATE protected audit Route Handlers

- **CREATE**: `src/app/api/audit-events/route.ts`, `src/app/api/audit-events/[eventId]/route.ts`, `src/app/api/audit-verification/latest/route.ts`, and route tests.
- **IMPLEMENT**: Add Node-runtime, force-dynamic, no-store `GET` handlers. Authenticate the session, require `audit.read`, parse exact Zod query/public-ID schemas, pass request context, enforce sensitive-field projection, and return shared envelopes with string sequences and cursor links.
- **PATTERN**: `src/app/api/users/route.ts:18`, `src/lib/http/with-response-handler.ts:24`, and installed Next.js Route Handler guidance.
- **IMPORTS**: Routes import application composition, auth helpers, Zod schemas, and response wrapper only. No direct repository or Kysely imports.
- **GOTCHA**: `GET` is read-only from the audit resource perspective, but its access-evidence append is a database mutation. Keep `Cache-Control: no-store`. Do not put cursor/filter values in logs or error messages.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/app/api/audit && pnpm build`
- **SATISFIES**: AC #7, #10, #12, and #13.

### 15. CREATE the accessible audit page, detail page, and navigation

- **CREATE**: Protected audit pages and components listed above.
- **UPDATE**: `src/app/(protected)/layout.tsx` and any narrow page tests.
- **IMPLEMENT**: Render verification status, structured GET filters, newest-first cursor results, desktop table, mobile cards, explicit states, permission-aware sensitive context, and event detail. Add a protected audit navigation link for permitted users. Use server rendering and progressive enhancement.
- **PATTERN**: Page override from Task 2, `src/app/(protected)/admin/users/page.tsx:19`, and local shadcn table/card/badge primitives.
- **IMPORTS**: Use existing local UI components and Lucide icons. Keep client code limited to interaction that cannot use native GET forms or links.
- **GOTCHA**: Never render canonical payload as HTML. Long IDs and user agents must wrap without horizontal page overflow. Sticky headers need a labeled scroll region. Status must include icon and text. No edit, delete, export, or run-verifier controls.
- **VALIDATE**: `pnpm lint && pnpm typecheck && pnpm build`
- **SATISFIES**: AC #7, #10, #12, and #13.

### 16. CREATE signal-safe worker/verifier scripts and UPDATE Docker development

- **CREATE**: `scripts/audit/worker.ts`, `scripts/audit/worker.sh`, `scripts/audit/verify.ts`, `scripts/audit/verify.sh`, and script tests.
- **UPDATE**: `compose.yaml`, `scripts/dev/up.sh`, `scripts/dev/logs.sh`, `scripts/dev/down.sh`, `package.json`, and container-dependency tests.
- **IMPLEMENT**: Run bounded finalization and sink delivery loops with nonblocking polling and signal-aware shutdown. Add a one-shot verifier. Add a non-routed `audit-worker` service using the same source image, volumes, `dev-net`, and dedicated credentials. Bootstrap and migrate before starting app plus worker.
- **PATTERN**: Existing shell wrappers under `scripts/database` and app Compose configuration.
- **IMPORTS**: Scripts import focused composition factories. Shell scripts use `exec` and avoid shell tracing. No script contains a credential literal.
- **GOTCHA**: The worker must not inherit app credentials. It must expose no Traefik labels or host ports. Compose health for the app cannot imply worker health. Poll delays must be interruptible enough for graceful shutdown.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/scripts/audit tests/unit/scripts/dev/container-dependencies.test.ts && docker compose config`
- **SATISFIES**: AC #4, #5, #6, #8, and #14.

### 17. ADD atomic capture and least-privilege MySQL integration coverage

- **CREATE**: `tests/integration/audit/audit-outbox.test.ts`, `tests/integration/audit/audit-privileges.test.ts`, and `tests/integration/helpers/audit-test-database.ts`.
- **UPDATE**: MySQL container/test-database helpers.
- **IMPLEMENT**: Bootstrap isolated schemas through an administrator connection, then open actual restricted clients. Prove business success plus event append, business rollback on event failure, event rollback on business failure, immutable outbox, immutable chain, insert-only sink, forbidden cross-role operations, and preserved auth backfill identities.
- **PATTERN**: Existing Testcontainers setup and `tests/integration/auth/security-controls.test.ts:118` rollback proof.
- **IMPORTS**: Tests may use `mysql2` administrator connections only in setup. Assertions must exercise the application/worker/sink accounts for privilege behavior.
- **GOTCHA**: Repository-level mocks cannot prove grants. A test that connects as root for update/delete assertions is invalid. Reset all schemas and users per isolated container lifecycle.
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/audit/audit-outbox.test.ts tests/integration/audit/audit-privileges.test.ts`
- **SATISFIES**: AC #1, #2, #3, #5, and #11.

### 18. ADD chain, concurrency, sink recovery, and tamper integration coverage

- **CREATE**: Remaining integration files under `tests/integration/audit` listed above.
- **IMPLEMENT**: Prove deterministic chains across batches, two concurrent workers, head lock recovery, poison-event halt, restart continuation, sink outage/retry/exact duplicate behavior, and verifier detection of missing, changed, reordered, duplicate, payload/hash/link/event-ID/head mismatches. Prove new records above a captured high-water mark do not fail an in-progress run.
- **PATTERN**: Serial integration configuration, real MySQL transactions, and fixed canonical/hash vectors from Task 4.
- **IMPORTS**: Tests use service APIs and dedicated clients. Direct SQL tampering is allowed only through an administrator test connection to simulate compromise.
- **GOTCHA**: Tests must confirm the restricted verifier still cannot repair data. Keep concurrency assertions deterministic with barriers or locked transactions, not arbitrary sleeps. Restore clean fixtures after each deliberate tamper.
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/audit`
- **SATISFIES**: AC #4, #5, #6, #9, and #11.

### 19. CREATE audit browser and accessibility coverage

- **CREATE**: `tests/e2e/audit-trail.spec.ts`.
- **UPDATE**: `tests/e2e/global-setup.ts`, `tests/e2e/fixtures/auth.ts`, and `tests/e2e/accessibility.spec.ts`.
- **IMPLEMENT**: Provision an auditor, non-auditor, events, chain records, and a completed verification run. Cover authorized filters, cursor navigation, detail reads, sensitive-field permission, denied page/API access, permission-aware navigation, access-event creation, empty/error states, keyboard order, focus visibility, 200-percent zoom, responsive widths, light/dark themes, reduced motion, and axe A/AA checks.
- **PATTERN**: Existing authentication E2E fixtures and Playwright axe helper.
- **IMPORTS**: Use Playwright and the shared axe fixture. Seed through application/test helpers. Use direct administrator setup only for deliberate verifier state.
- **GOTCHA**: Axe does not prove keyboard, zoom, focus, or contrast alone. Avoid brittle text snapshots of timestamps. Confirm long canonical context cannot cause horizontal viewport overflow.
- **VALIDATE**: `pnpm test:e2e -- --project=chromium --grep "audit"`
- **SATISFIES**: AC #7, #10, #12, and #13.

### 20. UPDATE CI and documentation, then RUN full validation

- **UPDATE**: `.github/workflows/ci.yml`, `README.md`, `.env.example`, and relevant operational comments.
- **IMPLEMENT**: Document guarantees, event-builder rules, schema/accounts, local same-host limitation, worker lifecycle, verifier exit codes, poison-event response, sink outage behavior, credential generation, production secondary-host expectation, and deferred retention. Ensure CI runs the expanded full gate with isolated MySQL and browser coverage.
- **PATTERN**: Current CI job and README development/architecture sections.
- **IMPORTS**: No new runtime imports. Documentation links to official RFC, MySQL, Kysely, and Node references from this plan.
- **GOTCHA**: Do not publish local password values as production examples. Do not describe local sink schemas as an independent backup. Do not document manual data repair as a normal worker recovery method.
- **VALIDATE**: `pnpm validate`
- **VALIDATE**: `pnpm dev:up && docker compose ps && curl --fail --silent --show-error https://fvdms.lan/api/health`
- **VALIDATE**: `pnpm audit:verify:container`
- **SATISFIES**: Every acceptance criterion.

---

## TESTING STRATEGY

### Unit Tests

- Audit values: dotted action format, schema version, public IDs, nullable actor/entity, UTC normalization, safe reason codes, network context, and payload limits.
- Safe JSON: every accepted primitive/container, nested bounds, Unicode, prototype keys, cycles, sparse arrays, raw dates, negative zero, unsafe integers, non-finite values, and multibyte byte caps.
- Canonicalization: RFC 8785 vectors, property order, escaped text, Unicode, repeatability, and exact UTF-8 output.
- Hashing: fixed genesis vector, domain tag, version, big-endian sequence/length, previous hash, payload mutation, sequence mutation, and link transitions.
- Finalizer: idle, bounded progress, multiple rows, invalid first/middle event, repository error, rollback result, and no sink call under the chain lock.
- Sink delivery: exact retry, conflicting duplicate, retry schedule, maximum backoff, partial batch, unavailable sink, and independent finalizer progress.
- Verification: pass, each mismatch class, captured high-water mark, empty chain, first mismatch reporting, bounded paging, and infrastructure failure.
- Search/detail: filter validation, cursor filter binding, summary projection, sensitive permission, missing detail, access evidence, and rollback when access capture fails.
- Authentication bridge: every old event maps to schema version 1 without secret fields or lost public IDs.
- Authorization denial: safe request context, unknown/missing principal branches, audit-read denial, no recursion, and durable failure behavior.
- HTTP: query validation, public ID parsing, permission requirements, no-store, request IDs, stable errors, and string `BIGINT` values.
- UI helpers: cursor links, filter preservation, status text/icon pairing, safe text rendering, and mobile/desktop content parity where extracted logic exists.

### Integration Tests

- Bootstrap: both schemas, all users, idempotent password updates, revocation of obsolete grants, and exact privilege tables.
- Migration: table shapes, data types, indexes, head seed, permission seeds, legacy backfill count/IDs, old-table removal, rollback, and reapply.
- Capture: business change plus event commit, event validation failure rollback, business error rollback, request acknowledgment after durable insert, and independent transactions.
- Privileges: app insert-only outbox, app read projection, worker primary operations, sink insert-only, verifier read-only, and denied update/delete/drop/grant paths.
- Chain: deterministic order, cross-batch links, one global head, two worker instances, lock release after failure, poison halt, and restart.
- Sink: exact bytes, fingerprint idempotence, outage recovery, non-blocking primary finalization, duplicate evidence, and restricted account.
- Verification: missing primary/sink row, changed payload, changed previous hash, changed record hash, reordered sequence, event mismatch, duplicate sink row, wrong head, and concurrent append above high-water.
- Queries: all individual/combined filters, cursor navigation with ties, invalid cursor/filter reuse, sensitive projection, and atomic `audit.accessed` capture.
- Authentication and authorization: prior FVD-002 event coverage remains green against the new shared outbox.

### End-to-End and Accessibility Tests

- Auditor sees the navigation item, search page, verification summary, results, pagination, and details.
- User without `audit.read` sees neither the navigation item nor protected page/API data. Direct calls return the stable denial contract.
- Auditor without `audit.read_sensitive` sees summaries and redacted detail fields.
- Search and detail produce `audit.accessed` records that later appear after worker finalization.
- Structured filters preserve values through navigation and expose understandable invalid/empty states.
- Keyboard-only use reaches filters, submit, clear, rows, pagination, detail back link, and navigation in logical order.
- Focus remains visible in light/dark themes. Error focus and status announcements work.
- Results work at 375, 768, 1024, and 1440 pixels and 200-percent zoom without page-level horizontal overflow.
- Reduced-motion preference produces no unnecessary animation. Axe passes Web Content Accessibility Guidelines A and AA tags.

### Edge Cases

- Empty outbox, empty chain, empty sink, and no completed verification run.
- First event, exact batch boundary, more than one batch, and maximum supported sequence representation.
- Two finalizers start together. One blocks on the head and continues from the updated position.
- Finalizer terminates after locking but before commit. The transaction rolls back and another worker continues.
- Poison event appears after valid events in the same batch. None of that batch commits.
- Sink becomes unavailable after some records. Delivered rows remain acknowledged and remaining rows retry.
- Exact sink insert succeeds but the acknowledgement is lost. Retry is recognized without mutation.
- Conflicting sink record shares an event ID or position with changed content. It remains detectable.
- Verification runs while new events are finalized or delivered above the captured high-water mark.
- Verification reads a primary row changed by an administrator test connection and recomputation detects it.
- Canonical payload contains non-ASCII text, escaped control characters, deep structures near the limit, or exactly 65,536 bytes.
- Search time bounds cross UTC dates, sequence is too large for JavaScript number, filters return no rows, or a cursor belongs to another filter set.
- Actor or target user is later soft-deleted. Historical public IDs and display-safe snapshots remain resolvable.
- Authorization denial occurs while audit storage is unavailable. Return a stable server failure rather than an unrecorded 403.
- `audit.accessed` itself is returned in later searches without recursively producing more than one access event per request.

---

## VALIDATION COMMANDS

Execute every level. Do not report completion from partial checks.

### Level 1: Formatting, Linting, and Types

```sh
pnpm format:check
pnpm lint
pnpm typecheck
```

### Level 2: Unit Tests and Coverage

```sh
pnpm test:unit
pnpm test:coverage
```

Coverage must remain at or above 80 percent for statements, branches, functions, and lines. Every security decision needs direct branch coverage even when aggregate coverage passes.

### Level 3: MySQL Integration and Privilege Tests

```sh
pnpm test:integration
```

The suite must use isolated `mysql:8.4.11` Testcontainers. It must create and exercise real restricted accounts. It must not read or mutate the shared local MySQL.

### Level 4: Browser and Accessibility Tests

```sh
pnpm exec playwright install chromium
pnpm test:e2e -- --project=chromium
```

### Level 5: Build and Full Gate

```sh
pnpm build
pnpm validate
```

### Level 6: Local Docker, Worker, and Verifier

```sh
pnpm dev:up
docker compose ps
curl --fail --silent --show-error https://fvdms.lan/api/health
pnpm audit:verify:container
docker compose logs --no-color --tail=200 audit-worker
```

Manual checks:

1. Authenticate as an auditor and confirm `/audit` loads through `https://fvdms.lan`.
2. Filter by time, action, actor, entity, and request ID. Confirm cursor navigation never duplicates or skips a chain sequence.
3. Open a detail record. Confirm exact permitted context and no secrets, HTML interpretation, or internal numeric IDs.
4. Authenticate without `audit.read`. Confirm the link is absent and direct page/API access is denied and audited.
5. Authenticate with `audit.read` but not `audit.read_sensitive`. Confirm sensitive detail fields remain absent.
6. Confirm every successful search and detail read creates exactly one `audit.accessed` outbox event.
7. Trigger login success, login failure, and permission denial. Confirm all use the shared event contract.
8. Stop the sink or invalidate only its connection. Confirm business requests and primary chaining continue while delivery retries safely.
9. Restore the sink. Confirm delivery catches up without mutated or duplicate effective records.
10. Run verification and confirm a completed pass is visible on the page.
11. In an isolated test database only, tamper with a sink or primary row as administrator. Confirm verification exits nonzero and reports the first safe mismatch category.
12. Inspect grants for every dedicated account. Confirm app and sink-writer accounts cannot update or delete audit rows.
13. Stop the worker during a batch and restart it. Confirm chain order and head remain valid.
14. Verify `/audit` and detail at 375, 768, 1024, and 1440 pixels, 200-percent zoom, keyboard-only use, light/dark themes, reduced motion, and Web Content Accessibility Guidelines AA contrast.
15. Inspect application and worker logs. Confirm payloads, snapshots, addresses, user agents, credentials, tokens, hashes from secrets, SQL, and stacks are not leaked beyond the documented safe operational fields.

---

## ACCEPTANCE CRITERIA

- [ ] **AC #1:** Every authentication or later business mutation can append one validated audit event inside the same MySQL transaction, and either both changes commit or both roll back.
- [ ] **AC #2:** A successful business response is never returned before its primary outbox event is durably committed on the local MySQL host.
- [ ] **AC #3:** Legacy `auth_security_events` rows are backfilled with preserved public IDs, the temporary contract/table are removed, and migration rollback/reapply tests pass.
- [ ] **AC #4:** The worker builds one deterministic RFC 8785 and SHA-256 chain with exact canonical text, binary hashes, zero genesis, stable sequences, and a locked global head.
- [ ] **AC #5:** Application, worker, sink-writer, verifier, and migrator credentials have tested least privileges, and normal application paths cannot update or delete audit evidence.
- [ ] **AC #6:** Sink delivery is append-only, independently retryable, exact-retry safe, and cannot block business capture or primary chain progress.
- [ ] **AC #7:** Authorized auditors can search summary events and open details through protected, paginated, read-only APIs and pages.
- [ ] **AC #8:** Authentication events and failed authorization attempts use the shared event contract with safe actor, action, request, entity, network, and allowlisted context.
- [ ] **AC #9:** Verification captures a high-water mark and detects missing, changed, reordered, duplicate, mismatched, broken-link, wrong-hash, and wrong-head records.
- [ ] **AC #10:** Audit search and detail access require code-owned permissions, conditionally protect sensitive context, and append exactly one durable `audit.accessed` event per successful read.
- [ ] **AC #11:** Integration tests prove transaction rollback, backfill, append-only grants, global worker concurrency, restart recovery, sink outage recovery, deterministic chaining, and every tamper category.
- [ ] **AC #12:** Audit APIs preserve the existing envelope, no-store header, request ID, public identifiers, sanitized errors, bounded filters, and string `BIGINT` contract.
- [ ] **AC #13:** Audit pages follow the persisted design system and pass responsive, keyboard, focus, labels, zoom, contrast, reduced-motion, safe-rendering, and axe checks.
- [ ] **AC #14:** Docker starts the app and non-routed audit worker on `dev-net`; the one-shot verifier works in the container; documentation states the local same-host sink limitation and production adapter expectation.
- [ ] **AC #15:** Formatting, linting, type checks, 80-percent coverage thresholds, MySQL integration, Playwright, production build, full validation, Docker health, worker logs, and live `fvdms.lan` checks pass.

---

## COMPLETION CHECKLIST

- [ ] Every task completed in order and its focused validation passed before the next task.
- [ ] Installed Next.js 16.3.3 documentation was re-read before route or Server Component changes.
- [ ] UI/UX Pro Max and UI Styling were invoked before UI implementation.
- [ ] The audit page override was checked against the master design system before components were created.
- [ ] No FVD-002 applied migration was edited.
- [ ] The third migration applies, rolls back one step, and reapplies in isolated MySQL.
- [ ] Legacy authentication event counts and public IDs are preserved during backfill.
- [ ] No domain/application import depends on Next.js, Kysely, mysql2, Node cryptography, Docker, or environment globals.
- [ ] Every event producer uses an event-specific snapshot allowlist.
- [ ] The event validator rejects ambiguous values and over-limit payloads before any business commit.
- [ ] Business data and the outbox insert share one Kysely callback transaction and one connection.
- [ ] Primary outbox, primary chain, completed verification, and sink evidence have no normal update/delete path.
- [ ] Dedicated credentials were tested through real connections rather than inferred from SQL strings.
- [ ] Canonicalization and hash fixed vectors pass across unit and integration suites.
- [ ] Two competing workers preserve one global sequence and hash chain.
- [ ] Poison events halt at the first invalid source row and are never skipped.
- [ ] Sink outage and exact-retry recovery do not block capture or mutate sink rows.
- [ ] Verification detects every required mismatch through a captured high-water mark.
- [ ] Search and detail are server-authorized, cursor-based, no-store, read-only, and audited.
- [ ] Sensitive context requires `audit.read_sensitive` and never appears in summaries.
- [ ] Authentication and authorization evidence tests remain green.
- [ ] Unit, integration, E2E, security, and accessibility suites pass.
- [ ] Coverage thresholds pass without excluding audit code.
- [ ] `pnpm validate` passes.
- [ ] Local Docker starts app plus worker and `https://fvdms.lan` passes the manual workflow.
- [ ] The verifier exits zero for pass and nonzero for tamper or infrastructure failure.
- [ ] README documents operations, failure modes, privilege boundaries, and deferred production work.
- [ ] Every acceptance criterion has automated or recorded manual evidence.

---

## OPEN QUESTIONS / ASSUMPTIONS

No blocking questions remain. The user accepted every planning-gate default on 2026-08-28.

- Confirmed: local development reuses the existing shared MySQL, Traefik, dnsmasq, `dev-net`, and `fvdms.lan` topology.
- Confirmed: primary and secondary audit schemas use separate credentials even when local development puts them on one host.
- Confirmed: application acknowledgment depends on primary outbox durability only. It does not depend on finalization, sink delivery, or verification.
- Confirmed: the chain is global and ordered by primary outbox source position.
- Confirmed: invalid captured data stops chain progress. It is never skipped, rewritten, or silently downgraded.
- Confirmed: auditor access is read-only from the user's perspective and produces `audit.accessed` evidence.
- Assumed: FVD-002 is merged or its current implementation is the starting state before FVD-003 implementation begins.
- Assumed: the `AUDITOR` seed role receives both audit permissions. `SUPER_ADMIN` receives both. `SYSTEM_ADMIN` receives `audit.read` only unless a binding role-matrix drift check says otherwise.
- Assumed: 65,536 canonical UTF-8 bytes is sufficient for event-specific snapshots. Larger evidence belongs in a separately governed artifact store referenced by public ID in a future ticket.
- Assumed: one global chain is acceptable at the projected volume. The locked-head transaction processes at most 100 rows and contains no network sink call.
- Assumed: audit outbox and chain rows remain indefinitely for this ticket. FVD-012 will define retention and archival without weakening evidence.
- Assumed: production places the sink on an independently controlled host or service through the same `AuditSink` port. FVD-011 owns that topology.
- Assumed: one completed verification record is inserted after computation. Operators use process logs for an in-progress run.
- Assumed: a failed `audit.read` authorization attempt records `auth.authorization.denied`, but it does not create `audit.accessed` because no audit data was read.
- Assumed: a nonexistent detail public ID does not create `audit.accessed`. The request remains in operational logs and may use a safe lookup-attempt event only if architecture review requires it.

---

## NOTES (open canvas)

### Why the outbox is separate from the chain

Business requests need short transactions and local durability. Canonicalization, global ordering, sink I/O, and full verification are not request-critical work.

The immutable outbox is the commit boundary. The worker can stop for maintenance or sink failure without creating an unaudited business change. Finalization later provides ordered integrity evidence without reopening the original transaction.

### Data flow

```text
authenticated request or command
  -> application use case validates business action and audit-safe event
  -> validate and RFC 8785-canonicalize an allowlisted event
  -> one Kysely transaction changes business rows and inserts exact canonical text into fvdms_audit.audit_outbox
  -> response may be acknowledged after commit

audit worker finalizer
  -> locks global chain head
  -> reads next immutable outbox batch
  -> validate stored canonical text + build versioned SHA-256 preimage from its exact bytes
  -> inserts immutable primary chain records and advances head

audit worker sink delivery
  -> reads due primary chain records without holding head lock
  -> insert-only AuditSink adapter with dedicated credential
  -> updates primary operational delivery state

verification command
  -> captures primary high-water mark
  -> recomputes primary chain through that mark
  -> compares append-only sink through that mark
  -> inserts one completed PASS or FAIL result
```

### Lock and privilege order

```text
business capture: business rows -> primary outbox insert -> commit
chain finalizer: singleton head FOR UPDATE -> ordered outbox read -> chain inserts -> head update -> commit
sink delivery: due delivery state -> sink insert -> primary delivery-state update
audit read: query rows -> audit.accessed outbox insert -> commit
```

Keep these orders stable. Future business modules should document their domain-row lock order before the final outbox insert.

### Why exact canonical text uses LONGTEXT

MySQL JSON normalizes values. Its documentation does not promise a stable key order across releases. Reconstructing a payload from MySQL JSON could therefore change the bytes that verification hashes.

The outbox stores the exact canonical text generated during synchronous capture. The chain copies those bytes unchanged. Searchable summary columns remain typed and indexed separately. The worker and verifier hash the stored text bytes directly.

### Why the sink permits conflicting evidence

An insert-only writer cannot repair an earlier row. Making primary sequence or event ID the only unique key would convert a conflicting retry into a permanent insert error without preserving the attempted mismatch.

The deterministic full-record fingerprint makes exact retries idempotent. A changed record receives another fingerprint and remains append-only evidence. Verification then classifies the duplicate or mismatch.

### Poison-event operations

A poison event means the synchronous capture boundary or database contents violated the contract. Skipping it would create a chain that falsely claims completeness.

The worker stops at the first invalid position and reports a safe reason code. Recovery requires an explicit incident decision outside this ticket. Normal code offers no edit or skip control.

### Performance and indexing

- Index outbox source position, public ID, occurrence time, action, actor public ID, entity type/public ID, and request ID for structured reads.
- Use the chain sequence as the cursor and integrity order. Return it as a string.
- Keep finalization and sink batches bounded. Keep the sink call outside the chain-head lock.
- Page verification reads. Do not load or parse the full history in memory.
- Avoid arbitrary JSON full-text search in this ticket. Typed summary columns keep queries predictable.
- Use a one-second idle poll by default. Later database-backed notifications or queues require evidence that polling is insufficient.

### UI decision record

The existing FVDMS master system overrides generic generator output. The audit trail is a restrained government operations screen. It uses light and dark semantic tokens, dense readable tables, mobile cards, visible filters, modest typography, low motion, and clear text-and-icon integrity status.

The page reveals enough summary information to scan evidence quickly. Sensitive network and snapshot context remains on an explicitly authorized detail page. Server Components own reads and permissions. Native GET forms and links cover most interaction.

### Confidence Score

**9/10** for one-pass implementation success.

The ticket, inherited architecture, accepted defaults, transaction seam, data contracts, canonical bytes, table ownership, account grants, worker ordering, sink retries, verification categories, query contract, UI rules, tests, and validation commands are explicit. The remaining risk is migration and privilege complexity across two schemas. The ordered bootstrap, migration, restricted-account, and rollback tests isolate that risk before HTTP or UI work.

## AMENDMENTS

<!-- Append changes after approval or execution. Leave this section otherwise empty. -->
