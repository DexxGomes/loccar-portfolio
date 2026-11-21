// ============================================================================
//  Renomeia uma locadora (tenant) — troca o nome que aparece no painel.
//
//  Uso:
//    node scripts/renameTenant.js "<novo nome>" [tenantId]
//
//  Se o tenantId for omitido, renomeia a locadora demo do seed:
//    00000000-0000-0000-0000-000000000001
//
//  Serve pra tirar o "Locadora Demo" do painel sem perder os dados que já
//  existem (veículos, reservas, clientes continuam ligados ao mesmo tenant).
// ============================================================================
import { pool } from '../src/config/db.js';

const DEMO_ID = '00000000-0000-0000-0000-000000000001';
const [, , novoNome, tenantIdArg] = process.argv;
const tenantId = tenantIdArg || DEMO_ID;

if (!novoNome || !novoNome.trim()) {
  console.error('Uso: node scripts/renameTenant.js "<novo nome>" [tenantId]');
  process.exit(1);
}

try {
  const { rows } = await pool.query(
    `UPDATE tenants SET name = $2 WHERE id = $1
     RETURNING id, name`,
    [tenantId, novoNome.trim()]
  );

  if (rows.length === 0) {
    console.error(`❌ Nenhuma locadora com id ${tenantId}. Confira o tenantId.`);
    process.exitCode = 1;
  } else {
    console.log('✅ Locadora renomeada:', rows[0]);
    console.log('   Faça logout e login de novo no painel para ver o nome novo.');
  }
} catch (err) {
  console.error('❌ Erro ao renomear locadora:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
