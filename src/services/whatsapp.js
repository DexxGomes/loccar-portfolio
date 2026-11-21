// ============================================================================
//  Integração com a Meta WhatsApp Cloud API.
//    - envio de mensagens de texto (janela de 24h, gratuitas)
//    - envio de mensagens de template (lembretes fora da janela)
//    - marcar mensagem como lida
//    - download de mídia (imagens) recebida, por media_id
//
//  Credenciais: preferimos o token/phone_number_id do PRÓPRIO tenant (multi-
//  tenant). Se o tenant não tiver, caímos no .env (útil no MVP com 1 locadora).
// ============================================================================
import { env } from '../config/env.js';
import { decrypt } from '../utils/crypto.js';

const GRAPH_BASE = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}`;

/**
 * Retorna as credenciais efetivas do tenant (com fallback para o .env).
 * O whatsapp_token do tenant é guardado cifrado no banco; decrypt() devolve o
 * valor em claro (e passa direto se ainda for um token legado em texto puro).
 * @param {object} tenant  linha da tabela tenants
 */
function getCredentials(tenant) {
  const token = (tenant?.whatsapp_token ? decrypt(tenant.whatsapp_token) : null) || env.WHATSAPP_TOKEN;
  const phoneNumberId = tenant?.phone_number_id || env.PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error(
      'Credenciais do WhatsApp ausentes (whatsapp_token/phone_number_id do tenant ou .env).'
    );
  }
  return { token, phoneNumberId };
}

/**
 * Chamada genérica ao endpoint de mensagens do número.
 */
async function postMessage(tenant, payload) {
  const { token, phoneNumberId } = getCredentials(tenant);
  const url = `${GRAPH_BASE}/${phoneNumberId}/messages`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    // A Meta devolve o detalhe do erro em data.error
    const msg = data?.error?.message || resp.statusText;
    throw new Error(`Falha ao enviar mensagem WhatsApp (${resp.status}): ${msg}`);
  }
  return data;
}

/**
 * Envia uma mensagem de texto simples (dentro da janela de 24h).
 * @param {string} to  telefone do destinatário em E.164 (ex: 5534999999999)
 */
export async function sendTextMessage(tenant, to, text) {
  return postMessage(tenant, {
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  });
}

/**
 * Envia uma mensagem de TEMPLATE (para fora da janela de 24h, ex: lembretes).
 * @param {string} templateName  nome do template aprovado na Meta
 * @param {string} languageCode  ex: 'pt_BR'
 * @param {Array}  components     componentes com as variáveis do template
 */
export async function sendTemplateMessage(tenant, to, templateName, languageCode, components = []) {
  return postMessage(tenant, {
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  });
}

/**
 * Marca uma mensagem recebida como lida (opcional, melhora a UX).
 */
export async function markAsRead(tenant, messageId) {
  try {
    return await postMessage(tenant, { status: 'read', message_id: messageId });
  } catch (err) {
    // Não é crítico: apenas registra e segue.
    console.warn('Não foi possível marcar como lida:', err.message);
  }
}

/**
 * Baixa uma mídia recebida (imagem) em duas etapas:
 *   1) GET /{media_id}          -> devolve a URL temporária e o mime_type
 *   2) GET <url> (com o token)  -> devolve os bytes
 * @returns {Promise<{ buffer: Buffer, mimeType: string }>}
 */
export async function downloadMedia(tenant, mediaId) {
  const { token } = getCredentials(tenant);

  // 1) metadados da mídia
  const metaResp = await fetch(`${GRAPH_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meta = await metaResp.json().catch(() => ({}));
  if (!metaResp.ok || !meta.url) {
    const msg = meta?.error?.message || metaResp.statusText;
    throw new Error(`Falha ao obter metadados da mídia (${metaResp.status}): ${msg}`);
  }

  // 2) bytes da mídia (a URL exige o mesmo token no header)
  const fileResp = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!fileResp.ok) {
    throw new Error(`Falha ao baixar a mídia (${fileResp.status}).`);
  }

  const arrayBuffer = await fileResp.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: meta.mime_type || fileResp.headers.get('content-type') || 'application/octet-stream',
  };
}
