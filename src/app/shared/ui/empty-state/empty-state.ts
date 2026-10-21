import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Caja punteada para "no hay nada". El mensaje va por `message` o, si lleva enlaces, como
 * contenido proyectado; la acción (botón o enlace) también va como contenido.
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'state-box',
    '[attr.role]': 'role()',
  },
  template: `
    @if (message(); as text) {
      <p>{{ text }}</p>
    }
    <ng-content />
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class EmptyState {
  readonly message = input<string | null>(null);
  readonly role = input<'alert' | 'status' | null>(null);
}
