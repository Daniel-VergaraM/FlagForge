# Commands

Quick reference, organized by topic. See `CONTRIBUTING.md` for the pre-PR
checklist and `RUNBOOK.md` for operational/incident commands.

## Setup

```bash
pnpm install
docker compose up -d postgres redis nats   # infra only, no app containers
pnpm --filter @flagforge/api prisma:migrate
pnpm --filter @flagforge/api prisma:seed
```

## Local development (no Docker)

```bash
pnpm dev:api        # NestJS API on :3001
pnpm dev:evaluator  # Go evaluator on :3002
pnpm dev:web        # Next.js dashboard on :3000
```

## Docker Compose (full stack)

```bash
docker compose up -d          # everything: Postgres, Redis, NATS, API, Evaluator, Web, Prometheus, Grafana, NGINX
docker compose logs -f api    # tail one service's logs
docker compose down           # stop everything
curl -k https://localhost/api/health       # NestJS API
curl -k https://localhost/evaluate/stream  # Evaluator SSE
```

## Lint

```bash
pnpm lint                                   # apps/api (eslint --fix)
cd apps/evaluator && go vet ./...
```

## Tests

```bash
pnpm test                                        # apps/api unit tests
pnpm test:e2e                                     # apps/api e2e tests
pnpm --filter @flagforge/sdk-js run test
pnpm --filter @flagforge/sdk-js build             # required before react's tests: they import sdk-js's built dist/, not its source
pnpm --filter @flagforge/react run test
cd apps/evaluator && go test ./... -race -cover   # add -v for per-test output
```

## Prisma / database

```bash
pnpm --filter @flagforge/api prisma:generate   # regenerate the Prisma client
pnpm --filter @flagforge/api prisma:migrate     # create + apply a dev migration
pnpm --filter @flagforge/api prisma:seed        # seed local data
pnpm db:up                                      # docker compose up -d (alias)
pnpm db:migrate                                 # alias for prisma:migrate
pnpm db:seed                                    # alias for prisma:seed
```

## Build

```bash
pnpm build              # build all packages
pnpm build:api           # apps/api only
pnpm build:evaluator     # apps/evaluator only (go build)
```

## Docker images

```bash
docker build -t flagforge/api ./apps/api
docker build -t flagforge/evaluator ./apps/evaluator
docker build -t flagforge/web ./apps/web
```

## Kubernetes (Helm)

```bash
helm lint infra/helm/flagforge
helm lint infra/helm/flagforge -f infra/helm/flagforge/values-dev.yaml
helm lint infra/helm/flagforge -f infra/helm/flagforge/values-prod.yaml

helm template flagforge infra/helm/flagforge -f infra/helm/flagforge/values-dev.yaml   # render manifests without installing

helm install flagforge infra/helm/flagforge -f infra/helm/flagforge/values-dev.yaml    # kind/minikube
helm install flagforge infra/helm/flagforge -f infra/helm/flagforge/values-prod.yaml   # managed cluster

helm upgrade flagforge infra/helm/flagforge -f infra/helm/flagforge/values-prod.yaml
helm history flagforge -n <namespace>
helm rollback flagforge <revision> -n <namespace>
```

## CI (what `.github/workflows/ci.yml` runs)

```bash
pnpm install --frozen-lockfile
pnpm --filter @flagforge/api prisma:generate
pnpm lint
pnpm test
pnpm --filter @flagforge/sdk-js run --if-present test
pnpm --filter @flagforge/sdk-js build
pnpm --filter @flagforge/react run --if-present test

cd apps/evaluator && go vet ./... && go test ./... -race -cover

# docker job: build -> Trivy scan (CRITICAL,HIGH, exit-code 1) -> push to GHCR (main/v* only)
```
