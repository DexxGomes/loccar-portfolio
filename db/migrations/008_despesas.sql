-- ============================================================================
--  MIGRAÇÃO 008 — DESPESAS (para fluxo de caixa)
--
--  Saídas de dinheiro da locadora (manutenção, combustível, seguro, salários…).
--  Junto com a receita das reservas, formam o fluxo de caixa.
--
--  Como aplicar:  npm run db:migrate   (idempotente)
-- ============================================================================

CREATE TABLE IF NOT EXISTS expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id   UUID REFERENCES vehicles(id) ON DELETE SET NULL,  -- despesa ligada a um carro (opcional)
  category     TEXT NOT NULL,                 -- ex: manutenção, combustível, seguro, salários...
  description  TEXT,
  amount       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  date         DATE NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE expenses IS 'Despesas da locadora (saídas), usadas no fluxo de caixa.';

CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date ON expenses(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_vehicle ON expenses(vehicle_id);
