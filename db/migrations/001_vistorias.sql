-- ============================================================================
--  MIGRAÇÃO 001 — VISTORIA DIGITAL (check-in / check-out)
--
--  Registra o estado do veículo na ENTREGA e na DEVOLUÇÃO: quilometragem,
--  combustível, avarias marcadas no desenho do carro e fotos.
--  É o que evita a discussão "esse risco já estava aí".
--
--  Como aplicar:
--    npm run db:migrate:vistorias
--  (ou cole no SQL Editor do Supabase)
--
--  Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================================

-- Momento da vistoria
DO $$ BEGIN
  CREATE TYPE inspection_type AS ENUM ('retirada', 'devolucao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- TABELA: inspections (uma vistoria por momento de cada reserva)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id  UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  type            inspection_type NOT NULL,
  -- Quilometragem do painel no momento da vistoria
  odometer        INTEGER CHECK (odometer >= 0),
  -- Combustível em OITAVOS do tanque (0 = vazio, 4 = metade, 8 = cheio).
  -- Oitavos são as marcas do próprio ponteiro — mais honesto que "litros".
  fuel_level      SMALLINT CHECK (fuel_level BETWEEN 0 AND 8),
  -- Avarias marcadas no desenho: [{ x, y, parte, gravidade, descricao }]
  -- x e y são percentuais (0–100) sobre a figura, então a marca continua no
  -- lugar certo em qualquer tamanho de tela.
  damages         JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes           TEXT,
  -- Nome de quem estava presente (cliente ou funcionário) na conferência
  signed_by       TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Uma vistoria de retirada e uma de devolução por reserva
  UNIQUE (reservation_id, type)
);

COMMENT ON TABLE  inspections IS 'Vistorias de retirada e devolução do veículo.';
COMMENT ON COLUMN inspections.fuel_level IS 'Nível do tanque em oitavos (0 a 8), como as marcas do ponteiro.';
COMMENT ON COLUMN inspections.damages IS 'Avarias marcadas no desenho do carro; x/y em percentual da figura.';

CREATE INDEX IF NOT EXISTS idx_inspections_reservation ON inspections(reservation_id);
CREATE INDEX IF NOT EXISTS idx_inspections_tenant ON inspections(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspections_vehicle ON inspections(vehicle_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- TABELA: inspection_photos (fotos da vistoria, no bucket PRIVADO)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspection_photos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inspection_id  UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  -- frente, traseira, lateral_esquerda, lateral_direita, painel, extra
  position       TEXT NOT NULL,
  storage_path   TEXT NOT NULL,   -- caminho no bucket privado (nunca URL pública)
  mime_type      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE inspection_photos IS 'Fotos de cada vistoria; acesso apenas por URL assinada temporária.';

CREATE INDEX IF NOT EXISTS idx_inspection_photos_inspection ON inspection_photos(inspection_id);

-- ============================================================================
-- FIM DA MIGRAÇÃO 001
-- ============================================================================
