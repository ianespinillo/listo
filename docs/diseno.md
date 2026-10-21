# Diseño

## Marca

- **Nombre**: Listo. El wordmark es "Listo" seguido de un punto en color tiza.
- **Isotipo**: un cuadrado redondeado verde con tres barras blancas de largo decreciente (el listado ordenado) y un tilde amarillo.
  - Hay que crearlo como `src/app/shared/logo/` (componente con SVG inline).
  - Ponerlo también como favicon en `public/favicon.svg`.

```svg
<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="12" fill="#1F4D3A"/>
  <rect x="10" y="12" width="24" height="5" rx="2.5" fill="#fff"/>
  <rect x="10" y="21.5" width="18" height="5" rx="2.5" fill="#fff" fill-opacity=".8"/>
  <rect x="10" y="31" width="11" height="5" rx="2.5" fill="#fff" fill-opacity=".6"/>
  <path d="M26 32.5 L30 36.5 L38.5 27" fill="none" stroke="#E8B64A" stroke-width="3.6"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

Sobre fondo verde se invierte: el cuadrado va en `--papel`, las barras en `--pizarron` y el tilde en `#C99528`.

## Tokens (`src/styles.css`)

```css
:root {
  --pizarron: #1F4D3A;        /* primario: header, botones, selección */
  --pizarron-hover: #2C624B;
  --pizarron-suave: #EEF4F0;  /* fondo de opción seleccionada, chips de turno */
  --tiza: #E8B64A;            /* acento: punto del logo, foco, tipo "Cargo" */
  --tiza-oscura: #C99528;
  --tinta: #17211B;           /* texto principal */
  --texto-2: #4A534D;         /* texto secundario */
  --texto-3: #5B655F;         /* ayudas, etiquetas chicas (pasa AA sobre blanco) */
  --papel: #F6F5F1;           /* fondo de página */
  --superficie: #FFFFFF;      /* tarjetas */
  --borde: #DAD8D0;
  --borde-input: #C9C6BC;
  --separador: #ECEAE3;

  --ok-fondo: #DCEBDF;  --ok-texto: #1F4D3A;    /* Verificado */
  --neutro-fondo: #EFEEE9; --neutro-texto: #4A534D; /* Sin verificar */
  --mod-fondo: #FBEBC4; --mod-texto: #6E4400;   /* Puntaje modificado */
  --error-fondo: #F8E1DE; --error-texto: #8F2A22; /* Errores, dar de baja */

  --radio-s: 10px;   /* inputs */
  --radio-m: 14px;   /* tarjetas chicas, botones grandes */
  --radio-l: 16px;   /* secciones */
  --radio-pill: 999px;

  --fuente-titulos: 'Bricolage Grotesque', system-ui, sans-serif;
  --fuente-texto: 'IBM Plex Sans', system-ui, sans-serif;
  --fuente-numeros: 'IBM Plex Mono', ui-monospace, monospace;
}

:focus-visible { outline: 3px solid var(--tiza); outline-offset: 2px; }
```

**Fuentes** (Google Fonts, en `index.html`): Bricolage Grotesque 500/700, IBM Plex Sans 400/500/600
e IBM Plex Mono 400/500.
- Títulos en Bricolage Grotesque 700, con `letter-spacing` levemente negativo.
- **Todos los puntajes, DNI, teléfonos y antigüedades van en IBM Plex Mono**, para que las columnas queden alineadas.

## Componentes recurrentes

- **Header** verde: logo + "Listo." + nombre de la escuela. En el panel suma la navegación (Listado / Ciclo y puestos), un badge con el estado del ciclo y "Salir".
- **Badge de estado**: pill con fondo y texto de los tokens `ok`, `neutro`, `mod` y `error`.
- **Número de grupo**: círculo de 30 px con borde `--pizarron`.
  - Grupo 1: relleno `--pizarron` y texto blanco.
  - Grupo 2: relleno `#CFE0D4` y texto `--tinta`.
  - Grupo 3: relleno blanco y texto `--pizarron`.
  - Se distinguen por luminosidad, no solo por color.
- **Chips de turno**: en el formulario son checkboxes con forma de pill (seleccionado: relleno `--pizarron`). En el listado son cuadraditos de 26 px con la inicial M/T/V y `title` con el nombre completo.
- **Fila de materia** (formulario): tarjeta con "Materia N", botón de borrar (ícono, `aria-label`), select y puntaje. Si está duplicada, borde rojo y mensaje.

## Pantallas y mockups

Los mockups están en `docs/diseno/mockups/`. Son archivos de un canvas de diseño: el HTML usa
etiquetas propias (`<x-dc>`, `<sc-for>`, `<sc-if>`, `{{variables}}`) y un `<script>` con datos de
ejemplo. **Usalos como referencia visual y de estructura** (estilos inline, jerarquía, textos). No
copies ese formato: hay que reimplementarlos como componentes Angular.

| Pantalla | Ruta Angular | Mockup |
|---|---|---|
| Marca | — | `Main.dc.html` |
| Formulario de inscripción | `/` | `Form.dc.html` |
| Inscripción enviada | `/` (estado) | `Enviado.dc.html` |
| Datos no coinciden | `/` (estado) | `NoCoincide.dc.html` |
| Inscripción cerrada | `/` (estado) | `Cerrada.dc.html` |
| Ingreso al panel | `/panel/ingresar` | `Login.dc.html` |
| Listado ordenado | `/panel` | `Listado.dc.html` |
| Detalle del postulante | `/panel/postulantes/:id` | `Detalle.dc.html` |
| Ciclo y puestos | `/panel/configuracion` | `Configuracion.dc.html` |

Enviado, No coincide y Cerrada son **estados del mismo componente** de la ruta `/`, no rutas aparte.
Así no se pierde lo cargado si el docente vuelve a revisar sus datos.

Los textos entre corchetes de los mockups (`[número]`, `[distrito]`, `[teléfono o email de la escuela]`,
`[dominio-de-la-app]`) salen de `GET /api/public/status` (`escuela`) o de la URL actual.
