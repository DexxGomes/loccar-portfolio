// ============================================================================
//  Regras de negócio e validação dos leads (funil de possíveis clientes).
//  As rotas chamam este serviço; o serviço valida (Zod) e usa o repositório.
// ============================================================================
import { z } from 'zod';
import { HttpError } from '../utils/httpError.js';
import * as repo from '../repositories/leadRepository.js';

export const LEAD_STATUS = ['novo', 'qualificado', 'negociacao', 'ganho', 'perdido'];

// Um campo de texto opcional que trata "" como ausente (planilhas trazem vazios).
const textoOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const leadCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório'),
  phone: textoOpcional,
  email: z.string().trim().email('E-mail inválido').optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  source: textoOpcional,
  status: z.enum(LEAD_STATUS).default('novo'),
  estimated_value: z.coerce
    .number()
    .nonnegative('Valor não pode ser negativo')
    .optional(),
  notes: textoOpcional,
});

const leadUpdateSchema = leadCreateSchema.partial();

/** Lista todos os leads do tenant. */
export async function list(tenant) {
  return repo.listLeads(tenant.id);
}

/** Cria um lead. */
export async function create(tenant, body) {
  const data = leadCreateSchema.parse(body);
  return repo.createLead(tenant.id, data);
}

/** Atualiza (parcialmente) um lead; lança 404 se não existir. */
export async function update(tenant, id, body) {
  const data = leadUpdateSchema.parse(body);
  const updated = await repo.updateLead(tenant.id, id, data);
  if (!updated) throw new HttpError(404, 'Lead não encontrado.');
  return updated;
}

/** Remove um lead; lança 404 se não existir. */
export async function remove(tenant, id) {
  const ok = await repo.deleteLead(tenant.id, id);
  if (!ok) throw new HttpError(404, 'Lead não encontrado.');
}

// Schema da importação: uma lista de leads já mapeados pelo painel.
const importSchema = z.object({
  leads: z.array(leadCreateSchema).min(1, 'Nenhum lead válido para importar').max(2000, 'Máximo de 2000 leads por importação'),
});

/**
 * Importa vários leads de uma planilha (já mapeados em objetos pelo painel).
 * Retorna quantos foram inseridos.
 */
export async function importMany(tenant, body) {
  const { leads } = importSchema.parse(body);
  const inseridos = await repo.bulkCreate(tenant.id, leads);
  return { inseridos };
}
