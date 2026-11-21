// ============================================================================
//  Acesso a dados da tabela "maintenance_records" (histórico de manutenções).
// ============================================================================
import { query } from '../config/db.js';

/** Lista as manutenções de um veículo (mais recentes primeiro). */
export async function listByVehicle(tenantId, vehicleId) {
  const { rows } = await query(
    `SELECT * FROM maintenance_records
      WHERE tenant_id = $1 AND vehicle_id = $2
      ORDER BY date DESC, created_at DESC`,
    [tenantId, vehicleId]
  );
  return rows;
}

/** Cria um registro de manutenção. */
export async function createRecord(tenantId, vehicleId, data) {
  const { rows } = await query(
    `INSERT INTO maintenance_records
       (tenant_id, vehicle_id, date, type, odometer, cost, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      tenantId,
      vehicleId,
      data.date,
      data.type,
      data.odometer ?? null,
      data.cost ?? null,
      data.notes ?? null,
    ]
  );
  return rows[0];
}

/** Remove um registro de manutenção. Retorna true se algo foi removido. */
export async function deleteRecord(tenantId, id) {
  const { rowCount } = await query(
    'DELETE FROM maintenance_records WHERE tenant_id = $1 AND id = $2',
    [tenantId, id]
  );
  return rowCount > 0;
}
