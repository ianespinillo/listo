import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type LoadStatus = 'loading' | 'error' | 'notFound' | 'ready';

/**
 * Los estados de una carga: cargando, error con "Reintentar", no encontrado y listo.
 * El contenido del estado listo se proyecta; el del no encontrado puede sumar una acción
 * con el atributo `notFoundAction`. Quien lo usa decide cuándo cargar y qué hace al reintentar.
 */
@Component({
  selector: 'app-load-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('loading') {
        <p class="state-box" role="status">{{ loadingMessage() }}</p>
      }
      @case ('error') {
        <div class="state-box" role="alert">
          <p>{{ errorMessage() }}</p>
          <button type="button" class="btn btn-sm btn-outline retry" (click)="retry.emit()">{{ retryLabel() }}</button>
        </div>
      }
      @case ('notFound') {
        <div class="state-box" role="alert">
          <p>{{ notFoundMessage() }}</p>
          <ng-content select="[notFoundAction]" />
        </div>
      }
      @case ('ready') {
        <ng-content />
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .retry {
      margin-top: 12px;
    }
  `,
})
export class LoadState {
  readonly state = input.required<LoadStatus>();
  readonly loadingMessage = input('Cargando…');
  readonly errorMessage = input('');
  readonly notFoundMessage = input('');
  readonly retryLabel = input('Reintentar');
  readonly retry = output<void>();
}
