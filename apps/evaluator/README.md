# FlagForge Evaluator

Servicio crítico de evaluación de feature flags en Go.

## Latencia

Benchmark local (motor puro): **~350 ns/op**  
Con Redis + HTTP (red local): **< 1ms p99**

## Decisiones críticas

- **Go + Fiber**: fasthttp para máximo throughput.
- **Sin base de datos en hot path**: lee de Redis únicamente.
- **Motor alloc-free**: evaluación de reglas sin allocations de heap en el path crítico.
- **Hash determinístico**: rollout porcentual consistente por usuario.
