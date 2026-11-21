// ============================================================================
//  Utilitários de data para a locação.
// ============================================================================

/**
 * Calcula o número de diárias (períodos de 24h) entre retirada e devolução.
 * Regra: arredonda para cima e nunca é menor que 1.
 *   0h..24h   -> 1 diária
 *   24h..48h  -> 2 diárias, e assim por diante.
 * @param {Date|string} pickup
 * @param {Date|string} ret
 * @returns {number}
 */
export function calcDays(pickup, ret) {
  const ms = new Date(ret).getTime() - new Date(pickup).getTime();
  const horas = ms / (1000 * 60 * 60);
  return Math.max(1, Math.ceil(horas / 24));
}

/**
 * Calcula o valor total (diárias x valor da diária). A caução é informada à parte.
 * @returns {number} valor com 2 casas decimais
 */
export function calcTotal(days, dailyRate) {
  return Math.round(days * Number(dailyRate) * 100) / 100;
}
