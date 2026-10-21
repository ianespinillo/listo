import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CycleItem } from './panel-api.models';
import { PanelApiService } from './panel-api.service';
import { PublicApiService } from './public-api.service';

/**
 * Datos que comparte el header del panel con las pantallas: nombre de la escuela y ciclo activo.
 * Configuración llama a `refresh()` cuando cambia el ciclo, para que el badge se actualice.
 */
@Injectable({ providedIn: 'root' })
export class PanelContext {
  private readonly panelApi = inject(PanelApiService);
  private readonly publicApi = inject(PublicApiService);

  readonly schoolName = signal('');
  readonly activeCycle = signal<CycleItem | null>(null);
  /** Falso hasta la primera respuesta, para no mostrar "Sin ciclo activo" mientras carga. */
  readonly loaded = signal(false);

  async refresh(): Promise<void> {
    const [status, cycles] = await Promise.allSettled([
      firstValueFrom(this.publicApi.getStatus()),
      firstValueFrom(this.panelApi.getCycles()),
    ]);
    if (status.status === 'fulfilled') this.schoolName.set(status.value.school.name);
    if (cycles.status === 'fulfilled') {
      this.activeCycle.set(cycles.value.find((cycle) => cycle.active) ?? null);
      this.loaded.set(true);
    }
  }
}
