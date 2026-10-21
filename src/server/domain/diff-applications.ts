import { canonicalScore } from './normalize';

// Diff entre la inscripción guardada y la nueva (reglas-de-negocio §3, paso 7). Función pura.

export interface DiffState {
  employmentStatus: string;
  seniorityMonths: number;
  schoolSeniorityMonths: number | null;
}

export interface OldApplication {
  positionId: number;
  score: { toString(): string } | string;
  verified: boolean;
}

export interface NewApplication {
  positionId: number;
  score: { toString(): string } | string;
}

export type DiffEventType = 'DATA_CHANGE' | 'SCORE_CHANGE' | 'POSITION_ADDED' | 'POSITION_REMOVED';

export interface DiffEvent {
  type: DiffEventType;
  positionId?: number;
  detail: Record<string, unknown>;
}

export interface ApplicationsDiff {
  /** Cambió la situación de revista o alguna antigüedad (docente o en la escuela). */
  dataChanged: boolean;
  /**
   * Si es true hay que poner `verified=false` en TODAS las postulaciones que se conservan
   * (incluidas las que mantienen el mismo puntaje), porque cambiaron datos que definen el orden.
   */
  unverifyAll: boolean;
  create: { positionId: number; score: string }[];
  /** Cambió el puntaje: `previousScore` = viejo, `verified=false`, `modified=true`. */
  update: { positionId: number; score: string; previousScore: string }[];
  /** Mismo puntaje: no se toca (salvo `unverifyAll`). */
  unchanged: number[];
  delete: number[];
  events: DiffEvent[];
}

export function diffApplications(
  old: DiffState & { applications: OldApplication[] },
  next: DiffState & { applications: NewApplication[] },
): ApplicationsDiff {
  const dataChanged =
    old.employmentStatus !== next.employmentStatus ||
    old.seniorityMonths !== next.seniorityMonths ||
    old.schoolSeniorityMonths !== next.schoolSeniorityMonths;

  const events: DiffEvent[] = [];
  if (dataChanged) {
    events.push({
      type: 'DATA_CHANGE',
      detail: {
        previous: {
          employmentStatus: old.employmentStatus,
          seniorityMonths: old.seniorityMonths,
          schoolSeniorityMonths: old.schoolSeniorityMonths,
        },
        new: {
          employmentStatus: next.employmentStatus,
          seniorityMonths: next.seniorityMonths,
          schoolSeniorityMonths: next.schoolSeniorityMonths,
        },
      },
    });
  }

  const oldByPosition = new Map(old.applications.map((a) => [a.positionId, a]));
  const newPositionIds = new Set(next.applications.map((a) => a.positionId));

  const create: ApplicationsDiff['create'] = [];
  const update: ApplicationsDiff['update'] = [];
  const unchanged: number[] = [];

  for (const application of next.applications) {
    const score = canonicalScore(application.score);
    const previous = oldByPosition.get(application.positionId);
    if (!previous) {
      create.push({ positionId: application.positionId, score });
      events.push({ type: 'POSITION_ADDED', positionId: application.positionId, detail: { score } });
      continue;
    }
    const previousScore = canonicalScore(previous.score);
    if (previousScore === score) {
      unchanged.push(application.positionId);
    } else {
      update.push({ positionId: application.positionId, score, previousScore });
      events.push({
        type: 'SCORE_CHANGE',
        positionId: application.positionId,
        detail: { previous: previousScore, new: score },
      });
    }
  }

  const toDelete: number[] = [];
  for (const application of old.applications) {
    if (newPositionIds.has(application.positionId)) continue;
    toDelete.push(application.positionId);
    events.push({
      type: 'POSITION_REMOVED',
      positionId: application.positionId,
      detail: { score: canonicalScore(application.score) },
    });
  }

  return {
    dataChanged,
    unverifyAll: dataChanged,
    create,
    update,
    unchanged,
    delete: toDelete,
    events,
  };
}
