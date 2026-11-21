// ============================================================================
//  Regras de negócio das reservas.
//  Usado tanto pelas rotas do painel quanto pelas "ferramentas" da IA (2d).
//
//  Princípios:
//    - A IA nunca confirma: cria sempre PRÉ-RESERVA (status pre_reserva).
//    - A não sobreposição é garantida pelo banco (constraint/triggers); aqui
//      apenas traduzimos a violação em um erro amigável (409).
//    - Aprovar/recusar é SEMPRE do dono.
// ============================================================================
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { calcDays, calcTotal } from '../utils/dates.js';
import * as repo from '../repositories/reservationRepository.js';
import { getVehicleById } from '../repositories/vehicleRepository.js';
import { findCustomerById } from '../repositories/customerRepository.js';
import { addToBlocklist } from '../repositories/blocklistRepository.js';
import { sendAndLog } from './messaging.js';
import * as reminderService from './reminderService.js';

// Mensagem genérica ao cliente em caso de recusa (NUNCA expõe o motivo interno).
const MSG_RECUSA = 'Infelizmente não conseguimos confirmar sua reserva desta vez.';

// Traduz violações do banco (sobreposição/manutenção) em erro amigável.
function traduzirConflito(err) {
  // 23P01 = exclusion_violation; P0001 = RAISE EXCEPTION dos triggers de manutenção.
  if (err.code === '23P01' || err.code === 'P0001') {
    return new HttpError(409, 'Veículo indisponível para o período selecionado.');
  }
  return err;
}

/** Valida que o período faz sentido. */
function validarPeriodo(pickupAt, returnAt) {
  const inicio = new Date(pickupAt);
  const fim = new Date(returnAt);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
    throw new HttpError(400, 'Datas de retirada/devolução inválidas.');
  }
  if (fim <= inicio) {
    throw new HttpError(400, 'A devolução deve ser depois da retirada.');
  }
}

/** Lista veículos disponíveis no período (para mostrar opções ao cliente). */
export async function listAvailable(tenant, { pickupAt, returnAt, category }) {
  validarPeriodo(pickupAt, returnAt);
  const vehicles = await repo.listAvailableVehicles(tenant.id, pickupAt, returnAt, category ?? null);
  const days = calcDays(pickupAt, returnAt);
  // Enriqueca cada veículo com a cotação para aquele período.
  return vehicles.map((v) => ({
    ...v,
    days,
    total_estimado: calcTotal(days, v.daily_rate),
  }));
}

/**
 * Cria uma PRÉ-RESERVA. A disponibilidade é garantida pelo banco no INSERT.
 * @returns a reserva criada
 */
export async function createPreReservation(tenant, { vehicleId, customerId, pickupAt, returnAt }) {
  validarPeriodo(pickupAt, returnAt);

  const vehicle = await getVehicleById(tenant.id, vehicleId);
  if (!vehicle) throw new HttpError(404, 'Veículo não encontrado.');
  if (vehicle.status === 'manutencao') {
    throw new HttpError(409, 'Este veículo está em manutenção.');
  }

  const days = calcDays(pickupAt, returnAt);
  const total = calcTotal(days, vehicle.daily_rate);
  const expiresAt = new Date(Date.now() + env.PRE_RESERVATION_EXPIRY_HOURS * 3600 * 1000);

  try {
    return await repo.createReservation(tenant.id, {
      vehicle_id: vehicleId,
      customer_id: customerId,
      pickup_at: pickupAt,
      return_at: returnAt,
      daily_rate_snapshot: vehicle.daily_rate,
      deposit_snapshot: vehicle.deposit_amount,
      days_count: days,
      total_amount: total,
      status: 'pre_reserva',
      expires_at: expiresAt,
    });
  } catch (err) {
    throw traduzirConflito(err);
  }
}

/** Busca uma reserva (com dados de veículo/cliente) ou lança 404. */
export async function getDetailed(tenant, id) {
  const r = await repo.getReservationDetailed(tenant.id, id);
  if (!r) throw new HttpError(404, 'Reserva não encontrada.');
  return r;
}

/** Lista reservas (agenda), com filtros. */
export async function list(tenant, filtros) {
  return repo.listReservations(tenant.id, filtros);
}

/** Garante que a reserva existe e retorna. */
async function pegarOuFalhar(tenant, id) {
  const r = await repo.getReservationById(tenant.id, id);
  if (!r) throw new HttpError(404, 'Reserva não encontrada.');
  return r;
}

/** Garante que o status atual está entre os permitidos para a ação. */
function exigirStatus(reserva, permitidos, acao) {
  if (!permitidos.includes(reserva.status)) {
    throw new HttpError(
      409,
      `Não é possível ${acao} uma reserva no status "${reserva.status}".`
    );
  }
}

/**
 * Remarca (altera período). Cliente só pode remarcar enquanto é pré-reserva;
 * o dono pode remarcar em qualquer status ativo.
 */
export async function reschedule(tenant, id, { pickupAt, returnAt }, { byOwner = false } = {}) {
  validarPeriodo(pickupAt, returnAt);
  const reserva = await pegarOuFalhar(tenant, id);

  const permitidos = byOwner
    ? ['pre_reserva', 'aguardando_documentos', 'em_analise', 'confirmada']
    : ['pre_reserva', 'aguardando_documentos', 'em_analise'];
  exigirStatus(reserva, permitidos, 'remarcar');

  const vehicle = await getVehicleById(tenant.id, reserva.vehicle_id);
  const days = calcDays(pickupAt, returnAt);
  const total = calcTotal(days, vehicle.daily_rate);

  try {
    return await repo.updateReservationPeriod(tenant.id, id, {
      pickup_at: pickupAt,
      return_at: returnAt,
      days_count: days,
      total_amount: total,
    });
  } catch (err) {
    throw traduzirConflito(err);
  }
}

/**
 * Cancela a reserva. Cliente só cancela enquanto é pré-reserva; o dono pode
 * cancelar também uma reserva confirmada.
 */
export async function cancel(tenant, id, { byOwner = false } = {}) {
  const reserva = await pegarOuFalhar(tenant, id);
  const permitidos = byOwner
    ? ['pre_reserva', 'aguardando_documentos', 'em_analise', 'confirmada']
    : ['pre_reserva', 'aguardando_documentos', 'em_analise'];
  exigirStatus(reserva, permitidos, 'cancelar');
  const cancelada = await repo.updateReservationStatus(tenant.id, id, 'cancelada');
  // Cancela lembretes pendentes desta reserva.
  await reminderService
    .cancelForReservation(tenant, id)
    .catch((e) => console.warn('Falha ao cancelar lembretes:', e.message));
  return cancelada;
}

/**
 * APROVA a reserva (ação do dono). Passa para "confirmada".
 * O agendamento dos lembretes é feito na etapa 2f (ver reminderService).
 */
export async function approve(tenant, id) {
  const reserva = await pegarOuFalhar(tenant, id);
  exigirStatus(reserva, ['pre_reserva', 'aguardando_documentos', 'em_analise'], 'aprovar');

  const atualizada = await repo.updateReservationStatus(tenant.id, id, 'confirmada');

  // Agenda os lembretes de retirada e devolução (24h antes de cada).
  await reminderService
    .scheduleForReservation(tenant, atualizada)
    .catch((e) => console.warn('Falha ao agendar lembretes:', e.message));

  // Avisa o cliente que está confirmada.
  const customer = await findCustomerById(tenant.id, reserva.customer_id);
  if (customer?.phone) {
    await sendAndLog(
      tenant,
      customer.phone,
      'Boa notícia! Sua reserva foi confirmada. Em breve enviaremos os lembretes de retirada e devolução. 🚗'
    ).catch((e) => console.warn('Falha ao avisar confirmação:', e.message));
  }
  return atualizada;
}

/**
 * RECUSA a reserva (ação do dono). Registra o motivo INTERNO, coloca o cliente
 * na blocklist e envia ao cliente apenas a mensagem genérica.
 */
/**
 * Recusa a pré-reserva.
 *
 * `bloquearCliente` é uma ESCOLHA do dono, não um efeito colateral: recusar
 * por documento ilegível ou porque o carro quebrou não deveria queimar o
 * cliente para sempre. Antes, toda recusa bloqueava — o que era injusto em
 * boa parte dos casos.
 */
export async function reject(
  tenant,
  id,
  { internalReason, createdBy = null, bloquearCliente = false } = {}
) {
  const reserva = await pegarOuFalhar(tenant, id);
  exigirStatus(reserva, ['pre_reserva', 'aguardando_documentos', 'em_analise'], 'recusar');

  const atualizada = await repo.updateReservationStatus(tenant.id, id, 'recusada', {
    internal_rejection_reason: internalReason ?? null,
  });

  const customer = await findCustomerById(tenant.id, reserva.customer_id);

  if (customer) {
    // Só entra na blocklist se o dono pediu.
    if (bloquearCliente) {
      await addToBlocklist(tenant.id, {
        cpf: customer.cpf,
        phone: customer.phone,
        reason: internalReason ?? 'Reserva recusada',
        createdBy,
      }).catch((e) => console.warn('Falha ao adicionar à blocklist:', e.message));
    }

    // Mensagem genérica (nunca o motivo interno).
    if (customer.phone) {
      await sendAndLog(tenant, customer.phone, MSG_RECUSA).catch((e) =>
        console.warn('Falha ao enviar recusa:', e.message)
      );
    }
  }
  return atualizada;
}

/**
 * Move a pré-reserva ativa do cliente para "aguardando_documentos"
 * (chamado quando o cliente dá o consentimento LGPD).
 */
export async function markAwaitingDocuments(tenant, customerId) {
  const reserva = await repo.findActiveReservationForCustomer(tenant.id, customerId, ['pre_reserva']);
  if (!reserva) return null;
  return repo.updateReservationStatus(tenant.id, reserva.id, 'aguardando_documentos');
}

/** Registra a retirada do veículo (confirmada -> em_andamento). */
export async function registerPickup(tenant, id) {
  const reserva = await pegarOuFalhar(tenant, id);
  exigirStatus(reserva, ['confirmada'], 'registrar retirada de');
  return repo.updateReservationStatus(tenant.id, id, 'em_andamento');
}

/** Registra a devolução (em_andamento -> finalizada). */
export async function registerReturn(tenant, id) {
  const reserva = await pegarOuFalhar(tenant, id);
  exigirStatus(reserva, ['em_andamento'], 'registrar devolução de');
  // Sinaliza atraso se devolvido após o previsto (sem cobrança automática no MVP).
  const atrasada = new Date() > new Date(reserva.return_at);
  return repo.updateReservationStatus(tenant.id, id, 'finalizada', {
    late_return_flag: atrasada,
  });
}
