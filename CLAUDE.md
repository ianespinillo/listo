# Listo — Listado institucional (Decreto 900/23)

Sistema para **una escuela secundaria** de la Provincia de Buenos Aires. Sirve para armar su
**Listado Institucional** de docentes para coberturas cortas, según el Decreto 900/23 de la DGCyE.

Tiene dos partes:
1. **Formulario público.** Los docentes se inscriben con sus datos, situación de revista,
   antigüedad, turnos y una lista de materias con su puntaje del Listado Oficial.
2. **Panel privado.** La directora elige una materia y ve el listado **ya ordenado según el
   decreto**. Desde ahí verifica puntajes y administra ciclos y puestos.

## Idioma

- **Respondé siempre en español.** El dueño del proyecto (Ian) no lee inglés.
- Toda la interfaz va en español rioplatense (vos): textos, mensajes de error y validaciones.
  Las rutas del navegador también (`/panel/ingresar`, `/panel/configuracion`), porque las ve la gente.
- **Endpoints de la API, nombres de archivos y carpetas, y el esquema de la base (tablas, columnas,
  tipos e índices) van en inglés** (`/api/public/registration`, `domain/normalize.ts`,
  `features/registration/`, tabla `applicant`). Los modelos y campos de Prisma, los campos JSON de
  la API, los códigos de error y las variables de entorno también van en inglés (`Applicant`,
  `employmentStatus`, `VALIDATION_ERROR`, `SCHOOL_NAME`) y se mapean con `@map` / `@@map`. Los valores
  de enum del decreto quedan en español (`TITULAR`, `PROVISIONAL`, `SUPLENTE`, `EXTERNO`, `MANANA`,
  `TARDE`, `VESPERTINO`, `ASIGNATURA`, `CARGO`) y los textos legibles del `message` también.
- **El código va en inglés**: variables, funciones, clases, constantes y tipos
  (`todayInBuenosAires`, `addDays`, `BCRYPT_COST`).
- Comentarios de código, mensajes de consola y mensajes de commit van en español.
- **Gestor de paquetes: pnpm.** Nunca npm ni npx (usar `pnpm`, `pnpm exec`, `pnpm dlx`).

## Documentación (leela antes de implementar)

| Archivo | Contenido |
|---|---|
| `docs/requisitos.md` | Qué hace cada pantalla y cada flujo |
| `docs/reglas-de-negocio.md` | Orden del decreto, reemplazo por DNI + email, verificación, validaciones. **La parte crítica.** |
| `docs/api.md` | Contrato de cada endpoint `/api/*` |
| `docs/diseno.md` | Marca, tokens CSS y lista de pantallas |
| `docs/diseno/mockups/*.html` | Mockups de referencia visual (formato de canvas: ver `docs/diseno.md`) |
| `docs/plan.md` | Etapas de implementación con criterios de aceptación |
| `prisma/schema.prisma` | Modelo de datos (ya definido; no cambiarlo sin consultar) |

Trabajá **etapa por etapa** siguiendo `docs/plan.md`. Al terminar cada etapa, frená, resumí qué
hiciste y esperá confirmación antes de seguir.

## Stack

- **Angular** (última versión estable) con **SSR** (`@angular/ssr`), un solo proyecto.
  - Componentes **standalone**, organizados en carpetas por feature con rutas lazy. Sin NgModules.
  - Signals para el estado y Reactive Forms para los formularios. La lista de materias es un `FormArray`.
  - Todas las rutas se renderizan en el cliente: `RenderMode.Client` en `app.routes.server.ts`.
    El servidor solo sirve la API y los estáticos.
- **Backend**: Express dentro de `src/server.ts`, que genera la CLI de Angular. Las rutas `/api/*`
  se montan **antes** del handler de Angular.
- **Prisma 7 + PostgreSQL**:
  - Generador `prisma-client`, con el cliente generado en `src/server/generated/prisma`
    (está en `.gitignore`).
  - URL de la base en `prisma.config.ts`.
  - Cliente instanciado con el adapter `@prisma/adapter-pg`.
  - El ordenamiento del decreto se hace con `$queryRaw` (SQL en `docs/reglas-de-negocio.md`).
- **Validación**: zod en el servidor. El front valida para dar feedback, pero la regla vale en el servidor.
- **Auth del panel**: una sola usuaria. Tabla `Admin` con hash bcryptjs, sesión en tabla `Session`
  y cookie `httpOnly`.
- **Tests**: Vitest para la lógica del servidor (orden, reemplazo, validaciones) contra una base de prueba.
- **Estilos**: CSS plano con variables (tokens en `docs/diseno.md`). Sin Tailwind ni librería de componentes.

## Estructura

```
prisma/
  schema.prisma
prisma.config.ts
src/
  app/                    → Angular (solo navegador)
    core/                 → servicios HTTP, authGuard, interceptores
    shared/               → componentes comunes (logo, badges, header)
    features/
      registration/       → formulario público + pantallas enviado / no coincide / cerrada
      panel/              → login, listado, detalle, ciclo y puestos
  server/                 → solo servidor; NUNCA se importa desde src/app
    db.ts                 → instancia de PrismaClient
    api/index.ts          → createApiRouter: /health, /public y /panel
    api/public.ts
    api/panel/            → sesión, listado, postulantes, puestos y ciclos
    test/                 → infraestructura de tests (base de prueba, guarda, helpers)
    domain/               → lógica pura: orden, diff de postulaciones, normalización
scripts/
  create-admin.ts         → crea o actualiza la usuaria del panel
    generated/prisma/     → cliente generado (ignorado por git)
  server.ts               → monta /api y después Angular
docker-compose.yml        → Postgres local
```

## Reglas que no se negocian

1. **`src/app` nunca importa de `src/server`.** El código de base de datos no puede terminar en el bundle del navegador.
2. **Las reglas de negocio viven en el servidor**: plazo de inscripción, DNI + email, des-verificado y orden del decreto. El front no decide nada de eso.
3. **El orden del listado sale del SQL** de `docs/reglas-de-negocio.md`. Cualquier cambio en el orden necesita un test que lo cubra.
4. **El reemplazo de una inscripción corre en una sola transacción.**
5. **El formulario público nunca devuelve datos de otra inscripción.** Tampoco el email guardado ni si coincidió el DNI o el email por separado.
6. **`/api/panel/*` valida la sesión en el servidor.** El `authGuard` de Angular solo maneja la navegación y no protege nada por sí mismo.
7. Fechas: el plazo de inscripción se evalúa en la zona horaria `America/Argentina/Buenos_Aires`, con los días desde y hasta incluidos.

## Comandos (completar cuando existan)

```bash
docker compose up -d          # Postgres local
pnpm install                  # dependencias (corre prisma generate en postinstall)
pnpm dev                      # ng serve con SSR
pnpm db:migrate               # migraciones (prisma migrate dev)
pnpm db:generate              # regenerar el cliente
pnpm db:seed                  # datos de ejemplo
pnpm create-admin             # crea la usuaria del panel (pide email y contraseña)
pnpm test                     # tests del servidor
```

## Si algo no está claro

No inventes reglas del decreto. Si una decisión de negocio no está en `docs/`, preguntá.
`docs/reglas-de-negocio.md` tiene una sección de **pendientes** con lo que todavía no está definido.
