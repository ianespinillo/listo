# API

Todo es JSON. Las fechas sin hora van como `"AAAA-MM-DD"` y los instantes en ISO 8601.
Los puntajes van como **string con 2 decimales** (`"38.45"`), para no perder precisión;
el front los muestra con coma.

Formato de error común:

```json
{ "error": "CODIGO", "mensaje": "Texto para mostrar al usuario", "campos": { "dni": "…" } }
```

`campos` aparece solo en los errores de validación (`400 VALIDACION`). Las claves de los
elementos de la lista se escriben así: `postulaciones.1.puntaje`.

---

## Público

### `GET /api/public/status`

```json
{
  "ciclo": { "anio": 2027, "inscripcionDesde": "2027-02-01", "inscripcionHasta": "2027-02-28" },
  "abierta": true,
  "escuela": { "nombre": "E.E.S. N.º …", "contacto": "…" },
  "puestos": [ { "id": 1, "nombre": "Matemática", "tipo": "ASIGNATURA" } ]
}
```

Si no hay ciclo activo: `ciclo: null`, `abierta: false`, `puestos: []`.
`escuela` sale de las variables de entorno `ESCUELA_NOMBRE` y `ESCUELA_CONTACTO`.

### `POST /api/public/registration`

Rate limit: **10 envíos por hora por IP**. Si se supera: `429 DEMASIADOS_INTENTOS`.

```json
{
  "dni": "28.123.456",
  "apellido": "Pereyra",
  "nombre": "Laura Inés",
  "email": "Laura.Pereyra@Ejemplo.com ",
  "telefono": "11 5544 0921",
  "situacionRevista": "PROVISIONAL",
  "antiguedad": { "anios": 9, "meses": 2 },
  "turnos": ["MANANA", "TARDE"],
  "postulaciones": [
    { "puestoId": 1, "puntaje": "38,45" },
    { "puestoId": 2, "puntaje": "31.20" }
  ],
  "declaracion": true
}
```

| Respuesta | Cuándo |
|---|---|
| `201` `{ "resultado": "creada", "resumen": {…} }` | DNI nuevo en el ciclo |
| `200` `{ "resultado": "reemplazada", "resumen": {…} }` | DNI existente con el mismo email |
| `400 VALIDACION` | Datos inválidos |
| `403 INSCRIPCION_CERRADA` | Fuera de fecha o sin ciclo activo |
| `409 DATOS_NO_COINCIDEN` | DNI existente con otro email, o dado de baja |
| `429 DEMASIADOS_INTENTOS` | Rate limit |

Mensaje de `409`: "Ya existe una inscripción con ese DNI y los datos no coinciden. Si cambiaste de
email, comunicate con la escuela."

`resumen`:
```json
{
  "apellido": "Pereyra", "nombre": "Laura Inés", "dni": "28123456",
  "situacionRevista": "PROVISIONAL", "turnos": ["MANANA", "TARDE"],
  "postulaciones": [ { "puesto": "Matemática", "puntaje": "38.45" } ],
  "inscripcionHasta": "2027-02-28"
}
```

---

## Panel

Todas las rutas `/api/panel/*`, salvo `login`, requieren sesión. Sin sesión válida: `401 NO_AUTENTICADO`.

Sesión:
- Cookie `listo_sesion`: `httpOnly`, `sameSite=lax`, `secure` en producción, 7 días.
- Se guarda **el hash SHA-256 del token** en la tabla `Sesion`, nunca el token.

Las rutas que modifican datos solo aceptan `Content-Type: application/json`, como defensa básica contra CSRF.

### Sesión

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `POST /api/panel/login` | `{ "email", "password" }` | `204` + cookie · `401 CREDENCIALES_INVALIDAS` · rate limit 5/15 min por IP |
| `POST /api/panel/logout` | — | `204`, borra la sesión y la cookie |
| `GET /api/panel/session` | — | `{ "email": "…" }` o `401` |

### Listado

`GET /api/panel/listing?puestoId=1&turno=TARDE&soloVerificados=true`

`turno` y `soloVerificados` son opcionales. Si falta `puestoId`, se usa el primer puesto activo.

```json
{
  "ciclo": { "id": 3, "anio": 2027, "abierta": false },
  "puesto": { "id": 1, "nombre": "Matemática", "tipo": "ASIGNATURA" },
  "resumen": { "total": 8, "verificados": 5, "modificados": 1 },
  "grupos": [
    {
      "grupo": 1,
      "filas": [
        {
          "orden": 1, "postulanteId": 12,
          "apellido": "Gómez", "nombre": "Mariana", "dni": "22481903",
          "situacionRevista": "TITULAR", "antiguedadMeses": 256,
          "puntaje": "44.10", "turnos": ["MANANA", "TARDE"],
          "estado": "VERIFICADO", "telefono": "11 4021 3387"
        }
      ]
    },
    { "grupo": 2, "filas": [] },
    { "grupo": 3, "filas": [] }
  ]
}
```

`estado`:
- `VERIFICADO` si `verificado`.
- `MODIFICADO` si no está verificado y `modificado` es true.
- `SIN_VERIFICAR` en el resto de los casos.

Siempre vienen los 3 grupos, aunque estén vacíos.

### Postulantes

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /api/panel/applicants/:id` | — | datos + `postulaciones[]` (puesto, puntaje, puntajeAnterior, estado) + `historial[]` (fecha, tipo, puesto, detalle) |
| `PATCH /api/panel/applicants/:id` | `{ "email" }` | `200` con el postulante (el email no es único entre postulantes) |
| `POST /api/panel/applicants/:id/deactivate` | — | `204` · historial `BAJA` |
| `POST /api/panel/applicants/:id/reactivate` | — | `204` · historial `REACTIVACION` |
| `PUT /api/panel/applicants/:id/applications/:positionId/verification` | `{ "verificado": true }` | `200` con la postulación |

Editar el email registra `CAMBIO_EMAIL` en el historial. El `detalle` no guarda el email anterior.

### Puestos

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /api/panel/positions` | — | `[{ id, nombre, tipo, activo, postulantesCicloActivo }]` |
| `POST /api/panel/positions` | `{ "nombre", "tipo" }` | `201` · `409 PUESTO_DUPLICADO` |
| `PATCH /api/panel/positions/:id` | `{ "nombre"?, "tipo"?, "activo"? }` | `200` · `409 PUESTO_DUPLICADO` |

### Ciclos

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /api/panel/cycles` | — | lista, con el activo primero |
| `PATCH /api/panel/cycles/:id` | `{ "inscripcionDesde", "inscripcionHasta" }` | `200` · `400` si desde > hasta · `409 CICLO_ARCHIVADO` |
| `POST /api/panel/cycles` | `{ "anio", "inscripcionDesde", "inscripcionHasta" }` | `201`: crea el ciclo y lo deja activo (desactiva el anterior) · `409 CICLO_EXISTENTE` |
