// ============================================================================
//  TRIAGEM — "isso aqui parece assunto de locadora?"
//
//  Roda ANTES de chamar a IA, e é código puro: nenhum token, custo zero.
//  Serve para o caso do número compartilhado, onde a mesma linha recebe
//  cliente e família.
//
//  A régua é DE PROPÓSITO generosa. Errar para o lado de atender é barato
//  (uma resposta sobre aluguel para a tia é constrangedor e acabou); errar
//  para o lado de calar é caro (cliente sem resposta é cliente perdido).
//
//  E quando não bate, ninguém fica no vácuo: a conversa é marcada para o dono
//  olhar, e ele libera com um toque no painel.
// ============================================================================

// Tudo em minúsculas e SEM acento — a comparação normaliza os dois lados, então
// aqui não precisa repetir "veículo" e "veiculo".
const PALAVRAS = [
  // o objeto
  'carro', 'carros', 'veiculo', 'veiculos', 'automovel', 'auto',
  'hatch', 'sedan', 'suv', 'picape', 'minivan', 'utilitario',
  // a ação
  'alugar', 'aluguel', 'aluga', 'alugo', 'locacao', 'locar', 'loca',
  'reserva', 'reservar', 'reservei', 'agendar', 'agendamento',
  // o dinheiro
  'diaria', 'diarias', 'preco', 'precos', 'valor', 'valores', 'quanto custa',
  'orcamento', 'tabela', 'caucao', 'deposito', 'pagamento', 'pix',
  // a operação
  'disponivel', 'disponiveis', 'disponibilidade', 'tem carro', 'tem algum',
  'retirada', 'retirar', 'devolucao', 'devolver', 'entrega', 'placa',
  'cnh', 'habilitacao', 'documento', 'documentos', 'contrato', 'seguro',
  // o tempo (quem pergunta prazo quase sempre quer alugar)
  'fim de semana', 'final de semana', 'por dia', 'por semana',
];

// Acentos combinantes (U+0300–U+036F). Escrito com escape de propósito: são
// caracteres invisíveis no editor, e este projeto já perdeu acentuação uma vez
// por reescrita em massa com encoding errado.
const ACENTOS_COMBINANTES = /[̀-ͯ]/g;

/** Minúsculas e sem acento, para "Veículo" casar com "veiculo". */
function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(ACENTOS_COMBINANTES, '');
}

/**
 * A mensagem parece ser de alguém querendo alugar um carro?
 *
 * @param {string|null} texto conteúdo da mensagem recebida
 * @returns {boolean}
 */
export function pareceAssuntoDeLocadora(texto) {
  const t = normalizar(texto);
  if (!t.trim()) return false;
  return PALAVRAS.some((palavra) => t.includes(palavra));
}

/**
 * Frase que explica ao DONO por que a conversa parou nele.
 * Ela aparece no painel, então é escrita para gente, não para log.
 */
export const MOTIVO_TRIAGEM =
  'Não deu para saber se é cliente: a mensagem não fala de aluguel, carro, data nem preço. ' +
  'Se for cliente, libere o atendimento automático aqui na conversa.';
