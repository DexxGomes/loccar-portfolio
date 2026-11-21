-- ============================================================================
--  014 — REGISTRO DE AUDITORIA (quem olhou o dado de quem, e quando)
--
--  POR QUE EXISTE
--  A LGPD (art. 37) pede que o controlador mantenha registro das operações de
--  tratamento de dados pessoais. Na prática, é o que responde a pergunta que
--  aparece no pior dia: "os dados vazaram — foi invasão ou foi alguém de
--  dentro?". Sem registro, a resposta honesta é "não sei", e "não sei" é a
--  pior coisa para se dizer à ANPD e ao cliente.
--
--  Também serve no dia comum: funcionário desligado que andou baixando ficha
--  de cliente na última semana aparece aqui.
--
--  O QUE ENTRA
--  Só o acesso a DADO PESSOAL: abrir ficha de cliente, ver documento, ler
--  conversa, apagar dados (LGPD), gerar contrato. Não registramos navegação
--  boba (listar veículos, ver o painel) — registro que cresce sem informação
--  vira palheiro onde ninguém acha agulha.
--
--  O QUE NÃO ENTRA, DE PROPÓSITO
--  A query string. A busca do painel manda CPF e telefone em ?search=, e um
--  registro de auditoria que guarda o dado que ele deveria proteger é um
--  segundo vazamento esperando acontecer.
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Quem. Fica NULL se o usuário for apagado: o registro do acesso tem que
  -- sobreviver à saída da pessoa, senão bastaria demitir para limpar o rastro.
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email  TEXT,                      -- cópia do e-mail na hora do acesso
  acao        TEXT NOT NULL,             -- 'abriu_cliente', 'viu_documento'...
  recurso     TEXT,                      -- 'customer', 'reservation'...
  recurso_id  UUID,                      -- qual registro
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE audit_log IS
  'Registro de acesso a dado pessoal (LGPD art. 37). Nunca guarda o conteúdo acessado nem a query string.';

-- Consulta típica: "o que fulano andou vendo" e "quem viu a ficha deste cliente".
CREATE INDEX IF NOT EXISTS idx_audit_tenant_data ON audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_usuario     ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_recurso     ON audit_log(recurso, recurso_id);

-- Mesma trava das outras tabelas (ver migração 013).
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON audit_log FROM anon, authenticated;
