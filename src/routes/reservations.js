// ============================================================================
//  Rotas REST das reservas (painel do dono).
//  Base: /api/reservations  (req.tenant já resolvido pelo resolveTenant)
// ============================================================================
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as reservationService from '../services/reservationService.js';
import { assessReservation } from '../services/riskService.js';
import { getContract, recordAcceptance } from '../services/contractService.js';
import { listForReservation } from '../services/documentService.js';

export const reservationsRouter = Router();

// GET /api/reservations/available?pickupAt=&returnAt=&category=
// (declarado antes de "/:id" para não conflitar)
reservationsRouter.get(
  '/available',
  asyncHandler(async (req, res) => {
    const { pickupAt, returnAt, category } = req.query;
    const vehicles = await reservationService.listAvailable(req.tenant, {
      pickupAt,
      returnAt,
      category,
    });
    res.json(vehicles);
  })
);

// GET /api/reservations?status=&from=&to=&vehicleId=  -> agenda
reservationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, from, to, vehicleId } = req.query;
    const reservas = await reservationService.list(req.tenant, { status, from, to, vehicleId });
    res.json(reservas);
  })
);

// GET /api/reservations/:id  -> detalhe (com veículo e cliente)
reservationsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const reserva = await reservationService.getDetailed(req.tenant, req.params.id);
    res.json(reserva);
  })
);

// GET /api/reservations/:id/documents  -> documentos com URLs assinadas
reservationsRouter.get(
  '/:id/documents',
  asyncHandler(async (req, res) => {
    const docs = await listForReservation(req.tenant, req.params.id);
    res.json(docs);
  })
);

// GET /api/reservations/:id/risco  -> análise de risco objetiva (para a Análise)
reservationsRouter.get(
  '/:id/risco',
  asyncHandler(async (req, res) => {
    const risco = await assessReservation(req.tenant, req.params.id);
    res.json(risco);
  })
);

// GET /api/reservations/:id/contrato  -> dados do contrato de locação
reservationsRouter.get(
  '/:id/contrato',
  asyncHandler(async (req, res) => {
    const contrato = await getContract(req.tenant, req.params.id);
    res.json(contrato);
  })
);

// POST /api/reservations/:id/contrato/aceite  -> registra o aceite do cliente
reservationsRouter.post(
  '/:id/contrato/aceite',
  asyncHandler(async (req, res) => {
    const resultado = await recordAcceptance(req.tenant, req.params.id);
    res.json(resultado);
  })
);

// POST /api/reservations  -> criação manual (dono), gera uma pré-reserva
reservationsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { vehicleId, customerId, pickupAt, returnAt } = req.body;
    const reserva = await reservationService.createPreReservation(req.tenant, {
      vehicleId,
      customerId,
      pickupAt,
      returnAt,
    });
    res.status(201).json(reserva);
  })
);

// PATCH /api/reservations/:id/reschedule  -> remarcar (dono)
reservationsRouter.patch(
  '/:id/reschedule',
  asyncHandler(async (req, res) => {
    const { pickupAt, returnAt } = req.body;
    const reserva = await reservationService.reschedule(
      req.tenant,
      req.params.id,
      { pickupAt, returnAt },
      { byOwner: true }
    );
    res.json(reserva);
  })
);

// Ações de status (dono)
reservationsRouter.post(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const reserva = await reservationService.approve(req.tenant, req.params.id);
    res.json(reserva);
  })
);

reservationsRouter.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const { internalReason, bloquearCliente } = req.body;
    const reserva = await reservationService.reject(req.tenant, req.params.id, {
      internalReason,
      bloquearCliente: bloquearCliente === true,
      createdBy: req.user?.id ?? null,
    });
    res.json(reserva);
  })
);

reservationsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const reserva = await reservationService.cancel(req.tenant, req.params.id, { byOwner: true });
    res.json(reserva);
  })
);

reservationsRouter.post(
  '/:id/pickup',
  asyncHandler(async (req, res) => {
    const reserva = await reservationService.registerPickup(req.tenant, req.params.id);
    res.json(reserva);
  })
);

reservationsRouter.post(
  '/:id/return',
  asyncHandler(async (req, res) => {
    const reserva = await reservationService.registerReturn(req.tenant, req.params.id);
    res.json(reserva);
  })
);
