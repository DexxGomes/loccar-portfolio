// ============================================================================
//  TESTES — GUIA DE PRIMEIROS PASSOS
//
//  O ponto do guia é se marcar SOZINHO. Estes testes mudam o cadastro da
//  locadora e conferem que o passo correspondente vira "feito" sem ninguém
//  clicar em nada. O estado original do tenant é restaurado no final.
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

const TENANT = '00000000-0000-0000-0000-000000000001';
const EMAIL = `teste.passos.${Date.now()}@loccar.test`;
const SENHA = '#Teste123x';

let servidor;
let base;
let token;
let userId;
let tenantOriginal;

async function passos() {
  const res = await fetch(base + '/api/dashboard/primeiros-passos', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  return { status: res.status, body, passo: (id) => body.passos.find((p) => p.id === id) };
}

before(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', ['teste.passos.%@loccar.test']);

  const { rows } = await pool.query(
    'SELECT legal_name, cnpj, address, owner_alert_phone FROM tenants WHERE id = $1',
    [TENANT]
  );
  tenantOriginal = rows[0];

  const hash = await bcrypt.hash(SENHA, 10);
  const u = await pool.query(
    `INSERT INTO users (tenant_id, name, email, password_hash, role)
     VALUES ($1,'Dono Passos',$2,$3,'owner') RETURNING id`,
    [TENANT, EMAIL, hash]
  );
  userId = u.rows[0].id;

  servidor = http.createServer(createApp());
  await new Promise((r) => servidor.listen(0, r));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador: EMAIL, senha: SENHA }),
  });
  token = (await login.json()).token;
});

after(async () => {
  // Devolve o cadastro da locadora exatamente como estava.
  await pool.query(
    `UPDATE tenants SET legal_name = $2, cnpj = $3, address = $4, owner_alert_phone = $5
      WHERE id = $1`,
    [
      TENANT,
      tenantOriginal.legal_name,
      tenantOriginal.cnpj,
      tenantOriginal.address,
      tenantOriginal.owner_alert_phone,
    ]
  );
  if (userId) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await new Promise((r) => servidor?.close(r));
  await pool.end();
});

test('@spec:AC-033 lista os passos com progresso e exige login', async () => {
  const semLogin = await fetch(base + '/api/dashboard/primeiros-passos');
  assert.equal(semLogin.status, 401);

  const { status, body } = await passos();
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.passos) && body.passos.length > 0);
  assert.equal(body.total, body.passos.length);
  assert.equal(
    body.concluidos,
    body.passos.filter((p) => p.feito).length,
    'o contador tem que bater com os passos marcados'
  );
});

test('@spec:AC-034 o passo dos dados do contrato se marca sozinho quando o cadastro fica completo', async () => {
  await pool.query(
    'UPDATE tenants SET legal_name = NULL, cnpj = NULL, address = NULL WHERE id = $1',
    [TENANT]
  );
  const antes = await passos();
  assert.equal(antes.passo('dados').feito, false, 'sem os dados, o passo está aberto');

  await pool.query(
    `UPDATE tenants SET legal_name = 'LocCar Teste LTDA', cnpj = '00000000000191',
            address = 'Rua Teste, 1 - Centro' WHERE id = $1`,
    [TENANT]
  );
  const depois = await passos();
  assert.equal(depois.passo('dados').feito, true, 'preencheu os três campos: passo fechado');
  assert.equal(depois.body.concluidos, antes.body.concluidos + 1);
});

test('@spec:AC-035 preencher só parte dos dados não marca o passo', async () => {
  await pool.query(
    'UPDATE tenants SET legal_name = $2, cnpj = NULL, address = NULL WHERE id = $1',
    [TENANT, 'Só a razão social']
  );
  const { passo } = await passos();
  assert.equal(passo('dados').feito, false);
});

test('@spec:AC-036 o aviso no celular é opcional e não segura o guia', async () => {
  const { passo } = await passos();
  assert.equal(passo('aviso').opcional, true);
});

test('@spec:AC-037 o passo da frota conta os veículos que existem', async () => {
  const { rows } = await pool.query('SELECT COUNT(*)::int n FROM vehicles WHERE tenant_id = $1', [
    TENANT,
  ]);
  const { passo } = await passos();
  const frota = passo('frota');
  assert.equal(frota.feito, rows[0].n > 0);
  if (rows[0].n > 0) assert.match(frota.detalhe, /veículo/);
});

test('@spec:AC-038 todo passo em aberto diz por que existe e para onde ir', async () => {
  const { body } = await passos();
  for (const p of body.passos) {
    assert.ok(p.titulo, 'passo sem título');
    assert.ok(p.porque, `passo ${p.id} sem explicação`);
    assert.ok(p.para?.startsWith('/'), `passo ${p.id} sem destino`);
    assert.ok(p.acao, `passo ${p.id} sem texto de botão`);
  }
});
