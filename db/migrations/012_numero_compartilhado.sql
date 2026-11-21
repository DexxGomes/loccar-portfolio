-- ============================================================================
--  012 — NÚMERO COMPARTILHADO (WhatsApp pessoal + locadora no mesmo chip)
--
--  O caso: a dona da locadora atende clientes no MESMO número que usa com a
--  família. Ela não quer trocar de chip — os clientes de anos conhecem aquele
--  número. Mas a IA não pode responder a tia, e conversa de família não pode
--  entrar no banco de dados de um sistema de locadora.
--
--  Três peças, nesta ordem de defesa:
--    1. contatos particulares  — a mensagem é DESCARTADA antes de virar linha
--       no banco. Não responde, não guarda, não gasta.
--    2. triagem por palavras   — se a primeira mensagem não parece assunto de
--       locação, a IA não é acionada; a conversa é marcada para o dono olhar.
--    3. ai_engaged             — depois que a IA entrou legitimamente numa
--       conversa, a triagem não se repete (cliente responde "ok", "sim", e
--       isso não tem palavra nenhuma de locação).
-- ============================================================================

-- 1) Números que o sistema nunca atende nem grava.
CREATE TABLE IF NOT EXISTS private_contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone      TEXT NOT NULL,              -- E.164 só dígitos, como vem da Meta
  label      TEXT,                       -- "Mãe", "Tia Ana" — só para o dono lembrar
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone)
);

COMMENT ON TABLE private_contacts IS
  'Números pessoais do dono (família, amigos). Mensagens deles são descartadas no webhook, antes de qualquer gravação.';

CREATE INDEX IF NOT EXISTS idx_private_contacts_tenant_phone
  ON private_contacts(tenant_id, phone);

-- 2) A locadora usa o mesmo número do WhatsApp pessoal?
--    FALSE (padrão) = número dedicado, tudo que chega é cliente: nada muda.
--    TRUE           = liga a triagem antes de acionar a IA.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS shared_number BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN tenants.shared_number IS
  'TRUE quando o número do WhatsApp também é o pessoal do dono. Liga a triagem por palavras antes de acionar a IA.';

-- 3) A IA já atendeu nesta conversa? Depois do primeiro "sim", não se tria mais.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ai_engaged BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN conversations.ai_engaged IS
  'TRUE depois que a IA atendeu legitimamente esta conversa. A triagem por palavras só vale na entrada.';
