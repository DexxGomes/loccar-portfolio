-- ============================================================================
--  DADOS DE EXEMPLO (SEED) - apenas para desenvolvimento/testes
--
--  Aplique DEPOIS do schema.sql:
--    npm run db:seed
--  ou cole no SQL Editor do Supabase.
--
--  Cria uma locadora "demo" com id fixo e conhecido, para facilitar os testes
--  da API enquanto o login do painel não existe (use no header x-tenant-id):
--    00000000-0000-0000-0000-000000000001
-- ============================================================================

-- Locadora de demonstração (id fixo para facilitar os testes)
INSERT INTO tenants (id, name, phone_number_id, display_phone_number, subscription_status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Locadora Demo',
  'PHONE_NUMBER_ID_DEMO',      -- troque pelo phone_number_id real quando for testar o WhatsApp
  '+55 34 90000-0000',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- Alguns veículos de exemplo
INSERT INTO vehicles (tenant_id, model, plate, category, daily_rate, deposit_amount, status)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Fiat Argo 1.0',     'ABC1D23', 'hatch', 120.00,  500.00, 'disponivel'),
  ('00000000-0000-0000-0000-000000000001', 'Hyundai HB20',      'EFG2H34', 'hatch', 130.00,  500.00, 'disponivel'),
  ('00000000-0000-0000-0000-000000000001', 'Jeep Renegade',     'IJK3L45', 'SUV',       250.00, 1500.00, 'disponivel'),
  ('00000000-0000-0000-0000-000000000001', 'Toyota Corolla',    'MNO4P56', 'sedan',     220.00, 1200.00, 'manutencao')
ON CONFLICT (tenant_id, plate) DO NOTHING;
