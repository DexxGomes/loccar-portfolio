// ============================================================================
//  TESTES — LOGIN POR CPF (ou e-mail) E TROCA DE SENHA
//
//  São testes de integração de verdade: sobem a API em uma porta livre e
//  falam com o banco real (o mesmo do .env). Tudo que é criado aqui usa um
//  e-mail/CPF de teste e é APAGADO no final, dê certo ou dê errado.
//
//  Rodar:  npm test
// ============================================================================
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';

const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/config/db.js');

// ----------------------------------------------------------------------------
// Dados de teste (não colidem com ninguém real)
// ----------------------------------------------------------------------------
const TENANT_DEMO = '00000000-0000-0000-0000-000000000001';
const EMAIL = `teste.login.${Date.now()}@loccar.test`;
const CPF = '99988877766'; // CPF fictício, só para o teste
const SENHA_INICIAL = '#Teste123x';
const SENHA_NOVA = '#Novasenha9z';

let servidor;
let base;
let usuarioId;

/** POST simples que devolve { status, body }. */
async function post(caminho, corpo, token) {
  const res = await fetch(base + caminho, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(corpo),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* resposta sem corpo */
  }
  return { status: res.status, body };
}

const login = (identificador, senha) => post('/api/auth/login', { identificador, senha });

before(async () => {
  // Limpa restos de execuções anteriores que tenham quebrado no meio.
  await pool.query('DELETE FROM users WHERE cpf = $1 OR email LIKE $2', [
    CPF,
    'teste.login.%@loccar.test',
  ]);

  const hash = await bcrypt.hash(SENHA_INICIAL, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (tenant_id, name, email, password_hash, role, cpf, must_change_password)
     VALUES ($1, 'Usuário de Teste', $2, $3, 'owner', $4, TRUE)
     RETURNING id`,
    [TENANT_DEMO, EMAIL, hash, CPF]
  );
  usuarioId = rows[0].id;

  servidor = http.createServer(createApp());
  await new Promise((r) => servidor.listen(0, r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
  if (usuarioId) await pool.query('DELETE FROM users WHERE id = $1', [usuarioId]);
  await new Promise((r) => servidor?.close(r));
  await pool.end();
});

// ----------------------------------------------------------------------------
// Entrar
// ----------------------------------------------------------------------------

test('@spec:AC-001 entra com o CPF (só números) e recebe token', async () => {
  const { status, body } = await login(CPF, SENHA_INICIAL);
  assert.equal(status, 200);
  assert.ok(body.token, 'deveria vir um token');
  assert.equal(body.user.email, EMAIL);
  assert.equal(body.tenant.name, 'LocCar');
});

test('@spec:AC-002 entra com o CPF digitado com pontos e traço (como aparece na tela)', async () => {
  const mascarado = '999.888.777-66';
  const { status, body } = await login(mascarado, SENHA_INICIAL);
  assert.equal(status, 200);
  assert.ok(body.token);
});

test('@spec:AC-003 entra pelo e-mail, aceitando maiúsculas e espaços sobrando', async () => {
  const { status, body } = await login(`  ${EMAIL.toUpperCase()}  `, SENHA_INICIAL);
  assert.equal(status, 200);
  assert.ok(body.token);
});

test('@spec:AC-007 avisa que a senha precisa ser trocada no primeiro acesso', async () => {
  const { body } = await login(CPF, SENHA_INICIAL);
  assert.equal(body.user.mustChangePassword, true);
});

test('@spec:AC-004 senha errada não entra, e a mensagem não entrega se o CPF existe', async () => {
  const { status, body } = await login(CPF, 'senha-errada');
  assert.equal(status, 401);
  const inexistente = await login('11122233344', 'senha-errada');
  assert.equal(inexistente.status, 401);
  // Mesma mensagem nos dois casos: não dá pra descobrir quem é cliente.
  assert.equal(body.error, inexistente.body.error);
});

test('@spec:AC-005 sem senha, responde 400 pedindo os dados', async () => {
  const { status } = await login(CPF, '');
  assert.equal(status, 400);
});

test('@spec:AC-006 usuário desativado não entra', async () => {
  await pool.query('UPDATE users SET is_active = FALSE WHERE id = $1', [usuarioId]);
  const { status } = await login(CPF, SENHA_INICIAL);
  await pool.query('UPDATE users SET is_active = TRUE WHERE id = $1', [usuarioId]);
  assert.equal(status, 401);
});

// ----------------------------------------------------------------------------
// Trocar a senha
// ----------------------------------------------------------------------------

test('@spec:AC-008 não troca a senha sem estar logado', async () => {
  const { status } = await post('/api/auth/change-password', {
    senhaAtual: SENHA_INICIAL,
    novaSenha: SENHA_NOVA,
  });
  assert.equal(status, 401);
});

test('@spec:AC-009 não troca a senha informando a senha atual errada', async () => {
  const { body: sessao } = await login(CPF, SENHA_INICIAL);
  const { status } = await post(
    '/api/auth/change-password',
    { senhaAtual: 'nao-e-essa', novaSenha: SENHA_NOVA },
    sessao.token
  );
  assert.equal(status, 401);
});

test('@spec:AC-010 recusa nova senha curta demais', async () => {
  const { body: sessao } = await login(CPF, SENHA_INICIAL);
  const { status } = await post(
    '/api/auth/change-password',
    { senhaAtual: SENHA_INICIAL, novaSenha: '123' },
    sessao.token
  );
  assert.equal(status, 400);
});

test('@spec:AC-011 troca a senha, limpa a marca de primeiro acesso e passa a valer a nova', async () => {
  const { body: sessao } = await login(CPF, SENHA_INICIAL);
  const troca = await post(
    '/api/auth/change-password',
    { senhaAtual: SENHA_INICIAL, novaSenha: SENHA_NOVA },
    sessao.token
  );
  assert.equal(troca.status, 200);

  // A marca caiu no banco...
  const { rows } = await pool.query('SELECT must_change_password FROM users WHERE id = $1', [
    usuarioId,
  ]);
  assert.equal(rows[0].must_change_password, false);

  // ...a senha nova entra...
  const nova = await login(CPF, SENHA_NOVA);
  assert.equal(nova.status, 200);
  assert.equal(nova.body.user.mustChangePassword, false);

  // ...e a antiga não entra mais.
  const antiga = await login(CPF, SENHA_INICIAL);
  assert.equal(antiga.status, 401);
});

// ----------------------------------------------------------------------------
// Regra do banco
// ----------------------------------------------------------------------------

test('@spec:AC-012 o mesmo CPF não pode ficar em dois usuários', async () => {
  const hash = await bcrypt.hash('qualquer-uma', 10);
  await assert.rejects(
    () =>
      pool.query(
        `INSERT INTO users (tenant_id, name, email, password_hash, role, cpf)
         VALUES ($1, 'Clone', $2, $3, 'owner', $4)`,
        [TENANT_DEMO, `clone.${EMAIL}`, hash, CPF]
      ),
    /duplicate key|unique/i
  );
});
