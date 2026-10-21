import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  contentChild,
  effect,
  input,
} from '@angular/core';
import { FieldError } from '../field-error/field-error';
import { FieldControl } from './field-control';

/**
 * Campo de formulario: etiqueta, control proyectado (con `appFieldControl`), ayuda y error.
 *
 * El campo le pone al control el `id` (`controlId`), el `aria-invalid` y el `aria-describedby`
 * (ayuda y error). Los ids de ayuda y error son `<controlId>-hint` y `<controlId>-error`.
 * El host es el `.field` de `styles.css`, así que acepta clases de layout (`grow`, etc.).
 *
 * - `errorOutside`: el error lo dibuja quien usa el campo (filas con un solo mensaje para varios campos);
 *   el campo igual lo referencia con `errorId`.
 * - `invalid`: marca el control como inválido sin texto de error propio (el mensaje vive en un grupo).
 */
@Component({
  selector: 'app-field',
  imports: [FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'field' },
  template: `
    @if (!labelAfter()) {
      <label [attr.for]="controlId()" [class.sub]="sublabel()">{{ label() }}@if (required()) {<span aria-hidden="true"> *</span>}</label>
    }
    <ng-content />
    @if (labelAfter()) {
      <label [attr.for]="controlId()" [class.sub]="sublabel()">{{ label() }}@if (required()) {<span aria-hidden="true"> *</span>}</label>
    }
    @if (hint(); as text) {
      <span class="hint" [attr.id]="hintId()">{{ text }}</span>
    }
    @if (error() && !errorOutside()) {
      <app-field-error [message]="error()" [elementId]="resolvedErrorId()" [announce]="errorRole()" />
    }
  `,
})
export class Field {
  readonly controlId = input.required<string>();
  readonly label = input.required<string>();
  /** Etiqueta chica (clase `sub`), para campos que comparten una fila. */
  readonly sublabel = input(false, { transform: booleanAttribute });
  /** La etiqueta va después del control (pares de años y meses). */
  readonly labelAfter = input(false, { transform: booleanAttribute });
  readonly hint = input<string | null | undefined>(null);
  readonly error = input<string | null | undefined>(null);
  readonly errorRole = input<'alert' | null>(null);
  readonly errorId = input<string | null>(null);
  readonly errorOutside = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });

  private readonly control = contentChild(FieldControl);

  protected readonly hintId = computed(() => `${this.controlId()}-hint`);
  protected readonly resolvedErrorId = computed(() => this.errorId() ?? `${this.controlId()}-error`);

  private readonly describedBy = computed(() => {
    const ids = [this.hint() ? this.hintId() : '', this.error() ? this.resolvedErrorId() : ''].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  });

  constructor() {
    effect(() => {
      const control = this.control();
      if (!control) return;
      control.id.set(this.controlId());
      control.invalid.set(!!this.error() || this.invalid());
      control.describedBy.set(this.describedBy());
      control.required.set(this.required());
    });
  }
}
