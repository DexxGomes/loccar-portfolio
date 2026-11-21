// ============================================================================
//  TESTES — FROTA
//
//  Cobrem o cadastro, as regras de categoria e placa, o congelamento do preço
//  na reserva, e o histórico de manutenção. Criam uma SEGUNDA locadora para
//  provar o isolamento (uma não enxerga o veículo da outra).
//
//  Tudo que é criado aqui é apagado no final.
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

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const marca = Date.now();
const PLACA = `FRT${String(marca).slice(-4)}`;

let servidor;
let base;
let tokenA;
let tokenB;
let tenantB;
const criados = { users: [], vehicles: [], customers: [], reservations: [] };

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

async function criarDono(tenantId, email) {
  const hash = await bcrypt.hash('#Teste123x', 10);
  const u = await pool.query(
    `INSERT INTO users (tenant_id, name, email, password_hash, role)
     VALUES ($1,'Dono Frota',$2,$3,'owner') RETURNING id`,
    [tenantId, email, hash]
  );
  criados.users.push(u.rows[0].id);
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador: email, senha: '#Teste123x' }),
  });
  return (await login.json()).token;
}

before(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', ['teste.frota.%@loccar.test']);

  servidor = http.createServer(createApp());
  await new Promise((r) => servidor.listen(0, r));
  base = `http://127.0.0.1:${servidor.address().port}`;

  tokenA = await criarDono(TENANT_A, `teste.frota.a.${marca}@loccar.test`);

  // Segunda locadora, para provar o isolamento.
  const t = await pool.query(
    `INSERT INTO tenants (name, phone_number_id) VALUES ($1,$2) RETURNING id`,
    [`Locadora Frota Teste ${marca}`, `teste-frota-${marca}`]
  );
  tenantB = t.rows[0].id;
  tokenB = await criarDono(tenantB, `teste.frota.b.${marca}@loccar.test`);
});

after(async () => {
  if (criados.reservations.length)
    await pool.query('DELETE FROM reservations WHERE id = ANY($1::uuid[])', [criados.reservations]);
  if (criados.customers.length)
    await pool.query('DELETE FROM customers WHERE id = ANY($1::uuid[])', [criados.customers]);
  if (criados.vehicles.length)
    await pool.query('DELETE FROM vehicles WHERE id = ANY($1::uuid[])', [criados.vehicles]);
  if (criados.users.length)
    await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [criados.users]);
  if (tenantB) await pool.query('DELETE FROM tenants WHERE id = $1', [tenantB]); // cascata
  await new Promise((r) => servidor?.close(r));
  await pool.end();
});

// ----------------------------------------------------------------- cadastro

test('@spec:AC-053 cadastra um veículo com o essencial e ele nasce disponível', async () => {
  const { status, body } = await req('POST', '/api/vehicles', {
    model: 'Fiat Argo 1.0',
    plate: PLACA,
    category: 'hatch',
    daily_rate: 150,
  });
  assert.equal(status, 201);
  criados.vehicles.push(body.id);

  assert.equal(body.status, 'disponivel', 'veículo novo nasce disponível');
  assert.equal(Number(body.deposit_amount), 0, 'sem caução informada, fica zerada');
  assert.equal(Number(body.daily_rate), 150);
});

test('@spec:AC-054 categoria fora da lista é recusada e a mensagem diz quais valem', async () => {
  const { status, body } = await req('POST', '/api/vehicles', {
    model: 'Nave',
    plate: `X${String(marca).slice(-6)}`,
    category: 'foguete',
    daily_rate: 100,
  });
  assert.equal(status, 400);
  assert.match(body.error, /hatch/i, 'a mensagem precisa listar as categorias aceitas');
});

test('@spec:AC-055 duas locadoras podem ter a mesma placa', async () => {
  const { status, body } = await req(
    'POST',
    '/api/vehicles',
    { model: 'Outro Argo', plate: PLACA, category: 'hatch', daily_rate: 200 },
    tokenB
  );
  assert.equal(status, 201, 'a placa é única DENTRO da locadora, não no sistema');
  criados.vehicles.push(body.id);
});

test('@spec:AC-056 uma locadora não enxerga o veículo da outra', async () => {
  const doA = criados.vehicles[0];
  const { status } = await req('GET', `/api/vehicles/${doA}`, null, tokenB);
  assert.equal(status, 404);
});

test('@spec:AC-058 filtra a frota por situação', async () => {
  const parado = await req('POST', '/api/vehicles', {
    model: 'Carro Parado',
    plate: `MAN${String(marca).slice(-4)}`,
    category: 'sedan',
    daily_rate: 90,
    status: 'manutencao',
  });
  criados.vehicles.push(parado.body.id);

  const { status, body } = await req('GET', '/api/vehicles?status=manutencao');
  assert.equal(status, 200);
  assert.ok(body.length > 0);
  assert.ok(
    body.every((v) => v.status === 'manutencao'),
    'o filtro não pode trazer carro de outra situação'
  );
});

// -------------------------------------------------------- preço congelado

test('@spec:AC-057 mudar o preço do veículo não altera reserva já fechada', async () => {
  const veiculo = criados.vehicles[0];

  const c = await pool.query(
    `INSERT INTO customers (tenant_id, name, phone) VALUES ($1,'Cliente Frota',$2) RETURNING id`,
    [TENANT_A, `55349${String(marca).slice(-8)}`]
  );
  criados.customers.push(c.rows[0].id);

  const r = await pool.query(
    `INSERT INTO reservations
       (tenant_id, vehicle_id, customer_id, pickup_at, return_at,
        daily_rate_snapshot, deposit_snapshot, days_count, total_amount, status)
     VALUES ($1,$2,$3, now() + interval '200 days', now() + interval '202 days',
             150, 0, 2, 300, 'confirmada') RETURNING id`,
    [TENANT_A, veiculo, c.rows[0].id]
  );
  criados.reservations.push(r.rows[0].id);

  // Aumenta a diária do veículo depois da reserva feita.
  const alterou = await req('PATCH', `/api/vehicles/${veiculo}`, { daily_rate: 999 });
  assert.equal(alterou.status, 200);
  assert.equal(Number(alterou.body.daily_rate), 999);

  const { body: reserva } = await req('GET', `/api/reservations/${r.rows[0].id}`);
  assert.equal(Number(reserva.daily_rate_snapshot), 150, 'o combinado com o cliente não muda');
  assert.equal(Number(reserva.total_amount), 300);
});

test('@spec:AC-059 veículo com locação registrada não pode ser apagado', async () => {
  const { status, body } = await req('DELETE', `/api/vehicles/${criados.vehicles[0]}`);
  assert.equal(status, 409);
  assert.match(body.error, /usado|vinculad|excluir/i);
});

// ------------------------------------------------------------- manutenção

test('@spec:AC-060 guarda quilometragem, revisão e vencimentos', async () => {
  const { status, body } = await req('PATCH', `/api/vehicles/${criados.vehicles[0]}`, {
    odometer: 45000,
    next_revision_km: 50000,
    ipva_due: '2027-03-31',
    licensing_due: '2027-09-30',
    insurance_due: '2027-12-01',
  });
  assert.equal(status, 200);
  assert.equal(body.odometer, 45000);
  assert.equal(body.next_revision_km, 50000);
  assert.ok(String(body.ipva_due).startsWith('2027-03-31'));
});

test('@spec:AC-061 registra uma manutenção no histórico do veículo', async () => {
  const veiculo = criados.vehicles[0];
  const criar = await req('POST', `/api/vehicles/${veiculo}/manutencoes`, {
    type: 'Troca de óleo e filtro',
    cost: 320.5,
    date: '2026-07-20',
    odometer: 45000,
  });
  assert.ok([200, 201].includes(criar.status), `HTTP ${criar.status}: ${criar.body?.error}`);

  const { status, body } = await req('GET', `/api/vehicles/${veiculo}/manutencoes`);
  assert.equal(status, 200);
  assert.ok(
    body.some((m) => m.type === 'Troca de óleo e filtro'),
    'a manutenção precisa aparecer no histórico'
  );
});

test('@spec:AC-062 não registra manutenção em veículo de outra locadora', async () => {
  const doA = criados.vehicles[0];
  const { status } = await req(
    'POST',
    `/api/vehicles/${doA}/manutencoes`,
    { type: 'Invasão', cost: 1, date: '2026-07-20' },
    tokenB
  );
  assert.equal(status, 404);
});
