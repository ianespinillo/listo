import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import {
  EmploymentStatus,
  PublicStatus,
  RegistrationBody,
  RegistrationSummary,
  Shift,
} from '../../core/public-api.models';
import { PublicApiService } from '../../core/public-api.service';
import {
  EMPLOYMENT_LABELS,
  SHIFT_LABELS,
  formatDayMonth,
  formatScore,
  formatSeniority,
  todayInBuenosAires,
} from '../../core/format';
import { applyServerErrors, errorOf, revalidate } from '../../core/forms';
import { PublicHeader } from '../../shared/public-header/public-header';
import { EMPLOYMENT_OPTIONS, SHIFT_OPTIONS } from './registration.labels';
import {
  atLeastOneShift,
  dniValidator,
  emailValidator,
  integerBetween,
  noDuplicatePositions,
  phoneValidator,
  requiredText,
  schoolYearsValidator,
  scoreValidator,
} from './registration.validators';

type Phase = 'loading' | 'loadError' | 'form' | 'sent' | 'mismatch' | 'closed';
type ClosedReason = 'none' | 'notYet' | 'ended';

interface SubmitError {
  message: string;
  details: string[];
}

/** Textos de "falta el dato" por campo. */
const REQUIRED = {
  lastName: 'Ingresá tu apellido.',
  firstName: 'Ingresá tu nombre.',
  dni: 'Ingresá tu DNI.',
  email: 'Ingresá tu email.',
  phone: 'Ingresá tu teléfono.',
  employmentStatus: 'Elegí tu situación de revista.',
  years: 'Ingresá los años (si no tenés, poné 0).',
  months: 'Ingresá los meses (si no tenés, poné 0).',
  schoolYears: 'Ingresá los años en esta escuela (si no tenés, poné 0).',
  schoolMonths: 'Ingresá los meses en esta escuela (si no tenés, poné 0).',
  position: 'Elegí una materia o cargo.',
  score: 'Ingresá el puntaje.',
  declaration: 'Tenés que confirmar la declaración para enviar.',
} as const;

@Component({
  selector: 'app-registration',
  imports: [ReactiveFormsModule, PublicHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './registration.html',
  styleUrls: ['./registration.css', './registration-states.css'],
})
export class Registration implements OnInit {
  private readonly api = inject(PublicApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  protected readonly required = REQUIRED;
  protected readonly employmentOptions = EMPLOYMENT_OPTIONS;
  protected readonly shiftOptions = SHIFT_OPTIONS;

  protected readonly phase = signal<Phase>('loading');
  protected readonly status = signal<PublicStatus | null>(null);
  protected readonly summary = signal<RegistrationSummary | null>(null);
  protected readonly mismatchMessage = signal('');
  protected readonly sending = signal(false);
  protected readonly submitError = signal<SubmitError | null>(null);
  /** Texto para el lector de pantalla cuando cambia la pantalla. */
  protected readonly announcement = signal('');

  protected readonly school = computed(() => this.status()?.school ?? null);
  protected readonly cycle = computed(() => this.status()?.cycle ?? null);
  protected readonly subjects = computed(() =>
    (this.status()?.positions ?? []).filter((p) => p.type === 'ASIGNATURA'),
  );
  protected readonly roles = computed(() =>
    (this.status()?.positions ?? []).filter((p) => p.type === 'CARGO'),
  );
  protected readonly hasPositions = computed(() => (this.status()?.positions.length ?? 0) > 0);

  protected readonly closedReason = computed<ClosedReason>(() => {
    const cycle = this.cycle();
    if (!cycle) return 'none';
    return todayInBuenosAires() < cycle.registrationFrom ? 'notYet' : 'ended';
  });

  protected readonly form = this.fb.group({
    lastName: ['', requiredText(80)],
    firstName: ['', requiredText(80)],
    dni: ['', dniValidator],
    email: ['', emailValidator],
    phone: ['', phoneValidator],
    employmentStatus: this.fb.control<EmploymentStatus | ''>('', Validators.required),
    seniorityYears: this.fb.control<number | null>(null, integerBetween(0, 60)),
    seniorityMonths: this.fb.control<number | null>(null, integerBetween(0, 11)),
    // Solo se pide (y se valida y envía) a quien trabaja en la escuela; ver el constructor.
    schoolYears: this.fb.control<number | null>({ value: null, disabled: true }, schoolYearsValidator),
    schoolMonths: this.fb.control<number | null>({ value: null, disabled: true }, integerBetween(0, 11)),
    shifts: this.fb.group({ MANANA: false, TARDE: false, VESPERTINO: false }, { validators: atLeastOneShift }),
    applications: this.fb.array([this.newApplication()], { validators: noDuplicatePositions }),
    declaration: [false, Validators.requiredTrue],
  });

  /** La antigüedad en la escuela se pide a titulares, provisionales y suplentes; no a externos. */
  protected readonly asksSchoolSeniority = signal(false);

  constructor() {
    const { employmentStatus, seniorityYears, seniorityMonths, schoolYears, schoolMonths } = this.form.controls;

    // Habilitar/deshabilitar saca el bloque de la validación y del envío cuando es externo.
    employmentStatus.valueChanges.pipe(takeUntilDestroyed()).subscribe((status) => {
      const asks = status === 'TITULAR' || status === 'PROVISIONAL' || status === 'SUPLENTE';
      this.asksSchoolSeniority.set(asks);
      if (asks) {
        schoolYears.enable({ emitEvent: false });
        schoolMonths.enable({ emitEvent: false });
      } else {
        schoolYears.disable({ emitEvent: false });
        schoolMonths.disable({ emitEvent: false });
      }
    });

    // La comparación con la antigüedad docente depende de otros tres controles.
    for (const control of [seniorityYears, seniorityMonths, schoolMonths]) {
      control.valueChanges
        .pipe(takeUntilDestroyed())
        .subscribe(() => schoolYears.updateValueAndValidity({ emitEvent: false }));
    }
  }

  protected get applications() {
    return this.form.controls.applications;
  }

  /** Identificador estable por fila, para los `id` del DOM (los índices cambian al quitar filas). */
  private readonly rowIds = new WeakMap<object, number>();
  private nextRowId = 1;

  ngOnInit(): void {
    void this.loadStatus();
  }

  protected async loadStatus(): Promise<void> {
    this.phase.set('loading');
    try {
      const status = await firstValueFrom(this.api.getStatus());
      this.status.set(status);
      if (status.open) {
        this.go('form', 'Formulario de inscripción', false);
      } else {
        this.go('closed', 'La inscripción está cerrada.', false);
      }
    } catch {
      this.phase.set('loadError');
    }
  }

  // ---- Filas de materias ----

  private newApplication() {
    return this.fb.group({
      positionId: this.fb.control<number | null>(null, Validators.required),
      score: ['', scoreValidator],
    });
  }

  protected rowId(row: object): number {
    let id = this.rowIds.get(row);
    if (!id) {
      id = this.nextRowId++;
      this.rowIds.set(row, id);
    }
    return id;
  }

  protected addApplication(): void {
    const row = this.newApplication();
    this.applications.push(row);
    this.focusLater(`f-position-${this.rowId(row)}`);
  }

  protected removeApplication(index: number): void {
    if (this.applications.length <= 1) return;
    this.applications.removeAt(index);
    const next = this.applications.at(Math.min(index, this.applications.length - 1));
    this.focusLater(`f-position-${this.rowId(next)}`);
  }

  protected isDuplicate(index: number): boolean {
    const duplicates = this.applications.errors?.['duplicates'] as number[] | undefined;
    return !!duplicates?.includes(index);
  }

  // ---- Errores ----

  /** Mensaje de error de un control, o null si no hay que mostrarlo todavía. */
  protected readonly errorOf = errorOf;

  protected rowPositionError(index: number): string | null {
    const row = this.applications.at(index);
    if (this.isDuplicate(index)) return 'Esta materia ya está en tu lista.';
    return this.errorOf(row.controls.positionId, REQUIRED.position);
  }

  protected rowHasError(index: number): boolean {
    const row = this.applications.at(index);
    return (
      !!this.rowPositionError(index) || !!this.errorOf(row.controls.score, REQUIRED.score)
    );
  }

  // ---- Envío ----

  protected async submit(): Promise<void> {
    if (this.sending()) return;
    this.submitError.set(null);

    // Se vuelve a validar todo: así se limpian los errores del servidor de envíos anteriores.
    revalidate(this.form);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.submitError.set({ message: 'Revisá los campos con error antes de enviar.', details: [] });
      this.focusFirstInvalid();
      return;
    }

    this.sending.set(true);
    const result = await firstValueFrom(this.api.register(this.buildBody()));
    this.sending.set(false);

    switch (result.kind) {
      case 'created':
      case 'replaced':
        this.summary.set(result.summary);
        this.go('sent', 'Inscripción enviada.');
        break;
      case 'closed':
        this.go('closed', 'La inscripción está cerrada.');
        break;
      case 'mismatch':
        this.mismatchMessage.set(result.message);
        this.go('mismatch', '');
        break;
      case 'validation': {
        const details = applyServerErrors(result.fields, (key) => this.controlForServerKey(key));
        this.submitError.set({ message: result.message, details });
        this.focusFirstInvalid();
        break;
      }
      case 'tooMany':
      case 'unexpected':
        this.submitError.set({ message: result.message, details: [] });
        break;
    }
  }

  private buildBody(): RegistrationBody {
    const value = this.form.getRawValue();
    return {
      dni: value.dni.trim(),
      lastName: value.lastName.trim(),
      firstName: value.firstName.trim(),
      email: value.email.trim(),
      phone: value.phone.trim(),
      employmentStatus: value.employmentStatus as EmploymentStatus,
      seniority: { years: value.seniorityYears ?? 0, months: value.seniorityMonths ?? 0 },
      ...(this.asksSchoolSeniority()
        ? { schoolSeniority: { years: value.schoolYears ?? 0, months: value.schoolMonths ?? 0 } }
        : {}),
      shifts: SHIFT_OPTIONS.map((s) => s.value).filter((shift: Shift) => value.shifts[shift]),
      applications: value.applications.map((row) => ({
        positionId: row.positionId as number,
        score: row.score.trim(),
      })),
      declaration: value.declaration,
    };
  }

  private controlForServerKey(key: string): AbstractControl | null {
    const controls = this.form.controls;
    switch (key) {
      case 'lastName':
      case 'firstName':
      case 'dni':
      case 'email':
      case 'phone':
      case 'employmentStatus':
      case 'shifts':
      case 'declaration':
        return controls[key];
      case 'seniority':
      case 'seniority.years':
        return controls.seniorityYears;
      case 'seniority.months':
        return controls.seniorityMonths;
      case 'schoolSeniority':
      case 'schoolSeniority.years':
        return controls.schoolYears;
      case 'schoolSeniority.months':
        return controls.schoolMonths;
      case 'applications':
        return controls.applications;
    }
    const match = /^applications\.(\d+)(?:\.(positionId|score))?$/.exec(key);
    if (match) {
      const row = this.applications.at(Number(match[1]));
      if (!row) return null;
      return match[2] === 'score' ? row.controls.score : row.controls.positionId;
    }
    if (key.startsWith('shifts.')) return controls.shifts;
    return null;
  }

  // ---- Foco ----

  private focusFirstInvalid(): void {
    const c = this.form.controls;
    const targets: [boolean, string][] = [
      [c.lastName.invalid, 'f-lastName'],
      [c.firstName.invalid, 'f-firstName'],
      [c.dni.invalid, 'f-dni'],
      [c.email.invalid, 'f-email'],
      [c.phone.invalid, 'f-phone'],
      [c.employmentStatus.invalid, 'f-employment-TITULAR'],
      [c.seniorityYears.invalid, 'f-seniorityYears'],
      [c.seniorityMonths.invalid, 'f-seniorityMonths'],
      [c.schoolYears.invalid, 'f-schoolYears'],
      [c.schoolMonths.invalid, 'f-schoolMonths'],
      [c.shifts.invalid, 'f-shift-MANANA'],
    ];
    this.applications.controls.forEach((row, index) => {
      const id = this.rowId(row);
      targets.push([row.controls.positionId.invalid || this.isDuplicate(index), `f-position-${id}`]);
      targets.push([row.controls.score.invalid, `f-score-${id}`]);
    });
    targets.push([c.declaration.invalid, 'f-declaration']);

    const first = targets.find(([invalid]) => invalid);
    if (first) this.document.getElementById(first[1])?.focus();
  }

  private focusLater(id: string): void {
    afterNextRender(() => this.document.getElementById(id)?.focus(), { injector: this.injector });
  }

  // ---- Cambios de pantalla ----

  private go(phase: Phase, announcement: string, moveFocus = true): void {
    this.phase.set(phase);
    this.announcement.set(announcement);
    if (moveFocus) {
      // El foco va al título de la pantalla nueva: así lo lee el lector de pantalla y se vuelve al principio.
      afterNextRender(
        () => {
          this.document.defaultView?.scrollTo(0, 0);
          this.document.getElementById('state-title')?.focus();
        },
        { injector: this.injector },
      );
    }
  }

  /** "Revisar mis datos": vuelve al formulario conservando todo lo cargado. */
  protected reviewData(): void {
    this.go('form', 'Formulario de inscripción');
  }

  /** "Volver al formulario" tras enviar: queda vacío, nunca se precarga una inscripción anterior. */
  protected startOver(): void {
    this.applications.clear();
    this.applications.push(this.newApplication());
    this.form.reset();
    this.submitError.set(null);
    this.summary.set(null);
    this.go('form', 'Formulario de inscripción');
  }

  // ---- Presentación ----

  protected dayMonth = formatDayMonth;
  protected score = formatScore;
  protected schoolSeniority = formatSeniority;
  protected employmentLabel(status: EmploymentStatus): string {
    return EMPLOYMENT_LABELS[status];
  }
  protected shiftLabel(shift: Shift): string {
    return SHIFT_LABELS[shift];
  }
}
