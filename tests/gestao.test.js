// ============================================================================
//  TESTES — DESPESAS, MULTAS E LEADS
//
//  Três features de gestão que compartilham a mesma preparação (uma locadora,
//  um dono logado, e uma segunda locadora para provar o isolamento). Ficam no
//  mesmo arquivo para não repetir o setup três vezes — a ligação com a
//  especificação é feita pelo código @spec de cada teste, não pelo arquivo.
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

// Locadora propria, criada no before: estes testes lancam despesas e multas,
// e o teste do Dinheiro confere somas exatas na locadora demo. Compartilhar o
// tenant faria um teste quebrar o outro.
let TENANT_A;
const marca = Date.now();

let servidor;
let base;
let tokenA;
let tokenB;
let tenantB;
let veiculo;
const criados = { users: [], vehicles: [], expenses: [], fines: [], leads: [] };

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
     VALUES ($1,'Dono Gestao',$2,$3,'owner') RETURNING id`,
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
  await pool.query('DELETE FROM users WHERE email LIKE $1', ['teste.gestao.%@loccar.test']);

  servidor = http.createServer(createApp());
  await new Promise((r) => servidor.listen(0, r));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const tA = await pool.query(
    `INSERT INTO tenants (name, phone_number_id) VALUES ($1,$2) RETURNING id`,
    [`Locadora Gestao A ${marca}`, `teste-gestao-a-${marca}`]
  );
  TENANT_A = tA.rows[0].id;
  tokenA = await criarDono(TENANT_A, `teste.gestao.a.${marca}@loccar.test`);

  const t = await pool.query(
    `INSERT INTO tenants (name, phone_number_id) VALUES ($1,$2) RETURNING id`,
    [`Locadora Gestao ${marca}`, `teste-gestao-${marca}`]
  );
  tenantB = t.rows[0].id;
  tokenB = await criarDono(tenantB, `teste.gestao.b.${marca}@loccar.test`);

  const v = await pool.query(
    `INSERT INTO vehicles (tenant_id, model, plate, category, daily_rate)
     VALUES ($1,'Carro Gestao',$2,'hatch',100) RETURNING id`,
    [TENANT_A, `GST${String(marca).slice(-4)}`]
  );
  veiculo = v.rows[0].id;
  criados.vehicles.push(veiculo);
});

after(async () => {
  for (const [tabela, ids] of [
    ['expenses', criados.expenses],
    ['fines', criados.fines],
    ['leads', criados.leads],
    ['vehicles', criados.vehicles],
    ['users', criados.users],
  ]) {
    if (ids.length) await pool.query(`DELETE FROM ${tabela} WHERE id = ANY($1::uuid[])`, [ids]);
  }
  if (tenantB) await pool.query('DELETE FROM tenants WHERE id = $1', [tenantB]);
  if (TENANT_A) await pool.query('DELETE FROM tenants WHERE id = $1', [TENANT_A]);
  await new Promise((r) => servidor?.close(r));
  await pool.end();
});

// ============================================================== DESPESAS

test('@spec:AC-076 lança uma despesa', async () => {
  const { status, body } = await req('POST', '/api/expenses', {
    category: 'combustível',
    amount: 250.5,
    date: '2026-07-10',
    description: 'Abastecimento da frota',
  });
  assert.equal(status, 201);
  criados.expenses.push(body.id);
  assert.equal(body.category, 'combustível');
  assert.equal(Number(body.amount), 250.5);
});

test('@spec:AC-077 despesa sem categoria é recusada', async () => {
  const { status, body } = await req('POST', '/api/expenses', { amount: 100, date: '2026-07-10' });
  assert.equal(status, 400);
  assert.match(body.error, /categoria/i);
});

test('@spec:AC-078 a despesa pode ser ligada a um veículo', async () => {
  const { status, body } = await req('POST', '/api/expenses', {
    category: 'manutenção',
    amount: 800,
    date: '2026-07-11',
    vehicle_id: veiculo,
  });
  assert.equal(status, 201);
  criados.expenses.push(body.id);
  assert.equal(body.vehicle_id, veiculo);
});

test('@spec:AC-079 lista só as despesas do período pedido', async () => {
  const antiga = await req('POST', '/api/expenses', {
    category: 'seguro',
    amount: 400,
    date: '2020-01-15',
  });
  criados.expenses.push(antiga.body.id);

  const { status, body } = await req('GET', '/api/expenses?from=2026-07-01&to=2026-07-31');
  assert.equal(status, 200);
  assert.ok(
    !body.some((d) => d.id === antiga.body.id),
    'despesa de 2020 não pode aparecer no filtro de julho/2026'
  );
  assert.ok(body.some((d) => d.category === 'combustível'));
});

test('@spec:AC-080 excluir despesa que não existe avisa', async () => {
  const { status } = await req('DELETE', '/api/expenses/00000000-0000-0000-0000-0000000000ff');
  assert.equal(status, 404);
});

test('@spec:AC-081 uma locadora não vê a despesa da outra', async () => {
  const { body } = await req('GET', '/api/expenses', null, tokenB);
  assert.ok(
    !body.some((d) => criados.expenses.includes(d.id)),
    'despesa da locadora A não pode aparecer para a B'
  );
});

// ================================================================ MULTAS

test('@spec:AC-082 registra uma multa como pendente de repasse', async () => {
  const { status, body } = await req('POST', '/api/fines', {
    vehicle_id: veiculo,
    description: 'Excesso de velocidade - Av. Brasil',
    amount: 195.23,
    date: '2026-07-05',
  });
  assert.equal(status, 201);
  criados.fines.push(body.id);
  assert.equal(body.status, 'pendente', 'multa nasce pendente de repasse');
});

test('@spec:AC-083 multa sem descrição é recusada', async () => {
  const { status, body } = await req('POST', '/api/fines', { amount: 100 });
  assert.equal(status, 400);
  assert.match(body.error, /descri/i);
});

test('@spec:AC-084 acompanha o repasse: pendente, repassada e paga', async () => {
  const id = criados.fines[0];

  const repassada = await req('PATCH', `/api/fines/${id}`, { status: 'repassada' });
  assert.equal(repassada.status, 200);
  assert.equal(repassada.body.status, 'repassada');

  const paga = await req('PATCH', `/api/fines/${id}`, { status: 'paga' });
  assert.equal(paga.status, 200);
  assert.equal(paga.body.status, 'paga');
});

test('@spec:AC-085 situação de multa inválida é recusada', async () => {
  const { status } = await req('PATCH', `/api/fines/${criados.fines[0]}`, { status: 'sumiu' });
  assert.equal(status, 400);
});

test('@spec:AC-086 filtra as multas por situação', async () => {
  const pendente = await req('POST', '/api/fines', {
    vehicle_id: veiculo,
    description: 'Estacionamento irregular',
    amount: 88,
    date: '2026-07-06',
  });
  criados.fines.push(pendente.body.id);

  const { status, body } = await req('GET', '/api/fines?status=pendente');
  assert.equal(status, 200);
  assert.ok(body.length > 0);
  assert.ok(
    body.every((m) => m.status === 'pendente'),
    'o filtro não pode trazer multa de outra situação'
  );
});

test('@spec:AC-087 uma locadora não vê a multa da outra', async () => {
  const { body } = await req('GET', '/api/fines', null, tokenB);
  assert.ok(
    !body.some((m) => criados.fines.includes(m.id)),
    'multa da locadora A não pode aparecer para a B'
  );
});

// ================================================================= LEADS

test('@spec:AC-088 registra um lead e ele entra como novo', async () => {
  const { status, body } = await req('POST', '/api/leads', {
    name: 'Maria Souza',
    phone: '5534999998888',
  });
  assert.equal(status, 201);
  criados.leads.push(body.id);
  assert.equal(body.status, 'novo', 'lead nasce no começo do funil');
});

test('@spec:AC-089 lead sem nome é recusado', async () => {
  const { status, body } = await req('POST', '/api/leads', { phone: '5534999997777' });
  assert.equal(status, 400);
  assert.match(body.error, /nome/i);
});

test('@spec:AC-090 e-mail inválido é recusado', async () => {
  const { status, body } = await req('POST', '/api/leads', {
    name: 'João',
    email: 'isso-nao-e-email',
  });
  assert.equal(status, 400);
  assert.match(body.error, /e-mail|email/i);
});

test('@spec:AC-091 move o lead pelo funil', async () => {
  const id = criados.leads[0];

  const negociando = await req('PATCH', `/api/leads/${id}`, { status: 'negociacao' });
  assert.equal(negociando.status, 200);
  assert.equal(negociando.body.status, 'negociacao');

  const ganho = await req('PATCH', `/api/leads/${id}`, { status: 'ganho' });
  assert.equal(ganho.status, 200);
  assert.equal(ganho.body.status, 'ganho');
});

test('@spec:AC-143 mexer no lead carimba a data — é o que mostra o que esfriou', async () => {
  const id = criados.leads[0];

  const antes = await req('GET', `/api/leads/${id}`);
  const carimboAntes = antes.status === 200 ? antes.body.updated_at : null;

  // Espera um instante para a diferença ser visível mesmo com relógio grosso.
  await new Promise((r) => setTimeout(r, 1100));

  const depois = await req('PATCH', `/api/leads/${id}`, { notes: 'ligar amanhã' });
  assert.equal(depois.status, 200);
  assert.ok(depois.body.updated_at, 'o lead precisa ter data de última mexida');

  if (carimboAntes) {
    assert.ok(
      new Date(depois.body.updated_at) > new Date(carimboAntes),
      'a data de última mexida tem que avançar a cada edição — senão o painel nunca acusa lead parado'
    );
  }
});

test('@spec:AC-092 etapa de funil inválida é recusada', async () => {
  const { status } = await req('PATCH', `/api/leads/${criados.leads[0]}`, { status: 'talvez' });
  assert.equal(status, 400);
});

test('@spec:AC-093 uma locadora não vê o lead da outra', async () => {
  const { body } = await req('GET', '/api/leads', null, tokenB);
  assert.ok(
    !body.some((l) => criados.leads.includes(l.id)),
    'lead da locadora A não pode aparecer para a B'
  );
});
