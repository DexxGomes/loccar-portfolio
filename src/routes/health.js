// ============================================================================
//  Rota de saúde (health check). Verifica se a API e o banco respondem.
//  Base: /health
// ============================================================================
import { Router } from 'express';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok', time: new Date().toISOString() });
  } catch (err) {
    console.error('Health check falhou ao acessar o banco:', err.message);
    res.status(503).json({ status: 'degraded', db: 'erro' });
  }
});

// GET /health/config -> quais integrações estão configuradas (só liga/desliga,
// NUNCA os valores/segredos). Serve para conferir o setup sem acessar o Render.
//
// EXIGE LOGIN. Mesmo sem mostrar segredo, esta lista é um mapa para quem quer
// atacar: dizer publicamente que a assinatura do webhook está desligada é
// entregar por onde entrar. Quem precisa conferir o setup tem senha do painel.
healthRouter.get('/config', authenticate, (req, res) => {
  res.json({
    nodeEnv: env.NODE_ENV,
    integracoes: {
      ia: !!env.ANTHROPIC_API_KEY,
      transcricao: !!env.TRANSCRIPTION_API_KEY,
      storage: !!env.SUPABASE_KEY,
      whatsappFallback: !!env.WHATSAPP_TOKEN,
      assinaturaWebhook: !!env.WHATSAPP_APP_SECRET,
      verifyToken: !!env.VERIFY_TOKEN,
      criptografia: !!env.ENCRYPTION_KEY,
      avisoDono: !!env.OWNER_ALERT_TEMPLATE,
      pix: !!env.ASAAS_API_KEY,
    },
  });
});
