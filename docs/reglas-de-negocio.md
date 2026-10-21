# Reglas de negocio

## 1. Qué dice el Decreto 900/23

Fuente: https://normas.gba.gob.ar/documentos/xqOpp9fp.html. Modifica los arts. 107 C y 108 C del
Anexo I del Decreto 2485/92, que reglamenta el Estatuto del Docente (Ley 10.579).

- Se designan docentes "a cargo" para ausencias de **2 días hábiles a 12 días corridos**, o cuando la licencia abarca todas las horas o módulos de ese período.
- Para **cargos** se usan los listados oficiales y complementarios por establecimiento.
- Para **módulos y horas cátedra**, la prioridad es:
  1. **Titulares del establecimiento**, por **antigüedad docente**.
  2. **Provisionales y suplentes**, en igualdad de condiciones, por **puntaje**. Si empatan, por **antigüedad**.
  3. **Cualquier docente en actividad**, según el **Listado Oficial** o los complementarios del distrito, es decir, por **puntaje**.
- La directora tiene 48 h para mandar la designación a la Secretaría de Asuntos Docentes. Ese trámite queda **fuera del sistema** por ahora.

Este sistema es el **Listado Institucional** de la escuela. El "Listado In Fine" que existe en la
plataforma @abc es otra cosa y no se integra.

## 2. Orden del listado

`group_number` según la situación de revista:

| employmentStatus | group_number |
|---|---|
| `TITULAR` | 1 |
| `PROVISIONAL`, `SUPLENTE` | 2 |
| `EXTERNO` | 3 |

Claves de orden dentro de cada grupo (`score` = puntaje, `seniority` = antigüedad):

| Grupo | 1.ª clave | 2.ª clave | Desempate final (*) |
|---|---|---|---|
| 1 | antigüedad ↓ | — | apellido, nombre, id |
| 2 | puntaje ↓ | antigüedad ↓ | apellido, nombre, id |
| 3 | puntaje ↓ | — | apellido, nombre, id |

(*) El desempate final **no está en el decreto**. Está solo para que el orden sea estable.
Ver pendientes.

El **número de orden** es global: va de 1 a N recorriendo grupo 1, después 2 y después 3.

### SQL (usar con `prisma.$queryRaw`, parametrizado)

Los nombres de tablas, columnas y tipos de la base están en inglés: son los del `@@map` / `@map`
de `prisma/schema.prisma`. Los modelos y campos de Prisma también están en inglés (`Applicant`, `employmentStatus`, `score`…); solo los valores de los enums del decreto quedan en español.

```sql
WITH base AS (
  SELECT
    a.id, a.last_name, a.first_name, a.dni, a.phone,
    a.employment_status, a.seniority_months, a.shifts,
    ap.score, ap.verified, ap.modified, ap.previous_score,
    CASE a.employment_status
      WHEN 'TITULAR'     THEN 1
      WHEN 'PROVISIONAL' THEN 2
      WHEN 'SUPLENTE'    THEN 2
      ELSE 3
    END AS group_number
  FROM application ap
  JOIN applicant   a ON a.id = ap.applicant_id
  WHERE ap.position_id = ${positionId}
    AND a.cycle_id     = ${cycleId}
    AND a.deactivated  = false
    AND (${shift}::text IS NULL OR ${shift}::shift = ANY (a.shifts))
    AND (${onlyVerified} = false OR ap.verified = true)
)
SELECT
  base.*,
  ROW_NUMBER() OVER (
    ORDER BY
      group_number,
      CASE WHEN group_number = 1      THEN seniority_months END DESC NULLS LAST,
      CASE WHEN group_number IN (2,3) THEN score            END DESC NULLS LAST,
      CASE WHEN group_number = 2      THEN seniority_months END DESC NULLS LAST,
      last_name, first_name, id
  ) AS list_order
FROM base
ORDER BY list_order;
```

Notas:
- Usar el tagged template de `$queryRaw` (nunca `$queryRawUnsafe`) para que los parámetros vayan escapados.
- El enum `Shift` se llama `shift` en la base (`@@map`); revisar el cast contra la migración.
- Los `Decimal` de Prisma y los `bigint` de `ROW_NUMBER` hay que convertirlos antes de mandarlos como JSON.
- Ordenar con "Solo verificados" es filtrar antes de numerar, así que el orden se renumera. Es lo esperado: la directora ve a quién llamar entre los verificados.

### Tests obligatorios del orden

- Un titular con menos puntaje queda antes que un provisional con más puntaje.
- Provisional y suplente con el mismo puntaje: va primero el de más antigüedad, sin importar cuál es provisional y cuál suplente.
- Un externo con puntaje alto queda después de todo el grupo 2.
- Dentro del grupo 1, el puntaje no influye.
- El filtro por turno y "solo verificados" excluyen bien y el número de orden se recalcula.
- Los dados de baja no aparecen.

## 3. Inscripción y reemplazo (`POST /api/public/registration`)

### Normalización (antes de validar)
- `dni`: se quitan todos los caracteres que no son dígitos.
- `email`: `trim().toLowerCase()`.
- `score`: se acepta `"38,45"` o `"38.45"`, se reemplaza la coma por punto y se convierte a Decimal con 2 decimales.
- `seniorityMonths = years * 12 + months`.
- Textos: `trim()` y espacios internos múltiples colapsados en uno.

### Algoritmo (todo en UNA transacción)

"Historial" es el modelo `HistoryEvent` (tabla `event`). Cada evento lleva su `type`, el `positionId` cuando aplica y un
`detail` JSON con el valor anterior y el nuevo.

1. Buscar el ciclo activo. Si no hay ciclo activo, o si hoy (en `America/Argentina/Buenos_Aires`) está fuera de `[registrationFrom, registrationUntil]`, responder `403 REGISTRATION_CLOSED`.
2. Validar que todos los `positionId` existan, estén activos y no se repitan. Si no, `400`.
3. Buscar el postulante (`Applicant`) por `(cycleId, dni)`.
4. **No existe**: crear el postulante y sus postulaciones (`verified=false`, `modified=false`). Historial: `REGISTRATION`. Responder `201`.
5. **Existe y está dado de baja**: responder `409 DATA_MISMATCH`, con el mismo cuerpo que el caso siguiente.
6. **Existe y el email no coincide**: responder `409 DATA_MISMATCH`.
7. **Existe y el email coincide**: reemplazar.
   - Actualizar `lastName`, `firstName`, `phone` y `shifts`.
   - Si cambió `employmentStatus` o `seniorityMonths`: actualizar, registrar `DATA_CHANGE` en el historial (valor anterior y nuevo en `detail`) y **poner `verified=false` en todas sus postulaciones**, porque cambiaron datos que definen el orden.
   - Comparar las postulaciones viejas con las nuevas, por `positionId`:
     - **Sigue con el mismo puntaje**: no se toca y conserva su verificación.
     - **Sigue con otro puntaje**: `previousScore = score viejo`, se asigna el `score` nuevo, `verified=false`, `modified=true`. Historial: `SCORE_CHANGE`.
     - **Puesto nuevo**: se crea con `verified=false`. Historial: `POSITION_ADDED`.
     - **Ya no está**: se borra. Historial: `POSITION_REMOVED`.
   - Responder `200`.
8. La respuesta exitosa trae el resumen de lo guardado, que es lo que muestra la pantalla "Enviado".

### Qué revela la respuesta
- Un `409` deja ver, inevitablemente, que **ese DNI ya está inscripto**: si no lo estuviera, el envío habría funcionado. No hay forma de evitarlo sin pedir otro secreto. Se mitiga con rate limit.
- Lo que **nunca** se revela: el email guardado, los datos de la inscripción existente, ni si el problema fue el email o que está dado de baja.

## 4. Verificación (panel)

- **Marcar verificado**: `verified=true`, `modified=false`, `previousScore=null`. Historial: `VERIFICATION`.
- **Quitar verificación**: `verified=false`. Historial: `UNVERIFICATION`.

## 5. Ciclos

- Hay **un solo ciclo activo** a la vez. Activar uno desactiva los demás, dentro de la misma transacción.
- `registrationFrom <= registrationUntil`, y las dos fechas son obligatorias.
- "Abierta" se calcula; no es un campo guardado.
- Los ciclos archivados se pueden consultar pero no se editan.

## 6. Puestos

- `name` único sin distinguir mayúsculas y minúsculas.
- Un puesto con postulaciones no se borra, solo se desactiva (`active=false`). Los inactivos no aparecen en el formulario, pero sí en el panel (marcados como inactivos) mientras tengan postulaciones.

## 7. Pendientes (no implementar sin confirmar)

1. **Orden para cargos** (por ejemplo, preceptor). El decreto solo dice "listados por establecimiento" y no define claves. Por ahora se usa el mismo orden que para módulos. Confirmar con la directora.
2. **Desempate final** del grupo 1 y del grupo 3: hoy es apellido y nombre, que no está en el decreto. Confirmar con la directora qué usa en la práctica.
3. **Acta de ofrecimiento / envío a SAD** en 48 h: posible etapa futura.
