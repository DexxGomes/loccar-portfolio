-- ============================================================================
--  MIGRAÇÃO 010 — ENDEREÇO DO LOCATÁRIO
--
--  O contrato de locação precisa qualificar o LOCATÁRIO com o endereço de
--  residência. Guardamos em partes (e não num texto só) para poder preencher
--  pelo CEP e para o contrato imprimir sempre no mesmo formato.
--
--  Como aplicar:  npm run db:migrate   (idempotente)
-- ============================================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS zip_code      TEXT;  -- CEP, só dígitos
ALTER TABLE customers ADD COLUMN IF NOT EXISTS street        TEXT;  -- rua/alameda/avenida
ALTER TABLE customers ADD COLUMN IF NOT EXISTS street_number TEXT;  -- número (aceita 123A, S/N)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS complement    TEXT;  -- apto, bloco, fundos…
ALTER TABLE customers ADD COLUMN IF NOT EXISTS district      TEXT;  -- bairro
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city          TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS state         TEXT;  -- UF, 2 letras

COMMENT ON COLUMN customers.zip_code      IS 'CEP com apenas dígitos (8). Preenche o resto do endereço.';
COMMENT ON COLUMN customers.street_number IS 'Número da casa/prédio. Texto porque existe 123A e S/N.';
COMMENT ON COLUMN customers.state         IS 'UF com 2 letras maiúsculas (SP, MG…).';
