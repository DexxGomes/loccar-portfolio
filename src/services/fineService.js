// ============================================================================
//  Regras e validação das multas / infrações.
// ============================================================================
import { z } from 'zod';
import { HttpError } from '../utils/httpError.js';
import * as repo from '../repositories/fineRepository.js';

export const FINE_STATUS = ['pendente', 'repassada', 'paga'];

const semVazio = (v) => (v === '' || v == null ? undefined : v);
const uuidOpt = z.preprocess(semVazio, z.string().uuid('ID inválido').optional());
const dataOpt = z.preprocess(semVazio, z.string().optional());

const createSchema = z.object({
  vehicle_id: uuidOpt,
  customer_id: uuidOpt,
  description: z.string().trim().min(1, 'Descreva a multa'),
  amount: z.coerce.number().nonnegative('Valor não pode ser negativo').default(0),
  date: dataOpt,
  status: z.enum(FINE_STATUS).default('pendente'),
  notes: z.string().trim().optional(),
});
const updateSchema = createSchema.partial();

export async function list(tenant, filters = {}) {
  const status = filters.status ? z.enum(FINE_STATUS).parse(filters.status) : undefined;
  return repo.listFines(tenant.id, { status });
}

export async function create(tenant, body) {
  const data = createSchema.parse(body);
  return repo.createFine(tenant.id, data);
}

export async function update(tenant, id, body) {
  const data = updateSchema.parse(body);
  const updated = await repo.updateFine(tenant.id, id, data);
  if (!updated) throw new HttpError(404, 'Multa não encontrada.');
  return updated;
}

export async function remove(tenant, id) {
  const ok = await repo.deleteFine(tenant.id, id);
  if (!ok) throw new HttpError(404, 'Multa não encontrada.');
}
