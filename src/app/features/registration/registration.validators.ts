import { FormArray, ValidationErrors, ValidatorFn } from '@angular/forms';
import { EMAIL_PATTERN } from '../../core/forms';

/**
 * Validadores del formulario público. Replican las reglas del servidor para dar feedback rápido,
 * pero la regla vale en el servidor.
 *
 * Convención: `{ required: true }` cuando falta el dato (el texto lo pone el componente según el campo)
 * y `{ message: '…' }` cuando el dato es inválido (el texto ya viene listo).
 */

const message = (text: string): ValidationErrors => ({ message: text });

/** Texto obligatorio de hasta `max` caracteres (se ignoran los espacios de los bordes). */
export function requiredText(max: number): ValidatorFn {
  return (control) => {
    const value = String(control.value ?? '').trim();
    if (!value) return { required: true };
    return value.length > max ? message(`Puede tener hasta ${max} caracteres.`) : null;
  };
}

export const dniValidator: ValidatorFn = (control) => {
  const value = String(control.value ?? '').trim();
  if (!value) return { required: true };
  if (!/^[\d.\s]+$/.test(value)) return message('El DNI solo puede tener números.');
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 8 ? null : message('El DNI tiene que tener 7 u 8 números.');
};

export const emailValidator: ValidatorFn = (control) => {
  const value = String(control.value ?? '').trim();
  if (!value) return { required: true };
  return EMAIL_PATTERN.test(value) ? null : message('Ingresá un email válido.');
};

export const phoneValidator: ValidatorFn = (control) => {
  const value = String(control.value ?? '').trim();
  if (!value) return { required: true };
  return value.length >= 6 && value.length <= 30
    ? null
    : message('El teléfono tiene que tener entre 6 y 30 caracteres.');
};

/** Entero entre `min` y `max`. Vacío = faltante. */
export function integerBetween(min: number, max: number): ValidatorFn {
  return (control) => {
    const value = control.value as number | null;
    if (value === null || value === undefined || (value as unknown) === '') return { required: true };
    return Number.isInteger(value) && value >= min && value <= max
      ? null
      : message(`Ingresá un número entero entre ${min} y ${max}.`);
  };
}

export const SCHOOL_SENIORITY_TOO_HIGH = 'No puede ser mayor que tu antigüedad docente.';

const isWhole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

/**
 * Años de antigüedad en la escuela: entero entre 0 y 60 y, junto con los meses, no mayor que la
 * antigüedad docente (controles hermanos `schoolMonths`, `seniorityYears` y `seniorityMonths`).
 * El error de la comparación va en los años, igual que en el servidor.
 */
export const schoolYearsValidator: ValidatorFn = (control) => {
  const own = integerBetween(0, 60)(control);
  if (own) return own;
  const group = control.parent;
  if (!group) return null;
  const years = control.value as unknown;
  const months = group.get('schoolMonths')?.value as unknown;
  const teachingYears = group.get('seniorityYears')?.value as unknown;
  const teachingMonths = group.get('seniorityMonths')?.value as unknown;
  if (![years, months, teachingYears, teachingMonths].every(isWhole)) return null;
  const school = (years as number) * 12 + (months as number);
  const teaching = (teachingYears as number) * 12 + (teachingMonths as number);
  return school > teaching ? message(SCHOOL_SENIORITY_TOO_HIGH) : null;
};

/** Puntaje 0–999,99 con hasta 2 decimales; acepta coma o punto. */
export const scoreValidator: ValidatorFn = (control) => {
  const value = String(control.value ?? '').trim();
  if (!value) return { required: true };
  return /^\d{1,3}([.,]\d{1,2})?$/.test(value)
    ? null
    : message('Ingresá un puntaje entre 0 y 999,99, con hasta 2 decimales.');
};

/** Al menos un turno tildado. */
export const atLeastOneShift: ValidatorFn = (control) => {
  const values = Object.values(control.value as Record<string, boolean>);
  return values.some(Boolean) ? null : message('Elegí al menos un turno.');
};

/**
 * Marca como repetidas las filas cuyo puesto ya apareció antes en la lista
 * (la primera ocurrencia queda sin marcar). Devuelve los índices repetidos.
 */
export const noDuplicatePositions: ValidatorFn = (control) => {
  const rows = (control as FormArray).controls;
  const seen = new Set<number>();
  const duplicates: number[] = [];
  rows.forEach((row, index) => {
    const positionId = row.get('positionId')?.value as number | null;
    if (positionId === null || positionId === undefined) return;
    if (seen.has(positionId)) duplicates.push(index);
    seen.add(positionId);
  });
  return duplicates.length ? { duplicates } : null;
};
