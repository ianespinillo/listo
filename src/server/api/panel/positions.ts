import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { normalizeText } from '../../domain/normalize';
import { Prisma } from '../../generated/prisma/client';
import { sendError } from '../errors';
import { parseBody, parseId, sendNotFound } from './http';

// Puestos (reglas §6): nombre único sin distinguir mayúsculas; los puestos no se borran, se desactivan.

const DUPLICATE_POSITION_MESSAGE = 'Ya existe un puesto con ese nombre.';
const POSITION_NOT_FOUND = 'No existe el puesto.';

const nameSchema = z
  .string({ error: 'Ingresá el nombre del puesto.' })
  .transform(normalizeText)
  .pipe(
    z
      .string()
      .min(1, 'Ingresá el nombre del puesto.')
      .max(80, 'El nombre puede tener hasta 80 caracteres.'),
  );
const typeSchema = z.enum(['ASIGNATURA', 'CARGO'], { error: 'Elegí si es una asignatura o un cargo.' });

const createSchema = z.object({ name: nameSchema, type: typeSchema });
const updateSchema = z
  .object({
    name: nameSchema.optional(),
    type: typeSchema.optional(),
    active: z.boolean({ error: 'Tiene que ser true o false.' }).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Indicá qué querés cambiar.',
  });

type Db = typeof prisma | Prisma.TransactionClient;

/** Postulantes (no dados de baja) del ciclo activo que se postularon a cada puesto. */
async function activeCycleApplicants(db: Db, positionId?: number): Promise<Map<number, number>> {
  const groups = await db.application.groupBy({
    by: ['positionId'],
    where: {
      ...(positionId === undefined ? {} : { positionId }),
      applicant: { deactivated: false, cycle: { active: true } },
    },
    _count: { _all: true },
  });
  return new Map(groups.map((group) => [group.positionId, group._count._all]));
}

function toItem(
  position: { id: number; name: string; type: string; active: boolean },
  counts: Map<number, number>,
) {
  return {
    id: position.id,
    name: position.name,
    type: position.type,
    active: position.active,
    activeCycleApplicants: counts.get(position.id) ?? 0,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function createPositionsRouter(): Router {
  const router = Router();

  router.get('/positions', async (_req, res) => {
    const [positions, counts] = await Promise.all([
      prisma.position.findMany({ orderBy: { name: 'asc' } }),
      activeCycleApplicants(prisma),
    ]);
    res.json(positions.map((position) => toItem(position, counts)));
  });

  router.post('/positions', async (req, res) => {
    const body = parseBody(createSchema, req, res);
    if (!body) return;
    try {
      const position = await prisma.$transaction(async (tx) => {
        const duplicate = await tx.position.findFirst({
          where: { name: { equals: body.name, mode: 'insensitive' } },
          select: { id: true },
        });
        if (duplicate) return null;
        return tx.position.create({ data: { name: body.name, type: body.type } });
      });
      if (!position) {
        sendError(res, 409, 'DUPLICATE_POSITION', DUPLICATE_POSITION_MESSAGE);
        return;
      }
      res.status(201).json(toItem(position, new Map()));
    } catch (error) {
      // Dos altas simultáneas del mismo nombre: gana una y la otra choca con el único.
      if (!isUniqueViolation(error)) throw error;
      sendError(res, 409, 'DUPLICATE_POSITION', DUPLICATE_POSITION_MESSAGE);
    }
  });

  router.patch('/positions/:id', async (req, res) => {
    const id = parseId(req.params['id']);
    if (id === null) {
      sendNotFound(res, POSITION_NOT_FOUND);
      return;
    }
    const body = parseBody(updateSchema, req, res);
    if (!body) return;

    try {
      const outcome = await prisma.$transaction(async (tx) => {
        if (!(await tx.position.findUnique({ where: { id }, select: { id: true } }))) {
          return 'not-found' as const;
        }
        if (body.name !== undefined) {
          const duplicate = await tx.position.findFirst({
            where: { id: { not: id }, name: { equals: body.name, mode: 'insensitive' } },
            select: { id: true },
          });
          if (duplicate) return 'duplicate' as const;
        }
        return tx.position.update({
          where: { id },
          data: { name: body.name, type: body.type, active: body.active },
        });
      });
      if (outcome === 'not-found') {
        sendNotFound(res, POSITION_NOT_FOUND);
        return;
      }
      if (outcome === 'duplicate') {
        sendError(res, 409, 'DUPLICATE_POSITION', DUPLICATE_POSITION_MESSAGE);
        return;
      }
      res.json(toItem(outcome, await activeCycleApplicants(prisma, id)));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      sendError(res, 409, 'DUPLICATE_POSITION', DUPLICATE_POSITION_MESSAGE);
    }
  });

  return router;
}
