# Plan de implementación

Una etapa por vez. Al terminar cada una: resumir qué se hizo, cómo probarlo y esperar el OK.

## Etapa 0: Proyecto base

- Crear el proyecto Angular con SSR **en la carpeta actual**, sin pisar los archivos existentes:
  - `ng new` con `--ssr`, estilos CSS y sin tests de ejemplo de más.
  - Si `ng new` no deja crear sobre una carpeta con archivos, generarlo en una carpeta temporal y mover el contenido.
  - El `.gitignore` que genera Angular se **fusiona** con el existente (`.env` y `src/server/generated/`), no lo reemplaza.
- Configurar `app.routes.server.ts` con `RenderMode.Client` para todas las rutas.
- Instalar `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `zod`, `bcryptjs`, `cookie-parser`, `express-rate-limit`, `dotenv` y `vitest`.
- Crear `prisma.config.ts` (lee `DATABASE_URL`) y usar el `prisma/schema.prisma` existente.
- Crear `src/server/db.ts` con `PrismaClient` + `PrismaPg`.
- En `server.ts`: `express.json()`, `cookie-parser` y un `GET /api/health` que responda `{ ok: true }` consultando la base (`SELECT 1`). Todo montado antes del handler de Angular.
- Si el build de SSR falla al empaquetar `pg` o el cliente de Prisma, agregarlos a `externalDependencies` en `angular.json`.
- Scripts en `package.json`: `dev`, `build`, `start`, `test`, `db:migrate`, `db:generate`, `db:seed`, `create-admin`.

**Aceptación**:
- `docker compose up -d` + `pnpm exec prisma migrate dev --name inicial` crean las tablas.
- `pnpm dev` levanta y `GET /api/health` devuelve `{ ok: true }`.
- `pnpm build` termina sin errores.
- Ningún archivo de `src/app` importa de `src/server`.

## Etapa 1: Datos

- `prisma/seed.ts`: ciclo del año siguiente activo, con inscripción abierta desde hoy por 30 días, y los puestos de ejemplo de los mockups.
- `scripts/create-admin.ts`: pide email y contraseña por consola (la contraseña sin mostrarla), guarda el hash con bcryptjs y, si el email ya existe, actualiza la contraseña.
- Garantizar un solo ciclo activo. Opción recomendada: índice único parcial en una migración SQL manual, `CREATE UNIQUE INDEX cycle_single_active ON cycle (active) WHERE active;`.

**Aceptación**: el seed se puede correr dos veces sin duplicar datos, y `create-admin` funciona.

## Etapa 2: API pública

- `src/server/domain/`:
  - `normalize.ts`.
  - `diff-applications.ts`: función **pura** que, dado lo viejo y lo nuevo, devuelve qué crear, actualizar, borrar y qué eventos de historial registrar.
  - `registration-window.ts`: función que dice si la inscripción está abierta para una fecha y zona horaria.
- `GET /api/public/status` y `POST /api/public/registration` según `api.md` y `reglas-de-negocio.md` §3.
- Rate limit en el POST.
- Tests (Vitest):
  - Normalización.
  - `diff-applications`: sin cambios, cambio de puntaje, alta, baja y cambio de situación.
  - Plazo: bordes de día en hora argentina.
  - Integración del POST: crear, reemplazar con el mismo email, `409` con otro email, `409` con dado de baja, `403` cerrado, `400` con puesto repetido.

**Aceptación**: todos los tests pasan y el `409` no filtra ningún dato.

## Etapa 3: Formulario público

- `features/registration`: un componente con 4 estados (formulario, enviado, no coincide, cerrada), según los mockups.
- Reactive Forms con `FormArray` para las materias:
  - Agregar y quitar filas, con mínimo 1.
  - Validador de puestos repetidos.
  - El puntaje acepta coma.
- Los errores `400` del servidor (`campos`) se muestran junto a cada campo.
- Probar a 390 px de ancho, que es el caso principal.

**Aceptación**:
- Se puede inscribir, reenviar con el mismo DNI y email para reemplazar, ver el `409` con otro email y ver la pantalla de cerrada al mover las fechas del ciclo.
- Se puede navegar todo el formulario con teclado.

## Etapa 4: API del panel

- Login, logout y sesión. Middleware `requiereSesion` para `/api/panel/*`.
- `GET /api/panel/listing` con el SQL de `reglas-de-negocio.md` §2.
- Detalle, edición de email, baja y reactivación, verificación.
- Puestos y ciclos.
- Tests:
  - **Todos los casos de orden** de `reglas-de-negocio.md` §2.
  - Verificación: limpia `modificado` y `puntajeAnterior`.
  - Rutas sin sesión: `401`.
  - Activar un ciclo desactiva el anterior.

## Etapa 5: Panel

- `features/panel`: ingreso, listado, detalle y configuración, según los mockups.
- `authGuard` (redirige a `/panel/ingresar`) y un interceptor que, ante un `401`, manda al ingreso.
- Filtros del listado sincronizados con los query params, para que un listado filtrado se pueda compartir o recargar.
- Hoja de estilos de impresión para "Imprimir listado".

**Aceptación**: el flujo completo funciona. Un docente se inscribe, la directora lo ve en el lugar correcto, verifica, el docente cambia su puntaje y aparece "Puntaje modificado" con el valor anterior.

## Etapa 6: Pulido y despliegue

- Revisar accesibilidad: labels, foco, contraste y `aria-label` en botones de ícono.
- Variables de entorno de producción documentadas en el README.
- README en español: requisitos, cómo correr en local y cómo desplegar (necesita un servidor Node + PostgreSQL).
