// ============================================================================
//  Job: envia os lembretes de retirada/devolução que já venceram.
// ============================================================================
import { sendDue } from '../services/reminderService.js';

export async function runSendReminders() {
  try {
    const total = await sendDue();
    if (total > 0) console.log(`📨 Lembretes processados: ${total}`);
  } catch (err) {
    console.error('Erro no job de lembretes:', err);
  }
}
