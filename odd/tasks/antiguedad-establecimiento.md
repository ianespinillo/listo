# Antigüedad en el establecimiento

**Objetivo**: pedir la antigüedad en la escuela a quienes trabajan en ella (titular, provisional o suplente) y usarla para ordenar el grupo 1.
**Problema / por qué**: pedido del dueño del proyecto (2026-10-21). Eligió que la antigüedad en el establecimiento **reemplace** a la antigüedad docente como clave del grupo 1.
**TDD**: desactivado (sin configuración). Tests como entregables; runner `pnpm test`.
**Ruta**: delegated direct (un writer; servidor + front + docs).
**Rama**: `feat/antiguedad-establecimiento` (apilada sobre `feat/etapa-6-pulido`).

## Decisiones

- **Orden** (decisión del usuario, se aparta de la letra del art. 108 C, que dice "antigüedad docente"):
  - grupo 1 por `school_seniority_months` ↓;
  - grupo 2 sigue por puntaje ↓ y desempata por antigüedad **docente** ↓;
  - grupo 3 sin cambios.
  Queda documentado en `docs/reglas-de-negocio.md` como decisión de la escuela.
- **Obligatoriedad**: obligatoria para `TITULAR`, `PROVISIONAL` y `SUPLENTE`. Para `EXTERNO` no se pide; si llega, se ignora y se guarda `null`.
- **Rango**: años 0–60 y meses 0–11, igual que la antigüedad docente. No puede superar la antigüedad docente (chequeo de consistencia, no regla del decreto).
- **Cambio de datos**: si cambia, cuenta como `DATA_CHANGE`. Desverifica todas las postulaciones y registra valor anterior y nuevo, porque define el orden.
- **Base**: columna nueva `school_seniority_months` (`Int?`), campo Prisma `schoolSeniorityMonths`. Los datos existentes quedan en `null` (`NULLS LAST` en el orden).
- **API**: cuerpo `schoolSeniority: { years, months }`. Se suma `schoolSeniorityMonths` al `summary`, a las filas del listado y al detalle.

## Tareas

- [x] T1. Servidor: schema + migración, validación, normalización, diff (`DATA_CHANGE`), SQL del orden, respuestas, tests. (delegated)
- [x] T2. Front: campo condicional en el formulario y en "Enviado"; columna en el listado (resaltada en el grupo 1) y dato en el detalle. (delegated)
- [x] T3. Docs: `requisitos.md`, `reglas-de-negocio.md` (§2 con la nota de la decisión, §3), `api.md`. (delegated)

## Aceptación

- Un titular con menos antigüedad docente pero más antigüedad en la escuela queda antes.
- La antigüedad en la escuela es obligatoria para titular, provisional o suplente y no se pide para externo.
- Cambiarla desverifica y queda en el historial.
- Todos los tests pasan.

## Progreso / evidencia

- `pnpm test`: 159/159 (listing 25, public 35, diff 9, entre otros). Re-ejecutado por el coordinador.
- `tsc` servidor y app sin errores; `pnpm build` OK sin warnings; `migrate diff` sin diferencias; migración `20261021180000_school_seniority` aplicada en desarrollo.
- SQL: único cambio en el orden → grupo 1 por `school_seniority_months DESC NULLS LAST`.
- Smoke: TITULAR sin el dato → 400 con `schoolSeniority.years/months`; con el dato → 201 y `summary.schoolSeniorityMonths`; aparece en el listado.
- Listado: columnas "Antig. escuela" (resaltada en grupo 1) y "Antig. docente".
- **Pendiente manual**: mostrar/ocultar el bloque al cambiar la situación de revista; lectura del fieldset con lector de pantalla; impresión del listado.

## Mirror Engram

Topic `odd/antiguedad-establecimiento/tasks` en el proyecto `listo`.
