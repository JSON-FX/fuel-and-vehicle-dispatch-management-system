# Feature: Bootstrap the secure application and persistence foundation

The following plan is complete, but validate documentation, package compatibility, and task sanity before implementation.

Pay close attention to dependency direction, database type conversion, and the existing local Docker infrastructure.

## Feature Description

FVD-001 creates the first executable version of the Fuel and Vehicle Dispatch Management System. It establishes the Next.js modular monolith, Clean Architecture boundaries, MySQL access, reversible migrations, shared primitives, error handling, request tracing, structured logging, automated tests, and continuous integration.

Local development runs inside Docker. The application joins the existing `dev-net` network and uses the existing dnsmasq, Traefik, wildcard certificate, and shared MySQL services. Traefik exposes the application at `https://fvdms.lan` without publishing the application port to the host.

## User Story

As an implementation team member,
I want a secure and repeatable application foundation,
so that later fuel and dispatch features can be delivered without changing core conventions.

## Problem Statement

The repository contains product and architecture documents but no executable application. Later tickets need stable boundaries for domain code, application services, HTTP adapters, infrastructure adapters, persistence, observability, and tests.

The local machine already has shared Docker infrastructure. A separate proxy or DNS configuration would duplicate working services and create port conflicts.

## Solution Statement

Create a pinned Next.js 16 application using Node.js 24 Long-Term Support and pnpm. Use Kysely with `mysql2` behind infrastructure adapters and reversible migration scripts. Use UUIDv7 public identifiers, Decimal.js arithmetic, Zod validation, Pino logging, Vitest, MySQL Testcontainers, and GitHub Actions.

Initialize the presentation layer from the persisted FVDMS master design system. Use UI/UX Pro Max for design decisions and UI Styling for accessible shadcn/ui and Tailwind implementation. Keep the FVD-001 page deliberately small while establishing the tokens, typography, focus treatment, responsive behavior, and component conventions that later tickets inherit.

Create one project application container. Attach it to the external `dev-net` network. Use Traefik labels for `https://fvdms.lan`, dnsmasq for name resolution, and the existing shared `mysql` service for local persistence.

## Out of Scope / Non-Goals

- Not included: authentication, users, sessions, roles, permissions, or Cross-Site Request Forgery protection. These belong to FVD-002.
- Not included: immutable audit storage or audit workers. These belong to FVD-003.
- Not included: fuel, dispatch, office, vehicle, driver, budget, reporting, or offline domain tables.
- Not included: a dashboard shell, sidebar, navigation, or feature pages.
- Not included: production Docker Compose, an Ubuntu runbook, or a production reverse proxy. These belong to FVD-011.
- Not included: changing or upgrading the shared Traefik or MySQL containers.
- Not included: publishing the application or MySQL ports directly to the host.
- Not included: creating a remote GitHub repository or configuring repository secrets.
- Not changing: the existing dnsmasq rules, Traefik entrypoints, `dev-net`, or other projects using shared infrastructure.

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: High
**Primary Systems Affected**: Next.js application, shared domain and application layers, MySQL infrastructure, HTTP boundary, Docker development environment, testing, and GitHub Actions
**Dependencies**: Node.js 24 LTS, pnpm, Next.js 16, React 19, Kysely, mysql2, Zod, Pino, Decimal.js, uuid, Vitest, Testcontainers, Docker, shared Traefik, shared dnsmasq, and shared MySQL

## Confirmed Ticket-Level Decisions

- Use Kysely with `mysql2` and classic reversible `up` and `down` migrations.
- Use internal unsigned `BIGINT` keys and UUIDv7 public identifiers stored as `BINARY(16)`.
- Use pnpm, Node.js 24 LTS, strict TypeScript, ESLint, and Prettier.
- Use Zod for runtime validation, Pino for structured logging, and Decimal.js for financial arithmetic.
- Use Vitest, MySQL Testcontainers, and GitHub Actions.
- Initialize Tailwind CSS and shadcn/ui, but provide only a minimal root page.
- Govern UI decisions with UI/UX Pro Max and implement them through the UI Styling skill.
- Use the persisted FVDMS master design system as the default for every page without an override.
- Run local development in Docker and expose the application as `https://fvdms.lan`.
- Reuse the existing dnsmasq, Traefik, `dev-net`, certificate workflow, and shared MySQL container.

## Related Work

**Implements**: FVD-001 in `docs/tickets/fuel-and-vehicle-dispatch-system.md`
**Epic**: `docs/PRD.md`
**Inherited architecture**: `docs/System_Architecture.md`

**Back-references**

- `docs/tickets/fuel-and-vehicle-dispatch-system.md` - Defines the ticket scope, acceptance criteria, dependencies, and later delivery waves.
- `docs/System_Architecture.md` - Defines the stack, layer boundaries, repository pattern, error envelope, observability, and deployment direction.

**Forward-references**

- FVD-002 will add authentication, sessions, role-based access control, and privileged account security.
- FVD-003 will add durable immutable audit capture and verification.
- FVD-004 through FVD-010 will plug vertical feature modules into the foundation.
- FVD-011 will replace development-only operational assumptions with production deployment controls.

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: READ THESE FILES BEFORE IMPLEMENTING

- `docs/tickets/fuel-and-vehicle-dispatch-system.md:3` - Defines the epic summary and greenfield status.
- `docs/tickets/fuel-and-vehicle-dispatch-system.md:19` - Contains the complete FVD-001 scope and acceptance criteria.
- `docs/PRD.md:10` - Defines the product purpose, stack, and deployment setting.
- `docs/PRD.md:79` - Defines initial-release scope and explicit exclusions.
- `docs/PRD.md:585` - Requires Clean Architecture, data integrity, Docker, Transport Layer Security, opaque identifiers, and secret hygiene.
- `docs/PRD.md:715` - Defines the protected API baseline, request identifiers, validation, and sanitized errors.
- `docs/PRD.md:906` - Defines sensitive log redaction requirements.
- `docs/PRD.md:1011` - Maps technologies to architectural layers.
- `docs/System_Architecture.md:22` - Defines dependency direction and the responsibilities of each logical layer.
- `docs/System_Architecture.md:56` - Forbids business rules in controllers and database models.
- `docs/System_Architecture.md:69` - Defines the recommended repository structure.
- `docs/System_Architecture.md:267` - Requires decimal arithmetic for persisted financial values.
- `docs/System_Architecture.md:772` - Defines the API error envelope and information-leak restrictions.
- `docs/System_Architecture.md:795` - Separates data transfer objects from persistence entities.
- `docs/System_Architecture.md:820` - Requires repository interfaces and infrastructure implementations.
- `docs/System_Architecture.md:948` - Defines error categories, request logging fields, and forbidden log data.
- `docs/System_Architecture.md:1037` - Defines unit, integration, end-to-end, and security test responsibilities.
- `docs/System_Architecture.md:1210` - Summarizes binding architecture decisions.

### UI Design Governance IMPORTANT: USE THESE SKILLS BEFORE UI WORK

- `/Users/jsonse/.agents/skills/ui-ux-pro-max/SKILL.md` - Generates and queries the product design system. Start UI design work with `--design-system`, then use focused domain and stack searches when needed.
- `/Users/jsonse/.agents/skills/ui-styling/SKILL.md` - Governs accessible shadcn/ui and Tailwind implementation.
- `/Users/jsonse/.agents/skills/ui-styling/references/shadcn-theming.md` - Defines semantic tokens, CSS-variable theming, and dark-mode conventions.
- `/Users/jsonse/.agents/skills/ui-styling/references/shadcn-accessibility.md` - Defines focus, keyboard, labels, live regions, contrast, and reduced-motion rules.
- `/Users/jsonse/.agents/skills/ui-styling/references/tailwind-responsive.md` - Defines mobile-first responsive behavior and breakpoint checks.
- `/Users/jsonse/.agents/skills/ui-styling/references/tailwind-customization.md` - Defines Tailwind theme and semantic-token customization.
- `/Users/jsonse/.agents/skills/ui-styling/references/shadcn-components.md` - Defines approved shadcn/ui component patterns.
- `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md` - Persisted FVDMS design decisions. Check a sibling `pages/<page-name>.md` first because a page file may override the master.

For every later ticket that contains UI work, invoke both named skills before making design or implementation decisions. Record a page override only when that page has a justified exception. Do not copy an exception into the global master.

### Existing Local Infrastructure IMPORTANT: READ THESE FILES BEFORE IMPLEMENTING

- `/Users/jsonse/Documents/development/infra/README.md:1` - Explains the shared Traefik, dnsmasq, `dev-net`, and project routing model.
- `/Users/jsonse/Documents/development/infra/README.md:66` - Shows how a project joins `dev-net` and registers Traefik labels.
- `/Users/jsonse/Documents/development/infra/docker-compose.yml:1` - Defines the shared Traefik, Docker proxy, and MySQL services.
- `/Users/jsonse/Documents/development/infra/docker-compose.yml:49` - Documents the shared MySQL hostname and network rules.
- `/Users/jsonse/Documents/development/infra/traefik/traefik.yml:1` - Defines HTTP and HTTPS entrypoints and Docker discovery.
- `/Users/jsonse/Documents/development/infra/traefik/dynamic/tls.yml:1` - Defines the wildcard certificate used for `.lan` hosts.
- `/Users/jsonse/Documents/development/infra/certs/projects.txt:1` - Lists wildcard and literal certificate Subject Alternative Names.
- `/Users/jsonse/Documents/development/infra/certs/regen.sh:1` - Regenerates the wildcard certificate and supports literal hosts prefixed with `=`.
- `/Users/jsonse/Documents/development/debt-tracker/docker-compose.yml:13` - Provides a working example of `dev-net` and Traefik labels.

### Current Codebase State

- The repository has no application files, package manifest, test framework, or existing code conventions.
- The directory is not currently a Git repository.
- The project contains product and architecture documents, the ticket breakdown, this implementation plan, and the persisted master design system.
- The local machine currently runs Traefik on ports 80 and 443.
- dnsmasq resolves all `*.lan` names to `127.0.0.1` through `/etc/resolver/lan`.
- The shared `mysql` container is healthy on `dev-net` and does not publish its port to the host.
- The current wildcard certificate does not yet include the literal `fvdms.lan` Subject Alternative Name.

### New Files to Create

#### Project and tool configuration

- `package.json` - Pinned scripts, dependencies, package manager, and engine requirements.
- `pnpm-lock.yaml` - Reproducible dependency resolution.
- `tsconfig.json` - Strict TypeScript with `@/*` mapped to `src/*`.
- `next-env.d.ts` - Next.js TypeScript declarations.
- `next.config.ts` - Next.js configuration with standalone output.
- `eslint.config.mjs` - Next.js and TypeScript lint configuration.
- `prettier.config.mjs` - Formatting configuration.
- `.prettierignore` - Generated and dependency exclusions.
- `postcss.config.mjs` - Tailwind CSS PostCSS integration.
- `components.json` - shadcn/ui configuration.
- `.gitignore` - Secrets, dependencies, builds, coverage, and local artifacts.
- `.dockerignore` - Minimal Docker build context.
- `.env.example` - Safe variable names and documented local defaults.
- `README.md` - Setup, commands, architecture map, and troubleshooting.

#### Docker development environment

- `Dockerfile` - Node.js 24 development target and later reusable standalone build target.
- `compose.yaml` - FVDMS application service, external `dev-net`, health check, and Traefik labels.
- `scripts/dev/up.sh` - Starts the required shared infrastructure and the project container.
- `scripts/dev/down.sh` - Stops only the FVDMS project container.
- `scripts/dev/logs.sh` - Streams project logs.

#### Presentation and HTTP boundary

- `src/app/layout.tsx` - Minimal accessible root layout.
- `src/app/page.tsx` - Minimal foundation status page.
- `src/app/globals.css` - Tailwind CSS and shadcn/ui variables.
- `src/components/ui/button.tsx` - Local accessible shadcn/ui action primitive.
- `src/components/ui/card.tsx` - Local non-interactive shadcn/ui content container.
- `src/app/api/health/route.ts` - Database-aware readiness endpoint.
- `src/proxy.ts` - Request identifier propagation and request-received logging.
- `src/instrumentation.ts` - Node-runtime startup and uncaught request error logging.
- `src/lib/http/api-response.ts` - Success and error envelope types.
- `src/lib/http/with-api-handler.ts` - Route handler adapter and exception mapper.
- `src/lib/http/request-id.ts` - Incoming identifier validation and generation.

#### Shared domain and application layer

- `src/domain/shared/errors/domain-error.ts` - Framework-free domain error base.
- `src/domain/shared/value-objects/decimal-value.ts` - String-only Decimal.js wrapper.
- `src/domain/shared/value-objects/public-id.ts` - UUIDv7 public identifier value object.
- `src/application/shared/errors/application-error.ts` - Typed application error hierarchy.
- `src/application/shared/ports/logger.ts` - Logging interface used by application services.
- `src/application/shared/ports/public-id-generator.ts` - Public identifier generator interface.
- `src/application/health/ports/health-check-repository.ts` - Readiness persistence port.
- `src/application/health/use-cases/get-health-status.ts` - Framework-free readiness use case.
- `src/application/health/dto/health-status-response.ts` - Readiness result data transfer object.

#### Infrastructure and composition

- `src/infrastructure/config/environment.ts` - Zod-validated server environment.
- `src/infrastructure/database/types.ts` - Kysely database interface and persistence-only row types.
- `src/infrastructure/database/client.ts` - Singleton Kysely and mysql2 pool factory.
- `src/infrastructure/database/uuid-binary.ts` - UUID string and `BINARY(16)` conversion.
- `src/infrastructure/database/migrations/20260827_000001_create_application_metadata.ts` - Reversible baseline schema.
- `src/infrastructure/database/migrator.ts` - Programmatic Kysely migrator.
- `src/infrastructure/database/health/kysely-health-check-repository.ts` - Database readiness adapter.
- `src/infrastructure/identifiers/uuid-v7-generator.ts` - UUIDv7 generator adapter.
- `src/infrastructure/logging/pino-logger.ts` - Pino adapter with redaction.
- `src/infrastructure/composition/root.ts` - Dependency construction for route handlers.
- `scripts/database/bootstrap.ts` - Idempotent local database and principal bootstrap.
- `scripts/database/migrate.ts` - Applies pending migrations.
- `scripts/database/rollback.ts` - Reverts the most recent migration group.
- `scripts/database/status.ts` - Reports migration state.

#### Tests and continuous integration

- `vitest.config.ts` - Unit test configuration and coverage thresholds.
- `vitest.integration.config.ts` - Serial integration test configuration.
- `tests/unit/domain/shared/decimal-value.test.ts` - Decimal precision and validation tests.
- `tests/unit/domain/shared/public-id.test.ts` - UUIDv7 validation tests.
- `tests/unit/application/health/get-health-status.test.ts` - Health use-case tests.
- `tests/unit/lib/http/request-id.test.ts` - Request identifier behavior tests.
- `tests/unit/lib/http/with-api-handler.test.ts` - Error mapping and sanitization tests.
- `tests/unit/infrastructure/config/environment.test.ts` - Environment validation tests.
- `tests/unit/infrastructure/database/uuid-binary.test.ts` - Lossless binary identifier tests.
- `tests/integration/helpers/mysql-container.ts` - Pinned MySQL 8.4 Testcontainer lifecycle.
- `tests/integration/helpers/test-database.ts` - Migration and cleanup helpers.
- `tests/integration/database/migrations.test.ts` - Migration, rollback, metadata, and constraints tests.
- `tests/integration/api/health.test.ts` - Database-ready and database-unavailable endpoint tests.
- `.github/workflows/ci.yml` - Install, static checks, tests, coverage, and build.

### Existing Files to Update Outside This Repository

- `/Users/jsonse/Documents/development/infra/certs/projects.txt` - Add `=fvdms.lan` once.
- `/Users/jsonse/Documents/development/infra/certs/lan.crt` - Regenerated by the existing certificate script.
- `/Users/jsonse/Documents/development/infra/certs/lan.key` - Regenerated by the existing certificate script.

Do not edit dnsmasq or Traefik configuration. Their wildcard DNS and Docker provider already support this project.

### Relevant Documentation YOU SHOULD READ BEFORE IMPLEMENTING

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
  - Specific section: system requirements and manual installation.
  - Why: Confirms App Router, TypeScript, Tailwind CSS, `src`, and Node.js requirements.
- [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
  - Specific section: runtime and setting request and response headers.
  - Why: Required for request identifier propagation in Next.js 16.
- [Next.js instrumentation](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)
  - Specific section: `register` and `onRequestError`.
  - Why: Provides startup and uncaught request error observability.
- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
  - Specific section: automatically copying traced files.
  - Why: Keeps the Dockerfile reusable for the later production ticket.
- [Kysely getting started](https://www.kysely.dev/docs/getting-started)
  - Specific section: strict TypeScript, MySQL dialect, singleton lifecycle, and runtime types.
  - Why: Defines the `mysql2` adapter and type-boundary constraints.
- [Kysely migrations](https://www.kysely.dev/docs/migrations)
  - Specific section: `up`, `down`, frozen migrations, and execution order.
  - Why: Required for reversible and deterministic schema changes.
- [Zod basics](https://zod.dev/basics)
  - Specific section: parsing and safe parsing.
  - Why: Used for environment and boundary validation.
- [Pino redaction](https://github.com/pinojs/pino/blob/main/docs/redaction.md)
  - Specific section: redaction paths and safety.
  - Why: Prevents secrets and sensitive headers from entering structured logs.
- [Decimal.js API](https://mikemcl.github.io/decimal.js/)
  - Specific section: constructor, configuration, multiplication, and string conversion.
  - Why: Prevents binary floating-point errors in future financial workflows.
- [uuid JavaScript module](https://uuidjs.com/)
  - Specific section: UUIDv7, parse, stringify, validate, and version.
  - Why: Generates public identifiers and converts them to database bytes.
- [Vitest coverage](https://vitest.dev/config/coverage)
  - Specific section: V8 provider, include patterns, and thresholds.
  - Why: Ensures uncovered foundation code is counted.
- [Testcontainers MySQL module](https://node.testcontainers.org/modules/mysql/)
  - Specific section: version-pinned container and mysql2 connection.
  - Why: Runs integration tests against a real MySQL server.
- [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/)
  - Specific section: health checks and `service_healthy`.
  - Why: Clarifies why shared infrastructure readiness must be checked explicitly.
- [GitHub Actions Node.js workflow](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
  - Specific section: pnpm caching and build/test commands.
  - Why: Provides the continuous integration baseline.
- [Tailwind CSS with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
  - Specific section: PostCSS and global import.
  - Why: Initializes the presentation stack without building feature UI.
- [shadcn/ui with Next.js](https://ui.shadcn.com/docs/installation/next)
  - Specific section: existing project with a `src` directory.
  - Why: Creates the component configuration that later UI tickets inherit.

### Dependency Baseline

Use exact versions in `package.json` and commit the lockfile. Recheck current compatible patch versions before implementation.

- Node.js `24.20.0` LTS in the Dockerfile and GitHub Actions.
- pnpm `11.24.0` in `packageManager`.
- Next.js `16.3.3`.
- React and React DOM `19.2.8`.
- TypeScript `5.9.3`. Do not adopt TypeScript 7 in this foundation ticket.
- Kysely `0.29.5` and mysql2 `3.24.2`.
- Zod `4.4.3`.
- Pino `10.3.1`.
- Decimal.js `10.6.0`.
- uuid `14.0.2` using ECMAScript modules.
- Vitest and `@vitest/coverage-v8` `4.1.11`.
- `@testcontainers/mysql` `12.1.0`.
- ESLint `10.9.1` with `eslint-config-next` `16.3.3`.
- Prettier `3.9.6`.
- Integration database image `mysql:8.4.11`.

### Patterns to Follow

**Dependency direction**

```text
src/app and src/lib/http
        ↓
src/application
        ↓
src/domain

src/infrastructure implements application ports.
src/infrastructure/composition/root.ts wires adapters to use cases.
```

Domain and application code must not import `next`, `mysql2`, Kysely adapters, Pino, Docker concerns, or environment globals.

**Naming conventions**

- Use kebab-case filenames.
- Use PascalCase for classes, value objects, commands, and data transfer object types.
- Use camelCase for functions and variables.
- Use snake_case only for MySQL table and column names.
- Suffix interfaces by their role, such as `HealthCheckRepository` or `PublicIdGenerator`.
- Suffix concrete adapters by technology, such as `KyselyHealthCheckRepository` and `PinoLogger`.
- Prefix migrations with sortable UTC timestamps.

**Public identifiers**

- Use an auto-incrementing unsigned `BIGINT` as the internal persistence key.
- Use UUIDv7 as the only identifier exposed through future APIs.
- Store public identifiers as `BINARY(16)` with a unique constraint.
- Convert UUID strings to bytes in infrastructure only.
- Configure mysql2 to return `BIGINT` and `DECIMAL` values as strings.
- Convert internal identifier strings to JavaScript `bigint` only at repository boundaries.

**Decimal arithmetic**

- Accept decimal input as strings only.
- Reject JavaScript `number` inputs in the reusable value object.
- Keep Decimal.js behind `DecimalValue` methods.
- Serialize to canonical decimal strings.
- Never call `toNumber()` for persisted money or quantities.

**API success envelope**

```json
{
  "success": true,
  "data": {},
  "requestId": "019..."
}
```

**API error envelope**

```json
{
  "success": false,
  "error": {
    "code": "DEPENDENCY_UNAVAILABLE",
    "message": "A required service is unavailable.",
    "details": []
  },
  "requestId": "019..."
}
```

- Map known typed errors to stable HTTP status codes.
- Map validation errors to `400`.
- Map unavailable dependencies to `503`.
- Map unknown errors to `500` with `INTERNAL_ERROR`.
- Log the original server error once with the request identifier.
- Never include SQL, stack traces, credentials, or raw driver messages in responses.

**Request identifiers**

- Accept an incoming `x-request-id` only when it is a valid UUID.
- Generate a new UUID when the header is absent or invalid.
- Put the identifier into the upstream request headers and outgoing response headers.
- Include the identifier in every API envelope and structured log entry.
- Exclude static Next.js assets from application request logging.

**Structured logging**

- Emit newline-delimited JSON to standard output.
- Use child loggers for `requestId`, route, and operation context.
- Redact authorization, cookies, passwords, tokens, database URLs, and secret fields.
- Log a request-received event in `src/proxy.ts`.
- Log API completion, duration, outcome, and error code in `withApiHandler`.
- Use `src/instrumentation.ts` for startup and uncaught request errors.

**Database lifecycle**

- Keep one Kysely instance per process and dispose it during scripts and tests.
- Use a separate migration pool from the runtime application pool.
- Keep migration files independent from current application modules.
- Use Kysely's default migration metadata tables.
- Keep `allowUnorderedMigrations` disabled for deterministic ordering.
- Implement `db:migrate`, `db:rollback`, and `db:migrate:status` as non-interactive scripts.

**Baseline schema**

Create only `application_metadata` in the first migration. It proves the identity and timestamp pattern without introducing a business aggregate.

```text
application_metadata
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
  public_id BINARY(16) NOT NULL UNIQUE
  metadata_key VARCHAR(100) NOT NULL UNIQUE
  metadata_value JSON NULL
  created_at DATETIME(6) NOT NULL
  updated_at DATETIME(6) NOT NULL
```

Do not use this table as a general dumping ground. Later tickets should create their own normalized domain tables.

**Health contract**

- `GET /api/health` is a readiness check, not a liveness-only check.
- Return `200` with `status: "ok"` when the database responds to `SELECT 1`.
- Return `503` with `DEPENDENCY_UNAVAILABLE` when MySQL is unavailable.
- Include no database host, schema, driver, SQL, or credential details.
- Set `Cache-Control: no-store`.
- Use the same endpoint for the application container health check.

**Local Docker and routing**

- Define only the FVDMS application service in `compose.yaml`.
- Attach it to the external `dev-net` network.
- Reach shared MySQL at hostname `mysql` on port `3306`.
- Do not publish application or database ports.
- Add the Traefik host rule for `fvdms.lan`, `websecure`, TLS, and internal port `3000`.
- Add `=fvdms.lan` to the shared certificate Subject Alternative Name list.
- Use the existing `regen.sh` to refresh the trusted certificate.
- Do not add another Traefik, dnsmasq, or MySQL service to the project Compose file.
- Start shared `traefik` and `mysql` services from `scripts/dev/up.sh` before starting FVDMS.
- Stop only the project container from `scripts/dev/down.sh`.

---

## IMPLEMENTATION PLAN

### Phase 1: Project and runtime foundation

Initialize version control, package management, Next.js, TypeScript, linting, formatting, Tailwind CSS, and shadcn/ui. Pin the approved runtime and library versions.

**Tasks:**

- Initialize Git on `main` without adding a remote.
- Create the package and tool configuration files.
- Create the minimal App Router layout and root page from the persisted master design system.
- Generate and commit the pnpm lockfile.

### Phase 2: Shared architectural primitives

**Depends on:** Phase 1.

Create the framework-free error, identifier, decimal, logging, and health ports. Add infrastructure adapters without leaking them into domain or application code.

**Tasks:**

- Create typed domain and application errors.
- Create UUIDv7 and decimal value objects.
- Create application ports and the health use case.
- Create Zod environment validation, Pino logging, and UUID adapters.

### Phase 3: Persistence and migration foundation

**Depends on:** Phase 2 for identifier contracts and typed errors.

Add Kysely, mysql2, local principal bootstrap, reversible migrations, the baseline metadata table, and a database health adapter.

**Tasks:**

- Configure runtime, migration, and administrative database connections.
- Add lossless `BIGINT`, `DECIMAL`, and UUID binary handling.
- Add the reversible baseline migration and migration commands.
- Add a bounded, idempotent local database bootstrap.

### Phase 4: HTTP, observability, and composition

**Depends on:** Phases 2 and 3.

Wire adapters into use cases. Add request identifiers, stable response envelopes, exception mapping, structured request logs, instrumentation, and the readiness endpoint.

**Tasks:**

- Create the composition root.
- Create request and response boundary helpers.
- Add Next.js Proxy and instrumentation.
- Add the database-aware health endpoint.

### Phase 5: Containerized local development

**Depends on:** Phase 4 because the container health check calls the readiness endpoint.

Build the project development container and integrate it with the established shared infrastructure.

**Tasks:**

- Create the Dockerfile and project Compose file.
- Add the literal `fvdms.lan` certificate name and regenerate the certificate.
- Add start, stop, and log scripts.
- Verify HTTPS routing through Traefik and MySQL access through `dev-net`.

### Phase 6: Automated tests and continuous integration

**Depends on:** Phases 1 through 5.

Add unit and real-MySQL integration tests. Add GitHub Actions checks that use the same pinned Node.js and dependency versions.

**Tasks:**

- Add Vitest unit and integration configurations.
- Add coverage thresholds and explicit include patterns.
- Add MySQL Testcontainers helpers and migration tests.
- Add health endpoint tests for successful and failed dependencies.
- Add the GitHub Actions workflow.

### Phase 7: Documentation and acceptance validation

**Depends on:** Phase 6.

Document setup, commands, boundaries, troubleshooting, and deferred work. Run the complete acceptance suite and capture any deviations in the plan amendments.

---

## STEP-BY-STEP TASKS

Execute every task in order. Each task should leave the repository in a testable state.

### Task 1: CREATE the Git and package foundation

- **IMPLEMENT**: Initialize Git with `git init -b main` because this directory has no repository metadata.
- **IMPLEMENT**: Create `package.json` with exact approved versions, `packageManager: "pnpm@11.24.0"`, and `engines.node: ">=24 <25"`.
- **IMPLEMENT**: Add scripts for development, build, start, lint, formatting, type checking, unit tests, integration tests, coverage, migrations, and Docker helpers.
- **IMPLEMENT**: Create `.gitignore`, `.dockerignore`, `.prettierignore`, and safe environment templates.
- **PATTERN**: Follow `docs/System_Architecture.md:69` for the `src` layout.
- **GOTCHA**: Preserve every existing document. Do not scaffold into a temporary directory and overwrite `docs`.
- **GOTCHA**: Do not commit `.env`, certificates, private keys, coverage output, `.next`, or database data.
- **VALIDATE**: `git rev-parse --is-inside-work-tree && pnpm install --frozen-lockfile=false && pnpm install --frozen-lockfile`
- **SATISFIES**: Creates the reproducible project and package foundation for acceptance criteria 1, 2, 7, and 8.

### Task 2: CREATE Next.js, TypeScript, Tailwind CSS, and shadcn/ui configuration

- **IMPLEMENT**: Invoke UI/UX Pro Max and UI Styling before editing presentation files. Read the master design system and any page override before choosing UI details.
- **IMPLEMENT**: Create strict `tsconfig.json` with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and the `@/*` alias to `src/*`.
- **IMPLEMENT**: Create App Router configuration, Tailwind CSS PostCSS setup, global CSS, shadcn/ui `components.json`, and minimal layout/page files.
- **IMPLEMENT**: Configure shadcn/ui `new-york` style, CSS variables, semantic status tokens, and Lucide icons. Add only the local `Button` and `Card` primitives needed by the foundation page.
- **IMPLEMENT**: Load Lexend and Source Sans 3 through `next/font/google`. Apply Lexend to headings and Source Sans 3 to interface and body text.
- **IMPLEMENT**: Define complete light and `.dark` token schemes in `globals.css`, including primary, accent, muted, border, focus ring, success, warning, info, and destructive roles.
- **IMPLEMENT**: Set `output: "standalone"` in `next.config.ts` for later Docker reuse.
- **IMPLEMENT**: Add a skip link, semantic `main` landmark, and a minimal system-status page naming the application and linking to `/api/health`.
- **PATTERN**: Follow the current official Next.js existing-project and shadcn/ui `src` directory guidance.
- **PATTERN**: Use semantic color utilities and shadcn/ui primitives. Keep cards non-interactive unless they contain an explicit action.
- **GOTCHA**: Do not add the dashboard shell, navigation, business forms, or feature-specific components.
- **GOTCHA**: Keep the page server-rendered. Do not add a client component without a browser-state requirement.
- **GOTCHA**: Do not use gradients, decorative hero elements, emoji icons, raw palette colors, color-only status, removed focus outlines, or layout-shifting hover effects.
- **GOTCHA**: Do not add GSAP, a theme toggle, TanStack Table, or other future-page dependencies in this ticket.
- **VALIDATE**: `pnpm typecheck && pnpm lint && pnpm build`
- **VALIDATE**: Inspect the page at 375, 768, 1024, and 1440 pixels. Verify keyboard focus, the skip link, 200-percent zoom, light and dark tokens, reduced motion, and no viewport-level horizontal scroll.
- **SATISFIES**: Acceptance criterion 1 and the confirmed UI scope boundary.

### Task 3: CREATE framework-free shared value objects and typed errors

- **IMPLEMENT**: Create `DomainError` and the application error categories inherited from the architecture.
- **IMPLEMENT**: Create `PublicId` validation for RFC 9562 UUID version 7 values.
- **IMPLEMENT**: Create `DecimalValue` with string-only construction, immutable arithmetic, and canonical string serialization.
- **IMPLEMENT**: Add logger and public identifier generator ports in the application layer.
- **PATTERN**: Domain code owns invariants. Application code owns workflow-facing error categories.
- **GOTCHA**: Do not import Next.js, Kysely, mysql2, Pino, Docker, or `process.env` from domain or application files.
- **GOTCHA**: Reject JavaScript numbers in `DecimalValue`, even when they appear safe.
- **VALIDATE**: `pnpm exec vitest run tests/unit/domain/shared`
- **SATISFIES**: Acceptance criteria 2 and 7.

### Task 4: CREATE validated environment and infrastructure adapters

- **IMPLEMENT**: Define separate Zod schemas for application runtime, migrations, local bootstrap, tests, and build-time execution.
- **IMPLEMENT**: Create `UuidV7Generator` behind the application port.
- **IMPLEMENT**: Create a Pino logger adapter with stable fields and explicit secret redaction.
- **IMPLEMENT**: Make production-like startup fail fast on invalid required configuration.
- **IMPLEMENT**: Allow `next build` to run without opening a database connection or requiring runtime-only secrets.
- **PATTERN**: Parse environment variables once at the infrastructure boundary.
- **GOTCHA**: Next.js evaluates modules during builds. Do not create a connection pool at module import time when a route is being statically analyzed.
- **GOTCHA**: Never log the parsed environment object or connection URLs.
- **VALIDATE**: `pnpm exec vitest run tests/unit/infrastructure/config && pnpm build`
- **SATISFIES**: Acceptance criteria 2, 5, and 6.

### Task 5: CREATE Kysely database clients and lossless database codecs

- **IMPLEMENT**: Create lazy singleton runtime and migration pool factories using Kysely's MySQL dialect and mysql2.
- **IMPLEMENT**: Configure mysql2 with `supportBigNumbers: true`, `bigNumberStrings: true`, decimal strings, UTC handling, and bounded pools.
- **IMPLEMENT**: Create UUID string-to-byte and byte-to-string helpers with exact 16-byte validation.
- **IMPLEMENT**: Define persistence-only `Database` and `ApplicationMetadataTable` types.
- **PATTERN**: Kysely row types remain in infrastructure. Repository adapters map them before returning application or domain values.
- **GOTCHA**: MySQL `BIGINT` can exceed JavaScript's safe integer range. Never coerce it through `Number`.
- **GOTCHA**: mysql2 returns `DECIMAL` values as strings. Preserve that behavior.
- **VALIDATE**: `pnpm exec vitest run tests/unit/infrastructure/database && pnpm typecheck`
- **SATISFIES**: Acceptance criteria 2, 3, and 7.

### Task 6: CREATE reversible migrations and local database bootstrap

- **IMPLEMENT**: Create the timestamped `application_metadata` migration with `up` and `down` functions.
- **IMPLEMENT**: Use Kysely's default migration metadata and lock tables.
- **IMPLEMENT**: Create non-interactive migrate, rollback, and status scripts that always close their pools.
- **IMPLEMENT**: Create a bounded local bootstrap that creates `fvdms`, `fvdms_app`, and `fvdms_migrator` when absent.
- **IMPLEMENT**: Grant only data access to the application principal and schema-change access to the migration principal.
- **IMPLEMENT**: Make repeated bootstrap and migrate calls idempotent.
- **PATTERN**: Migration files depend only on Kysely and frozen literals.
- **GOTCHA**: Do not change the shared MySQL image or credentials used by other projects.
- **GOTCHA**: The local administrative connection is development-only. It must not become the runtime application connection.
- **VALIDATE**: `pnpm db:bootstrap && pnpm db:migrate && pnpm db:status && pnpm db:rollback && pnpm db:migrate`
- **SATISFIES**: Acceptance criteria 3 and 9.

### Task 7: CREATE the health use case and composition root

- **IMPLEMENT**: Define `HealthCheckRepository`, health response DTO, and `GetHealthStatus` without framework imports.
- **IMPLEMENT**: Implement the repository with a bounded `SELECT 1` query and typed dependency failure.
- **IMPLEMENT**: Wire the logger, identifier generator, database client, repository, and use case in `src/infrastructure/composition/root.ts`.
- **PATTERN**: Route handlers request a fully built use case from the composition root.
- **GOTCHA**: Do not expose the Kysely instance through the application container.
- **GOTCHA**: Do not turn the composition root into a mutable global service locator.
- **VALIDATE**: `pnpm exec vitest run tests/unit/application/health && pnpm typecheck`
- **SATISFIES**: Acceptance criteria 1 and 2.

### Task 8: CREATE request tracing, API envelopes, and sanitized error mapping

- **IMPLEMENT**: Create request identifier validation and generation.
- **IMPLEMENT**: Add `src/proxy.ts` to set `x-request-id` upstream and on responses.
- **IMPLEMENT**: Log one structured request-received event for application routes while excluding `/_next` and static assets.
- **IMPLEMENT**: Create typed success and error response builders.
- **IMPLEMENT**: Create `withApiHandler` to time handlers, map known errors, sanitize unknown errors, and log completion.
- **IMPLEMENT**: Add `src/instrumentation.ts` for startup and uncaught request error logging.
- **PATTERN**: Match the envelope in `docs/System_Architecture.md:772`.
- **GOTCHA**: Treat incoming request identifiers as untrusted input.
- **GOTCHA**: Log the original error only on the server. Return stable public codes and messages.
- **VALIDATE**: `pnpm exec vitest run tests/unit/lib/http && pnpm lint`
- **SATISFIES**: Acceptance criteria 5 and 6.

### Task 9: CREATE the database-aware health route

- **IMPLEMENT**: Add `GET /api/health` using `GetHealthStatus` and `withApiHandler`.
- **IMPLEMENT**: Return `200`, a success envelope, database state, timestamp, and request identifier when ready.
- **IMPLEMENT**: Return `503` and a sanitized `DEPENDENCY_UNAVAILABLE` envelope when the database check fails.
- **IMPLEMENT**: Set `Cache-Control: no-store`.
- **PATTERN**: Route handlers authenticate later. This public endpoint exposes only coarse readiness.
- **GOTCHA**: Do not return database version, hostname, schema, connection string, SQL, latency internals, or driver errors.
- **VALIDATE**: `pnpm test:unit && pnpm build`
- **SATISFIES**: Acceptance criteria 1, 5, and 6.

### Task 10: CREATE the Docker development container and shared routing integration

- **IMPLEMENT**: Create a Node.js `24.20.0` Alpine development image with Corepack/pnpm and a non-root runtime user.
- **IMPLEMENT**: Bind mount source code while isolating `node_modules` and `.next` in named volumes.
- **IMPLEMENT**: Add an internal health check against `http://127.0.0.1:3000/api/health`.
- **IMPLEMENT**: Attach the application service to external `dev-net` without a `ports` block.
- **IMPLEMENT**: Add Traefik labels for `fvdms.lan`, `websecure`, TLS, network `dev-net`, and internal port `3000`.
- **IMPLEMENT**: Add `=fvdms.lan` to `/Users/jsonse/Documents/development/infra/certs/projects.txt` and run the existing regeneration script.
- **IMPLEMENT**: Create start, stop, and log scripts. The start script must start shared Traefik and MySQL before FVDMS.
- **PATTERN**: Mirror `/Users/jsonse/Documents/development/debt-tracker/docker-compose.yml:13` and the shared infrastructure guide.
- **GOTCHA**: The shared MySQL container runs MySQL 8.0. Integration tests target MySQL 8.4.11. Keep migrations compatible with both MySQL 8 releases.
- **GOTCHA**: Do not mount the Docker socket or certificate private key into the application container.
- **GOTCHA**: Do not stop shared infrastructure in the project down script.
- **VALIDATE**: `pnpm dev:up && docker compose ps && curl --fail --silent --show-error https://fvdms.lan/api/health`
- **SATISFIES**: Acceptance criteria 1 and 9 plus the confirmed `fvdms.lan` development requirement.

### Task 11: CREATE unit and integration test harnesses

- **IMPLEMENT**: Configure Vitest projects or separate configs for fast unit tests and serial MySQL integration tests.
- **IMPLEMENT**: Use V8 coverage with explicit `src/domain`, `src/application`, `src/infrastructure`, and `src/lib` include patterns.
- **IMPLEMENT**: Set an initial 80 percent threshold for lines, functions, statements, and branches on foundation code.
- **IMPLEMENT**: Start `mysql:8.4.11` through `@testcontainers/mysql` for integration tests.
- **IMPLEMENT**: Apply actual migrations before integration assertions and dispose containers and pools reliably.
- **IMPLEMENT**: Prove migration up, migration metadata, identifier uniqueness, rollback, reapply, and health behavior.
- **IMPLEMENT**: Prove unknown exceptions and driver errors never leak through API envelopes.
- **PATTERN**: Unit tests use fakes for application ports. Integration tests use real Kysely and MySQL adapters.
- **GOTCHA**: Do not use the shared local MySQL database from automated integration tests.
- **GOTCHA**: Keep integration tests serial where they mutate migration state.
- **VALIDATE**: `pnpm test:unit && pnpm test:integration && pnpm test:coverage`
- **SATISFIES**: Acceptance criteria 3, 5, 6, 7, and 8.

### Task 12: CREATE the GitHub Actions continuous integration workflow

- **IMPLEMENT**: Use official checkout and setup-node actions with Node.js 24 and pnpm caching.
- **IMPLEMENT**: Pin third-party actions to immutable commit hashes where practical.
- **IMPLEMENT**: Run frozen install, formatting check, lint, type check, unit coverage, MySQL integration tests, and the production build.
- **IMPLEMENT**: Give the workflow read-only repository permissions unless a later job needs more.
- **IMPLEMENT**: Add concurrency cancellation for superseded branch runs.
- **PATTERN**: Let Testcontainers use the GitHub-hosted runner Docker daemon. Do not add a second MySQL service container.
- **GOTCHA**: The repository has no remote yet. The workflow is complete when committed, but it runs only after pushing to GitHub.
- **VALIDATE**: `pnpm exec prettier --check .github/workflows/ci.yml && pnpm validate`
- **SATISFIES**: Acceptance criterion 8.

### Task 13: CREATE implementation and local operations documentation

- **IMPLEMENT**: Document prerequisites, shared infrastructure location, `pnpm dev:up`, `pnpm dev:down`, logs, migrations, tests, and `https://fvdms.lan`.
- **IMPLEMENT**: Document the layer dependency rule and where later modules should place interfaces and adapters.
- **IMPLEMENT**: Document certificate regeneration and dnsmasq troubleshooting without copying private key material.
- **IMPLEMENT**: Document that local MySQL is shared and that automated tests use isolated Testcontainers.
- **IMPLEMENT**: Record deferred authentication, audit, dashboard, and production operations work.
- **PATTERN**: Use executable commands and expected outcomes.
- **GOTCHA**: Do not describe development credentials as safe for production.
- **VALIDATE**: `pnpm validate && curl --fail --silent --show-error https://fvdms.lan/api/health`
- **SATISFIES**: All acceptance criteria and the implementation handoff requirement.

---

## TESTING STRATEGY

### Unit Tests

Use Vitest in Node environment. Application use cases receive fakes through interfaces.

Required unit coverage:

- Decimal construction rejects numbers, malformed strings, infinity, and not-a-number values.
- Decimal multiplication produces exact results for values such as `0.1 × 0.2`.
- Public identifiers accept UUIDv7 and reject other UUID versions and malformed input.
- UUID binary conversion performs a lossless string-byte-string round trip.
- Environment parsing accepts documented modes and rejects missing, malformed, or leaked secrets.
- Request identifiers preserve valid UUID input and replace invalid input.
- Application errors map to stable codes and statuses.
- Unknown errors map to a sanitized internal error.
- Health use case reports ready and dependency-unavailable states through a fake repository.

### Integration Tests

Use `@testcontainers/mysql` with the exact `mysql:8.4.11` image. Never point tests at the shared development database.

Required integration coverage:

- A clean database migrates to the latest version.
- Kysely creates and updates its migration metadata tables.
- The baseline table has unsigned `BIGINT`, unique `BINARY(16)`, JSON, and microsecond timestamp columns.
- Duplicate public identifiers and metadata keys fail through database constraints.
- One rollback removes the baseline table.
- Reapplying the migration recreates the schema.
- A readiness query returns success while MySQL is available.
- A stopped or invalid database dependency produces a sanitized `503` response.
- Pools and containers close even after failed assertions.

### Container and Routing Tests

- The shared infrastructure starts without recreating existing volumes.
- The FVDMS container becomes healthy.
- No FVDMS host port is published.
- `fvdms.lan` resolves to `127.0.0.1` through dnsmasq.
- The wildcard certificate contains the literal `fvdms.lan` Subject Alternative Name.
- Traefik discovers the FVDMS router on `websecure`.
- `https://fvdms.lan/api/health` returns `200` and an `x-request-id` header.
- Stopping shared MySQL causes readiness to return `503` without leaking connection details.

### Edge Cases

- Missing `x-request-id`.
- Malformed, oversized, or non-UUID request identifiers.
- UUIDv4 supplied where UUIDv7 is required for a public identifier.
- `BIGINT` values above `Number.MAX_SAFE_INTEGER`.
- Decimal values with more precision than future storage columns allow.
- Build execution without runtime database variables.
- Database unavailable during container startup.
- Database becomes unavailable after startup.
- Bootstrap runs twice against the same shared MySQL instance.
- Migration runs twice with nothing pending.
- Rollback when no migration is applied.
- Existing `dev-net` missing or shared infrastructure path overridden.
- Literal certificate entry already exists.
- Port 443 already belongs to the shared Traefik container, as expected.

---

## VALIDATION COMMANDS

Run all commands from `/Users/jsonse/Documents/development/fuel-and-dispatch`.

### Level 1: Syntax and style

```bash
pnpm format:check
pnpm lint
pnpm typecheck
```

### Level 2: Unit tests

```bash
pnpm test:unit
pnpm test:coverage
```

### Level 3: Integration tests

```bash
pnpm test:integration
```

### Level 4: Database migrations

```bash
pnpm db:bootstrap
pnpm db:migrate
pnpm db:status
pnpm db:rollback
pnpm db:migrate
```

### Level 5: Build

```bash
pnpm build
```

### Level 6: Docker and HTTPS routing

```bash
pnpm dev:up
docker compose ps
docker inspect fvdms --format '{{json .NetworkSettings.Networks}}'
dscacheutil -q host -a name fvdms.lan
openssl x509 -in /Users/jsonse/Documents/development/infra/certs/lan.crt -noout -ext subjectAltName
curl --fail --silent --show-error --dump-header - https://fvdms.lan/api/health
```

### Level 7: Full project validation

```bash
pnpm validate
```

Expected `validate` order:

```text
format:check → lint → typecheck → test:coverage → test:integration → build
```

---

## ACCEPTANCE CRITERIA

- [ ] The application starts through `pnpm dev:up` and becomes healthy.
- [ ] `https://fvdms.lan` loads through the existing dnsmasq and Traefik infrastructure.
- [ ] `GET https://fvdms.lan/api/health` returns `200` when MySQL is ready.
- [ ] The health endpoint returns a sanitized `503` when MySQL is unavailable.
- [ ] Domain and application files have no imports from Next.js, Kysely, mysql2, Pino, or infrastructure modules.
- [ ] Kysely migrations create metadata tables and the reversible baseline schema.
- [ ] Internal identifiers use unsigned `BIGINT`, while public identifiers use unique UUIDv7 `BINARY(16)` values.
- [ ] Public identifier contracts expose canonical UUIDv7 values and no database key.
- [ ] API errors use the documented envelope and never expose internal errors.
- [ ] Every application request receives an `x-request-id` response header.
- [ ] API envelopes and structured logs include the same request identifier.
- [ ] Structured logs redact credentials, cookies, tokens, and configured sensitive fields.
- [ ] Decimal helpers accept strings and avoid JavaScript floating-point arithmetic.
- [ ] Unit coverage reaches at least 80 percent for foundation source files.
- [ ] Integration tests run against isolated MySQL 8.4.11 and pass.
- [ ] GitHub Actions defines frozen install, static checks, tests, coverage, integration, and build jobs.
- [ ] The application container publishes no host port and mounts no Docker socket or certificate key.
- [ ] Tailwind CSS and shadcn/ui are initialized without adding a dashboard or feature UI.
- [ ] UI work follows both named UI skills and the persisted FVDMS master design system.
- [ ] The root page uses semantic tokens, Lexend and Source Sans 3, a skip link, visible focus, and a semantic main landmark.
- [ ] The root page works at 375, 768, 1024, and 1440 pixels, at 200-percent zoom, and with reduced motion enabled.
- [ ] Both light and dark token schemes meet Web Content Accessibility Guidelines AA contrast for normal text and controls.
- [ ] Documentation explains setup, architecture boundaries, validation, and troubleshooting.
- [ ] `pnpm validate` passes with zero errors.

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order.
- [ ] Existing product, architecture, and ticket documents remain intact.
- [ ] Each task validation passed immediately.
- [ ] All validation commands executed successfully.
- [ ] Unit and integration test suites pass.
- [ ] Coverage thresholds pass.
- [ ] Formatting, linting, and type checking pass.
- [ ] The production build succeeds without a live database connection.
- [ ] Docker development startup is repeatable.
- [ ] `fvdms.lan` resolves and serves trusted HTTPS.
- [ ] The health check proves both ready and unavailable behavior.
- [ ] Migration rollback and reapplication succeed.
- [ ] Dependency direction was reviewed with an import search.
- [ ] UI skill guidance, the master design system, keyboard flow, responsive sizes, zoom, contrast, and reduced motion were reviewed.
- [ ] No secrets or certificate private keys appear in Git status.
- [ ] Acceptance criteria all pass.
- [ ] Code was reviewed for security, maintainability, and later-ticket extension points.

---

## OPEN QUESTIONS / ASSUMPTIONS

- Confirmed — local development uses Docker and the existing `dev-net`, dnsmasq, Traefik, wildcard certificate, and shared MySQL services.
- Confirmed — the application hostname is the literal `fvdms.lan` and uses HTTPS through Traefik.
- Confirmed — Kysely, UUIDv7, pnpm, Zod, Pino, Decimal.js, Vitest, Testcontainers, and GitHub Actions are approved.
- Confirmed — UI design decisions use UI/UX Pro Max, while implementation uses the UI Styling skill.
- Design decision — shadcn/ui uses the `new-york` style, semantic CSS variables, and Lucide icons.
- Design decision — the presentation is restrained, accessible, and data-dense, with Lexend headings and Source Sans 3 interface text.
- Assumed — the local bootstrap may create dedicated `fvdms_app` and `fvdms_migrator` principals inside the shared MySQL instance.
- Assumed — initializing this directory as a Git repository on `main` is in scope. No remote will be created.
- Assumed — GitHub Actions may be committed before a GitHub remote exists.
- Assumed — Node.js 24 LTS and TypeScript 5.9 are preferred over the newer non-LTS Node.js 26 and TypeScript 7.

## NOTES

### Why reuse shared infrastructure

The machine already runs dnsmasq for `*.lan`, Traefik on ports 80 and 443, and MySQL on `dev-net`. Reusing these services prevents port collisions and matches other local projects.

The FVDMS Compose file should own only the application container and its disposable development volumes. The shared infrastructure remains independently managed from `/Users/jsonse/Documents/development/infra`.

### Why use a shared local database but isolated test databases

The established local convention uses the shared `mysql` service for development. This keeps daily startup fast and lets each application own a separate schema.

Automated integration tests need isolation and reproducibility. Testcontainers supplies a fresh MySQL 8.4.11 instance for every suite and cannot corrupt local development data.

### Why keep internal and public identifiers

Internal unsigned `BIGINT` keys keep joins compact and follow the inherited schema. UUIDv7 public identifiers prevent sequential IDs from becoming an authorization boundary.

The byte codec belongs in infrastructure. Domain and application code use canonical UUID strings and do not know the database storage format.

### Why use a baseline metadata table

FVD-001 must prove migrations, identity columns, constraints, JSON, timestamps, rollback, and repository typing. A narrow `application_metadata` table provides that proof without inventing a business aggregate.

Later tickets should not attach unrelated configuration to this table. Each domain module remains responsible for its normalized schema.

### Risk controls

- Keep database clients lazy so `next build` does not require MySQL.
- Keep mysql2 numeric output as strings so precision is never lost.
- Keep local administrative credentials outside runtime code.
- Keep Pino redaction paths static and never derive them from user input.
- Keep Traefik certificate work limited to adding one literal Subject Alternative Name.
- Keep the down script scoped to the FVDMS Compose project.
- Keep production hardening out of this ticket while preserving reusable standalone output.

### Confidence score

**9/10** for one-pass implementation.

The remaining uncertainty is operational rather than architectural. It concerns permission to create dedicated principals in the shared development MySQL instance.

## AMENDMENTS

### 2026-08-27 — UI design and implementation governance

- Added mandatory UI/UX Pro Max and UI Styling skill use for FVD-001 and every later UI-bearing ticket.
- Persisted and refined the FVDMS master design system under `design-system/fuel-and-vehicle-dispatch-management-system/MASTER.md`.
- Replaced the generator's marketing-oriented typography and motion with an accessible, restrained, data-dense government operations direction.
- Added semantic light and dark tokens, responsive checks, keyboard and focus requirements, zoom validation, reduced-motion support, and minimal shadcn/ui primitives.
