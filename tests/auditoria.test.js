// ============================================================================
//  TESTES — REGISTRO DE AUDITORIA (LGPD art. 37)
//
//  O que estes testes protegem é a resposta para a pergunta do pior dia:
//  "vazou — foi invasão ou foi alguém de dentro?". Sem registro, a resposta é
//  "não sei", e "não sei" é a pior coisa a dizer para a ANPD e para o cliente.
//
//  Um dos testes é tão importante quanto os outros pelo motivo oposto: o
//  registro NÃO pode guardar o dado que ele deveria proteger. A busca do
//  painel manda CPF em ?search=, e auditoria que grava isso é um segundo
//  vazamento.
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

const marca = Date.now();
let servidor, base, token;
const criado = {};

async function req(metodo, caminho) {
  const res = await fetch(base + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  return res.status;
}

/** O middleware grava em 'finish', logo depois da resposta sair. */
async function esperarGravacao() {
  await new Promise((r) => setTimeout(r, 400));
}

const acessos = async (extra = '') =>
  (await pool.query(
    `SELECT * FROM audit_log WHERE tenant_id = $1 ${extra} ORDER BY created_at DESC`,
    [criado.tenant]
  )).rows;

before(async () => {
  servidor = http.createServer(createApp());
  await new Promise((r) => servidor.listen(0, r));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const t = await pool.query(
    `INSERT INTO tenants (name, phone_number_id) VALUES ($1,$2) RETURNING id`,
    [`Auditoria ${marca}`, `audit-${marca}`]
  );
  criado.tenant = t.rows[0].id;

  const email = `auditoria.${marca}@loccar.test`.toLowerCase();
  criado.email = email;
  const hash = await bcrypt.hash('#Teste123x', 10);
  await pool.query(
    `INSERT INTO users (tenant_id, name, email, password_hash, role)
     VALUES ($1,'Dono Auditoria',$2,$3,'owner')`,
    [criado.tenant, email, hash]
  );
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador: email, senha: '#Teste123x' }),
  });
  token = (await login.json()).token;

  const c = await pool.query(
    `INSERT INTO customers (tenant_id, name, phone) VALUES ($1,'Cliente Auditado',$2) RETURNING id`,
    [criado.tenant, `5534${String(marca).slice(-7)}`]
  );
  criado.cliente = c.rows[0].id;
});

after(async () => {
  if (criado.tenant) await pool.query('DELETE FROM tenants WHERE id = $1', [criado.tenant]);
  await new Promise((r) => servidor.close(r));
  await pool.end();
});

test('@spec:AC-153 abrir a ficha de um cliente fica registrado, com quem abriu', async () => {
  const status = await req('GET', `/api/customers/${criado.cliente}`);
  assert.equal(status, 200);
  await esperarGravacao();

  const linhas = await acessos();
  const meu = linhas.find((l) => l.recurso_id === criado.cliente);
  assert.ok(meu, 'o acesso à ficha do cliente não foi registrado');
  assert.equal(meu.recurso, 'customer');
  assert.equal(meu.user_email, criado.email, 'o registro precisa dizer QUEM acessou');
  assert.ok(meu.acao, 'o registro precisa dizer o que foi feito');
});

test('@spec:AC-154 o registro NÃO guarda o que foi buscado (CPF vai na query)', async () => {
  await req('GET', '/api/customers?search=12345678901');
  await esperarGravacao();

  const linhas = await acessos();
  const texto = JSON.stringify(linhas);
  assert.ok(
    !texto.includes('12345678901'),
    'a auditoria guardou o CPF buscado — seria um segundo vazamento'
  );
});

test('@spec:AC-155 acesso que falhou não vira registro', async () => {
  const antes = (await acessos()).length;
  const status = await req('GET', '/api/customers/00000000-0000-0000-0000-000000000009');
  assert.equal(status, 404);
  await esperarGravacao();

  assert.equal((await acessos()).length, antes, '404 não é acesso a dado e não deve ser registrado');
});

test('@spec:AC-156 uma locadora não lê o registro de auditoria da outra', async () => {
  const outra = await pool.query(
    `INSERT INTO tenants (name, phone_number_id) VALUES ($1,$2) RETURNING id`,
    [`AuditOutra ${marca}`, `audit-outra-${marca}`]
  );
  const outroId = outra.rows[0].id;
  try {
    const { listarAcessos } = await import('../src/repositories/auditRepository.js');
    const lista = await listarAcessos(outroId);
    assert.equal(lista.length, 0, 'a locadora nova não pode ver acesso de ninguém');
  } finally {
    await pool.query('DELETE FROM tenants WHERE id = $1', [outroId]);
  }
});

test('@spec:AC-157 o registro sobrevive à saída do funcionário', async () => {
  // Se bastasse apagar o usuário para o rastro sumir, a auditoria não serviria
  // justamente no caso em que ela mais importa.
  const u = await pool.query(
    `INSERT INTO users (tenant_id, name, email, password_hash, role)
     VALUES ($1,'Temporario',$2,'x','owner') RETURNING id`,
    [criado.tenant, `temp.${marca}@loccar.test`]
  );
  const userId = u.rows[0].id;

  await pool.query(
    `INSERT INTO audit_log (tenant_id, user_id, user_email, acao, recurso, recurso_id)
     VALUES ($1,$2,$3,'abriu a ficha','customer',$4)`,
    [criado.tenant, userId, `temp.${marca}@loccar.test`, criado.cliente]
  );

  await pool.query('DELETE FROM users WHERE id = $1', [userId]);

  const linhas = await acessos();
  const doTemp = linhas.find((l) => l.user_email === `temp.${marca}@loccar.test`);
  assert.ok(doTemp, 'apagar o usuário apagou o rastro dele');
  assert.equal(doTemp.user_id, null, 'o vínculo some, mas o registro e o e-mail ficam');
});
