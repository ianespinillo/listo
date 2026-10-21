# Requisitos

## Contexto

- **Una sola escuela secundaria** de PBA, con un solo despliegue (single-tenant).
- El listado tiene **vigencia por ciclo lectivo**. Cada año se abre un ciclo nuevo y los docentes se reinscriben.
- Hay dos tipos de usuario:
  - **Docente**: anónimo, sin cuenta. Usa solo el formulario.
  - **Directora**: única usuaria del panel, con email y contraseña.
- Queda **fuera del alcance** el personal auxiliar (porteros, cocina), que no está en el Estatuto Docente.

## Formulario público (`/`)

### Campos

| Campo | Tipo | Reglas |
|---|---|---|
| Apellido | texto | obligatorio, 1–80 |
| Nombre | texto | obligatorio, 1–80 |
| DNI | texto | obligatorio, solo dígitos (se descartan puntos y espacios), 7–8 dígitos |
| Email | email | obligatorio. Se guarda normalizado (`trim` + minúsculas) |
| Teléfono | texto | obligatorio, 6–30 caracteres |
| Situación de revista **en esta escuela** | radio | `TITULAR` · `PROVISIONAL` · `SUPLENTE` · `EXTERNO` ("No trabajo en esta escuela") |
| Antigüedad docente | años + meses | enteros; años 0–60, meses 0–11. Se guarda como total de meses |
| Turnos disponibles | checkboxes | al menos uno: `MANANA` · `TARDE` · `VESPERTINO` |
| Materias y puntajes | lista dinámica | ver abajo |
| Declaración | checkbox | obligatorio: "Declaro que los datos son correctos…" |

### Lista de materias (estilo ToDo)

- Cada fila tiene **materia o cargo** (select con los puestos activos) y **puntaje** (decimal, acepta coma o punto).
- Botón "Agregar materia" para sumar una fila, y un botón por fila para quitarla. Siempre queda al menos una fila.
- No se puede repetir un puesto. Si se repite, la fila se marca con error: "Esta materia ya está en tu lista."
- Puntaje entre 0 y 999,99, con dos decimales como máximo.

### Comportamiento

- Al cargar, `GET /api/public/status` trae el ciclo, si la inscripción está abierta y los puestos.
- **Inscripción cerrada** (fuera de fechas o sin ciclo activo): se muestra la pantalla "La inscripción está cerrada" en lugar del formulario.
- **Enviar** (`POST /api/public/registration`):
  - DNI nuevo en el ciclo: se crea la inscripción y se pasa a la pantalla **Enviado**.
  - DNI existente con el mismo email: **se reemplaza la inscripción completa** y se pasa a **Enviado**, con el mismo texto.
  - DNI existente con otro email: pantalla **No coincide**, con mensaje genérico y el contacto de la escuela.
  - Error de validación: errores junto a cada campo. El formulario conserva lo cargado.
- El formulario **nunca precarga** datos anteriores. Para modificar, el docente vuelve a cargar todo.
- La pantalla **Enviado** muestra el resumen de lo que se acaba de enviar (lo que devuelve el POST) y recuerda que se puede corregir reenviando antes de la fecha de cierre.

## Panel (`/panel`)

### Ingreso (`/panel/ingresar`)
- Email y contraseña. Si falla, se muestra un error genérico: "Email o contraseña incorrectos".

### Listado (`/panel`), la pantalla principal
- **Filtros**:
  - Materia o cargo: select, obligatorio. Por defecto, el primer puesto activo.
  - Turno: Todos / Mañana / Tarde / Vespertino.
  - "Solo verificados": checkbox.
- **Resumen** arriba: total de postulantes, verificados y con puntaje modificado.
- **Tres secciones**, una por grupo del decreto. Cada una tiene un título y una línea que explica su regla de orden.
- **Columnas**: Orden (número global de 1 a N, continúa entre grupos), Docente (apellido, nombre y DNI), Situación, Antigüedad ("9 a 2 m"), Puntaje, Turnos (M/T/V), Estado, Teléfono y un botón "Ver".
- En cada grupo se resalta la columna que define el orden: antigüedad en el grupo 1, puntaje en los grupos 2 y 3.
- **Estado** de la postulación:
  - Verificado.
  - Sin verificar.
  - Puntaje modificado: sin verificar y con un cambio de puntaje posterior a la última verificación.
- Los postulantes dados de baja no aparecen.
- **"Imprimir listado"** usa `window.print()` con una hoja de estilos de impresión que oculta header y filtros.

### Detalle del postulante (`/panel/postulantes/:id`)
- Datos personales, situación, antigüedad y turnos.
- **Postulaciones**: cada materia con su puntaje, el puntaje anterior si cambió, su estado y el botón "Marcar verificado" o "Quitar verificación".
- **Historial**: eventos en orden cronológico inverso.
- Acciones:
  - **Editar email**, para cuando el docente cambió de email y no puede reemplazar su inscripción.
  - **Dar de baja** y **Reactivar**.

### Ciclo y puestos (`/panel/configuracion`)
- **Ciclo activo**:
  - Año y fechas de inscripción, editables (desde y hasta).
  - Estado: abierta o cerrada, calculado a partir de las fechas.
  - "Archivar ciclo y abrir AAAA+1": crea el ciclo siguiente, lo activa y pide las fechas. Los ciclos archivados no se borran.
- **Link del formulario** con un botón para copiarlo.
- **Puestos**:
  - Tabla con nombre, tipo (Asignatura / Cargo), cantidad de postulantes en el ciclo activo y acción de editar.
  - Botón para agregar puesto.
  - Un puesto con postulaciones **no se borra**: se desactiva y deja de aparecer en el formulario.

## No funcionales

- El formulario público tiene que andar bien en celular, que es como lo va a usar la mayoría de los docentes.
- Accesibilidad:
  - `<label>` real en cada campo y botones reales.
  - Foco visible.
  - Contraste AA.
  - Áreas táctiles de 44 px o más.
- Rate limit en `POST /api/public/registration` y en `POST /api/panel/login`. Ver `api.md`.
