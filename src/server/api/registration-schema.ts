import { z } from 'zod';
import {
  normalizeDni,
  normalizeEmail,
  normalizeScore,
  normalizeText,
  seniorityToMonths,
} from '../domain/normalize';

// Validación del cuerpo de POST /api/public/registration. Normaliza y después valida;
// los mensajes son para mostrar al usuario. Las claves de `fields` salen del path de zod
// (por ejemplo `applications.1.score`).

const EMPLOYMENT_STATUSES = ['TITULAR', 'PROVISIONAL', 'SUPLENTE', 'EXTERNO'] as const;
const SHIFTS = ['MANANA', 'TARDE', 'VESPERTINO'] as const;

export const DUPLICATE_POSITION_MESSAGE = 'Esta materia ya está en tu lista.';
export const MAX_APPLICATIONS = 50;

const REQUIRED = 'Completá este dato.';

/** Texto obligatorio, normalizado, con largo mínimo y máximo. */
function requiredText(min: number, max: number, tooShort: string, tooLong: string) {
  return z
    .string({ error: REQUIRED })
    .transform(normalizeText)
    .pipe(z.string().min(min, tooShort).max(max, tooLong));
}

function integerInRange(min: number, max: number, message: string) {
  return z.number({ error: message }).int(message).min(min, message).max(max, message);
}

/** Antigüedad como { years, months }, con los rangos del decreto (0–60 años, 0–11 meses). */
function seniority(missing: string) {
  return z.object(
    {
      years: integerInRange(0, 60, 'Los años deben ser un número entero entre 0 y 60.'),
      months: integerInRange(0, 11, 'Los meses deben ser un número entero entre 0 y 11.'),
    },
    { error: missing },
  );
}

export const SCHOOL_SENIORITY_TOO_HIGH_MESSAGE = 'No puede ser mayor que tu antigüedad docente.';

const score = z.union([z.string(), z.number()], { error: 'Ingresá el puntaje.' }).transform((value, ctx) => {
  const result = normalizeScore(value);
  if (!result.ok) {
    ctx.issues.push({
      code: 'custom',
      message: 'El puntaje debe estar entre 0 y 999,99, con dos decimales como máximo.',
      input: value,
    });
    return z.NEVER;
  }
  return result.value;
});

/** Email normalizado (trim + minúsculas) y validado. Lo usa también el panel. */
export const emailSchema = z
  .string({ error: REQUIRED })
  .transform(normalizeEmail)
  .pipe(z.string().max(254, 'El email es demasiado largo.').pipe(z.email('Ingresá un email válido.')));

export const registrationSchema = z.object({
  dni: z
    .string({ error: REQUIRED })
    .transform(normalizeDni)
    .pipe(z.string().regex(/^\d{7,8}$/, 'El DNI debe tener 7 u 8 dígitos.')),
  lastName: requiredText(1, 80, 'Ingresá tu apellido.', 'El apellido puede tener hasta 80 caracteres.'),
  firstName: requiredText(1, 80, 'Ingresá tu nombre.', 'El nombre puede tener hasta 80 caracteres.'),
  email: emailSchema,
  phone: requiredText(6, 30, 'El teléfono debe tener al menos 6 caracteres.', 'El teléfono puede tener hasta 30 caracteres.'),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES, { error: 'Elegí tu situación de revista.' }),
  seniority: seniority('Ingresá tu antigüedad.'),
  // Obligatoria para titular/provisional/suplente (ver superRefine); para externo se ignora.
  schoolSeniority: seniority('Ingresá tu antigüedad en esta escuela.').optional(),
  shifts: z
    .array(z.enum(SHIFTS, { error: 'Turno inválido.' }), { error: 'Elegí al menos un turno.' })
    .min(1, 'Elegí al menos un turno.')
    .refine((list) => new Set(list).size === list.length, 'No repitas turnos.'),
  applications: z
    .array(
      z.object({
        positionId: z
          .number({ error: 'Elegí una materia.' })
          .int('Elegí una materia.')
          .positive('Elegí una materia.'),
        score,
      }),
      { error: 'Agregá al menos una materia.' },
    )
    .min(1, 'Agregá al menos una materia.')
    .max(MAX_APPLICATIONS, `Podés cargar hasta ${MAX_APPLICATIONS} materias.`)
    .superRefine((rows, ctx) => {
      const seen = new Set<number>();
      rows.forEach((row, index) => {
        if (seen.has(row.positionId)) {
          ctx.addIssue({
            code: 'custom',
            message: DUPLICATE_POSITION_MESSAGE,
            path: [index, 'positionId'],
          });
        }
        seen.add(row.positionId);
      });
    }),
  declaration: z.literal(true, { error: 'Tenés que aceptar la declaración para enviar.' }),
}).superRefine((data, ctx) => {
  // Quienes trabajan en la escuela declaran su antigüedad en ella; el externo no.
  if (!worksAtSchool(data.employmentStatus)) return;
  if (!data.schoolSeniority) {
    for (const part of ['years', 'months']) {
      ctx.addIssue({
        code: 'custom',
        message: 'Ingresá tu antigüedad en esta escuela.',
        path: ['schoolSeniority', part],
      });
    }
    return;
  }
  if (seniorityToMonths(data.schoolSeniority) > seniorityToMonths(data.seniority)) {
    ctx.addIssue({
      code: 'custom',
      message: SCHOOL_SENIORITY_TOO_HIGH_MESSAGE,
      path: ['schoolSeniority', 'years'],
    });
  }
});

/** Titular, provisional y suplente trabajan en la escuela; el externo no. */
export function worksAtSchool(employmentStatus: string): boolean {
  return employmentStatus !== 'EXTERNO';
}

export type RegistrationInput = z.output<typeof registrationSchema>;

/** Convierte los errores de zod al mapa `fields` del contrato (clave con puntos → mensaje). */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : 'body';
    fields[key] ??= issue.message;
  }
  return fields;
}
