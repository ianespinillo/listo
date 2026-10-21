import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { STATUS_BADGE, STATUS_LABEL } from '../../../core/format';
import { ApplicationStatus } from '../../../core/panel-api.models';

/** Estado de verificación de una postulación: Verificado, Sin verificar o Puntaje modificado. */
@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `{{ label() }}`,
})
export class StatusBadge {
  readonly status = input.required<ApplicationStatus>();
  protected readonly classes = computed(() => STATUS_BADGE[this.status()]);
  protected readonly label = computed(() => STATUS_LABEL[this.status()]);
}
