// ============================================================================
//  Agente de conversa (Claude + ferramentas).
//
//  Fluxo: carrega o histórico da conversa -> chama o Claude com o system prompt
//  e as ferramentas -> executa as ferramentas que o Claude pedir (loop) ->
//  envia a resposta final ao cliente pelo WhatsApp.
//
//  Princípios: a IA NUNCA confirma reservas; se o cliente estiver na blocklist
//  ou pedir algo fora do escopo, a conversa é transferida para um humano.
// ============================================================================
import { env } from '../../config/env.js';
import { anthropic, isAiEnabled } from './anthropic.js';
import { buildSystemPrompt } from './prompts.js';
import { toolDefinitions, executeTool } from './tools.js';
import { sendTextMessage } from '../whatsapp.js';
import {
  getRecentMessages,
  saveMessage,
  setNeedsHuman,
} from '../../repositories/conversationRepository.js';
import { isBlocked } from '../../repositories/blocklistRepository.js';
import { notifyOwnerNeedsHuman } from '../notify.js';

const MAX_TOKENS = 1024; // respostas de WhatsApp são curtas
const MAX_ITERACOES = 6; // limite de idas e voltas de ferramentas por mensagem

/**
 * Monta o array de mensagens para o Claude a partir do histórico salvo.
 * inbound -> user, outbound -> assistant. Ignora notas de sistema e garante
 * que a conversa comece por uma mensagem do usuário.
 */
function montarMensagens(historico) {
  const msgs = [];
  for (const m of historico) {
    if (m.type === 'system') continue;
    const role = m.direction === 'inbound' ? 'user' : 'assistant';
    let content = m.content;
    if (m.type === 'image') {
      content = m.content ? `[o cliente enviou uma imagem: ${m.content}]` : '[o cliente enviou uma imagem]';
    }
    if (!content) continue;
    msgs.push({ role, content });
  }
  // O primeiro turno precisa ser do usuário.
  while (msgs.length && msgs[0].role === 'assistant') msgs.shift();
  return msgs;
}

/** Envia a resposta ao cliente e registra no histórico. */
async function responder(tenant, conversation, texto) {
  if (!texto) return;
  await sendTextMessage(tenant, conversation.phone, texto);
  await saveMessage({
    tenantId: tenant.id,
    conversationId: conversation.id,
    direction: 'outbound',
    type: 'text',
    content: texto,
  });
}

/**
 * Gera e envia a resposta ao cliente.
 * @param {object} ctx { tenant, conversation, customer, inbound }
 */
export async function respondToInbound({ tenant, conversation, customer }) {
  // Sem IA configurada: encaminha para humano (não deixa o cliente sem resposta).
  if (!isAiEnabled()) {
    await setNeedsHuman(tenant.id, conversation.id, true, 'IA não configurada');
    await responder(tenant, conversation, 'Recebemos sua mensagem! Em breve um atendente vai te responder. 🙂');
    return;
  }

  // Cliente na blocklist: sinaliza no painel e transfere (não faz reservas).
  const bloqueado = await isBlocked(tenant.id, { phone: conversation.phone, cpf: customer.cpf });
  if (bloqueado) {
    await setNeedsHuman(tenant.id, conversation.id, true, 'Cliente na blocklist tentou contato');
    console.log(`🔔 [${tenant.name}] Cliente bloqueado tentou contato: ${conversation.phone}`);
    notifyOwnerNeedsHuman(tenant, { conversation, customer, motivo: 'Cliente da blocklist tentou contato' }).catch(() => {});
    await responder(tenant, conversation, 'Recebemos sua mensagem! Em breve um atendente vai te responder. 🙂');
    return;
  }

  const historico = await getRecentMessages(conversation.id, 20, tenant.id);
  const messages = montarMensagens(historico);
  if (messages.length === 0) return;

  const system = buildSystemPrompt(tenant, customer);
  const ctx = { tenant, conversation, customer };

  try {
    let response = await anthropic.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      tools: toolDefinitions,
      messages,
    });

    // Loop de ferramentas: enquanto o Claude pedir tools, executa e devolve.
    let iteracoes = 0;
    while (response.stop_reason === 'tool_use' && iteracoes < MAX_ITERACOES) {
      iteracoes++;
      messages.push({ role: 'assistant', content: response.content });

      const toolResults = [];
      for (const bloco of response.content) {
        if (bloco.type === 'tool_use') {
          const resultado = await executeTool(bloco.name, bloco.input, ctx);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: bloco.id,
            content: resultado.text,
            is_error: resultado.isError,
          });
        }
      }
      messages.push({ role: 'user', content: toolResults });

      response = await anthropic.messages.create({
        model: env.ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        system,
        tools: toolDefinitions,
        messages,
      });
    }

    // Recusa de segurança: transfere para humano.
    if (response.stop_reason === 'refusal') {
      await setNeedsHuman(tenant.id, conversation.id, true, 'Resposta recusada pela IA');
      notifyOwnerNeedsHuman(tenant, { conversation, customer, motivo: 'A IA transferiu a conversa' }).catch(() => {});
      await responder(tenant, conversation, 'Vou te transferir para um atendente para continuar. 🙂');
      return;
    }

    // Extrai e envia o texto final.
    const textoFinal = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (textoFinal) {
      await responder(tenant, conversation, textoFinal);
    }
  } catch (err) {
    console.error('Erro no agente de IA:', err);
    // Falha na IA: não deixa o cliente sem resposta e sinaliza para humano.
    await setNeedsHuman(tenant.id, conversation.id, true, 'Falha ao processar com a IA');
    notifyOwnerNeedsHuman(tenant, { conversation, customer, motivo: 'Falha técnica — cliente aguardando' }).catch(() => {});
    await responder(tenant, conversation, 'Tivemos um probleminha técnico. Um atendente vai te responder em instantes. 🙏');
  }
}
