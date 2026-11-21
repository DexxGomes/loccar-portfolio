-- ============================================================================
--  MIGRAÇÃO 007 — MULTAS / INFRAÇÕES
--
--  Multas de trânsito ligadas a um veículo e (quando sabido) ao locatário,
--  para a locadora controlar o repasse.
--
--  Como aplicar:  npm run db:migrate   (idempotente)
-- ============================================================================

-- Situação da multa no controle da locadora.
DO $$ BEGIN
  CREATE TYPE fine_status AS ENUM (
    'pendente',   -- registrada, ainda não repassada ao cliente
    'repassada',  -- cobrada/repassada ao cliente
    'paga'        -- cliente pagou/quitou
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS fines (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id   UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
  description  TEXT NOT NULL,                 -- ex: "Excesso de velocidade - Av. Brasil"
  amount       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  date         DATE,                          -- data da infração
  status       fine_status NOT NULL DEFAULT 'pendente',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE fines IS 'Multas/infrações por veículo, para controle de repasse ao locatário.';

CREATE INDEX IF NOT EXISTS idx_fines_tenant ON fines(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fines_vehicle ON fines(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fines_customer ON fines(customer_id);

CREATE OR REPLACE TRIGGER trg_fines_updated_at
  BEFORE UPDATE ON fines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
