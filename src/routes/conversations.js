// ============================================================================
//  Rotas REST de conversas (painel).
//  Base: /api/conversations
// ============================================================================
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import {
  listConversations,
  getConversationById,
  getRecentMessages,
  setNeedsHuman,
  deleteConversation,
} from '../repositories/conversationRepository.js';
import {
  addPrivateContact,
  marcarIaEngajada,
} from '../repositories/privateContactRepository.js';

export const conversationsRouter = Router();

// GET /api/conversations?needs_human=true  -> lista de conversas
conversationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const needsHuman = req.query.needs_human === 'true';
    const conversas = await listConversations(req.tenant.id, { needsHuman });
    res.json(conversas);
  })
);

// GET /api/conversations/:id/messages  -> histórico de mensagens
conversationsRouter.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const conversa = await getConversationById(req.tenant.id, req.params.id);
    if (!conversa) throw new HttpError(404, 'Conversa não encontrada.');
    const mensagens = await getRecentMessages(conversa.id, 100, req.tenant.id);
    res.json(mensagens);
  })
);

// POST /api/conversations/:id/resolve  -> desmarca "precisa de humano"
// (a IA volta a responder as próximas mensagens)
conversationsRouter.post(
  '/:id/resolve',
  asyncHandler(async (req, res) => {
    const conversa = await setNeedsHuman(req.tenant.id, req.params.id, false, null);
    if (!conversa) throw new HttpError(404, 'Conversa não encontrada.');

    // Liberar é uma decisão de gente: "esta pessoa é cliente, pode atender".
    // Marcamos a conversa para a triagem por palavras não barrar de novo na
    // próxima mensagem — senão o dono liberaria a mesma conversa toda hora.
    await marcarIaEngajada(conversa.id);

    res.json(conversa);
  })
);

// POST /api/conversations/:id/particular  -> "isto não é cliente, é pessoal"
//
// Põe o número na lista de particulares E apaga a conversa. Os dois juntos:
// bloquear daqui pra frente não bastaria, porque o que já foi dito continuaria
// guardado. A conversa some em cascata com as mensagens.
conversationsRouter.post(
  '/:id/particular',
  asyncHandler(async (req, res) => {
    const conversa = await getConversationById(req.tenant.id, req.params.id);
    if (!conversa) throw new HttpError(404, 'Conversa não encontrada.');

    await addPrivateContact(req.tenant.id, {
      phone: conversa.phone,
      label: req.body?.label,
    }).catch((err) => {
      // Já estava na lista (índice único): segue para apagar a conversa.
      if (err.code !== '23505') throw err;
    });

    await deleteConversation(req.tenant.id, conversa.id);
    res.json({ ok: true });
  })
);
