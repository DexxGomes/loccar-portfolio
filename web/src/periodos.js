// ============================================================================
//  PERÍODOS DO RESUMO DO DINHEIRO
//
//  Fica num arquivo próprio (e não dentro da tela) porque o cálculo de data é
//  onde erro passa despercebido — assim ele tem teste.
// ============================================================================

export const PERIODOS = [
  { value: 'mes', label: 'Este mês' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 3 meses' },
  { value: '365', label: 'Último ano' },
];

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Converte a opção escolhida em um intervalo { de, ate } em ISO.
 *
 * "mes" é o MÊS FECHADO: do dia 1 do mês corrente até agora — é assim que o
 * dono fecha o caixa e conversa com o contador. Os demais são janelas móveis
 * contadas para trás a partir de agora.
 *
 * @param {string} opcao  'mes' | '30' | '90' | '365'
 * @param {Date} [agora]  injetável para o teste não depender do relógio
 */
export function intervaloDoPeriodo(opcao, agora = new Date()) {
  const ate = agora;

  if (opcao === 'mes') {
    const de = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
    return { de: de.toISOString(), ate: ate.toISOString() };
  }

  const dias = Number(opcao) || 30;
  return { de: new Date(agora.getTime() - dias * DIA_MS).toISOString(), ate: ate.toISOString() };
}
