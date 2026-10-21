# Componentización del front

**Objetivo**: separar contenedores y componentes presentacionales, extraer `shared/ui` y unificar estilos, sin cambiar comportamiento visible. Sumar un resolver solo en el detalle del postulante.
**Problema / por qué**: pedido del usuario (2026-10-21). Los componentes de registro, detalle y configuración concentran todo. Hay duplicación: field con error repetido más de 20 veces, carga/error/reintento 4 veces, `<dialog>` 4 veces, y dos vocabularios de estilos (`.btn`/`.pbtn`, `.card`/`.p-card`).
**TDD**: desactivado. Chequeos por tramo: `tsc` app, `pnpm build` sin warnings, `pnpm test` (servidor), y tests de componentes nuevos donde aporten.
**Ruta**: delegated direct, un writer por grupo de tramos, siempre secuencial (mismos archivos).
**Rama**: `feat/componentizacion` (apilada sobre `feat/antiguedad-establecimiento`).

## Decisiones

- **Sin Angular Material.** Contradice la regla de `CLAUDE.md` ("sin librería de componentes"), aleja el diseño de los mockups y pesa. Se evaluó solo `@angular/cdk` como alternativa; queda en espera hasta ver si el `app-dialog` propio alcanza.
- **Resolver solo en el detalle** (`/panel/postulantes/:id`):
  - `ResolveFn` que devuelve una unión `ok | notFound | error` y nunca lanza.
  - El dato se recibe como input con `withComponentInputBinding()`.
  - Hay una barra de progreso del router en el shell del panel.
  - Listado, registro y configuración siguen cargando dentro del componente: necesitan reintento, recargas tras acciones y no bloquear con cada filtro.
- **Contenedor/presentacional**:
  - Los contenedores inyectan servicios y manejan estado.
  - Los presentacionales usan solo `input()`, `output()` y `model()`, sin servicios.
  - Las secciones de formularios reactivos reciben su `FormGroup` por input.
- **Sin cambios visuales ni de contrato**: los textos, la accesibilidad y las rutas se mantienen.
- Heurística de ~400 líneas por tramo como guía, no como tope.

## Tareas (tramos)

- [x] T1. Lógica pura unificada: formateadores, etiquetas, `EMAIL_PATTERN`, `todayInBuenosAires` en `core/format`; helpers de errores de formulario. (delegated; `58f996c`)
- [x] T2. Estilos unificados: un solo vocabulario de botones, tarjetas, alertas y badges en `styles.css`. (delegated; `958528a`)
- [x] T3. `shared/ui` base: `field` (+ directiva de a11y del control), `alert`, `empty-state`, `load-state`, `status-badge`, `type-badge`, `group-circle`, `shift-chips`. (delegated; `314d0fd`)
- [x] T4. `app-dialog` y migración de los 4 diálogos. (delegated; `46d1ad1`)
- [ ] T5. Configuración dividida (`cycle-card`, `form-link-card`, `archived-cycles`, `positions-table`, `position-dialog`, `archive-dialog`).
- [ ] T6. Detalle dividido (`applicant-header`, `application-card`, `history-list`, diálogos) + resolver + barra de progreso.
- [ ] T7. Listado dividido (`listing-filters`, `listing-group`, `listing-row`).
- [ ] T8. Registro dividido (secciones, fila de materia, estados enviado/no coincide/cerrada).

## Aceptación

- Mismo comportamiento y aspecto que antes; `tsc`, build y tests en verde.
- Ningún componente presentacional inyecta servicios.
- Sin duplicación del bloque field ni de los estados de carga.

## Progreso / evidencia

- T1–T4: `tsc` sin errores y build sin warnings tras cada tramo (bundle inicial 303,8 → 308,9 kB, por estilos movidos a `styles.css`). `pnpm test` 159/159. Sin `inject(` en `shared/ui`.
- Duplicación: `class="error"` en features 27 → 0; `aria-describedby` en features 24 → 7 (fieldsets y diálogos, intencionales).
- Comparación visual del writer con Chrome headless contra una API simulada (build viejo vs nuevo, todas las pantallas, diálogos, móvil, impresión): capturas idénticas salvo antialiasing en esquinas de botones grandes; foco y relaciones ARIA idénticos.
- Commits reconstruidos por tramo desde las fotos del writer; estado final verificado byte a byte contra el respaldo.
- `angular.json`: `cli.analytics = false` commiteado (`f4ae111`) para que la CLI no escriba IDs de máquina.
- T5–T8 incluyen dos observaciones del review de la etapa 6: el aviso "Se guardó, pero…" que nunca se limpia y la carga duplicada del detalle.

## Mirror Engram

Topic `odd/componentizacion/tasks` en el proyecto `listo`.
