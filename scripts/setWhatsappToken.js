// ============================================================================
//  Grava o whatsapp_token de uma locadora JÁ CIFRADO no banco.
//
//  Uso:
//    node scripts/setWhatsappToken.js <tenantId> "<token>"
//
//  Se o tenantId for omitido, usa a locadora demo do seed:
//    00000000-0000-0000-0000-000000000001
//
//  Precisa de ENCRYPTION_KEY no .env. O token nunca passa pelo painel/navegador
//  — só por aqui e pelo backend, sempre cifrado no banco.
// ============================================================================
import { pool } from '../src/config/db.js';
import { encrypt } from '../src/utils/crypto.js';

const DEMO_ID = '00000000-0000-0000-0000-000000000001';
const [, , arg1, arg2] = process.argv;

// Aceita as duas ordens: (tenantId, token) ou só (token) usando a demo.
let tenantId = DEMO_ID;
let token = arg1;
if (arg2 !== undefined) {
  tenantId = arg1;
  token = arg2;
}

if (!token) {
  console.error('Uso: node scripts/setWhatsappToken.js <tenantId> "<token>"');
  process.exit(1);
}

try {
  const cifrado = encrypt(token);
  const { rows } = await pool.query(
    `UPDATE tenants SET whatsapp_token = $2 WHERE id = $1
     RETURNING id, name`,
    [tenantId, cifrado]
  );
  if (rows.length === 0) {
    console.error(`❌ Nenhuma locadora com id ${tenantId}.`);
    process.exitCode = 1;
  } else {
    console.log(`✅ Token do WhatsApp gravado (cifrado) para: ${rows[0].name} (${rows[0].id}).`);
  }
} catch (err) {
  console.error('❌ Erro ao gravar o token:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
