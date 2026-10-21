import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { POSITION_TYPE_LABELS } from '../../../core/format';
import { PositionType } from '../../../core/public-api.models';

/** Tipo de puesto: Asignatura o Cargo. */
@Component({
  selector: 'app-type-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `{{ label() }}`,
})
export class TypeBadge {
  readonly type = input.required<PositionType>();
  protected readonly classes = computed(() => (this.type() === 'CARGO' ? 'badge badge-cargo' : 'badge badge-asig'));
  protected readonly label = computed(() => POSITION_TYPE_LABELS[this.type()]);
}
