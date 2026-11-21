// ============================================================================
//  TESTES — EXCLUSÃO LGPD APAGA TUDO MESMO
//
//  O painel promete "apaga TODOS os dados e documentos deste cliente". As
//  linhas do banco somem por cascata, mas ARQUIVO no bucket não tem cascata:
//  se a lista de caminhos esquecer uma origem, a foto do cliente fica lá
//  depois de ele pedir a exclusão.
//
//  Este teste cria arquivo nas TRÊS origens (documento da reserva, imagem da
//  conversa e foto de vistoria) e exige que as três entrem na lista.
//
//  Rodar:  npm test
// ============================================================================
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const { pool } = await import('../src/config/db.js');
const { listStoragePathsByCustomer } = await import('../src/repositories/documentRepository.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const marca = Date.now();

const CAMINHOS = {
  documento: `tenants/${TENANT}/teste-lgpd/${marca}-documento.jpg`,
  conversa: `tenants/${TENANT}/teste-lgpd/${marca}-conversa.jpg`,
  vistoria: `tenants/${TENANT}/teste-lgpd/${marca}-vistoria.jpg`,
};

const criados = {};

before(async () => {
  const c = await pool.query(
    `INSERT INTO customers (tenant_id, name, phone) VALUES ($1,'Cliente LGPD',$2) RETURNING id`,
    [TENANT, `55349${String(marca).slice(-8)}`]
  );
  criados.customer = c.rows[0].id;

  const v = await pool.query(
    `INSERT INTO vehicles (tenant_id, model, plate, category, daily_rate)
     VALUES ($1,'Carro LGPD',$2,'hatch',100) RETURNING id`,
    [TENANT, `LGP${String(marca).slice(-4)}`]
  );
  criados.vehicle = v.rows[0].id;

  const r = await pool.query(
    `INSERT INTO reservations
       (tenant_id, vehicle_id, customer_id, pickup_at, return_at,
        daily_rate_snapshot, deposit_snapshot, days_count, total_amount, status)
     VALUES ($1,$2,$3, now() + interval '120 days', now() + interval '122 days',
             100, 0, 2, 200, 'confirmada') RETURNING id`,
    [TENANT, criados.vehicle, criados.customer]
  );
  criados.reservation = r.rows[0].id;

  // (1) Documento enviado para a reserva
  await pool.query(
    `INSERT INTO documents (tenant_id, reservation_id, customer_id, type, storage_path, mime_type)
     VALUES ($1,$2,$3,'cnh_frente',$4,'image/jpeg')`,
    [TENANT, criados.reservation, criados.customer, CAMINHOS.documento]
  );

  // (2) Imagem que o cliente mandou na conversa do WhatsApp
  const conv = await pool.query(
    `INSERT INTO conversations (tenant_id, customer_id, phone)
     VALUES ($1,$2,$3) RETURNING id`,
    [TENANT, criados.customer, `55349${String(marca).slice(-8)}`]
  );
  criados.conversation = conv.rows[0].id;
  await pool.query(
    `INSERT INTO messages (tenant_id, conversation_id, direction, type, media_storage_path)
     VALUES ($1,$2,'inbound','image',$3)`,
    [TENANT, criados.conversation, CAMINHOS.conversa]
  );

  // (3) Foto da vistoria da locação dele
  const insp = await pool.query(
    `INSERT INTO inspections (tenant_id, reservation_id, vehicle_id, type, odometer, fuel_level)
     VALUES ($1,$2,$3,'retirada',10000,8) RETURNING id`,
    [TENANT, criados.reservation, criados.vehicle]
  );
  criados.inspection = insp.rows[0].id;
  await pool.query(
    `INSERT INTO inspection_photos (tenant_id, inspection_id, position, storage_path, mime_type)
     VALUES ($1,$2,'frente',$3,'image/jpeg')`,
    [TENANT, criados.inspection, CAMINHOS.vistoria]
  );
});

after(async () => {
  // A reserva cai em cascata com vistorias/documentos; conversa idem.
  if (criados.reservation)
    await pool.query('DELETE FROM reservations WHERE id = $1', [criados.reservation]);
  if (criados.conversation)
    await pool.query('DELETE FROM conversations WHERE id = $1', [criados.conversation]);
  if (criados.customer)
    await pool.query('DELETE FROM customers WHERE id = $1', [criados.customer]);
  if (criados.vehicle) await pool.query('DELETE FROM vehicles WHERE id = $1', [criados.vehicle]);
  await pool.end();
});

test('@spec:AC-045 a exclusão LGPD enxerga o documento enviado para a reserva', async () => {
  const paths = await listStoragePathsByCustomer(TENANT, criados.customer);
  assert.ok(paths.includes(CAMINHOS.documento), 'documento da reserva ficou de fora');
});

test('@spec:AC-046 a exclusão LGPD enxerga a imagem enviada na conversa do WhatsApp', async () => {
  const paths = await listStoragePathsByCustomer(TENANT, criados.customer);
  assert.ok(paths.includes(CAMINHOS.conversa), 'imagem da conversa ficou de fora');
});

test('@spec:AC-047 a exclusão LGPD enxerga a foto da vistoria da locação', async () => {
  const paths = await listStoragePathsByCustomer(TENANT, criados.customer);
  assert.ok(paths.includes(CAMINHOS.vistoria), 'foto de vistoria ficou de fora');
});

test('@spec:AC-048 não devolve arquivo repetido nem caminho vazio', async () => {
  const paths = await listStoragePathsByCustomer(TENANT, criados.customer);
  assert.equal(new Set(paths).size, paths.length, 'veio caminho repetido');
  assert.ok(paths.every(Boolean), 'veio caminho vazio na lista');
});

test('@spec:AC-049 não devolve arquivo de OUTRO cliente', async () => {
  const outro = await pool.query(
    `INSERT INTO customers (tenant_id, name, phone) VALUES ($1,'Outro',$2) RETURNING id`,
    [TENANT, `55349${String(marca + 1).slice(-8)}`]
  );
  try {
    const paths = await listStoragePathsByCustomer(TENANT, outro.rows[0].id);
    assert.equal(paths.length, 0, 'trouxe arquivo de quem não pediu exclusão');
  } finally {
    await pool.query('DELETE FROM customers WHERE id = $1', [outro.rows[0].id]);
  }
});
