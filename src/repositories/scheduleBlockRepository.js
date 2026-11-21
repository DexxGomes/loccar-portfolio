// ============================================================================
//  Acesso a dados de "schedule_blocks" — períodos em que o veículo NÃO pode
//  ser alugado (manutenção, uso interno, funilaria…).
//
//  O banco já protege as duas pontas:
//   - dois bloqueios do mesmo veículo não podem se sobrepor (EXCLUDE);
//   - bloqueio não pode cair sobre reserva ativa, nem reserva sobre bloqueio
//     (triggers). Aqui só consultamos e gravamos.
// ============================================================================
import { query } from '../config/db.js';

/** Lista bloqueios que cruzam a janela [from, to]. */
export async function listBlocks(tenantId, { from, to, vehicleId } = {}) {
  const params = [tenantId];
  let sql = `
    SELECT sb.*, v.model AS vehicle_model, v.plate AS vehicle_plate
      FROM schedule_blocks sb
      JOIN vehicles v ON v.id = sb.vehicle_id
     WHERE sb.tenant_id = $1`;

  if (from && to) {
    params.push(from, to);
    sql += ` AND tstzrange(sb.start_at, sb.end_at) && tstzrange($${params.length - 1}, $${params.length})`;
  }
  if (vehicleId) {
    params.push(vehicleId);
    sql += ` AND sb.vehicle_id = $${params.length}`;
  }

  sql += ' ORDER BY sb.start_at ASC';
  const { rows } = await query(sql, params);
  return rows;
}

/** Busca um bloqueio por id (dentro do tenant). */
export async function getBlockById(tenantId, id) {
  const { rows } = await query(
    'SELECT * FROM schedule_blocks WHERE tenant_id = $1 AND id = $2',
    [tenantId, id]
  );
  return rows[0] || null;
}

/** Cria um bloqueio de agenda. */
export async function createBlock(tenantId, { vehicleId, startAt, endAt, reason, createdBy }) {
  const { rows } = await query(
    `INSERT INTO schedule_blocks (tenant_id, vehicle_id, start_at, end_at, reason, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [tenantId, vehicleId, startAt, endAt, reason ?? null, createdBy ?? null]
  );
  return rows[0];
}

/** Remove um bloqueio. Devolve true se algo foi removido. */
export async function deleteBlock(tenantId, id) {
  const { rowCount } = await query(
    'DELETE FROM schedule_blocks WHERE tenant_id = $1 AND id = $2',
    [tenantId, id]
  );
  return rowCount > 0;
}
