import { ApplicationStatus } from '../panel-api.models';
import { EmploymentStatus, PositionType, Shift } from '../public-api.models';

/** Situación de revista, tal como la elige el docente en el formulario. */
export const EMPLOYMENT_LABELS: Record<EmploymentStatus, string> = {
  TITULAR: 'Titular',
  PROVISIONAL: 'Provisional',
  SUPLENTE: 'Suplente',
  EXTERNO: 'No trabajo en esta escuela',
};

/** Situación de revista, en el lenguaje del listado. */
export const EMPLOYMENT_SHORT: Record<EmploymentStatus, string> = {
  TITULAR: 'Titular',
  PROVISIONAL: 'Provisional',
  SUPLENTE: 'Suplente',
  EXTERNO: 'Externo',
};

/** Situación de revista, para la frase "… en esta escuela" del detalle. */
export const EMPLOYMENT_SENTENCE: Record<EmploymentStatus, string> = {
  TITULAR: 'Titular en esta escuela',
  PROVISIONAL: 'Provisional en esta escuela',
  SUPLENTE: 'Suplente en esta escuela',
  EXTERNO: 'No trabaja en esta escuela',
};

/** El orden del contrato: se respeta al armar el cuerpo del envío y al mostrar M, T, V. */
export const SHIFT_ORDER: Shift[] = ['MANANA', 'TARDE', 'VESPERTINO'];

export const SHIFT_LABELS: Record<Shift, string> = {
  MANANA: 'Mañana',
  TARDE: 'Tarde',
  VESPERTINO: 'Vespertino',
};

export const SHIFT_INITIAL: Record<Shift, string> = { MANANA: 'M', TARDE: 'T', VESPERTINO: 'V' };

export const POSITION_TYPE_LABELS: Record<PositionType, string> = {
  ASIGNATURA: 'Asignatura',
  CARGO: 'Cargo',
};

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  VERIFIED: 'Verificado',
  UNVERIFIED: 'Sin verificar',
  MODIFIED: 'Puntaje modificado',
};

/** Clases de `styles.css` de cada estado de verificación. */
export const STATUS_BADGE: Record<ApplicationStatus, string> = {
  VERIFIED: 'badge badge-ok',
  UNVERIFIED: 'badge',
  MODIFIED: 'badge badge-mod',
};
