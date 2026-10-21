# Etapa 6: Pulido y despliegue

**Objetivo**: revisión de accesibilidad, variables de entorno de producción y README en español para correr en local y desplegar.
**Fuente**: `docs/plan.md` § Etapa 6.
**TDD**: desactivado. Chequeos: build, type-check, tests existentes, verificación de contraste de los tokens.
**Ruta**: delegated direct (un writer).
**Rama**: `feat/etapa-6-pulido` (apilada sobre `feat/etapa-5-panel`).

## Decisiones

- El README documenta el despliegue genérico (servidor Node + PostgreSQL), sin atarse a un proveedor.
- Riesgos de producción a documentar: `security.allowedHosts` de Angular 22 (rechaza hosts no listados), `TRUST_PROXY` detrás de un proxy, `NODE_ENV=production` para la cookie `secure`, migraciones con `prisma migrate deploy` (nunca `migrate dev` ni el seed en producción), y cómo crear la usuaria del panel.
- La revisión de accesibilidad corrige problemas concretos (labels, foco, contraste AA, `aria-label`) sin rediseñar pantallas.

## Tareas

- [x] T1. Auditoría de accesibilidad y correcciones en `src/app` y `src/styles.css`. (delegated; `52c1ede`)
- [x] T2. Producción: hosts permitidos configurables y `.env.example` completo. (delegated; `0899d8f`)
- [x] T3. README en español. (delegated; `66e2355`)
- [x] T4. Correcciones del verificador independiente de la Etapa 5 (logout, recarga tras guardar, `returnUrl`, cancelación de pedidos, timer). (delegated)

## Aceptación

- Accesibilidad revisada con hallazgos y correcciones listados.
- README con requisitos, local y despliegue; variables de producción documentadas.

## Progreso / evidencia

- **Accesibilidad**: aro de foco tiza tenía 1,87:1 sobre blanco → ahora `--pizarron` (9,6:1), tiza solo sobre verde (5,15:1); borde de campos `#C9C6BC` (1,71:1) → `#8A877D` (3,59:1); placeholder fijo; tablas con scroll navegables con teclado. Texto: 30/30 pares OK antes y después.
- **Hosts**: mecanismo oficial `NG_ALLOWED_HOSTS` (`@angular/ssr/fesm2022/node.mjs`), sin código. Smoke en producción: host permitido 200, host ajeno 400, `/api/health` 200.
- `.env.example` completo; se quitó `TIME_ZONE` (ningún código la lee).
- README en español: local, scripts, tests, despliegue, variables, admin, backups y pendientes del §7.
- Verificador de la Etapa 5: sin bloqueantes; 2 should-fix y 4 nits, todos corregidos (T4).
- Checks finales del coordinador: `pnpm build` OK sin warnings; `pnpm test` 145/145.
- **Pendiente manual**: recorrido con teclado y foco sobre el header verde; lector de pantalla en diálogos; mirar el borde nuevo de los campos.

## Mirror Engram

Topic `odd/etapa-6-pulido/tasks` en el proyecto `listo`.
