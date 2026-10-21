import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import {
  ApiError,
  PublicStatus,
  RegisterResult,
  RegistrationBody,
  RegistrationSuccess,
} from './public-api.models';

const NETWORK_MESSAGE = 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.';
const UNEXPECTED_MESSAGE = 'No pudimos enviar tu inscripción. Probá de nuevo en unos minutos.';

@Injectable({ providedIn: 'root' })
export class PublicApiService {
  private readonly http = inject(HttpClient);

  getStatus(): Observable<PublicStatus> {
    return this.http.get<PublicStatus>('/api/public/status');
  }

  /** Nunca falla: todos los errores HTTP vuelven como un resultado tipado. */
  register(body: RegistrationBody): Observable<RegisterResult> {
    return this.http
      .post<RegistrationSuccess>('/api/public/registration', body, { observe: 'response' })
      .pipe(
        map((res): RegisterResult => {
          const data = res.body;
          if (data && (data.result === 'created' || data.result === 'replaced')) {
            return { kind: data.result, summary: data.summary };
          }
          return { kind: 'unexpected', message: UNEXPECTED_MESSAGE };
        }),
        catchError((err: unknown) => of(mapError(err))),
      );
  }
}

function mapError(err: unknown): RegisterResult {
  if (!(err instanceof HttpErrorResponse)) {
    return { kind: 'unexpected', message: UNEXPECTED_MESSAGE };
  }
  if (err.status === 0) {
    return { kind: 'unexpected', message: NETWORK_MESSAGE };
  }

  const body: Partial<ApiError> =
    err.error && typeof err.error === 'object' ? (err.error as Partial<ApiError>) : {};
  const message = typeof body.message === 'string' && body.message ? body.message : '';

  switch (err.status) {
    case 400:
      return {
        kind: 'validation',
        message: message || 'Revisá los datos marcados.',
        fields: body.fields ?? {},
      };
    case 403:
      return { kind: 'closed' };
    case 409:
      return { kind: 'mismatch', message: message || UNEXPECTED_MESSAGE };
    case 429:
      return {
        kind: 'tooMany',
        message: message || 'Hiciste muchos envíos seguidos. Esperá un rato e intentá de nuevo.',
      };
    default:
      return { kind: 'unexpected', message: message || UNEXPECTED_MESSAGE };
  }
}
