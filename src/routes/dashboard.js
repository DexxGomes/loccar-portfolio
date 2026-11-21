// ============================================================================
//  Rota dos indicadores do painel.
//  Base: /api/dashboard
//
//  GET /api/dashboard?from=ISO&to=ISO
//    Sem parâmetros, devolve os últimos 30 dias.
// ============================================================================
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getDashboard, getHoje, getDinheiro } from '../services/dashboardService.js';
import { getPrimeirosPassos } from '../services/onboardingService.js';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const dados = await getDashboard(req.tenant, {
      from: req.query.from,
      to: req.query.to,
    });
    res.json(dados);
  })
);

// GET /api/dashboard/dinheiro -> retrato do dinheiro (entrou, gastos, saldo,
// a receber, vencido, caução e multas) em uma resposta só.
dashboardRouter.get(
  '/dinheiro',
  asyncHandler(async (req, res) => {
    const dados = await getDinheiro(req.tenant, { from: req.query.from, to: req.query.to });
    res.json(dados);
  })
);

// GET /api/dashboard/primeiros-passos -> o que já está configurado e o que falta
dashboardRouter.get(
  '/primeiros-passos',
  asyncHandler(async (req, res) => {
    res.json(await getPrimeirosPassos(req.tenant));
  })
);

// GET /api/dashboard/hoje -> retiradas e devoluções do dia (sino de lembretes)
dashboardRouter.get(
  '/hoje',
  asyncHandler(async (req, res) => {
    const dados = await getHoje(req.tenant);
    res.json(dados);
  })
);
