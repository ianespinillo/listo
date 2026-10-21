import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeVariant = 'neutral' | 'ok' | 'mod' | 'error' | 'cargo' | 'asig';

/** Insignia (pastilla). El host es el `.badge` de `styles.css`; el texto va como contenido. */
@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `<ng-content />`,
})
export class Badge {
  readonly variant = input<BadgeVariant>('neutral');
  protected readonly classes = computed(() => {
    const variant = this.variant();
    return variant === 'neutral' ? 'badge' : `badge badge-${variant}`;
  });
}
