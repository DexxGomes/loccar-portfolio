-- ============================================================================
--  013 — FECHA A PORTA LATERAL DO SUPABASE (RLS + revogação)
--
--  O RISCO QUE ISTO EVITA
--  Todo projeto Supabase publica uma API REST automática das tabelas
--  (PostgREST) em https://<projeto>.supabase.co/rest/v1/. Quem fala com ela é
--  o papel `anon`, e a chave `anon` é PÚBLICA POR DESENHO — a Supabase manda
--  colocá-la no front-end, e o que protege os dados é o RLS.
--
--  Tabela criada por SQL (como as deste projeto) nasce com o RLS DESLIGADO, e
--  as permissões padrão do schema public dão a `anon` leitura e escrita nela.
--  Se ninguém fechar essa porta, a única coisa entre a internet e o CPF, a CNH
--  e as conversas dos clientes passa a ser o segredo de uma chave que não foi
--  feita para ser secreta.
--
--  POR QUE NÃO QUEBRA NADA
--  A aplicação não usa essa API. Ela fala com o Postgres direto (pg), como
--  `postgres`, que tem BYPASSRLS — RLS não se aplica a ele. E o Supabase só é
--  usado para ARQUIVOS (schema storage), com a chave de serviço. Conferido
--  antes de escrever isto: não existe uma chamada de tabela via Supabase no
--  código.
--
--  A DEFESA É EM DUAS CAMADAS
--    1. RLS ligado sem nenhuma política = nega tudo por padrão. Mesmo que
--       alguém conceda permissão por engano amanhã, sem política não passa.
--    2. Permissões revogadas de anon/authenticated = nem chega a consultar.
--  Uma sozinha bastaria; as duas juntas cobrem o erro humano da outra.
--
--  Idempotente: pode rodar quantas vezes quiser.
-- ============================================================================

-- 1) RLS em toda tabela do schema public, inclusive as que vierem depois.
DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;

-- 2) Tira o acesso de quem fala pela API pública.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 3) Tabela criada de agora em diante já nasce fechada — senão a migração 014
--    reabriria a porta sem ninguém perceber.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- Nota deliberada: NÃO criamos políticas. Política nenhuma = ninguém passa,
-- que é exatamente o que queremos, porque nenhum cliente legítimo entra por
-- essa porta. O isolamento entre locadoras continua sendo feito na aplicação
-- (todo repositório filtra por tenant_id, e há teste provando).
