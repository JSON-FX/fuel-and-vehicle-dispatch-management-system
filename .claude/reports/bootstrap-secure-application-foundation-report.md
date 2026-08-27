# Implementation Report — Bootstrap Secure Application Foundation

**Plan**: `.claude/plans/bootstrap-secure-application-foundation.md`
**Branch**: `main`
**Status**: COMPLETE

## Summary

Built the FVDMS Next.js 16 foundation with strict TypeScript, Tailwind CSS, shadcn/ui primitives, and the approved design system. Added framework-free domain and application layers, Kysely persistence, reversible MySQL migrations, request tracing, sanitized API envelopes, structured logging, and a database-aware health endpoint.

Added an isolated Docker development container on the shared `dev-net`. Traefik now serves the healthy application at `https://fvdms.lan` with the regenerated trusted certificate.

## Tasks completed

- Package and Git foundation → `package.json`, `pnpm-lock.yaml`, and root tool configuration files (CREATE).
- Next.js and UI foundation → `src/app`, `src/components/ui`, `src/lib/utils.ts`, and `design-system` (CREATE).
- Domain and application primitives → `src/domain/shared` and `src/application/shared` (CREATE).
- Configuration, logging, and identifiers → `src/infrastructure/config`, `src/infrastructure/logging`, and `src/infrastructure/identifiers` (CREATE).
- Kysely clients and codecs → `src/infrastructure/database/client.ts`, `types.ts`, and `uuid-binary.ts` (CREATE).
- Database lifecycle → baseline migration, migrator, bootstrap helper, and `scripts/database` (CREATE).
- Health flow and composition → `src/application/health`, Kysely health adapter, and `src/infrastructure/composition/root.ts` (CREATE).
- HTTP boundary → `src/proxy.ts`, `src/instrumentation.ts`, `src/lib/http`, and `src/app/api/health/route.ts` (CREATE).
- Docker and shared routing → `Dockerfile`, `compose.yaml`, `scripts/dev`, and shared certificate configuration (CREATE/UPDATE).
- Test and CI foundation → unit tests, MySQL 8.4.11 integration tests, Vitest configuration, and `.github/workflows/ci.yml` (CREATE).
- Operations guide → `README.md` (CREATE).

## Tests added

- 63 unit tests across 17 files cover value objects, errors, configuration, database codecs, logging, composition, request tracing, API envelopes, and the health route.
- Six integration tests across two files use `mysql:8.4.11`. They cover schema details, unique identifiers, lossless BIGINT reads, migration rollback and reapply, database readiness, and sanitized driver failures.
- Coverage passes with 96.45 percent statements, 90.74 percent branches, 95.31 percent functions, and 97.12 percent lines.

## Validation results

- `pnpm format:check` — PASS.
- `pnpm lint` — PASS.
- `pnpm typecheck` — PASS.
- `pnpm test:coverage` — PASS, 63 tests.
- `pnpm test:integration` — PASS, six tests against MySQL 8.4.11.
- `pnpm build` — PASS, including dynamic `/api/health` and the Next.js proxy.
- Database bootstrap, migrate, status, rollback, and reapply lifecycle — PASS against shared MySQL 8.0.
- `pnpm dev:up`, container health, non-root runtime, and no published ports — PASS.
- `curl https://fvdms.lan/api/health` — PASS with database status `available`.
- Browser validation — PASS at 200-percent zoom with reduced motion and no horizontal overflow.
- Light and dark token contrast — PASS for body, card, and primary action text at Web Content Accessibility Guidelines AA.

## Deviations from the plan

- Node.js `24.20.0-alpine` does not exist on Docker Hub. The Docker image and CI use the latest available pinned Node.js 24 patch, `24.19.0`.
- ESLint 10 is incompatible with `eslint-plugin-react` from the pinned Next.js configuration. ESLint is pinned to compatible version `9.39.5`.
- pnpm 11.24 requires explicit dependency build policy. `pnpm-workspace.yaml` allows only the required install scripts.
- Tests were created alongside each task to preserve a red-green-refactor loop and satisfy each task gate. Task 11 then added the isolated integration harness.
- The Docker scaffold was introduced before Task 6 validation. The shared MySQL service has no host port, so database commands needed a short-lived container on `dev-net`.
- The bundled Next.js guide names `unstable_doesProxyMatch`, but Next.js 16.3.3 exports `unstable_doesMiddlewareMatch`. The proxy matcher test uses the installed export.

## Issues encountered

- Traefik retained the previous certificate after regeneration. A controlled Traefik restart loaded the new `fvdms.lan` Subject Alternative Name.
- The new `.next` named volume initially belonged to root. The image now creates cache paths with Node user ownership, and the existing project volumes were repaired.
- Next.js initially blocked development assets from the Traefik host. `allowedDevOrigins` now explicitly permits only `fvdms.lan`.
- The host currently runs Node.js 26, so host-side pnpm commands show an engine warning. Docker and CI run the supported Node.js 24.19.0 runtime.
