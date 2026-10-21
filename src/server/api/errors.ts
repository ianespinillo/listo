import type { Response } from 'express';

// Formato de error común de la API (docs/api.md).
export interface ApiError {
  error: string;
  message: string;
  fields?: Record<string, string>;
}

export function sendError(
  res: Response,
  status: number,
  error: string,
  message: string,
  fields?: Record<string, string>,
) {
  const body: ApiError = fields ? { error, message, fields } : { error, message };
  res.status(status).json(body);
}

export const DATA_MISMATCH_MESSAGE =
  'Ya existe una inscripción con ese DNI y los datos no coinciden. Si cambiaste de email, comunicate con la escuela.';
