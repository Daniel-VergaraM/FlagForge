# FlagForge

Open-source feature flag platform with real-time control, enterprise-grade audit logs, and ultra-fast evaluation (<50ms).

## Architecture

- `apps/api` — NestJS: Flag CRUD, segmentation (rules), RBAC (OWNER/ADMIN/EDITOR/VIEWER), automatic audit logging, Prometheus metrics, NATS pub/sub.
- `apps/evaluator` — Go: Flag evaluation with Redis cache, SSE streaming for real-time push, invalidation via NATS. Stateless and horizontally scalable.
- `apps/web` — Next.js 14: Management dashboard with login, flag list/search, creation, editing, and audit history.
- `packages/sdk-js` — JavaScript/TypeScript SDK with local LRU cache, fallback to defaults, and background polling.
- `packages/react` — React bindings (`FlagForgeProvider`, `useFlag`, `useFlags`) with SSE for real-time updates and polling fallback.

## Stack

| Layer | Technology |
|-------|------------|
| Management API | NestJS + Prisma + PostgreSQL |
| Evaluator (hot path) | Go + Fiber + Redis |
| Frontend | Next.js 14 + NextAuth.js |
| SDKs | TypeScript (vanilla + React) |
| Cache / PubSub | Redis + NATS |
| Observability | Prometheus + Grafana + OpenTelemetry |
| Infra | Docker Compose + NGINX |

## Local Setup (Docker Compose)

The entire stack runs with a single command. Only ports 80/443 are exposed externally.

```bash
# Start everything (PostgreSQL, Redis, NATS, API, Evaluator, Web, Prometheus, Grafana, NGINX)
docker compose up -d

# Verify service health
curl -k https://localhost/api/health       # NestJS API
curl -k https://localhost/evaluate/stream   # Evaluator SSE
```

> **Note:** On first run, the `api` service runs `prisma migrate deploy` (or `db push` fallback) to synchronize the database schema.

## Main Endpoints (via NGINX)

| Endpoint | Description |
|----------|-------------|
| `https://localhost/` | Dashboard (Next.js) |
| `https://localhost/login` | NextAuth.js login (demo: any `@flagforge.local`) |
| `https://localhost/flags` | Flag list, search, and toggle |
| `https://localhost/flags/new` | Create flag |
| `https://localhost/flags/[id]` | Flag detail |
| `https://localhost/flags/[id]/edit` | Edit flag |
| `https://localhost/flags/[id]/audit` | Audit history |
| `POST https://localhost/api/flags` | Create flag (API) |
| `GET https://localhost/api/flags` | List flags (API) |
| `PATCH https://localhost/api/flags/:id` | Update flag (API) |
| `POST https://localhost/evaluate` | Evaluate flag (hot path) |
| `GET https://localhost/evaluate/stream?sdkKey=...` | SSE: real-time change push |
| `GET https://localhost/api/docs` | Swagger UI (API docs) |
| `GET https://localhost/api/health` | Health check |
| `GET https://localhost/grafana` | Grafana dashboards |
| `GET https://localhost/prometheus` | Prometheus metrics |

## JavaScript SDK

```bash
pnpm add @flagforge/sdk-js
```

```typescript
import { createClient } from '@flagforge/sdk-js';

const client = createClient({
  sdkKey: 'your-sdk-key',
  evaluatorUrl: 'https://localhost/evaluate',
  defaults: { 'new-feature': false },
});

const enabled = await client.isEnabled('new-feature', { userId: '123' });
```

## React Provider

```bash
pnpm add @flagforge/react
```

```tsx
import { FlagForgeProvider, useFlag } from '@flagforge/react';

function App() {
  return (
    <FlagForgeProvider config={{ sdkKey: 'your-sdk-key', evaluatorUrl: 'https://localhost/evaluate' }}>
      <FeatureToggle />
    </FlagForgeProvider>
  );
}

function FeatureToggle() {
  const { enabled, loading } = useFlag('new-feature', { userId: '123' });
  if (loading) return <span>Loading...</span>;
  return enabled ? <NewUI /> : <OldUI />;
}
```

The provider connects via **SSE** (`/evaluate/stream`) to receive flag changes in real time. If SSE is unavailable, it falls back to **polling** every 30 seconds.

## Real-Time Change Flow

1. User edits a flag in the Dashboard → `PATCH /api/flags/:id`
2. API saves to PostgreSQL, invalidates Redis, and publishes `flag.changed` to NATS
3. Evaluator (Go) receives the NATS message:
   - Invalidates the Redis cache entry
   - **Broadcasts SSE** to all connected clients with that `sdkKey`
4. React SDK receives the SSE event, invalidates local state, and automatically re-evaluates

## Project Structure

```
FlagForge/
├── apps/
│   ├── api/           # NestJS (CRUD, RBAC, audit, metrics, NATS pub/sub)
│   ├── evaluator/     # Go (evaluation, Redis cache, SSE, NATS pub/sub)
│   └── web/           # Next.js 14 (dashboard with login, flags, audit)
├── packages/
│   ├── sdk-js/        # Vanilla JS/TS SDK (LRU cache, fallback, polling)
│   └── react/         # React hooks + provider (SSE + polling fallback)
├── infra/
│   ├── nginx/         # Reverse proxy with SSL and upstreams
│   ├── prometheus/    # Scraping configuration
│   └── grafana/       # Pre-configured dashboards
├── docker-compose.yml # Full stack with healthchecks
└── pnpm-workspace.yaml
```

## Useful Scripts

```bash
# Individual development (without Docker)
pnpm dev:api        # NestJS API on port 3001
pnpm dev:evaluator  # Go evaluator on port 3002
pnpm dev:web        # Next.js dashboard on port 3000

# Tests
pnpm test:api       # API tests
pnpm test:sdk       # SDK JS tests
pnpm test:react     # React bindings tests

# Build
pnpm build          # Build all packages
```

## Design Decisions

- **Separated evaluation**: The NestJS API handles management (slower, DB-backed). The Go Evaluator handles the hot path (<50ms, Redis cache).
- **Two-level cache**: Redis in the Evaluator + local LRU in the JS SDK + React state.
- **Push via SSE**: Lighter than WebSockets for unidirectional (server → client) streaming. Works over HTTP/1.1 and NGINX without extra configuration.
- **Docker Compose as source of truth**: The entire local stack runs in containers; no host dependencies except Docker.

## License

This software is distributed under a **non-commercial use** license.

- You are free to distribute, modify, and contribute to the project.
- **Commercial use is not permitted** without express authorization from the author.
- Contributions are accepted under the same terms.

For commercial licensing inquiries, please contact the author.
