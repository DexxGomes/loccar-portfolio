// ============================================================================
//  Webhook da Meta WhatsApp Cloud API.
//    GET  /webhook  -> verificação (handshake) com hub.challenge + VERIFY_TOKEN
//    POST /webhook  -> recebimento de mensagens (texto e imagens)
//
//  Boa prática: responder 200 rapidamente e processar em segundo plano.
//  A deduplicação (webhook_events + unique no whatsapp_message_id) torna
//  seguros os reenvios da Meta.
// ============================================================================
import { Router } from 'express';
import { env } from '../config/env.js';
import { verifyWhatsappSignature } from '../middleware/whatsappSignature.js';
import { processWebhookPayload } from '../services/inbound.js';

export const webhookRouter = Router();

// ---- Verificação (GET) ----
webhookRouter.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.VERIFY_TOKEN) {
    // A Meta espera receber de volta o challenge, em texto puro.
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ---- Recebimento (POST) ----
webhookRouter.post('/', verifyWhatsappSignature, (req, res) => {
  // Responde imediatamente para a Meta não reenviar por timeout.
  res.sendStatus(200);

  // Processa em segundo plano; erros são logados (não afetam a resposta).
  processWebhookPayload(req.body).catch((err) => {
    console.error('Erro ao processar webhook:', err);
  });
});
