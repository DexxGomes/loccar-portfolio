// ============================================================================
//  Rotas dos bloqueios de agenda (manutenção).
//  Base: /api/schedule-blocks
// ============================================================================
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as service from '../services/scheduleBlockService.js';

export const scheduleBlocksRouter = Router();

// GET /api/schedule-blocks?from=&to=&vehicleId=
scheduleBlocksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { from, to, vehicleId } = req.query;
    res.json(await service.list(req.tenant, { from, to, vehicleId }));
  })
);

// POST /api/schedule-blocks
scheduleBlocksRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const bloqueio = await service.create(req.tenant, req.body, req.user?.id ?? null);
    res.status(201).json(bloqueio);
  })
);

// DELETE /api/schedule-blocks/:id
scheduleBlocksRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await service.remove(req.tenant, req.params.id);
    res.status(204).send();
  })
);
