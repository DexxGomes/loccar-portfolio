// ============================================================================
//  TESTES — AS MENSAGENS DE ERRO FALAM PORTUGUÊS DE GENTE
//
//  O painel mostra só o campo `error` da resposta. Então esse campo precisa
//  dizer, sozinho, o que a pessoa tem que corrigir — sem jargão de banco de
//  dados e sem palavra em inglês.
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
const EMAIL = `teste.erros.${Date.now()}@loccar.test`;
const SENHA = '#Teste123x';
const PLACA = `ERR${String(Date.now()).slice(-4)}`;

let servidor;
let base;
let token;
let userId;
let vehicleId;

async function post(caminho, corpo) {
  const res = await fetch(base + caminho, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(corpo),
  });
  return { status: res.status, body: await res.json() };
}

/** Nenhuma mensagem pode ter jargão técnico ou palavra em inglês. */
function ehDeGente(msg) {
  const proibido = [
    'required', 'expected', 'invalid_', 'unique', 'constraint', 'sqlstate',
    'null', 'undefined', 'string', 'number', 'violation', 'duplicat',
  ];
  const m = String(msg).toLowerCase();
  return !proibido.some((p) => m.includes(p));
}

before(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', ['teste.erros.%@loccar.test']);
  const hash = await bcrypt.hash(SENHA, 10);
  const u = await pool.query(
    `INSERT INTO users (tenant_id, name, email, password_hash, role)
     VALUES ($1,'Dono Erros',$2,$3,'owner') RETURNING id`,
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
  if (vehicleId) await pool.query('DELETE FROM vehicles WHERE id = $1', [vehicleId]);
  if (userId) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await new Promise((r) => servidor?.close(r));
  await pool.end();
});

test('@spec:AC-039 @principle:P-003 esquecer a placa diz QUAL campo falta, em português', async () => {
  const { status, body } = await post('/api/vehicles', {
    model: 'Carro sem placa',
    category: 'hatch',
    daily_rate: 100,
  });
  assert.equal(status, 400);
  assert.match(body.error, /placa/i, 'a mensagem tem que citar a placa');
  assert.ok(ehDeGente(body.error), `mensagem com jargão: "${body.error}"`);
});

test('@spec:AC-040 quando falta mais de um campo, avisa quantos faltam', async () => {
  const { body } = await post('/api/vehicles', { model: 'Só o modelo' });
  assert.match(body.error, /mais \d+ campo/i, `esperava o aviso de quantidade: "${body.error}"`);
  assert.ok(ehDeGente(body.error.replace(/\(e mais \d+ campo\(s\) para revisar\)/, '')));
});

test('@spec:AC-041 valor de diária que não é número explica isso', async () => {
  const { status, body } = await post('/api/vehicles', {
    model: 'Carro',
    plate: 'ABC1234',
    category: 'hatch',
    daily_rate: 'cento e cinquenta',
  });
  assert.equal(status, 400);
  assert.match(body.error, /diária/i);
  assert.match(body.error, /número/i);
});

test('@spec:AC-042 categoria que não existe lista as que existem', async () => {
  const { body } = await post('/api/vehicles', {
    model: 'Carro',
    plate: 'ABC1235',
    category: 'foguete',
    daily_rate: 100,
  });
  assert.match(body.error, /hatch|categoria/i);
  assert.ok(ehDeGente(body.error), `mensagem com jargão: "${body.error}"`);
});

test('@spec:AC-043 placa repetida diz que a placa já existe (e não "registro duplicado")', async () => {
  const primeiro = await post('/api/vehicles', {
    model: 'Fiat Argo',
    plate: PLACA,
    category: 'hatch',
    daily_rate: 120,
  });
  assert.equal(primeiro.status, 201);
  vehicleId = primeiro.body.id;

  const repetido = await post('/api/vehicles', {
    model: 'Outro carro',
    plate: PLACA,
    category: 'sedan',
    daily_rate: 200,
  });
  assert.equal(repetido.status, 409);
  assert.match(repetido.body.error, /placa/i, `esperava falar de placa: "${repetido.body.error}"`);
  assert.ok(ehDeGente(repetido.body.error), `mensagem com jargão: "${repetido.body.error}"`);
});

test('@spec:AC-044 link com identificador quebrado explica sem falar de banco de dados', async () => {
  const res = await fetch(base + '/api/vehicles/isso-nao-e-um-id', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  assert.ok([400, 404].includes(res.status));
  assert.ok(ehDeGente(body.error), `mensagem com jargão: "${body.error}"`);
});
