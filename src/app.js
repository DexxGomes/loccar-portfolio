// ============================================================================
//  Montagem do app Express (separado do server.js para facilitar testes).
//  Aqui ficam middlewares globais, rotas e o tratamento de erros.
// ============================================================================
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { vehiclesRouter } from './routes/vehicles.js';
import { reservationsRouter } from './routes/reservations.js';
import { customersRouter } from './routes/customers.js';
import { conversationsRouter } from './routes/conversations.js';
import { blocklistRouter } from './routes/blocklist.js';
import { dashboardRouter } from './routes/dashboard.js';
import { scheduleBlocksRouter } from './routes/scheduleBlocks.js';
import { timelineRouter } from './routes/timeline.js';
import { inspectionsRouter } from './routes/inspections.js';
import { paymentsRouter } from './routes/payments.js';
import { leadsRouter } from './routes/leads.js';
import { tenantRouter } from './routes/tenant.js';
import { privateContactsRouter } from './routes/privateContacts.js';
import { finesRouter } from './routes/fines.js';
import { expensesRouter } from './routes/expenses.js';
import { authRouter } from './routes/auth.js';
import { webhookRouter } from './routes/webhook.js';
import { authenticate } from './middleware/auth.js';
import { rateLimit } from './middleware/rateLimit.js';
import { auditar } from './middleware/auditoria.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

// Origens permitidas no CORS. Se CORS_ORIGINS não for definido, reflete a
// origem (permissivo) — aceitável só em desenvolvimento.
const origensPermitidas = env.CORS_ORIGINS
  ? env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : null;

export function createApp() {
  const app = express();

  // Atrás de proxy/CDN, confia no X-Forwarded-For para o rate limit ver o IP
  // real do cliente (e não o IP do proxy).
  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  // Segurança e utilidades
  app.use(helmet());
  app.use(
    cors(
      origensPermitidas
        ? { origin: origensPermitidas, credentials: false }
        : undefined
    )
  );
  // Guarda o corpo bruto (rawBody) para validar a assinatura do webhook da Meta.
  app.use(
    express.json({
      // 6mb porque as fotos de vistoria chegam em base64 (o painel já reduz a
      // imagem antes de enviar; isto é a folga).
      limit: '6mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  if (env.NODE_ENV !== 'test') {
    // Log de requisições SEM a query string. A busca do painel manda o termo
    // na URL (?search=...), e quem busca cliente busca por CPF, nome e
    // telefone. Log de aplicação é copiado, exportado e fica guardado em
    // serviço de terceiro — não é lugar de dado pessoal.
    morgan.token('caminho', (req) => req.originalUrl.split('?')[0]);
    app.use(morgan(':method :caminho :status :response-time ms'));
  }

  // A API não tem nada para o Google. Isto evita que uma resposta JSON com
  // dado de cliente apareça em busca caso alguma URL vaze para fora.
  app.use((_req, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  // Raiz e health check (não exigem tenant)
  app.get('/', (req, res) => res.json({ name: 'API Locadoras', status: 'online' }));
  app.use('/health', healthRouter);

  // -------------------------------------------------------------------------
  // Webhook do WhatsApp: NÃO usa resolveTenant. Ele descobre o tenant pelo
  // phone_number_id que vem no próprio payload da Meta.
  // -------------------------------------------------------------------------
  app.use('/webhook', webhookRouter);

  // -------------------------------------------------------------------------
  // Rotas do painel. Login é público; as demais exigem autenticação (JWT).
  // -------------------------------------------------------------------------

  // Rate limit geral da API do painel (por IP) — teto de segurança contra abuso.
  app.use('/api', rateLimit({ windowMs: 60_000, max: 300, keyPrefix: 'api:' }));

  // Rate limit estrito no login: freia ataque de força bruta de senha.
  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs: 15 * 60_000,
      max: 20,
      keyPrefix: 'login:',
      message: 'Muitas tentativas de login. Espere alguns minutos e tente de novo.',
    })
  );

  app.use('/api/auth', authRouter);
  app.use('/api/vehicles', authenticate, vehiclesRouter);
  // As três rotas abaixo são as que tocam DADO PESSOAL — ficha do cliente,
  // documentos, conversa. São as auditadas (LGPD art. 37). Frota, dashboard e
  // financeiro não entram: registro que cresce sem informação vira palheiro.
  app.use('/api/reservations', authenticate, auditar('reservation'), reservationsRouter);
  app.use('/api/customers', authenticate, auditar('customer'), customersRouter);
  app.use('/api/conversations', authenticate, auditar('conversation'), conversationsRouter);
  app.use('/api/blocklist', authenticate, blocklistRouter);
  app.use('/api/dashboard', authenticate, dashboardRouter);
  app.use('/api/schedule-blocks', authenticate, scheduleBlocksRouter);
  app.use('/api/timeline', authenticate, timelineRouter);
  app.use('/api/inspections', authenticate, inspectionsRouter);
  app.use('/api/payments', authenticate, paymentsRouter);
  app.use('/api/leads', authenticate, leadsRouter);
  app.use('/api/tenant', authenticate, tenantRouter);
  app.use('/api/particulares', authenticate, privateContactsRouter);
  app.use('/api/fines', authenticate, finesRouter);
  app.use('/api/expenses', authenticate, expensesRouter);

  // 404 e tratamento central de erros (sempre por último)
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
