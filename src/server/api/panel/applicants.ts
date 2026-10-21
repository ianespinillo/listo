import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { canonicalScore } from '../../domain/normalize';
import type { Prisma } from '../../generated/prisma/client';
import { emailSchema } from '../registration-schema';
import { parseBody, parseId, sendNotFound } from './http';
import { applicationStatus, queryListing } from './listing-query';

// Detalle del postulante, edición de email, baja/reactivación y verificación (reglas §4).

type Db = typeof prisma | Prisma.TransactionClient;

const emailBodySchema = z.object({ email: emailSchema });
const verificationBodySchema = z.object({
  verified: z.boolean({ error: 'Tiene que ser true o false.' }),
});

const APPLICANT_NOT_FOUND = 'No existe el postulante.';
const APPLICATION_NOT_FOUND = 'El postulante no tiene esa postulación.';

type ApplicationWithPosition = Prisma.ApplicationGetPayload<{ include: { position: true } }>;

interface Placement {
  group: number | null;
  order: number | null;
}

/**
 * Grupo y número de orden de un postulante en un puesto: salen del mismo SQL del listado, sin
 * filtros. Son null si está dado de baja o si no es del ciclo activo (no figura en el listado).
 */
async function placementOf(
  db: Db,
  applicant: { id: number; cycleId: number; deactivated: boolean },
  cycleActive: boolean,
  positionId: number,
): Promise<Placement> {
  if (applicant.deactivated || !cycleActive) return { group: null, order: null };
  const rows = await queryListing(db, {
    positionId,
    cycleId: applicant.cycleId,
    shift: null,
    onlyVerified: false,
  });
  const row = rows.find((candidate) => candidate.applicantId === applicant.id);
  return row ? { group: row.group, order: row.order } : { group: null, order: null };
}

function toApplicationView(application: ApplicationWithPosition, placement: Placement) {
  return {
    position: {
      id: application.position.id,
      name: application.position.name,
      type: application.position.type,
      active: application.position.active,
    },
    score: canonicalScore(application.score),
    previousScore: application.previousScore ? canonicalScore(application.previousScore) : null,
    status: applicationStatus(application.verified, application.modified),
    group: placement.group,
    order: placement.order,
  };
}

async function loadApplicantView(db: Db, id: number) {
  const applicant = await db.applicant.findUnique({
    where: { id },
    include: {
      cycle: true,
      applications: { include: { position: true }, orderBy: { position: { name: 'asc' } } },
      events: { include: { position: true }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }] },
    },
  });
  if (!applicant) return null;

  const placements = await Promise.all(
    applicant.applications.map((application) =>
      placementOf(db, applicant, applicant.cycle.active, application.positionId),
    ),
  );

  return {
    id: applicant.id,
    dni: applicant.dni,
    lastName: applicant.lastName,
    firstName: applicant.firstName,
    email: applicant.email,
    phone: applicant.phone,
    employmentStatus: applicant.employmentStatus,
    seniorityMonths: applicant.seniorityMonths,
    shifts: applicant.shifts,
    deactivated: applicant.deactivated,
    cycle: { id: applicant.cycle.id, year: applicant.cycle.year },
    applications: applicant.applications.map((application, index) =>
      toApplicationView(application, placements[index]),
    ),
    history: applicant.events.map((event) => ({
      date: event.occurredAt.toISOString(),
      type: event.type,
      position: event.position?.name ?? null,
      detail: event.detail,
    })),
  };
}

async function loadApplicationView(db: Db, applicantId: number, positionId: number) {
  const application = await db.application.findUnique({
    where: { applicantId_positionId: { applicantId, positionId } },
    include: { position: true, applicant: { include: { cycle: true } } },
  });
  if (!application) return null;
  const placement = await placementOf(
    db,
    application.applicant,
    application.applicant.cycle.active,
    positionId,
  );
  return toApplicationView(application, placement);
}

export function createApplicantsRouter(): Router {
  const router = Router();

  router.get('/applicants/:id', async (req, res) => {
    const id = parseId(req.params['id']);
    const view = id === null ? null : await loadApplicantView(prisma, id);
    if (!view) {
      sendNotFound(res, APPLICANT_NOT_FOUND);
      return;
    }
    res.json(view);
  });

  router.patch('/applicants/:id', async (req, res) => {
    const id = parseId(req.params['id']);
    if (id === null) {
      sendNotFound(res, APPLICANT_NOT_FOUND);
      return;
    }
    const body = parseBody(emailBodySchema, req, res);
    if (!body) return;

    const found = await prisma.$transaction(async (tx) => {
      const applicant = await tx.applicant.findUnique({ where: { id }, select: { email: true } });
      if (!applicant) return false;
      // Si el email no cambia no hay nada que registrar. El detalle nunca guarda el email anterior.
      if (applicant.email !== body.email) {
        await tx.applicant.update({ where: { id }, data: { email: body.email } });
        await tx.historyEvent.create({ data: { applicantId: id, type: 'EMAIL_CHANGE' } });
      }
      return true;
    });
    if (!found) {
      sendNotFound(res, APPLICANT_NOT_FOUND);
      return;
    }
    res.json(await loadApplicantView(prisma, id));
  });

  // Baja y reactivación son idempotentes: si ya estaba en ese estado, 204 sin evento duplicado.
  function setDeactivated(deactivated: boolean): RequestHandler {
    return async (req, res) => {
      const id = parseId(req.params['id']);
      if (id === null) {
        sendNotFound(res, APPLICANT_NOT_FOUND);
        return;
      }
      const found = await prisma.$transaction(async (tx) => {
        if (!(await tx.applicant.findUnique({ where: { id }, select: { id: true } }))) return false;
        // El `where` con el estado previo evita eventos duplicados si dos pedidos se cruzan.
        const changed = await tx.applicant.updateMany({
          where: { id, deactivated: !deactivated },
          data: { deactivated },
        });
        if (changed.count > 0) {
          await tx.historyEvent.create({
            data: { applicantId: id, type: deactivated ? 'DEACTIVATION' : 'REACTIVATION' },
          });
        }
        return true;
      });
      if (!found) {
        sendNotFound(res, APPLICANT_NOT_FOUND);
        return;
      }
      res.status(204).end();
    };
  }
  router.post('/applicants/:id/deactivate', setDeactivated(true));
  router.post('/applicants/:id/reactivate', setDeactivated(false));

  router.put('/applicants/:id/applications/:positionId/verification', async (req, res) => {
    const applicantId = parseId(req.params['id']);
    const positionId = parseId(req.params['positionId']);
    if (applicantId === null || positionId === null) {
      sendNotFound(res, APPLICATION_NOT_FOUND);
      return;
    }
    const body = parseBody(verificationBodySchema, req, res);
    if (!body) return;

    const key = { applicantId, positionId };
    const found = await prisma.$transaction(async (tx) => {
      if (!(await tx.application.findUnique({ where: { applicantId_positionId: key } }))) return false;
      // Solo se cambia (y se registra el evento) si el estado cambia de verdad.
      const changed = body.verified
        ? await tx.application.updateMany({
            where: { ...key, verified: false },
            data: { verified: true, verifiedAt: new Date(), modified: false, previousScore: null },
          })
        : await tx.application.updateMany({
            where: { ...key, verified: true },
            data: { verified: false, verifiedAt: null },
          });
      if (changed.count > 0) {
        await tx.historyEvent.create({
          data: { applicantId, positionId, type: body.verified ? 'VERIFICATION' : 'UNVERIFICATION' },
        });
      }
      return true;
    });
    if (!found) {
      sendNotFound(res, APPLICATION_NOT_FOUND);
      return;
    }
    res.json(await loadApplicationView(prisma, applicantId, positionId));
  });

  return router;
}
