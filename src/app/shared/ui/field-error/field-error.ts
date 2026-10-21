import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Mensaje de error de un campo (`<p class="error">`). Sirve solo, para los grupos (fieldset) y las
 * filas que arman su propio `aria-describedby`; `app-field` lo usa por dentro.
 * No renderiza nada si no hay mensaje.
 */
@Component({
  selector: 'app-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as text) {
      <p class="error" [attr.id]="elementId()" [attr.role]="announce()">{{ text }}</p>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class FieldError {
  /** Texto del error; null u vacío = no se muestra. */
  readonly message = input<string | null | undefined>(null);
  /** `id` del párrafo, para que un `aria-describedby` lo pueda nombrar. */
  readonly elementId = input<string | null>(null);
  /** 'alert' para que el lector lo anuncie apenas aparece. */
  readonly announce = input<'alert' | null>(null);
}
