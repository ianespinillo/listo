import { describe, expect, it } from 'vitest';
import {
  canonicalScore,
  normalizeDni,
  normalizeEmail,
  normalizeScore,
  normalizeText,
  seniorityToMonths,
} from './normalize';

describe('normalizeDni', () => {
  it('deja solo los dígitos', () => {
    expect(normalizeDni('28.123.456')).toBe('28123456');
    expect(normalizeDni(' 28 123 456 ')).toBe('28123456');
  });
});

describe('normalizeEmail', () => {
  it('recorta y pasa a minúsculas', () => {
    expect(normalizeEmail('Laura.Pereyra@Ejemplo.com ')).toBe('laura.pereyra@ejemplo.com');
  });
});

describe('normalizeText', () => {
  it('recorta y colapsa espacios internos', () => {
    expect(normalizeText('  Laura   Inés \t')).toBe('Laura Inés');
  });
});

describe('seniorityToMonths', () => {
  it('convierte años y meses a meses', () => {
    expect(seniorityToMonths({ years: 9, months: 2 })).toBe(110);
    expect(seniorityToMonths({ years: 0, months: 0 })).toBe(0);
  });
});

describe('normalizeScore', () => {
  it('acepta coma o punto', () => {
    expect(normalizeScore('38,45')).toEqual({ ok: true, value: '38.45' });
    expect(normalizeScore('38.45')).toEqual({ ok: true, value: '38.45' });
  });

  it('completa a 2 decimales', () => {
    expect(normalizeScore('38.4')).toEqual({ ok: true, value: '38.40' });
    expect(normalizeScore('38')).toEqual({ ok: true, value: '38.00' });
    expect(normalizeScore(31.2)).toEqual({ ok: true, value: '31.20' });
  });

  it('acepta los extremos 0 y 999,99', () => {
    expect(normalizeScore('0')).toEqual({ ok: true, value: '0.00' });
    expect(normalizeScore('999,99')).toEqual({ ok: true, value: '999.99' });
  });

  it('rechaza más de 2 decimales, negativos, fuera de rango y no numéricos', () => {
    for (const bad of ['38.456', '-1', '-0.5', '1000', '1000.00', 'abc', '', ' ', '1,2,3', '1e2', null, undefined, NaN, -3]) {
      expect(normalizeScore(bad)).toEqual({ ok: false });
    }
  });
});

describe('canonicalScore', () => {
  it('iguala "38.4" y "38.40"', () => {
    expect(canonicalScore('38.4')).toBe(canonicalScore('38.40'));
    expect(canonicalScore({ toString: () => '38.4' })).toBe('38.40');
  });
});
