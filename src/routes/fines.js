// ============================================================================
//  Rotas REST das multas / infrações.
//  Base: /api/fines
// ============================================================================
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as fineService from '../services/fineService.js';

export const finesRouter = Router();

// GET /api/fines?status=pendente
finesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await fineService.list(req.tenant, { status: req.query.status }));
  })
);

// POST /api/fines
finesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const fine = await fineService.create(req.tenant, req.body);
    res.status(201).json(fine);
  })
);

// PATCH /api/fines/:id
finesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const fine = await fineService.update(req.tenant, req.params.id, req.body);
    res.json(fine);
  })
);

// DELETE /api/fines/:id
finesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await fineService.remove(req.tenant, req.params.id);
    res.status(204).send();
  })
);
