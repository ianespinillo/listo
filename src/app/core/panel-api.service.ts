import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ApplicantDetail,
  ApplicationView,
  CycleDates,
  CycleItem,
  ListingFilters,
  ListingResponse,
  NewCycleBody,
  PanelApiError,
  PanelPosition,
  PositionBody,
  SessionInfo,
} from './panel-api.models';
import { PositionType } from './public-api.models';

const BASE = '/api/panel';

/**
 * Todas las rutas del panel. Las que modifican datos y no llevan cuerpo mandan `{}`:
 * el servidor solo acepta `application/json` en POST, PUT, PATCH y DELETE (415 si no).
 */
@Injectable({ providedIn: 'root' })
export class PanelApiService {
  private readonly http = inject(HttpClient);

  // ---- Sesión ----

  session(): Observable<SessionInfo> {
    return this.http.get<SessionInfo>(`${BASE}/session`);
  }

  login(email: string, password: string): Observable<void> {
    return this.http.post<void>(`${BASE}/login`, { email, password });
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${BASE}/logout`, {});
  }

  // ---- Listado ----

  getListing(filters: ListingFilters): Observable<ListingResponse> {
    let params = new HttpParams();
    if (filters.positionId !== null) params = params.set('positionId', filters.positionId);
    if (filters.shift) params = params.set('shift', filters.shift);
    if (filters.onlyVerified) params = params.set('onlyVerified', 'true');
    return this.http.get<ListingResponse>(`${BASE}/listing`, { params });
  }

  // ---- Postulantes ----

  getApplicant(id: number): Observable<ApplicantDetail> {
    return this.http.get<ApplicantDetail>(`${BASE}/applicants/${id}`);
  }

  updateApplicantEmail(id: number, email: string): Observable<ApplicantDetail> {
    return this.http.patch<ApplicantDetail>(`${BASE}/applicants/${id}`, { email });
  }

  deactivateApplicant(id: number): Observable<void> {
    return this.http.post<void>(`${BASE}/applicants/${id}/deactivate`, {});
  }

  reactivateApplicant(id: number): Observable<void> {
    return this.http.post<void>(`${BASE}/applicants/${id}/reactivate`, {});
  }

  setVerification(id: number, positionId: number, verified: boolean): Observable<ApplicationView> {
    return this.http.put<ApplicationView>(
      `${BASE}/applicants/${id}/applications/${positionId}/verification`,
      { verified },
    );
  }

  // ---- Puestos ----

  getPositions(): Observable<PanelPosition[]> {
    return this.http.get<PanelPosition[]>(`${BASE}/positions`);
  }

  createPosition(body: { name: string; type: PositionType }): Observable<PanelPosition> {
    return this.http.post<PanelPosition>(`${BASE}/positions`, body);
  }

  updatePosition(id: number, body: PositionBody): Observable<PanelPosition> {
    return this.http.patch<PanelPosition>(`${BASE}/positions/${id}`, body);
  }

  // ---- Ciclos ----

  getCycles(): Observable<CycleItem[]> {
    return this.http.get<CycleItem[]>(`${BASE}/cycles`);
  }

  updateCycle(id: number, dates: CycleDates): Observable<CycleItem> {
    return this.http.patch<CycleItem>(`${BASE}/cycles/${id}`, dates);
  }

  createCycle(body: NewCycleBody): Observable<CycleItem> {
    return this.http.post<CycleItem>(`${BASE}/cycles`, body);
  }
}

const NETWORK_MESSAGE = 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.';
const UNEXPECTED_MESSAGE = 'Ocurrió un error inesperado. Probá de nuevo en unos minutos.';

/** Convierte cualquier error de `HttpClient` en algo mostrable. Nunca expone detalles internos. */
export function parseApiError(err: unknown): PanelApiError {
  if (!(err instanceof HttpErrorResponse)) {
    return { status: -1, code: '', message: UNEXPECTED_MESSAGE, fields: {} };
  }
  if (err.status === 0) {
    return { status: 0, code: '', message: NETWORK_MESSAGE, fields: {} };
  }
  const body: { error?: unknown; message?: unknown; fields?: unknown } =
    err.error && typeof err.error === 'object' ? err.error : {};
  const fields: Record<string, string> = {};
  if (body.fields && typeof body.fields === 'object') {
    for (const [key, value] of Object.entries(body.fields)) {
      if (typeof value === 'string') fields[key] = value;
    }
  }
  return {
    status: err.status,
    code: typeof body.error === 'string' ? body.error : '',
    message: typeof body.message === 'string' && body.message ? body.message : UNEXPECTED_MESSAGE,
    fields,
  };
}
