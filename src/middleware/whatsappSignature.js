// ============================================================================
//  Validação da assinatura do webhook da Meta (X-Hub-Signature-256).
//  A Meta assina o corpo da requisição com HMAC-SHA256 usando o APP SECRET.
//
//  Só é aplicada se WHATSAPP_APP_SECRET estiver no .env. Caso contrário,
//  a validação é pulada (com aviso), para não travar os testes locais iniciais.
//  Requer o corpo bruto da requisição (capturado em app.js via express.json).
// ============================================================================
import crypto from 'node:crypto';
import { env } from '../config/env.js';

let avisou = false;

export function verifyWhatsappSignature(req, res, next) {
  if (!env.WHATSAPP_APP_SECRET) {
    // EM PRODUÇÃO ISSO É UMA PORTA ABERTA, não uma comodidade: sem assinatura,
    // qualquer pessoa que descubra o endereço do webhook pode fingir ser a
    // Meta e injetar mensagens de cliente. A IA responderia, criaria
    // pré-reservas e — o pior — mandaria WhatsApp em nome da locadora para
    // qualquer número que viesse no payload falso.
    // Por isso, em produção, recusamos em vez de pular a conferência.
    if (env.NODE_ENV === 'production') {
      console.error(
        '🚨 Webhook recusado: WHATSAPP_APP_SECRET não configurado em produção. ' +
          'Defina a variável para a Meta poder entregar as mensagens.'
      );
      return res.status(503).json({ error: 'Webhook não configurado.' });
    }

    // Fora de produção, segue com aviso (facilita o teste local).
    if (!avisou) {
      console.warn(
        '⚠️  WHATSAPP_APP_SECRET não definido: a assinatura do webhook NÃO está sendo validada.'
      );
      avisou = true;
    }
    return next();
  }

  const signature = req.get('x-hub-signature-256');
  if (!signature || !req.rawBody) {
    return res.status(401).json({ error: 'Assinatura ausente.' });
  }

  const esperado =
    'sha256=' +
    crypto.createHmac('sha256', env.WHATSAPP_APP_SECRET).update(req.rawBody).digest('hex');

  // Comparação em tempo constante para evitar timing attacks.
  const a = Buffer.from(signature);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Assinatura inválida.' });
  }

  next();
}
