import { todayInBuenosAires } from './dates';

/** Fecha sin hora: 'YYYY-MM-DD' o un Date a medianoche UTC (así llega un `@db.Date` de Prisma). */
export type DateOnly = string | Date;

export interface RegistrationWindow {
  registrationFrom: DateOnly;
  registrationUntil: DateOnly;
}

/** Pasa una fecha sin hora a 'YYYY-MM-DD'. */
export function toDateString(value: DateOnly): string {
  return typeof value === 'string' ? value : value.toISOString().slice(0, 10);
}

/**
 * ¿Está abierta la inscripción? Compara la fecha calendario de Buenos Aires en el instante
 * `now` contra el plazo, con los dos extremos incluidos. Sin ciclo, está cerrada.
 */
export function isRegistrationOpen(
  window: RegistrationWindow | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!window) return false;
  const today = todayInBuenosAires(now);
  return today >= toDateString(window.registrationFrom) && today <= toDateString(window.registrationUntil);
}
