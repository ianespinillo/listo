import { prisma } from '../../db';
import { canonicalScore } from '../../domain/normalize';
import type { Prisma } from '../../generated/prisma/client';

// El orden del listado sale SOLO de este SQL (reglas-de-negocio §2). Siempre con el tagged
// template de `$queryRaw`: los parámetros viajan escapados.
// Decisión de la escuela: el grupo 1 se ordena por antigüedad en el establecimiento
// (`school_seniority_months`), no por antigüedad docente.

export type ApplicationStatus = 'VERIFIED' | 'MODIFIED' | 'UNVERIFIED';

export function applicationStatus(verified: boolean, modified: boolean): ApplicationStatus {
  if (verified) return 'VERIFIED';
  return modified ? 'MODIFIED' : 'UNVERIFIED';
}

export interface ListingFilters {
  positionId: number;
  cycleId: number;
  /** Turno exigido (`MANANA`, `TARDE`, `VESPERTINO`) o null para no filtrar. */
  shift: string | null;
  onlyVerified: boolean;
}

export interface ListingRow {
  order: number;
  group: 1 | 2 | 3;
  applicantId: number;
  lastName: string;
  firstName: string;
  dni: string;
  employmentStatus: string;
  seniorityMonths: number;
  /** Antigüedad en la escuela (meses); null si no la declaró. */
  schoolSeniorityMonths: number | null;
  score: string;
  shifts: string[];
  status: ApplicationStatus;
  phone: string;
}

interface RawRow {
  id: number;
  last_name: string;
  first_name: string;
  dni: string;
  phone: string;
  employment_status: string;
  seniority_months: number;
  school_seniority_months: number | null;
  shifts: string[];
  score: { toString(): string };
  verified: boolean;
  modified: boolean;
  group_number: number;
  list_order: bigint | number;
}

type Db = typeof prisma | Prisma.TransactionClient;

/** Filas del listado de un puesto, ya ordenadas y numeradas (1..N global) según el decreto. */
export async function queryListing(db: Db, filters: ListingFilters): Promise<ListingRow[]> {
  const { positionId, cycleId, shift, onlyVerified } = filters;
  const rows = await db.$queryRaw<RawRow[]>`
    WITH base AS (
      SELECT
        a.id, a.last_name, a.first_name, a.dni, a.phone,
        a.employment_status, a.seniority_months, a.school_seniority_months, a.shifts::text[] AS shifts,
        ap.score, ap.verified, ap.modified, ap.previous_score,
        CASE a.employment_status
          WHEN 'TITULAR'     THEN 1
          WHEN 'PROVISIONAL' THEN 2
          WHEN 'SUPLENTE'    THEN 2
          ELSE 3
        END AS group_number
      FROM application ap
      JOIN applicant   a ON a.id = ap.applicant_id
      WHERE ap.position_id = ${positionId}
        AND a.cycle_id     = ${cycleId}
        AND a.deactivated  = false
        AND (${shift}::text IS NULL OR ${shift}::shift = ANY (a.shifts))
        AND (${onlyVerified}::boolean = false OR ap.verified = true)
    )
    SELECT
      base.*,
      ROW_NUMBER() OVER (
        ORDER BY
          group_number,
          CASE WHEN group_number = 1      THEN school_seniority_months END DESC NULLS LAST,
          CASE WHEN group_number IN (2,3) THEN score            END DESC NULLS LAST,
          CASE WHEN group_number = 2      THEN seniority_months END DESC NULLS LAST,
          last_name, first_name, id
      ) AS list_order
    FROM base
    ORDER BY list_order`;

  // `ROW_NUMBER` llega como bigint y `score` como Decimal: no se pueden serializar a JSON tal cual.
  return rows.map((row) => ({
    order: Number(row.list_order),
    group: Number(row.group_number) as 1 | 2 | 3,
    applicantId: row.id,
    lastName: row.last_name,
    firstName: row.first_name,
    dni: row.dni,
    employmentStatus: row.employment_status,
    seniorityMonths: row.seniority_months,
    schoolSeniorityMonths: row.school_seniority_months,
    score: canonicalScore(row.score),
    shifts: row.shifts,
    status: applicationStatus(row.verified, row.modified),
    phone: row.phone,
  }));
}
