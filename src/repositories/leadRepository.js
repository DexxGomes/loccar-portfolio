// ============================================================================
//  Acesso a dados da tabela "leads" (funil de possíveis clientes).
//  TODAS as funções recebem tenantId e filtram por ele (isolamento multi-tenant).
// ============================================================================
import { query, withTransaction } from '../config/db.js';

// Colunas que o cliente pode enviar (evita injeção de nomes de coluna).
const CAMPOS_EDITAVEIS = [
  'name',
  'phone',
  'email',
  'source',
  'status',
  'estimated_value',
  'notes',
  'sort_order',
];

/** Lista todos os leads do tenant (mais recentes primeiro dentro de cada coluna). */
export async function listLeads(tenantId) {
  const { rows } = await query(
    `SELECT * FROM leads
      WHERE tenant_id = $1
      ORDER BY status, sort_order ASC, created_at DESC`,
    [tenantId]
  );
  return rows;
}

/** Busca um lead por id (dentro do tenant). Retorna null se não existir. */
export async function getLeadById(tenantId, id) {
  const { rows } = await query(
    'SELECT * FROM leads WHERE tenant_id = $1 AND id = $2',
    [tenantId, id]
  );
  return rows[0] || null;
}

/** Cria um lead. Espera os dados já validados pelo serviço. */
export async function createLead(tenantId, data) {
  const { rows } = await query(
    `INSERT INTO leads
       (tenant_id, name, phone, email, source, status, estimated_value, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      tenantId,
      data.name,
      data.phone ?? null,
      data.email ?? null,
      data.source ?? null,
      data.status ?? 'novo',
      data.estimated_value ?? null,
      data.notes ?? null,
    ]
  );
  return rows[0];
}

/** Atualização parcial: só grava os campos presentes em "data". */
export async function updateLead(tenantId, id, data) {
  const sets = [];
  const params = [tenantId, id];

  for (const campo of CAMPOS_EDITAVEIS) {
    if (data[campo] !== undefined) {
      params.push(data[campo]);
      sets.push(`${campo} = $${params.length}`);
    }
  }

  if (sets.length === 0) {
    return getLeadById(tenantId, id);
  }

  // Carimba a data de toda mexida no lead. É o que permite o painel dizer
  // "parado há 12 dias": sem isto, updated_at ficava na data de criação para
  // sempre e o funil não tinha como mostrar o que esfriou.
  sets.push('updated_at = now()');

  const { rows } = await query(
    `UPDATE leads SET ${sets.join(', ')}
      WHERE tenant_id = $1 AND id = $2
      RETURNING *`,
    params
  );
  return rows[0] || null;
}

/** Remove um lead. Retorna true se algo foi removido. */
export async function deleteLead(tenantId, id) {
  const { rowCount } = await query(
    'DELETE FROM leads WHERE tenant_id = $1 AND id = $2',
    [tenantId, id]
  );
  return rowCount > 0;
}

/**
 * Cria vários leads de uma vez (importação de planilha), numa transação.
 * Retorna a quantidade inserida.
 */
export async function bulkCreate(tenantId, leads) {
  if (!leads.length) return 0;
  return withTransaction(async (client) => {
    let inseridos = 0;
    for (const l of leads) {
      await client.query(
        `INSERT INTO leads
           (tenant_id, name, phone, email, source, status, estimated_value, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          tenantId,
          l.name,
          l.phone ?? null,
          l.email ?? null,
          l.source ?? null,
          l.status ?? 'novo',
          l.estimated_value ?? null,
          l.notes ?? null,
        ]
      );
      inseridos += 1;
    }
    return inseridos;
  });
}
