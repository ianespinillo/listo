import { describe, expect, it } from 'vitest';
import { isRegistrationOpen } from './registration-window';

const window = { registrationFrom: '2027-02-01', registrationUntil: '2027-02-28' };

describe('isRegistrationOpen', () => {
  it('sin ciclo está cerrada', () => {
    expect(isRegistrationOpen(null, new Date('2027-02-10T15:00:00Z'))).toBe(false);
    expect(isRegistrationOpen(undefined, new Date('2027-02-10T15:00:00Z'))).toBe(false);
  });

  it('en medio del plazo está abierta', () => {
    expect(isRegistrationOpen(window, new Date('2027-02-10T15:00:00Z'))).toBe(true);
  });

  it('el primer día está incluido (hora argentina)', () => {
    // 2027-02-01 03:00Z = 00:00 en Buenos Aires.
    expect(isRegistrationOpen(window, new Date('2027-02-01T03:00:00Z'))).toBe(true);
    // 02:59:59Z todavía es 31 de enero en Buenos Aires.
    expect(isRegistrationOpen(window, new Date('2027-02-01T02:59:59Z'))).toBe(false);
  });

  it('el último día está incluido hasta las 23:59:59 argentinas', () => {
    // 2027-03-01 02:59:59Z = 28/02 23:59:59 en Buenos Aires.
    expect(isRegistrationOpen(window, new Date('2027-03-01T02:59:59Z'))).toBe(true);
    // 03:00Z ya es 1 de marzo en Buenos Aires.
    expect(isRegistrationOpen(window, new Date('2027-03-01T03:00:00Z'))).toBe(false);
  });

  it('2027-02-28T02:59:59Z todavía es 27 de febrero en Buenos Aires', () => {
    expect(isRegistrationOpen(window, new Date('2027-02-28T02:59:59Z'))).toBe(true);
    expect(isRegistrationOpen({ registrationFrom: '2027-02-28', registrationUntil: '2027-02-28' }, new Date('2027-02-28T02:59:59Z'))).toBe(false);
  });

  it('acepta fechas como Date a medianoche UTC (columna @db.Date)', () => {
    const fromDb = {
      registrationFrom: new Date('2027-02-01T00:00:00Z'),
      registrationUntil: new Date('2027-02-28T00:00:00Z'),
    };
    expect(isRegistrationOpen(fromDb, new Date('2027-02-28T20:00:00Z'))).toBe(true);
    expect(isRegistrationOpen(fromDb, new Date('2027-03-01T03:00:00Z'))).toBe(false);
  });
});
