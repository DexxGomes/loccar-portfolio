// ============================================================================
//  Avisos para o DONO da locadora.
//
//  Quando uma conversa é transferida para humano (needs_human), o dono pode não
//  estar de olho no painel — sobretudo no modelo de número dedicado, em que as
//  mensagens não chegam no celular dele. Então mandamos um WhatsApp de alerta
//  PARA o número do dono (tenants.owner_alert_phone), via um template curto.
//
//  É best-effort e OPCIONAL: sem owner_alert_phone ou OWNER_ALERT_TEMPLATE
//  configurados, não faz nada (nunca quebra o fluxo do cliente).
// ============================================================================
import { env } from '../config/env.js';
import { sendTemplateMessage } from './whatsapp.js';

// Anti-spam: no máximo um aviso por conversa a cada 10 minutos.
const JANELA_MS = 10 * 60 * 1000;
const ultimoAviso = new Map(); // `${tenantId}:${conversationId}` -> timestamp

function podeAvisar(chave) {
  const agora = Date.now();
  const ult = ultimoAviso.get(chave);
  if (ult && agora - ult < JANELA_MS) return false;
  ultimoAviso.set(chave, agora);
  // Limpeza leve para o Map não crescer sem limite.
  if (ultimoAviso.size > 2000) {
    for (const [k, v] of ultimoAviso) if (agora - v > JANELA_MS) ultimoAviso.delete(k);
  }
  return true;
}

/**
 * Avisa o dono que uma conversa precisa dele.
 * @param {object} tenant  linha do tenant (precisa de owner_alert_phone + credenciais)
 * @param {{conversation:object, customer?:object, motivo?:string}} ctx
 */
export async function notifyOwnerNeedsHuman(tenant, { conversation, customer, motivo }) {
  try {
    const destino = tenant?.owner_alert_phone;
    const template = env.OWNER_ALERT_TEMPLATE;
    if (!destino || !template) return; // não configurado — silencioso

    if (!podeAvisar(`${tenant.id}:${conversation.id}`)) return;

    const nomeCliente = customer?.name || 'Cliente';
    const resumo = (motivo || 'precisa de atendimento').slice(0, 120);
    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: nomeCliente },
          { type: 'text', text: resumo },
        ],
      },
    ];

    await sendTemplateMessage(tenant, destino, template, env.REMINDER_TEMPLATE_LANG, components);
  } catch (err) {
    // Nunca deixa o aviso quebrar o atendimento do cliente.
    console.warn('Falha ao avisar o dono (needs_human):', err.message);
  }
}
