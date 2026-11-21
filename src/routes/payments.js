// ============================================================================
//  Rotas do financeiro (contas a receber).
//  Base: /api/payments
// ============================================================================
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as service from '../services/paymentService.js';

export const paymentsRouter = Router();

// GET /api/payments/resumo?from=&to=   (antes de "/:id" para não conflitar)
paymentsRouter.get(
  '/resumo',
  asyncHandler(async (req, res) => {
    res.json(await service.resumo(req.tenant, { from: req.query.from, to: req.query.to }));
  })
);

// GET /api/payments/integracao  -> o painel usa para mostrar (ou não) o PIX
paymentsRouter.get('/integracao', (req, res) => {
  res.json(service.statusIntegracao());
});

// GET /api/payments?status=&kind=&reservationId=&from=&to=
paymentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, kind, reservationId, from, to } = req.query;
    res.json(await service.list(req.tenant, { status, kind, reservationId, from, to }));
  })
);

// POST /api/payments
paymentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const criada = await service.create(req.tenant, req.body, req.user?.id ?? null);
    res.status(201).json(criada);
  })
);

// POST /api/payments/da-reserva/:reservationId  -> gera diárias + caução
paymentsRouter.post(
  '/da-reserva/:reservationId',
  asyncHandler(async (req, res) => {
    const criadas = await service.gerarDaReserva(
      req.tenant,
      req.params.reservationId,
      req.user?.id ?? null
    );
    res.status(201).json(criadas);
  })
);

// POST /api/payments/:id/pix  -> gera a cobrança no provedor e manda o link
paymentsRouter.post(
  '/:id/pix',
  asyncHandler(async (req, res) => {
    res.json(await service.gerarPix(req.tenant, req.params.id, req.body || {}));
  })
);

// PATCH /api/payments/:id
paymentsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await service.update(req.tenant, req.params.id, req.body));
  })
);

// DELETE /api/payments/:id
paymentsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await service.remove(req.tenant, req.params.id);
    res.status(204).send();
  })
);
