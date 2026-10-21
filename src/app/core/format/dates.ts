/** Zona horaria de la escuela: todas las fechas del producto se leen en esta zona. */
export const TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** "2027-02-28" -> "28/02". Se corta el texto para no depender de la zona horaria. */
export function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return day && month ? `${day}/${month}` : isoDate;
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
