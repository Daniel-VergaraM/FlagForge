# Acceso a Servicios via NGINX Proxy

## URLs (después de `docker compose up`)

| Servicio | URL | Credenciales |
|----------|-----|--------------|
| Swagger API Docs | `https://localhost/api/docs` | — |
| API Base | `https://localhost/api/` | — |
| Evaluator | `https://localhost/evaluate` | — |
| Grafana | `https://localhost/grafana` | admin/admin |
| Prometheus | `https://localhost/prometheus` | admin/admin (basic auth) |
| API Metrics | `https://localhost/metrics` | — |
| Evaluator Metrics | `https://localhost/evaluator-metrics` | — |
| Health Check | `https://localhost/health` | — |

## Notas

- HTTPS con certificado autofirmado. El navegador mostrará advertencia de seguridad; aceptar para continuar.
- Prometheus requiere basic auth (usuario `admin`, contraseña `admin`).
- Grafana está configurado bajo sub-path `/grafana`.
- Todos los puertos internos (3001, 3002, 3000, 9090, 5432, 6379, 4222) están **cerrados desde fuera**; solo nginx expone 80 y 443.

## Comunicación interna entre servicios

Dentro de la red Docker, los servicios pueden comunicarse vía el proxy:

```bash
# Desde API hacia Evaluator
curl http://nginx/evaluate

# Desde Evaluator hacia API
curl http://nginx/api/flags
```

## Comandos útiles

```bash
# Levantar todo
docker compose up -d --build --force-recreate

# Ver estado
docker compose ps

# Logs del proxy
docker logs flagforge-nginx-1 -f

# Detener todo
docker compose down
```
