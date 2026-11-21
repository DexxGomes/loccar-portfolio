// ============================================================================
//  Acesso a dados da tabela "expenses" (despesas).
// ============================================================================
import { query } from '../config/db.js';

/** Lista despesas do tenant, com filtro opcional por período [from, to]. */
export async function listExpenses(tenantId, { from, to } = {}) {
  const params = [tenantId];
  let filtro = '';
  if (from && to) {
    params.push(from, to);
    filtro = ` AND e.date >= $${params.length - 1} AND e.date <= $${params.length}`;
  }
  const { rows } = await query(
    `SELECT e.*, v.model AS vehicle_model, v.plate AS vehicle_plate
       FROM expenses e
       LEFT JOIN vehicles v ON v.id = e.vehicle_id
      WHERE e.tenant_id = $1${filtro}
      ORDER BY e.date DESC, e.created_at DESC
      LIMIT 500`,
    params
  );
  return rows;
}

/** Cria uma despesa. */
export async function createExpense(tenantId, data) {
  const { rows } = await query(
    `INSERT INTO expenses (tenant_id, vehicle_id, category, description, amount, date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      tenantId,
      data.vehicle_id ?? null,
      data.category,
      data.description ?? null,
      data.amount ?? 0,
      data.date,
      data.notes ?? null,
    ]
  );
  return rows[0];
}

/** Remove uma despesa. */
export async function deleteExpense(tenantId, id) {
  const { rowCount } = await query('DELETE FROM expenses WHERE tenant_id = $1 AND id = $2', [tenantId, id]);
  return rowCount > 0;
}
