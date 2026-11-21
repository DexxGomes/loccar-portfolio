// ============================================================================
//  TESTES — CADASTRO DO CLIENTE E ENDEREÇO NO CONTRATO
//
//  Sobem a API em uma porta livre e falam com o banco real. Tudo que é criado
//  aqui (cliente, veículo, reserva) é APAGADO no final, dê certo ou dê errado.
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

const TENANT_DEMO = '00000000-0000-0000-0000-000000000001';
const EMAIL = `teste.cliente.${Date.now()}@loccar.test`;
const SENHA = '#Teste123x';
const TELEFONE = '5599000000001'; // telefone fictício do cliente de teste

let servidor;
let base;
let token;
let userId;
let customerId;
let vehicleId;
let reservationId;

async function req(metodo, caminho, corpo) {
  const res = await fetch(base + caminho, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* sem corpo */
  }
  return { status: res.status, body };
}

before(async () => {
  // Restos de execuções anteriores que tenham quebrado no meio.
  await pool.query('DELETE FROM users WHERE email LIKE $1', ['teste.cliente.%@loccar.test']);
  await pool.query('DELETE FROM customers WHERE phone = $1', [TELEFONE]);

  const hash = await bcrypt.hash(SENHA, 10);
  const u = await pool.query(
    `INSERT INTO users (tenant_id, name, email, password_hash, role)
     VALUES ($1, 'Dono de Teste', $2, $3, 'owner') RETURNING id`,
    [TENANT_DEMO, EMAIL, hash]
  );
  userId = u.rows[0].id;

  const c = await pool.query(
    `INSERT INTO customers (tenant_id, name, phone, cpf)
     VALUES ($1, 'Cliente de Teste', $2, '12345678909') RETURNING id`,
    [TENANT_DEMO, TELEFONE]
  );
  customerId = c.rows[0].id;

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
  if (reservationId) await pool.query('DELETE FROM reservations WHERE id = $1', [reservationId]);
  if (vehicleId) await pool.query('DELETE FROM vehicles WHERE id = $1', [vehicleId]);
  if (customerId) await pool.query('DELETE FROM customers WHERE id = $1', [customerId]);
  if (userId) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await new Promise((r) => servidor?.close(r));
  await pool.end();
});

// ----------------------------------------------------------------------------
// Cadastro do endereço
// ----------------------------------------------------------------------------

test('@spec:AC-013 salva o endereço completo do cliente', async () => {
  const { status, body } = await req('PATCH', `/api/customers/${customerId}`, {
    zip_code: '38400000',
    street: 'Rua das Flores',
    street_number: '123',
    complement: 'Apto 202',
    district: 'Centro',
    city: 'Uberlândia',
    state: 'MG',
  });
  assert.equal(status, 200);
  assert.equal(body.zip_code, '38400000');
  assert.equal(body.street, 'Rua das Flores');
  assert.equal(body.street_number, '123');
  assert.equal(body.district, 'Centro');
  assert.equal(body.city, 'Uberlândia');
  assert.equal(body.state, 'MG');
});

test('@spec:AC-014 aceita CEP com traço e UF em minúscula, guardando limpo', async () => {
  const { status, body } = await req('PATCH', `/api/customers/${customerId}`, {
    zip_code: '38.400-123',
    state: 'mg',
  });
  assert.equal(status, 200);
  assert.equal(body.zip_code, '38400123', 'CEP deve ser guardado só com dígitos');
  assert.equal(body.state, 'MG', 'UF deve ser guardada em maiúsculas');
});

test('@spec:AC-015 recusa CEP que não tem 8 dígitos', async () => {
  const { status } = await req('PATCH', `/api/customers/${customerId}`, { zip_code: '384' });
  assert.equal(status, 400);
});

test('@spec:AC-016 recusa UF que não tem 2 letras', async () => {
  const { status } = await req('PATCH', `/api/customers/${customerId}`, { state: 'MGA' });
  assert.equal(status, 400);
});

test('@spec:AC-017 recusa CPF que não tem 11 dígitos', async () => {
  const { status } = await req('PATCH', `/api/customers/${customerId}`, { cpf: '123' });
  assert.equal(status, 400);
});

test('@spec:AC-018 campo em branco limpa o dado em vez de guardar vazio', async () => {
  const { status, body } = await req('PATCH', `/api/customers/${customerId}`, { complement: '' });
  assert.equal(status, 200);
  assert.equal(body.complement, null);
});

test('@spec:AC-019 não edita cliente que não existe', async () => {
  const { status } = await req('PATCH', '/api/customers/00000000-0000-0000-0000-0000000000ff', {
    city: 'Qualquer',
  });
  assert.equal(status, 404);
});

test('@spec:AC-020 não edita sem estar logado', async () => {
  const res = await fetch(`${base}/api/customers/${customerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city: 'Invasão' }),
  });
  assert.equal(res.status, 401);
});

// ----------------------------------------------------------------------------
// O endereço no contrato
// ----------------------------------------------------------------------------

test('@spec:AC-021 o contrato traz o endereço do locatário em uma linha', async () => {
  // Deixa o endereço no estado esperado e cria veículo + reserva.
  await req('PATCH', `/api/customers/${customerId}`, {
    zip_code: '38400000',
    street: 'Rua das Flores',
    street_number: '123',
    complement: 'Apto 202',
    district: 'Centro',
    city: 'Uberlândia',
    state: 'MG',
  });

  const v = await pool.query(
    `INSERT INTO vehicles (tenant_id, model, plate, category, daily_rate, deposit_amount)
     VALUES ($1, 'Fiat Argo Teste', 'TST9A99', 'hatch', 150, 500) RETURNING id`,
    [TENANT_DEMO]
  );
  vehicleId = v.rows[0].id;

  const r = await pool.query(
    `INSERT INTO reservations
       (tenant_id, vehicle_id, customer_id, pickup_at, return_at,
        daily_rate_snapshot, deposit_snapshot, days_count, total_amount, status)
     VALUES ($1, $2, $3, now() + interval '30 days', now() + interval '32 days',
             150, 500, 2, 300, 'confirmada')
     RETURNING id`,
    [TENANT_DEMO, vehicleId, customerId]
  );
  reservationId = r.rows[0].id;

  const { status, body } = await req('GET', `/api/reservations/${reservationId}/contrato`);
  assert.equal(status, 200);
  assert.equal(
    body.locatario.endereco,
    'Rua das Flores, 123, Apto 202 — Centro — Uberlândia/MG — CEP 38400-000'
  );
  assert.equal(body.locatario.endereco_partes.cep, '38400-000');
  assert.equal(body.locatario.endereco_partes.bairro, 'Centro');
  assert.equal(body.locatario.endereco_partes.numero, '123');
});

test('@spec:AC-022 sem endereço, o contrato não quebra e avisa que está vazio', async () => {
  await pool.query(
    `UPDATE customers
        SET zip_code = NULL, street = NULL, street_number = NULL,
            complement = NULL, district = NULL, city = NULL, state = NULL
      WHERE id = $1`,
    [customerId]
  );

  const { status, body } = await req('GET', `/api/reservations/${reservationId}/contrato`);
  assert.equal(status, 200);
  assert.equal(body.locatario.endereco, null);
});

test('@spec:AC-023 endereço pela metade não deixa vírgula nem traço solto', async () => {
  await req('PATCH', `/api/customers/${customerId}`, {
    street: 'Alameda dos Ipês',
    street_number: '77',
    district: 'Jardim',
  });

  const { body } = await req('GET', `/api/reservations/${reservationId}/contrato`);
  assert.equal(body.locatario.endereco, 'Alameda dos Ipês, 77 — Jardim');
});
