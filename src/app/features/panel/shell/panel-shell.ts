import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewEncapsulation,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { firstValueFrom, filter, map } from 'rxjs';
import { PanelApiService } from '../../../core/panel-api.service';
import { PanelContext } from '../../../core/panel-context';
import { Logo } from '../../../shared/logo/logo';

/**
 * Estructura común del panel: header verde con navegación, badge del ciclo y "Salir",
 * y el contenido de cada pantalla. Los estilos van sin encapsular porque los comparten
 * las pantallas hijas (`panel-shared.css`).
 */
@Component({
  selector: 'app-panel-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './panel-shell.html',
  styleUrls: ['./panel-shell.css', './panel-shared.css'],
})
export class PanelShell implements OnInit {
  private readonly api = inject(PanelApiService);
  private readonly router = inject(Router);
  protected readonly ctx = inject(PanelContext);

  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');
  protected readonly loggingOut = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** "Listado" también cubre el detalle de un postulante: es todo lo que no es Configuración. */
  protected readonly listingActive = computed(() => !this.url().startsWith('/panel/configuracion'));

  ngOnInit(): void {
    void this.ctx.refresh();
  }

  /** El enlace de salto no puede ser un ancla: el router interpretaría el `#`. */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    this.main().nativeElement.focus();
  }

  protected async logout(): Promise<void> {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    try {
      await firstValueFrom(this.api.logout());
    } catch {
      // Aunque falle, se sale: el servidor de todos modos exige la sesión en cada pedido.
    }
    this.loggingOut.set(false);
    await this.router.navigateByUrl('/panel/ingresar');
  }
}
