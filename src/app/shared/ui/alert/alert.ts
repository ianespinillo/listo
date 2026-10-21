import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type AlertVariant = 'error' | 'warn' | 'ok' | 'info';

/**
 * Aviso en bloque. El host es el `.alert` de `styles.css`, así que el contenido proyectado
 * (texto o varios párrafos) hereda sus estilos. Sin `role`, los errores se anuncian como `alert`
 * y el resto como `status`.
 */
@Component({
  selector: 'app-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    '[attr.role]': 'resolvedRole()',
  },
  template: `<ng-content />`,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class Alert {
  readonly variant = input<AlertVariant>('error');
  readonly role = input<'alert' | 'status' | 'note' | null>(null);

  protected readonly classes = computed(() => {
    const variant = this.variant();
    return variant === 'error' ? 'alert' : `alert alert-${variant}`;
  });
  protected readonly resolvedRole = computed(() => this.role() ?? (this.variant() === 'error' ? 'alert' : 'status'));
}
