// ============================================================================
//  Acesso a dados da tabela "blocklist" (bloqueio por CPF e/ou telefone).
// ============================================================================
import { query } from '../config/db.js';

/** Verifica se um telefone ou CPF está bloqueado no tenant. */
export async function isBlocked(tenantId, { phone = null, cpf = null }) {
  const { rows } = await query(
    `SELECT * FROM blocklist
     WHERE tenant_id = $1
       AND (
         ($2::text IS NOT NULL AND phone = $2) OR
         ($3::text IS NOT NULL AND cpf = $3)
       )
     LIMIT 1`,
    [tenantId, phone, cpf]
  );
  return rows[0] || null;
}

/** Adiciona um cliente à blocklist. */
export async function addToBlocklist(tenantId, { cpf = null, phone = null, reason = null, createdBy = null }) {
  const { rows } = await query(
    `INSERT INTO blocklist (tenant_id, cpf, phone, reason, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [tenantId, cpf, phone, reason, createdBy]
  );
  return rows[0];
}

/** Lista a blocklist do tenant. */
export async function listBlocklist(tenantId) {
  const { rows } = await query(
    'SELECT * FROM blocklist WHERE tenant_id = $1 ORDER BY created_at DESC',
    [tenantId]
  );
  return rows;
}

/** Remove uma entrada da blocklist. */
export async function removeFromBlocklist(tenantId, id) {
  const { rowCount } = await query(
    'DELETE FROM blocklist WHERE tenant_id = $1 AND id = $2',
    [tenantId, id]
  );
  return rowCount > 0;
}
