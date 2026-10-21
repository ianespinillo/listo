import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Isotipo de Listo (SVG inline). Sobre fondo verde se usa la variante `inverted`.
 * Con `label` nulo es decorativo (por ejemplo, cuando al lado está el texto "Listo.").
 */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label()"
      [attr.aria-hidden]="label() ? null : 'true'"
    >
      <rect width="48" height="48" rx="12" [attr.fill]="colors().square" />
      <rect x="10" y="12" width="24" height="5" rx="2.5" [attr.fill]="colors().bars" />
      <rect x="10" y="21.5" width="18" height="5" rx="2.5" [attr.fill]="colors().bars" fill-opacity=".8" />
      <rect x="10" y="31" width="11" height="5" rx="2.5" [attr.fill]="colors().bars" fill-opacity=".6" />
      <path
        d="M26 32.5 L30 36.5 L38.5 27"
        fill="none"
        [attr.stroke]="colors().check"
        stroke-width="3.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
  `,
})
export class Logo {
  readonly size = input(32);
  /** Variante para fondos verdes: cuadrado claro, barras verdes y tilde en tiza oscura. */
  readonly inverted = input(false);
  readonly label = input<string | null>('Logo de Listo');

  protected readonly colors = computed(() =>
    this.inverted()
      ? { square: '#F6F5F1', bars: '#1F4D3A', check: '#C99528' }
      : { square: '#1F4D3A', bars: '#FFFFFF', check: '#E8B64A' },
  );
}
