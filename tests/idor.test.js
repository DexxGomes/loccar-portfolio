// ============================================================================
//  TESTES — IDOR (OWASP): trocar o ID na URL não dá acesso ao dado alheio
//
//  IDOR é o ataque mais simples que existe contra um sistema multi-locadora:
//  eu entro com a MINHA senha, que é legítima, e troco o id na URL pelo id de
//  outra locadora. Se a rota buscar só por id, ela entrega. Não precisa
//  invadir nada — basta um número diferente.
//
//  Aqui a locadora B, autenticada de verdade, tenta ler, alterar e apagar
//  tudo que é da locadora A. Toda tentativa tem que falhar, E o dado de A
//  precisa continuar intacto depois — porque "respondeu 404" e "não mexeu"
//  são duas garantias diferentes, e é a segunda que importa.
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
let servidor, base, tokenA, tokenB;
const A = {}; // ids dos recursos da locadora A
const criado = {};

async function req(metodo, caminho, corpo, token) {
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

async function criarLocadora(nome) {
  const t = await pool.query(
    `INSERT INTO tenants (name, phone_number_id) VALUES ($1,$2) RETURNING id`,
    [nome, `${nome}-${marca}`]
  );
  const tenantId = t.rows[0].id;
  const email = `${nome}.${marca}@loccar.test`.toLowerCase();
  const hash = await bcrypt.hash('#Teste123x', 10);
  await pool.query(
    `INSERT INTO users (tenant_id, name, email, password_hash, role)
     VALUES ($1,'Dono',$2,$3,'owner')`,
    [tenantId, email, hash]
  );
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador: email, senha: '#Teste123x' }),
  });
  return { tenantId, token: (await login.json()).token };
}

before(async () => {
  servidor = http.createServer(createApp());
  await new Promise((r) => servidor.listen(0, r));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const a = await criarLocadora(`idorA${marca}`);
  const b = await criarLocadora(`idorB${marca}`);
  criado.tenantA = a.tenantId;
  criado.tenantB = b.tenantId;
  tokenA = a.token;
  tokenB = b.token;

  // Recursos da locadora A, criados pela própria A.
  const v = await req('POST', '/api/vehicles', {
    model: 'Carro do A', plate: `IDR${String(marca).slice(-4)}`,
    category: 'hatch', daily_rate: 100,
  }, tokenA);
  A.veiculo = v.body.id;

  const l = await req('POST', '/api/leads', { name: 'Lead do A', phone: '5534988887777' }, tokenA);
  A.lead = l.body.id;

  const p = await req('POST', '/api/particulares', { phone: '5534911112222', label: 'Mae do A' }, tokenA);
  A.particular = p.body.id;

  const c = await pool.query(
    `INSERT INTO customers (tenant_id, name, phone) VALUES ($1,'Cliente do A',$2) RETURNING id`,
    [criado.tenantA, `5534${String(marca).slice(-7)}`]
  );
  A.cliente = c.rows[0].id;
});

after(async () => {
  for (const t of [criado.tenantA, criado.tenantB]) {
    if (t) await pool.query('DELETE FROM tenants WHERE id = $1', [t]);
  }
  await new Promise((r) => servidor.close(r));
  await pool.end();
});

/** Nenhuma resposta de sucesso pode sair de uma tentativa dessas. */
function negou(status) {
  return status === 404 || status === 403 || status === 400;
}

test('@spec:AC-148 a locadora B não LÊ os dados da locadora A pelo id', async () => {
  const tentativas = [
    ['GET', `/api/vehicles/${A.veiculo}`],
    ['GET', `/api/customers/${A.cliente}`],
    ['GET', `/api/customers/${A.cliente}/reservations`],
    ['GET', `/api/leads/${A.lead}`],
  ];
  for (const [metodo, caminho] of tentativas) {
    const { status, body } = await req(metodo, caminho, null, tokenB);
    // Lista vazia também é aceitável (não vazou nada); o proibido é vir o dado.
    const vazou = status === 200 && body && !Array.isArray(body) && body.id;
    assert.ok(!vazou, `VAZOU em ${metodo} ${caminho} (HTTP ${status})`);
    if (Array.isArray(body)) assert.equal(body.length, 0, `lista de outra locadora em ${caminho}`);
  }
});

test('@spec:AC-149 a locadora B não ALTERA os dados da locadora A', async () => {
  const r = await req('PATCH', `/api/vehicles/${A.veiculo}`, { model: 'INVADIDO' }, tokenB);
  assert.ok(negou(r.status), `PATCH em veículo alheio devolveu ${r.status}`);

  // A garantia que importa: o dado de A continua como estava.
  const conf = await req('GET', `/api/vehicles/${A.veiculo}`, null, tokenA);
  assert.equal(conf.body.model, 'Carro do A', 'o veículo de A foi alterado por B');

  const rl = await req('PATCH', `/api/leads/${A.lead}`, { name: 'INVADIDO' }, tokenB);
  assert.ok(negou(rl.status), `PATCH em lead alheio devolveu ${rl.status}`);

  const rc = await req('PATCH', `/api/customers/${A.cliente}`, { name: 'INVADIDO' }, tokenB);
  assert.ok(negou(rc.status), `PATCH em cliente alheio devolveu ${rc.status}`);
});

test('@spec:AC-150 a locadora B não APAGA os dados da locadora A', async () => {
  const alvos = [
    ['DELETE', `/api/vehicles/${A.veiculo}`],
    ['DELETE', `/api/leads/${A.lead}`],
    ['DELETE', `/api/particulares/${A.particular}`],
  ];
  for (const [metodo, caminho] of alvos) {
    const { status } = await req(metodo, caminho, null, tokenB);
    assert.ok(negou(status), `${metodo} ${caminho} por outra locadora devolveu ${status}`);
  }

  // Tudo continua existindo para o dono legítimo.
  const v = await req('GET', `/api/vehicles/${A.veiculo}`, null, tokenA);
  assert.equal(v.status, 200, 'o veículo de A sumiu');

  const leads = await req('GET', '/api/leads', null, tokenA);
  assert.ok(leads.body.some((l) => l.id === A.lead), 'o lead de A sumiu');

  const part = await req('GET', '/api/particulares', null, tokenA);
  assert.ok(part.body.some((p) => p.id === A.particular), 'o contato particular de A sumiu');
});

test('@spec:AC-151 id inventado não derruba nem vaza detalhe interno', async () => {
  // UUID válido mas inexistente, e UUID malformado: os dois têm que responder
  // com educação, sem stack trace nem nome de tabela.
  const casos = [
    '/api/vehicles/00000000-0000-0000-0000-000000000009',
    '/api/vehicles/nao-e-uuid',
  ];
  for (const caminho of casos) {
    const { status, body } = await req('GET', caminho, null, tokenB);
    assert.ok(status === 404 || status === 400, `${caminho} devolveu ${status}`);
    const texto = JSON.stringify(body || {});
    assert.ok(!/pg_|postgres|SELECT |at Object|\.js:\d/i.test(texto), `vazou detalhe interno: ${texto}`);
  }
});

test('@spec:AC-152 sem token não se lê nada', async () => {
  const res = await fetch(`${base}/api/vehicles/${A.veiculo}`);
  assert.equal(res.status, 401, 'rota protegida respondeu sem autenticação');
});
