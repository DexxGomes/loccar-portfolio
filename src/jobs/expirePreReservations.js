// ============================================================================
//  Job: expira as pré-reservas sem documentos que passaram do prazo (24h).
// ============================================================================
import { expireOverduePreReservations } from '../repositories/reservationRepository.js';

export async function runExpirePreReservations() {
  try {
    const expiradas = await expireOverduePreReservations();
    if (expiradas.length > 0) {
      console.log(`⏳ Pré-reservas expiradas: ${expiradas.length}`);
    }
  } catch (err) {
    console.error('Erro no job de expiração:', err);
  }
}
