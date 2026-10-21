import { describe, expect, it } from 'vitest';
import { diffApplications } from './diff-applications';

const base = { employmentStatus: 'PROVISIONAL', seniorityMonths: 110 };

describe('diffApplications', () => {
  it('sin cambios: no toca nada ni genera eventos', () => {
    const diff = diffApplications(
      { ...base, applications: [{ positionId: 1, score: '38.45', verified: true }] },
      { ...base, applications: [{ positionId: 1, score: '38.45' }] },
    );
    expect(diff.dataChanged).toBe(false);
    expect(diff.unverifyAll).toBe(false);
    expect(diff.create).toEqual([]);
    expect(diff.update).toEqual([]);
    expect(diff.delete).toEqual([]);
    expect(diff.unchanged).toEqual([1]);
    expect(diff.events).toEqual([]);
  });

  it('"38.4" contra "38.40" es el mismo puntaje', () => {
    const diff = diffApplications(
      { ...base, applications: [{ positionId: 1, score: '38.40', verified: true }] },
      { ...base, applications: [{ positionId: 1, score: '38.4' }] },
    );
    expect(diff.update).toEqual([]);
    expect(diff.unchanged).toEqual([1]);
    expect(diff.events).toEqual([]);
  });

  it('cambio de puntaje: guarda el anterior y registra SCORE_CHANGE', () => {
    const diff = diffApplications(
      { ...base, applications: [{ positionId: 1, score: '36.10', verified: true }] },
      { ...base, applications: [{ positionId: 1, score: '38.45' }] },
    );
    expect(diff.update).toEqual([{ positionId: 1, score: '38.45', previousScore: '36.10' }]);
    expect(diff.unchanged).toEqual([]);
    expect(diff.events).toEqual([
      { type: 'SCORE_CHANGE', positionId: 1, detail: { previous: '36.10', new: '38.45' } },
    ]);
  });

  it('puesto nuevo: se crea y registra POSITION_ADDED', () => {
    const diff = diffApplications(
      { ...base, applications: [{ positionId: 1, score: '38.45', verified: true }] },
      {
        ...base,
        applications: [
          { positionId: 1, score: '38.45' },
          { positionId: 2, score: '31.2' },
        ],
      },
    );
    expect(diff.create).toEqual([{ positionId: 2, score: '31.20' }]);
    expect(diff.events).toEqual([{ type: 'POSITION_ADDED', positionId: 2, detail: { score: '31.20' } }]);
  });

  it('puesto que ya no está: se borra y registra POSITION_REMOVED', () => {
    const diff = diffApplications(
      {
        ...base,
        applications: [
          { positionId: 1, score: '38.45', verified: true },
          { positionId: 2, score: '31.20', verified: false },
        ],
      },
      { ...base, applications: [{ positionId: 1, score: '38.45' }] },
    );
    expect(diff.delete).toEqual([2]);
    expect(diff.events).toEqual([
      { type: 'POSITION_REMOVED', positionId: 2, detail: { score: '31.20' } },
    ]);
  });

  it('cambio de situación de revista: DATA_CHANGE y desverifica todo, incluso con el mismo puntaje', () => {
    const diff = diffApplications(
      { ...base, applications: [{ positionId: 1, score: '38.45', verified: true }] },
      { employmentStatus: 'TITULAR', seniorityMonths: 110, applications: [{ positionId: 1, score: '38.45' }] },
    );
    expect(diff.dataChanged).toBe(true);
    expect(diff.unverifyAll).toBe(true);
    // Mismo puntaje: no es un SCORE_CHANGE ni se marca como modificada.
    expect(diff.update).toEqual([]);
    expect(diff.unchanged).toEqual([1]);
    expect(diff.events).toEqual([
      {
        type: 'DATA_CHANGE',
        detail: {
          previous: { employmentStatus: 'PROVISIONAL', seniorityMonths: 110 },
          new: { employmentStatus: 'TITULAR', seniorityMonths: 110 },
        },
      },
    ]);
  });

  it('cambio de antigüedad también cuenta como cambio de datos', () => {
    const diff = diffApplications(
      { ...base, applications: [] },
      { ...base, seniorityMonths: 111, applications: [] },
    );
    expect(diff.dataChanged).toBe(true);
    expect(diff.events[0]?.type).toBe('DATA_CHANGE');
  });
});
