// ============================================================================
//  TESTES — BLOQUEIOS DE MANUTENÇÃO E LINHA DO TEMPO
//
//  A parte crítica é o conflito: bloqueio não entra sobre bloqueio, e reserva
//  não entra sobre bloqueio. Isso é garantido no BANCO (restrição EXCLUDE e
//  trigger), então os testes atacam pela API e conferem a recusa.
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
let carro1;
let carro2;
let cliente;

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

const daqui = (dias) => new Date(Date.now() + dias * 86400000).toISOString();

async function novaLocadora(nome) {
  const t = await pool.query(
    `INSERT INTO tenants (name, phone_number_id) VALUES ($1,$2) RETURNING id`,
    [nome, `${nome}-${marca}`.toLowerCase().replace(/\s+/g, '-')]
  );
  const id = t.rows[0].id;
  const email = `${nome}.${marca}@loccar.test`.toLowerCase().replace(/\s+/g, '');
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

  const a = await novaLocadora('bloqA');
  tenantA = a.id;
  tokenA = a.token;
  const b = await novaLocadora('bloqB');
  tenantB = b.id;
  tokenB = b.token;

  for (const [nome, placa] of [
    ['Carro Um', `BL1${String(marca).slice(-4)}`],
    ['Carro Dois', `BL2${String(marca).slice(-4)}`],
  ]) {
    const v = await pool.query(
      `INSERT INTO vehicles (tenant_id, model, plate, category, daily_rate)
       VALUES ($1,$2,$3,'hatch',100) RETURNING id`,
      [tenantA, nome, placa]
    );
    if (!carro1) carro1 = v.rows[0].id;
    else carro2 = v.rows[0].id;
  }

  const c = await pool.query(
    `INSERT INTO customers (tenant_id, name, phone) VALUES ($1,'Cliente Bloq',$2) RETURNING id`,
    [tenantA, `55349${String(marca).slice(-8)}`]
  );
  cliente = c.rows[0].id;
});

after(async () => {
  // Apagar a locadora leva veículos, reservas e bloqueios em cascata.
  for (const id of [tenantA, tenantB]) {
    if (id) await pool.query('DELETE FROM tenants WHERE id = $1', [id]);
  }
  await new Promise((r) => servidor?.close(r));
  await pool.end();
});

// ------------------------------------------------------------- bloqueios

test('@spec:AC-094 cria um bloqueio de manutenção', async () => {
  const { status, body } = await req('POST', '/api/schedule-blocks', {
    vehicleId: carro1,
    startAt: daqui(500),
    endAt: daqui(505),
    reason: 'Revisão dos 60 mil km',
  });
  assert.equal(status, 201);
  assert.equal(body.vehicle_id, carro1);
  assert.match(body.reason, /Revisão/);
});

test('@spec:AC-095 bloqueio em cima de bloqueio é recusado', async () => {
  const { status, body } = await req('POST', '/api/schedule-blocks', {
    vehicleId: carro1,
    startAt: daqui(503),
    endAt: daqui(508),
    reason: 'Outra coisa',
  });
  assert.equal(status, 409);
  assert.match(body.error, /bloqueio|período/i);
});

test('@spec:AC-096 o mesmo período em outro veículo é permitido', async () => {
  const { status } = await req('POST', '/api/schedule-blocks', {
    vehicleId: carro2,
    startAt: daqui(500),
    endAt: daqui(505),
    reason: 'Revisão do outro carro',
  });
  assert.equal(status, 201, 'bloqueio é por veículo, não pela frota inteira');
});

test('@spec:AC-097 reserva em cima de bloqueio é barrada', async () => {
  const { status, body } = await req('POST', '/api/reservations', {
    vehicleId: carro1,
    customerId: cliente,
    pickupAt: daqui(501),
    returnAt: daqui(503),
  });
  assert.equal(status, 409, 'não dá para alugar carro que está na oficina');
  assert.ok(body.error);
});

test('@spec:AC-098 datas invertidas no bloqueio são recusadas', async () => {
  const { status } = await req('POST', '/api/schedule-blocks', {
    vehicleId: carro2,
    startAt: daqui(520),
    endAt: daqui(515),
    reason: 'Datas trocadas',
  });
  assert.equal(status, 400);
});

test('@spec:AC-099 não bloqueia veículo de outra locadora', async () => {
  const { status } = await req(
    'POST',
    '/api/schedule-blocks',
    { vehicleId: carro1, startAt: daqui(600), endAt: daqui(601), reason: 'Invasão' },
    tokenB
  );
  assert.equal(status, 404);
});

test('@spec:AC-100 liberar o período remove o bloqueio e o carro volta a ser reservável', async () => {
  const { body: lista } = await req('GET', '/api/schedule-blocks');
  const doCarro1 = lista.find((b) => b.vehicle_id === carro1);
  assert.ok(doCarro1, 'o bloqueio criado precisa estar na lista');

  const apagou = await req('DELETE', `/api/schedule-blocks/${doCarro1.id}`);
  assert.equal(apagou.status, 204);

  // Agora a mesma reserva que era barrada passa.
  const reserva = await req('POST', '/api/reservations', {
    vehicleId: carro1,
    customerId: cliente,
    pickupAt: daqui(501),
    returnAt: daqui(503),
  });
  assert.equal(reserva.status, 201, 'sem bloqueio, o período fica livre de novo');
});

// --------------------------------------------------------- linha do tempo

test('@spec:AC-101 a linha do tempo devolve veículos, reservas e bloqueios juntos', async () => {
  const { status, body } = await req(
    'GET',
    `/api/timeline?from=${encodeURIComponent(daqui(499))}&to=${encodeURIComponent(daqui(510))}`
  );
  assert.equal(status, 200);
  assert.ok(body.periodo?.inicio && body.periodo?.fim, 'precisa dizer que janela respondeu');
  assert.ok(Array.isArray(body.veiculos) && body.veiculos.length >= 2);
  assert.ok(Array.isArray(body.reservas), 'as reservas da janela vêm junto');
  assert.ok(
    body.bloqueios.some((b) => b.vehicle_id === carro2),
    'o bloqueio do carro 2 tem que aparecer na janela'
  );
});

test('@spec:AC-102 a linha do tempo respeita a janela pedida', async () => {
  const { body } = await req(
    'GET',
    `/api/timeline?from=${encodeURIComponent(daqui(900))}&to=${encodeURIComponent(daqui(905))}`
  );
  assert.equal(body.reservas.length, 0, 'janela distante não pode trazer reserva de outro período');
  assert.equal(body.bloqueios.length, 0);
});
