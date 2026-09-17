# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org/) once the first tagged release
(`v0.1.0`) ships. Package versions (`0.0.1` in `package.json`) are frozen
pre-release placeholders, not yet driven by this changelog — the first
`v0.1.0` tag is what starts real versioning, cut from `main` via the CI
Docker job (`docker` job in `.github/workflows/ci.yml` builds/pushes/scans
images tagged from `v*` tags and pushes to `ghcr.io/<owner>/flagforge-*`).

## [Unreleased]

### Added
- CI: Docker build, Trivy CRITICAL/HIGH vulnerability scan, and GHCR push
  (from `main`/`v*` tags only) for `api`, `evaluator`, and `web` images.
- CI: dedicated Go job (`go vet` + `go test -race -cover`) for the evaluator.
- `.github/dependabot.yml`: weekly updates for npm, Go modules, the three
  Dockerfiles, and GitHub Actions.
- API: `helmet()` middleware and an env-driven CORS allowlist (`CORS_ORIGIN`,
  denies all cross-origin requests when unset instead of reflecting any
  origin).
- API: structured JSON logging (`JsonLogger`, one JSON object per line) and
  `app.enableShutdownHooks()` so in-flight requests and DB/cache connections
  drain on SIGTERM instead of dropping mid-deploy.
- Evaluator: graceful shutdown on SIGTERM/SIGINT (`app.ShutdownWithContext`,
  15s budget) so long-lived `/evaluate/stream` SSE connections aren't cut on
  a rolling deploy.
- Evaluator: rate limiting moved from a per-pod in-memory map to Redis
  INCR/EXPIRE, so the limit is enforced correctly once the evaluator scales
  past one replica behind the HPA; fails open (not closed) on a Redis error
  to preserve hot-path availability.
- Dockerfiles (`api`, `evaluator`, `web`): run as a non-root user and define
  a `HEALTHCHECK`.
- Tests: `RolesGuard`, `CaslAbilityFactory`, `WebhooksService` (including
  HMAC signature verification), `ApiKeysService` (api); Redis-backed rate
  limiter + cache get/set/delete, including a two-instance test proving the
  limit is shared across pods (evaluator).
- `CONTRIBUTING.md`, `RUNBOOK.md`, this changelog.

### Changed
- `docker-compose.yml`, `infra/helm/flagforge`: wired the new `CORS_ORIGIN`
  env var through (Compose: `https://localhost`; Helm: derived from the web
  Ingress host unless `api.corsOrigin` is set).

### Fixed
- CI now builds `@flagforge/sdk-js` before running `@flagforge/react`'s test
  suite — the react package imports the SDK from its built `dist/`, not its
  source, so the suite failed to resolve the import when run standalone
  (previously untested in CI, since the root `pnpm test` script only ever
  ran `apps/api`'s tests).

[Unreleased]: https://github.com/Daniel-VergaraM/FlagForge/compare/main...HEAD
