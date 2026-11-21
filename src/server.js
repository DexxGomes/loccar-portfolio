// ============================================================================
//  Ponto de entrada da aplicação. Sobe o servidor HTTP e trata o encerramento.
// ============================================================================
import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { startScheduler, stopScheduler } from './jobs/scheduler.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`🚗 API Locadoras rodando em http://localhost:${env.PORT} (${env.NODE_ENV})`);
  startScheduler();
});

// Encerramento gracioso: fecha o servidor e o pool do banco.
async function shutdown(signal) {
  console.log(`\n${signal} recebido. Encerrando...`);
  stopScheduler();
  server.close(async () => {
    try {
      await pool.end();
    } finally {
      process.exit(0);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
