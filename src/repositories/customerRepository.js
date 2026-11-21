// ============================================================================
//  Acesso a dados da tabela "customers" (locatários).
// ============================================================================
import { query } from '../config/db.js';

/** Busca um cliente pelo telefone (dentro do tenant). */
export async function findCustomerByPhone(tenantId, phone) {
  const { rows } = await query(
    'SELECT * FROM customers WHERE tenant_id = $1 AND phone = $2',
    [tenantId, phone]
  );
  return rows[0] || null;
}

/**
 * Lista clientes do tenant (com busca opcional por nome, telefone ou CPF).
 * Traz um resumo: total de reservas e data da última.
 */
export async function listCustomers(tenantId, { search } = {}) {
  const params = [tenantId];
  let filtroBusca = '';
  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    filtroBusca = ` AND (c.name ILIKE $2 OR c.phone ILIKE $2 OR c.cpf ILIKE $2)`;
  }
  const { rows } = await query(
    `SELECT c.*,
            (SELECT COUNT(*) FROM reservations r WHERE r.customer_id = c.id)::int AS total_reservas,
            (SELECT COUNT(*) FROM reservations r WHERE r.customer_id = c.id AND r.status = 'finalizada')::int AS finalizadas,
            (SELECT MAX(r.created_at) FROM reservations r WHERE r.customer_id = c.id) AS ultima_atividade
       FROM customers c
      WHERE c.tenant_id = $1${filtroBusca}
      ORDER BY ultima_atividade DESC NULLS LAST, c.created_at DESC
      LIMIT 300`,
    params
  );
  return rows;
}

/** Busca um cliente por id (dentro do tenant). */
export async function findCustomerById(tenantId, id) {
  const { rows } = await query(
    'SELECT * FROM customers WHERE tenant_id = $1 AND id = $2',
    [tenantId, id]
  );
  return rows[0] || null;
}

/**
 * Garante que existe um cliente para o telefone; cria se necessário.
 * @param {string} [name]  nome do perfil do WhatsApp (opcional)
 */
export async function findOrCreateCustomer(tenantId, phone, name) {
  const existing = await findCustomerByPhone(tenantId, phone);
  if (existing) {
    // Preenche o nome se ainda não tínhamos e agora chegou pelo perfil.
    if (!existing.name && name) {
      const { rows } = await query(
        'UPDATE customers SET name = $3 WHERE tenant_id = $1 AND id = $2 RETURNING *',
        [tenantId, existing.id, name]
      );
      return rows[0];
    }
    return existing;
  }

  const { rows } = await query(
    'INSERT INTO customers (tenant_id, phone, name) VALUES ($1, $2, $3) RETURNING *',
    [tenantId, phone, name ?? null]
  );
  return rows[0];
}

/** Atualiza campos do cliente (CPF, CNH, endereço, consentimento, etc.). */
export async function updateCustomer(tenantId, id, fields) {
  const permitidos = [
    'name',
    'cpf',
    'cnh_number',
    'cnh_valid_until',
    'lgpd_consent_at',
    // Endereço de residência — vai no contrato de locação.
    'zip_code',
    'street',
    'street_number',
    'complement',
    'district',
    'city',
    'state',
  ];
  const sets = [];
  const params = [tenantId, id];

  for (const campo of permitidos) {
    if (fields[campo] !== undefined) {
      params.push(fields[campo]);
      sets.push(`${campo} = $${params.length}`);
    }
  }
  if (sets.length === 0) return findCustomerById(tenantId, id);

  const { rows } = await query(
    `UPDATE customers SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    params
  );
  return rows[0] || null;
}

/** Registra o consentimento LGPD (data/hora = agora). */
export async function registerLgpdConsent(tenantId, id) {
  const { rows } = await query(
    `UPDATE customers SET lgpd_consent_at = now()
     WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    [tenantId, id]
  );
  return rows[0] || null;
}
