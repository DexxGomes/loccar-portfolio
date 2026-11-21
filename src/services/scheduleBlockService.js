// ============================================================================
//  Regras dos bloqueios de agenda (manutenção e afins).
//
//  A garantia de "não pode sobrepor" vive no banco. O papel deste serviço é
//  validar a entrada e TRADUZIR o erro do banco em uma resposta que o dono
//  entenda — sem isso, a trigger de manutenção viraria um 500 genérico.
// ============================================================================
import { z } from 'zod';
import { HttpError } from '../utils/httpError.js';
import * as repo from '../repositories/scheduleBlockRepository.js';
import { getVehicleById } from '../repositories/vehicleRepository.js';

const criarSchema = z
  .object({
    vehicleId: z.string().uuid('Veículo inválido.'),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    reason: z.string().trim().max(240).optional(),
  })
  .refine((d) => new Date(d.endAt) > new Date(d.startAt), {
    message: 'O fim do bloqueio precisa ser depois do início.',
    path: ['endAt'],
  });

/**
 * Converte erros do PostgreSQL em mensagens de negócio.
 *  - 23P01: dois bloqueios do mesmo veículo se sobrepondo (EXCLUDE constraint);
 *  - P0001: a trigger que impede bloqueio em cima de reserva ativa. A mensagem
 *    da trigger já é escrita para humanos, então repassamos.
 */
function traduzirErro(err) {
  if (err.code === '23P01')
    return new HttpError(409, 'Já existe um bloqueio deste veículo nesse período.');
  if (err.code === 'P0001')
    return new HttpError(409, err.message || 'Conflito de agenda para este veículo.');
  return err;
}

/** Lista bloqueios da janela pedida. */
export async function list(tenant, filtros = {}) {
  return repo.listBlocks(tenant.id, filtros);
}

/** Cria um bloqueio, garantindo que o veículo é da locadora. */
export async function create(tenant, body, usuarioId = null) {
  const dados = criarSchema.parse(body);

  const veiculo = await getVehicleById(tenant.id, dados.vehicleId);
  if (!veiculo) throw new HttpError(404, 'Veículo não encontrado.');

  try {
    return await repo.createBlock(tenant.id, { ...dados, createdBy: usuarioId });
  } catch (err) {
    throw traduzirErro(err);
  }
}

/** Remove um bloqueio. */
export async function remove(tenant, id) {
  const ok = await repo.deleteBlock(tenant.id, id);
  if (!ok) throw new HttpError(404, 'Bloqueio não encontrado.');
}
