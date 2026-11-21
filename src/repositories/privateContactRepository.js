// ============================================================================
//  Contatos particulares — os números que o sistema NUNCA atende nem grava.
//
//  Existe para a locadora que usa o mesmo WhatsApp da vida pessoal. A família
//  entra aqui uma vez e some do sistema para sempre.
// ============================================================================
import { query } from '../config/db.js';

/** Só dígitos, como a Meta manda (E.164 sem "+"). */
export function normalizarTelefone(phone) {
  return String(phone ?? '').replace(/\D/g, '');
}

/**
 * Este número é particular?
 *
 * É a primeira pergunta do webhook, antes de gravar qualquer coisa — por isso
 * é uma consulta só, direta no índice.
 */
export async function isPrivateContact(tenantId, phone) {
  const { rows } = await query(
    'SELECT 1 FROM private_contacts WHERE tenant_id = $1 AND phone = $2 LIMIT 1',
    [tenantId, normalizarTelefone(phone)]
  );
  return rows.length > 0;
}

export async function listPrivateContacts(tenantId) {
  const { rows } = await query(
    'SELECT * FROM private_contacts WHERE tenant_id = $1 ORDER BY created_at DESC',
    [tenantId]
  );
  return rows;
}

export async function addPrivateContact(tenantId, { phone, label }) {
  const { rows } = await query(
    `INSERT INTO private_contacts (tenant_id, phone, label)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [tenantId, normalizarTelefone(phone), label?.trim() || null]
  );
  return rows[0];
}

export async function removePrivateContact(tenantId, id) {
  const { rowCount } = await query(
    'DELETE FROM private_contacts WHERE tenant_id = $1 AND id = $2',
    [tenantId, id]
  );
  return rowCount > 0;
}

/**
 * Marca que a IA passou a atender esta conversa.
 *
 * Depois disso a triagem não roda mais aqui: cliente responde "ok", "pode ser",
 * "amanhã às 9" — nada disso tem palavra de locação, e calar no meio de um
 * atendimento seria pior do que nunca ter atendido.
 */
export async function marcarIaEngajada(conversationId) {
  await query('UPDATE conversations SET ai_engaged = TRUE WHERE id = $1', [conversationId]);
}
