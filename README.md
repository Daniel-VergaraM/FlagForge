# FlagForge

Sistema de feature flags open-source con control en tiempo real, auditoría enterprise y evaluación ultra-rápida (<50ms).

## Arquitectura

- `apps/api` — NestJS: CRUD de flags, segmentación, RBAC, auditoría, webhooks.
- `apps/evaluator` — Go: Evaluación de flags en tiempo real con cache Redis. Stateless y escalable.
- `apps/web` — Next.js: Dashboard de gestión (próximamente).
- `packages/sdk-js` — SDK JavaScript/TypeScript (próximamente).

## Stack

| Capa | Tecnología |
|------|------------|
| Management API | NestJS + Prisma + PostgreSQL |
| Evaluator (hot path) | Go + Fiber + Redis |
| Frontend | Next.js 14 |
| Cache / PubSub | Redis + NATS |
| Infra | Docker / Kubernetes |

## Setup local

```bash
# 1. Levantar dependencias
pnpm db:up

# 2. Migrar base de datos
pnpm db:migrate

# 3. Seed datos iniciales
pnpm db:seed

# 4. Iniciar servicios (terminales separadas)
pnpm dev:api      # Puerto 3001
pnpm dev:evaluator # Puerto 3002
```

## Endpoints principales (vía NGINX)

- **Dashboard**: https://localhost/
- **API Docs**: https://localhost/api/docs
- **Evaluator**: POST https://localhost/evaluate
- **Health API**: GET https://localhost/api/health
- **Grafana**: https://localhost/grafana
- **Prometheus**: https://localhost/prometheus

> Solo los puertos 80/443 están expuestos al exterior; todos los servicios internos
> se comunican a través del proxy NGINX.

