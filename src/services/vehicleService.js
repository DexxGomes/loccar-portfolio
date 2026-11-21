// ============================================================================
//  Regras de negócio e validação da frota de veículos.
//  As rotas chamam este serviço; o serviço valida (Zod) e usa o repositório.
// ============================================================================
import { z } from 'zod';
import { HttpError } from '../utils/httpError.js';
import * as repo from '../repositories/vehicleRepository.js';
import { CATEGORIAS } from '../utils/categorias.js';

// Status e categorias são conjuntos controlados (não aceitam texto livre).
const STATUS = ['disponivel', 'alugado', 'manutencao'];

// Campos opcionais que tratam "" (formulário) como ausente.
const dataOpcional = z.string().optional().transform((v) => (v && v.trim() ? v : undefined));
const intOpcional = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.coerce.number().int().nonnegative().optional()
);

// Schema de criação (todos os campos essenciais são obrigatórios).
// z.coerce aceita números vindos como string (ex: de formulários simples).
const vehicleCreateSchema = z.object({
  model: z.string().trim().min(1, 'Modelo é obrigatório'),
  plate: z.string().trim().min(1, 'Placa é obrigatória'),
  category: z.enum(CATEGORIAS, {
    errorMap: () => ({ message: `Categoria deve ser uma de: ${CATEGORIAS.join(', ')}` }),
  }),
  daily_rate: z.coerce.number().nonnegative('Diária não pode ser negativa'),
  deposit_amount: z.coerce.number().nonnegative('Caução não pode ser negativa').default(0),
  status: z.enum(STATUS).default('disponivel'),
  year: z.coerce.number().int().optional(),
  color: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  // Controle de frota (opcionais):
  odometer: intOpcional,
  next_revision_km: intOpcional,
  ipva_due: dataOpcional,
  licensing_due: dataOpcional,
  insurance_due: dataOpcional,
});

// Schema de atualização: todos opcionais (atualização parcial).
const vehicleUpdateSchema = vehicleCreateSchema.partial();

/** Lista veículos do tenant (com filtro opcional por status). */
export async function list(tenant, filters = {}) {
  // Valida o filtro de status, se enviado.
  const status = filters.status
    ? z.enum(STATUS).parse(filters.status)
    : undefined;
  return repo.listVehicles(tenant.id, { status });
}

/** Busca um veículo; lança 404 se não existir. */
export async function getOne(tenant, id) {
  const vehicle = await repo.getVehicleById(tenant.id, id);
  if (!vehicle) throw new HttpError(404, 'Veículo não encontrado.');
  return vehicle;
}

/** Cria um veículo a partir do corpo da requisição. */
export async function create(tenant, body) {
  const data = vehicleCreateSchema.parse(body);
  return repo.createVehicle(tenant.id, data);
}

/** Atualiza (parcialmente) um veículo; lança 404 se não existir. */
export async function update(tenant, id, body) {
  const data = vehicleUpdateSchema.parse(body);
  const updated = await repo.updateVehicle(tenant.id, id, data);
  if (!updated) throw new HttpError(404, 'Veículo não encontrado.');
  return updated;
}

/** Remove um veículo; lança 404 se não existir. */
export async function remove(tenant, id) {
  const ok = await repo.deleteVehicle(tenant.id, id);
  if (!ok) throw new HttpError(404, 'Veículo não encontrado.');
}
