# Etapa 2: API pública

**Objetivo**: `GET /api/public/status` y `POST /api/public/registration` según `docs/api.md` y `docs/reglas-de-negocio.md` §3, con lógica de dominio pura y tests.
**Fuente**: `docs/plan.md` § Etapa 2.
**TDD**: desactivado (sin configuración de proyecto). Los tests son parte del entregable; runner: `pnpm test` (Vitest).
**Ruta**: delegated direct (un writer; 2+ archivos no triviales).
**Rama**: `feat/etapa-2-api-publica` (apilada sobre `feat/etapa-1-datos`).

## Decisiones

- **Precedencia del reemplazo**: si cambia `employmentStatus` o `seniorityMonths`, se desverifican **todas** las postulaciones, incluso las que mantienen el mismo puntaje ("conserva su verificación" aplica solo cuando no cambiaron esos datos). Ya se informó al usuario como supuesto.
- **Comparación de puntajes**: como decimales normalizados a 2 decimales (`"38.4"` y `"38.40"` son iguales).
- **Concurrencia**: dos altas simultáneas del mismo DNI chocan con el único `(cycle_id, dni)`. Ante `P2002` se reintenta la transacción una vez (la segunda encuentra el postulante y sigue la regla normal).
- **Estructura testeable**: `src/server/api/index.ts` exporta una fábrica de router (`createApiRouter(options)`) que `server.ts` monta en `/api`. Los tests la montan en un Express pelado con supertest, sin Angular. Opciones inyectables: reloj (`now`) y límite del rate limit.
- **Base de tests**: `DATABASE_URL_TEST` (Docker, 5433). `globalSetup` aplica `prisma migrate deploy`; tablas truncadas entre tests; archivos en serie.
- **Rate limit**: `express-rate-limit`, 10 envíos por hora por IP en el POST, `429 TOO_MANY_REQUESTS` con el sobre de error común. `trust proxy` configurable por `TRUST_PROXY` (apagado por defecto).
- **JSON inválido**: `400 VALIDATION_ERROR` con el sobre común, nunca HTML.

## Tareas

- [x] T1. Dominio puro + tests unitarios: `normalize.ts`, `registration-window.ts`, `diff-applications.ts`. (delegated)
- [x] T2. API pública + tests de integración: router, `GET /api/public/status`, `POST /api/public/registration` (zod, transacción, 409 sin filtrar datos, rate limit). (delegated)

## Aceptación

- Todos los tests pasan.
- El `409` no filtra ningún dato: mismo cuerpo exacto para "otro email" y "dado de baja".
- Tests requeridos por el plan: normalización; diff (sin cambios, cambio de puntaje, alta, baja, cambio de situación); plazo en bordes de día en hora argentina; integración del POST (crear, reemplazar con el mismo email, `409` con otro email, `409` con dado de baja, `403` cerrado, `400` con puesto repetido).

## Progreso / evidencia

- `pnpm test`: 4 archivos, 48 tests OK (unitarios de dominio + 26 de integración en `api/public.test.ts`, incluidos 429 y atomicidad ante falla forzada). Re-ejecutado por el coordinador: 48/48.
- `pnpm build` OK. `tsc -p tsconfig.server.json` (nuevo; type-check del servidor y los tests) sin errores.
- Smoke en el servidor de desarrollo: status con ciclo 2027 abierto y 11 puestos; POST 201 → 200 con mismo DNI+email; 409 `DATA_MISMATCH` con otro email; 404 JSON. Postulante de prueba borrado.
- `server.ts` ya no llama a `express.json()`: el router de `/api` parsea su JSON para que el JSON inválido siempre responda con el sobre de error. `/health` se movió al router.
- 500 → `INTERNAL_ERROR` (agregado a `docs/api.md`).
- Guarda de tests: aborta si la URL no es el puerto 5433 + `/listo_test` (globalSetup, setupFiles y antes de cada truncate/seed).
- Sin imports de `src/app` a `src/server`.

## Mirror Engram

Topic `odd/etapa-2-api-publica/tasks` en el proyecto `listo`.
