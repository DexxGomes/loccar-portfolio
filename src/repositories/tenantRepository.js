// ============================================================================
//  Acesso a dados da tabela "tenants".
// ============================================================================
import { query } from '../config/db.js';

/** Busca um tenant pelo id. Retorna null se não existir. */
export async function findTenantById(id) {
  const { rows } = await query('SELECT * FROM tenants WHERE id = $1', [id]);
  return rows[0] || null;
}

/** Busca um tenant pelo phone_number_id (usado pelo webhook do WhatsApp). */
export async function findTenantByPhoneNumberId(phoneNumberId) {
  const { rows } = await query(
    'SELECT * FROM tenants WHERE phone_number_id = $1',
    [phoneNumberId]
  );
  return rows[0] || null;
}

// Campos de configuração que o dono pode editar pelo painel.
const CAMPOS_CONFIG = [
  'name',
  'legal_name',
  'cnpj',
  'address',
  'contract_terms',
  'owner_alert_phone',
  'timezone',
  'shared_number',
];

/** Atualiza (parcialmente) as configurações da locadora. */
export async function updateTenant(id, data) {
  const sets = [];
  const params = [id];
  for (const campo of CAMPOS_CONFIG) {
    if (data[campo] !== undefined) {
      params.push(data[campo]);
      sets.push(`${campo} = $${params.length}`);
    }
  }
  if (sets.length === 0) return findTenantById(id);

  const { rows } = await query(
    `UPDATE tenants SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return rows[0] || null;
}
