// ============================================================================
//  TESTES — A PORTA LATERAL DO SUPABASE CONTINUA FECHADA
//
//  Todo projeto Supabase publica uma API REST automática das tabelas, e quem
//  fala com ela é o papel `anon` — cuja chave é PÚBLICA por desenho. O que
//  protege os dados ali é o RLS.
//
//  Este arquivo existe porque o buraco é silencioso: uma tabela nova criada
//  numa migração futura nasce sem RLS e ninguém percebe até vazar. Aqui a
//  suíte quebra na hora.
//
//  Rodar:  npm test
// ============================================================================
import test, { after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const { pool } = await import('../src/config/db.js');

after(async () => {
  await pool.end();
});

test('@spec:AC-144 toda tabela do schema public tem RLS ligado', async () => {
  const { rows } = await pool.query(
    `SELECT c.relname AS tabela
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
      ORDER BY c.relname`
  );
  assert.deepEqual(
    rows.map((r) => r.tabela),
    [],
    'tabela sem RLS fica exposta na API pública do Supabase — rode: npm run db:migrate'
  );
});

test('@spec:AC-145 anon e authenticated não têm permissão em tabela nenhuma', async () => {
  const { rows } = await pool.query(
    `SELECT grantee, table_name, privilege_type
       FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
      ORDER BY grantee, table_name`
  );
  assert.deepEqual(
    rows.map((r) => `${r.grantee}:${r.table_name}:${r.privilege_type}`),
    [],
    'quem entra pela API pública do Supabase não pode ter acesso a tabela nenhuma'
  );
});

test('@spec:AC-146 não existe política que reabra o acesso sem querer', async () => {
  // Nenhum cliente legítimo entra por essa porta: o painel fala com a nossa
  // API, e a API fala com o Postgres direto. Política aqui só poderia ser
  // engano — e engano que abre dado de cliente.
  const { rows } = await pool.query(
    `SELECT tablename, policyname, roles::text AS papeis
       FROM pg_policies WHERE schemaname = 'public'`
  );
  assert.deepEqual(
    rows.map((r) => `${r.tablename}.${r.policyname} (${r.papeis})`),
    [],
    'apareceu política de RLS: confira se ela não abre dado para anon'
  );
});

test('@spec:AC-147 a aplicação continua enxergando os dados', async () => {
  // O contrapeso dos três testes acima: fechar demais também seria defeito.
  // A app conecta como um papel com BYPASSRLS, então tem que ler normalmente.
  const { rows } = await pool.query(
    'SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user'
  );
  assert.equal(
    rows[0]?.rolbypassrls,
    true,
    'se o papel da aplicação deixar de ignorar RLS, o sistema inteiro para (sem políticas, nada passa)'
  );

  const veiculos = await pool.query('SELECT count(*)::int AS n FROM vehicles');
  assert.ok(Number.isInteger(veiculos.rows[0].n), 'a consulta precisa funcionar');
});
