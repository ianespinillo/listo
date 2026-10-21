# Etapa 5: Panel

**Objetivo**: pantallas del panel (ingreso, listado, detalle y configuración) según los mockups, contra la API de la Etapa 4.
**Fuente**: `docs/plan.md` § Etapa 5, `docs/requisitos.md` § Panel, `docs/diseno.md`, `docs/api.md` § Panel.
**TDD**: desactivado. Chequeos: type-check, build, smoke contra el servidor y flujo de aceptación por API.
**Ruta**: delegated direct (un writer; muchos archivos no triviales).
**Rama**: `feat/etapa-5-panel` (apilada sobre `feat/etapa-4-api-panel`).

## Decisiones (huecos de los mockups)

- **Rutas**: `/panel/ingresar`, `/panel`, `/panel/postulantes/:id`, `/panel/configuracion` (en español porque son UI), todas lazy.
- **`authGuard`** consulta `GET /api/panel/session` y redirige a `/panel/ingresar`; solo maneja navegación (la protección real es del servidor). El interceptor manda al ingreso ante un `401`, salvo en el propio login y en la consulta de sesión.
- **Login**: se agrega el estado de error "Email o contraseña incorrectos" (el mockup no lo tiene) y un aviso para el `429`.
- **Detalle**: se agrega "Reactivar" cuando el postulante está dado de baja, con un aviso visible de la baja. "Dar de baja" pide confirmación. "Editar email" usa un `<dialog>` nativo.
- **Configuración**: el link del formulario es la URL real de la raíz (`origin + "/"`), no `/inscripcion` como el mockup. Los puestos muestran si están inactivos y se pueden activar o desactivar desde "Editar".
- **Rutas sin cuerpo** (`logout`, `deactivate`, `reactivate`) mandan `{}` como JSON por la guarda de `Content-Type` del servidor.
- **Impresión**: hoja `@media print` que oculta header, navegación, filtros y botones.

## Tareas

- [ ] T1. Base del panel: servicio HTTP del panel, `authGuard`, interceptor de `401`, header del panel (navegación, badge del ciclo, "Salir") y rutas.
- [ ] T2. Ingreso y listado (filtros en query params, resumen, 3 secciones, columna resaltada, impresión).
- [ ] T3. Detalle del postulante (postulaciones con verificar/quitar, historial, email, baja y reactivación).
- [ ] T4. Ciclo y puestos (fechas, archivar y abrir el siguiente, link con copiar, puestos).

## Aceptación (plan)

El flujo completo funciona: un docente se inscribe, la directora lo ve en el lugar correcto, verifica, el docente cambia su puntaje y aparece "Puntaje modificado" con el valor anterior.

## Progreso / evidencia

(pendiente)

## Mirror Engram

Topic `odd/etapa-5-panel/tasks` en el proyecto `listo`.
