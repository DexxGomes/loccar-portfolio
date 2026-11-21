// ============================================================================
//  Define o telefone do DONO para receber avisos de "precisa de humano".
//
//  Uso:
//    node scripts/setOwnerAlert.js <telefone> [tenantId]
//
//  O telefone é normalizado para só dígitos (E.164 sem "+"), ex: 5534999998888.
//  Sem tenantId, usa a locadora demo do seed.
// ============================================================================
import { pool } from '../src/config/db.js';

const DEMO_ID = '00000000-0000-0000-0000-000000000001';
const [, , telefoneArg, tenantIdArg] = process.argv;
const tenantId = tenantIdArg || DEMO_ID;
const telefone = (telefoneArg || '').replace(/\D/g, '');

if (!telefone) {
  console.error('Uso: node scripts/setOwnerAlert.js <telefone> [tenantId]');
  console.error('Ex.: node scripts/setOwnerAlert.js 5534999998888');
  process.exit(1);
}

try {
  const { rows } = await pool.query(
    `UPDATE tenants SET owner_alert_phone = $2 WHERE id = $1 RETURNING id, name, owner_alert_phone`,
    [tenantId, telefone]
  );
  if (rows.length === 0) {
    console.error(`❌ Nenhuma locadora com id ${tenantId}.`);
    process.exitCode = 1;
  } else {
    console.log('✅ Telefone de aviso do dono definido:', rows[0]);
    console.log('   Lembre de: criar/aprovar o template e definir OWNER_ALERT_TEMPLATE no .env/Render.');
  }
} catch (err) {
  console.error('❌ Erro:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
