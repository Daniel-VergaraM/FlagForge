# Contributing to FlagForge

## Getting set up

```bash
pnpm install
docker compose up -d postgres redis nats   # infra only, no app containers
pnpm --filter @flagforge/api prisma:migrate
pnpm --filter @flagforge/api prisma:seed
pnpm dev:api        # NestJS API on :3001
pnpm dev:evaluator  # Go evaluator on :3002
pnpm dev:web        # Next.js dashboard on :3000
```

Or run the whole stack in containers with `docker compose up -d` (see the
root README).

## Project layout

- `apps/api` — NestJS management API (Prisma/PostgreSQL, RBAC, audit log).
- `apps/evaluator` — Go evaluation hot path (Redis cache, SSE, NATS).
- `apps/web` — Next.js dashboard.
- `packages/sdk-js`, `packages/react` — client SDKs.
- `infra/helm/flagforge` — the Kubernetes deployment (see its own README for
  design trade-offs).

## Before opening a PR

```bash
pnpm lint
pnpm test                          # apps/api unit tests
pnpm --filter @flagforge/sdk-js run test
pnpm --filter @flagforge/sdk-js build   # react's tests import sdk-js's built dist/, not its source
pnpm --filter @flagforge/react run test
cd apps/evaluator && go vet ./... && go test ./... -race -cover
```

CI runs the same checks, plus a Docker build + Trivy vulnerability scan for
`apps/api`, `apps/evaluator`, and `apps/web` on every push and PR — a
CRITICAL/HIGH finding fails the build. Images are only pushed to
`ghcr.io/<owner>/flagforge-*` from `main` or a `v*` tag, never from PRs.

## Commit / PR conventions

- Commit subjects follow `type(scope): summary` (`feat`, `fix`, `chore`,
  `docs`, …), matching the existing `git log`.
- Keep PRs scoped to one concern; update `CHANGELOG.md` under `[Unreleased]`
  for any user-facing change (new endpoint, config var, breaking change).
- If you touch `apps/api/prisma/schema.prisma`, include the generated
  migration (`pnpm --filter @flagforge/api prisma:migrate`) in the same PR.
- If you add or change an env var, update `.env.example` and, if it's
  consumed by a deployed component, `infra/helm/flagforge/values.yaml` /
  `templates/configmap.yaml` too — the chart and Compose setup are expected
  to stay in sync with the app's actual env contract.

## Security-sensitive areas

RBAC (`apps/api/src/auth`), API keys, and webhooks are the parts most likely
to introduce a real vulnerability if changed carelessly. Add or update tests
in the matching `*.spec.ts` file for any change there, and don't weaken the
default-deny posture (`RolesGuard` denying when no role matches, CORS
denying when `CORS_ORIGIN` is unset, the evaluator's rate limiter failing
open only on Redis *errors*, never on an exceeded limit).

## Reporting a vulnerability

Please don't open a public issue for a security vulnerability. Contact the
maintainer directly (see the repository owner's profile) with details and
reproduction steps.
