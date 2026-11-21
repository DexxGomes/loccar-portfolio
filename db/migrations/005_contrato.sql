-- ============================================================================
--  MIGRAÇÃO 005 — CONTRATO DE LOCAÇÃO
--
--  Dados legais da locadora (para o cabeçalho do contrato) + cláusulas
--  editáveis por locadora + marca de aceite do contrato na reserva.
--
--  Como aplicar:  npm run db:migrate   (idempotente)
-- ============================================================================

-- Dados legais da locadora (usados no contrato e em documentos formais).
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS legal_name    TEXT;  -- razão social
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cnpj          TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address       TEXT;  -- endereço completo
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contract_terms TEXT; -- cláusulas do contrato (se vazio, usa o padrão do sistema)

COMMENT ON COLUMN tenants.contract_terms IS 'Cláusulas do contrato de locação (texto). Se nulo, o sistema usa um modelo padrão.';

-- Aceite do contrato pelo cliente (registrado pelo dono quando confirmado).
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS contract_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN reservations.contract_accepted_at IS 'Quando o contrato foi aceito pelo cliente (registro do dono).';
