// ============================================================================
//  Formatação (pt-BR) e rótulos de status usados em todo o painel.
// ============================================================================

const FMT_MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** Data e hora curtas: 21/07/26 14:30 */
export function dt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Só a data: 21/07 */
export function data(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Só a hora: 14:30 */
export function hora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Dia por extenso curto: seg, 21 jul */
export function diaExtenso(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

/** Tempo relativo simples: "agora", "há 5 min", "há 2 h", "há 3 d". */
export function relativo(iso) {
  if (!iso) return '—';
  const seg = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seg < 60) return 'agora';
  if (seg < 3600) return `há ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`;
  if (seg < 604800) return `há ${Math.floor(seg / 86400)} d`;
  return data(iso);
}

/** Valor em reais: R$ 1.234,50 */
export function brl(v) {
  if (v == null || v === '') return '—';
  return FMT_MOEDA.format(Number(v));
}

/** Valor resumido para cartões de indicador: R$ 24,8 mil */
export function brlCurto(v) {
  const n = Number(v || 0);
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1).replace('.', ',')} mil`;
  return brl(n);
}

/** Telefone E.164 do WhatsApp em formato legível: (34) 99999-9999 */
export function telefone(e164) {
  if (!e164) return '—';
  const d = String(e164).replace(/\D/g, '');
  const semPais = d.startsWith('55') ? d.slice(2) : d;
  if (semPais.length === 11)
    return `(${semPais.slice(0, 2)}) ${semPais.slice(2, 7)}-${semPais.slice(7)}`;
  if (semPais.length === 10)
    return `(${semPais.slice(0, 2)}) ${semPais.slice(2, 6)}-${semPais.slice(6)}`;
  return e164;
}

/** CPF mascarado para exibição: 123.456.789-00 */
export function cpf(valor) {
  const d = String(valor || '').replace(/\D/g, '');
  if (d.length !== 11) return valor || '—';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Rótulos e cores de cada situação da reserva. */
export const STATUS = {
  pre_reserva: {
    label: 'Pré-reserva',
    cls: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/30',
    dot: 'bg-amber-500',
  },
  aguardando_documentos: {
    label: 'Aguardando docs',
    cls: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/30',
    dot: 'bg-amber-500',
  },
  em_analise: {
    label: 'Em análise',
    cls: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-orange-200 dark:ring-orange-500/30',
    dot: 'bg-orange-500',
  },
  confirmada: {
    label: 'Confirmada',
    cls: 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-500/30',
    dot: 'bg-sky-500',
  },
  em_andamento: {
    label: 'Em andamento',
    cls: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  finalizada: {
    label: 'Finalizada',
    cls: 'bg-sutil text-conteudo-2 ring-borda',
    dot: 'bg-suave-2',
  },
  cancelada: { label: 'Cancelada', cls: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-500/30', dot: 'bg-red-500' },
  recusada: { label: 'Recusada', cls: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-500/30', dot: 'bg-red-500' },
  expirada: {
    label: 'Expirada',
    cls: 'bg-sutil text-suave ring-borda',
    dot: 'bg-suave-2',
  },
};

/** Situação do veículo na frota. */
/**
 * Só deixa passar link que aponta para a web de verdade.
 *
 * Um `href` recebido de fora (a fatura vem do provedor de cobrança) que
 * chegasse como `javascript:...` viraria código executando dentro do painel
 * ao ser clicado. O React escapa TEXTO sozinho, mas não julga endereço — essa
 * parte é nossa.
 *
 * Devolve null quando o endereço não presta; a tela então não mostra o link.
 */
export function linkSeguro(url) {
  if (!url) return null;
  try {
    const u = new URL(String(url), window.location.origin);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export const STATUS_VEICULO = {
  disponivel: { label: 'Disponível', tone: 'green' },
  alugado: { label: 'Alugado', tone: 'brand' },
  manutencao: { label: 'Manutenção', tone: 'amber' },
};
