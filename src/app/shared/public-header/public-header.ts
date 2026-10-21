import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Logo } from '../logo/logo';

/** Header verde del sitio público: logo, "Listo." y el nombre de la escuela. */
@Component({
  selector: 'app-public-header',
  imports: [Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <div class="header-inner">
        <app-logo [size]="32" [inverted]="true" [label]="null" />
        <div class="titles">
          <span class="wordmark">Listo<span class="dot">.</span></span>
          @if (schoolName()) {
            <span class="school">{{ schoolName() }}</span>
          }
        </div>
      </div>
    </header>
  `,
  styles: `
    .header {
      background: var(--pizarron);
      color: #fff;
    }
    .header-inner {
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 640px;
      margin: 0 auto;
      padding: 16px 20px;
    }
    .titles {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }
    .wordmark {
      font-family: var(--fuente-titulos);
      font-weight: 700;
      font-size: 20px;
      line-height: 1;
    }
    .dot {
      color: var(--tiza);
    }
    .school {
      font-size: 12px;
      color: #d5e3d9;
    }
  `,
})
export class PublicHeader {
  readonly schoolName = input('');
}
