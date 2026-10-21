import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Círculo con el número de grupo del decreto (1, 2 o 3). Decorativo: el título del grupo ya lo nombra. */
@Component({
  selector: 'app-group-circle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.g1]': 'group() === 1',
    '[class.g2]': 'group() === 2',
    '[class.g3]': 'group() === 3',
  },
  template: `{{ group() }}`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: 2px solid var(--pizarron);
      border-radius: var(--radio-pill);
      font-size: 15px;
      font-weight: 700;
    }

    :host(.g1) {
      background: var(--pizarron);
      color: #fff;
    }

    :host(.g2) {
      background: #cfe0d4;
      color: var(--tinta);
    }

    :host(.g3) {
      background: var(--superficie);
      color: var(--pizarron);
    }
  `,
})
export class GroupCircle {
  readonly group = input.required<1 | 2 | 3>();
}
