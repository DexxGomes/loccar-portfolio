// ============================================================================
//  Rota da linha do tempo da frota.
//  Base: /api/timeline
//
//  GET /api/timeline?from=ISO&to=ISO
//    Devolve, em UMA resposta, tudo que a tela do Gantt precisa desenhar:
//    os veículos (as linhas), as reservas e os bloqueios da janela (as barras).
//    Sem isso a tela faria três chamadas e piscaria em ordens diferentes.
// ============================================================================
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listVehicles } from '../repositories/vehicleRepository.js';
import { listReservations } from '../repositories/reservationRepository.js';
import { listBlocks } from '../repositories/scheduleBlockRepository.js';

export const timelineRouter = Router();

const DIA_MS = 24 * 60 * 60 * 1000;

const filtros = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

timelineRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { from, to } = filtros.parse({
      from: req.query.from || undefined,
      to: req.query.to || undefined,
    });

    // Janela padrão: de agora até 14 dias à frente.
    const inicio = from ? new Date(from) : new Date();
    const fim = to ? new Date(to) : new Date(inicio.getTime() + 14 * DIA_MS);

    const [veiculos, reservas, bloqueios] = await Promise.all([
      listVehicles(req.tenant.id),
      listReservations(req.tenant.id, { from: inicio.toISOString(), to: fim.toISOString() }),
      listBlocks(req.tenant.id, { from: inicio.toISOString(), to: fim.toISOString() }),
    ]);

    res.json({
      periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
      veiculos,
      reservas,
      bloqueios,
    });
  })
);
