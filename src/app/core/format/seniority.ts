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
