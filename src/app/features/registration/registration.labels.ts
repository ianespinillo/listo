import { SHIFT_LABELS, SHIFT_ORDER } from '../../core/format';
import { EmploymentStatus, Shift } from '../../core/public-api.models';

/** Opciones de situación de revista con su descripción (propias del formulario público). */
export const EMPLOYMENT_OPTIONS: { value: EmploymentStatus; label: string; description: string }[] = [
  { value: 'TITULAR', label: 'Titular', description: 'Tengo horas o cargo titular en esta escuela' },
  { value: 'PROVISIONAL', label: 'Provisional', description: 'Tengo designación provisional en esta escuela' },
  { value: 'SUPLENTE', label: 'Suplente', description: 'Tengo una suplencia en esta escuela' },
  { value: 'EXTERNO', label: 'No trabajo en esta escuela', description: 'Estoy en actividad en otra escuela' },
];

/** El orden es el del contrato: se respeta al armar el cuerpo del envío. */
export const SHIFT_OPTIONS: { value: Shift; label: string }[] = SHIFT_ORDER.map((value) => ({
  value,
  label: SHIFT_LABELS[value],
}));
