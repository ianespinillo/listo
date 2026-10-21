/**
 * Tipos del contrato de la API pública (docs/api.md).
 * Se definen acá, del lado del front: `src/app` nunca importa de `src/server`.
 */

export type EmploymentStatus = 'TITULAR' | 'PROVISIONAL' | 'SUPLENTE' | 'EXTERNO';
export type Shift = 'MANANA' | 'TARDE' | 'VESPERTINO';
export type PositionType = 'ASIGNATURA' | 'CARGO';

export interface PublicPosition {
  id: number;
  name: string;
  type: PositionType;
}

export interface PublicStatus {
  cycle: { year: number; registrationFrom: string; registrationUntil: string } | null;
  open: boolean;
  school: { name: string; contact: string };
  positions: PublicPosition[];
}

export interface RegistrationBody {
  dni: string;
  lastName: string;
  firstName: string;
  email: string;
  phone: string;
  employmentStatus: EmploymentStatus;
  seniority: { years: number; months: number };
  /** Solo para titular, provisional y suplente; el externo no la manda. */
  schoolSeniority?: { years: number; months: number };
  shifts: Shift[];
  applications: { positionId: number; score: string }[];
  declaration: boolean;
}

export interface RegistrationSummary {
  lastName: string;
  firstName: string;
  dni: string;
  employmentStatus: EmploymentStatus;
  /** Meses en esta escuela; null para externos. */
  schoolSeniorityMonths: number | null;
  shifts: Shift[];
  applications: { position: string; score: string }[];
  registrationUntil: string;
}

/** Cuerpo de las respuestas 200/201. */
export interface RegistrationSuccess {
  result: 'created' | 'replaced';
  summary: RegistrationSummary;
}

/** Formato de error común de la API. */
export interface ApiError {
  error: string;
  message: string;
  fields?: Record<string, string>;
}

/** Resultado del envío, ya traducido desde el status HTTP para que el componente no tenga que mirarlo. */
export type RegisterResult =
  | { kind: 'created' | 'replaced'; summary: RegistrationSummary }
  | { kind: 'closed' }
  | { kind: 'mismatch'; message: string }
  | { kind: 'validation'; message: string; fields: Record<string, string> }
  | { kind: 'tooMany'; message: string }
  | { kind: 'unexpected'; message: string };
