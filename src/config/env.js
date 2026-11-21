// ============================================================================
//  Carrega e VALIDA as variáveis de ambiente (.env).
//  Se algo obrigatório estiver faltando ou inválido, o processo encerra com
//  uma mensagem clara — melhor falhar cedo do que quebrar em produção.
// ============================================================================
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  // ----- Aplicação -----
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),

  // ----- Banco (obrigatório já nesta etapa) -----
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),

  // ----- Supabase Storage (usado a partir da etapa de documentos) -----
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('documentos'),

  // ----- WhatsApp Cloud API (usado a partir da etapa do webhook) -----
  WHATSAPP_TOKEN: z.string().optional(),
  PHONE_NUMBER_ID: z.string().optional(),
  VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  // Segredo do app da Meta, para validar a assinatura (X-Hub-Signature-256).
  // Opcional: se vazio, a validação de assinatura é pulada (com aviso no log).
  WHATSAPP_APP_SECRET: z.string().optional(),

  // ----- Transcrição de áudio (voz do WhatsApp) — opcional -----
  // O Claude não transcreve áudio; use um serviço compatível com a API Whisper
  // da OpenAI (a própria OpenAI, ou Groq — mais barato). Sem a chave, o áudio
  // recebe um pedido educado para o cliente escrever.
  TRANSCRIPTION_API_KEY: z.string().optional(),
  // Padrão: Groq (barato e rápido). Para usar a OpenAI, defina
  // TRANSCRIPTION_BASE_URL=https://api.openai.com/v1 e TRANSCRIPTION_MODEL=whisper-1.
  TRANSCRIPTION_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  TRANSCRIPTION_MODEL: z.string().default('whisper-large-v3'),

  // ----- Anthropic (usado a partir da etapa da IA) -----
  ANTHROPIC_API_KEY: z.string().optional(),
  // Modelo da Anthropic. Padrão: o mais capaz (Opus 4.8). Para reduzir custo em
  // um bot de alto volume, você pode trocar por 'claude-sonnet-5' ou 'claude-haiku-4-5'.
  ANTHROPIC_MODEL: z.string().default('claude-opus-4-8'),

  // ----- Segurança do painel (usado a partir da etapa de auth) -----
  JWT_SECRET: z.string().optional(),

  // Lista de origens permitidas no CORS (separadas por vírgula). Vazio = reflete
  // qualquer origem (só aceitável em desenvolvimento). Em produção, defina o
  // domínio do painel, ex: "https://painel.loccar.com.br".
  CORS_ORIGINS: z.string().optional(),

  // Atrás de um proxy/CDN (Vercel, Nginx, Cloudflare) o IP real vem em
  // X-Forwarded-For. Ligue para o rate limit enxergar o IP certo do cliente.
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((v) => !['false', '0', 'no', 'off'].includes(v.toLowerCase())),

  // Atalho de desenvolvimento que aceita o header x-tenant-id no lugar do login.
  // É um BYPASS de autenticação — fica DESLIGADO por padrão e só funciona em
  // NODE_ENV=development. Nunca ligue em produção.
  ALLOW_DEV_TENANT_HEADER: z
    .string()
    .default('false')
    .transform((v) => !['false', '0', 'no', 'off'].includes(v.toLowerCase())),

  // Chave para cifrar segredos guardados no banco (whatsapp_token). 32 bytes em
  // hex (64 chars) ou base64. Opcional: sem ela, tokens ficam em texto puro
  // (como antes). Gere: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ENCRYPTION_KEY: z.string().optional(),

  // ----- Cobrança (Asaas) — opcional -----
  // Sem a chave, o painel segue registrando pagamentos manualmente; só o
  // botão de gerar PIX fica indisponível. Comece sempre por 'sandbox'.
  ASAAS_API_KEY: z.string().optional(),
  ASAAS_ENV: z.enum(['sandbox', 'production']).default('sandbox'),

  // ----- Retenção de documentos (proteção contra vazamento) -----
  // Dias que a CNH/selfie/comprovante ficam guardados DEPOIS que a locação
  // termina. Passado o prazo, o arquivo sai do bucket e só fica o registro de
  // que existiu. 0 = desligado (nada é apagado automaticamente).
  // Sugestão: 180 (cobre multa atrasada e contestação sem guardar documento
  // de cliente por anos — o que vaza numa invasão é o que está guardado).
  DOCUMENT_RETENTION_DAYS: z.coerce.number().default(0),
  // Varredura da retenção: uma vez por dia, de madrugada.
  PURGE_CRON: z.string().default('30 3 * * *'),

  // ----- Regras de negócio -----
  PRE_RESERVATION_EXPIRY_HOURS: z.coerce.number().default(24),
  DOCUMENT_REMINDER_AFTER_HOURS: z.coerce.number().default(3),
  DEFAULT_TIMEZONE: z.string().default('America/Sao_Paulo'),

  // ----- Lembretes (templates aprovados na Meta) e jobs agendados -----
  REMINDER_PICKUP_TEMPLATE: z.string().default('lembrete_retirada'),
  REMINDER_RETURN_TEMPLATE: z.string().default('lembrete_devolucao'),
  REMINDER_TEMPLATE_LANG: z.string().default('pt_BR'),
  // Template para avisar o DONO que uma conversa precisa dele (opcional).
  // Sem isto (ou sem tenants.owner_alert_phone), o aviso ao dono fica desligado.
  OWNER_ALERT_TEMPLATE: z.string().optional(),
  // Cron: envio de lembretes (a cada 5 min) e expiração de pré-reservas (a cada 15 min).
  REMINDERS_CRON: z.string().default('*/5 * * * *'),
  EXPIRE_CRON: z.string().default('*/15 * * * *'),
  // Liga/desliga os jobs (útil desligar em testes).
  // Obs: não usar z.coerce.boolean() — ele trata "false" como true.
  ENABLE_JOBS: z
    .string()
    .default('true')
    .transform((v) => !['false', '0', 'no', 'off'].includes(v.toLowerCase())),
});

// Regras que só valem em produção: um segredo de JWT forte é inegociável — sem
// ele (ou fraco), qualquer um forja um token de acesso ao painel.
const envSchemaComRegras = envSchema.superRefine((val, ctx) => {
  if (val.NODE_ENV === 'production') {
    if (!val.JWT_SECRET || val.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message:
          'JWT_SECRET é obrigatório em produção e deve ter ao menos 32 caracteres. ' +
          'Gere um: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
      });
    }
    if (val.ALLOW_DEV_TENANT_HEADER) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ALLOW_DEV_TENANT_HEADER'],
        message: 'ALLOW_DEV_TENANT_HEADER não pode ficar ligado em produção (é um bypass de login).',
      });
    }
  }

  // Se ENCRYPTION_KEY foi definida, precisa ter exatamente 32 bytes.
  if (val.ENCRYPTION_KEY) {
    const okHex = /^[0-9a-fA-F]{64}$/.test(val.ENCRYPTION_KEY);
    let okB64 = false;
    try {
      okB64 = Buffer.from(val.ENCRYPTION_KEY, 'base64').length === 32;
    } catch {
      okB64 = false;
    }
    if (!okHex && !okB64) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ENCRYPTION_KEY'],
        message: 'ENCRYPTION_KEY deve ter 32 bytes (64 caracteres hex, ou base64 de 32 bytes).',
      });
    }
  }
});

const parsed = envSchemaComRegras.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas. Verifique o seu arquivo .env:\n');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
