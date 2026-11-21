-- ============================================================================
--  MIGRAÇÃO 006 — MANUTENÇÃO DA FROTA
--
--  Campos de controle do veículo (km e vencimentos de documentos) + histórico
--  de manutenções (revisões, trocas, etc.).
--
--  Como aplicar:  npm run db:migrate   (idempotente)
-- ============================================================================

-- Campos de controle no próprio veículo.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS odometer       INTEGER;  -- km atual
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ipva_due       DATE;     -- vencimento do IPVA
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS licensing_due  DATE;     -- vencimento do licenciamento
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS insurance_due  DATE;     -- vencimento do seguro
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS next_revision_km INTEGER; -- km da próxima revisão

-- ----------------------------------------------------------------------------
-- TABELA: maintenance_records (histórico de manutenções do veículo)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  type        TEXT NOT NULL,           -- ex: revisão, troca de óleo, pneus, freios...
  odometer    INTEGER,                 -- km no momento do serviço
  cost        NUMERIC(10,2),           -- custo do serviço
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE maintenance_records IS 'Histórico de manutenções/serviços por veículo.';

CREATE INDEX IF NOT EXISTS idx_maintenance_tenant ON maintenance_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance_records(vehicle_id, date DESC);
