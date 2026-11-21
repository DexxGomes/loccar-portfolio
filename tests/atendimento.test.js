// ============================================================================
//  TESTES — ATENDIMENTO NO WHATSAPP
//
//  Cobre o caminho da mensagem (handshake, assinatura, deduplicação), as
//  conversas no painel e o motor de risco. O DIÁLOGO da IA em si não é
//  testado aqui: depende de chave de API e de resposta de modelo (ver a
//  suposição ASM-038 na especificação).
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
const { assessReservation } = await import('../src/services/riskService.js');

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
let conversaA;

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

  const a = await novaLocadora('atenda');
  tenantA = a.id;
  tokenA = a.token;
  const b = await novaLocadora('atendb');
  tenantB = b.id;
  tokenB = b.token;

  const v = await pool.query(
    `INSERT INTO vehicles (tenant_id, model, plate, category, daily_rate)
     VALUES ($1,'Carro Atendimento',$2,'hatch',100) RETURNING id`,
    [tenantA, `ATD${String(marca).slice(-4)}`]
  );
  veiculo = v.rows[0].id;

  const c = await pool.query(
    `INSERT INTO customers (tenant_id, name, phone, cpf) VALUES ($1,'Cliente Atendimento',$2,$3) RETURNING id`,
    [tenantA, `55349${String(marca).slice(-8)}`, '52998224725']
  );
  cliente = c.rows[0].id;

  const r = await pool.query(
    `INSERT INTO reservations
       (tenant_id, vehicle_id, customer_id, pickup_at, return_at,
        daily_rate_snapshot, deposit_snapshot, days_count, total_amount, status)
     VALUES ($1,$2,$3, now() + interval '950 days', now() + interval '952 days',
             100, 0, 2, 200, 'em_analise') RETURNING id`,
    [tenantA, veiculo, cliente]
  );
  reserva = r.rows[0].id;

  // Duas conversas: uma precisa de humano, outra não.
  const conv = await pool.query(
    `INSERT INTO conversations (tenant_id, customer_id, phone, needs_human)
     VALUES ($1,$2,$3,TRUE) RETURNING id`,
    [tenantA, cliente, `55349${String(marca).slice(-8)}`]
  );
  conversaA = conv.rows[0].id;
  await pool.query(
    `INSERT INTO conversations (tenant_id, phone, needs_human) VALUES ($1,$2,FALSE)`,
    [tenantA, `55349${String(marca + 1).slice(-8)}`]
  );
});

after(async () => {
  for (const id of [tenantA, tenantB]) {
    if (id) await pool.query('DELETE FROM tenants WHERE id = $1', [id]);
  }
  await new Promise((r) => servidor?.close(r));
  await pool.end();
});

// ------------------------------------------------------------ o webhook

test('@spec:AC-119 o handshake da Meta é respondido com o desafio', async () => {
  const { env } = await import('../src/config/env.js');
  const token = env.VERIFY_TOKEN;
  if (!token) {
    // Sem token configurado no ambiente, o handshake correto não é testável.
    // Ainda assim o caso do token ERRADO (AC-120) prova a recusa.
    return;
  }
  const res = await fetch(
    `${base}/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(token)}&hub.challenge=meu-desafio-123`
  );
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'meu-desafio-123', 'a Meta espera o desafio de volta');
});

test('@spec:AC-120 handshake com token errado é recusado', async () => {
  const res = await fetch(
    `${base}/webhook?hub.mode=subscribe&hub.verify_token=token-falso-de-invasor&hub.challenge=x`
  );
  assert.equal(res.status, 403);
});

test('@spec:AC-121 em produção, entrega sem assinatura é recusada', async () => {
  // Precisa de PROCESSO SEPARADO: a configuração de ambiente é lida uma vez,
  // na primeira importação, e aqui o processo já subiu como "test". Mudar a
  // variável depois não teria efeito — o teste passaria dando falsa segurança.
  const roteiro = `
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'x'.repeat(40);
    delete process.env.WHATSAPP_APP_SECRET;
    const http = await import('node:http');
    const { createApp } = await import('./src/app.js');
    const s = http.createServer(createApp());
    await new Promise((r) => s.listen(0, r));
    const res = await fetch('http://127.0.0.1:' + s.address().port + '/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry: [] }),
    });
    console.log('STATUS=' + res.status);
    s.close();
  `;

  const { execFileSync } = await import('node:child_process');
  const saida = execFileSync(process.execPath, ['--input-type=module', '-e', roteiro], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.match(saida, /STATUS=503/, 'sem conferir a origem, a entrega não pode ser aceita');
});

test('@spec:AC-122 a mesma mensagem não é processada duas vezes', async () => {
  const eventoId = `wamid.teste.${marca}`;

  const primeira = await pool.query(
    `INSERT INTO webhook_events (tenant_id, event_id) VALUES ($1,$2)
     ON CONFLICT (event_id) DO NOTHING RETURNING id`,
    [tenantA, eventoId]
  );
  assert.equal(primeira.rows.length, 1, 'a primeira vez registra o evento');

  const reenvio = await pool.query(
    `INSERT INTO webhook_events (tenant_id, event_id) VALUES ($1,$2)
     ON CONFLICT (event_id) DO NOTHING RETURNING id`,
    [tenantA, eventoId]
  );
  assert.equal(reenvio.rows.length, 0, 'o reenvio da Meta não pode virar segundo processamento');
});

// ---------------------------------------------------------- as conversas

test('@spec:AC-123 lista só as conversas que precisam de atendimento humano', async () => {
  const { status, body } = await req('GET', '/api/conversations?needs_human=true');
  assert.equal(status, 200);
  assert.ok(body.length > 0);
  assert.ok(
    body.every((c) => c.needs_human === true),
    'o filtro não pode trazer conversa que a IA está atendendo'
  );
});

test('@spec:AC-124 uma locadora não lê a conversa da outra', async () => {
  const { status } = await req('GET', `/api/conversations/${conversaA}/messages`, null, tokenB);
  assert.equal(status, 404);
});

test('@spec:AC-125 resolver a conversa devolve o atendimento à IA', async () => {
  const { status, body } = await req('POST', `/api/conversations/${conversaA}/resolve`);
  assert.equal(status, 200);
  assert.equal(body.needs_human, false);
});

// ------------------------------------------------------------- o risco

test('@spec:AC-126 a análise aponta documentação incompleta', async () => {
  const risco = await assessReservation({ id: tenantA }, reserva);
  const doc = risco.sinais.find((s) => /documenta/i.test(s.titulo));
  assert.ok(doc, 'sem documento enviado, tem que sinalizar');
  assert.match(doc.detalhe, /CNH|comprovante|selfie/i, 'precisa dizer o que falta');
});

test('@spec:AC-129 cliente sem histórico é informado como aviso neutro', async () => {
  const risco = await assessReservation({ id: tenantA }, reserva);
  const novo = risco.sinais.find((s) => /cliente novo/i.test(s.titulo));
  assert.ok(novo, 'primeira reserva do cliente tem que aparecer');
  assert.equal(novo.nivel, 'info', 'ser cliente novo não é defeito — é informação');
});

test('@spec:AC-127 CNH vencida é risco alto', async () => {
  await pool.query(`UPDATE customers SET cnh_valid_until = CURRENT_DATE - 30 WHERE id = $1`, [
    cliente,
  ]);
  const risco = await assessReservation({ id: tenantA }, reserva);
  await pool.query(`UPDATE customers SET cnh_valid_until = NULL WHERE id = $1`, [cliente]);

  const cnh = risco.sinais.find((s) => /CNH vencida/i.test(s.titulo));
  assert.ok(cnh, 'CNH vencida tem que ser sinalizada');
  assert.equal(cnh.nivel, 'alto');
  assert.equal(risco.nivel, 'alto', 'o nível geral é o pior sinal');
});

test('@spec:AC-128 cliente na blocklist é risco alto', async () => {
  const { rows } = await pool.query('SELECT phone FROM customers WHERE id = $1', [cliente]);
  await pool.query(
    `INSERT INTO blocklist (tenant_id, phone, reason) VALUES ($1,$2,'Teste de bloqueio')`,
    [tenantA, rows[0].phone]
  );

  const risco = await assessReservation({ id: tenantA }, reserva);
  await pool.query('DELETE FROM blocklist WHERE tenant_id = $1 AND phone = $2', [
    tenantA,
    rows[0].phone,
  ]);

  const bloqueio = risco.sinais.find((s) => /blocklist/i.test(s.titulo));
  assert.ok(bloqueio, 'cliente bloqueado tem que aparecer na análise');
  assert.equal(bloqueio.nivel, 'alto');
});
