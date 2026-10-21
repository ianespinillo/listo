// Normalización de los datos de entrada. Funciones puras, sin acceso a la base.

/** DNI: se descartan todos los caracteres que no son dígitos. */
export function normalizeDni(value: string): string {
  return value.replace(/\D/g, '');
}

/** Email: trim + minúsculas. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Texto: trim y espacios internos múltiples colapsados en uno. */
export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Antigüedad total en meses. */
export function seniorityToMonths(seniority: { years: number; months: number }): number {
  return seniority.years * 12 + seniority.months;
}

export const MAX_SCORE = 999.99;

export type ScoreResult = { ok: true; value: string } | { ok: false };

/**
 * Puntaje: acepta "38,45", "38.45" o un número. Devuelve el valor canónico con
 * exactamente 2 decimales ("38.45"). Rechaza más de 2 decimales, negativos,
 * valores mayores a 999,99 y cualquier cosa que no sea un número.
 */
export function normalizeScore(value: unknown): ScoreResult {
  let text: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { ok: false };
    text = String(value);
  } else if (typeof value === 'string') {
    text = value.trim().replace(',', '.');
  } else {
    return { ok: false };
  }

  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return { ok: false };

  const [, integer, decimals = ''] = match;
  // Sin ceros a la izquierda raros: "007.5" se acepta y se canoniza a "7.50".
  const canonical = `${Number(integer)}.${decimals.padEnd(2, '0')}`;
  if (Number(canonical) > MAX_SCORE) return { ok: false };
  return { ok: true, value: canonical };
}

/** Canoniza un puntaje ya guardado ("38.4", "38.40" o Decimal) a 2 decimales. */
export function canonicalScore(value: { toString(): string } | string): string {
  const result = normalizeScore(value.toString());
  return result.ok ? result.value : value.toString();
}
