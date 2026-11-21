// ============================================================================
//  Processamento das mensagens RECEBIDAS do WhatsApp (webhook POST).
//  Responsável por:
//    - achar o tenant pelo phone_number_id
//    - deduplicar eventos (a Meta pode reenviar)
//    - achar/criar cliente e conversa
//    - baixar imagens para o storage privado
//    - salvar a mensagem
//    - acionar o agente (IA) — a menos que a conversa esteja com "precisa de humano"
// ============================================================================
import { findTenantByPhoneNumberId } from '../repositories/tenantRepository.js';
import { findOrCreateCustomer } from '../repositories/customerRepository.js';
import {
  findOrCreateConversation,
  saveMessage,
  touchConversation,
  setNeedsHuman,
} from '../repositories/conversationRepository.js';
import {
  isPrivateContact,
  marcarIaEngajada,
} from '../repositories/privateContactRepository.js';
import { pareceAssuntoDeLocadora, MOTIVO_TRIAGEM } from './triagem.js';
import { query } from '../config/db.js';
import { downloadMedia, markAsRead } from './whatsapp.js';
import { uploadBuffer } from './storage.js';
import { attachIncomingDocument } from './documentService.js';
import { transcribeAudio, isTranscriptionEnabled } from './transcription.js';
import { respondToInbound } from './ai/agent.js';

/**
 * Registra um evento já processado (idempotência). Retorna false se já existia.
 */
async function registerEvent(tenantId, eventId) {
  const { rows } = await query(
    `INSERT INTO webhook_events (tenant_id, event_id)
     VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING id`,
    [tenantId, eventId]
  );
  return rows.length > 0; // true = novo, false = duplicado
}

/**
 * Ponto de entrada: recebe o corpo completo do webhook e processa cada mensagem.
 * É chamado em segundo plano (o webhook já respondeu 200 à Meta).
 */
export async function processWebhookPayload(body) {
  // Estrutura: entry[].changes[].value.{ metadata, contacts, messages, statuses }
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};

      // Eventos de status (entregue/lido) não precisam de processamento aqui.
      if (!value.messages || value.messages.length === 0) continue;

      const phoneNumberId = value.metadata?.phone_number_id;
      const tenant = await findTenantByPhoneNumberId(phoneNumberId);
      if (!tenant) {
        console.warn(`Webhook para phone_number_id desconhecido: ${phoneNumberId}`);
        continue;
      }

      for (const msg of value.messages) {
        try {
          await handleSingleMessage(tenant, value, msg);
        } catch (err) {
          console.error('Erro ao processar mensagem recebida:', err);
        }
      }
    }
  }
}

/**
 * Processa uma única mensagem recebida.
 */
async function handleSingleMessage(tenant, value, msg) {
  // 1) Idempotência: se já processamos este id, ignora.
  const isNew = await registerEvent(tenant.id, msg.id);
  if (!isNew) return;

  const phone = msg.from; // E.164 sem "+"
  const profileName = value.contacts?.[0]?.profile?.name;

  // 1.5) CONTATO PARTICULAR — a saída mais importante deste arquivo.
  //
  // Quando a locadora atende no mesmo número do WhatsApp pessoal, a família
  // escreve para cá também. Esta checagem vem ANTES de findOrCreateCustomer
  // de propósito: dali para baixo o telefone, o nome e o texto viram linha no
  // banco. Aqui a mensagem é descartada e não sobra nada — nem cliente, nem
  // conversa, nem mensagem, nem token gasto.
  //
  // O log não leva o número: quem é particular não vira registro nem em log.
  if (await isPrivateContact(tenant.id, phone)) {
    console.log('Mensagem de contato particular descartada (não gravada).');
    return;
  }

  // 2) Cliente e conversa
  const customer = await findOrCreateCustomer(tenant.id, phone, profileName);
  const conversation = await findOrCreateConversation(tenant.id, phone, customer.id);

  // 3) Conteúdo por tipo de mensagem
  let type = 'text';
  let content = null;
  let mediaStoragePath = null;
  let mediaMimeType = null;
  let mediaDocumentId = null;

  if (msg.type === 'text') {
    content = msg.text?.body ?? '';
  } else if (msg.type === 'image') {
    type = 'image';
    content = msg.image?.caption ?? null;
    // Baixa a imagem e guarda no bucket privado.
    const mediaId = msg.image?.id;
    if (mediaId) {
      const { buffer, mimeType } = await downloadMedia(tenant, mediaId);
      mediaStoragePath = await uploadBuffer(buffer, {
        tenantId: tenant.id,
        prefix: `conversas/${conversation.id}`,
        mimeType,
      });
      mediaMimeType = mimeType;

      // Se houver uma reserva ativa coletando documentos, anexa a imagem a ela.
      const doc = await attachIncomingDocument({
        tenant,
        customer,
        storagePath: mediaStoragePath,
        mimeType,
        mediaId,
      });
      if (doc) mediaDocumentId = doc.id;
    }
  } else if (msg.type === 'audio' || msg.type === 'voice') {
    // Mensagem de voz: baixa e transcreve (se configurado). O texto reconhecido
    // entra como se o cliente tivesse escrito, e a IA responde normalmente.
    const mediaId = msg.audio?.id || msg.voice?.id;
    if (mediaId && isTranscriptionEnabled()) {
      try {
        const { buffer, mimeType } = await downloadMedia(tenant, mediaId);
        const texto = await transcribeAudio(buffer, mimeType);
        content = texto || '[o cliente enviou um áudio, mas não deu para entender a fala]';
      } catch (err) {
        console.warn('Falha ao transcrever áudio:', err.message);
        content = '[o cliente enviou um áudio de voz, mas a transcrição falhou agora — peça gentilmente para ele escrever a mensagem]';
      }
    } else {
      content = '[o cliente enviou um áudio de voz. A transcrição automática não está ativada — peça, com gentileza, para ele escrever a mensagem]';
    }
  } else if (msg.type === 'document') {
    // Documento (ex.: comprovante de residência em PDF): trata como os demais
    // arquivos recebidos — baixa, guarda no bucket e anexa à reserva.
    type = 'image'; // o enum de mensagens usa "image" para mídia recebida
    content = msg.document?.caption ?? null;
    const mediaId = msg.document?.id;
    if (mediaId) {
      const { buffer, mimeType } = await downloadMedia(tenant, mediaId);
      mediaStoragePath = await uploadBuffer(buffer, {
        tenantId: tenant.id,
        prefix: `conversas/${conversation.id}`,
        mimeType,
      });
      mediaMimeType = mimeType;

      const doc = await attachIncomingDocument({
        tenant,
        customer,
        storagePath: mediaStoragePath,
        mimeType,
        mediaId,
      });
      if (doc) mediaDocumentId = doc.id;
    }
  } else {
    // Outros tipos (localização, contato, figurinha...) — registra como nota.
    type = 'text';
    content = `[mensagem do tipo "${msg.type}" ainda não suportada]`;
  }

  // 4) Salva a mensagem recebida (idempotente pelo whatsapp_message_id)
  const saved = await saveMessage({
    tenantId: tenant.id,
    conversationId: conversation.id,
    direction: 'inbound',
    type,
    content,
    whatsappMessageId: msg.id,
    mediaStoragePath,
    mediaMimeType,
    mediaDocumentId,
  });

  await touchConversation(conversation.id);
  await markAsRead(tenant, msg.id);

  // Se a mensagem era duplicada (saved null), não responde de novo.
  if (!saved) return;

  // 5) Se a conversa está marcada como "precisa de humano", a IA NÃO responde.
  if (conversation.needs_human) return;

  // 5.5) TRIAGEM — só quando o número é compartilhado com o WhatsApp pessoal.
  //
  // Custa zero: é comparação de palavras em código, sem chamar a IA. Vale
  // apenas na ENTRADA da conversa; depois que a IA assumiu, ela segue até o
  // fim (ver ai_engaged).
  //
  // Não bateu? Ninguém fica no vácuo: a conversa vai para "precisam de você"
  // com o motivo escrito, e o dono libera com um toque.
  if (tenant.shared_number && !conversation.ai_engaged) {
    if (!pareceAssuntoDeLocadora(content)) {
      await setNeedsHuman(tenant.id, conversation.id, true, MOTIVO_TRIAGEM);
      return;
    }
    await marcarIaEngajada(conversation.id);
  }

  // 6) Aciona o agente (placeholder nesta etapa; Claude na 2d)
  await respondToInbound({ tenant, conversation, customer, inbound: saved });
}
