-- ============================================================================
--  SISTEMA DE RESERVAS PARA LOCADORAS VIA WHATSAPP
--  Esquema completo do banco de dados (PostgreSQL / Supabase)
--
--  Etapa 1 - Modelo de dados
--
--  Como aplicar:
--    psql "$DATABASE_URL" -f db/schema.sql
--  ou cole o conteúdo no SQL Editor do Supabase.
--
--  Observações:
--    - Todas as tabelas de negócio possuem tenant_id (multi-tenant desde o início).
--    - Dinheiro é armazenado em NUMERIC(10,2) para evitar erros de ponto flutuante.
--    - Datas/horas são TIMESTAMPTZ (sempre com fuso). O fuso "de exibição" da
--      locadora fica em tenants.timezone (padrão America/Sao_Paulo).
--    - A regra "um veículo não pode ter duas reservas sobrepostas" é garantida
--      no banco por uma EXCLUSION CONSTRAINT (não só na lógica da conversa).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensões necessárias
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- necessário para a EXCLUSION CONSTRAINT
                                            -- combinar "=" (uuid) com "&&" (range)

-- ----------------------------------------------------------------------------
-- Tipos enumerados (ENUMs)
-- ----------------------------------------------------------------------------

-- Situação da assinatura da locadora (cobrança será manual via Asaas no início)
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM (
    'trial',       -- período de teste
    'active',      -- assinatura em dia
    'past_due',    -- pagamento atrasado
    'suspended',   -- suspensa (não responde mais no WhatsApp)
    'canceled'     -- cancelada
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Papel do usuário do painel
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'owner',       -- dono da locadora (acesso total)
    'staff'        -- funcionário (acesso operacional)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Situação do veículo na frota
DO $$ BEGIN
  CREATE TYPE vehicle_status AS ENUM (
    'disponivel',
    'alugado',
    'manutencao'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ciclo de vida da reserva
DO $$ BEGIN
  CREATE TYPE reservation_status AS ENUM (
    'pre_reserva',            -- criada pela IA, ainda sem documentos
    'aguardando_documentos',  -- consentimento dado, aguardando envio das fotos
    'em_analise',             -- documentos recebidos, dono precisa analisar
    'confirmada',             -- dono aprovou
    'em_andamento',           -- veículo retirado
    'finalizada',             -- veículo devolvido
    'cancelada',              -- cancelada pelo cliente/dono
    'recusada',               -- dono recusou (motivo interno, nunca ao cliente)
    'expirada'                -- pré-reserva sem documentos expirou (24h)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tipos de documento coletados pelo WhatsApp
DO $$ BEGIN
  CREATE TYPE document_type AS ENUM (
    'cnh_frente',
    'cnh_verso',
    'comprovante_residencia',
    'selfie_cnh'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Direção da mensagem no histórico de conversa
DO $$ BEGIN
  CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tipo da mensagem trocada
DO $$ BEGIN
  CREATE TYPE message_type AS ENUM (
    'text',
    'image',
    'template',     -- mensagem de template (lembretes fora da janela de 24h)
    'interactive',  -- botões/listas do WhatsApp
    'system'        -- nota interna do sistema (não vai ao cliente)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tipo de lembrete automático
DO $$ BEGIN
  CREATE TYPE reminder_type AS ENUM ('retirada', 'devolucao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Situação do lembrete agendado
DO $$ BEGIN
  CREATE TYPE reminder_status AS ENUM ('pendente', 'enviado', 'falhou', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Função utilitária: atualiza a coluna updated_at automaticamente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- TABELA: tenants (locadoras)
--   Cada locadora é um tenant com seu próprio número de WhatsApp.
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  -- Identificação junto à Meta WhatsApp Cloud API
  phone_number_id       TEXT NOT NULL UNIQUE,   -- roteia o webhook recebido para o tenant certo
  waba_id               TEXT,                    -- WhatsApp Business Account ID (opcional)
  display_phone_number  TEXT,                    -- número humano, ex: +55 34 99999-9999
  -- Token de envio (idealmente criptografado em produção; ver notas de segurança)
  whatsapp_token        TEXT,
  -- Assinatura
  subscription_status   subscription_status NOT NULL DEFAULT 'trial',
  -- Preferências operacionais
  timezone              TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  tenants IS 'Locadoras clientes do SaaS (multi-tenant).';
COMMENT ON COLUMN tenants.phone_number_id IS 'phone_number_id da Meta Cloud API; usado para rotear o webhook ao tenant.';
COMMENT ON COLUMN tenants.whatsapp_token IS 'Token de envio da Cloud API. Em produção, armazenar criptografado.';

CREATE OR REPLACE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================================
-- TABELA: users (usuários do painel — donos e funcionários)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL,
  password_hash  TEXT NOT NULL,            -- hash bcrypt/argon2 (nunca a senha em texto)
  role           user_role NOT NULL DEFAULT 'owner',
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- e-mail único por locadora
  UNIQUE (tenant_id, email)
);

COMMENT ON TABLE users IS 'Usuários que acessam o painel web de cada locadora.';

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================================
-- TABELA: vehicles (frota)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  model           TEXT NOT NULL,                 -- ex: "Fiat Argo 1.0"
  plate           TEXT NOT NULL,                 -- placa
  category        TEXT NOT NULL,                 -- hatch, sedan, SUV, picape ou minivan
  daily_rate      NUMERIC(10,2) NOT NULL CHECK (daily_rate >= 0),  -- valor da diária
  deposit_amount  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0), -- caução
  status          vehicle_status NOT NULL DEFAULT 'disponivel',
  year            INTEGER,
  color           TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- placa única por locadora
  UNIQUE (tenant_id, plate)
);

COMMENT ON TABLE  vehicles IS 'Veículos da frota de cada locadora.';
COMMENT ON COLUMN vehicles.deposit_amount IS 'Valor da caução, informado separadamente do total.';

CREATE INDEX IF NOT EXISTS idx_vehicles_tenant ON vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_status ON vehicles(tenant_id, status);

CREATE OR REPLACE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================================
-- TABELA: customers (clientes / locatários)
-- ============================================================================
CREATE TABLE IF NOT EXISTS customers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              TEXT,
  phone             TEXT NOT NULL,              -- número no formato E.164 (ex: 5534999999999)
  cpf               TEXT,                       -- apenas dígitos
  cnh_number        TEXT,
  cnh_valid_until   DATE,
  -- LGPD: registro do consentimento
  lgpd_consent_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- um cadastro por telefone dentro da locadora
  UNIQUE (tenant_id, phone)
);

COMMENT ON TABLE  customers IS 'Clientes/locatários de cada locadora.';
COMMENT ON COLUMN customers.lgpd_consent_at IS 'Data/hora em que o cliente consentiu com o uso dos documentos (LGPD).';

CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_cpf ON customers(tenant_id, cpf);

CREATE OR REPLACE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================================
-- TABELA: schedule_blocks (bloqueios de agenda / manutenção)
--   Períodos em que o veículo NÃO pode ser reservado.
-- ============================================================================
CREATE TABLE IF NOT EXISTS schedule_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ NOT NULL,
  reason      TEXT,                              -- ex: "manutenção preventiva"
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  -- dois bloqueios do mesmo veículo não podem se sobrepor
  CONSTRAINT schedule_blocks_no_overlap
    EXCLUDE USING gist (
      vehicle_id WITH =,
      (tstzrange(start_at, end_at)) WITH &&
    )
);

COMMENT ON TABLE schedule_blocks IS 'Períodos de indisponibilidade do veículo (manutenção, uso interno, etc.).';

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_vehicle ON schedule_blocks(vehicle_id);


-- ============================================================================
-- TABELA: reservations (reservas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS reservations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id            UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  -- Período da locação
  pickup_at             TIMESTAMPTZ NOT NULL,   -- data/hora de retirada
  return_at             TIMESTAMPTZ NOT NULL,   -- data/hora de devolução
  -- Valores "congelados" no momento da reserva (não mudam se o veículo mudar de preço)
  daily_rate_snapshot   NUMERIC(10,2) NOT NULL CHECK (daily_rate_snapshot >= 0),
  deposit_snapshot      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (deposit_snapshot >= 0),
  days_count            INTEGER NOT NULL CHECK (days_count > 0),  -- nº de diárias (24h)
  total_amount          NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0), -- diárias x diária
  -- Ciclo de vida
  status                reservation_status NOT NULL DEFAULT 'pre_reserva',
  -- Motivo interno de recusa (NUNCA enviado ao cliente)
  internal_rejection_reason TEXT,
  -- Expiração da pré-reserva sem documentos (24h)
  expires_at            TIMESTAMPTZ,
  -- Sinalizações operacionais
  late_return_flag      BOOLEAN NOT NULL DEFAULT FALSE, -- devolução atrasada (só sinaliza)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (return_at > pickup_at)
);

COMMENT ON TABLE  reservations IS 'Reservas/pré-reservas de veículos.';
COMMENT ON COLUMN reservations.daily_rate_snapshot IS 'Valor da diária no momento da reserva (histórico congelado).';
COMMENT ON COLUMN reservations.internal_rejection_reason IS 'Motivo interno da recusa; nunca é exposto ao cliente.';
COMMENT ON COLUMN reservations.expires_at IS 'Quando a pré-reserva expira caso os documentos não sejam enviados.';

CREATE INDEX IF NOT EXISTS idx_reservations_tenant ON reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reservations_vehicle ON reservations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_reservations_customer ON reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_pickup ON reservations(tenant_id, pickup_at);
CREATE INDEX IF NOT EXISTS idx_reservations_expires ON reservations(expires_at)
  WHERE status IN ('pre_reserva', 'aguardando_documentos');

-- ----------------------------------------------------------------------------
-- REGRA CRÍTICA: um veículo não pode ter duas reservas com períodos sobrepostos.
-- Garantida no banco por EXCLUSION CONSTRAINT (apenas para status "ativos";
-- reservas canceladas/recusadas/expiradas/finalizadas não bloqueiam a agenda).
-- ----------------------------------------------------------------------------
-- (envolvida em DO para poder rodar o script mais de uma vez sem erro)
DO $$ BEGIN
  ALTER TABLE reservations
    ADD CONSTRAINT reservations_no_overlap
    EXCLUDE USING gist (
      vehicle_id WITH =,
      (tstzrange(pickup_at, return_at)) WITH &&
    )
    WHERE (status IN (
      'pre_reserva', 'aguardando_documentos', 'em_analise',
      'confirmada', 'em_andamento'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; -- constraint já existe
END $$;

CREATE OR REPLACE TRIGGER trg_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- Garantia cruzada: uma reserva não pode cair sobre um bloqueio/manutenção
-- do mesmo veículo (a EXCLUSION CONSTRAINT acima só cobre reserva x reserva).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reservation_no_maintenance_overlap()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IN (
    'pre_reserva', 'aguardando_documentos', 'em_analise',
    'confirmada', 'em_andamento'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM schedule_blocks sb
      WHERE sb.vehicle_id = NEW.vehicle_id
        AND tstzrange(sb.start_at, sb.end_at) && tstzrange(NEW.pickup_at, NEW.return_at)
    ) THEN
      RAISE EXCEPTION 'Veículo indisponível: o período conflita com um bloqueio de agenda/manutenção.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_reservation_no_maintenance
  BEFORE INSERT OR UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION reservation_no_maintenance_overlap();

-- Sentido inverso: não deixar criar bloqueio sobre uma reserva ativa.
CREATE OR REPLACE FUNCTION maintenance_no_reservation_overlap()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.vehicle_id = NEW.vehicle_id
      AND r.status IN (
        'pre_reserva', 'aguardando_documentos', 'em_analise',
        'confirmada', 'em_andamento'
      )
      AND tstzrange(r.pickup_at, r.return_at) && tstzrange(NEW.start_at, NEW.end_at)
  ) THEN
    RAISE EXCEPTION 'Não é possível bloquear: o período conflita com uma reserva ativa.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_maintenance_no_reservation
  BEFORE INSERT OR UPDATE ON schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION maintenance_no_reservation_overlap();


-- ============================================================================
-- TABELA: documents (documentos do cliente, armazenados no storage privado)
-- ============================================================================
CREATE TABLE IF NOT EXISTS documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id    UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  customer_id       UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type              document_type NOT NULL,
  storage_path      TEXT NOT NULL,             -- caminho no bucket privado (NUNCA URL pública)
  mime_type         TEXT,
  whatsapp_media_id TEXT,                       -- media_id de origem (rastreabilidade)
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  documents IS 'Documentos enviados pelo cliente, guardados em storage privado.';
COMMENT ON COLUMN documents.storage_path IS 'Caminho no bucket privado do Supabase; acesso apenas via URL assinada temporária.';

CREATE INDEX IF NOT EXISTS idx_documents_reservation ON documents(reservation_id);
CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(customer_id);


-- ============================================================================
-- TABELA: blocklist (lista de bloqueio por locadora)
-- ============================================================================
CREATE TABLE IF NOT EXISTS blocklist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cpf         TEXT,                              -- pode bloquear por CPF...
  phone       TEXT,                              -- ...e/ou por telefone
  reason      TEXT,                              -- motivo interno
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- ao menos um identificador precisa estar preenchido
  CHECK (cpf IS NOT NULL OR phone IS NOT NULL)
);

COMMENT ON TABLE blocklist IS 'Clientes bloqueados por locadora (CPF e/ou telefone).';

CREATE INDEX IF NOT EXISTS idx_blocklist_tenant_cpf ON blocklist(tenant_id, cpf);
CREATE INDEX IF NOT EXISTS idx_blocklist_tenant_phone ON blocklist(tenant_id, phone);


-- ============================================================================
-- TABELA: conversations (uma conversa por cliente/telefone)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL, -- nulo até identificar
  phone            TEXT NOT NULL,               -- E.164
  needs_human      BOOLEAN NOT NULL DEFAULT FALSE, -- flag "precisa de humano"
  needs_human_reason TEXT,                       -- por que foi escalado
  is_open          BOOLEAN NOT NULL DEFAULT TRUE,
  last_message_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone)
);

COMMENT ON TABLE  conversations IS 'Fio de conversa do WhatsApp por cliente.';
COMMENT ON COLUMN conversations.needs_human IS 'Quando TRUE, a IA para de responder e o dono é notificado.';

CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_needs_human ON conversations(tenant_id, needs_human)
  WHERE needs_human = TRUE;

CREATE OR REPLACE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================================
-- TABELA: messages (histórico de mensagens da conversa)
--   Também serve de contexto para a IA (papéis inbound=user / outbound=assistant).
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction           message_direction NOT NULL,
  type                message_type NOT NULL DEFAULT 'text',
  content             TEXT,                      -- texto da mensagem (ou legenda)
  whatsapp_message_id TEXT,                      -- id da mensagem na Meta (idempotência)
  media_document_id   UUID REFERENCES documents(id) ON DELETE SET NULL, -- se virou documento
  media_storage_path  TEXT,                      -- caminho no bucket, se a mensagem for mídia
  media_mime_type     TEXT,                      -- tipo da mídia recebida
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Colunas de mídia (idempotente, para bancos criados antes desta etapa)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_storage_path TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_mime_type TEXT;

COMMENT ON TABLE messages IS 'Todas as mensagens trocadas (entrada e saída), também usadas como contexto da IA.';

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_wamid ON messages(whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;


-- ============================================================================
-- TABELA: reminders (lembretes automáticos agendados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS reminders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  type           reminder_type NOT NULL,        -- retirada / devolucao
  scheduled_for  TIMESTAMPTZ NOT NULL,          -- quando deve ser enviado (24h antes)
  status         reminder_status NOT NULL DEFAULT 'pendente',
  sent_at        TIMESTAMPTZ,
  error          TEXT,                           -- mensagem de erro em caso de falha
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- não agendar dois lembretes iguais para a mesma reserva
  UNIQUE (reservation_id, type)
);

COMMENT ON TABLE reminders IS 'Fila de lembretes (retirada e devolução) enviados via template do WhatsApp.';

CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(scheduled_for)
  WHERE status = 'pendente';

CREATE OR REPLACE TRIGGER trg_reminders_updated_at
  BEFORE UPDATE ON reminders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================================
-- TABELA: webhook_events (idempotência do webhook da Meta)
--   Evita processar a mesma mensagem duas vezes (a Meta pode reenviar).
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
  event_id       TEXT NOT NULL,                 -- id único do evento/mensagem
  received_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

COMMENT ON TABLE webhook_events IS 'Log de deduplicação dos eventos recebidos do WhatsApp.';


-- ============================================================================
-- ESTRUTURA FUTURA (não usada no MVP, deixada preparada)
--   Interface de "provedor de verificação" (CPF, CNH, antecedentes).
--   Os resultados de futuras consultas ficarão aqui.
-- ============================================================================
CREATE TABLE IF NOT EXISTS verification_checks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  customer_id    UUID REFERENCES customers(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,                 -- nome do provedor (ex: "serpro", "mock")
  check_type     TEXT NOT NULL,                 -- ex: "cpf", "cnh", "antecedentes"
  status         TEXT NOT NULL DEFAULT 'pendente', -- pendente/aprovado/reprovado/erro
  result         JSONB,                          -- resposta bruta do provedor
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE verification_checks IS 'Resultados de verificações externas (preparado para o futuro; sem uso no MVP).';

CREATE INDEX IF NOT EXISTS idx_verification_reservation ON verification_checks(reservation_id);


-- ============================================================================
-- FIM DO ESQUEMA
-- ============================================================================
