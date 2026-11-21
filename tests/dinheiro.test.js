// ============================================================================
//  TESTES — RETRATO DO DINHEIRO (/api/dashboard/dinheiro)
//
//  Confere a conta que o dono vê: entrou − gastei = sobrou, mais o que está
//  em aberto hoje. Cria pagamentos, despesas e multa de teste e apaga tudo.
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
const EMAIL = `teste.dinheiro.${Date.now()}@loccar.test`;
const SENHA = '#Teste123x';
const FONE = '5599000000333';
const PLACA = 'TSTD1D1';

let servidor;
let base;
let token;
const criados = { users: [], customers: [], vehicles: [], reservations: [], payments: [], expenses: [], fines: [] };

async function get(caminho) {
  const res = await fetch(base + caminho, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', ['teste.dinheiro.%@loccar.test']);

  const hash = await bcrypt.hash(SENHA, 10);
  const u = await pool.query(
    `INSERT INTO users (tenant_id, name, email, password_hash, role)
     VALUES ($1,'Dono Dinheiro',$2,$3,'owner') RETURNING id`,
    [TENANT, EMAIL, hash]
  );
  criados.users.push(u.rows[0].id);

  const c = await pool.query(
    `INSERT INTO customers (tenant_id, name, phone) VALUES ($1,'Cliente Dinheiro',$2) RETURNING id`,
    [TENANT, FONE]
  );
  criados.customers.push(c.rows[0].id);

  const v = await pool.query(
    `INSERT INTO vehicles (tenant_id, model, plate, category, daily_rate, deposit_amount)
     VALUES ($1,'Carro Dinheiro',$2,'hatch',100,300) RETURNING id`,
    [TENANT, PLACA]
  );
  criados.vehicles.push(v.rows[0].id);

  const r = await pool.query(
    `INSERT INTO reservations
       (tenant_id, vehicle_id, customer_id, pickup_at, return_at,
        daily_rate_snapshot, deposit_snapshot, days_count, total_amount, status)
     VALUES ($1,$2,$3, now() + interval '60 days', now() + interval '62 days',
             100, 300, 2, 200, 'confirmada') RETURNING id`,
    [TENANT, v.rows[0].id, c.rows[0].id]
  );
  criados.reservations.push(r.rows[0].id);

  // Entrou: 1.000 pagos hoje. Caução: 300 pagos (não é receita).
  const p1 = await pool.query(
    `INSERT INTO payments (tenant_id, reservation_id, kind, amount, status, paid_at)
     VALUES ($1,$2,'diarias',1000,'pago', now()) RETURNING id`,
    [TENANT, r.rows[0].id]
  );
  const p2 = await pool.query(
    `INSERT INTO payments (tenant_id, reservation_id, kind, amount, status, paid_at)
     VALUES ($1,$2,'caucao',300,'pago', now()) RETURNING id`,
    [TENANT, r.rows[0].id]
  );
  // A receber: 400, sendo 150 já vencidos ontem.
  const p3 = await pool.query(
    `INSERT INTO payments (tenant_id, reservation_id, kind, amount, status, due_date)
     VALUES ($1,$2,'diarias',250,'pendente', CURRENT_DATE + 5) RETURNING id`,
    [TENANT, r.rows[0].id]
  );
  const p4 = await pool.query(
    `INSERT INTO payments (tenant_id, reservation_id, kind, amount, status, due_date)
     VALUES ($1,$2,'diarias',150,'pendente', CURRENT_DATE - 1) RETURNING id`,
    [TENANT, r.rows[0].id]
  );
  criados.payments.push(p1.rows[0].id, p2.rows[0].id, p3.rows[0].id, p4.rows[0].id);

  // Gastei: 300 hoje (200 manutenção + 100 combustível).
  const e1 = await pool.query(
    `INSERT INTO expenses (tenant_id, category, amount, date)
     VALUES ($1,'manutenção',200, CURRENT_DATE) RETURNING id`,
    [TENANT]
  );
  const e2 = await pool.query(
    `INSERT INTO expenses (tenant_id, category, amount, date)
     VALUES ($1,'combustível',100, CURRENT_DATE) RETURNING id`,
    [TENANT]
  );
  criados.expenses.push(e1.rows[0].id, e2.rows[0].id);

  // Multa pendente de repasse: 120.
  const f1 = await pool.query(
    `INSERT INTO fines (tenant_id, vehicle_id, description, amount, status)
     VALUES ($1,$2,'Velocidade - teste',120,'pendente') RETURNING id`,
    [TENANT, v.rows[0].id]
  );
  criados.fines.push(f1.rows[0].id);

  servidor = http.createServer(createApp());
  await new Promise((r2) => servidor.listen(0, r2));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador: EMAIL, senha: SENHA }),
  });
  token = (await login.json()).token;
});

after(async () => {
  for (const [tabela, ids] of [
    ['payments', criados.payments],
    ['fines', criados.fines],
    ['expenses', criados.expenses],
    ['reservations', criados.reservations],
    ['vehicles', criados.vehicles],
    ['customers', criados.customers],
    ['users', criados.users],
  ]) {
    if (ids.length) await pool.query(`DELETE FROM ${tabela} WHERE id = ANY($1::uuid[])`, [ids]);
  }
  await new Promise((r) => servidor?.close(r));
  await pool.end();
});

test('@spec:AC-024 o que entrou NÃO inclui a caução (é dinheiro do cliente, não receita)', async () => {
  const { status, body } = await get('/api/dashboard/dinheiro');
  assert.equal(status, 200);
  // Foram pagos hoje 1000 de diárias + 300 de caução. Só as diárias contam.
  assert.equal(body.entrou.valor, 1000);
  assert.equal(body.entrou.qtd, 1);
});

test('@spec:AC-025 soma os gastos do período', async () => {
  const { body } = await get('/api/dashboard/dinheiro');
  assert.equal(body.gastos.valor, 300);
  assert.equal(body.gastos.qtd, 2);
});

test('@spec:AC-026 o saldo é o que entrou menos o que saiu, sem a caução inflar', async () => {
  const { body } = await get('/api/dashboard/dinheiro');
  assert.equal(body.saldo.valor, 700, '1000 de diárias − 300 de gastos');
  assert.equal(body.saldo.positivo, true);
});

test('@spec:AC-027 separa o que falta receber e o que já venceu', async () => {
  const { body } = await get('/api/dashboard/dinheiro');
  assert.equal(body.aReceber.valor, 400, '250 a vencer + 150 vencidos');
  assert.equal(body.vencido.valor, 150, 'só o que passou da data');
  assert.equal(body.vencido.qtd, 1);
});

test('@spec:AC-028 mostra a caução que está em mãos', async () => {
  const { body } = await get('/api/dashboard/dinheiro');
  assert.equal(body.caucaoEmMaos.valor, 300);
});

test('@spec:AC-029 mostra as multas ainda não repassadas', async () => {
  const { body } = await get('/api/dashboard/dinheiro');
  assert.equal(body.multasARepassar.valor, 120);
  assert.equal(body.multasARepassar.qtd, 1);
});

test('@spec:AC-030 explica para onde foram os gastos, do maior para o menor', async () => {
  const { body } = await get('/api/dashboard/dinheiro');
  const cats = body.gastos.porCategoria;
  assert.equal(cats[0].categoria, 'manutenção');
  assert.equal(cats[0].total, 200);
  assert.equal(cats[1].categoria, 'combustível');
});

test('@spec:AC-031 período antigo sem movimento devolve zeros, não quebra', async () => {
  const de = new Date('2020-01-01').toISOString();
  const ate = new Date('2020-02-01').toISOString();
  const { status, body } = await get(`/api/dashboard/dinheiro?from=${de}&to=${ate}`);
  assert.equal(status, 200);
  assert.equal(body.entrou.valor, 0);
  assert.equal(body.gastos.valor, 0);
  assert.equal(body.saldo.valor, 0);
  assert.deepEqual(body.gastos.porCategoria, []);
});

test('@spec:AC-032 exige login', async () => {
  const res = await fetch(base + '/api/dashboard/dinheiro');
  assert.equal(res.status, 401);
});
