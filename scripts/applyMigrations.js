// ============================================================================
//  Aplica, em ordem, todos os arquivos de db/migrations/.
//
//  Uso:
//    npm run db:migrate
//
//  As migrações do projeto são idempotentes (CREATE ... IF NOT EXISTS e blocos
//  DO $$ para tipos), então rodar de novo não quebra nada — o que dispensa uma
//  tabela de controle nesta fase.
// ============================================================================
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from '../src/config/db.js';

const PASTA = 'db/migrations';

const arquivos = readdirSync(PASTA)
  .filter((f) => f.endsWith('.sql'))
  .sort(); // 001_, 002_, ... entram na ordem certa

if (arquivos.length === 0) {
  console.log('Nenhuma migração encontrada em db/migrations.');
  process.exit(0);
}

try {
  for (const arquivo of arquivos) {
    const sql = readFileSync(join(PASTA, arquivo), 'utf8');
    await pool.query(sql);
    console.log(`✅ ${arquivo}`);
  }
  console.log(`\n${arquivos.length} migração(ões) aplicada(s).`);
} catch (err) {
  console.error('❌ Erro ao aplicar migrações:');
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
