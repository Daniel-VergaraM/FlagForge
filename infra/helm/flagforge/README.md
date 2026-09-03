# FlagForge Helm chart

Migrates the `docker-compose.yml` stack (API, evaluator, web, Postgres, Redis,
NATS, nginx, Prometheus, Grafana) to Kubernetes. This document explains the
*why* behind the chart, not just the *what* — resource sizing, autoscaling
behavior, security posture, and the trade-offs made along the way.

## Chart layout

```
infra/helm/flagforge/
  Chart.yaml
  values.yaml            # baseline shared by every environment
  values-dev.yaml         # kind/minikube overlay
  values-prod.yaml        # managed-cluster overlay
  files/dashboards/       # Grafana dashboard JSON (chart-local copy, see below)
  templates/
    _helpers.tpl           # naming, labels, image refs, secret generation
    configmap.yaml          # shared non-secret env (Redis/NATS endpoints, etc.)
    secrets.yaml             # Postgres/NextAuth/Grafana credentials
    serviceaccounts.yaml      # one dedicated SA per workload
    networkpolicy.yaml         # default-deny + explicit allow rules
    postgres.yaml / redis.yaml / nats.yaml   # StatefulSets
    api.yaml / evaluator.yaml / web.yaml     # Deployment + Service + HPA + PDB
    ingress.yaml               # subdomain-per-service Ingress objects
    monitoring.yaml             # ServiceMonitor + Grafana dashboard ConfigMap
    monitoring-standalone.yaml  # bundled Prometheus + Grafana (no operator needed)
```

## Design trade-offs

These are the deliberate scope cuts and non-obvious choices, called out
explicitly rather than left for a reader to reverse-engineer from the YAML.

**Subdomain-per-service Ingress instead of nginx's path-prefix rewrites.**
The old `nginx.conf` routed everything through one host with
`proxy_pass`-based prefix stripping (`/api/` → `api:3001/`, `/evaluate` →
`evaluator:3002/evaluate`, ...). Replicating that in `ingress-nginx` requires
`rewrite-target` regex captures, and those interact badly with
per-annotation-per-Ingress-object semantics: the evaluator's SSE endpoint
needs `proxy-buffering: off` and long timeouts that must *not* apply to
everything else, but ingress-nginx annotations apply per-Ingress-resource,
not per-path. Stacking a rewrite-heavy `/api` Ingress next to a plain-prefix
`/api/auth` Ingress on the *same host* is a well-known source of nginx
location-priority bugs (a regex location can silently outrank a more
specific plain-prefix one). Giving each service its own host
(`app.`, `api.`, `evaluate.` + the configured domain) sidesteps all of that:
no rewrites, no priority ambiguity, and it happens to match how the app
already talks to itself — `apps/web/next.config.js` proxies the browser's
relative `/api/*` calls **server-side** to `API_BASE_URL` (the in-cluster
`api` Service DNS name, wired via the shared ConfigMap), so the frontend
needed zero changes for this to work.

**Postgres/Redis/NATS are single-replica StatefulSets, not HA clusters.**
Bundling Patroni/repmgr for Postgres HA, Redis Sentinel/Cluster, and a
multi-node NATS cluster was out of scope for a chart meant to demonstrate
Kubernetes packaging, not become a database-operator project. In a real
production deployment, swap `postgres.enabled: false` and point
`DATABASE_URL` at a managed database (RDS/Cloud SQL/Azure Database) instead
— see `values-prod.yaml`. Redis and NATS are cheaper to run single-node here
since the evaluator's local in-memory cache (see
`apps/evaluator/internal/cache`) already absorbs most read traffic; losing
Redis/NATS briefly degrades cache invalidation latency, it doesn't take the
evaluator down.

**Bundled Prometheus/Grafana (`monitoring.standalone`) vs. ServiceMonitor.**
A bare `kind`/`minikube` cluster has no Prometheus Operator, so the chart
carries a lightweight, docker-compose-equivalent Prometheus + Grafana pair
for local demos. Real clusters should install `kube-prometheus-stack` (or
similar) separately and set `monitoring.serviceMonitor.enabled: true` — the
`ServiceMonitor` objects and the Grafana dashboard ConfigMap (labeled
`grafana_dashboard: "1"`, the convention that Grafana's dashboard-sidecar
auto-imports) work with that path too, with `monitoring.standalone.enabled:
false`. The dashboard JSON is copied into `files/dashboards/` because Helm's
`.Files` can only read inside the chart directory — `infra/grafana/dashboards/
flagforge-overview.json` remains the docker-compose source of truth; keep
them in sync by hand (a small papercut, flagged here rather than hidden).

**NetworkPolicies cover ingress only, not egress.** Default-denying egress
too requires allow-listing kube-dns, the image registry/pull path, and any
external endpoint (an OTEL collector, etc.) — easy to get subtly wrong
(a missed DNS rule breaks *everything*) and beyond "basic" segmentation. The
ingress-only policies still express the real trust boundary: only the API
and evaluator may reach Postgres/Redis/NATS, only the ingress controller
(and, for metrics, the monitoring namespace) may reach the app tier. See
`templates/networkpolicy.yaml`.

**Secrets are generated once and persisted across upgrades**, not committed
to values files. `_helpers.tpl`'s `getOrGeneratePassword` reads back the
previous release's Secret via `lookup` before falling back to
`randAlphaNum`, so `helm install` needs zero manual secret prep and
`helm upgrade` never rotates a live password out from under a running
Postgres. Set `postgres.auth.password` / `web.nextAuth.secret` /
`monitoring.standalone.grafana.adminPassword` explicitly (or
`postgres.auth.existingSecret` to bring your own Secret entirely) for real
production — see "Secrets in production" below.

## Resource sizing rationale

| Component | Request (cpu/mem) | Limit (cpu/mem) | Why |
|---|---|---|---|
| **evaluator** (Go) | 250m / 64Mi | 250m / 128Mi (dev/base) — **250m / 250m = request==limit in prod** | CPU-bound, sub-50ms SLA. `requests == limits` in prod gives it **Guaranteed QoS**: the kubelet never throttles it via the CFS quota mid-evaluation, and it's the last pod evicted under node pressure. Memory is a tiny in-memory rule cache + Redis client, sized generously relative to actual use since starving it is far costlier than the request. |
| **api** (NestJS) | 150m / 256Mi | 750m / 512Mi | I/O-bound — most request time is spent awaiting Postgres/Redis/NATS, not burning CPU, so the *request* is low (it's mostly idle) but the *limit* is generous (5x) to absorb bursts (connection storms, Prisma query spikes) without throttling mid-burst. Memory covers the V8 heap + Prisma's connection pool + the OTEL SDK. |
| **web** (Next.js SSR) | 100m / 256Mi | 500m / 512Mi | Same I/O-bound profile as the API, lighter since it has no DB pool of its own — it proxies to the API server-side. |
| **postgres** | 250m / 512Mi | 1000m / 1Gi | Sized for the demo workload; bump `values-prod.yaml` or switch to a managed database for real traffic. |
| **redis** | 100m / 128Mi | 500m / 256Mi | AOF persistence on (matches `--appendonly yes` in compose) so a restart doesn't cold-start the evaluator's cache. |
| **nats** | 100m / 128Mi | 300m / 256Mi | JetStream persistence on for config-change pub/sub durability. |

The evaluator's Guaranteed-QoS choice is the one worth internalizing: a
CPU *limit* above the *request* means the kubelet lets the container burst,
but bursts are exactly what the CFS quota throttles once the burst exceeds
the limit within a scheduling period — and that throttling shows up as
tail-latency spikes, which is the one thing this service can't afford.
Setting request == limit removes that failure mode entirely at the cost of
some scheduling flexibility (the node must always have 250m free for this
pod). See `evaluator.resources` in `values-prod.yaml`.

## Autoscaling behavior

`evaluator.autoscaling` (enabled by default) targets **60% CPU utilization**
with `minReplicas: 3` / `maxReplicas: 12` in the base config (`values-prod.yaml`
widens this to 3–20 at 55%). The scale-up/scale-down `behavior` block is
asymmetric on purpose:

- **Scale-up**: no stabilization window, up to 2 pods added per 30s. Waiting
  to "confirm" a load spike before scaling defeats the point for a
  latency-critical service — better to over-scale briefly than let CPU
  contention eat into the 50ms budget.
- **Scale-down**: a 300s stabilization window, 1 pod removed per 60s. Slow
  and cautious, so a transient dip doesn't cause flapping that then has to
  scale back up seconds later.

An optional `evaluator.autoscaling.customMetrics` block scales on
`flagforge_evaluator_requests_per_second` instead of (additively, alongside)
CPU, via the [Prometheus Adapter](https://github.com/kubernetes-sigs/prometheus-adapter).
CPU utilization is a *proxy* for load; request throughput (or, with more
adapter config, p99 latency) is the thing users actually feel. It's off by
default because it's an extra moving part (the adapter has to be installed
and configured to expose that metric as a `Pods`-type custom metric from the
evaluator's own `/metrics` counters) that most demo clusters won't have —
enable it once you have kube-prometheus-stack + prometheus-adapter running.

`api` and `web` also have `autoscaling` blocks (off by default, on in
`values-prod.yaml`) using plain CPU-utilization HPAs — they don't have the
same latency sensitivity, so a simpler policy is enough.

**Local-cluster caveat**: HPAs need the `metrics-server` add-on to read pod
CPU. `minikube addons enable metrics-server` for minikube; for `kind`,
install it manually (its default TLS-verification of kubelet certs needs
`--kubelet-insecure-tls` — see the metrics-server docs) or skip the demo and
just watch `kubectl get hpa` sit at `<unknown>` for target values with
`autoscaling.enabled: false` (the default in `values-dev.yaml`).

## Health checks

- **evaluator**: `periodSeconds: 5`, `timeoutSeconds: 1-2` — tight, because
  with a 50ms budget a degraded pod needs to be pulled from Service
  endpoints (readiness) within seconds, not the ~30s a "default" probe
  config would take. `maxUnavailable: 0` on the rollout strategy too: never
  drop below the configured replica count mid-deploy on the hot path.
- **api**: looser (`periodSeconds: 10-15`), matching its slower dependency
  chain (Postgres migrations can take a moment on startup — hence
  `initialDelaySeconds: 20` on the liveness probe).
- **postgres/redis/nats**: `pg_isready` / `redis-cli ping` / NATS's `/healthz`
  monitoring endpoint, same checks the compose `healthcheck:` blocks used.

## Security

- **Secrets**: never hardcoded — generated and persisted per-release (see
  "Design trade-offs" above), or BYO via `existingSecret` / `--set`.
- **ServiceAccounts**: one dedicated SA per workload (`serviceaccounts.yaml`),
  none of them auto-mounting a token (`automountServiceAccountToken: false`)
  because nothing in this chart talks to the Kubernetes API. This is
  least-privilege by construction rather than by RBAC scoping — there's no
  RBAC to get wrong because there's no API access to grant.
- **NetworkPolicies**: default-deny ingress + explicit allow rules — see
  above.
- **Pod security context**: `runAsNonRoot: true`, `seccompProfile:
  RuntimeDefault`, containers drop all Linux capabilities
  (`securityContext.capabilities.drop: ["ALL"]`), `allowPrivilegeEscalation:
  false`. Postgres/Grafana pin their container's `runAsUser` to the image's
  own service-account UID (999 / 472) since those images don't run as an
  arbitrary UID cleanly otherwise.
- **Ingress metrics exposure**: `/metrics` and `/evaluator-metrics`-equivalent
  endpoints are **not** exposed on the public Ingress by default
  (`ingress.exposeMetrics: false`) — scrape them in-cluster via the
  `ServiceMonitor` instead. `values-dev.yaml` flips this on for convenient
  `curl`-ing during local development.

## Local cluster setup (kind / minikube)

```bash
# 1. Build images (from repo root)
docker build -t flagforge/api:latest      -f apps/api/Dockerfile apps/api
docker build -t flagforge/evaluator:latest -f apps/evaluator/Dockerfile apps/evaluator
docker build -t flagforge/web:latest       -f apps/web/Dockerfile .

# 2. Load them into the cluster (images never get pulled from a registry locally)
kind load docker-image flagforge/api:latest flagforge/evaluator:latest flagforge/web:latest
# or: minikube image load flagforge/api:latest flagforge/evaluator:latest flagforge/web:latest

# 3. Install an ingress controller if you don't have one
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx --namespace ingress-nginx --create-namespace

# 4. Install the chart
helm install flagforge ./infra/helm/flagforge -f infra/helm/flagforge/values-dev.yaml

# 5. Point the Ingress hosts at your cluster
#    kind: the ingress-nginx controller's NodePort/hostPort, usually 127.0.0.1
#    minikube: `minikube ip`
echo "127.0.0.1 app.flagforge.local api.flagforge.local evaluate.flagforge.local monitoring.flagforge.local" | sudo tee -a /etc/hosts
```

Then: `http://app.flagforge.local` (dashboard), `http://api.flagforge.local/api/docs`
(Swagger), `http://evaluate.flagforge.local/evaluate` (evaluator),
`http://monitoring.flagforge.local` (Grafana — get the generated admin
password from the NOTES output or `kubectl get secret ... -o jsonpath`).

`values-dev.yaml` disables NetworkPolicy by default: plain `kind`
(kindnet) and a bare `minikube start` don't run a policy-aware CNI, so the
`NetworkPolicy` objects would apply cleanly and enforce *nothing* — worse
than not creating them, since it looks secured but isn't. Enable it only on
`minikube start --cni=calico` or an equivalent local setup.

## Deploying to a managed cluster

```bash
# Build & push to your registry (tag per release, never :latest in prod)
docker build -t ghcr.io/your-org/flagforge-api:v0.2.0 -f apps/api/Dockerfile apps/api
docker push ghcr.io/your-org/flagforge-api:v0.2.0
# ... same for evaluator and web

# Prerequisites this chart assumes are already installed cluster-wide:
#   - an Ingress controller (ingress-nginx)
#   - cert-manager, with a ClusterIssuer matching values-prod.yaml's ingress.tls.clusterIssuer
#   - kube-prometheus-stack (or equivalent Prometheus Operator install), if
#     you want monitoring.serviceMonitor to do anything

helm install flagforge ./infra/helm/flagforge -f infra/helm/flagforge/values-prod.yaml \
  --set global.imageRegistry=ghcr.io/your-org \
  --set global.domain=your-domain.com \
  --set api.image.tag=v0.2.0 --set evaluator.image.tag=v0.2.0 --set web.image.tag=v0.2.0
```

### Secrets in production

The auto-generated Secrets (see "Design trade-offs") are fine for a demo but
not a substitute for a real secret manager. For production, either:

- Set `postgres.auth.existingSecret` to a Secret you provision out-of-band
  (containing `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`,
  `DATABASE_URL` keys — see `templates/secrets.yaml` for the exact shape), or
- Integrate [external-secrets](https://external-secrets.io/) or a Vault
  injector ahead of this chart and point `existingSecret` at the Secret it
  materializes.

## Verifying the chart

```bash
helm lint infra/helm/flagforge
helm lint infra/helm/flagforge -f infra/helm/flagforge/values-dev.yaml
helm lint infra/helm/flagforge -f infra/helm/flagforge/values-prod.yaml
helm template flagforge infra/helm/flagforge | kubectl apply --dry-run=client -f -
```

## Known limitations / next steps

- No Postgres/Redis/NATS HA (see trade-offs above) — fine for a portfolio
  demo, not for a real production SLA.
- The Grafana dashboard JSON is duplicated between `infra/grafana/dashboards/`
  (docker-compose) and `infra/helm/flagforge/files/dashboards/` (this chart);
  a follow-up could generate the chart copy from the compose one in CI.
- No egress NetworkPolicies (see trade-offs above).
- OpenTelemetry export (`api.otel.enabled`) is off by default since no OTEL
  collector is bundled — point it at one once you deploy one.
