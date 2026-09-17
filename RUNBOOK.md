# FlagForge Runbook

Operational reference for running FlagForge in Kubernetes (see
`infra/helm/flagforge/README.md` for chart design). For local Docker
Compose, most of this still applies with `docker compose logs -f <service>`
in place of `kubectl logs`.

## Topology at a glance

```
client / SDK -> evaluate.<domain> (Ingress) -> evaluator (Go, Redis cache)
dashboard    -> app.<domain>      (Ingress) -> web (Next.js) -[rewrite]-> api
dashboard    -> api.<domain>      (Ingress) -> api (NestJS)  -> Postgres
api  --NATS--> evaluator: flag.changed invalidates Redis + pushes SSE
```

The evaluator is the latency-critical path (<50ms budget) and is stateless;
the API is management-plane and can tolerate more latency/downtime.

## Checking health

```bash
kubectl get pods -n <namespace>
kubectl top pods -n <namespace>                       # if metrics-server is installed
kubectl logs -n <namespace> deploy/flagforge-api -f    # JSON lines, one object per log entry
kubectl logs -n <namespace> deploy/flagforge-evaluator -f
```

Prometheus/Grafana (ServiceMonitor path or standalone, per
`values-prod.yaml` / `values-dev.yaml`): the `FlagForge Overview` dashboard
covers evaluator p50/p95/p99 latency, cache hit rate, request rate by
status code, and API request/Prisma query latency.

## Common incidents

### Evaluator latency above the 50ms budget

1. Check `evaluator_request_duration_seconds` p95/p99 in Grafana, split by
   `status`.
2. Check the cache hit ratio (`evaluator_cache_hits_total` /
   (`evaluator_cache_hits_total` + `evaluator_cache_misses_total`)) — a drop
   usually means Redis is unreachable or was just flushed/restarted, and the
   evaluator is falling back to its 60s local in-memory cache or, on a full
   miss, hitting Redis synchronously.
3. Check CPU throttling: `kubectl describe pod <evaluator-pod>` and look for
   `cpu.stat` throttling in `kubectl exec ... -- cat /sys/fs/cgroup/cpu.stat`
   equivalent — in prod, evaluator requests==limits (Guaranteed QoS)
   specifically to avoid this; a Burstable override reintroduces the risk.
4. If HPA hasn't scaled up yet, check `kubectl get hpa flagforge-evaluator`
   — `currentMetrics` vs `targetCPUUtilizationPercentage`. Scale-up reacts
   within ~15-30s (`behavior.scaleUp`); scale-down is deliberately slow
   (~5 min) to avoid flapping.

### Redis unavailable

- Evaluator: flag lookups fall back to the per-pod local cache (60s TTL) on
  a Redis error, and the distributed rate limiter **fails open** (allows
  requests) rather than 500ing the hot path — expect a burst of otherwise
  rate-limited traffic to pass through, not evaluation errors, for pods that
  still have the flag cached locally. A pod that never cached a given flag
  will return `enabled: false` with a `cache failure` error until Redis
  recovers.
- API: flag CRUD/reads hitting Redis directly will fail per the relevant
  service call; check `apps/api/src/flags/flags.service.ts` for where Redis
  is in the write path.
- Recovery is automatic once Redis is back — no manual cache warm-up step
  exists today (see chart README's "known limitations").

### NATS unavailable / flag changes not propagating

- Symptom: editing a flag in the dashboard doesn't show up in `/evaluate`
  or push an SSE event, even though the Postgres write succeeded.
- The evaluator's NATS subscription failing is logged at startup
  (`nats subscribe init failed` / `nats subscribe error`) — check
  `kubectl logs deploy/flagforge-evaluator` for that line.
- Until NATS recovers, clients relying on SSE push won't see updates; the
  React SDK's 30s polling fallback still converges eventually. There is no
  automatic re-subscribe/backoff today — a NATS outage requires an evaluator
  pod restart (`kubectl rollout restart deploy/flagforge-evaluator`) once
  NATS is healthy again.

### Postgres unavailable

- API health check (`GET /health`) and readiness probe fail; pods stop
  receiving traffic (PodDisruptionBudget permitting) rather than 500ing.
- This chart runs a single-replica Postgres StatefulSet by design (see
  chart README "Design trade-offs: Postgres HA") — there is no automatic
  failover. Point `postgres.enabled: false` + an external managed Postgres
  at a real production deployment instead of chasing HA in-chart.

### Rolling deploy dropped in-flight requests / SSE connections

Should not happen given `enableShutdownHooks()` (API) and the evaluator's
SIGTERM handler + `app.ShutdownWithContext` (both drain in-flight work
before exiting). If it does:

1. Check `terminationGracePeriodSeconds` on the Deployment isn't shorter
   than the app's own shutdown timeout (evaluator: 15s).
2. Check the rolling update strategy (`maxUnavailable: 0` on `api`/`web`) —
   if it was overridden to allow unavailability, that's the likely cause.

## Rolling back a bad release

```bash
helm history flagforge -n <namespace>
helm rollback flagforge <revision> -n <namespace>
```

Database migrations are not automatically rolled back by `helm rollback` —
if the bad release included a Prisma migration, the rollback restores the
old application code against the *new* schema. Only roll back past a
migration if you've confirmed the migration is backward-compatible, or
you're prepared to also revert the schema by hand.

## Scaling

- `evaluator`: HPA on CPU (55-70% target depending on values file) with
  asymmetric behavior — fast scale-up, slow scale-down. A custom-metrics
  target (`flagforge_evaluator_requests_per_second` via Prometheus Adapter)
  is defined in values but off by default; enabling it requires the adapter
  installed and configured against the ServiceMonitor.
- `api`/`web`: HPA on CPU only, wider utilization targets — I/O-bound, less
  latency-sensitive.
- Manual override: `kubectl scale deploy/flagforge-evaluator --replicas=N`
  works but is undone on the next HPA reconcile if autoscaling is enabled.

## Rotating secrets

- Postgres password / `NEXTAUTH_SECRET` / Grafana admin password are
  generated once via Helm's `lookup` + `randAlphaNum` and persisted across
  `helm upgrade` — rotating them requires deleting the specific Secret key
  (or the whole Secret) before the next upgrade, which will regenerate it.
  Do this during a maintenance window; a Postgres password rotation
  requires updating the actual Postgres role password too, not just the
  Secret, or the API will fail to connect.
- API keys (per-environment SDK auth): revoke via `DELETE /api-keys/:id`
  (sets `revokedAt`, doesn't hard-delete — audit trail preserved) and issue
  a new one via `POST /api-keys`.
