# Etapa 0: Proyecto base

**Objetivo**: proyecto Angular 22 con SSR en la carpeta actual, con Express + Prisma 7 listos y un `GET /api/salud`.
**Fuente**: `docs/plan.md` § Etapa 0.
**TDD**: desactivado (no hay configuración de proyecto). Chequeos funcionales comunes.
**Ruta**: delegated direct (un writer; toca 2+ archivos no triviales).

## Restricciones

- No pisar `CLAUDE.md`, `docs/`, `prisma/`, `docker-compose.yml`, `PRIMER-PROMPT.md`.
- `.gitignore`: fusionar con el existente.
- pnpm como gestor de paquetes. Endpoints y nombres de archivos en inglés; UI en español (pedido del usuario, ya reflejado en `CLAUDE.md` y `docs/`).
- Prisma fijado en 7.10.1 (el tag `latest` de npm apunta a 8.0 rc).
- `src/app` nunca importa de `src/server`.
- Sin commits: `listo` no tiene repo propio (el repo raíz es la carpeta `GitHub/`). Pendiente de decisión del usuario.

## Tareas

- [x] T1. Generar Angular 22 con SSR (CSS, sin tests, sin git) y moverlo a la carpeta. Fusionar `.gitignore`. `RenderMode.Client` para todas las rutas. (delegated)
- [x] T2. Dependencias, `prisma.config.ts`, `.env.example`, `src/server/db.ts`, `vitest.config.mts`. (delegated)
- [x] T3. `server.ts` con `express.json()`, `cookie-parser` y `GET /api/health`. Scripts de `package.json`. Build OK. (delegated; corrección inline del orden de montaje)

## Aceptación

- `docker compose up -d` + `pnpm exec prisma migrate dev --name inicial` crean las tablas.
- `pnpm dev` levanta y `GET /api/health` devuelve `{ ok: true }`.
- `pnpm build` termina sin errores.
- Ningún archivo de `src/app` importa de `src/server`.

## Progreso / evidencia

- `pnpm build`: OK, sin `externalDependencies` (Angular empaqueta `pg` y el cliente de Prisma, incluido el wasm).
- Servidor de producción: `/` → 200 HTML; `/api/health` → 503 JSON `BASE_NO_DISPONIBLE` (sin base); `/api/no-existe` → 404 JSON.
- `pnpm dev`: sirve `/api/health` desde `server.ts` (verificado por el writer).
- `pnpm test`: exit 0 (sin tests todavía). `prisma validate`: OK.
- Ningún import de `src/app` hacia `src/server`.
- Corrección: el writer había agregado la API al final de `server.ts` (después de Angular). Se reordenó: `json` → `cookieParser` → `/api` → estáticos → Angular.
- `vitest.config.ts` → `.mts` (warning de ESM en CJS).
- `angular.json`: `security.allowedHosts: ["localhost", "127.0.0.1"]` (Angular 22 bloqueaba el header Host). Agregar el dominio real al desplegar.
- Sin verificar: `docker compose up -d`, `prisma migrate dev --name inicial` y `{ ok: true }` (Docker apagado).
- Review nativo: preflight inválido porque el repo raíz es la carpeta `GitHub/` (contiene otros repos). Sin commits.

## Siguiente paso

Decidir el repo de `listo`; después, el usuario prueba con Docker y se pasa a la Etapa 1.

## Mirror Engram

Pendiente: Engram detecta el proyecto como `github` (raíz git de la carpeta padre). Se sincroniza cuando se resuelva el repo.
