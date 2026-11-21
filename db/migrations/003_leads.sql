-- ============================================================================
--  MIGRAÇÃO 003 — LEADS (funil de possíveis clientes da locadora)
--
--  Um lead é alguém que demonstrou interesse mas ainda não virou locação:
--  veio pelo WhatsApp, indicação, Instagram, site. O funil (kanban) acompanha
--  o lead do primeiro contato até fechar (ganho) ou desistir (perdido).
--
--  Como aplicar:
--    npm run db:migrate
--
--  Idempotente: pode rodar mais de uma vez.
-- ============================================================================

-- Etapa do lead no funil (as colunas do kanban, na ordem).
DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM (
    'novo',         -- entrou agora, ainda não trabalhado
    'qualificado',  -- tem perfil e interesse reais
    'negociacao',   -- conversando preço/período/veículo
    'ganho',        -- virou cliente/locação
    'perdido'       -- desistiu ou não fechou
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- TABELA: leads
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  phone            TEXT,                        -- E.164 ou como veio na planilha
  email            TEXT,
  source           TEXT,                        -- origem: whatsapp, indicação, instagram, site...
  status           lead_status NOT NULL DEFAULT 'novo',
  estimated_value  NUMERIC(10,2),               -- valor estimado do negócio (opcional)
  notes            TEXT,                        -- anotações internas
  -- Posição dentro da coluna (menor = mais no topo). Permite reordenar sem
  -- depender só da data de criação.
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  leads IS 'Funil de possíveis clientes da locadora (kanban de leads).';
COMMENT ON COLUMN leads.source IS 'De onde o lead veio: whatsapp, indicação, instagram, site, etc.';
COMMENT ON COLUMN leads.estimated_value IS 'Valor estimado do negócio, se conhecido. Opcional.';

CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status ON leads(tenant_id, status);

CREATE OR REPLACE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
