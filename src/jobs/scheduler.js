// ============================================================================
//  Agendador de tarefas (node-cron).
//  Roda no mesmo processo do servidor. Para escalar no futuro, estes jobs
//  podem migrar para uma fila (BullMQ) sem mudar a lógica de negócio.
// ============================================================================
import cron from 'node-cron';
import { env } from '../config/env.js';
import { runSendReminders } from './sendReminders.js';
import { runExpirePreReservations } from './expirePreReservations.js';
import { runPurgeDocuments } from './purgeDocuments.js';

let tarefas = [];

/** Inicia os jobs agendados (respeita ENABLE_JOBS do .env). */
export function startScheduler() {
  if (!env.ENABLE_JOBS) {
    console.log('⏸️  Jobs agendados desativados (ENABLE_JOBS=false).');
    return;
  }

  tarefas.push(cron.schedule(env.REMINDERS_CRON, runSendReminders));
  tarefas.push(cron.schedule(env.EXPIRE_CRON, runExpirePreReservations));

  let extras = '';
  // Só agenda a varredura de retenção se ela estiver ligada — não adianta
  // acordar de madrugada para não fazer nada.
  if (env.DOCUMENT_RETENTION_DAYS > 0) {
    tarefas.push(cron.schedule(env.PURGE_CRON, runPurgeDocuments));
    extras = `, retenção de documentos a cada ${env.DOCUMENT_RETENTION_DAYS} dias (${env.PURGE_CRON})`;
  }

  console.log(
    `🕒 Jobs agendados: lembretes (${env.REMINDERS_CRON}), expiração (${env.EXPIRE_CRON})${extras}.`
  );
}

/** Para os jobs (encerramento gracioso). */
export function stopScheduler() {
  for (const t of tarefas) t.stop();
  tarefas = [];
}
