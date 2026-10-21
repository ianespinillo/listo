// Utilidades puras de fechas. El plazo de inscripción se evalúa en la zona de Buenos Aires.

const TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** Fecha calendario actual en Buenos Aires, con formato 'YYYY-MM-DD'. */
export function todayInBuenosAires(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Suma (o resta) días a una fecha 'YYYY-MM-DD' y devuelve otra 'YYYY-MM-DD'. */
export function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
