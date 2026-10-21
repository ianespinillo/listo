import { EmploymentStatus, Shift } from '../../core/public-api.models';

export const EMPLOYMENT_OPTIONS: { value: EmploymentStatus; label: string; description: string }[] = [
  { value: 'TITULAR', label: 'Titular', description: 'Tengo horas o cargo titular en esta escuela' },
  { value: 'PROVISIONAL', label: 'Provisional', description: 'Tengo designación provisional en esta escuela' },
  { value: 'SUPLENTE', label: 'Suplente', description: 'Tengo una suplencia en esta escuela' },
  { value: 'EXTERNO', label: 'No trabajo en esta escuela', description: 'Estoy en actividad en otra escuela' },
];

export const EMPLOYMENT_LABELS: Record<EmploymentStatus, string> = {
  TITULAR: 'Titular',
  PROVISIONAL: 'Provisional',
  SUPLENTE: 'Suplente',
  EXTERNO: 'No trabajo en esta escuela',
};

/** El orden es el del contrato: se respeta al armar el cuerpo del envío. */
export const SHIFT_OPTIONS: { value: Shift; label: string }[] = [
  { value: 'MANANA', label: 'Mañana' },
  { value: 'TARDE', label: 'Tarde' },
  { value: 'VESPERTINO', label: 'Vespertino' },
];

export const SHIFT_LABELS: Record<Shift, string> = {
  MANANA: 'Mañana',
  TARDE: 'Tarde',
  VESPERTINO: 'Vespertino',
};

/** "2027-02-28" -> "28/02". Se corta el texto para no depender de la zona horaria. */
export function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return day && month ? `${day}/${month}` : isoDate;
}

/** "38.45" -> "38,45" */
export function formatScore(score: string): string {
  return score.replace('.', ',');
}

/** 110 meses -> "9 años y 2 meses" (se omite la parte en cero). */
export function formatSeniority(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [
    years > 0 ? `${years} ${years === 1 ? 'año' : 'años'}` : '',
    months > 0 ? `${months} ${months === 1 ? 'mes' : 'meses'}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' y ') : '0 años';
}
