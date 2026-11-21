// ============================================================================
//  Acesso a dados da tabela "fines" (multas / infrações).
// ============================================================================
import { query } from '../config/db.js';

const CAMPOS_EDITAVEIS = [
  'vehicle_id',
  'customer_id',
  'description',
  'amount',
  'date',
  'status',
  'notes',
];

/** Lista as multas do tenant, com nome do veículo e do cliente. */
export async function listFines(tenantId, { status } = {}) {
  const params = [tenantId];
  let filtro = '';
  if (status) {
    params.push(status);
    filtro = ` AND f.status = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT f.*,
            v.model AS vehicle_model, v.plate AS vehicle_plate,
            c.name AS customer_name, c.phone AS customer_phone
       FROM fines f
       LEFT JOIN vehicles v  ON v.id = f.vehicle_id
       LEFT JOIN customers c ON c.id = f.customer_id
      WHERE f.tenant_id = $1${filtro}
      ORDER BY f.date DESC NULLS LAST, f.created_at DESC`,
    params
  );
  return rows;
}

/** Cria uma multa. */
export async function createFine(tenantId, data) {
  const { rows } = await query(
    `INSERT INTO fines (tenant_id, vehicle_id, customer_id, description, amount, date, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      tenantId,
      data.vehicle_id ?? null,
      data.customer_id ?? null,
      data.description,
      data.amount ?? 0,
      data.date ?? null,
      data.status ?? 'pendente',
      data.notes ?? null,
    ]
  );
  return rows[0];
}

/** Atualização parcial. */
export async function updateFine(tenantId, id, data) {
  const sets = [];
  const params = [tenantId, id];
  for (const campo of CAMPOS_EDITAVEIS) {
    if (data[campo] !== undefined) {
      params.push(data[campo]);
      sets.push(`${campo} = $${params.length}`);
    }
  }
  if (sets.length === 0) {
    const { rows } = await query('SELECT * FROM fines WHERE tenant_id = $1 AND id = $2', [tenantId, id]);
    return rows[0] || null;
  }
  const { rows } = await query(
    `UPDATE fines SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    params
  );
  return rows[0] || null;
}

/** Remove uma multa. */
export async function deleteFine(tenantId, id) {
  const { rowCount } = await query('DELETE FROM fines WHERE tenant_id = $1 AND id = $2', [tenantId, id]);
  return rowCount > 0;
}
