// ============================================================================
//  TESTES — MÊS FECHADO NO RESUMO E CAMPO COM ERRO DESTACADO
//
//  Dois critérios que nasceram de decisões do dono do produto (28/07/2026):
//  o período "Este mês" na tela do Dinheiro, e a resposta de erro dizendo
//  QUAL campo falhou para a tela poder marcá-lo em vermelho.
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
const { intervaloDoPeriodo, PERIODOS } = await import('../web/src/periodos.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const EMAIL = `teste.periodos.${Date.now()}@loccar.test`;
const SENHA = '#Teste123x';

let servidor;
let base;
let token;
let userId;

before(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', ['teste.periodos.%@loccar.test']);
  const hash = await bcrypt.hash(SENHA, 10);
  const u = await pool.query(
    `INSERT INTO users (tenant_id, name, email, password_hash, role)
     VALUES ($1,'Dono Periodos',$2,$3,'owner') RETURNING id`,
    [TENANT, EMAIL, hash]
  );
  userId = u.rows[0].id;

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
  if (userId) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await new Promise((r) => servidor?.close(r));
  await pool.end();
});

test('@spec:AC-050 o período "Este mês" vai do dia 1 do mês corrente até agora', () => {
  // Relógio fixo para o teste não depender do dia em que roda.
  const agora = new Date(2026, 6, 28, 15, 30); // 28/07/2026 15:30 (local)
  const { de, ate } = intervaloDoPeriodo('mes', agora);

  const inicio = new Date(de);
  assert.equal(inicio.getDate(), 1, 'tem que começar no dia 1');
  assert.equal(inicio.getMonth(), 6, 'no mês corrente (julho)');
  assert.equal(inicio.getFullYear(), 2026);
  assert.equal(inicio.getHours(), 0, 'desde o começo do dia');
  assert.equal(new Date(ate).getTime(), agora.getTime(), 'termina agora');

  // E a opção existe na lista que a tela mostra.
  assert.ok(PERIODOS.some((p) => p.value === 'mes'));
});

test('@spec:AC-050 as janelas móveis continuam contando para trás a partir de agora', () => {
  const agora = new Date(2026, 6, 28, 12, 0);
  const { de } = intervaloDoPeriodo('30', agora);
  const dias = Math.round((agora.getTime() - new Date(de).getTime()) / 86400000);
  assert.equal(dias, 30);
});

test('@spec:AC-051 a resposta identifica cada campo com problema', async () => {
  const res = await fetch(base + '/api/vehicles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ model: 'Só o modelo' }), // faltam placa, categoria e diária
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.ok(body.error, 'a frase principal continua existindo');
  assert.ok(body.details, 'a resposta precisa dizer quais campos falharam');

  // A tela usa exatamente essas chaves para marcar o campo em vermelho.
  assert.ok(body.details.plate, 'placa deveria constar como campo com erro');
  assert.ok(body.details.category, 'categoria deveria constar como campo com erro');
  assert.ok(body.details.daily_rate, 'valor da diária deveria constar como campo com erro');

  // Cada campo traz pelo menos uma mensagem legível.
  for (const [campo, mensagens] of Object.entries(body.details)) {
    assert.ok(Array.isArray(mensagens) && mensagens.length > 0, `campo ${campo} sem mensagem`);
  }
});
