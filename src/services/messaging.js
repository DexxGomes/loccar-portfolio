// ============================================================================
//  Helper para ENVIAR uma mensagem de texto ao cliente E registrar no histórico
//  da conversa, em uma só chamada. Reutilizado por vários serviços.
// ============================================================================
import { sendTextMessage } from './whatsapp.js';
import { findOrCreateConversation, saveMessage } from '../repositories/conversationRepository.js';

/**
 * Envia texto ao cliente e salva a mensagem (outbound) na conversa.
 */
export async function sendAndLog(tenant, phone, text) {
  await sendTextMessage(tenant, phone, text);
  const conversation = await findOrCreateConversation(tenant.id, phone);
  await saveMessage({
    tenantId: tenant.id,
    conversationId: conversation.id,
    direction: 'outbound',
    type: 'text',
    content: text,
  });
}
