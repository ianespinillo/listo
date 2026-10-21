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

- [ ] T1. Auditoría de accesibilidad y correcciones en `src/app` y `src/styles.css`.
- [ ] T2. Producción: hosts permitidos configurables y `.env.example` completo.
- [ ] T3. README en español.

## Aceptación

- Accesibilidad revisada con hallazgos y correcciones listados.
- README con requisitos, local y despliegue; variables de producción documentadas.

## Progreso / evidencia

(pendiente)

## Mirror Engram

Topic `odd/etapa-6-pulido/tasks` en el proyecto `listo`.
