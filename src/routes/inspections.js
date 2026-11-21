// ============================================================================
//  Rotas da vistoria digital.
//  Base: /api/inspections
//
//  As fotos sobem UMA POR REQUISIÇÃO (base64), para o envio do celular não
//  estourar o limite do corpo e para a tela mostrar progresso foto a foto.
// ============================================================================
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as service from '../services/inspectionService.js';

export const inspectionsRouter = Router();

// GET /api/inspections?reservationId=...  -> retirada, devolução e comparativo
inspectionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { reservationId } = req.query;
    if (!reservationId) return res.status(400).json({ error: 'Informe a reserva.' });
    res.json(await service.listForReservation(req.tenant, reservationId));
  })
);

// GET /api/inspections/ultimo-odometro/:vehicleId -> sugestão de km inicial
inspectionsRouter.get(
  '/ultimo-odometro/:vehicleId',
  asyncHandler(async (req, res) => {
    res.json(await service.ultimoOdometro(req.tenant, req.params.vehicleId));
  })
);

// POST /api/inspections
inspectionsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const vistoria = await service.create(req.tenant, req.body, req.user?.id ?? null);
    res.status(201).json(vistoria);
  })
);

// POST /api/inspections/:id/photos
inspectionsRouter.post(
  '/:id/photos',
  asyncHandler(async (req, res) => {
    const foto = await service.addPhoto(req.tenant, req.params.id, req.body);
    res.status(201).json({ id: foto.id, position: foto.position });
  })
);

// DELETE /api/inspections/:id
inspectionsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await service.remove(req.tenant, req.params.id);
    res.status(204).send();
  })
);
