# NGINX Reverse Proxy - Estado

## Resumen
Proxy inverso NGINX implementado y operativo. Todos los servicios internos se comunican a través del proxy. Solo los puertos 80 (HTTP) y 443 (HTTPS) están expuestos al exterior.

## URLs de Acceso

| Servicio | URL | Estado |
|----------|-----|--------|
| Dashboard | `https://localhost/` | ✅ 200 |
| Swagger API Docs | `https://localhost/api/docs` | ✅ 200 |
| API Health | `https://localhost/api/health` | ✅ OK |
| Evaluator | `https://localhost/evaluate` | ✅ OK |
| Grafana | `https://localhost/grafana/` | ✅ 200 |
| Prometheus | `https://localhost/prometheus/` | ✅ 200 |
| API Metrics | `https://localhost/metrics` | ✅ OK |
| Evaluator Metrics | `https://localhost/evaluator-metrics` | ✅ OK |
| Nginx Health | `http://localhost/health` | ✅ 200 |

## Seguridad
- **SSL/TLS**: Certificado autofirmado en `infra/nginx/ssl/`
- **Redirección HTTP→HTTPS**: Todo tráfico HTTP se redirige a HTTPS
- **Autenticación**: Grafana requiere credenciales `admin/admin`
- **Exposición de puertos**: Solo nginx expone 80/443 al host

## Puertos Internos (NO expuestos externamente)
- API: 3001
- Evaluator: 3002
- Grafana: 3000
- Prometheus: 9090
- PostgreSQL: 5432
- Redis: 6379
- NATS: 4222, 8222, 6222

## Comunicación entre servicios
Los servicios dentro de la red Docker pueden comunicarse a través del proxy:
```bash
# Desde cualquier servicio
curl http://nginx/api/health
curl http://nginx/evaluate
```

## Nota sobre base de datos
El endpoint `/api/flags` devuelve 500 porque la tabla `flags` no existe en la base de datos (migraciones no ejecutadas). Esto es un problema separado del proxy.

## Comandos útiles
```bash
# Levantar stack
docker compose up -d

# Ver estado
docker compose ps

# Logs del proxy
docker logs flagforge-nginx-1 -f

# Detener
docker compose down
```
