-- ============================================================================
--  MIGRAÇÃO 009 — LOGIN POR CPF
--
--  Login do painel passa a aceitar CPF (além do e-mail, por compatibilidade).
--  Guarda o telefone (WhatsApp) do usuário para recuperação futura, e a marca
--  "precisa trocar a senha" para forçar a troca no primeiro acesso.
--
--  Como aplicar:  npm run db:migrate   (idempotente)
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf                  TEXT;   -- apenas dígitos
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone                TEXT;   -- WhatsApp p/ recuperação
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- CPF único entre os usuários (quando informado) — o login por CPF precisa
-- resolver para um único usuário.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_cpf ON users(cpf) WHERE cpf IS NOT NULL;

COMMENT ON COLUMN users.cpf IS 'CPF (só dígitos) usado como login. Único quando preenchido.';
COMMENT ON COLUMN users.must_change_password IS 'Quando TRUE, o painel força a troca da senha no primeiro acesso.';
