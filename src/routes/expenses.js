// ============================================================================
//  Rotas REST das despesas.
//  Base: /api/expenses
// ============================================================================
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as expenseService from '../services/expenseService.js';

export const expensesRouter = Router();

// GET /api/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD
expensesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await expenseService.list(req.tenant, { from: req.query.from, to: req.query.to }));
  })
);

// POST /api/expenses
expensesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const expense = await expenseService.create(req.tenant, req.body);
    res.status(201).json(expense);
  })
);

// DELETE /api/expenses/:id
expensesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await expenseService.remove(req.tenant, req.params.id);
    res.status(204).send();
  })
);
