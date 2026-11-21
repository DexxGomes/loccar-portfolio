// ============================================================================
//  Aplica um arquivo .sql no banco usando a conexão do projeto (node-postgres).
//  Não precisa do psql instalado — só do Node e da DATABASE_URL no .env.
//
//  Uso:
//    node scripts/applySql.js db/schema.sql
//    npm run db:schema
//    npm run db:seed
// ============================================================================
import { readFileSync } from 'node:fs';
import { pool } from '../src/config/db.js';

const file = process.argv[2];

if (!file) {
  console.error('Uso: node scripts/applySql.js <arquivo.sql>');
  process.exit(1);
}

const sql = readFileSync(file, 'utf8');

try {
  // O node-postgres executa múltiplos comandos em uma string única (sem params).
  await pool.query(sql);
  console.log(`✅ Executado com sucesso: ${file}`);
} catch (err) {
  console.error(`❌ Erro ao executar ${file}:`);
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
