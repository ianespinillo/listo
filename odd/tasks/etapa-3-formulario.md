# Etapa 3: Formulario público

**Objetivo**: formulario de inscripción en `/` con sus 4 estados (formulario, enviado, no coincide, cerrada), según los mockups y contra la API de la Etapa 2.
**Fuente**: `docs/plan.md` § Etapa 3, `docs/requisitos.md` § Formulario público, `docs/diseno.md`.
**TDD**: desactivado. Sin tests de componentes (el plan no los pide); chequeos: build, type-check y smoke contra el servidor.
**Ruta**: delegated direct (un writer; 2+ archivos no triviales).
**Rama**: `feat/etapa-3-formulario` (apilada sobre `feat/etapa-2-api-publica`).

## Decisiones

- **No coincide**: se usa el mensaje neutro de `docs/api.md`. El texto del mockup "Revisá que el email sea el mismo…" **no** se usa, porque insinúa la causa (regla 5).
- **"Revisar mis datos"** (no coincide) vuelve al formulario **con lo cargado**. **"Volver al formulario"** (enviado) lo deja **vacío**: el formulario nunca precarga una inscripción anterior.
- La base visual del sitio entra en esta etapa porque es la primera pantalla: tokens en `src/styles.css`, fuentes en `index.html`, componente de logo en `src/app/shared/logo/` y `public/favicon.svg`.
- Errores sin estado propio: `429` y `500`/red se muestran como aviso arriba del botón de envío, conservando lo cargado.

## Tareas

- [x] T1. Base visual: tokens, fuentes, logo, favicon y header público. (delegated)
- [x] T2. Servicio HTTP de la API pública (`core/`) y ruta lazy de `features/registration`. (delegated)
- [x] T3. Componente de inscripción con sus 4 estados, `FormArray` de materias, validadores y errores del servidor por campo. (delegated; falta prueba manual en navegador)

## Aceptación

- Se puede inscribir, reenviar con el mismo DNI y email para reemplazar, ver el `409` con otro email y ver la pantalla de cerrada al mover las fechas del ciclo.
- Se puede navegar todo el formulario con teclado.
- Anda bien a 390 px de ancho.

## Progreso / evidencia

- Commit `b35026f` (T1–T3). `tsc -p tsconfig.app.json` sin errores; `pnpm build` OK sin warnings (inicial 277 kB, chunk lazy de inscripción 89 kB).
- Smoke: `/` 200 con fuentes y `favicon.svg`; `/favicon.svg` 200 `image/svg+xml`; `/api/public/status` 200.
- Estático: los 12 inputs/selects tienen label; el botón de quitar materia tiene `aria-label`.
- Desvíos: texto de corrección en "Enviado" reescrito; estado "cerrada" distingue "terminó" de "todavía no abrió"; optgroups Asignaturas/Cargos; aviso si no hay puestos.
- Fix de la Etapa 2 en esta rama: `95d5709` (`TRUST_PROXY=false` rompía el arranque; verificado tras recompilar).
- **Pendiente (manual, navegador)**: 390 px y escritorio; navegación con teclado; alta → reemplazo → 409; cerrada (terminó / no abrió); errores 400 por campo y 429; materia repetida; consola sin errores (app sin zone.js).

## Mirror Engram

Topic `odd/etapa-3-formulario/tasks` en el proyecto `listo`.
