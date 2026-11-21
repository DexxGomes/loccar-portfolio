// ============================================================================
//  Acesso a dados da tabela "reservations".
//
//  A regra de não sobreposição é garantida pelo BANCO (EXCLUSION CONSTRAINT +
//  triggers de manutenção). As consultas de disponibilidade aqui servem para
//  MOSTRAR opções ao cliente; a garantia final acontece no INSERT.
// ============================================================================
import { query } from '../config/db.js';

// Status que "ocupam" a agenda do veículo.
export const STATUS_ATIVOS = [
  'pre_reserva',
  'aguardando_documentos',
  'em_analise',
  'confirmada',
  'em_andamento',
];

/** Cria uma reserva. Espera dados já validados/calculados pelo serviço. */
export async function createReservation(tenantId, data) {
  const { rows } = await query(
    `INSERT INTO reservations
       (tenant_id, vehicle_id, customer_id, pickup_at, return_at,
        daily_rate_snapshot, deposit_snapshot, days_count, total_amount,
        status, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      tenantId,
      data.vehicle_id,
      data.customer_id,
      data.pickup_at,
      data.return_at,
      data.daily_rate_snapshot,
      data.deposit_snapshot,
      data.days_count,
      data.total_amount,
      data.status ?? 'pre_reserva',
      data.expires_at ?? null,
    ]
  );
  return rows[0];
}

/** Busca uma reserva por id (dentro do tenant). */
export async function getReservationById(tenantId, id) {
  const { rows } = await query(
    'SELECT * FROM reservations WHERE tenant_id = $1 AND id = $2',
    [tenantId, id]
  );
  return rows[0] || null;
}

/**
 * Busca uma reserva com dados do veículo e do cliente juntos (para o painel).
 */
export async function getReservationDetailed(tenantId, id) {
  const { rows } = await query(
    `SELECT r.*,
            v.model AS vehicle_model, v.plate AS vehicle_plate, v.category AS vehicle_category,
            c.name AS customer_name, c.phone AS customer_phone, c.cpf AS customer_cpf,
            c.cnh_number AS customer_cnh, c.cnh_valid_until AS customer_cnh_valid_until,
            c.lgpd_consent_at AS customer_lgpd_consent_at,
            c.zip_code AS customer_zip_code, c.street AS customer_street,
            c.street_number AS customer_street_number, c.complement AS customer_complement,
            c.district AS customer_district, c.city AS customer_city, c.state AS customer_state
       FROM reservations r
       JOIN vehicles v ON v.id = r.vehicle_id
       JOIN customers c ON c.id = r.customer_id
      WHERE r.tenant_id = $1 AND r.id = $2`,
    [tenantId, id]
  );
  return rows[0] || null;
}

/**
 * Lista reservas do tenant, com filtros opcionais.
 * @param {object} filtros
 * @param {string} [filtros.status]
 * @param {string} [filtros.from]  ISO — início da janela (para o calendário)
 * @param {string} [filtros.to]    ISO — fim da janela
 * @param {string} [filtros.vehicleId]
 */
export async function listReservations(tenantId, filtros = {}) {
  const params = [tenantId];
  let sql = `
    SELECT r.*,
           v.model AS vehicle_model, v.plate AS vehicle_plate,
           c.name AS customer_name, c.phone AS customer_phone
      FROM reservations r
      JOIN vehicles v ON v.id = r.vehicle_id
      JOIN customers c ON c.id = r.customer_id
     WHERE r.tenant_id = $1`;

  if (filtros.status) {
    params.push(filtros.status);
    sql += ` AND r.status = $${params.length}`;
  }
  if (filtros.vehicleId) {
    params.push(filtros.vehicleId);
    sql += ` AND r.vehicle_id = $${params.length}`;
  }
  // Janela de datas: reservas cujo período intersecta [from, to]
  if (filtros.from && filtros.to) {
    params.push(filtros.from, filtros.to);
    sql += ` AND tstzrange(r.pickup_at, r.return_at) && tstzrange($${params.length - 1}, $${params.length})`;
  }

  sql += ' ORDER BY r.pickup_at ASC';
  const { rows } = await query(sql, params);
  return rows;
}

/** Atualiza o status (e campos correlatos) de uma reserva. */
export async function updateReservationStatus(tenantId, id, status, extra = {}) {
  const sets = ['status = $3'];
  const params = [tenantId, id, status];

  if (extra.internal_rejection_reason !== undefined) {
    params.push(extra.internal_rejection_reason);
    sets.push(`internal_rejection_reason = $${params.length}`);
  }
  if (extra.expires_at !== undefined) {
    params.push(extra.expires_at);
    sets.push(`expires_at = $${params.length}`);
  }
  if (extra.late_return_flag !== undefined) {
    params.push(extra.late_return_flag);
    sets.push(`late_return_flag = $${params.length}`);
  }

  const { rows } = await query(
    `UPDATE reservations SET ${sets.join(', ')}
      WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    params
  );
  return rows[0] || null;
}

/** Atualiza o período e os valores recalculados (remarcação). */
export async function updateReservationPeriod(tenantId, id, { pickup_at, return_at, days_count, total_amount }) {
  const { rows } = await query(
    `UPDATE reservations
        SET pickup_at = $3, return_at = $4, days_count = $5, total_amount = $6
      WHERE tenant_id = $1 AND id = $2
      RETURNING *`,
    [tenantId, id, pickup_at, return_at, days_count, total_amount]
  );
  return rows[0] || null;
}

/**
 * Lista veículos DISPONÍVEIS em um período (sem reserva ativa nem manutenção).
 */
export async function listAvailableVehicles(tenantId, pickupAt, returnAt, category = null) {
  const { rows } = await query(
    `SELECT v.* FROM vehicles v
      WHERE v.tenant_id = $1
        AND v.status = 'disponivel'
        AND ($4::text IS NULL OR v.category = $4)
        AND NOT EXISTS (
          SELECT 1 FROM reservations r
           WHERE r.vehicle_id = v.id
             AND r.status = ANY($5)
             AND tstzrange(r.pickup_at, r.return_at) && tstzrange($2, $3)
        )
        AND NOT EXISTS (
          SELECT 1 FROM schedule_blocks sb
           WHERE sb.vehicle_id = v.id
             AND tstzrange(sb.start_at, sb.end_at) && tstzrange($2, $3)
        )
      ORDER BY v.daily_rate ASC`,
    [tenantId, pickupAt, returnAt, category, STATUS_ATIVOS]
  );
  return rows;
}

/**
 * Verifica se um veículo específico está livre no período.
 * @param {string} [excludeReservationId]  ignora esta reserva (útil na remarcação)
 */
export async function isVehicleAvailable(tenantId, vehicleId, pickupAt, returnAt, excludeReservationId = null) {
  const { rows } = await query(
    `SELECT
       NOT EXISTS (
         SELECT 1 FROM reservations r
          WHERE r.vehicle_id = $2
            AND r.tenant_id = $1
            AND r.status = ANY($5)
            AND ($6::uuid IS NULL OR r.id <> $6)
            AND tstzrange(r.pickup_at, r.return_at) && tstzrange($3, $4)
       )
       AND NOT EXISTS (
         SELECT 1 FROM schedule_blocks sb
          WHERE sb.vehicle_id = $2
            AND tstzrange(sb.start_at, sb.end_at) && tstzrange($3, $4)
       ) AS available`,
    [tenantId, vehicleId, pickupAt, returnAt, STATUS_ATIVOS, excludeReservationId]
  );
  return rows[0]?.available === true;
}

/**
 * Encontra a reserva ativa mais recente de um cliente em certos status.
 * Usado no fluxo de documentos e pela IA.
 */
export async function findActiveReservationForCustomer(tenantId, customerId, statuses = STATUS_ATIVOS) {
  const { rows } = await query(
    `SELECT * FROM reservations
      WHERE tenant_id = $1 AND customer_id = $2 AND status = ANY($3)
      ORDER BY created_at DESC
      LIMIT 1`,
    [tenantId, customerId, statuses]
  );
  return rows[0] || null;
}

/** Lista as reservas de um cliente (mais recentes primeiro). */
export async function listByCustomer(tenantId, customerId, limit = 10) {
  const { rows } = await query(
    `SELECT r.*, v.model AS vehicle_model, v.plate AS vehicle_plate
       FROM reservations r
       JOIN vehicles v ON v.id = r.vehicle_id
      WHERE r.tenant_id = $1 AND r.customer_id = $2
      ORDER BY r.created_at DESC
      LIMIT $3`,
    [tenantId, customerId, limit]
  );
  return rows;
}

/**
 * Marca como "expirada" as pré-reservas sem documentos vencidas.
 * Usado pelo job de expiração (etapa 2f). Retorna as reservas expiradas.
 */
export async function expireOverduePreReservations() {
  const { rows } = await query(
    `UPDATE reservations
        SET status = 'expirada'
      WHERE status IN ('pre_reserva', 'aguardando_documentos')
        AND expires_at IS NOT NULL
        AND expires_at < now()
      RETURNING *`
  );
  return rows;
}
