# Etapa 1: Datos

**Objetivo**: un solo ciclo activo garantizado por la base, seed idempotente y script para crear la usuaria del panel.
**Fuente**: `docs/plan.md` § Etapa 1.
**TDD**: desactivado (sin configuración de proyecto). Chequeos funcionales contra la base de Docker (`localhost:5434`).
**Ruta**: delegated direct (un writer; 2+ archivos no triviales).
**Rama**: `feat/etapa-1-datos` (apilada sobre `feat/etapa-0-proyecto-base`).

## Decisiones

- **Índice de ciclo activo en el schema, no en SQL manual.** Prisma 7.10 tiene el preview `partialIndexes`.
  Un índice parcial creado a mano lo borra la próxima migración que genere Prisma (issue prisma#29289).
  Si el preview no funciona, se vuelve a la migración manual y se reporta.
- **Plazo del seed**: desde hoy (fecha de Buenos Aires) hasta hoy + 29 días, o sea 30 días contando los dos extremos.
- **Puestos del seed**: unión de los puestos de los mockups `Form` y `Configuracion`. El cargo se llama "Preceptor/a" y es de tipo `CARGO`.
- Esquema de la base en inglés (commit `5309469`). Postgres de Docker en el puerto 5434.

## Tareas

- [x] T1. Índice único parcial `cycle_single_active` sobre `cycle(active) WHERE active` y migración. Verificar que una segunda generación no produce drift. (delegated)
- [x] T2. `prisma/seed.ts` idempotente: ciclo del año siguiente activo (desactiva los demás en la misma transacción) y puestos de los mockups. (delegated)
- [x] T3. `scripts/create-admin.ts`: pide email y contraseña (oculta) por consola, guarda el hash bcryptjs y actualiza la contraseña si el email ya existe. (delegated; entrada interactiva sin probar en terminal real)

## Aceptación

- El seed se puede correr dos veces sin duplicar datos.
- `pnpm create-admin` funciona (crea y, con el mismo email, actualiza).
- La base rechaza un segundo ciclo activo.

## Progreso / evidencia

- Schema: `previewFeatures = ["partialIndexes"]` y `@@unique([activo], map: "cycle_single_active", where: { activo: true })`.
  SQL generado: `CREATE UNIQUE INDEX "cycle_single_active" ON "cycle"("active") WHERE ("active" = true);`
- `prisma migrate dev` no genera la migración sin terminal interactiva (avisa "unique constraint will be added"). Se generó con `prisma migrate diff` (SQL de Prisma, no manual) y se aplicó con `migrate deploy`.
- `migrate diff --exit-code`: sin diferencias. `migrate status`: al día. `migrate deploy` limpio en la base de tests: OK, índice creado.
- Seed dos veces: 1 ciclo (2027, 2026-10-21 → 2026-11-19, activo) y 11 puestos (10 asignaturas + "Preceptor/a" como CARGO), sin duplicados.
- Segundo ciclo activo: rechazado por `cycle_single_active`.
- `create-admin` (modo no interactivo con `ADMIN_EMAIL`/`ADMIN_PASSWORD`): crea, actualiza, rechaza clave corta con exit 1. Admin de prueba borrado.
- `pnpm build` OK; `pnpm test` exit 0; sin imports de `src/app` a `src/server`.
- Pendiente: probar `pnpm create-admin` interactivo (contraseña oculta) en PowerShell.
- A pedido del usuario, los identificadores del código nuevo están en inglés (`todayInBuenosAires`, `addDays`).

## Mirror Engram

Topic `odd/etapa-1-datos/tasks` en el proyecto `listo`.
