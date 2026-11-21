// ============================================================================
//  TESTES — NÚMERO COMPARTILHADO (WhatsApp pessoal + locadora no mesmo chip)
//
//  A promessa que estes testes protegem: mensagem de contato particular NÃO
//  DEIXA RASTRO. Não vira cliente, não vira conversa, não vira mensagem. Se
//  algum dia alguém mudar a ordem das checagens no inbound.js e a gravação
//  passar na frente do descarte, é aqui que quebra.
//
//  A suíte cria a PRÓPRIA locadora e apaga tudo no fim (cascata do tenant).
//
//  Rodar:  npm test
// ============================================================================
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const { pool } = await import('../src/config/db.js');
const { processWebhookPayload } = await import('../src/services/inbound.js');
const { pareceAssuntoDeLocadora } = await import('../src/services/triagem.js');
const { isPrivateContact, addPrivateContact, marcarIaEngajada } = await import(
  '../src/repositories/privateContactRepository.js'
);

const marca = Date.now();
const criado = {};

const TEL_FAMILIA = `55349${String(marca).slice(-8)}`;
const TEL_CLIENTE = `55349${String(marca - 1).slice(-8)}`;

/** Monta um payload de webhook igual ao que a Meta manda. */
function payloadDeTexto(de, texto, idSufixo) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: criado.phoneNumberId },
              contacts: [{ profile: { name: 'Fulano' } }],
              messages: [
                {
                  id: `wamid.teste.${marca}.${idSufixo}`,
                  from: de,
                  type: 'text',
                  text: { body: texto },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

before(async () => {
  criado.phoneNumberId = `pnid-compartilhado-${marca}`;
  const t = await pool.query(
    `INSERT INTO tenants (name, phone_number_id, shared_number)
     VALUES ($1, $2, TRUE) RETURNING id`,
    [`Compartilhado ${marca}`, criado.phoneNumberId]
  );
  criado.tenant = t.rows[0].id;

  await addPrivateContact(criado.tenant, { phone: TEL_FAMILIA, label: 'Mãe' });
});

after(async () => {
  if (criado.tenant) await pool.query('DELETE FROM tenants WHERE id = $1', [criado.tenant]);
  await pool.end();
});

// ---------------------------------------------------------------- triagem

test('@spec:AC-136 reconhece mensagem de quem quer alugar', () => {
  const clientes = [
    'Tem veículo disponível pro fim de semana?',
    'Qual o preço da diária?',
    'Bom dia, gostaria de alugar um carro',
    'quanto custa pra 3 dias',
  ];
  for (const msg of clientes) {
    assert.equal(pareceAssuntoDeLocadora(msg), true, `deveria atender: ${msg}`);
  }
});

test('@spec:AC-137 não confunde conversa pessoal com cliente', () => {
  const pessoais = ['Mãe, já chegou?', 'vamos almoçar amanhã?', 'bom dia', '', null];
  for (const msg of pessoais) {
    assert.equal(pareceAssuntoDeLocadora(msg), false, `não deveria atender: ${msg}`);
  }
});

test('@spec:AC-138 acento não muda o resultado da triagem', () => {
  assert.equal(pareceAssuntoDeLocadora('VEÍCULO DISPONÍVEL?'), true);
  assert.equal(pareceAssuntoDeLocadora('veiculo disponivel?'), true);
});

// ------------------------------------------------------- contato particular

test('@spec:AC-139 número cadastrado como particular é reconhecido', async () => {
  assert.equal(await isPrivateContact(criado.tenant, TEL_FAMILIA), true);
  assert.equal(await isPrivateContact(criado.tenant, TEL_CLIENTE), false);
});

test('@spec:AC-140 mensagem de contato particular NÃO deixa rastro no banco', async () => {
  await processWebhookPayload(payloadDeTexto(TEL_FAMILIA, 'Filho, jantar às 8?', 'fam'));

  const cliente = await pool.query(
    'SELECT 1 FROM customers WHERE tenant_id = $1 AND phone = $2',
    [criado.tenant, TEL_FAMILIA]
  );
  assert.equal(cliente.rows.length, 0, 'não podia ter criado cliente');

  const conversa = await pool.query(
    'SELECT 1 FROM conversations WHERE tenant_id = $1 AND phone = $2',
    [criado.tenant, TEL_FAMILIA]
  );
  assert.equal(conversa.rows.length, 0, 'não podia ter criado conversa');

  const mensagens = await pool.query(
    `SELECT 1 FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
      WHERE c.tenant_id = $1 AND c.phone = $2`,
    [criado.tenant, TEL_FAMILIA]
  );
  assert.equal(mensagens.rows.length, 0, 'não podia ter guardado a mensagem');
});

test('@spec:AC-141 o descarte não some com o número de um cliente de verdade', async () => {
  assert.equal(await isPrivateContact(criado.tenant, TEL_CLIENTE), false);
});

// -------------------------------------------------------------- ai_engaged

test('@spec:AC-142 conversa liberada pelo dono não passa mais pela triagem', async () => {
  const conv = await pool.query(
    `INSERT INTO conversations (tenant_id, phone) VALUES ($1, $2) RETURNING id, ai_engaged`,
    [criado.tenant, TEL_CLIENTE]
  );
  assert.equal(conv.rows[0].ai_engaged, false, 'conversa nova começa sem atendimento liberado');

  await marcarIaEngajada(conv.rows[0].id);

  const depois = await pool.query('SELECT ai_engaged FROM conversations WHERE id = $1', [
    conv.rows[0].id,
  ]);
  assert.equal(depois.rows[0].ai_engaged, true, 'depois de liberar, a IA segue atendendo');
});
