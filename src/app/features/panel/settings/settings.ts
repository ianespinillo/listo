import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  DestroyRef,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CycleItem, PanelPosition } from '../../../core/panel-api.models';
import { PanelApiService, parseApiError } from '../../../core/panel-api.service';
import { PanelContext } from '../../../core/panel-context';
import { PositionType } from '../../../core/public-api.models';
import { formatIsoDate, todayInBuenosAires } from '../../../core/format';
import { Alert } from '../../../shared/ui/alert/alert';
import { Badge } from '../../../shared/ui/badge/badge';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Field } from '../../../shared/ui/field/field';
import { FieldControl } from '../../../shared/ui/field/field-control';
import { FieldError } from '../../../shared/ui/field-error/field-error';
import { LoadState, LoadStatus } from '../../../shared/ui/load-state/load-state';
import { TypeBadge } from '../../../shared/ui/type-badge/type-badge';

const RANGE_MESSAGE = 'La fecha de cierre no puede ser anterior a la de apertura.';
const STALE_MESSAGE = 'Se guardó, pero no pudimos actualizar la lista. Recargá la página.';
const REQUIRED_DATE = 'Ingresá la fecha.';

@Component({
  selector: 'app-settings',
  imports: [
    ReactiveFormsModule,
    Alert,
    Badge,
    EmptyState,
    Field,
    FieldControl,
    FieldError,
    LoadState,
    TypeBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'p-page' },
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings implements OnInit {
  private readonly api = inject(PanelApiService);
  private readonly ctx = inject(PanelContext);
  private readonly document = inject(DOCUMENT);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private readonly archiveDialog = viewChild.required<ElementRef<HTMLDialogElement>>('archiveDialog');
  private readonly positionDialog = viewChild.required<ElementRef<HTMLDialogElement>>('positionDialog');
  private readonly linkInput = viewChild.required<ElementRef<HTMLInputElement>>('linkInput');

  protected readonly state = signal<LoadStatus>('loading');
  protected readonly errorMessage = signal('');
  protected readonly cycles = signal<CycleItem[]>([]);
  protected readonly positions = signal<PanelPosition[]>([]);
  protected readonly announcement = signal('');
  /** Aviso no bloqueante: se guardó, pero falló la recarga posterior. */
  protected readonly staleNotice = signal('');

  protected readonly activeCycle = computed(() => this.cycles().find((c) => c.active) ?? null);
  protected readonly archivedCycles = computed(() => this.cycles().filter((c) => !c.active));
  /** Año del ciclo que abre "Archivar y abrir": el siguiente al activo o, sin activo, al último conocido. */
  protected readonly nextYear = computed(() => {
    const active = this.activeCycle();
    if (active) return active.year + 1;
    const years = this.cycles().map((c) => c.year);
    return years.length > 0 ? Math.max(...years) + 1 : Number(todayInBuenosAires().slice(0, 4));
  });

  // ---- Fechas del ciclo activo ----

  protected readonly datesForm = this.fb.group({
    from: ['', Validators.required],
    until: ['', Validators.required],
  });
  protected readonly datesErrors = signal<{ from?: string; until?: string; general?: string }>({});
  protected readonly datesSaving = signal(false);
  protected readonly datesSaved = signal(false);

  // ---- Link del formulario ----

  protected readonly formUrl = `${this.document.location.origin}/`;
  protected readonly copyState = signal<'idle' | 'copied' | 'failed'>('idle');
  private copyTimer: ReturnType<typeof setTimeout> | undefined;

  // ---- Archivar ciclo y abrir el siguiente ----

  protected readonly archiveForm = this.fb.group({
    year: [0, [Validators.required, Validators.min(2000), Validators.max(2100)]],
    from: ['', Validators.required],
    until: ['', Validators.required],
  });
  protected readonly archiveErrors = signal<{ year?: string; from?: string; until?: string; general?: string }>({});
  protected readonly archiveSaving = signal(false);

  // ---- Puestos ----

  protected readonly positionForm = this.fb.group({
    name: ['', Validators.required],
    type: ['ASIGNATURA' as PositionType, Validators.required],
    active: [true],
  });
  protected readonly editingPosition = signal<PanelPosition | null>(null);
  protected readonly positionErrors = signal<{ name?: string; type?: string; general?: string }>({});
  protected readonly positionSaving = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.copyTimer));
  }

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      const [cycles, positions] = await Promise.all([
        firstValueFrom(this.api.getCycles()),
        firstValueFrom(this.api.getPositions()),
      ]);
      this.cycles.set(cycles);
      this.positions.set(positions);
      this.resetDates();
      this.state.set('ready');
    } catch (err) {
      this.errorMessage.set(parseApiError(err).message);
      this.state.set('error');
    }
  }

  private resetDates(): void {
    const active = this.activeCycle();
    this.datesForm.reset({ from: active?.registrationFrom ?? '', until: active?.registrationUntil ?? '' });
  }

  // ---- Fechas ----

  protected async saveDates(): Promise<void> {
    const active = this.activeCycle();
    if (!active || this.datesSaving()) return;
    this.datesSaved.set(false);
    const { from, until } = this.datesForm.getRawValue();
    const errors: { from?: string; until?: string } = {};
    if (!from) errors.from = REQUIRED_DATE;
    if (!until) errors.until = REQUIRED_DATE;
    if (from && until && from > until) errors.until = RANGE_MESSAGE;
    this.datesErrors.set(errors);
    if (errors.from || errors.until) {
      this.focusLater(errors.from ? 's-desde' : 's-hasta');
      return;
    }

    this.datesSaving.set(true);
    try {
      const updated = await firstValueFrom(
        this.api.updateCycle(active.id, { registrationFrom: from, registrationUntil: until }),
      );
      this.cycles.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
      this.datesSaved.set(true);
      this.announcement.set('Fechas guardadas.');
      void this.ctx.refresh();
    } catch (err) {
      const error = parseApiError(err);
      this.datesErrors.set({
        from: error.fields['registrationFrom'],
        until: error.fields['registrationUntil'],
        general: error.fields['registrationFrom'] || error.fields['registrationUntil'] ? undefined : error.message,
      });
    } finally {
      this.datesSaving.set(false);
    }
  }

  // ---- Link ----

  protected async copyLink(): Promise<void> {
    clearTimeout(this.copyTimer);
    try {
      await this.document.defaultView!.navigator.clipboard.writeText(this.formUrl);
      this.copyState.set('copied');
    } catch {
      // Sin permiso o sin contexto seguro: se deja el link seleccionado para copiarlo a mano.
      this.copyState.set('failed');
      this.linkInput().nativeElement.select();
    }
    this.copyTimer = setTimeout(() => this.copyState.set('idle'), 4000);
  }

  // ---- Archivar y abrir el siguiente ----

  protected openArchive(): void {
    this.archiveForm.reset({ year: this.nextYear(), from: '', until: '' });
    this.archiveErrors.set({});
    this.archiveDialog().nativeElement.showModal();
  }

  protected closeArchive(): void {
    this.archiveDialog().nativeElement.close();
  }

  protected async createCycle(): Promise<void> {
    if (this.archiveSaving()) return;
    const { year, from, until } = this.archiveForm.getRawValue();
    const errors: { year?: string; from?: string; until?: string } = {};
    if (!Number.isInteger(year) || year < 2000 || year > 2100) errors.year = 'Ingresá un año válido.';
    if (!from) errors.from = REQUIRED_DATE;
    if (!until) errors.until = REQUIRED_DATE;
    if (from && until && from > until) errors.until = RANGE_MESSAGE;
    this.archiveErrors.set(errors);
    if (errors.year || errors.from || errors.until) {
      this.document.getElementById(errors.year ? 'a-anio' : errors.from ? 'a-desde' : 'a-hasta')?.focus();
      return;
    }

    this.archiveSaving.set(true);
    const previous = this.activeCycle();
    let created: CycleItem;
    try {
      created = await firstValueFrom(
        this.api.createCycle({ year, registrationFrom: from, registrationUntil: until }),
      );
    } catch (err) {
      const error = parseApiError(err);
      const fieldErrors = {
        year: error.fields['year'],
        from: error.fields['registrationFrom'],
        until: error.fields['registrationUntil'],
      };
      const hasField = !!(fieldErrors.year || fieldErrors.from || fieldErrors.until);
      this.archiveErrors.set({ ...fieldErrors, general: hasField ? undefined : error.message });
      this.archiveSaving.set(false);
      return;
    }

    // El servidor ya guardó: se cierra el diálogo y la recarga va aparte.
    this.archiveSaving.set(false);
    this.closeArchive();
    this.datesSaved.set(false);
    this.announcement.set(
      previous
        ? `Ciclo ${created.year} abierto. El ciclo ${previous.year} quedó archivado.`
        : `Ciclo ${created.year} abierto.`,
    );
    try {
      this.cycles.set(await firstValueFrom(this.api.getCycles()));
      this.resetDates();
    } catch {
      this.staleNotice.set(STALE_MESSAGE);
    }
    void this.ctx.refresh();
  }

  // ---- Puestos ----

  protected openPosition(position: PanelPosition | null): void {
    this.editingPosition.set(position);
    this.positionErrors.set({});
    this.positionForm.reset({
      name: position?.name ?? '',
      type: position?.type ?? 'ASIGNATURA',
      active: position?.active ?? true,
    });
    this.positionDialog().nativeElement.showModal();
  }

  protected closePosition(): void {
    this.positionDialog().nativeElement.close();
  }

  protected async savePosition(): Promise<void> {
    if (this.positionSaving()) return;
    const { name, type, active } = this.positionForm.getRawValue();
    const trimmed = name.trim();
    if (!trimmed) {
      this.positionErrors.set({ name: 'Ingresá el nombre del puesto.' });
      this.document.getElementById('p-nombre')?.focus();
      return;
    }
    this.positionErrors.set({});

    this.positionSaving.set(true);
    const editing = this.editingPosition();
    let saved: PanelPosition;
    try {
      saved = editing
        ? await firstValueFrom(this.api.updatePosition(editing.id, { name: trimmed, type, active }))
        : await firstValueFrom(this.api.createPosition({ name: trimmed, type }));
    } catch (err) {
      const error = parseApiError(err);
      const name = error.fields['name'] ?? (error.code === 'DUPLICATE_POSITION' ? error.message : undefined);
      const type = error.fields['type'];
      this.positionErrors.set({ name, type, general: name || type ? undefined : error.message });
      if (name) this.document.getElementById('p-nombre')?.focus();
      this.positionSaving.set(false);
      return;
    }

    // El servidor ya guardó: se cierra el diálogo y la recarga va aparte.
    this.positionSaving.set(false);
    this.closePosition();
    this.announcement.set(editing ? `Puesto ${saved.name} guardado.` : `Puesto ${saved.name} agregado.`);
    try {
      this.positions.set(await firstValueFrom(this.api.getPositions()));
    } catch {
      this.staleNotice.set(STALE_MESSAGE);
    }
  }

  private focusLater(id: string): void {
    queueMicrotask(() => this.document.getElementById(id)?.focus());
  }

  protected readonly date = formatIsoDate;
}
