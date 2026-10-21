/**
 * Tipos del contrato de la API del panel (docs/api.md, sección Panel).
 * Se definen acá, del lado del front: `src/app` nunca importa de `src/server`.
 */
import { EmploymentStatus, PositionType, Shift } from './public-api.models';

export type ApplicationStatus = 'VERIFIED' | 'MODIFIED' | 'UNVERIFIED';

export interface SessionInfo {
  email: string;
}

// ---- Listado ----

export interface ListingFilters {
  positionId: number | null;
  shift: Shift | null;
  onlyVerified: boolean;
}

export interface ListingRow {
  order: number;
  applicantId: number;
  lastName: string;
  firstName: string;
  dni: string;
  employmentStatus: EmploymentStatus;
  seniorityMonths: number;
  /** Meses en la escuela; null si no la declaró (externos e inscripciones anteriores). */
  schoolSeniorityMonths: number | null;
  score: string;
  shifts: Shift[];
  status: ApplicationStatus;
  phone: string;
}

export interface ListingGroup {
  group: 1 | 2 | 3;
  rows: ListingRow[];
}

export interface ListingResponse {
  cycle: { id: number; year: number; open: boolean } | null;
  position: { id: number; name: string; type: PositionType } | null;
  summary: { total: number; verified: number; modified: number };
  groups: ListingGroup[];
}

// ---- Postulantes ----

export type EventType =
  | 'REGISTRATION'
  | 'DATA_CHANGE'
  | 'SCORE_CHANGE'
  | 'POSITION_ADDED'
  | 'POSITION_REMOVED'
  | 'VERIFICATION'
  | 'UNVERIFICATION'
  | 'EMAIL_CHANGE'
  | 'DEACTIVATION'
  | 'REACTIVATION';

export interface ApplicationView {
  position: { id: number; name: string; type: PositionType; active: boolean };
  score: string;
  previousScore: string | null;
  status: ApplicationStatus;
  group: number | null;
  order: number | null;
}

export interface HistoryEvent {
  date: string;
  type: EventType;
  position: string | null;
  /** JSON libre según el tipo de evento; se lee de forma defensiva. */
  detail: unknown;
}

export interface ApplicantDetail {
  id: number;
  dni: string;
  lastName: string;
  firstName: string;
  email: string;
  phone: string;
  employmentStatus: EmploymentStatus;
  seniorityMonths: number;
  schoolSeniorityMonths: number | null;
  shifts: Shift[];
  deactivated: boolean;
  cycle: { id: number; year: number };
  applications: ApplicationView[];
  history: HistoryEvent[];
}

// ---- Puestos ----

export interface PanelPosition {
  id: number;
  name: string;
  type: PositionType;
  active: boolean;
  activeCycleApplicants: number;
}

export interface PositionBody {
  name?: string;
  type?: PositionType;
  active?: boolean;
}

// ---- Ciclos ----

export interface CycleItem {
  id: number;
  year: number;
  registrationFrom: string;
  registrationUntil: string;
  active: boolean;
  open: boolean;
  applicants: number;
}

export interface CycleDates {
  registrationFrom: string;
  registrationUntil: string;
}

export interface NewCycleBody extends CycleDates {
  year: number;
}

/** Error de la API ya normalizado para mostrarlo en pantalla. */
export interface PanelApiError {
  /** Status HTTP; 0 si no hubo respuesta (sin conexión). */
  status: number;
  /** Código de la API (`VALIDATION_ERROR`, `DUPLICATE_POSITION`…) o cadena vacía. */
  code: string;
  message: string;
  fields: Record<string, string>;
}
