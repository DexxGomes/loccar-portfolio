// ============================================================================
//  Regras e validação das despesas.
// ============================================================================
import { z } from 'zod';
import { HttpError } from '../utils/httpError.js';
import * as repo from '../repositories/expenseRepository.js';

const semVazio = (v) => (v === '' || v == null ? undefined : v);

const createSchema = z.object({
  vehicle_id: z.preprocess(semVazio, z.string().uuid('ID inválido').optional()),
  category: z.string().trim().min(1, 'Informe a categoria'),
  description: z.string().trim().optional(),
  amount: z.coerce.number().nonnegative('Valor não pode ser negativo').default(0),
  date: z.string().min(1, 'Informe a data'),
  notes: z.string().trim().optional(),
});

export async function list(tenant, { from, to } = {}) {
  return repo.listExpenses(tenant.id, { from, to });
}

export async function create(tenant, body) {
  const data = createSchema.parse(body);
  return repo.createExpense(tenant.id, data);
}

export async function remove(tenant, id) {
  const ok = await repo.deleteExpense(tenant.id, id);
  if (!ok) throw new HttpError(404, 'Despesa não encontrada.');
}
