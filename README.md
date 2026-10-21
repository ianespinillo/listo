# Listo

Sistema para armar el **Listado Institucional** de docentes de **una escuela secundaria** de la Provincia de Buenos Aires, según el Decreto 900/23 de la DGCyE (coberturas cortas).

Tiene dos partes:

- **Formulario público** (`/`): los docentes se inscriben con sus datos, situación de revista, antigüedad, turnos y las materias con su puntaje del Listado Oficial.
- **Panel privado** (`/panel`): la directora elige una materia y ve el listado ya ordenado según el decreto. Desde ahí verifica puntajes y administra el ciclo lectivo y los puestos.

## Requisitos

| Qué | Versión | Para qué |
|---|---|---|
| Node.js | 24 (la usada en el desarrollo) | Servidor y build |
| pnpm | 10 o superior | Gestor de paquetes (no usar npm ni yarn) |
| Docker | cualquier versión reciente | PostgreSQL local, solo en desarrollo |
| PostgreSQL | 17 | Base de datos (en producción, instalada en el servidor) |

## Correr en local

1. Instalá las dependencias (también genera el cliente de Prisma):

   ```bash
   pnpm install
   ```

2. Creá tu archivo de configuración y completalo (los valores de ejemplo ya sirven para desarrollo):

   ```bash
   cp .env.example .env
   ```

3. Levantá las bases de datos locales:

   ```bash
   docker compose up -d
   ```

   Crea dos PostgreSQL: la de desarrollo en el puerto **5434** y la de tests en el **5433**. Se usan esos puertos y no el 5432 para no chocar con un PostgreSQL que ya tengas instalado en la máquina.

4. Creá las tablas y cargá los datos de ejemplo (ciclo activo y materias):

   ```bash
   pnpm exec prisma migrate deploy
   pnpm db:seed
   ```

5. Creá la usuaria del panel (te pide email y contraseña de al menos 8 caracteres):

   ```bash
   pnpm create-admin
   ```

6. Arrancá la aplicación:

   ```bash
   pnpm dev
   ```

   - Formulario público: <http://localhost:4200/>
   - Panel: <http://localhost:4200/panel/ingresar>

   (En desarrollo, `ng serve` usa el puerto 4200 por defecto; la API corre en el mismo servidor.)

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo con recarga |
| `pnpm build` | Compila la aplicación para producción en `dist/listo` |
| `pnpm start` | Arranca el servidor de producción (`node dist/listo/server/server.mjs`) |
| `pnpm test` | Corre los tests del servidor (Vitest) |
| `pnpm db:migrate` | `prisma migrate dev`: crea y aplica migraciones. **Solo en desarrollo** |
| `pnpm db:generate` | Regenera el cliente de Prisma |
| `pnpm db:seed` | Carga datos de ejemplo. **Solo en desarrollo** |
| `pnpm create-admin` | Crea la usuaria del panel, o le cambia la contraseña si el email ya existe |

## Tests

```bash
docker compose up -d   # necesita la base de tests en el puerto 5433
pnpm test
```

Los tests usan la base `DATABASE_URL_TEST` (puerto 5433, base `listo_test`), que es descartable (vive en memoria dentro del contenedor) y a la que los tests le aplican las migraciones antes de empezar. Hay una **protección**: si esa URL no apunta exactamente a esa base, los tests se niegan a correr, para que nunca borren datos reales.

## Estructura del proyecto

```
prisma/          Modelo de datos, migraciones y seed
scripts/         Utilidades (create-admin)
src/app/         Angular (solo navegador): inscripción y panel
src/server/      Servidor: API, lógica del decreto y acceso a la base
src/server.ts    Express: monta /api y después Angular
docs/            Requisitos, reglas de negocio, API, diseño y plan
```

`src/app` nunca importa de `src/server`. Las reglas de negocio (plazo, reemplazo de inscripciones, orden del decreto) viven solo en el servidor.

## Despliegue a producción

Hace falta un servidor con **Node.js 24**, **pnpm** y **PostgreSQL 17**, y un proxy inverso (nginx, Caddy, etc.) que sirva la aplicación por **HTTPS**. No depende de ningún proveedor en particular.

### Variables de entorno

Se definen en un archivo `.env` en la raíz del proyecto o como variables del servicio (systemd, PM2, etc.). El `.env.example` las explica una por una.

| Variable | Obligatoria | Ejemplo | Para qué |
|---|---|---|---|
| `DATABASE_URL` | Sí | `postgresql://listo:clave@localhost:5432/listo` | Conexión a PostgreSQL |
| `NODE_ENV` | Sí | `production` | Activa la cookie de sesión `secure`. Sin esto, la cookie viaja sin la marca de HTTPS |
| `NG_ALLOWED_HOSTS` | Sí | `listo.miescuela.edu.ar` | Dominios permitidos, separados por coma. Angular responde `400` a cualquier otro `Host` |
| `SCHOOL_NAME` | Recomendada | `E.E.S. N.º 12 · Morón` | Nombre de la escuela, visible en el formulario y el panel |
| `SCHOOL_CONTACT` | Recomendada | `secretaria@escuela.edu.ar` | Contacto que se muestra al docente cuando la inscripción está cerrada o falla |
| `TRUST_PROXY` | Detrás de un proxy | `1` | Cantidad de proxies de confianza, para que el límite de intentos use la IP real |
| `PORT` | No | `4000` | Puerto del servidor (por defecto 4000) |

Notas:

- **`TRUST_PROXY`**: poné la cantidad exacta de proxies entre el usuario y la aplicación (`1` con un solo nginx). Vacío lo apaga y todos los visitantes parecerían tener la IP del proxy; `true` confía en cualquier cabecera y permite falsear la IP, así que conviene evitarlo.
- **`NG_ALLOWED_HOSTS`** es el mecanismo oficial de Angular SSR. No hace falta tocar `angular.json`. El proxy tiene que reenviar el `Host` original (en nginx: `proxy_set_header Host $host;`).
- `DATABASE_URL_TEST` solo se usa en desarrollo.

### Pasos

Con el código ya clonado en el servidor y el `.env` armado (antes de instalar):

```bash
pnpm install --frozen-lockfile
pnpm exec prisma migrate deploy
pnpm build
node dist/listo/server/server.mjs      # o: pnpm start
```

- Se instala **con** las dependencias de desarrollo a propósito: el build de Angular y la CLI de Prisma las necesitan. No uses `--prod`.
- Dejá el proceso corriendo con un administrador de procesos (systemd o PM2) y apuntá el proxy inverso a `http://localhost:4000` (o el `PORT` elegido). Probalo con `GET /api/health`: tiene que responder `{"ok":true}`.
- **Nunca** corras `prisma migrate dev` ni `pnpm db:seed` en producción. `migrate dev` puede resetear la base y el seed carga datos de ejemplo. En producción solo se usa `prisma migrate deploy`.

### Crear la usuaria del panel

`pnpm create-admin` usa `tsx`, que está entre las dependencias de desarrollo; como la instalación del paso anterior las incluye, alcanza con correrlo en el servidor, desde la carpeta del proyecto y con el `.env` de producción:

```bash
pnpm create-admin
```

Si volvés a correrlo con el mismo email, cambia la contraseña. Si en tu servidor instalaste sin dependencias de desarrollo, corré el comando desde un clon con `pnpm install` completo y el `DATABASE_URL` de producción en su `.env`.

### Backups

Hacé copias de la base con regularidad (por ejemplo, una por día con cron) y guardalas fuera del servidor:

```bash
pg_dump --format=custom --file=listo-$(date +%F).dump "$DATABASE_URL"
```

Para restaurar: `pg_restore --clean --dbname="$DATABASE_URL" listo-AAAA-MM-DD.dump`.

### Actualizar a una versión nueva

```bash
git pull
pnpm install --frozen-lockfile
pnpm exec prisma migrate deploy
pnpm build
# reiniciar el proceso (systemd / PM2)
```

Conviene hacer un backup antes de aplicar migraciones.

## Documentación

| Archivo | Contenido |
|---|---|
| [`docs/requisitos.md`](docs/requisitos.md) | Qué hace cada pantalla y cada flujo |
| [`docs/reglas-de-negocio.md`](docs/reglas-de-negocio.md) | Orden del decreto, reemplazo de inscripciones, verificación y validaciones |
| [`docs/api.md`](docs/api.md) | Contrato de cada endpoint `/api/*` |
| [`docs/diseno.md`](docs/diseno.md) | Marca, tokens de diseño y pantallas |
| [`docs/plan.md`](docs/plan.md) | Etapas de implementación |

## Decisiones de negocio pendientes

Están detalladas en [`docs/reglas-de-negocio.md`](docs/reglas-de-negocio.md), sección 7. No se implementan sin confirmar con la directora:

1. **Orden para cargos** (por ejemplo, preceptor): el decreto no define las claves; por ahora se usa el mismo orden que para módulos.
2. **Desempate final** de los grupos 1 y 3: hoy es apellido y nombre, que no figura en el decreto.
3. **Acta de ofrecimiento y envío a SAD** en 48 horas: posible etapa futura.
# listo
