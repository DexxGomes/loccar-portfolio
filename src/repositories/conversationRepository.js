// ============================================================================
//  Acesso a dados das tabelas "conversations" e "messages".
// ============================================================================
import { query } from '../config/db.js';

/** Garante uma conversa para o telefone; cria se não existir. */
export async function findOrCreateConversation(tenantId, phone, customerId = null) {
  const found = await query(
    'SELECT * FROM conversations WHERE tenant_id = $1 AND phone = $2',
    [tenantId, phone]
  );
  if (found.rows[0]) {
    // Vincula o customer_id se ainda não estava vinculado.
    if (customerId && !found.rows[0].customer_id) {
      const upd = await query(
        'UPDATE conversations SET customer_id = $3 WHERE tenant_id = $1 AND id = $2 RETURNING *',
        [tenantId, found.rows[0].id, customerId]
      );
      return upd.rows[0];
    }
    return found.rows[0];
  }

  const { rows } = await query(
    `INSERT INTO conversations (tenant_id, phone, customer_id, last_message_at)
     VALUES ($1, $2, $3, now()) RETURNING *`,
    [tenantId, phone, customerId]
  );
  return rows[0];
}

/** Marca/atualiza a flag "precisa de humano" e (des)ativa a resposta da IA. */
export async function setNeedsHuman(tenantId, conversationId, needsHuman, reason = null) {
  const { rows } = await query(
    `UPDATE conversations
       SET needs_human = $3, needs_human_reason = $4
     WHERE tenant_id = $1 AND id = $2
     RETURNING *`,
    [tenantId, conversationId, needsHuman, reason]
  );
  return rows[0] || null;
}

/**
 * Apaga a conversa inteira (mensagens vão junto por cascata).
 *
 * Usado quando o dono diz "isto não é cliente, é pessoal": não basta parar de
 * responder, o que já foi dito também não pode continuar guardado.
 */
export async function deleteConversation(tenantId, conversationId) {
  const { rowCount } = await query(
    'DELETE FROM conversations WHERE tenant_id = $1 AND id = $2',
    [tenantId, conversationId]
  );
  return rowCount > 0;
}

/** Lista conversas do tenant (opcionalmente só as que precisam de humano). */
export async function listConversations(tenantId, { needsHuman = false } = {}) {
  const params = [tenantId];
  let sql = `
    SELECT conv.*, c.name AS customer_name
      FROM conversations conv
      LEFT JOIN customers c ON c.id = conv.customer_id
     WHERE conv.tenant_id = $1`;
  if (needsHuman) sql += ' AND conv.needs_human = TRUE';
  sql += ' ORDER BY conv.last_message_at DESC NULLS LAST';
  const { rows } = await query(sql, params);
  return rows;
}

/** Busca uma conversa por id. */
export async function getConversationById(tenantId, id) {
  const { rows } = await query(
    'SELECT * FROM conversations WHERE tenant_id = $1 AND id = $2',
    [tenantId, id]
  );
  return rows[0] || null;
}

/** Atualiza o horário da última mensagem. */
export async function touchConversation(conversationId) {
  await query('UPDATE conversations SET last_message_at = now() WHERE id = $1', [
    conversationId,
  ]);
}

/**
 * Lista as últimas mensagens de uma conversa (ordem cronológica).
 *
 * O `tenantId` é opcional só por compatibilidade, mas PASSE SEMPRE: sem ele,
 * a segurança fica dependendo de quem chama ter conferido o dono da conversa
 * antes. Com ele, uma locadora não lê a conversa de outra nem por engano.
 */
export async function getRecentMessages(conversationId, limit = 20, tenantId = null) {
  const { rows } = await query(
    `SELECT * FROM (
       SELECT * FROM messages
       WHERE conversation_id = $1
         AND ($3::uuid IS NULL OR tenant_id = $3)
       ORDER BY created_at DESC
       LIMIT $2
     ) sub ORDER BY created_at ASC`,
    [conversationId, limit, tenantId]
  );
  return rows;
}

/**
 * Salva uma mensagem. Usa ON CONFLICT no whatsapp_message_id para idempotência:
 * se a Meta reenviar o mesmo evento, não duplica.
 * @returns a mensagem salva, ou null se era duplicada.
 */
export async function saveMessage({
  tenantId,
  conversationId,
  direction,
  type = 'text',
  content = null,
  whatsappMessageId = null,
  mediaStoragePath = null,
  mediaMimeType = null,
  mediaDocumentId = null,
}) {
  const { rows } = await query(
    `INSERT INTO messages
       (tenant_id, conversation_id, direction, type, content,
        whatsapp_message_id, media_storage_path, media_mime_type, media_document_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL DO NOTHING
     RETURNING *`,
    [
      tenantId,
      conversationId,
      direction,
      type,
      content,
      whatsappMessageId,
      mediaStoragePath,
      mediaMimeType,
      mediaDocumentId,
    ]
  );
  return rows[0] || null;
}
