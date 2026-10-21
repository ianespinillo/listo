import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

/**
 * Mensaje de error de un control, o null si todavía no hay que mostrarlo (sin tocar o sin errores).
 * Convención de los validadores: `server` y `message` traen el texto listo; `required` usa `requiredText`.
 */
export function errorOf(control: AbstractControl | null, requiredText: string): string | null {
  if (!control || !control.touched || !control.errors) return null;
  const errors = control.errors;
  if (typeof errors['server'] === 'string') return errors['server'];
  if (errors['required']) return requiredText;
  return typeof errors['message'] === 'string' ? errors['message'] : null;
}

/** Recalcula la validez de todos los controles, de las hojas hacia la raíz. */
export function revalidate(control: AbstractControl): void {
  if (control instanceof FormGroup) {
    Object.values(control.controls).forEach(revalidate);
  } else if (control instanceof FormArray) {
    control.controls.forEach(revalidate);
  }
  control.updateValueAndValidity({ onlySelf: true });
}

/**
 * Pone cada error del servidor en su control (`resolve` traduce la clave del contrato al control).
 * Devuelve los mensajes de las claves que no se pudieron asociar a ningún control.
 */
export function applyServerErrors(
  fields: Record<string, string>,
  resolve: (key: string) => AbstractControl | null,
): string[] {
  const unmapped: string[] = [];
  for (const [key, text] of Object.entries(fields)) {
    const control = resolve(key);
    if (control) {
      control.setErrors({ server: text });
      control.markAsTouched();
    } else {
      unmapped.push(text);
    }
  }
  return unmapped;
}
