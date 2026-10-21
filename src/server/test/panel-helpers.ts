import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';
import { prisma } from '../db';
import { createApiRouter, type ApiRouterOptions } from '../api';

// Utilidades para los tests de la API del panel.

export const ADMIN_EMAIL = 'directora@escuela.test';
export const ADMIN_PASSWORD = 'clave-segura-1';

/** Reloj fijo dentro del plazo del ciclo de prueba (2027-02-10, mediodía en Buenos Aires). */
export const OPEN_NOW = new Date('2027-02-10T15:00:00Z');

export type Agent = ReturnType<typeof request.agent>;

export function buildApp(options: ApiRouterOptions = {}) {
  const app = express();
  app.use(
    '/api',
    createApiRouter({
      now: () => OPEN_NOW,
      registrationRateLimit: false,
      loginRateLimit: false,
      ...options,
    }),
  );
  return app;
}

/** Crea la usuaria del panel (costo de bcrypt bajo: es solo para los tests). */
export async function createAdmin(email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  return prisma.admin.create({ data: { email, passwordHash: await bcrypt.hash(password, 4) } });
}

/** Agente de supertest con la sesión iniciada (guarda la cookie entre pedidos). */
export async function loginAgent(app: ReturnType<typeof buildApp>): Promise<Agent> {
  const agent = request.agent(app);
  await agent.post('/api/panel/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }).expect(204);
  return agent;
}

/** Crea el admin y devuelve la app con un agente ya autenticado. */
export async function setupPanel(options: ApiRouterOptions = {}) {
  await createAdmin();
  const app = buildApp(options);
  return { app, agent: await loginAgent(app) };
}

export interface ApplicantSeed {
  dni?: string;
  lastName?: string;
  firstName?: string;
  email?: string;
  phone?: string;
  employmentStatus?: 'TITULAR' | 'PROVISIONAL' | 'SUPLENTE' | 'EXTERNO';
  seniorityMonths?: number;
  /** Por defecto: igual a la docente para quien trabaja en la escuela, null para externos. */
  schoolSeniorityMonths?: number | null;
  shifts?: ('MANANA' | 'TARDE' | 'VESPERTINO')[];
  deactivated?: boolean;
}

export interface ApplicationSeed {
  positionId: number;
  score: string;
  verified?: boolean;
  modified?: boolean;
  previousScore?: string;
}

let dniCounter = 20_000_000;

/** Crea un postulante con sus postulaciones directamente en la base. */
export async function createApplicant(
  cycleId: number,
  seed: ApplicantSeed = {},
  applications: ApplicationSeed[] = [],
) {
  dniCounter += 1;
  return prisma.applicant.create({
    data: {
      cycleId,
      dni: seed.dni ?? String(dniCounter),
      lastName: seed.lastName ?? 'Perez',
      firstName: seed.firstName ?? 'Ana',
      email: seed.email ?? `docente${dniCounter}@ejemplo.com`,
      phone: seed.phone ?? '11 5555 0000',
      employmentStatus: seed.employmentStatus ?? 'PROVISIONAL',
      seniorityMonths: seed.seniorityMonths ?? 12,
      schoolSeniorityMonths:
        seed.schoolSeniorityMonths !== undefined
          ? seed.schoolSeniorityMonths
          : seed.employmentStatus === 'EXTERNO'
            ? null
            : (seed.seniorityMonths ?? 12),
      shifts: seed.shifts ?? ['MANANA'],
      deactivated: seed.deactivated ?? false,
      applications: {
        create: applications.map((application) => ({
          positionId: application.positionId,
          score: application.score,
          verified: application.verified ?? false,
          verifiedAt: application.verified ? new Date() : null,
          modified: application.modified ?? false,
          previousScore: application.previousScore ?? null,
        })),
      },
    },
  });
}
