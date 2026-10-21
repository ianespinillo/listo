import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { SHIFT_INITIAL, SHIFT_LABELS, SHIFT_ORDER } from '../../../core/format';
import { Shift } from '../../../core/public-api.models';

/**
 * Turnos de un docente, siempre en el orden Mañana, Tarde, Vespertino.
 * Normal: pastillas con el nombre. `compact`: cuadrados M, T, V con el nombre en `title` y en el
 * `aria-label` (para tablas angostas). `emptyText` se muestra solo en la variante normal.
 */
@Component({
  selector: 'app-shift-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-compact]': 'compact()' },
  template: `
    @for (shift of ordered(); track shift) {
      @if (compact()) {
        <span class="square" role="img" [attr.aria-label]="labels[shift]" [attr.title]="labels[shift]">{{ initials[shift] }}</span>
      } @else {
        <span class="chip">{{ labels[shift] }}</span>
      }
    } @empty {
      @if (!compact() && emptyText(); as text) {
        <span>{{ text }}</span>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    :host(.is-compact) {
      flex-wrap: nowrap;
      gap: 4px;
    }

    .chip {
      padding: 4px 10px;
      border-radius: var(--radio-pill);
      background: var(--pizarron-suave);
      color: var(--pizarron);
      font-size: 13px;
      font-weight: 600;
    }

    .square {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 8px;
      background: var(--pizarron-suave);
      color: var(--pizarron);
      font-size: 12px;
      font-weight: 700;
    }
  `,
})
export class ShiftChips {
  readonly shifts = input.required<readonly Shift[]>();
  readonly compact = input(false, { transform: booleanAttribute });
  readonly emptyText = input<string | null>(null);

  protected readonly labels = SHIFT_LABELS;
  protected readonly initials = SHIFT_INITIAL;
  protected readonly ordered = computed(() => SHIFT_ORDER.filter((shift) => this.shifts().includes(shift)));
}
