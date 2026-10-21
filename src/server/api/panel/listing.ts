import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { isRegistrationOpen } from '../../domain/registration-window';
import { sendValidationError, sendNotFound } from './http';
import { queryListing, type ListingRow } from './listing-query';

// GET /api/panel/listing: el listado de un puesto, ordenado según el decreto.

const SHIFTS = ['MANANA', 'TARDE', 'VESPERTINO'] as const;

const querySchema = z.object({
  positionId: z
    .string()
    .regex(/^\d{1,9}$/, 'El puesto no es válido.')
    .transform(Number)
    .optional(),
  shift: z.enum(SHIFTS, { error: 'El turno no es válido.' }).optional(),
  onlyVerified: z
    .enum(['true', 'false'], { error: 'Tiene que ser true o false.' })
    .transform((value) => value === 'true')
    .optional(),
});

function toGroups(rows: ListingRow[]) {
  return [1, 2, 3].map((group) => ({
    group,
    rows: rows
      .filter((row) => row.group === group)
      .map(({ group: _group, ...row }) => row),
  }));
}

export function createListingRouter(options: { now: () => Date }): Router {
  const router = Router();

  router.get('/listing', async (req, res) => {
    const query = querySchema.safeParse(req.query);
    if (!query.success) {
      sendValidationError(res, query.error);
      return;
    }
    const { positionId, shift, onlyVerified } = query.data;

    // Sin `positionId` se usa el primer puesto activo, por nombre. Se puede pedir uno inactivo.
    const position =
      positionId === undefined
        ? await prisma.position.findFirst({ where: { active: true }, orderBy: { name: 'asc' } })
        : await prisma.position.findUnique({ where: { id: positionId } });
    if (positionId !== undefined && !position) {
      sendNotFound(res, 'No existe el puesto.');
      return;
    }

    const cycle = await prisma.cycle.findFirst({ where: { active: true } });
    const rows =
      cycle && position
        ? await queryListing(prisma, {
            positionId: position.id,
            cycleId: cycle.id,
            shift: shift ?? null,
            onlyVerified: onlyVerified ?? false,
          })
        : [];

    res.json({
      cycle: cycle
        ? { id: cycle.id, year: cycle.year, open: isRegistrationOpen(cycle, options.now()) }
        : null,
      position: position ? { id: position.id, name: position.name, type: position.type } : null,
      summary: {
        total: rows.length,
        verified: rows.filter((row) => row.status === 'VERIFIED').length,
        modified: rows.filter((row) => row.status === 'MODIFIED').length,
      },
      groups: toGroups(rows),
    });
  });

  return router;
}
