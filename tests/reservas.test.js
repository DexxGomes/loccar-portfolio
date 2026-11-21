// ============================================================================
//  TESTES — RESERVAS (o ciclo da locação)
//
//  A regra mais importante do sistema está aqui: nunca alugar o mesmo carro
//  duas vezes no mesmo período. Isso é garantido pelo BANCO, então o teste
//  ataca pela API e confirma que a segunda tentativa é recusada.
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
const { calcDays, calcTotal } = await import('../src/utils/dates.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const marca = Date.now();

let servidor;
let base;
let token;
let veiculo;
let cliente;
const criados = { users: [], vehicles: [], customers: [], reservations: [] };

async function req(metodo, caminho, corpo) {
  const res = await fetch(base + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

// Base FIXA para todas as datas do arquivo. Calcular cada data com Date.now()
// na hora deixaria alguns milissegundos entre uma e outra — e como a diária
// arredonda para cima, 48h + 2ms viram 3 diárias e o teste falha às vezes.
const AGORA = Date.now();

/** Datas sempre no futuro distante, para não colidir com dados reais. */
const daqui = (dias, horas = 0) =>
  new Date(AGORA + dias * 86400000 + horas * 3600000).toISOString();

async function novaPreReserva(de, ate) {
  const { status, body } = await req('POST', '/api/reservations', {
    vehicleId: veiculo,
    customerId: cliente,
    pickupAt: de,
    returnAt: ate,
  });
  if (body?.id) criados.reservations.push(body.id);
  return { status, body };
}

before(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', ['teste.reservas.%@loccar.test']);

  servidor = http.createServer(createApp());
  await new Promise((r) => servidor.listen(0, r));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const hash = await bcrypt.hash('#Teste123x', 10);
  const email = `teste.reservas.${marca}@loccar.test`;
  const u = await pool.query(
    `INSERT INTO users (tenant_id, name, email, password_hash, role)
     VALUES ($1,'Dono Reservas',$2,$3,'owner') RETURNING id`,
    [TENANT, email, hash]
  );
  criados.users.push(u.rows[0].id);
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador: email, senha: '#Teste123x' }),
  });
  token = (await login.json()).token;

  const v = await pool.query(
    `INSERT INTO vehicles (tenant_id, model, plate, category, daily_rate, deposit_amount)
     VALUES ($1,'Carro Reservas',$2,'hatch',100,500) RETURNING id`,
    [TENANT, `RSV${String(marca).slice(-4)}`]
  );
  veiculo = v.rows[0].id;
  criados.vehicles.push(veiculo);

  const c = await pool.query(
    `INSERT INTO customers (tenant_id, name, phone) VALUES ($1,'Cliente Reservas',$2) RETURNING id`,
    [TENANT, `55349${String(marca).slice(-8)}`]
  );
  cliente = c.rows[0].id;
  criados.customers.push(cliente);
});

after(async () => {
  // A blocklist ganha entrada quando a reserva é recusada — limpa também.
  if (cliente) {
    const { rows } = await pool.query('SELECT phone, cpf FROM customers WHERE id = $1', [cliente]);
    if (rows[0])
      await pool.query('DELETE FROM blocklist WHERE tenant_id = $1 AND phone = $2', [
        TENANT,
        rows[0].phone,
      ]);
  }
  if (criados.reservations.length)
    await pool.query('DELETE FROM reservations WHERE id = ANY($1::uuid[])', [criados.reservations]);
  if (criados.customers.length)
    await pool.query('DELETE FROM customers WHERE id = ANY($1::uuid[])', [criados.customers]);
  if (criados.vehicles.length)
    await pool.query('DELETE FROM vehicles WHERE id = ANY($1::uuid[])', [criados.vehicles]);
  if (criados.users.length)
    await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [criados.users]);
  await new Promise((r) => servidor?.close(r));
  await pool.end();
});

// ------------------------------------------------------- disponibilidade

test('@spec:AC-065 a diária é bloco de 24h arredondado para cima, mínimo 1', () => {
  const base2 = '2026-08-01T09:00:00-03:00';
  assert.equal(calcDays(base2, '2026-08-01T11:00:00-03:00'), 1, '2h ainda é 1 diária');
  assert.equal(calcDays(base2, '2026-08-02T09:00:00-03:00'), 1, '24h cravadas = 1 diária');
  assert.equal(calcDays(base2, '2026-08-02T11:00:00-03:00'), 2, '26h = 2 diárias');
  assert.equal(calcDays(base2, '2026-08-03T09:00:00-03:00'), 2);
  assert.equal(calcTotal(2, 150), 300);
});

test('@spec:AC-063 mostra os carros livres no período, com diárias e total', async () => {
  const de = daqui(300);
  const ate = daqui(302);
  const { status, body } = await req(
    'GET',
    `/api/reservations/available?pickupAt=${encodeURIComponent(de)}&returnAt=${encodeURIComponent(ate)}`
  );
  assert.equal(status, 200);

  const nosso = body.find((v) => v.id === veiculo);
  assert.ok(nosso, 'o carro livre precisa aparecer');
  assert.equal(nosso.days, 2);
  assert.equal(Number(nosso.total_estimado), 200, '2 diárias de 100');
});

// ------------------------------------------------------------ pré-reserva

test('@spec:AC-066 cria a pré-reserva com os valores congelados e prazo', async () => {
  const { status, body } = await novaPreReserva(daqui(310), daqui(312));
  assert.equal(status, 201);
  assert.equal(body.status, 'pre_reserva');
  assert.equal(Number(body.daily_rate_snapshot), 100);
  assert.equal(Number(body.deposit_snapshot), 500, 'a caução do veículo é congelada junto');
  assert.equal(body.days_count, 2);
  assert.equal(Number(body.total_amount), 200);
  assert.ok(body.expires_at, 'pré-reserva precisa de prazo para não travar o carro para sempre');
});

test('@spec:AC-067 sobreposição de período no mesmo carro é recusada', async () => {
  // Já existe a reserva de 310→312. Tenta pegar 311→313 (encavala).
  const { status, body } = await novaPreReserva(daqui(311), daqui(313));
  assert.equal(status, 409);
  assert.match(body.error, /indispon|sobrep|conflito/i);
});

test('@spec:AC-064 carro já reservado some da lista de disponíveis', async () => {
  const de = daqui(310);
  const ate = daqui(312);
  const { body } = await req(
    'GET',
    `/api/reservations/available?pickupAt=${encodeURIComponent(de)}&returnAt=${encodeURIComponent(ate)}`
  );
  assert.ok(
    !body.some((v) => v.id === veiculo),
    'o carro ocupado não pode ser oferecido'
  );
});

test('@spec:AC-068 datas invertidas são recusadas', async () => {
  const { status, body } = await novaPreReserva(daqui(320), daqui(319));
  assert.equal(status, 400);
  assert.match(body.error, /devolução|depois/i);
});

test('@spec:AC-069 carro em manutenção não pode ser reservado', async () => {
  await pool.query(`UPDATE vehicles SET status = 'manutencao' WHERE id = $1`, [veiculo]);
  const { status, body } = await novaPreReserva(daqui(330), daqui(332));
  await pool.query(`UPDATE vehicles SET status = 'disponivel' WHERE id = $1`, [veiculo]);

  assert.equal(status, 409);
  assert.match(body.error, /manuten/i);
});

// ------------------------------------------------------------ ciclo de vida

test('@spec:AC-075 remarcar recalcula diárias e valor', async () => {
  const { body: r } = await novaPreReserva(daqui(340), daqui(342));
  assert.equal(r.days_count, 2);

  const { status, body } = await req('PATCH', `/api/reservations/${r.id}/reschedule`, {
    pickupAt: daqui(350),
    returnAt: daqui(353),
  });
  assert.equal(status, 200);
  assert.equal(body.days_count, 3, 'período novo, contagem nova');
  assert.equal(Number(body.total_amount), 300);
});

test('@spec:AC-072 o carro não sai antes de a reserva ser confirmada', async () => {
  const { body: r } = await novaPreReserva(daqui(360), daqui(362));
  const { status } = await req('POST', `/api/reservations/${r.id}/pickup`);
  assert.equal(status, 409, 'pré-reserva não pode virar locação em andamento');
});

test('@spec:AC-070 aprovar confirma a reserva', async () => {
  const { body: r } = await novaPreReserva(daqui(370), daqui(372));
  const { status, body } = await req('POST', `/api/reservations/${r.id}/approve`);
  assert.equal(status, 200);
  assert.equal(body.status, 'confirmada');
});

test('@spec:AC-073 registrar a retirada põe a locação em andamento', async () => {
  const { body: r } = await novaPreReserva(daqui(380), daqui(382));
  await req('POST', `/api/reservations/${r.id}/approve`);
  const { status, body } = await req('POST', `/api/reservations/${r.id}/pickup`);
  assert.equal(status, 200);
  assert.equal(body.status, 'em_andamento');
});

test('@spec:AC-074 devolução fora do prazo é finalizada e marcada como atrasada', async () => {
  // A locação inteira fica no PASSADO (retirada ontem, devolução prevista há
  // uma hora). Empurrar só a devolução para trás deixaria a devolução antes da
  // retirada — o banco recusa, e com razão.
  const r = await pool.query(
    `INSERT INTO reservations
       (tenant_id, vehicle_id, customer_id, pickup_at, return_at,
        daily_rate_snapshot, deposit_snapshot, days_count, total_amount, status)
     VALUES ($1,$2,$3, now() - interval '1 day', now() - interval '1 hour',
             100, 500, 1, 100, 'em_andamento') RETURNING id`,
    [TENANT, veiculo, cliente]
  );
  criados.reservations.push(r.rows[0].id);

  const { status, body } = await req('POST', `/api/reservations/${r.rows[0].id}/return`);
  assert.equal(status, 200);
  assert.equal(body.status, 'finalizada');
  assert.equal(body.late_return_flag, true, 'devolveu depois do prazo: tem que sinalizar');
});

test('@spec:AC-074 devolução dentro do prazo NÃO é marcada como atrasada', async () => {
  const r = await pool.query(
    `INSERT INTO reservations
       (tenant_id, vehicle_id, customer_id, pickup_at, return_at,
        daily_rate_snapshot, deposit_snapshot, days_count, total_amount, status)
     VALUES ($1,$2,$3, now() - interval '2 hours', now() + interval '2 days',
             100, 500, 1, 100, 'em_andamento') RETURNING id`,
    [TENANT, veiculo, cliente]
  );
  criados.reservations.push(r.rows[0].id);

  const { body } = await req('POST', `/api/reservations/${r.rows[0].id}/return`);
  assert.equal(body.status, 'finalizada');
  assert.equal(body.late_return_flag, false, 'devolveu antes do prazo: nada de marca de atraso');
});

test('@spec:AC-071 recusar guarda o motivo internamente e NÃO bloqueia por conta própria', async () => {
  const { body: r } = await novaPreReserva(daqui(400), daqui(402));

  const { status, body } = await req('POST', `/api/reservations/${r.id}/reject`, {
    internalReason: 'Comprovante de residência ilegível.',
  });
  assert.equal(status, 200);
  assert.equal(body.status, 'recusada');
  assert.equal(body.internal_rejection_reason, 'Comprovante de residência ilegível.');

  const { rows } = await pool.query('SELECT phone FROM customers WHERE id = $1', [cliente]);
  const bloqueio = await pool.query('SELECT reason FROM blocklist WHERE tenant_id = $1 AND phone = $2', [
    TENANT,
    rows[0].phone,
  ]);
  assert.equal(
    bloqueio.rows.length,
    0,
    'recusar por documento ilegível não pode queimar o cliente para sempre'
  );
});

test('@spec:AC-130 bloquear na recusa é escolha do dono', async () => {
  const { body: r } = await novaPreReserva(daqui(410), daqui(412));

  const { status } = await req('POST', `/api/reservations/${r.id}/reject`, {
    internalReason: 'Selfie não confere com a foto da CNH.',
    bloquearCliente: true,
  });
  assert.equal(status, 200);

  const { rows } = await pool.query('SELECT phone FROM customers WHERE id = $1', [cliente]);
  const bloqueio = await pool.query('SELECT reason FROM blocklist WHERE tenant_id = $1 AND phone = $2', [
    TENANT,
    rows[0].phone,
  ]);
  assert.equal(bloqueio.rows.length, 1, 'pedindo para bloquear, o cliente entra na blocklist');
});
