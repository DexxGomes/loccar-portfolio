// ============================================================================
//  Rotas REST do funil de leads (painel do dono).
//  Base: /api/leads  (o middleware authenticate já preencheu req.tenant)
// ============================================================================
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as leadService from '../services/leadService.js';

export const leadsRouter = Router();

// GET /api/leads  -> todos os leads do tenant (o painel monta o kanban)
leadsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const leads = await leadService.list(req.tenant);
    res.json(leads);
  })
);

// POST /api/leads  -> cria um lead
leadsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const lead = await leadService.create(req.tenant, req.body);
    res.status(201).json(lead);
  })
);

// POST /api/leads/import  -> importa vários leads (planilha)
leadsRouter.post(
  '/import',
  asyncHandler(async (req, res) => {
    const resultado = await leadService.importMany(req.tenant, req.body);
    res.status(201).json(resultado);
  })
);

// PATCH /api/leads/:id  -> atualização parcial (inclui mudar de coluna/status)
leadsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const lead = await leadService.update(req.tenant, req.params.id, req.body);
    res.json(lead);
  })
);

// DELETE /api/leads/:id  -> remove um lead
leadsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await leadService.remove(req.tenant, req.params.id);
    res.status(204).send();
  })
);
