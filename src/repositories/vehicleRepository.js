// ============================================================================
//  Acesso a dados da tabela "vehicles".
//  TODAS as funções recebem tenantId e filtram por ele (isolamento multi-tenant).
// ============================================================================
import { query } from '../config/db.js';

// Colunas que o cliente pode enviar (evita injeção de nomes de coluna).
const CAMPOS_EDITAVEIS = [
  'model',
  'plate',
  'category',
  'daily_rate',
  'deposit_amount',
  'status',
  'year',
  'color',
  'notes',
  'odometer',
  'next_revision_km',
  'ipva_due',
  'licensing_due',
  'insurance_due',
];

/** Lista veículos do tenant, com filtro opcional por status. */
export async function listVehicles(tenantId, { status } = {}) {
  const params = [tenantId];
  let sql = 'SELECT * FROM vehicles WHERE tenant_id = $1';

  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }

  sql += ' ORDER BY created_at DESC';
  const { rows } = await query(sql, params);
  return rows;
}

/** Busca um veículo por id (dentro do tenant). Retorna null se não existir. */
export async function getVehicleById(tenantId, id) {
  const { rows } = await query(
    'SELECT * FROM vehicles WHERE tenant_id = $1 AND id = $2',
    [tenantId, id]
  );
  return rows[0] || null;
}

/** Cria um veículo. Espera os dados já validados pelo serviço. */
export async function createVehicle(tenantId, data) {
  const { rows } = await query(
    `INSERT INTO vehicles
       (tenant_id, model, plate, category, daily_rate, deposit_amount, status, year, color, notes,
        odometer, next_revision_km, ipva_due, licensing_due, insurance_due)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      tenantId,
      data.model,
      data.plate,
      data.category,
      data.daily_rate,
      data.deposit_amount,
      data.status,
      data.year ?? null,
      data.color ?? null,
      data.notes ?? null,
      data.odometer ?? null,
      data.next_revision_km ?? null,
      data.ipva_due ?? null,
      data.licensing_due ?? null,
      data.insurance_due ?? null,
    ]
  );
  return rows[0];
}

/** Atualização parcial: só grava os campos presentes em "data". */
export async function updateVehicle(tenantId, id, data) {
  const sets = [];
  const params = [tenantId, id];

  for (const campo of CAMPOS_EDITAVEIS) {
    if (data[campo] !== undefined) {
      params.push(data[campo]);
      sets.push(`${campo} = $${params.length}`);
    }
  }

  // Nada para atualizar: apenas devolve o registro atual.
  if (sets.length === 0) {
    return getVehicleById(tenantId, id);
  }

  const { rows } = await query(
    `UPDATE vehicles SET ${sets.join(', ')}
     WHERE tenant_id = $1 AND id = $2
     RETURNING *`,
    params
  );
  return rows[0] || null;
}

/** Remove um veículo. Retorna true se algo foi removido. */
export async function deleteVehicle(tenantId, id) {
  const { rowCount } = await query(
    'DELETE FROM vehicles WHERE tenant_id = $1 AND id = $2',
    [tenantId, id]
  );
  return rowCount > 0;
}
