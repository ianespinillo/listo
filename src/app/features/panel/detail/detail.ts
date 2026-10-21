import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, firstValueFrom, map } from 'rxjs';
import { ApplicantDetail, ApplicationView, HistoryEvent } from '../../../core/panel-api.models';
import { PanelApiService, parseApiError } from '../../../core/panel-api.service';
import {
  EMPLOYMENT_SENTENCE,
  EMPLOYMENT_SHORT,
  SHIFT_FULL,
  SHIFT_ORDER,
  STATUS_BADGE,
  STATUS_LABEL,
  formatDateTime,
  formatScore,
  formatSeniorityLong,
  formatSeniorityShort,
} from '../panel.format';

type ViewState = 'loading' | 'ready' | 'notFound' | 'error';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

@Component({
  selector: 'app-detail',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'p-page' },
  templateUrl: './detail.html',
  styleUrl: './detail.css',
})
export class Detail {
  private readonly api = inject(PanelApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly fb = inject(NonNullableFormBuilder);

  private readonly emailDialog = viewChild.required<ElementRef<HTMLDialogElement>>('emailDialog');
  private readonly deactivateDialog = viewChild.required<ElementRef<HTMLDialogElement>>('deactivateDialog');

  protected readonly state = signal<ViewState>('loading');
  protected readonly errorMessage = signal('');
  protected readonly applicant = signal<ApplicantDetail | null>(null);
  /** Anuncio para el lector de pantalla tras cada acción. */
  protected readonly announcement = signal('');
  protected readonly actionError = signal('');
  /** Puesto cuya verificación se está guardando. */
  protected readonly verifying = signal<number | null>(null);
  protected readonly acting = signal(false);

  protected readonly emailControl = this.fb.control('', [Validators.required, Validators.pattern(EMAIL_PATTERN)]);
  protected readonly emailError = signal('');
  protected readonly emailSending = signal(false);
  protected readonly deactivateError = signal('');

  private readonly id = signal<number | null>(null);
  private readonly query = signal<Record<string, string>>({});

  /** Parámetros del listado de origen, para volver con los mismos filtros. */
  protected readonly backQuery = computed(() => this.query());
  private readonly originPositionId = computed(() => {
    const raw = this.query()['positionId'];
    return raw ? Number(raw) : null;
  });

  /** Postulación al puesto desde el que se llegó (si se llegó desde un listado). */
  protected readonly originApplication = computed<ApplicationView | null>(() => {
    const positionId = this.originPositionId();
    const found = this.applicant()?.applications.find((a) => a.position.id === positionId);
    return found ?? null;
  });

  protected readonly fullName = computed(() => {
    const a = this.applicant();
    return a ? `${a.lastName}, ${a.firstName}` : '';
  });

  protected readonly orderedShifts = computed(() => {
    const shifts = this.applicant()?.shifts ?? [];
    return SHIFT_ORDER.filter((s) => shifts.includes(s));
  });

  constructor() {
    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe((params) => {
      const query: Record<string, string> = {};
      for (const key of ['positionId', 'shift', 'onlyVerified']) {
        if (typeof params[key] === 'string') query[key] = params[key];
      }
      this.query.set(query);
    });

    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((raw) => {
        const id = raw && /^\d{1,10}$/.test(raw) ? Number(raw) : null;
        this.id.set(id);
        if (id === null) {
          this.state.set('notFound');
        } else {
          this.state.set('loading');
          void this.load();
        }
      });
  }

  /** `quiet` recarga sin tapar la pantalla (para refrescar el historial tras una acción). */
  protected async load(quiet = false): Promise<void> {
    const id = this.id();
    if (id === null) return;
    if (!quiet) this.state.set('loading');
    try {
      this.applicant.set(await firstValueFrom(this.api.getApplicant(id)));
      this.state.set('ready');
    } catch (err) {
      const error = parseApiError(err);
      if (quiet && this.applicant()) return;
      if (error.status === 404) {
        this.state.set('notFound');
      } else {
        this.errorMessage.set(error.message);
        this.state.set('error');
      }
    }
  }

  // ---- Verificación ----

  protected async toggleVerification(application: ApplicationView): Promise<void> {
    const current = this.applicant();
    if (!current || this.verifying() !== null) return;
    const verified = application.status !== 'VERIFIED';
    this.verifying.set(application.position.id);
    this.actionError.set('');
    try {
      const updated = await firstValueFrom(
        this.api.setVerification(current.id, application.position.id, verified),
      );
      this.applicant.update((a) =>
        a
          ? { ...a, applications: a.applications.map((x) => (x.position.id === updated.position.id ? updated : x)) }
          : a,
      );
      this.announcement.set(
        verified
          ? `${application.position.name}: marcada como verificada.`
          : `${application.position.name}: se quitó la verificación.`,
      );
      void this.load(true);
    } catch (err) {
      this.actionError.set(parseApiError(err).message);
    } finally {
      this.verifying.set(null);
    }
  }

  // ---- Email ----

  protected openEmail(): void {
    this.emailControl.setValue(this.applicant()?.email ?? '');
    this.emailControl.markAsUntouched();
    this.emailError.set('');
    this.emailDialog().nativeElement.showModal();
    this.document.getElementById('d-email')?.focus();
  }

  protected closeEmail(): void {
    this.emailDialog().nativeElement.close();
  }

  protected async saveEmail(): Promise<void> {
    const current = this.applicant();
    if (!current || this.emailSending()) return;
    this.emailControl.markAsTouched();
    this.emailError.set('');
    const email = this.emailControl.value.trim();
    if (!email) {
      this.emailError.set('Ingresá el email.');
      return;
    }
    if (this.emailControl.invalid) {
      this.emailError.set('Ingresá un email válido.');
      return;
    }
    this.emailSending.set(true);
    try {
      const updated = await firstValueFrom(this.api.updateApplicantEmail(current.id, email));
      this.applicant.set(updated);
      this.closeEmail();
      this.announcement.set('Email actualizado.');
    } catch (err) {
      const error = parseApiError(err);
      this.emailError.set(error.fields['email'] ?? error.message);
      this.document.getElementById('d-email')?.focus();
    } finally {
      this.emailSending.set(false);
    }
  }

  // ---- Baja y reactivación ----

  protected openDeactivate(): void {
    this.deactivateError.set('');
    this.deactivateDialog().nativeElement.showModal();
  }

  protected closeDeactivate(): void {
    this.deactivateDialog().nativeElement.close();
  }

  protected async deactivate(): Promise<void> {
    const current = this.applicant();
    if (!current || this.acting()) return;
    this.acting.set(true);
    this.deactivateError.set('');
    try {
      await firstValueFrom(this.api.deactivateApplicant(current.id));
      this.closeDeactivate();
      this.announcement.set('El postulante fue dado de baja.');
      await this.load(true);
    } catch (err) {
      this.deactivateError.set(parseApiError(err).message);
    } finally {
      this.acting.set(false);
    }
  }

  protected async reactivate(): Promise<void> {
    const current = this.applicant();
    if (!current || this.acting()) return;
    this.acting.set(true);
    this.actionError.set('');
    try {
      await firstValueFrom(this.api.reactivateApplicant(current.id));
      this.announcement.set('El postulante fue reactivado.');
      await this.load(true);
    } catch (err) {
      this.actionError.set(parseApiError(err).message);
    } finally {
      this.acting.set(false);
    }
  }

  // ---- Historial: lectura defensiva del `detail` de cada evento ----

  protected scoreOf(event: HistoryEvent, key: 'previous' | 'new' | 'score'): string {
    const value = asRecord(event.detail)[key];
    return typeof value === 'string' ? formatScore(value) : '—';
  }

  /** " (situación A → B · antigüedad C → D)" o cadena vacía si el detalle no trae los valores. */
  protected dataChangeSummary(event: HistoryEvent): string {
    const changes = this.dataChanges(event);
    return changes.length > 0 ? ` (${changes.join(' · ')})` : '';
  }

  /** Cambios de situación y antigüedad de un `DATA_CHANGE`, en frases cortas. */
  private dataChanges(event: HistoryEvent): string[] {
    const detail = asRecord(event.detail);
    const before = asRecord(detail['previous']);
    const after = asRecord(detail['new']);
    const changes: string[] = [];
    const prevStatus = before['employmentStatus'];
    const nextStatus = after['employmentStatus'];
    if (prevStatus !== nextStatus && typeof prevStatus === 'string' && typeof nextStatus === 'string') {
      const label = (value: string) => EMPLOYMENT_SHORT[value as keyof typeof EMPLOYMENT_SHORT] ?? value;
      changes.push(`situación ${label(prevStatus)} → ${label(nextStatus)}`);
    }
    const prevMonths = before['seniorityMonths'];
    const nextMonths = after['seniorityMonths'];
    if (prevMonths !== nextMonths && typeof prevMonths === 'number' && typeof nextMonths === 'number') {
      changes.push(`antigüedad ${formatSeniorityShort(prevMonths)} → ${formatSeniorityShort(nextMonths)}`);
    }
    return changes;
  }

  protected readonly dateTime = formatDateTime;
  protected readonly score = formatScore;
  protected readonly seniorityLong = formatSeniorityLong;
  protected readonly employment = EMPLOYMENT_SHORT;
  protected readonly employmentSentence = EMPLOYMENT_SENTENCE;
  protected readonly shiftFull = SHIFT_FULL;
  protected readonly statusBadge = STATUS_BADGE;
  protected readonly statusLabel = STATUS_LABEL;
}
