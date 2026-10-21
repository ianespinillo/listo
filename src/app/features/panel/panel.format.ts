import { ApplicationStatus } from '../../core/panel-api.models';
import { EmploymentStatus, Shift } from '../../core/public-api.models';

const TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** Situación de revista, en el lenguaje del listado. */
export const EMPLOYMENT_SHORT: Record<EmploymentStatus, string> = {
  TITULAR: 'Titular',
  PROVISIONAL: 'Provisional',
  SUPLENTE: 'Suplente',
  EXTERNO: 'Externo',
};

/** Situación de revista, para la frase "… en esta escuela" del detalle. */
export const EMPLOYMENT_SENTENCE: Record<EmploymentStatus, string> = {
  TITULAR: 'Titular en esta escuela',
  PROVISIONAL: 'Provisional en esta escuela',
  SUPLENTE: 'Suplente en esta escuela',
  EXTERNO: 'No trabaja en esta escuela',
};

export const SHIFT_FULL: Record<Shift, string> = {
  MANANA: 'Mañana',
  TARDE: 'Tarde',
  VESPERTINO: 'Vespertino',
};

export const SHIFT_INITIAL: Record<Shift, string> = { MANANA: 'M', TARDE: 'T', VESPERTINO: 'V' };

/** El orden del contrato, para mostrar siempre M, T, V en ese orden. */
export const SHIFT_ORDER: Shift[] = ['MANANA', 'TARDE', 'VESPERTINO'];

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  VERIFIED: 'Verificado',
  UNVERIFIED: 'Sin verificar',
  MODIFIED: 'Puntaje modificado',
};

export const STATUS_BADGE: Record<ApplicationStatus, string> = {
  VERIFIED: 'badge badge-ok',
  UNVERIFIED: 'badge',
  MODIFIED: 'badge badge-mod',
};

/** "38.45" -> "38,45" */
export function formatScore(score: string): string {
  return score.replace('.', ',');
}

/** 110 -> "9 a 2 m" */
export function formatSeniorityShort(months: number): string {
  return `${Math.floor(months / 12)} a ${months % 12} m`;
}

/** Antigüedad corta que acepta null: 110 -> "9 a 2 m", null -> "—" */
export function formatSeniorityShortOrDash(months: number | null): string {
  return months === null ? '—' : formatSeniorityShort(months);
}

/** 110 -> "9 años 2 meses" */
export function formatSeniorityLong(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return `${years} ${years === 1 ? 'año' : 'años'} ${rest} ${rest === 1 ? 'mes' : 'meses'}`;
}

/** "2027-02-28" -> "28/02/2027". Se corta el texto para no depender de la zona horaria. */
export function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return year && month && day ? `${day}/${month}/${year}` : isoDate;
}

const dateTimeFormat = new Intl.DateTimeFormat('es-AR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Instante ISO 8601 -> "14/02/2027 18:32", en la hora de Buenos Aires. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    dateTimeFormat.formatToParts(date).find((p) => p.type === type)?.value ?? '';
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`;
}

/** Fecha de hoy ("AAAA-MM-DD") en la zona horaria de la escuela. */
export function todayInBuenosAires(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
}
