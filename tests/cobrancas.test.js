// ============================================================================
//  TESTES — COBRANÇAS E RECEBIMENTOS
//
//  O ponto mais importante: "vencido" é DERIVADO na leitura, não gravado. Os
//  testes provam isso criando uma cobrança pendente com vencimento no passado
//  e conferindo que ela já aparece vencida, sem nenhum job ter rodado.
//
//  Locadora própria, apagada no final.
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
let servidor;
let base;
let tenantA;
let tenantB;
let tokenA;
let tokenB;
let cliente;
let reserva;

async function req(metodo, caminho, corpo, token) {
  const res = await fetch(base + caminho, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token || tokenA}`,
    },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* 204 */
  }
  return { status: res.status, body };
}

async function novaLocadora(nome) {
  const t = await pool.query(
    `INSERT INTO tenants (name, phone_number_id) VALUES ($1,$2) RETURNING id`,
    [nome, `${nome}-${marca}`]
  );
  const id = t.rows[0].id;
  const email = `${nome}.${marca}@loccar.test`.toLowerCase();
  const hash = await bcrypt.hash('#Teste123x', 10);
  await pool.query(
    `INSERT INTO users (tenant_id, name, email, password_hash, role)
     VALUES ($1,'Dono',$2,$3,'owner')`,
    [id, email, hash]
  );
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador: email, senha: '#Teste123x' }),
  });
  return { id, token: (await login.json()).token };
}

before(async () => {
  servidor = http.createServer(createApp());
  await new Promise((r) => servidor.listen(0, r));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const a = await novaLocadora('cobra');
  tenantA = a.id;
  tokenA = a.token;
  const b = await novaLocadora('cobrb');
  tenantB = b.id;
  tokenB = b.token;

  const v = await pool.query(
    `INSERT INTO vehicles (tenant_id, model, plate, category, daily_rate, deposit_amount)
     VALUES ($1,'Carro Cobranca',$2,'hatch',150,500) RETURNING id`,
    [tenantA, `CBR${String(marca).slice(-4)}`]
  );

  const c = await pool.query(
    `INSERT INTO customers (tenant_id, name, phone, cpf) VALUES ($1,'Cliente Cobranca',$2,$3) RETURNING id`,
    [tenantA, `55349${String(marca).slice(-8)}`, '52998224725']
  );
  cliente = c.rows[0].id;

  const r = await pool.query(
    `INSERT INTO reservations
       (tenant_id, vehicle_id, customer_id, pickup_at, return_at,
        daily_rate_snapshot, deposit_snapshot, days_count, total_amount, status)
     VALUES ($1,$2,$3, now() + interval '800 days', now() + interval '802 days',
             150, 500, 2, 300, 'confirmada') RETURNING id`,
    [tenantA, v.rows[0].id, cliente]
  );
  reserva = r.rows[0].id;
});

after(async () => {
  for (const id of [tenantA, tenantB]) {
    if (id) await pool.query('DELETE FROM tenants WHERE id = $1', [id]);
  }
  await new Promise((r) => servidor?.close(r));
  await pool.end();
});

// ------------------------------------------------------------- cobranças

test('@spec:AC-111 registra uma cobrança como pendente', async () => {
  const { status, body } = await req('POST', '/api/payments', {
    reservationId: reserva,
    customerId: cliente,
    kind: 'extra',
    amount: 120,
    dueDate: '2030-01-15',
    description: 'Taxa de limpeza',
  });
  assert.equal(status, 201);
  assert.equal(body.status, 'pendente');
  assert.equal(Number(body.amount), 120);
});

test('@spec:AC-113 cobrança a vencer continua pendente', async () => {
  const { body } = await req('GET', '/api/payments');
  const extra = body.pagamentos
    ? body.pagamentos.find((p) => p.description === 'Taxa de limpeza')
    : body.find((p) => p.description === 'Taxa de limpeza');
  assert.ok(extra, 'a cobrança criada precisa aparecer na lista');
  assert.equal(extra.status, 'pendente', 'vence em 2030: não pode estar vencida');
});

test('@spec:AC-112 cobrança vencida aparece como vencida, sem job nenhum', async () => {
  // Cria direto no banco com vencimento ONTEM e status pendente.
  await pool.query(
    `INSERT INTO payments (tenant_id, reservation_id, customer_id, kind, amount, status, due_date, description)
     VALUES ($1,$2,$3,'diarias',300,'pendente', CURRENT_DATE - 1, 'Diarias vencidas')`,
    [tenantA, reserva, cliente]
  );

  const { body } = await req('GET', '/api/payments');
  const lista = body.pagamentos || body;
  const vencida = lista.find((p) => p.description === 'Diarias vencidas');
  assert.ok(vencida, 'a cobrança precisa aparecer');
  assert.equal(vencida.status, 'vencido', 'pendente + venceu ontem = vencido na leitura');
});

test('@spec:AC-114 marca a cobrança como paga', async () => {
  const { body } = await req('GET', '/api/payments');
  const lista = body.pagamentos || body;
  const alvo = lista.find((p) => p.description === 'Taxa de limpeza');

  const { status, body: pago } = await req('PATCH', `/api/payments/${alvo.id}`, {
    status: 'pago',
  });
  assert.equal(status, 200);
  assert.equal(pago.status, 'pago');
});

test('@spec:AC-115 uma locadora não vê a cobrança da outra', async () => {
  const { body } = await req('GET', '/api/payments', null, tokenB);
  const lista = body.pagamentos || body;
  assert.equal(lista.length, 0, 'a locadora B não tem cobrança nenhuma');
});

// ------------------------------------------------- gerar a partir da reserva

test('@spec:AC-116 gera diárias e caução a partir da reserva', async () => {
  // Reserva nova, ainda sem cobranças.
  const v = await pool.query(
    `INSERT INTO vehicles (tenant_id, model, plate, category, daily_rate, deposit_amount)
     VALUES ($1,'Carro Gerar',$2,'sedan',200,700) RETURNING id`,
    [tenantA, `GER${String(marca).slice(-4)}`]
  );
  const r = await pool.query(
    `INSERT INTO reservations
       (tenant_id, vehicle_id, customer_id, pickup_at, return_at,
        daily_rate_snapshot, deposit_snapshot, days_count, total_amount, status)
     VALUES ($1,$2,$3, now() + interval '850 days', now() + interval '852 days',
             200, 700, 2, 400, 'confirmada') RETURNING id`,
    [tenantA, v.rows[0].id, cliente]
  );

  const { status, body } = await req('POST', `/api/payments/da-reserva/${r.rows[0].id}`);
  assert.ok([200, 201].includes(status), `HTTP ${status}`);
  assert.equal(body.length, 2, 'uma cobrança das diárias e uma da caução');

  const diarias = body.find((p) => p.kind === 'diarias');
  const caucao = body.find((p) => p.kind === 'caucao');
  assert.equal(Number(diarias.amount), 400);
  assert.equal(Number(caucao.amount), 700);
  assert.ok(diarias.due_date, 'vencimento no dia da retirada');
});

test('@spec:AC-117 não gera as cobranças da mesma reserva duas vezes', async () => {
  const { status, body } = await req('POST', `/api/payments/da-reserva/${reserva}`);
  // A reserva original já tem cobranças criadas nos testes acima.
  assert.equal(status, 409);
  assert.match(body.error, /já tem|já existe/i);
});

// ------------------------------------------------------------------- PIX

test('@spec:AC-118 sem a chave do PIX configurada, o sistema explica em vez de quebrar', async () => {
  const { body } = await req('GET', '/api/payments');
  const lista = body.pagamentos || body;
  const alvo = lista.find((p) => p.status !== 'pago');

  const { status, body: erro } = await req('POST', `/api/payments/${alvo.id}/pix`);
  assert.equal(status, 400);
  assert.match(erro.error, /PIX/i);
  assert.match(erro.error, /configurad|ativad/i, 'a mensagem tem que dizer o que fazer');
});
