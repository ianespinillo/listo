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

- [ ] T1. Base visual: tokens, fuentes, logo, favicon y header público.
- [ ] T2. Servicio HTTP de la API pública (`core/`) y ruta lazy de `features/registration`.
- [ ] T3. Componente de inscripción con sus 4 estados, `FormArray` de materias, validadores y errores del servidor por campo.

## Aceptación

- Se puede inscribir, reenviar con el mismo DNI y email para reemplazar, ver el `409` con otro email y ver la pantalla de cerrada al mover las fechas del ciclo.
- Se puede navegar todo el formulario con teclado.
- Anda bien a 390 px de ancho.

## Progreso / evidencia

(pendiente)

## Mirror Engram

Topic `odd/etapa-3-formulario/tasks` en el proyecto `listo`.
