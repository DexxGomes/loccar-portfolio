// ============================================================================
//  TESTES — VISTORIA DIGITAL
//
//  O que interessa provar: uma vistoria de cada tipo por reserva, o
//  combustível medido em oitavos, e o COMPARATIVO entre saída e volta — que é
//  o que encerra a discussão na devolução.
//
//  Locadora própria, apagada no final (a cascata leva vistorias e fotos).
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
let veiculo;
let cliente;
let reserva;
let reserva2;

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
  // Minúsculas de propósito: o login procura o e-mail em minúsculas, então
  // gravar com maiúscula faria a autenticação falhar com 401.
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

async function novaReserva(dias) {
  const r = await pool.query(
    `INSERT INTO reservations
       (tenant_id, vehicle_id, customer_id, pickup_at, return_at,
        daily_rate_snapshot, deposit_snapshot, days_count, total_amount, status)
     VALUES ($1,$2,$3, now() + ($4 || ' days')::interval, now() + (($4::int + 2) || ' days')::interval,
             100, 0, 2, 200, 'confirmada') RETURNING id`,
    [tenantA, veiculo, cliente, String(dias)]
  );
  return r.rows[0].id;
}

before(async () => {
  servidor = http.createServer(createApp());
  await new Promise((r) => servidor.listen(0, r));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const a = await novaLocadora('vistA');
  tenantA = a.id;
  tokenA = a.token;
  const b = await novaLocadora('vistB');
  tenantB = b.id;
  tokenB = b.token;

  const v = await pool.query(
    `INSERT INTO vehicles (tenant_id, model, plate, category, daily_rate)
     VALUES ($1,'Carro Vistoria',$2,'hatch',100) RETURNING id`,
    [tenantA, `VST${String(marca).slice(-4)}`]
  );
  veiculo = v.rows[0].id;

  const c = await pool.query(
    `INSERT INTO customers (tenant_id, name, phone) VALUES ($1,'Cliente Vistoria',$2) RETURNING id`,
    [tenantA, `55349${String(marca).slice(-8)}`]
  );
  cliente = c.rows[0].id;

  reserva = await novaReserva(700);
  reserva2 = await novaReserva(710);
});

after(async () => {
  for (const id of [tenantA, tenantB]) {
    if (id) await pool.query('DELETE FROM tenants WHERE id = $1', [id]);
  }
  await new Promise((r) => servidor?.close(r));
  await pool.end();
});

// ---------------------------------------------------------------- registro

test('@spec:AC-103 registra a vistoria de retirada', async () => {
  const { status, body } = await req('POST', '/api/inspections', {
    reservationId: reserva,
    type: 'retirada',
    odometer: 30000,
    fuelLevel: 8,
    damages: [{ x: 20, y: 30, parte: 'porta dianteira esquerda', gravidade: 'leve' }],
  });
  assert.equal(status, 201);
  assert.equal(body.type, 'retirada');
  assert.equal(body.odometer, 30000);
  assert.equal(body.fuel_level, 8, 'tanque cheio = 8 oitavos');
  assert.equal((body.damages || []).length, 1);
});

test('@spec:AC-104 uma reserva não pode ter duas vistorias do mesmo tipo', async () => {
  const { status, body } = await req('POST', '/api/inspections', {
    reservationId: reserva,
    type: 'retirada',
    odometer: 30001,
    fuelLevel: 8,
    damages: [],
  });
  assert.equal(status, 409);
  assert.match(body.error, /já tem|já existe/i);
});

test('@spec:AC-105 combustível fora da faixa de oitavos é recusado', async () => {
  const { status } = await req('POST', '/api/inspections', {
    reservationId: reserva2,
    type: 'retirada',
    odometer: 100,
    fuelLevel: 12, // não existe 12/8
    damages: [],
  });
  assert.equal(status, 400);
});

test('@spec:AC-106 não registra vistoria em reserva de outra locadora', async () => {
  const { status } = await req(
    'POST',
    '/api/inspections',
    { reservationId: reserva2, type: 'retirada', odometer: 1, fuelLevel: 4, damages: [] },
    tokenB
  );
  assert.equal(status, 404);
});

test('@spec:AC-107 foto que não é imagem de verdade é recusada', async () => {
  const { body: vistorias } = await req('GET', `/api/inspections?reservationId=${reserva}`);
  const id = vistorias.retirada.id;

  const { status } = await req('POST', `/api/inspections/${id}/photos`, {
    position: 'frente',
    dataUrl: 'data:text/plain;base64,ZXNzZSBhcXVpIG5hbyBlIHVtYSBmb3Rv',
  });
  assert.equal(status, 400);
});

// ------------------------------------------------------------- comparativo

test('@spec:AC-109 sem as duas vistorias não existe comparativo', async () => {
  const { status, body } = await req('GET', `/api/inspections?reservationId=${reserva}`);
  assert.equal(status, 200);
  assert.ok(body.retirada, 'a de retirada existe');
  assert.equal(body.devolucao, null);
  assert.equal(body.comparativo, null, 'não dá para comparar com nada');
});

test('@spec:AC-108 compara km rodado, combustível e avarias novas', async () => {
  await req('POST', '/api/inspections', {
    reservationId: reserva,
    type: 'devolucao',
    odometer: 30450,
    fuelLevel: 5, // saiu com 8, voltou com 5
    damages: [
      { x: 20, y: 30, parte: 'porta dianteira esquerda', gravidade: 'leve' },
      { x: 70, y: 55, parte: 'para-choque traseiro', gravidade: 'media' },
    ],
  });

  const { body } = await req('GET', `/api/inspections?reservationId=${reserva}`);
  assert.ok(body.comparativo, 'com as duas vistorias, o comparativo aparece');
  assert.equal(body.comparativo.kmRodado, 450);
  assert.equal(body.comparativo.combustivelOitavos, -3, 'voltou com 3 oitavos a menos');
  assert.equal(body.comparativo.avariasAntes, 1);
  assert.equal(body.comparativo.avariasDepois, 2);
  assert.equal(body.comparativo.avariasNovas, 1);
});

test('@spec:AC-110 sugere o km inicial pela última vistoria do veículo', async () => {
  const { status, body } = await req('GET', `/api/inspections/ultimo-odometro/${veiculo}`);
  assert.equal(status, 200);
  assert.equal(body.odometer, 30450, 'a última vistoria registrada foi a devolução com 30450');
});
