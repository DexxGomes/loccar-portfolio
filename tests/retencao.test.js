// ============================================================================
//  TESTES — RETENÇÃO DE DOCUMENTOS
//
//  Este job APAGA foto de CNH de cliente. Errar a conta aqui tem dois lados,
//  e os dois são ruins: apagar cedo demais destrói prova que o dono precisa
//  numa contestação; apagar tarde demais (ou nunca) deixa documento sensível
//  guardado para vazar numa invasão.
//
//  Por isso os testes cobrem os dois erros — o que ENTRA e, principalmente, o
//  que NÃO PODE entrar na varredura.
//
//  A suíte cria a PRÓPRIA locadora e apaga tudo no fim (cascata do tenant).
//
//  Rodar:  npm test
// ============================================================================
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const { pool } = await import('../src/config/db.js');
const { listDocumentsToPurge, markDocumentPurged } = await import(
  '../src/repositories/documentRepository.js'
);

const marca = Date.now();
const criado = {};

// Contador para dar um telefone diferente a cada cliente criado aqui.
// Antes isto era Math.random()*10 e o teste ficava instável: três sorteios em
// dez valores repetem em ~28% das rodadas, a chave única (tenant_id, phone)
// estourava, o before quebrava e os cinco testes caíam juntos — parecendo
// regressão quando era só sorte ruim. Sequência não colide nunca.
let sequenciaCliente = 0;

/** Cria uma locação já com documento e devolve o id do documento. */
async function criarLocacaoComDocumento({ status, devolucaoDiasAtras }) {
  sequenciaCliente += 1;
  const cliente = await pool.query(
    `INSERT INTO customers (tenant_id, name, phone) VALUES ($1,$2,$3) RETURNING id`,
    [criado.tenant, 'Cliente Retenção', `55349${String(marca).slice(-7)}${sequenciaCliente}`]
  );
  const r = await pool.query(
    `INSERT INTO reservations
       (tenant_id, vehicle_id, customer_id, pickup_at, return_at,
        daily_rate_snapshot, deposit_snapshot, days_count, total_amount, status)
     VALUES ($1,$2,$3,
             now() - ($4 || ' days')::interval - interval '2 days',
             now() - ($4 || ' days')::interval,
             100, 0, 2, 200, $5)
     RETURNING id`,
    [criado.tenant, criado.vehicle, cliente.rows[0].id, String(devolucaoDiasAtras), status]
  );
  const doc = await pool.query(
    `INSERT INTO documents (tenant_id, reservation_id, customer_id, type, storage_path, mime_type)
     VALUES ($1,$2,$3,'cnh_frente',$4,'image/jpeg') RETURNING id`,
    [
      criado.tenant,
      r.rows[0].id,
      cliente.rows[0].id,
      `tenants/${criado.tenant}/teste-retencao/${marca}-${status}-${devolucaoDiasAtras}.jpg`,
    ]
  );
  return doc.rows[0].id;
}

before(async () => {
  const t = await pool.query(
    `INSERT INTO tenants (name, phone_number_id) VALUES ($1,$2) RETURNING id`,
    [`Retencao ${marca}`, `retencao-${marca}`]
  );
  criado.tenant = t.rows[0].id;

  const v = await pool.query(
    `INSERT INTO vehicles (tenant_id, model, plate, category, daily_rate)
     VALUES ($1,'Carro Retencao',$2,'hatch',100) RETURNING id`,
    [criado.tenant, `RET${String(marca).slice(-4)}`]
  );
  criado.vehicle = v.rows[0].id;

  // Devolvido há 200 dias: passou de qualquer prazo razoável de guarda.
  criado.docAntigoFinalizado = await criarLocacaoComDocumento({
    status: 'finalizada',
    devolucaoDiasAtras: 200,
  });
  // Devolvido há 10 dias: ainda dentro do prazo.
  criado.docRecente = await criarLocacaoComDocumento({
    status: 'finalizada',
    devolucaoDiasAtras: 10,
  });
  // Locação ANTIGA que nunca foi encerrada (o carro segue na rua).
  criado.docEmAndamento = await criarLocacaoComDocumento({
    status: 'em_andamento',
    devolucaoDiasAtras: 200,
  });
});

after(async () => {
  if (criado.tenant) await pool.query('DELETE FROM tenants WHERE id = $1', [criado.tenant]);
  await pool.end();
});

test('@spec:AC-131 documento de locação encerrada além do prazo entra na varredura', async () => {
  const vencidos = await listDocumentsToPurge(180);
  const ids = vencidos.map((d) => d.id);
  assert.ok(
    ids.includes(criado.docAntigoFinalizado),
    'documento de locação finalizada há 200 dias deveria ser descartado com prazo de 180'
  );
});

test('@spec:AC-132 documento dentro do prazo de guarda NÃO é descartado', async () => {
  const vencidos = await listDocumentsToPurge(180);
  const ids = vencidos.map((d) => d.id);
  assert.ok(
    !ids.includes(criado.docRecente),
    'documento de locação devolvida há 10 dias não pode ser apagado com prazo de 180'
  );
});

test('@spec:AC-133 locação ainda em andamento nunca perde o documento', async () => {
  // Prazo de 1 dia: mesmo no cenário mais agressivo possível, o carro que está
  // na rua mantém a CNH do condutor. É o documento que prova quem está com ele.
  const vencidos = await listDocumentsToPurge(1);
  const ids = vencidos.map((d) => d.id);
  assert.ok(
    !ids.includes(criado.docEmAndamento),
    'locação em andamento não pode perder o documento, por mais antiga que seja'
  );
});

test('@spec:AC-134 descartar apaga o caminho do arquivo e mantém o registro', async () => {
  await markDocumentPurged(criado.docAntigoFinalizado);

  const { rows } = await pool.query(
    'SELECT storage_path, purged_at, type FROM documents WHERE id = $1',
    [criado.docAntigoFinalizado]
  );
  assert.equal(rows.length, 1, 'o registro do documento não pode sumir');
  assert.equal(rows[0].storage_path, null, 'o caminho do arquivo deveria ficar vazio');
  assert.ok(rows[0].purged_at, 'deveria registrar QUANDO o arquivo foi descartado');
  assert.equal(rows[0].type, 'cnh_frente', 'o tipo do documento entregue continua registrado');
});

test('@spec:AC-135 documento já descartado não volta na varredura', async () => {
  const vencidos = await listDocumentsToPurge(180);
  const ids = vencidos.map((d) => d.id);
  assert.ok(
    !ids.includes(criado.docAntigoFinalizado),
    'documento sem arquivo não pode ser varrido de novo'
  );
});
