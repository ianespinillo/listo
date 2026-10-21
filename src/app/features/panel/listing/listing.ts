import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import {
  Subject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  firstValueFrom,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import {
  ListingFilters,
  ListingGroup,
  ListingResponse,
  ListingRow,
  PanelPosition,
} from '../../../core/panel-api.models';
import { PanelApiService, parseApiError } from '../../../core/panel-api.service';
import { PanelContext } from '../../../core/panel-context';
import { Shift } from '../../../core/public-api.models';
import {
  EMPLOYMENT_SHORT,
  SHIFT_LABELS,
  SHIFT_ORDER,
  formatScore,
  formatSeniorityShortOrDash,
} from '../../../core/format';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Field } from '../../../shared/ui/field/field';
import { FieldControl } from '../../../shared/ui/field/field-control';
import { FieldError } from '../../../shared/ui/field-error/field-error';
import { GroupCircle } from '../../../shared/ui/group-circle/group-circle';
import { LoadState, LoadStatus } from '../../../shared/ui/load-state/load-state';
import { ShiftChips } from '../../../shared/ui/shift-chips/shift-chips';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';


interface GroupInfo {
  title: string;
  rule: string;
}

/** Títulos y reglas de orden de cada grupo del decreto (textos del mockup). */
const GROUPS: Record<number, GroupInfo> = {
  1: { title: 'Titulares de la escuela', rule: 'Titulares, por antigüedad en el establecimiento' },
  2: { title: 'Provisionales y suplentes', rule: 'Por puntaje; si empatan, por antigüedad docente' },
  3: { title: 'Docentes de otras escuelas', rule: 'Por puntaje del Listado Oficial' },
};

const SHIFT_FILTERS: { value: Shift | null; label: string }[] = [
  { value: null, label: 'Todos' },
  { value: 'MANANA', label: 'Mañana' },
  { value: 'TARDE', label: 'Tarde' },
  { value: 'VESPERTINO', label: 'Vespertino' },
];

function parseFilters(params: Params): ListingFilters {
  const rawId = params['positionId'];
  const id = typeof rawId === 'string' && /^\d{1,9}$/.test(rawId) ? Number(rawId) : null;
  const rawShift = params['shift'];
  const shift = SHIFT_ORDER.find((s) => s === rawShift) ?? null;
  return { positionId: id, shift, onlyVerified: params['onlyVerified'] === 'true' };
}

function sameFilters(a: ListingFilters, b: ListingFilters): boolean {
  return a.positionId === b.positionId && a.shift === b.shift && a.onlyVerified === b.onlyVerified;
}

@Component({
  selector: 'app-listing',
  imports: [
    RouterLink,
    EmptyState,
    Field,
    FieldControl,
    FieldError,
    GroupCircle,
    LoadState,
    ShiftChips,
    StatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'p-page' },
  templateUrl: './listing.html',
  styleUrl: './listing.css',
})
export class Listing {
  private readonly api = inject(PanelApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly ctx = inject(PanelContext);

  protected readonly shiftFilters = SHIFT_FILTERS;
  /** Cada emisión repite el pedido con los filtros vigentes; pasa por el mismo `switchMap`. */
  private readonly retry$ = new Subject<void>();

  protected readonly state = signal<LoadStatus>('loading');
  protected readonly errorMessage = signal('');
  /** Hay un pedido en curso (cambio de filtro): se conserva lo anterior en pantalla. */
  protected readonly busy = signal(false);
  protected readonly data = signal<ListingResponse | null>(null);
  protected readonly positions = signal<PanelPosition[]>([]);
  protected readonly positionsFailed = signal(false);

  /** Los filtros viven en la URL: es la única fuente de verdad. */
  protected readonly filters = toSignal(
    this.route.queryParams.pipe(map(parseFilters), distinctUntilChanged(sameFilters)),
    { initialValue: parseFilters(this.route.snapshot.queryParams) },
  );

  /** Puesto elegido: el de la URL o, si falta, el que eligió el servidor. */
  protected readonly selectedPositionId = computed(
    () => this.filters().positionId ?? this.data()?.position?.id ?? null,
  );

  /** Parámetros con los que el detalle vuelve a este listado. */
  protected readonly detailQuery = computed(() => {
    const filters = this.filters();
    const query: Params = {};
    const positionId = this.selectedPositionId();
    if (positionId !== null) query['positionId'] = positionId;
    if (filters.shift) query['shift'] = filters.shift;
    if (filters.onlyVerified) query['onlyVerified'] = 'true';
    return query;
  });

  protected readonly hasFilters = computed(() => !!this.filters().shift || this.filters().onlyVerified);

  protected readonly groups = computed(() =>
    (this.data()?.groups ?? []).map((group) => ({ ...group, info: GROUPS[group.group] })),
  );

  constructor() {
    void this.loadPositions();

    combineLatest([
      this.route.queryParams.pipe(map(parseFilters), distinctUntilChanged(sameFilters)),
      this.retry$.pipe(startWith(undefined)),
    ])
      .pipe(
        map(([filters]) => filters),
        tap(() => this.busy.set(true)),
        switchMap((filters) =>
          this.api.getListing(filters).pipe(
            map((data) => ({ data })),
            catchError((err: unknown) => of({ error: parseApiError(err) })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.busy.set(false);
        if ('data' in result) {
          this.data.set(result.data);
          this.state.set('ready');
        } else if (result.error.status === 404) {
          this.state.set('notFound');
        } else {
          this.errorMessage.set(result.error.message);
          this.state.set('error');
        }
      });
  }

  private async loadPositions(): Promise<void> {
    try {
      this.positions.set(await firstValueFrom(this.api.getPositions()));
    } catch {
      this.positionsFailed.set(true);
    }
  }

  protected retry(): void {
    // Un cambio de URL vuelve a disparar el pedido; con la misma URL se pide a mano.
    this.state.set('loading');
    this.retry$.next();
  }

  // ---- Filtros ----

  private setQuery(patch: Params): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: patch,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected onPosition(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.setQuery({ positionId: value || null });
  }

  protected onShift(shift: Shift | null): void {
    this.setQuery({ shift });
  }

  protected onOnlyVerified(event: Event): void {
    this.setQuery({ onlyVerified: (event.target as HTMLInputElement).checked ? 'true' : null });
  }

  protected clearFilters(): void {
    this.setQuery({ shift: null, onlyVerified: null });
  }

  protected print(): void {
    this.document.defaultView?.print();
  }

  // ---- Presentación ----

  protected plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
  }

  protected fullName(row: ListingRow): string {
    return `${row.lastName}, ${row.firstName}`;
  }

  protected trackGroup(group: ListingGroup): number {
    return group.group;
  }

  protected readonly employment = EMPLOYMENT_SHORT;
  protected readonly shiftFull = SHIFT_LABELS;
  protected readonly score = formatScore;
  protected readonly seniority = formatSeniorityShortOrDash;
}
