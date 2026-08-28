# Feature: Deliver authentication, sessions, RBAC, and privileged account security

The following plan is complete, but validate package compatibility, installed Next.js documentation, codebase patterns, and task sanity before implementation.

Pay special attention to secret handling, transaction boundaries, public identifiers, generic authentication failures, and the separation between optimistic route filtering and authoritative authorization.

## Feature Description

FVD-002 adds the system's complete identity and browser-security slice. It introduces users, roles, permissions, server-side sessions, login throttling, forced password changes, administrator-assisted recovery, privileged Time-based One-Time Password (TOTP) multi-factor authentication, session revocation, Cross-Site Request Forgery (CSRF) protection, and permission-controlled account administration.

The implementation remains application-owned. Framework code handles HTTP and cookies, infrastructure adapters handle Kysely, Argon2id, TOTP, and encryption, application use cases coordinate workflows, and the domain owns identity and authorization invariants.

The user-facing portion includes login, forced-password-change, TOTP enrollment and challenge, user administration, role administration, password reset, TOTP reset, and session revocation interfaces. These screens inherit the persisted FVDMS design system and use accessible shadcn/ui form and dialog patterns.

## User Story

As an authorized FVDMS user,
I want secure authentication and access based on my assigned permissions,
so that government operational data and privileged administration remain protected and accountable.

## Problem Statement

The FVD-001 foundation has no identity model, authentication state, or authorization boundary. Every later operational ticket depends on a stable principal, permission checks, protected HTTP seams, and reliable session invalidation.

The ticket also requires controls that simple stateless tokens do not satisfy well. Password, role, status, deletion, and TOTP changes must invalidate sessions immediately. Privileged accounts need stricter idle and concurrency limits. Login and TOTP attempts need durable throttling across processes and restarts.

## Solution Statement

Build app-owned authentication behind Clean Architecture ports. Store opaque session bearer-token hashes in MySQL and place the raw token only in a secure `__Host-` cookie. Store a session-bound synchronizer CSRF token hash beside each session. Apply exact-origin and Fetch Metadata checks as defense in depth.

Use Argon2id for passwords, OTPAuth for RFC 6238 TOTP, Node.js cryptography for random tokens, SHA-256 token hashing, HMAC rate-limit keys, constant-time comparison, and versioned AES-256-GCM encryption of TOTP secrets. Store login throttle state, authentication challenges, account-change evidence, and authentication security events durably in MySQL.

Seed the documented role and permission catalog. Derive effective permissions through active role assignments. Keep permission definitions code-owned and expose role-permission assignment through administration workflows. Mark `SUPER_ADMIN` and `SYSTEM_ADMIN` as privileged, while reserving privileged-role assignment and TOTP reset for explicit permissions.

## Out of Scope / Non-Goals

- Not included: public signup, public self-service password recovery, email delivery, social login, passwordless authentication, WebAuthn, security questions, or external identity providers.
- Not included: backup recovery codes. Lost TOTP access uses a permission-controlled administrator reset that revokes sessions and forces reenrollment.
- Not included: avatar upload or avatar storage. FVD-012 owns the hardened upload flow at `docs/tickets/fuel-and-vehicle-dispatch-system.md:400`.
- Not included: the durable immutable audit outbox, hash chain, secondary sink, verification job, or audit search. FVD-003 consumes the `SecurityEventPort` introduced here.
- Not included: fuel, dispatch, office, driver, vehicle, budget, report, offline, or audit-trail feature pages.
- Not included: production Compose, internal certificate-authority operations, backup, disaster recovery, or deployment hardening. FVD-011 owns those controls at `docs/tickets/fuel-and-vehicle-dispatch-system.md:364`.
- Not included: direct per-user permission overrides. A user's effective permissions come from active roles and active role-permission assignments.
- Not included: arbitrary creation of permission codes through the UI. Permission codes are application capabilities seeded by migrations; administrators assign them to roles.
- Not changing: the existing API success/error envelope, request-ID contract, `BIGINT` handling, UUIDv7 public-ID format, shared local MySQL, Traefik, dnsmasq, `dev-net`, or `https://fvdms.lan` development hostname.
- Not using: JSON Web Tokens as the browser authorization source, in-memory-only throttling, proxy-only authorization, plaintext session tokens in MySQL, or auth libraries that own the domain schema.

## Feature Metadata

**Feature Type**: New Capability

**Estimated Complexity**: High

**Primary Systems Affected**: User domain, authentication application services, RBAC policies, Kysely/MySQL persistence, Next.js Route Handlers and proxy, browser cookies, administration UI, structured logging, Docker configuration, Vitest, Playwright, and GitHub Actions

**Dependencies**: FVD-001; `argon2@0.45.1`; `otpauth@9.5.1`; `qrcode@1.5.4`; `@types/qrcode@1.5.6`; `react-hook-form@7.86.0`; `@hookform/resolvers@5.9.1`; shadcn/Radix form and dialog primitives; `@playwright/test@1.62.1`; `@axe-core/playwright@4.13.0`; existing Zod, Kysely, mysql2, Pino, UUID, Tailwind CSS, and Lucide dependencies

## Confirmed Ticket-Level Decisions

The user accepted all recommended defaults on 2026-08-28.

- Include complete user lifecycle administration: create, edit, activate, deactivate, soft-delete, restore, assign roles, reset passwords, reset TOTP, and revoke sessions.
- Include role management and role-permission assignment. Seed the seven architecture roles and the application permission catalog.
- Defer avatar upload to FVD-012.
- Keep authentication application-owned through existing Clean Architecture seams.
- Use opaque server-side MySQL sessions and session-bound synchronizer CSRF tokens.
- Mark `SUPER_ADMIN` and `SYSTEM_ADMIN` as privileged through an explicit `roles.is_privileged` field.
- Apply a 30-minute idle timeout to standard sessions and a 15-minute idle timeout to privileged sessions.
- Apply an eight-hour absolute session lifetime to every session.
- Allow at most one active privileged session per user.
- Lock a login bucket after five failures within 15 minutes for 15 minutes.
- Apply separate account and source-address buckets. Use HMAC-derived bucket keys rather than storing raw source addresses.
- Require passwords from 12 through 128 characters. Allow spaces and printable Unicode; do not add composition rules or periodic forced rotation.
- Require privileged TOTP enrollment on first eligible login and enforce it in every environment except isolated test seams.
- Use six-digit TOTP codes, 30-second periods, a one-step validation window, encrypted secrets, replay prevention, and separate challenge throttling.
- Omit backup codes. Provide permission-controlled administrator TOTP reset, revoke sessions, and force reenrollment.
- Generate a 24-character single-use temporary password for administrator-assisted reset. Show it once, store only its Argon2id hash, and force replacement before normal access.
- Create the first super administrator through an idempotent one-shot command that generates a temporary password. Never seed or accept a default password in source control.
- Add an append-only authentication security-event store and `SecurityEventPort`. FVD-003 will replace or bridge the adapter with its durable audit outbox and hash chain.
- Add Playwright and axe browser coverage for real cookie, authentication, authorization, form, and accessibility behavior.

## Related Work

**Implements**: FVD-002 in `docs/tickets/fuel-and-vehicle-dispatch-system.md:55`

**Epic**: `docs/PRD.md`

**Inherited architecture**: `docs/System_Architecture.md`

**Back-references**

- `.claude/plans/bootstrap-secure-application-foundation.md` - Establishes the Clean Architecture boundaries, Kysely/MySQL conventions, error envelope, request IDs, logging, Docker development topology, and UI governance used here.
- `.claude/reports/bootstrap-secure-application-foundation-report.md:7` - Confirms FVD-001 is complete and records the versions and validation state that FVD-002 must preserve.
- `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md` - Governs every FVD-002 page unless a reviewed page-specific override says otherwise.

**Forward-references**

- FVD-003 will implement durable immutable audit capture behind the `SecurityEventPort` introduced here.
- FVD-004 through FVD-010 will reuse the authenticated principal, permission guard, object-policy seam, user public identifiers, and protected-route wrapper.
- FVD-011 will replace development secrets and topology assumptions with production deployment controls.
- FVD-012 will add hardened avatar upload, privacy/retention controls, and final release assurance.

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING

#### Requirements and binding architecture

- `docs/tickets/fuel-and-vehicle-dispatch-system.md:3` - Defines the epic, slicing rules, UI skill requirement, and binding architecture source.
- `docs/tickets/fuel-and-vehicle-dispatch-system.md:55` - Contains the FVD-002 scope, acceptance criteria, seams, size estimate, and FVD-001 dependency.
- `docs/tickets/fuel-and-vehicle-dispatch-system.md:90` - Defines the durable audit subsystem intentionally deferred to FVD-003.
- `docs/tickets/fuel-and-vehicle-dispatch-system.md:364` - Defines the production deployment work deferred to FVD-011.
- `docs/tickets/fuel-and-vehicle-dispatch-system.md:400` - Defines avatar security and final assurance work deferred to FVD-012.
- `docs/PRD.md:111` - Defines the six operational personas and the super-administrator role.
- `docs/PRD.md:377` - Defines user fields and write-only password handling.
- `docs/PRD.md:561` - Requires secure authentication, authorization, least privilege, secure cookies, protected secrets, and maintainable boundaries.
- `docs/PRD.md:603` - Requires privileged TOTP, idle and absolute timeouts, session revocation, privileged-session limits, opaque identifiers, and CSRF protection.
- `docs/PRD.md:715` - Defines the protected API baseline and server-side authorization requirement.
- `docs/PRD.md:839` - Defines privilege-escalation and credential-theft threats and their mitigations.
- `docs/PRD.md:983` - Lists the non-negotiable engineering and security constraints.
- `docs/System_Architecture.md:56` - Limits controllers to authentication/authorization, validation, DTO conversion, use-case invocation, and response mapping.
- `docs/System_Architecture.md:69` - Defines the target user, auth, infrastructure, library, API, and page locations.
- `docs/System_Architecture.md:305` - Names the core identity and session tables and normalized relationships.
- `docs/System_Architecture.md:430` - Requires user soft deletion and role/permission deactivation rather than historical deletion.
- `docs/System_Architecture.md:555` - Lists authentication, authorization, password, role, and user events that require security evidence.
- `docs/System_Architecture.md:622` - Defines the binding authentication and RBAC controls.
- `docs/System_Architecture.md:682` - Defines `/api/auth/login`, `/api/auth/logout`, and `/api/me` as baseline endpoints.
- `docs/System_Architecture.md:772` - Defines the safe API envelope and forbids internal information leakage.
- `docs/System_Architecture.md:795` - Requires DTOs to remain separate from persistence entities.
- `docs/System_Architecture.md:820` - Requires application repository interfaces and infrastructure implementations.
- `docs/System_Architecture.md:948` - Defines error categories, request logging, and forbidden sensitive log fields.
- `docs/System_Architecture.md:986` - Requires login and privileged-endpoint limits, headers, secret controls, TOTP, CSRF, and object authorization.
- `docs/System_Architecture.md:1037` - Defines unit, integration, end-to-end, and security test responsibilities.
- `docs/System_Architecture.md:1210` - Locks the stack, Clean Architecture style, secure session, RBAC, and test approach.
- `docs/System_Architecture.md:1232` - Defines SEC-03, SEC-04, SEC-05, SEC-07, and SEC-10 release gates.

#### Existing application and infrastructure patterns

- `README.md:95` - Defines dependency direction and placement rules for domain, application, infrastructure, HTTP, and persistence code.
- `src/application/health/ports/health-check-repository.ts:1` - Minimal application-port pattern to mirror.
- `src/application/health/use-cases/get-health-status.ts:4` - Framework-free constructor injection and `execute()` use-case pattern.
- `src/application/shared/errors/application-error.ts:6` - Existing typed error family. Extend it with stable authentication, CSRF, throttle, and forced-flow errors.
- `src/application/shared/ports/logger.ts:1` - Logging port available to auth use cases without importing Pino.
- `src/domain/shared/errors/domain-error.ts:1` - Framework-free invariant-error pattern.
- `src/domain/shared/value-objects/public-id.ts:1` - Public-ID value object for every protected account, role, permission, session, challenge, reset, and event resource.
- `src/infrastructure/composition/root.ts:10` - Explicit composition-root contract. Extend it instead of importing concrete adapters from routes.
- `src/infrastructure/config/environment.ts:3` - Zod schema, defaults, typed mapping, and server-only secret checks.
- `src/infrastructure/database/client.ts:14` - Lossless `BIGINT` parsing, UTC connection, and Kysely client configuration.
- `src/infrastructure/database/types.ts:1` - Persistence-only Kysely table interfaces.
- `src/infrastructure/database/uuid-binary.ts:7` - Required UUID-to-`BINARY(16)` conversion helpers.
- `src/infrastructure/database/migrations/20260827_000001_create_application_metadata.ts:5` - Reversible migration pattern and shared identity/timestamp conventions.
- `src/infrastructure/database/migrator.ts:10` - Sortable migration discovery. Use the next timestamped migration name.
- `src/infrastructure/database/health/kysely-health-check-repository.ts:7` - Infrastructure adapter implementing an inward-facing port and mapping failures.
- `src/infrastructure/logging/pino-logger.ts:7` - Existing redaction list. It currently misses nested credential, CSRF, reset, session, and TOTP paths.
- `src/lib/http/api-response.ts:3` - Required success/error envelope and request-ID response header.
- `src/lib/http/request-id.ts:5` - Existing request-ID resolution.
- `src/lib/http/with-api-handler.ts:24` - Existing sanitized handler wrapper. Add a response-capable sibling for cookies and redirects instead of coupling this generic wrapper to auth.
- `src/app/api/health/route.ts:4` - Node runtime, force-dynamic, composition, no-store, and wrapper usage pattern.
- `src/proxy.ts:8` - Current request-ID proxy. Add cheap page routing only; never query MySQL or make authoritative authorization decisions here.
- `tests/unit/proxy.test.ts:9` - Installed Next proxy matcher helper and request-ID assertions.

#### UI and test patterns

- `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md:15` - Accessible, restrained, data-dense product direction and Server Component default.
- `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md:114` - Visible labels, local shadcn components, focus management, error association, and explicit states.
- `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md:136` - Required widths, zoom, keyboard, reduced-motion, and contrast checks.
- `src/app/globals.css:5` - Existing semantic light and dark tokens. Do not introduce raw page colors.
- `src/app/layout.tsx:19` - Metadata, fonts, language, skip link, and root shell.
- `src/components/ui/button.tsx:7` - shadcn variant and 44-pixel control pattern.
- `src/components/ui/card.tsx:5` - Existing content-container pattern for compact authentication panels.
- `components.json:1` - Requires shadcn `new-york`, React Server Components, CSS variables, aliases, and Lucide icons.
- `vitest.config.ts:11` - Node unit suite and 80-percent line, statement, function, and branch thresholds.
- `vitest.integration.config.ts:11` - Serial MySQL integration suite and Testcontainers setup.
- `tests/integration/helpers/mysql-container.ts:9` - Isolated `mysql:8.4.11` test environment.
- `tests/integration/database/migrations.test.ts:30` - Schema introspection pattern and an existing rollback assertion that must target the auth migration after this ticket.
- `tests/unit/lib/http/with-api-handler.test.ts:27` - Safe-envelope, request-ID, and secret-sanitization test style.
- `tests/unit/infrastructure/logging/pino-logger.test.ts:7` - Structured-log and redaction test style.
- `.github/workflows/ci.yml:15` - Existing single validation job. Add Chromium installation and end-to-end execution without weakening current checks.
- `pnpm-workspace.yaml:1` - Explicit native build allow-list. Add only `argon2`.
- `Dockerfile:1` - Node 24.19 Alpine development image. Verify the pinned Argon2 prebuilt binary before adding any compiler toolchain.
- `compose.yaml:10` - Add local authentication policy and generated development-only secret values to the existing application container.

### Mandatory Skill and Framework Reading Before Implementation

- `/Users/jsonse/.agents/skills/ui-ux-pro-max/SKILL.md` - Run the design-system query first, then focused authentication-form and Next.js/shadcn searches.
- `/Users/jsonse/.agents/skills/ui-styling/SKILL.md` - Governs accessible local shadcn/ui and Tailwind implementation.
- `/Users/jsonse/.agents/skills/ui-styling/references/shadcn-components.md` - Form, alert, dialog, table, badge, and feedback primitives.
- `/Users/jsonse/.agents/skills/ui-styling/references/shadcn-accessibility.md` - Labels, descriptions, live regions, focus movement, keyboard behavior, and dialog focus return.
- `/Users/jsonse/.agents/skills/ui-styling/references/tailwind-responsive.md` - Mobile-first breakpoints and required viewport checks.
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md:519` - Installed Next.js 16.3.3 session, database-session, authorization, proxy, Data Access Layer, Server Action, and Route Handler guidance.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md:28` - Installed asynchronous cookies API and mutation restrictions.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md:20` - Installed Route Handler methods, requests, cookies, headers, bodies, and redirects.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` - Installed proxy constraints and matcher behavior.
- `node_modules/next/dist/docs/01-app/02-guides/forms.md:129` - Installed validation, errors, and pending-state guidance.

### New Files to Create

The implementation agent may split a named file only when a unit becomes materially clearer. Keep each public class or use case in a focused file and preserve these module boundaries.

#### Domain

- `src/domain/user/entities/user.ts` - User lifecycle, status, forced-password-change, soft-delete, and MFA requirement invariants.
- `src/domain/user/entities/role.ts` - Role identity, code, active state, and privileged marker.
- `src/domain/user/entities/permission.ts` - Application-owned permission code and active-state invariant.
- `src/domain/user/entities/session.ts` - Idle, absolute-expiry, revocation, and bounded activity-update decisions.
- `src/domain/user/entities/totp-factor.ts` - Pending/enabled TOTP lifecycle and last-used-counter replay protection.
- `src/domain/user/value-objects/username.ts` - Lowercase normalization and 3–64-character username rules.
- `src/domain/user/value-objects/email-address.ts` - Normalization and email constraints.
- `src/domain/user/value-objects/password-policy.ts` - 12–128-character policy and username/email exclusion checks.
- `src/domain/user/value-objects/permission-code.ts` - Stable permission-code format.
- `src/domain/user/policies/session-policy.ts` - Standard versus privileged idle timeout and privileged concurrency rules.
- `src/domain/user/policies/authorization-policy.ts` - Permission and protected-target decision helpers.
- Matching `tests/unit/domain/user/**` files.

#### Application

- `src/application/auth/dto/authentication-dtos.ts` - Login, challenge, session, current-principal, password, TOTP, and flow response DTOs.
- `src/application/auth/dto/user-administration-dtos.ts` - User list/detail, create/update, reset, role assignment, and session DTOs.
- `src/application/auth/dto/role-administration-dtos.ts` - Role, permission-catalog, and assignment DTOs.
- `src/application/auth/ports/user-repository.ts`
- `src/application/auth/ports/role-repository.ts`
- `src/application/auth/ports/permission-repository.ts`
- `src/application/auth/ports/session-repository.ts`
- `src/application/auth/ports/authentication-challenge-repository.ts`
- `src/application/auth/ports/rate-limit-repository.ts`
- `src/application/auth/ports/totp-factor-repository.ts`
- `src/application/auth/ports/password-hasher.ts`
- `src/application/auth/ports/totp-service.ts`
- `src/application/auth/ports/secret-encryptor.ts`
- `src/application/auth/ports/secure-token-generator.ts`
- `src/application/auth/ports/auth-transaction.ts` - Application transaction contract for atomic security workflows.
- `src/application/auth/ports/security-event-port.ts` - Append-only event contract later implemented by FVD-003.
- `src/application/auth/services/authenticate-session.ts` - Authoritative session-to-principal resolution.
- `src/application/auth/services/authorize-permission.ts` - Permission guard used by routes and later application services.
- `src/application/auth/use-cases/login.ts`
- `src/application/auth/use-cases/complete-totp-challenge.ts`
- `src/application/auth/use-cases/start-totp-enrollment.ts`
- `src/application/auth/use-cases/confirm-totp-enrollment.ts`
- `src/application/auth/use-cases/change-password.ts`
- `src/application/auth/use-cases/logout.ts`
- `src/application/auth/use-cases/get-current-principal.ts`
- `src/application/auth/use-cases/list-users.ts`
- `src/application/auth/use-cases/get-user.ts`
- `src/application/auth/use-cases/create-user.ts`
- `src/application/auth/use-cases/update-user.ts`
- `src/application/auth/use-cases/soft-delete-user.ts`
- `src/application/auth/use-cases/restore-user.ts`
- `src/application/auth/use-cases/assign-user-roles.ts`
- `src/application/auth/use-cases/reset-user-password.ts`
- `src/application/auth/use-cases/reset-user-totp.ts`
- `src/application/auth/use-cases/revoke-user-sessions.ts`
- `src/application/auth/use-cases/list-roles.ts`
- `src/application/auth/use-cases/create-role.ts`
- `src/application/auth/use-cases/update-role.ts`
- `src/application/auth/use-cases/assign-role-permissions.ts`
- `src/application/auth/use-cases/create-initial-super-admin.ts`
- Matching `tests/unit/application/auth/**` files using fakes and a fake clock.

#### Infrastructure and persistence

- `src/infrastructure/database/migrations/20260828_000002_create_authentication_and_rbac.ts` - Reversible schema plus deterministic role/permission seeds.
- `src/infrastructure/database/auth/kysely-user-repository.ts`
- `src/infrastructure/database/auth/kysely-role-repository.ts`
- `src/infrastructure/database/auth/kysely-permission-repository.ts`
- `src/infrastructure/database/auth/kysely-session-repository.ts`
- `src/infrastructure/database/auth/kysely-authentication-challenge-repository.ts`
- `src/infrastructure/database/auth/kysely-rate-limit-repository.ts`
- `src/infrastructure/database/auth/kysely-totp-factor-repository.ts`
- `src/infrastructure/database/auth/kysely-auth-transaction.ts`
- `src/infrastructure/database/auth/kysely-security-event-store.ts`
- `src/infrastructure/auth/argon2-password-hasher.ts`
- `src/infrastructure/auth/otpauth-totp-service.ts`
- `src/infrastructure/auth/aes-gcm-secret-encryptor.ts`
- `src/infrastructure/auth/node-secure-token-generator.ts`
- `src/infrastructure/auth/hmac-rate-limit-key.ts`
- `src/infrastructure/auth/qrcode-generator.ts`
- `tests/integration/database/auth-migrations.test.ts`
- `tests/integration/auth/auth-repositories.test.ts`
- `tests/integration/auth/auth-workflows.test.ts`
- `tests/integration/auth/security-controls.test.ts`

#### HTTP, routes, and command line

- `src/lib/auth/cookies.ts` - Fixed `__Host-fvdms_session` and `__Host-fvdms_challenge` cookie helpers.
- `src/lib/auth/csrf.ts` - Session/challenge synchronizer-token extraction, hashing, constant-time validation, and origin checks.
- `src/lib/auth/authenticated-request.ts` - Authoritative session and optional permission guard for Route Handlers.
- `src/lib/http/with-response-handler.ts` - Safe response-capable wrapper that preserves envelopes, request IDs, no-store headers, and logging while allowing cookies and redirects.
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/challenge/route.ts`
- `src/app/api/auth/mfa/enroll/route.ts`
- `src/app/api/auth/mfa/confirm/route.ts`
- `src/app/api/auth/mfa/verify/route.ts`
- `src/app/api/auth/password/change/route.ts`
- `src/app/api/me/route.ts`
- `src/app/api/users/route.ts`
- `src/app/api/users/[userId]/route.ts`
- `src/app/api/users/[userId]/restore/route.ts`
- `src/app/api/users/[userId]/roles/route.ts`
- `src/app/api/users/[userId]/password-reset/route.ts`
- `src/app/api/users/[userId]/totp-reset/route.ts`
- `src/app/api/users/[userId]/sessions/revoke/route.ts`
- `src/app/api/roles/route.ts`
- `src/app/api/roles/[roleId]/route.ts`
- `src/app/api/roles/[roleId]/permissions/route.ts`
- `src/app/api/permissions/route.ts`
- `scripts/auth/create-initial-admin.ts`
- `scripts/auth/run.sh` - Container-aware command wrapper matching `scripts/database/run.sh`.
- Route, HTTP helper, proxy, and command tests under `tests/unit/app/api/**`, `tests/unit/lib/auth/**`, `tests/unit/lib/http/**`, and `tests/unit/scripts/auth/**`.

#### UI and design overrides

- `design-system/fuel-and-vehicle-dispatch-management-system/pages/login.md`
- `design-system/fuel-and-vehicle-dispatch-management-system/pages/mfa.md`
- `design-system/fuel-and-vehicle-dispatch-management-system/pages/user-management.md`
- `design-system/fuel-and-vehicle-dispatch-management-system/pages/role-management.md`
- `src/app/(auth)/layout.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/password-change/page.tsx`
- `src/app/(auth)/mfa/enroll/page.tsx`
- `src/app/(auth)/mfa/challenge/page.tsx`
- `src/app/(protected)/layout.tsx`
- `src/app/(protected)/account/page.tsx`
- `src/app/(protected)/admin/users/page.tsx`
- `src/app/(protected)/admin/users/[userId]/page.tsx`
- `src/app/(protected)/admin/roles/page.tsx`
- `src/app/(protected)/admin/roles/[roleId]/page.tsx`
- `src/components/forms/password-field.tsx`
- `src/components/forms/form-status.tsx`
- `src/components/forms/login-form.tsx`
- `src/components/forms/password-change-form.tsx`
- `src/components/forms/totp-challenge-form.tsx`
- `src/components/forms/totp-enrollment-form.tsx`
- `src/components/forms/user-form.tsx`
- `src/components/forms/role-permission-form.tsx`
- `src/components/auth/logout-button.tsx`
- `src/components/auth/session-expiry-notice.tsx`
- `src/components/admin/password-reset-dialog.tsx`
- `src/components/admin/totp-reset-dialog.tsx`
- `src/components/admin/revoke-sessions-dialog.tsx`
- shadcn primitives under `src/components/ui/`: `alert.tsx`, `alert-dialog.tsx`, `badge.tsx`, `input.tsx`, `label.tsx`, `table.tsx`, and the local form/field primitives required by the installed shadcn version.

#### Browser testing

- `playwright.config.ts`
- `tests/e2e/global-setup.ts` - Starts isolated MySQL, migrates/seeds it, launches Next on localhost, and returns cleanup for both processes.
- `tests/e2e/fixtures/auth.ts` - Creates standard and privileged users through application/persistence seams.
- `tests/e2e/fixtures/axe.ts` - Shared axe builder for WCAG A and AA tags.
- `tests/e2e/authentication.spec.ts`
- `tests/e2e/privileged-mfa.spec.ts`
- `tests/e2e/admin-user-security.spec.ts`
- `tests/e2e/accessibility.spec.ts`

### Existing Files to Update

- `package.json` - Pin dependencies and add `auth:create-initial-admin`, `test:e2e`, and the expanded `validate` script.
- `pnpm-lock.yaml` - Record the exact dependency graph.
- `pnpm-workspace.yaml` - Allow only the `argon2` native build script in addition to existing entries.
- `.env.example` - Document non-secret policy settings and placeholders for server-only encryption/HMAC keys.
- `compose.yaml` - Supply local-only authentication settings and development secrets without publishing new ports.
- `README.md` - Document initial-admin bootstrap, authentication settings, browser setup, and recovery operations.
- `src/infrastructure/config/environment.ts` - Parse auth policy, allowed origin, TOTP key version, 32-byte encryption key, and HMAC key only at runtime.
- `src/infrastructure/database/types.ts` - Add persistence-only table types. Do not leak them through application ports.
- `src/infrastructure/composition/root.ts` - Construct adapters once and expose use cases/services through the frozen composition.
- `src/infrastructure/logging/pino-logger.ts` - Add wildcard/nested redaction for passwords, hashes, cookies, bearer tokens, CSRF tokens, challenge tokens, temporary credentials, TOTP values, QR URIs, and encrypted-secret material.
- `src/application/shared/errors/application-error.ts` - Add stable generic credential, forced-flow, throttle, CSRF, and session-expiry errors without changing existing mappings.
- `src/proxy.ts` - Keep request-ID handling and add cookie-presence page redirects. Never query the database here.
- `src/app/page.tsx` - Replace the foundation status card with an auth-aware entry that routes unauthenticated users to login and authenticated users to their account or permitted administration page.
- `tests/integration/database/migrations.test.ts` - Stop assuming the first migration is the one rolled back. Assert rollback/reapply for the latest auth migration without deleting FVD-001 metadata.
- `vitest.config.ts` - Include any `.tsx` unit tests only if component tests are added; keep the 80-percent thresholds.
- `.github/workflows/ci.yml` - Install the pinned Chromium browser and run the isolated Playwright suite.

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING

Research was refreshed on 2026-08-28. Prefer these primary sources and the installed Next.js documentation over tutorials.

- [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication#session-management)
  - Specific sections: database sessions, authorization, optimistic proxy checks, Data Access Layer, Server Actions, and Route Handlers.
  - Why: Confirms database sessions suit advanced device/session controls and proxy is never the only authorization layer.
- [Next.js cookies API](https://nextjs.org/docs/app/api-reference/functions/cookies#options)
  - Specific sections: options, setting, and deletion.
  - Why: Cookie mutation must occur in a Server Function or Route Handler and include explicit security options.
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id)
  - Specific section: Argon2id.
  - Why: Use at least 19 MiB memory, two iterations, and parallelism one; benchmark upward without weakening this floor.
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#authentication-responses)
  - Specific sections: generic responses, login throttling, and account lockout.
  - Why: Prevent username/status enumeration and define account-bound attempt controls.
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#session-expiration)
  - Specific sections: cookie exchange, idle timeout, absolute timeout, invalidation, and caching.
  - Why: Enforce expiration server-side and return `Cache-Control: no-store` for authentication/session responses.
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#synchronizer-token-pattern)
  - Specific sections: synchronizer tokens, custom headers, SameSite, Origin/Referer checks, and Fetch Metadata.
  - Why: Stateful software should use synchronizer tokens and reject missing or mismatched tokens.
- [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238.html#section-5)
  - Specific sections: security considerations and validation.
  - Why: Defines TOTP, the 30-second default period, clock-window constraints, and replay concerns.
- [OTPAuth official repository](https://github.com/hectorm/otpauth#usage)
  - Specific section: Node.js TOTP generation and validation.
  - Why: Supports six digits, 30-second periods, at least 128-bit secrets, window one, counters, and enrollment URIs.
- [node-argon2 official repository](https://github.com/ranisalt/node-argon2#prebuilt-binaries)
  - Specific sections: Node support and Alpine prebuilt binaries.
  - Why: Validate `argon2@0.45.1` against Node 24.19 Alpine and Ubuntu CI before changing the Docker toolchain.
- [Node.js 24 crypto API](https://nodejs.org/docs/latest-v24.x/api/crypto.html)
  - Specific methods: `randomBytes`, `createHash`, `createHmac`, `createCipheriv`, `createDecipheriv`, and `timingSafeEqual`.
  - Why: Provides the server-only cryptographic primitives for tokens, HMAC bucket keys, AES-256-GCM, and comparisons.
- [MySQL 8.4 locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
  - Specific section: `SELECT ... FOR UPDATE`.
  - Why: Concurrent rate-limit increments, privileged-session caps, reset, and role/status changes need row locks inside transactions.
- [Kysely transaction API](https://kysely-org.github.io/kysely-apidoc/classes/Kysely.html#transaction)
  - Specific section: transaction callback behavior.
  - Why: Exceptions roll back the entire security workflow and transaction objects keep queries atomic.
- [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)
  - Specific sections: axe builder, WCAG tags, and manual-testing limitation.
  - Why: Automated scans supplement keyboard, zoom, contrast, focus, and screen-reader checks.
- [node-qrcode official repository](https://github.com/soldair/node-qrcode#server-api)
  - Specific method: server-side SVG `toString`.
  - Why: Generate an in-memory enrollment QR without writing the secret or image to disk.

### Patterns to Follow

**Application port and use-case pattern:**

```ts
export interface HealthCheckRepository {
  check(): Promise<void>;
}

export class GetHealthStatus {
  constructor(private readonly repository: HealthCheckRepository) {}

  async execute(): Promise<HealthStatusResponse> {
    await this.repository.check();
    return response;
  }
}
```

Mirror `src/application/health/ports/health-check-repository.ts:1` and `src/application/health/use-cases/get-health-status.ts:4`. Auth use cases accept ports, policies, a clock, and token services. They never import Next.js, Kysely, mysql2, Pino, Node environment globals, or concrete crypto packages.

**Infrastructure adapter pattern:**

```ts
export class KyselyHealthCheckRepository implements HealthCheckRepository {
  constructor(private readonly database: Kysely<Database>) {}

  async check(): Promise<void> {
    // Map database failures into application-safe errors.
  }
}
```

Mirror `src/infrastructure/database/health/kysely-health-check-repository.ts:7`. Kysely rows are mapped into domain values and DTOs before crossing an application port.

**Migration pattern:**

```ts
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable(tableName)
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull().unique())
    .execute();
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable(tableName).execute();
}
```

Mirror `src/infrastructure/database/migrations/20260827_000001_create_application_metadata.ts:5`. Drop foreign-key dependents before parents. Use deterministic seed public IDs so the role/permission catalog is repeatable.

**API wrapper pattern:**

```ts
const handler = withApiHandler(
  dependencies,
  async ({ request, requestId }) => {
    return useCase.execute(input, { requestId });
  },
  { headers: { 'Cache-Control': 'no-store' } },
);
```

Mirror `src/app/api/health/route.ts:7`. The auth-aware sibling may accept or return a full `Response`, but it must preserve the shared envelope, stable error normalization, request ID, completion log, and `Cache-Control: no-store` behavior.

**Error handling:**

- Use `AuthenticationError` for missing, malformed, unknown, revoked, idle-expired, or absolute-expired sessions.
- Add one generic invalid-credentials error and message for unknown username, wrong password, inactive user, deleted user, and account lockout where returning a distinct response would enumerate state.
- Use `AuthorizationError` for authenticated users without a permission or protected-target grant.
- Use a stable `CSRF_INVALID` 403 response for missing, malformed, cross-session, wrong-origin, or mismatched tokens.
- Use a stable `AUTH_RATE_LIMITED` 429 response for account, address, login-challenge, or TOTP throttling without naming the triggering bucket.
- Use a stable conflict response when a role/status/session state changes concurrently.
- Never place password hashes, submitted passwords, bearer tokens, raw source addresses, CSRF tokens, temporary credentials, TOTP codes, TOTP secrets, enrollment URIs, encryption keys, SQL, or stacks in public errors.

**Logging:**

- Emit event names such as `auth.login.succeeded`, `auth.login.failed`, `auth.session.revoked`, `auth.password.reset`, `auth.totp.enrolled`, `auth.totp.reset`, and `auth.authorization.denied`.
- Include only request ID, safe user public ID when known, actor public ID when authorized, event name, safe reason code, and status.
- Use the append-only security-event port for durable evidence. Use Pino for operational observability; one does not replace the other.
- Add wildcard redaction for nested paths such as `*.password`, `*.passwordHash`, `*.temporaryPassword`, `*.sessionToken`, `*.csrfToken`, `*.challengeToken`, `*.totpCode`, `*.totpSecret`, `*.otpauthUri`, `*.ciphertext`, `*.iv`, and `*.authTag`.

**UI design:**

- Keep auth pages compact and centered, with one primary action and a restrained security explanation.
- Keep administration pages dense and scan-friendly, using server-rendered tables, explicit filters, pagination, badges with text, and confirmation dialogs for destructive or security-sensitive actions.
- Keep pages as Server Components. Put pending state, password visibility, form submission, dialog state, and TOTP entry in leaf Client Components.
- Use visible labels, `aria-invalid`, `aria-describedby`, field-level errors, an error summary when multiple fields fail, and a polite or assertive live region as appropriate.
- Use autocomplete values `username`, `current-password`, `new-password`, and `one-time-code`.
- Focus the first invalid field or error summary after failure. Return dialog focus to its trigger.
- Show the TOTP QR with an accessible description and the manual secret as a selectable text fallback. Never rely on the image alone.
- Use only the existing semantic colors, Lexend/Source Sans 3, Lucide icons, six-pixel radius, one-pixel borders, and 44-pixel controls.
- Do not use gradients, oversized marketing text, decorative motion, color-only states, placeholder-only labels, or client-authoritative permission decisions.

---

## SECURITY AND CONTRACT DESIGN

### Session Contract

- Generate 32 random bytes and encode them as base64url for each bearer token.
- Store only `SHA-256(token)` in `user_sessions.token_hash BINARY(32)` with a unique index.
- Send the raw token only in `__Host-fvdms_session` with `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, no `Domain`, and an expiry no later than the eight-hour absolute lifetime.
- Record `created_at`, `last_seen_at`, `idle_expires_at`, `absolute_expires_at`, `revoked_at`, `revoke_reason`, and whether the session was created under a privileged role.
- Standard idle expiry is 30 minutes. Privileged idle expiry is 15 minutes. Absolute expiry is eight hours for both.
- Update activity at most once every five minutes. Recompute idle expiry from server time without extending absolute expiry.
- Revoke the database row and clear the cookie on logout. Expiry is enforced server-side even if the browser retains a cookie.
- Lock the user's session rows before enforcing the one-active-privileged-session limit and creating a new privileged session.
- Password, role, privileged-role, status, deletion, restoration, administrator reset, and TOTP reset changes revoke affected sessions inside the same transaction as the change.

### Challenge Contract

- Use a separate `authentication_challenges` table and `__Host-fvdms_challenge` cookie for password-verified but incomplete flows.
- Store only the challenge token hash and CSRF token hash.
- Challenge types are `PASSWORD_CHANGE`, `TOTP_ENROLLMENT`, and `TOTP_VERIFICATION`.
- Challenges expire after five minutes, have their own failed-attempt counter, are single-use, and are invalidated after successful completion or a terminal failure.
- A privileged user with no confirmed factor receives `TOTP_ENROLLMENT`. A privileged user with a confirmed factor receives `TOTP_VERIFICATION`. A user with `must_change_password` receives `PASSWORD_CHANGE` before either privileged flow.
- Normal application authorization is unavailable until all required challenge steps complete and a full user session is created.

### CSRF and Origin Contract

- Generate a separate 32-byte synchronizer token for each full session and authentication challenge.
- Store only its SHA-256 hash. Return the raw value in no-store JSON or render it into a no-store Server Component as a leaf-form prop.
- Submit the raw token through `X-CSRF-Token` for JSON mutations. Never put it in a cookie, URL, log, local storage, or cache.
- Require the token on logout, password change, TOTP enrollment/confirmation/verification, user changes, role changes, resets, restore/delete, and session revocation.
- Validate exact `Origin` against `AUTH_ALLOWED_ORIGIN`. If `Origin` is absent, require an exact target match through `Referer`; otherwise reject.
- Reject `Sec-Fetch-Site: cross-site` on every mutation. Reject unsupported simple content types on JSON APIs.
- Login has no authenticated session. It still requires exact-origin/Fetch Metadata checks, JSON content type, and no-store responses.

### Password and Login Contract

- Normalize username to lowercase before lookup and rate-limit bucketing.
- Require usernames of 3–64 lowercase letters, numbers, `.`, `_`, or `-` after normalization.
- Require unique normalized username and email columns. Preserve display values separately where needed.
- Require passwords of 12–128 characters, allow spaces and printable Unicode, reject a password containing the normalized username or email local part, and never silently truncate.
- Hash with Argon2id at a minimum of 19 MiB memory, two iterations, and parallelism one. Store the encoded hash string so parameters and salt remain available for verification and future rehash.
- Execute a dummy Argon2 verification for unknown usernames. Use the same public status, code, message, and broad timing path for unknown, wrong-password, inactive, deleted, and locked accounts.
- Maintain separate durable 15-minute account and source-address observation buckets. Derive bucket keys with HMAC-SHA-256 and a server-only key.
- Lock after the fifth failure for 15 minutes. Use row locking or atomic updates so concurrent failures cannot lose increments.
- Clear or rotate relevant account failure state after successful full authentication or administrator reset. Do not let an address-bucket success erase other-user abuse.

### TOTP Contract

- Generate a 20-byte random secret, use SHA-1 for authenticator interoperability, six digits, and a 30-second period.
- Accept only the current counter or one adjacent counter on either side. Validate input as exactly six decimal digits before calling OTPAuth.
- Record `last_used_counter` and reject reuse within the accepted window.
- Apply a separate five-attempt, 15-minute challenge limit and invalidate an exhausted challenge.
- Encrypt pending and active secrets with AES-256-GCM, a random 12-byte IV, a 16-byte authentication tag, key version, and Additional Authenticated Data containing the user public ID and factor public ID.
- Configure an active key version and a key map. Decrypt old versions and use the active version for new writes so later key rotation is possible.
- Generate QR SVG in memory from the enrollment URI. Return it and the manual secret only during enrollment through a no-store response. Never persist either representation.
- Administrator TOTP reset requires `user.totp.reset`, a reason, a different actor/target for non-super-admin actors, session revocation, factor invalidation, and an auth security event.

### Recovery and Initial Administrator Contract

- Administrator password reset requires `user.password.reset`, a target public ID, and a reason.
- Generate a 24-character cryptographically random temporary password with unambiguous printable characters.
- Return the temporary password once to the authorized administrator. Store only its Argon2id hash in `users.password_hash` and set `must_change_password`.
- Record actor ID, target ID, request ID, reason, and timestamp in `admin_password_resets` and `auth_security_events` in the same transaction.
- Revoke all target sessions and outstanding challenges atomically.
- The initial-admin command accepts non-secret identity fields, generates and prints the temporary password once, and uses the same use case and policies as administration.
- The command is idempotent: it refuses to create a second initial super administrator after one exists and never logs or writes the temporary password.

### RBAC Contract

Seed these roles with stable codes: `SUPER_ADMIN`, `SYSTEM_ADMIN`, `PSMD_STAFF`, `DISPATCH_OFFICER`, `BUDGET_OFFICER`, `VIEWER`, and `AUDITOR`.

Seed the architecture permission catalog and these authentication-specific codes:

```text
fuel.create                 fuel.read
fuel.post                   fuel.void
fuel.export                 dispatch.create
dispatch.read               dispatch.update
dispatch.complete           dispatch.cancel
office.manage               vehicle.manage
driver.manage               budget.manage
user.read                   user.manage
user.password.reset         user.totp.reset
user.session.revoke         role.read
role.manage                 role.assign_privileged
audit.read                  report.export
```

Initial least-privilege assignments:

| Role               | Initial assignment                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPER_ADMIN`      | Every permission. Only this role receives `role.assign_privileged` initially.                                                                     |
| `SYSTEM_ADMIN`     | User, role, session, office, vehicle, driver, and budget management, excluding `role.assign_privileged` and operational posting/void permissions. |
| `PSMD_STAFF`       | Fuel create/read/post/export. Do not grant void by default.                                                                                       |
| `DISPATCH_OFFICER` | Dispatch create/read/update/complete/cancel.                                                                                                      |
| `BUDGET_OFFICER`   | Budget management, fuel read, and report export.                                                                                                  |
| `VIEWER`           | Fuel read and dispatch read.                                                                                                                      |
| `AUDITOR`          | Fuel read, dispatch read, audit read, and report export.                                                                                          |

Additional rules:

- Permission codes are immutable application capabilities. Administrators can activate/deactivate roles, create custom roles, and assign active permission codes.
- Referenced roles and permissions are deactivated, not deleted.
- Only a principal with `role.assign_privileged` can create a privileged role, set `is_privileged`, or assign a privileged role.
- No actor may change their own roles, privileged marker, active status, deletion state, password through administrator reset, or TOTP factor through administrator reset. Self-service password change remains allowed.
- `SUPER_ADMIN` cannot be deactivated, deleted, or stripped of the last active holder. The application must preserve at least one active, enrolled super administrator.
- Authorization loads active user roles and active role permissions from MySQL. UI visibility is advisory; every use case and protected route checks the required permission.
- Object-level authorization receives the authenticated principal and target public ID. Sequential internal IDs never enter route contracts.

### API Contract

All responses use the existing `{ success, data|error, requestId }` envelope and `Cache-Control: no-store`. All identifiers below are UUIDv7 strings.

| Method and path                           | Authentication and permission                            | Contract summary                                                                                              |
| ----------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`                    | Public, exact origin, throttled                          | Accept username/password. Set challenge or full-session cookie. Return next flow and the relevant CSRF token. |
| `GET /api/auth/challenge`                 | Challenge cookie                                         | Return current challenge type and CSRF token after authoritative lookup.                                      |
| `POST /api/auth/password/change`          | Challenge or full session + CSRF                         | Replace password, revoke other sessions/challenges, clear forced flag, and continue the required flow.        |
| `POST /api/auth/mfa/enroll`               | Enrollment challenge + CSRF                              | Create encrypted pending factor and return QR SVG plus manual secret once.                                    |
| `POST /api/auth/mfa/confirm`              | Enrollment challenge + CSRF                              | Confirm code, activate factor, prevent replay, consume challenge, and create full session.                    |
| `POST /api/auth/mfa/verify`               | Verification challenge + CSRF                            | Verify code, prevent replay, consume challenge, and create full session.                                      |
| `POST /api/auth/logout`                   | Full session + CSRF                                      | Revoke current session, clear cookie, and return success.                                                     |
| `GET /api/me`                             | Full session                                             | Return current principal, active roles/permissions, password/MFA state, and CSRF token.                       |
| `GET /api/users`                          | `user.read`                                              | Paginated/filterable users with maximum page size 100.                                                        |
| `POST /api/users`                         | `user.manage`                                            | Create user with generated temporary password and selected roles. Return credential once.                     |
| `GET /api/users/:userId`                  | `user.read` + target policy                              | Return one user, effective roles, sessions, and security state without secrets.                               |
| `PATCH /api/users/:userId`                | `user.manage` + target policy + CSRF                     | Update identity or active status and revoke sessions when security state changes.                             |
| `DELETE /api/users/:userId`               | `user.manage` + target policy + CSRF                     | Soft-delete with mandatory reason and actor.                                                                  |
| `POST /api/users/:userId/restore`         | `user.manage` + target policy + CSRF                     | Restore inactive user without silently restoring prior sessions.                                              |
| `PUT /api/users/:userId/roles`            | `role.manage`; plus `role.assign_privileged` when needed | Replace role assignments atomically and revoke sessions.                                                      |
| `POST /api/users/:userId/password-reset`  | `user.password.reset` + target policy + CSRF             | Generate one-time temporary password, record actor/reason, and revoke sessions.                               |
| `POST /api/users/:userId/totp-reset`      | `user.totp.reset` + target policy + CSRF                 | Invalidate factor, record actor/reason, revoke sessions, and require reenrollment if privileged.              |
| `POST /api/users/:userId/sessions/revoke` | `user.session.revoke` + target policy + CSRF             | Revoke all target sessions or the specified public session.                                                   |
| `GET /api/roles`                          | `role.read`                                              | Paginated roles with active, privileged, and permission summary.                                              |
| `POST /api/roles`                         | `role.manage`; plus privileged permission when needed    | Create custom role with selected permissions.                                                                 |
| `PATCH /api/roles/:roleId`                | `role.manage`; plus privileged permission when needed    | Update name, active state, or privileged flag and revoke affected user sessions.                              |
| `PUT /api/roles/:roleId/permissions`      | `role.manage` + CSRF                                     | Replace active permission assignments and revoke affected sessions.                                           |
| `GET /api/permissions`                    | `role.read`                                              | Return the code-owned permission catalog for assignment UI.                                                   |

---

## IMPLEMENTATION PLAN

### Phase 1: Contract, dependencies, and design preparation

Pin the focused security and browser-test dependencies. Encode the accepted policy as typed runtime configuration. Create page-level design overrides before UI implementation.

**Tasks:**

- Update package scripts, lockfile, native-build allow-list, environment schema, examples, and Compose values.
- Run UI/UX Pro Max and UI Styling against login, TOTP, user-administration, and role-administration flows.
- Add page-specific overrides that inherit the master tokens and document only flow-specific layout/interaction decisions.

### Phase 2: Domain, schema, and adapters

**Depends on:** Phase 1 for dependency versions and typed policy values.

Create identity/session/MFA invariants, the reversible auth schema, stable seeds, application ports, Kysely repositories, cryptographic adapters, and an application-level transaction boundary.

**Tasks:**

- Implement domain values and policies with fake-clock unit tests.
- Create normalized MySQL identity, RBAC, session, challenge, throttle, TOTP, reset, and auth-event tables.
- Implement repositories and crypto adapters without leaking persistence or secret representations inward.
- Prove schema, constraints, rollback, encryption, hashing, and concurrency behavior against MySQL 8.4.11.

### Phase 3: Authentication and authorization workflows

**Depends on:** Phase 2 for ports, repositories, transactions, and security primitives.

Implement login, challenge progression, TOTP, password changes, session validation/revocation, CSRF, permission guards, account administration, role administration, and initial-super-admin creation.

**Tasks:**

- Implement generic credential failure and durable account/address throttling.
- Implement opaque sessions, bounded activity writes, expiry, concurrency, logout, and revocation.
- Implement password-change, TOTP enrollment/challenge/reset, replay prevention, and versioned secret encryption.
- Implement effective permission resolution and protected-target policies.
- Implement user/role management and append-only authentication security events within atomic transactions.

### Phase 4: HTTP and UI integration

**Depends on:** Phase 3 for complete use cases and authoritative guards.

Connect Next.js Route Handlers, cookies, proxy redirects, Server Component pages, leaf forms, administration tables, and security dialogs to the application composition.

**Tasks:**

- Add auth-aware response handling, cookie helpers, synchronizer CSRF validation, origin checks, and no-store behavior.
- Add public/challenge/protected API routes and exact permission guards.
- Add optimistic page redirects in proxy while preserving request IDs.
- Add responsive and accessible auth/account/admin pages using local shadcn components.

### Phase 5: Browser verification, CI, and operations

**Depends on:** Phase 4 for end-to-end flows.

Add isolated Playwright infrastructure, full security journeys, axe checks, initial-admin operations, documentation, and continuous-integration coverage.

**Tasks:**

- Start MySQL and Next through Playwright global setup with guaranteed cleanup.
- Cover standard login/logout, forced change, privileged enrollment/challenge, revocation, reset, and authorization denial.
- Verify cookie attributes, cache headers, keyboard flow, focus, live regions, zoom, widths, reduced motion, and axe results.
- Update CI and operational documentation, then run the full validation and live `fvdms.lan` smoke test.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order. Write or update the named test before its production behavior, then run the task validation before proceeding.

### 1. UPDATE dependency and script configuration

- **UPDATE**: `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`.
- **IMPLEMENT**: Pin the dependency versions in Feature Metadata. Add `test:e2e`, `auth:create-initial-admin`, and `auth:create-initial-admin:container` scripts. Add `test:e2e` to `validate` after integration tests and before the production build.
- **PATTERN**: `package.json:10` and `pnpm-workspace.yaml:1`.
- **GOTCHA**: Allow only `argon2` in `allowBuilds`. Do not permit broad dependency scripts. Verify `argon2@0.45.1` installs in Node 24.19 Alpine and Ubuntu before editing `Dockerfile`.
- **VALIDATE**: `pnpm install --frozen-lockfile && docker build --target development -t fvdms-auth-plan-check .`
- **SATISFIES**: AC #2, #5, #11, #15, and #16.

### 2. UPDATE typed authentication environment and local Docker settings

- **UPDATE**: `src/infrastructure/config/environment.ts`, `.env.example`, `compose.yaml`, and their unit tests.
- **IMPLEMENT**: Parse allowed origin, idle/absolute durations, privileged-session limit, rate-limit thresholds/windows, challenge expiry, activity-write interval, password bounds, active TOTP key version, versioned 32-byte AES key, and 32-byte rate-limit HMAC key.
- **PATTERN**: `src/infrastructure/config/environment.ts:15`, `:87`, and `:124`.
- **GOTCHA**: Runtime secrets must not be required by `parseBuildEnvironment()` or Next build. Reject malformed lengths and every `NEXT_PUBLIC_*` secret. Commit only development-only values in Compose and placeholders in `.env.example`.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/infrastructure/config/environment.test.ts && pnpm typecheck`
- **SATISFIES**: AC #2, #5, #6, #8, and #16.

### 3. CREATE page-specific UI design overrides

- **CREATE**: The four page files under `design-system/fuel-and-vehicle-dispatch-management-system/pages/` listed above.
- **IMPLEMENT**: Run UI/UX Pro Max `--design-system` first with the master dials `variance 3`, `motion 2`, and `density 8`. Run focused `nextjs`, `shadcn`, and authentication-form searches. Record only login/MFA/admin flow deviations; inherit colors, typography, spacing, icons, and forbidden patterns from `MASTER.md`.
- **PATTERN**: `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md:1` and mandatory UI skills listed above.
- **GOTCHA**: Discard marketing-page, oversized typography, orange palette, gradient, and GSAP suggestions that conflict with the persisted government-operations master. Do not overwrite `MASTER.md` without an explicit cross-product decision.
- **VALIDATE**: `pnpm exec prettier --check design-system/fuel-and-vehicle-dispatch-management-system/pages`
- **SATISFIES**: AC #12 and #15.

### 4. CREATE user, role, permission, session, and TOTP domain rules

- **CREATE**: `src/domain/user/**` and matching `tests/unit/domain/user/**` files listed above.
- **IMPLEMENT**: Encode normalization, password policy, active/deleted authentication eligibility, soft-delete history, privileged role marker, effective-permission inputs, session timeouts, revocation, bounded activity updates, TOTP factor states, and counter replay prevention.
- **PATTERN**: `src/domain/shared/value-objects/public-id.ts` and `src/domain/shared/errors/domain-error.ts:1`.
- **GOTCHA**: Use injected `Date`/clock values. Never call `Date.now()` inside deterministic domain policies. Password raw values must never become serializable entity properties.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/domain/user && pnpm typecheck`
- **SATISFIES**: AC #2, #4, #5, #6, #7, #8, and #10.

### 5. CREATE the reversible authentication and RBAC migration

- **CREATE**: `src/infrastructure/database/migrations/20260828_000002_create_authentication_and_rbac.ts` and `tests/integration/database/auth-migrations.test.ts`.
- **UPDATE**: `src/infrastructure/database/types.ts` and `tests/integration/database/migrations.test.ts`.
- **IMPLEMENT**: Create `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `user_sessions`, `authentication_challenges`, `login_rate_limits`, `user_totp_factors`, `admin_password_resets`, and `auth_security_events`.
- **IMPLEMENT**: Use unsigned internal `BIGINT`, unique UUIDv7 `BINARY(16)` public IDs, `DATETIME(6)` UTC timestamps, explicit foreign keys, composite uniqueness, check constraints where MySQL enforces them, and indexes matching every session, throttle, role, and user lookup.
- **IMPLEMENT**: Seed deterministic role/permission public IDs and the accepted initial matrix. Keep permission codes immutable and repeatable.
- **PATTERN**: `src/infrastructure/database/migrations/20260827_000001_create_application_metadata.ts:5`, `src/infrastructure/database/types.ts:6`, and `tests/integration/database/migrations.test.ts:30`.
- **GOTCHA**: Store token/CSRF/rate keys as `BINARY(32)`, not text. Store only encrypted TOTP material. Do not store a temporary password. Drop children before parents. Update the old rollback test so one `migrateDown()` removes only the auth migration and leaves `application_metadata` intact.
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/database/auth-migrations.test.ts tests/integration/database/migrations.test.ts`
- **SATISFIES**: AC #2, #4, #5, #6, #7, #8, #9, #10, #13, and #14.

### 6. CREATE application ports, DTOs, transaction contract, and security-event contract

- **CREATE**: `src/application/auth/dto/**`, `src/application/auth/ports/**`, and contract tests/fakes under `tests/unit/application/auth/support/**`.
- **IMPLEMENT**: Define secret-free DTOs, repository interfaces, password/TOTP/encryption/token ports, `AuthTransaction`, `SecurityEventPort`, clock dependency, and structured security-event types.
- **PATTERN**: `src/application/health/ports/health-check-repository.ts:1`, `src/application/health/use-cases/get-health-status.ts:4`, and `README.md:95`.
- **GOTCHA**: Ports may accept domain values and plain DTOs only. Do not expose Kysely transactions, database rows, `Buffer` ciphertext, cookie objects, raw tokens, or external-library types.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/auth && pnpm typecheck`
- **SATISFIES**: AC #1 through #14 and #16.

### 7. CREATE cryptographic and TOTP infrastructure adapters

- **CREATE**: `src/infrastructure/auth/**` and `tests/unit/infrastructure/auth/**` listed above.
- **IMPLEMENT**: Argon2id hashing/verification/rehash checks, 32-byte base64url tokens, SHA-256 token hashes, HMAC rate keys, versioned AES-256-GCM encrypt/decrypt, OTPAuth generation/validation/counter access, and in-memory QR SVG generation.
- **PATTERN**: Infrastructure adapter pattern at `src/infrastructure/database/health/kysely-health-check-repository.ts:7`.
- **GOTCHA**: Enforce the OWASP Argon2id floor. Validate exact six-digit TOTP input before OTPAuth. Authenticate ciphertext before returning plaintext. Never log inputs/outputs. Do not emit QR SVG with unsafe markup beyond the library-generated paths.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/infrastructure/auth && pnpm typecheck`
- **SATISFIES**: AC #2, #5, #8, #9, and #13.

### 8. CREATE Kysely authentication repositories and atomic transaction adapter

- **CREATE**: `src/infrastructure/database/auth/**` and `tests/integration/auth/auth-repositories.test.ts`.
- **IMPLEMENT**: Map every persistence row into domain/application values, implement normalized lookups, effective permissions, token-hash lookup, session activity/revocation, challenge consumption, rate bucket updates, TOTP state, reset evidence, and append-only security events.
- **IMPLEMENT**: Use a Kysely transaction callback behind `AuthTransaction`. Add `FOR UPDATE` or atomic updates for rate-limit increments, concurrent privileged sessions, reset, role/status changes, last-super-admin protection, and TOTP counter acceptance.
- **PATTERN**: `src/infrastructure/database/health/kysely-health-check-repository.ts:7`, `src/infrastructure/database/client.ts:14`, and MySQL locking-read documentation.
- **GOTCHA**: Use indexed unique search conditions for row locks. Modify tables in a consistent order to reduce deadlocks. Never return Kysely rows or internal IDs through ports.
- **VALIDATE**: `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/auth/auth-repositories.test.ts`
- **SATISFIES**: AC #1, #4, #5, #6, #7, #8, #9, #10, #13, and #14.

### 9. CREATE login throttling, challenge progression, and session use cases

- **CREATE**: Login, session, challenge, logout, and current-principal use cases/services plus unit tests listed above.
- **IMPLEMENT**: Generic failures, dummy hash verification, account/address buckets, forced-password flow, privileged challenge selection, opaque session creation, one-session privileged cap, bounded activity updates, expiry, logout, and principal resolution.
- **PATTERN**: Constructor-injected use cases at `src/application/health/use-cases/get-health-status.ts:4` and typed errors at `src/application/shared/errors/application-error.ts:19`.
- **GOTCHA**: Do not create a full session before all required password/TOTP steps complete. The same public failure must cover unknown, wrong, inactive, deleted, and locked accounts. Account and source-address counters are independent.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/auth/login.test.ts tests/unit/application/auth/authenticate-session.test.ts tests/unit/application/auth/logout.test.ts && pnpm typecheck`
- **SATISFIES**: AC #1, #6, #8, and #10.

### 10. CREATE password, TOTP, reset, and revocation use cases

- **CREATE**: Password-change, TOTP enrollment/confirmation/verification, password reset, TOTP reset, and session-revocation use cases plus unit tests.
- **IMPLEMENT**: One-time reset credentials, forced replacement, encrypted pending factor, confirmation before activation, window-one verification, counter replay protection, TOTP attempt limits, administrator reason/actor evidence, and atomic revocation.
- **PATTERN**: `AuthTransaction`, `SecurityEventPort`, and accepted recovery contract.
- **GOTCHA**: Enrollment QR/manual secret is returned once. Reset responses never appear in logs or general DTO serializers. Self-admin reset is forbidden. Privileged TOTP reset forces reenrollment.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/auth/change-password.test.ts tests/unit/application/auth/totp tests/unit/application/auth/reset-user-password.test.ts tests/unit/application/auth/reset-user-totp.test.ts`
- **SATISFIES**: AC #2, #5, #7, #9, #13, and #14.

### 11. CREATE RBAC and user/role administration use cases

- **CREATE**: Authorization services and user/role administration use cases plus unit tests listed above.
- **IMPLEMENT**: Effective permission resolution, exact permission guards, object-level target checks, pagination, user create/update/delete/restore, role replacement, custom role lifecycle, permission assignment, privileged-role restrictions, session revocation, and last-super-admin protection.
- **PATTERN**: `docs/System_Architecture.md:639`, `docs/PRD.md:841`, and public-ID value objects.
- **GOTCHA**: Route hiding is never authorization. No actor may mutate their own administrative security state. Permission records are code-owned. Role or permission changes take effect only after existing sessions are revoked.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/auth/authorize-permission.test.ts tests/unit/application/auth/user-administration tests/unit/application/auth/role-administration`
- **SATISFIES**: AC #4, #7, #9, #10, #12, and #14.

### 12. UPDATE application errors, composition, and logging redaction

- **UPDATE**: `src/application/shared/errors/application-error.ts`, `src/infrastructure/composition/root.ts`, `src/infrastructure/logging/pino-logger.ts`, and their tests.
- **IMPLEMENT**: Add stable auth error codes, compose shared adapter instances and use cases, and extend nested/wildcard redaction for every credential and secret representation.
- **PATTERN**: `src/infrastructure/composition/root.ts:10`, `src/lib/http/with-api-handler.ts:67`, and `src/infrastructure/logging/pino-logger.ts:7`.
- **GOTCHA**: Avoid rebuilding crypto/repository graphs independently in each route. Error logging may serialize causes, so secret-bearing custom errors must never keep submitted credentials in properties or causes.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/application/shared/application-error.test.ts tests/unit/infrastructure/composition/root.test.ts tests/unit/infrastructure/logging/pino-logger.test.ts`
- **SATISFIES**: AC #2, #3, #4, #8, #9, #11, and #14.

### 13. CREATE auth-aware HTTP helpers, cookies, CSRF, and origin validation

- **CREATE**: `src/lib/auth/**`, `src/lib/http/with-response-handler.ts`, and matching unit tests.
- **IMPLEMENT**: Fixed cookie attributes, session/challenge token extraction, synchronizer-token verification, exact-origin/Referer fallback, Fetch Metadata rejection, JSON content-type enforcement, full-Response handling, stable envelopes, no-store headers, request IDs, and response cookies.
- **PATTERN**: `src/lib/http/with-api-handler.ts:24`, `src/lib/http/api-response.ts:19`, and installed Next cookies/Route Handler docs.
- **GOTCHA**: Never weaken `withApiHandler` for existing routes. Cookie deletion must use the same name/path/protocol contract. Compare equal-length token hashes with `timingSafeEqual`. Safe methods never mutate state.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/lib/auth tests/unit/lib/http/with-response-handler.test.ts`
- **SATISFIES**: AC #1, #3, #4, #6, and #11.

### 14. CREATE public, challenge, user, role, and permission Route Handlers

- **CREATE**: Every Route Handler listed in New Files and matching route tests.
- **IMPLEMENT**: Zod request schemas, public IDs, exact use cases, cookies, CSRF/origin checks, permission guards, object policies, no-store responses, and the API contract table above.
- **PATTERN**: `src/app/api/health/route.ts:4` and `tests/unit/app/api/health-route.test.ts:17`.
- **GOTCHA**: Export `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`. Protected API failures return JSON 401/403, not redirects. Never accept internal numeric IDs or raw role names as proof of access.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/app/api/auth tests/unit/app/api/users tests/unit/app/api/roles tests/unit/app/api/me-route.test.ts`
- **SATISFIES**: AC #1, #3, #4, #5, #7, #8, #9, #10, #11, and #12.

### 15. UPDATE proxy routing and authenticated entry behavior

- **UPDATE**: `src/proxy.ts`, `src/app/page.tsx`, and `tests/unit/proxy.test.ts`.
- **IMPLEMENT**: Preserve request IDs. Redirect protected page requests without a session/challenge cookie to `/login`. Redirect logged-in users away from completed auth pages. Keep APIs out of redirect behavior so authoritative handlers return JSON errors.
- **PATTERN**: `src/proxy.ts:8`, installed Next auth guide `:1026`, and `tests/unit/proxy.test.ts:9`.
- **GOTCHA**: Proxy may inspect cookie presence only. Opaque cookies cannot prove validity or permission. Prevent loops among login, password change, TOTP enrollment/challenge, and protected destinations. Sanitize `returnTo` to same-origin relative paths.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/proxy.test.ts && pnpm build`
- **SATISFIES**: AC #1, #4, #5, and #10.

### 16. CREATE accessible authentication pages and leaf forms

- **CREATE**: Auth route-group pages, forms, required shadcn primitives, and focused tests listed above.
- **IMPLEMENT**: Login, forced password change, TOTP enrollment, and TOTP challenge with visible labels, autocomplete, password visibility, pending state, inline errors, live regions, first-error focus, manual TOTP secret fallback, and one clear primary action.
- **PATTERN**: Page overrides from Task 3, `src/app/page.tsx:13`, `src/components/ui/button.tsx:7`, and UI skill references.
- **GOTCHA**: Keep pages as Server Components and only forms as clients. Do not cache challenge or enrollment data. Do not expose raw secrets in analytics, logs, URLs, or persistent browser storage.
- **VALIDATE**: `pnpm lint && pnpm typecheck && pnpm build`
- **SATISFIES**: AC #1, #5, #13, and #15.

### 17. CREATE protected account, user, and role administration pages

- **CREATE**: Protected layout, account page, admin pages, forms, dialogs, and data-display primitives listed above.
- **IMPLEMENT**: Permission-aware navigation, paginated user table, explicit status/MFA/session badges, create/edit flows, role assignments, soft-delete/restore, password reset, TOTP reset, session revocation, role/permission editor, empty/error/denied states, and one-time credential presentation.
- **PATTERN**: `MASTER.md:114`, `MASTER.md:126`, shadcn AlertDialog accessibility, and route/use-case permission guards.
- **GOTCHA**: Server Components perform authoritative reads. Client visibility is usability only. Require reasons for delete/password/TOTP reset. Never place the returned temporary password in a toast that auto-dismisses; show a focused, non-recoverable one-time dialog with a copy action and explicit acknowledgment.
- **VALIDATE**: `pnpm lint && pnpm typecheck && pnpm build`
- **SATISFIES**: AC #4, #7, #9, #10, #12, and #15.

### 18. CREATE the initial-super-admin command

- **CREATE**: `scripts/auth/create-initial-admin.ts`, `scripts/auth/run.sh`, and unit/integration tests.
- **UPDATE**: `package.json` scripts and `README.md` command documentation.
- **IMPLEMENT**: Accept full name, normalized username, and email. Generate a temporary password, invoke the same application use case, assign `SUPER_ADMIN`, mark password change required, print the credential once to standard output, and emit no secret to logs.
- **PATTERN**: `scripts/database/run.sh`, `scripts/database/bootstrap.ts`, and composition/environment parsing.
- **GOTCHA**: Refuse to run when an initial super administrator already exists. Do not accept a password argument, store a default, print hashes, or include the credential in structured logs/shell tracing.
- **VALIDATE**: `pnpm exec vitest run --config vitest.config.ts tests/unit/scripts/auth && pnpm exec vitest run --config vitest.integration.config.ts tests/integration/auth/initial-admin.test.ts`
- **SATISFIES**: AC #2, #5, #9, #10, #13, and #14.

### 19. ADD the complete MySQL authentication security integration matrix

- **CREATE**: `tests/integration/auth/auth-workflows.test.ts` and `tests/integration/auth/security-controls.test.ts`.
- **IMPLEMENT**: Cover generic failures, dummy verification behavior, account/address buckets, concurrent failure increments, lock expiry, token hashing, cookie-independent session validation, idle/absolute expiry, bounded activity, privileged concurrency, challenge expiry, CSRF, exact origin, permissions, object targets, role escalation, reset evidence, session invalidation, TOTP replay, and atomic rollback.
- **PATTERN**: `tests/integration/api/health.test.ts:25`, `tests/integration/helpers/test-database.ts:21`, and serial integration configuration.
- **GOTCHA**: Use fake clocks where possible and real MySQL transactions where races matter. Never assert or snapshot live secret values. Add deliberate concurrent promises for throttle/session-cap tests.
- **VALIDATE**: `pnpm test:integration`
- **SATISFIES**: AC #1 through #14 and #16.

### 20. CREATE isolated Playwright and axe browser coverage

- **CREATE**: `playwright.config.ts`, `tests/e2e/global-setup.ts`, fixtures, and specs listed above.
- **IMPLEMENT**: Global setup starts MySQL 8.4.11, migrates/seeds, launches Next on `http://localhost:3100`, waits for health, and returns cleanup. Tests cover login/logout, forced change, TOTP enrollment/challenge, revoked access, administrator reset, role denial, secure cookie attributes, back-navigation after logout, keyboard flow, focus, live regions, and axe WCAG A/AA tags.
- **PATTERN**: Existing Testcontainers helper and Playwright official accessibility guidance.
- **GOTCHA**: Keep `Secure` and `__Host-` cookie behavior enabled on localhost. Never reuse the shared local database. Preserve test isolation and always stop the server/container after failure. Axe does not replace manual keyboard, zoom, contrast, or screen-reader checks.
- **VALIDATE**: `pnpm exec playwright install chromium && pnpm test:e2e -- --project=chromium`
- **SATISFIES**: AC #1, #3, #4, #5, #7, #9, #10, #11, #12, and #15.

### 21. UPDATE CI and developer documentation

- **UPDATE**: `.github/workflows/ci.yml`, `README.md`, `.env.example`, and `compose.yaml` documentation comments where appropriate.
- **IMPLEMENT**: Install Chromium with dependencies, run the isolated E2E suite, document auth environment generation, initial-admin bootstrap, local login at `https://fvdms.lan`, resets, TOTP recovery, browser installation, and security non-goals.
- **PATTERN**: `.github/workflows/ci.yml:15` and `README.md:17`.
- **GOTCHA**: Do not print secrets in CI. Keep the existing Node/pnpm pins. E2E owns an isolated MySQL container and must not require the shared `dev-net` database.
- **VALIDATE**: `pnpm format:check && pnpm lint && pnpm typecheck`
- **SATISFIES**: AC #13, #15, and #16.

### 22. RUN full automated and live validation

- **VALIDATE**: `pnpm validate`.
- **VALIDATE**: `pnpm dev:up`.
- **VALIDATE**: `curl --fail --silent --show-error https://fvdms.lan/api/health`.
- **VALIDATE**: Run the manual validation checklist below at `https://fvdms.lan`.
- **GOTCHA**: Validation is incomplete if only UI hiding is tested. Exercise direct API calls with missing/invalid sessions, public IDs, CSRF tokens, origins, and permissions.
- **SATISFIES**: Every acceptance criterion.

---

## TESTING STRATEGY

### Unit Tests

- Domain value objects: username/email normalization, password bounds, privileged marker, timeout selection, expiry, revocation, TOTP state, and replay counters.
- Application use cases: every success, denial, forced-flow branch, session-revocation trigger, last-super-admin rule, and actor/target restriction using fake repositories and a fake clock.
- Cryptography adapters: correct/incorrect Argon2 passwords, minimum parameters, rehash detection, token length, token hashes, HMAC determinism/separation, AES-GCM round trip/tamper/wrong-key behavior, TOTP window and replay logic, and QR output without persistence.
- HTTP helpers: cookie options, deletion, CSRF missing/malformed/mismatch/cross-session, origin/Referer/Fetch Metadata behavior, JSON type checks, safe error envelopes, no-store, and request IDs.
- Route handlers: schema validation, composition calls, permission requirements, cookies, stable status codes, and sanitized responses.
- Logging: nested redaction for every credential/secret field and safe auth-event contexts.

### Integration Tests

- Schema and repositories: exact columns/types/indexes/foreign keys/unique constraints, deterministic seeds, role matrix, soft deletion, deactivation, public IDs, rollback, and reapply.
- Password/login: unknown/wrong/inactive/deleted/locked equivalence, dummy verification, Argon2 hash storage, successful standard login, privileged challenge selection, and forced password flow.
- Throttling: account and source-address independence, exact threshold, expiry, concurrent increments, password spraying, distributed account attacks, TOTP limits, and generic 429 responses.
- Sessions: hash-only storage, missing/malformed/unknown/revoked/expired rejection, bounded activity, logout, one privileged session, atomic revocation on every security change, and no absolute-life extension.
- CSRF/origin: every mutation rejects missing, malformed, wrong-session, and wrong-origin tokens; valid same-session tokens succeed; tokens never enter URLs/logs/caches.
- RBAC: active relations only, authenticated-versus-forbidden distinction, direct route/use-case enforcement, public-ID targets, self-escalation denial, privileged assignment permission, and immediate revocation after permission changes.
- TOTP: at least 128-bit secret, encrypted at rest, pending-to-active transition, current/adjacent windows, malformed/expired/distant codes, replay rejection, throttling, and administrator reset.
- Reset/revocation: permission, target existence concealment, one-time credential, hash-only storage, actor/reason/request evidence, atomic revocation, forced change, credential non-reuse, and fresh login.
- Security-event bridge: append-only authentication event insertion in the same transaction and rollback when the business change fails.

### End-to-End and Accessibility Tests

- Standard login, logout, forced change, privileged enrollment, privileged recurring challenge, user creation, password reset, TOTP reset, session revocation, role denial, and protected navigation.
- Browser cookie properties: `__Host-`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, and no `Domain`.
- Protected content is unavailable after logout/revocation, including browser back navigation and direct URL entry.
- Labels, descriptions, autocomplete, error association, live announcements, first-error focus, dialog focus return, and keyboard-only completion.
- QR has an accessible description and manual secret fallback.
- Axe reports zero new WCAG A/AA violations on login, password, MFA, users, and roles pages.
- Manual widths: 375, 768, 1024, and 1440 pixels. Also test 200-percent zoom, reduced motion, light/dark contrast, and no viewport-level horizontal scroll.

### Edge Cases

- Username differs only by case or surrounding whitespace.
- Email differs only by case.
- Password is exactly 12 or 128 characters, over 128, contains spaces/Unicode, or contains username/email local part.
- Unknown username and deleted/inactive/locked user follow the same public response as a wrong password.
- Fifth failure locks exactly once under concurrency; attempts resume after server time passes the lock.
- Source-address spraying and distributed account attacks trigger separate buckets.
- Session expires idle before absolute, absolute before idle, or during an activity-update race.
- User becomes privileged while logged in; every session is revoked and next login requires enrollment/challenge.
- Privileged role is removed; sessions revoke and factor remains encrypted but no longer gates nonprivileged login.
- Two privileged logins race for the single allowed slot.
- Role permission changes while a request is in flight; the next authoritative check sees the new state.
- Actor tries to modify their own roles/status/deletion/password reset/TOTP reset.
- Operation would remove the last active super administrator.
- TOTP code is malformed, reused in the same counter, one step early/late, or outside the allowed window.
- Encryption key version is unknown, ciphertext/tag is modified, or Additional Authenticated Data targets another factor.
- CSRF token comes from another session/challenge, a cross-site origin, URL parameter, stale page, or missing header.
- Temporary password response is retried after success. The credential must not be recoverable from storage or logs.
- Soft-deleted user remains resolvable for reset/event history but cannot authenticate.
- Latest migration rollback leaves FVD-001 metadata intact and reapply restores deterministic seeds.

---

## VALIDATION COMMANDS

Execute every command. Do not report completion from partial checks.

### Level 1: Syntax and Style

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

Coverage must remain at or above 80 percent for statements, branches, functions, and lines. New security decisions should have direct branch coverage even when aggregate coverage already passes.

### Level 3: MySQL Integration Tests

```sh
pnpm test:integration
```

The suite must use isolated `mysql:8.4.11` Testcontainers and must not read or mutate shared local MySQL.

### Level 4: Browser Tests

```sh
pnpm exec playwright install chromium
pnpm test:e2e -- --project=chromium
```

### Level 5: Production Build and Full Gate

```sh
pnpm build
pnpm validate
```

### Level 6: Local Docker and Manual Security Validation

```sh
pnpm dev:up
pnpm auth:create-initial-admin:container -- --username initial.admin --full-name "Initial Administrator" --email admin@example.lan
curl --fail --silent --show-error https://fvdms.lan/api/health
docker compose ps
```

Manual checks:

1. Log in with the generated temporary password and confirm normal navigation is blocked until replacement.
2. Enroll the privileged TOTP factor through QR and manual secret. Confirm a reused code fails.
3. Log out and confirm protected pages and APIs reject the old session.
4. Create a standard user, assign a nonprivileged role, and confirm permitted and forbidden destinations.
5. Reset that user's password and confirm every prior session is invalid.
6. Promote a user to a privileged role and confirm prior sessions revoke and TOTP becomes mandatory.
7. Reset TOTP and confirm reenrollment is required.
8. Call every mutation without CSRF, with a wrong-session token, and with a foreign Origin. Confirm stable rejection.
9. Send protected resource calls with internal numeric IDs or another user's public ID. Confirm no object-level bypass.
10. Inspect response headers for no-store and request IDs. Inspect browser cookies for the exact contract.
11. Inspect logs and database rows to confirm submitted passwords, temporary credentials, raw bearer tokens, CSRF tokens, TOTP codes/secrets, QR URIs, and raw source addresses are absent.
12. Verify login, password, MFA, users, and roles pages at 375, 768, 1024, and 1440 pixels, 200-percent zoom, reduced motion, keyboard-only use, light/dark themes, and Web Content Accessibility Guidelines AA contrast.

---

## ACCEPTANCE CRITERIA

- [ ] **AC #1:** Users can log in and log out through secure opaque cookie-based database sessions.
- [ ] **AC #2:** Passwords use Argon2id at the documented minimum, never persist or travel as plaintext after input handling, and never appear in responses or logs except the one-time generated credential response.
- [ ] **AC #3:** Every state-changing cookie-authenticated route rejects missing, invalid, wrong-session, or wrong-origin CSRF requests.
- [ ] **AC #4:** Server-side permission and object-level checks protect pages, routes, use cases, and individual public-ID resources.
- [ ] **AC #5:** `SUPER_ADMIN` and `SYSTEM_ADMIN` users must enroll and pass TOTP before receiving a full session.
- [ ] **AC #6:** Standard 30-minute idle, privileged 15-minute idle, eight-hour absolute, and one-active-privileged-session policies are enforced server-side.
- [ ] **AC #7:** Password, role, privileged state, active status, deletion, administrator reset, and TOTP reset changes atomically revoke affected sessions.
- [ ] **AC #8:** Durable account and source-address throttles enforce five failures per 15 minutes and a 15-minute lock without lost concurrent increments or enumeration.
- [ ] **AC #9:** Administrator-assisted password reset works without email, generates a one-time credential, requires a reason, and records actor, target, request, and time.
- [ ] **AC #10:** Inactive or soft-deleted users cannot authenticate, while their identifiers remain resolvable for historical evidence.
- [ ] **AC #11:** Authorization bypass, privilege escalation, session invalidation, CSRF, rate-limit, replay, and secret-redaction tests pass.
- [ ] **AC #12:** Authorized administrators can manage users, roles, role-permission assignments, resets, status, deletion/restoration, and sessions through accessible pages and APIs.
- [ ] **AC #13:** A one-shot command creates the first super administrator without a stored/default password and forces password change plus TOTP enrollment.
- [ ] **AC #14:** Authentication and administration security events are appended through `SecurityEventPort`, with a MySQL bridge ready for FVD-003.
- [ ] **AC #15:** Authentication and administration pages follow the persisted design system and pass keyboard, focus, labels, responsive, zoom, contrast, reduced-motion, and axe checks.
- [ ] **AC #16:** Formatting, linting, type checking, unit coverage, MySQL integration, Playwright, production build, Docker health, and live `fvdms.lan` checks pass with no regression.

---

## COMPLETION CHECKLIST

- [ ] Every task completed in order with its focused validation passing immediately.
- [ ] Installed Next.js 16.3.3 docs were re-read before code changes.
- [ ] UI/UX Pro Max and UI Styling were invoked before UI decisions or implementation.
- [ ] Page overrides were created and checked before the master design system.
- [ ] All migrations apply, roll back one step, and reapply without losing FVD-001 data.
- [ ] No domain/application import depends on Next.js, Kysely, mysql2, Pino, Docker, or environment globals.
- [ ] Every session, challenge, throttle, reset, role/status, and security-event transaction is atomic.
- [ ] All protected contracts use public UUIDv7 identifiers and object checks.
- [ ] All state-changing cookie-authenticated endpoints share the CSRF/origin guard.
- [ ] Every secret representation is absent from logs, errors, caches, URLs, browser storage, and persisted plaintext.
- [ ] Unit, integration, E2E, security, and accessibility tests pass.
- [ ] All coverage thresholds pass without excluding auth code.
- [ ] `pnpm validate` passes.
- [ ] Local Docker starts cleanly and `https://fvdms.lan` passes the manual security workflow.
- [ ] README documents bootstrap, recovery, browser setup, policy values, and deferred work.
- [ ] Every acceptance criterion is checked with automated or recorded manual evidence.

---

## OPEN QUESTIONS / ASSUMPTIONS

No blocking questions remain. The user accepted every planning-gate default on 2026-08-28.

- Confirmed: full user/role/permission administration is in scope; avatar upload is deferred.
- Confirmed: app-owned Clean Architecture authentication, opaque MySQL sessions, and synchronizer CSRF are required.
- Confirmed: the role catalog, privileged roles, numeric session/throttle/password policies, MFA lifecycle, administrator recovery, audit bridge, and Playwright/axe dependencies use the values documented above.
- Assumed: the initial deployment's trusted `fvdms.lan` origin has no cross-site login or embedded-client requirement, so `SameSite=Strict` and exact-origin mutation checks are compatible.
- Assumed: permission definitions remain code-owned because an arbitrary database permission has no enforcement meaning unless application code checks it.
- Assumed: user email is required and unique even though recovery has no external-email dependency. Email remains administrative identity data only in this ticket.
- Assumed: restoring a user leaves the account inactive until an authorized administrator explicitly activates it and does not restore old sessions or challenges.
- Assumed: role removal does not delete an enrolled TOTP factor. It only removes the privileged login requirement; later privileged reassignment reuses the confirmed factor unless an administrator reset it.

---

## NOTES (open canvas)

### Why application-owned auth despite generic Next.js library guidance

The installed Next.js guide recommends an auth library for general security and simplicity. FVD-002 has unusually specific domain requirements: durable per-account and per-address throttling, forced first-use credentials, server-side revocation on multiple business changes, one privileged session, TOTP enrollment/replay state, admin recovery evidence, code-owned RBAC, public-ID target policies, and a future audit-port handoff.

An auth framework that owns users, sessions, or schema would create an adapter around another domain model. Focused libraries for password hashing and TOTP keep proven cryptography while preserving the architecture's application/domain ownership.

### Authorization flow

```text
Browser cookie
  -> optimistic proxy presence check for page navigation only
  -> route/server component extracts raw bearer token
  -> hash token and load active MySQL session
  -> enforce idle + absolute expiry and user status
  -> resolve active roles + active permissions
  -> create CurrentPrincipal DTO
  -> use case checks permission + target public ID
  -> repository performs the authorized operation in a transaction
```

### Authentication flow

```text
username + password
  -> origin/content checks
  -> durable account + source-address throttle checks
  -> generic user lookup and Argon2 verification path
  -> forced password challenge, if required
  -> TOTP enrollment/verification challenge, if privileged
  -> one full opaque database session
  -> session cookie + synchronizer CSRF token
```

### Audit bridge

FVD-002 must not lose security evidence while waiting for FVD-003. The MySQL `auth_security_events` table is append-only through application code and is written in the same transaction as sensitive account changes. It is not the final immutable audit design.

FVD-003 should implement a durable audit outbox adapter for the same `SecurityEventPort`, migrate or cross-reference existing auth events, add hash chaining and the independent sink, and preserve FVD-002 event public IDs for traceability.

### Performance and concurrency

- Hashing is intentionally expensive. Apply throttle checks before real verification but still execute a dummy verification for unknown usernames.
- Load session by unique token hash. Load permissions with indexed join columns and return a compact principal.
- Bound `last_seen_at` updates to once per five minutes to avoid a write on every request.
- Use short transactions and consistent lock order: user, rate/session rows, factor/reset data, security event.
- Do not cache authorization across requests. Permission/status changes rely on immediate database truth and session revocation.

### Confidence Score

**9/10** for one-pass implementation success.

The ticket, upstream architecture, accepted policy values, current code patterns, external security guidance, API contracts, table responsibilities, file map, tests, and validation commands are explicit. The remaining risk is execution size: this is a large security slice with native Argon2 installation, several atomic workflows, and browser orchestration. The ordered gates isolate those risks early.

## AMENDMENTS

<!-- Append changes after approval or execution. Leave this section otherwise empty. -->
