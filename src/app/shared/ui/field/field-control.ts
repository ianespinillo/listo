import { Directive, signal } from '@angular/core';

/**
 * Marca el control (input, select, textarea) que va dentro de un `app-field`. El campo le escribe el
 * `id`, el `aria-invalid` y el `aria-describedby`; la directiva solo los publica en el elemento.
 * Es presentacional: no inyecta nada, el `app-field` la encuentra con `contentChild`.
 */
@Directive({
  selector: '[appFieldControl]',
  host: {
    '[attr.id]': 'id()',
    '[attr.aria-invalid]': 'invalid() ? "true" : null',
    '[attr.aria-describedby]': 'describedBy()',
    '[attr.aria-required]': 'required() ? "true" : null',
  },
})
export class FieldControl {
  readonly id = signal<string | null>(null);
  readonly invalid = signal(false);
  readonly describedBy = signal<string | null>(null);
  readonly required = signal(false);
}
