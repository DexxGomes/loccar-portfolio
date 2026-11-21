-- ============================================================================
--  MIGRAÇÃO 004 — AVISO AO DONO
--
--  Telefone do dono para receber avisos de "precisa de humano" (via WhatsApp).
--  Fica separado do número da locadora: o alerta é enviado PARA esse número.
--
--  Como aplicar:  npm run db:migrate   (idempotente)
-- ============================================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_alert_phone TEXT;

COMMENT ON COLUMN tenants.owner_alert_phone IS
  'Telefone (E.164, só dígitos) do dono para receber avisos de atendimento humano no WhatsApp.';
