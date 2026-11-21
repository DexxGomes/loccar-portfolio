-- ============================================================================
--  MIGRAÇÃO 002 — FINANCEIRO (contas a receber e cobrança PIX)
--
--  Um lançamento por cobrança da locação: sinal, diárias, caução, extras e
--  multas. O dinheiro fica separado da reserva porque uma locação costuma ter
--  mais de um pagamento (sinal agora, diárias na retirada, caução devolvida
--  depois) e cada um tem vida própria.
--
--  Como aplicar:
--    npm run db:migrate
--
--  Idempotente: pode rodar mais de uma vez.
-- ============================================================================

-- O que está sendo cobrado
DO $$ BEGIN
  CREATE TYPE payment_kind AS ENUM (
    'sinal',     -- entrada para segurar a reserva
    'diarias',   -- o valor da locação em si
    'caucao',    -- garantia (é devolvida)
    'extra',     -- lavagem, combustível, entrega, taxa de atraso
    'multa'      -- infração de trânsito repassada
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Situação da cobrança
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'pendente',
    'pago',
    'vencido',
    'cancelado',
    'estornado'   -- usado principalmente na devolução da caução
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Como foi (ou será) pago
DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM (
    'pix',
    'dinheiro',
    'cartao',
    'transferencia',
    'boleto',
    'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- TABELA: payments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- A cobrança normalmente pertence a uma locação, mas pode ser avulsa
  -- (uma multa que chegou depois, por exemplo).
  reservation_id  UUID REFERENCES reservations(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  kind            payment_kind NOT NULL DEFAULT 'diarias',
  amount          NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  status          payment_status NOT NULL DEFAULT 'pendente',
  method          payment_method,
  due_date        DATE,
  paid_at         TIMESTAMPTZ,
  description     TEXT,
  -- Integração com o provedor de cobrança (Asaas): id da cobrança lá e o
  -- link/QR que o cliente recebe. Ficam nulos quando a cobrança é manual.
  provider        TEXT,
  external_id     TEXT,
  external_url    TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  payments IS 'Contas a receber da locadora (sinal, diárias, caução, extras, multas).';
COMMENT ON COLUMN payments.external_id IS 'Id da cobrança no provedor (ex: Asaas). Nulo quando é cobrança manual.';
COMMENT ON COLUMN payments.status IS 'vencido é derivado do due_date por um job/consulta, não digitado à mão.';

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_reservation ON payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_due ON payments(tenant_id, due_date)
  WHERE status = 'pendente';

-- Não deixa a mesma cobrança do provedor entrar duas vezes (webhook repetido).
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_external
  ON payments(provider, external_id)
  WHERE external_id IS NOT NULL;

CREATE OR REPLACE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- FIM DA MIGRAÇÃO 002
-- ============================================================================
