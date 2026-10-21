# API

Todo es JSON. Los identificadores del contrato (campos, códigos de error, variables de entorno,
cookie) van en inglés; los textos que ve el usuario (`message`) van en español rioplatense.
Los valores de los enums del decreto quedan en español: `TITULAR`, `PROVISIONAL`, `SUPLENTE`,
`EXTERNO`, `MANANA`, `TARDE`, `VESPERTINO`, `ASIGNATURA`, `CARGO`.

Las fechas sin hora van como `"AAAA-MM-DD"` y los instantes en ISO 8601.
Los puntajes van como **string con 2 decimales** (`"38.45"`), para no perder precisión;
el front los muestra con coma.

Formato de error común:

```json
{ "error": "CODE", "message": "Texto para mostrar al usuario", "fields": { "dni": "…" } }
```

`fields` aparece solo en los errores de validación (`400 VALIDATION_ERROR`). Las claves de los
elementos de la lista se escriben así: `applications.1.score`.

Códigos de error: `VALIDATION_ERROR`, `REGISTRATION_CLOSED`, `DATA_MISMATCH`,
`TOO_MANY_REQUESTS`, `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `DUPLICATE_POSITION`,
`CYCLE_ARCHIVED`, `CYCLE_EXISTS`, `NOT_FOUND`, `DATABASE_UNAVAILABLE`.

---

## Público

### `GET /api/public/status`

```json
{
  "cycle": { "year": 2027, "registrationFrom": "2027-02-01", "registrationUntil": "2027-02-28" },
  "open": true,
  "school": { "name": "E.E.S. N.º …", "contact": "…" },
  "positions": [ { "id": 1, "name": "Matemática", "type": "ASIGNATURA" } ]
}
```

Si no hay ciclo activo: `cycle: null`, `open: false`, `positions: []`.
`school` sale de las variables de entorno `SCHOOL_NAME` y `SCHOOL_CONTACT`.

### `POST /api/public/registration`

Rate limit: **10 envíos por hora por IP**. Si se supera: `429 TOO_MANY_REQUESTS`.

```json
{
  "dni": "28.123.456",
  "lastName": "Pereyra",
  "firstName": "Laura Inés",
  "email": "Laura.Pereyra@Ejemplo.com ",
  "phone": "11 5544 0921",
  "employmentStatus": "PROVISIONAL",
  "seniority": { "years": 9, "months": 2 },
  "shifts": ["MANANA", "TARDE"],
  "applications": [
    { "positionId": 1, "score": "38,45" },
    { "positionId": 2, "score": "31.20" }
  ],
  "declaration": true
}
```

| Respuesta | Cuándo |
|---|---|
| `201` `{ "result": "created", "summary": {…} }` | DNI nuevo en el ciclo |
| `200` `{ "result": "replaced", "summary": {…} }` | DNI existente con el mismo email |
| `400 VALIDATION_ERROR` | Datos inválidos |
| `403 REGISTRATION_CLOSED` | Fuera de fecha o sin ciclo activo |
| `409 DATA_MISMATCH` | DNI existente con otro email, o dado de baja |
| `429 TOO_MANY_REQUESTS` | Rate limit |

Mensaje de `409`: "Ya existe una inscripción con ese DNI y los datos no coinciden. Si cambiaste de
email, comunicate con la escuela."

`summary`:
```json
{
  "lastName": "Pereyra", "firstName": "Laura Inés", "dni": "28123456",
  "employmentStatus": "PROVISIONAL", "shifts": ["MANANA", "TARDE"],
  "applications": [ { "position": "Matemática", "score": "38.45" } ],
  "registrationUntil": "2027-02-28"
}
```

---

## Panel

Todas las rutas `/api/panel/*`, salvo `login`, requieren sesión. Sin sesión válida: `401 UNAUTHENTICATED`.

Sesión:
- Cookie `listo_session`: `httpOnly`, `sameSite=lax`, `secure` en producción, 7 días.
- Se guarda **el hash SHA-256 del token** en la tabla `session` (modelo `Session`), nunca el token.

Las rutas que modifican datos solo aceptan `Content-Type: application/json`, como defensa básica contra CSRF.

### Sesión

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `POST /api/panel/login` | `{ "email", "password" }` | `204` + cookie · `401 INVALID_CREDENTIALS` · rate limit 5/15 min por IP |
| `POST /api/panel/logout` | — | `204`, borra la sesión y la cookie |
| `GET /api/panel/session` | — | `{ "email": "…" }` o `401` |

### Listado

`GET /api/panel/listing?positionId=1&shift=TARDE&onlyVerified=true`

`shift` y `onlyVerified` son opcionales. Si falta `positionId`, se usa el primer puesto activo.

```json
{
  "cycle": { "id": 3, "year": 2027, "open": false },
  "position": { "id": 1, "name": "Matemática", "type": "ASIGNATURA" },
  "summary": { "total": 8, "verified": 5, "modified": 1 },
  "groups": [
    {
      "group": 1,
      "rows": [
        {
          "order": 1, "applicantId": 12,
          "lastName": "Gómez", "firstName": "Mariana", "dni": "22481903",
          "employmentStatus": "TITULAR", "seniorityMonths": 256,
          "score": "44.10", "shifts": ["MANANA", "TARDE"],
          "status": "VERIFIED", "phone": "11 4021 3387"
        }
      ]
    },
    { "group": 2, "rows": [] },
    { "group": 3, "rows": [] }
  ]
}
```

`status`:
- `VERIFIED` si `verified`.
- `MODIFIED` si no está verificado y `modified` es true.
- `UNVERIFIED` en el resto de los casos.

Siempre vienen los 3 grupos, aunque estén vacíos.

### Postulantes

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /api/panel/applicants/:id` | — | datos + `applications[]` (`position`, `score`, `previousScore`, `status`) + `history[]` (`date`, `type`, `position`, `detail`) |
| `PATCH /api/panel/applicants/:id` | `{ "email" }` | `200` con el postulante (el email no es único entre postulantes) |
| `POST /api/panel/applicants/:id/deactivate` | — | `204` · historial `DEACTIVATION` |
| `POST /api/panel/applicants/:id/reactivate` | — | `204` · historial `REACTIVATION` |
| `PUT /api/panel/applicants/:id/applications/:positionId/verification` | `{ "verified": true }` | `200` con la postulación |

Editar el email registra `EMAIL_CHANGE` en el historial. El `detail` no guarda el email anterior.

Tipos de historial (`EventType`): `REGISTRATION`, `DATA_CHANGE`, `SCORE_CHANGE`,
`POSITION_ADDED`, `POSITION_REMOVED`, `VERIFICATION`, `UNVERIFICATION`, `EMAIL_CHANGE`,
`DEACTIVATION`, `REACTIVATION`.

### Puestos

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /api/panel/positions` | — | `[{ id, name, type, active, activeCycleApplicants }]` |
| `POST /api/panel/positions` | `{ "name", "type" }` | `201` · `409 DUPLICATE_POSITION` |
| `PATCH /api/panel/positions/:id` | `{ "name"?, "type"?, "active"? }` | `200` · `409 DUPLICATE_POSITION` |

### Ciclos

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /api/panel/cycles` | — | lista, con el activo primero |
| `PATCH /api/panel/cycles/:id` | `{ "registrationFrom", "registrationUntil" }` | `200` · `400` si desde > hasta · `409 CYCLE_ARCHIVED` |
| `POST /api/panel/cycles` | `{ "year", "registrationFrom", "registrationUntil" }` | `201`: crea el ciclo y lo deja activo (desactiva el anterior) · `409 CYCLE_EXISTS` |
