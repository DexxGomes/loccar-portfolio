// ============================================================================
//  Conexão com o PostgreSQL (Supabase) usando o pool do node-postgres.
//  Exporta:
//    - pool: o pool de conexões
//    - query(text, params): atalho para consultas simples
//    - withTransaction(fn): executa fn dentro de uma transação (BEGIN/COMMIT)
// ============================================================================
import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

// Bancos locais não usam SSL; Supabase e a maioria dos gerenciados exigem SSL.
const isLocal = /localhost|127\.0\.0\.1/.test(env.DATABASE_URL);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

// Loga erros de clientes ociosos para não derrubar o processo silenciosamente.
pool.on('error', (err) => {
  console.error('Erro inesperado no pool do PostgreSQL:', err);
});

/**
 * Executa uma consulta simples (com parâmetros posicionais $1, $2, ...).
 */
export async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Executa uma função dentro de uma transação.
 * Faz COMMIT em caso de sucesso e ROLLBACK se qualquer erro for lançado.
 * Útil, por exemplo, para criar reserva + validar disponibilidade de forma atômica.
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
