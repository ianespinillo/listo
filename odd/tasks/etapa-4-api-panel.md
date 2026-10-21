# Etapa 4: API del panel

**Objetivo**: rutas `/api/panel/*` (sesión, listado ordenado por el decreto, postulantes, puestos y ciclos) según `docs/api.md`, protegidas en el servidor, con tests.
**Fuente**: `docs/plan.md` § Etapa 4, `docs/api.md` § Panel, `docs/reglas-de-negocio.md` §2, §4, §5, §6.
**TDD**: desactivado. Los tests son entregables; runner `pnpm test` (Vitest, base de tests en 5433).
**Ruta**: delegated direct (un writer; muchos archivos no triviales).
**Rama**: `feat/etapa-4-api-panel` (apilada sobre `feat/etapa-3-formulario`).

## Decisiones (huecos del contrato resueltos de forma conservadora)

- **Sesión**: token aleatorio de 32 bytes (base64url) en la cookie `listo_session`; en la base solo el SHA-256. Vence a los 7 días, sin renovación. Las sesiones vencidas se rechazan y se borran al detectarlas.
- **Login**: comparación con bcrypt también cuando el email no existe (hash ficticio), para no revelar por tiempo si el email existe. Rate limit de 5 intentos cada 15 min por IP, contando solo los fallidos. Mensaje: "Email o contraseña incorrectos".
- **CSRF**: `POST`/`PUT`/`PATCH`/`DELETE` de `/api/panel/*` exigen `Content-Type: application/json`, también las rutas sin cuerpo (el front manda `{}`). Si no, `415 UNSUPPORTED_MEDIA_TYPE` (código nuevo en `api.md`).
- **Listado**: usa el ciclo activo. Sin ciclo activo → `200` con `cycle: null`, resumen en cero y los 3 grupos vacíos. "Primer puesto activo" = el primero por nombre. Se puede pedir un puesto inactivo (el panel los muestra mientras tengan postulaciones). El `summary` se calcula sobre las filas devueltas (después de los filtros).
- **Detalle**: cada postulación trae además `group` y `order` en ese puesto, calculados con el mismo SQL del listado sin filtros. Así se cubre el "Grupo 2 · Orden 3 en Matemática" del mockup sin reglas nuevas. Son `null` si el postulante está dado de baja o es de un ciclo que no es el activo. Se documenta en `api.md`.
- **Verificación**: verificar setea `verifiedAt` y limpia `modified` y `previousScore` (§4). Quitar la verificación pone `verifiedAt = null`. Si el estado no cambia, no se registra evento.
- **Baja y reactivación**: idempotentes. Si ya estaba en ese estado, `204` sin evento duplicado.
- **Puestos**: el nombre es único sin distinguir mayúsculas (§6), controlado en el servidor dentro de la transacción. `activeCycleApplicants` cuenta postulantes no dados de baja del ciclo activo.
- **Ciclos**: lista con el activo primero y después por año descendente. Un ciclo no activo es "archivado": `PATCH` responde `409 CYCLE_ARCHIVED`. `POST` desactiva el anterior y activa el nuevo en una transacción.
- **404**: `NOT_FOUND` para postulante, puesto o ciclo inexistente.

## Tareas

- [ ] T1. Sesión: login, logout, sesión, `requireSession`, guarda de `Content-Type` y rate limit del login.
- [ ] T2. Listado: SQL del §2 con `$queryRaw`, `GET /api/panel/listing` y **todos** los tests de orden del §2.
- [ ] T3. Postulantes: detalle (con `group`/`order`), edición de email, baja/reactivación y verificación.
- [ ] T4. Puestos y ciclos.

## Aceptación (plan)

- Todos los casos de orden de §2 cubiertos por tests.
- Verificación limpia `modified` y `previousScore`.
- Rutas sin sesión: `401 UNAUTHENTICATED`.
- Activar un ciclo desactiva el anterior.

## Progreso / evidencia

(pendiente)

## Mirror Engram

Topic `odd/etapa-4-api-panel/tasks` en el proyecto `listo`.
