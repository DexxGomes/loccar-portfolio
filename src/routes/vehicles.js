// ============================================================================
//  Rotas REST da frota de veículos (CRUD).
//  Base: /api/vehicles  (o middleware resolveTenant já preencheu req.tenant)
// ============================================================================
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import * as vehicleService from '../services/vehicleService.js';
import * as maintenanceRepo from '../repositories/maintenanceRepository.js';

export const vehiclesRouter = Router();

// Validação de um registro de manutenção.
const semVazio = (v) => (v === '' || v == null ? undefined : v);
const recordSchema = z.object({
  date: z.string().min(1, 'Data é obrigatória'),
  type: z.string().trim().min(1, 'Descreva o serviço'),
  odometer: z.preprocess(semVazio, z.coerce.number().int().nonnegative().optional()),
  cost: z.preprocess(semVazio, z.coerce.number().nonnegative().optional()),
  notes: z.string().trim().optional(),
});

// GET /api/vehicles?status=disponivel  -> lista os veículos do tenant
vehiclesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const vehicles = await vehicleService.list(req.tenant, { status: req.query.status });
    res.json(vehicles);
  })
);

// GET /api/vehicles/:id  -> detalhe de um veículo
vehiclesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const vehicle = await vehicleService.getOne(req.tenant, req.params.id);
    res.json(vehicle);
  })
);

// POST /api/vehicles  -> cria um veículo
vehiclesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const vehicle = await vehicleService.create(req.tenant, req.body);
    res.status(201).json(vehicle);
  })
);

// PATCH /api/vehicles/:id  -> atualização parcial
vehiclesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const vehicle = await vehicleService.update(req.tenant, req.params.id, req.body);
    res.json(vehicle);
  })
);

// DELETE /api/vehicles/:id  -> remove um veículo
vehiclesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await vehicleService.remove(req.tenant, req.params.id);
    res.status(204).send();
  })
);

// ---- Manutenções do veículo ----

// GET /api/vehicles/:id/manutencoes  -> histórico de manutenções
vehiclesRouter.get(
  '/:id/manutencoes',
  asyncHandler(async (req, res) => {
    await vehicleService.getOne(req.tenant, req.params.id); // garante que é do tenant
    res.json(await maintenanceRepo.listByVehicle(req.tenant.id, req.params.id));
  })
);

// POST /api/vehicles/:id/manutencoes  -> registra uma manutenção
vehiclesRouter.post(
  '/:id/manutencoes',
  asyncHandler(async (req, res) => {
    await vehicleService.getOne(req.tenant, req.params.id);
    const data = recordSchema.parse(req.body);
    const rec = await maintenanceRepo.createRecord(req.tenant.id, req.params.id, data);
    res.status(201).json(rec);
  })
);

// DELETE /api/vehicles/:id/manutencoes/:recordId  -> remove uma manutenção
vehiclesRouter.delete(
  '/:id/manutencoes/:recordId',
  asyncHandler(async (req, res) => {
    const ok = await maintenanceRepo.deleteRecord(req.tenant.id, req.params.recordId);
    if (!ok) throw new HttpError(404, 'Manutenção não encontrada.');
    res.status(204).send();
  })
);
