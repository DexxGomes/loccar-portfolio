// ============================================================================
//  Indicadores do painel.
//  Junta as consultas do repositório, calcula o que é derivado (variação,
//  ocupação, conversão) e devolve um objeto pronto para a tela desenhar.
//
//  Comparação: o período anterior tem exatamente o mesmo tamanho do atual
//  (30 dias contra os 30 anteriores), então a variação é justa.
// ============================================================================
import { z } from 'zod';
import * as repo from '../repositories/dashboardRepository.js';
import * as money from '../repositories/moneyRepository.js';

const DIA_MS = 24 * 60 * 60 * 1000;

// Aceita from/to em ISO; se vierem vazios, usa os últimos 30 dias.
const filtrosSchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

/** Variação percentual entre dois números (protegida contra divisão por zero). */
function variacao(atual, anterior) {
  if (!anterior) return atual > 0 ? 100 : 0;
  return Number((((atual - anterior) / anterior) * 100).toFixed(1));
}

/**
 * Instante da PRÓXIMA meia-noite no fuso da locadora (fim do dia de hoje).
 *
 * Por que isso importa: se o limite superior do período fosse "agora", uma
 * reserva criada neste segundo poderia ficar de fora — o relógio do banco e o
 * do servidor não são idênticos, e alguns segundos de diferença já sumiriam
 * com o registro. Fechando no fim do dia, o dia corrente entra inteiro e a
 * contagem para de depender de sincronia de relógio.
 */
function fimDoDia(timezone, base = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p = Object.fromEntries(fmt.formatToParts(base).map((x) => [x.type, x.value]));
  // Diferença entre a hora local do fuso e o UTC, no instante atual.
  const comoUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  const deslocamento = comoUTC - base.getTime();
  // Meia-noite do dia seguinte, no fuso, convertida de volta para instante real.
  const proximaMeiaNoite = Date.UTC(p.year, p.month - 1, Number(p.day) + 1);
  return new Date(proximaMeiaNoite - deslocamento);
}

/** Resolve a janela pedida e a janela anterior de mesmo tamanho. */
function resolverPeriodo({ from, to }, timezone) {
  const fim = to ? new Date(to) : fimDoDia(timezone);
  const inicio = from ? new Date(from) : new Date(fim.getTime() - 30 * DIA_MS);
  const duracao = Math.max(fim - inicio, DIA_MS);
  return {
    inicio,
    fim,
    duracaoDias: duracao / DIA_MS,
    inicioAnterior: new Date(inicio.getTime() - duracao),
    fimAnterior: inicio,
  };
}

/**
 * Agenda de hoje: retiradas e devoluções do dia (+ atrasadas), para o sino de
 * lembretes. Leve de propósito — é chamado com frequência pelo painel.
 */
export async function getHoje(tenant) {
  const tz = tenant.timezone || 'America/Sao_Paulo';
  const eventos = await repo.agendaDoDia(tenant.id, tz);
  const retiradas = eventos.filter((e) => e.tipo === 'retirada');
  const devolucoes = eventos.filter((e) => e.tipo === 'devolucao');
  const atrasadas = eventos.filter((e) => e.atrasada);
  return {
    eventos,
    resumo: {
      retiradas: retiradas.length,
      devolucoes: devolucoes.length,
      atrasadas: atrasadas.length,
      total: eventos.length,
    },
  };
}

/**
 * Retrato do dinheiro: junta o que entrou, o que falta receber, o que venceu,
 * o que foi gasto e o que é de terceiros — a resposta para "como está o meu
 * dinheiro?" sem precisar abrir três telas.
 *
 * O SALDO é a conta que interessa: entrou menos gastos no período.
 */
export async function getDinheiro(tenant, filtros = {}) {
  const { from, to } = filtrosSchema.parse({
    from: filtros.from || undefined,
    to: filtros.to || undefined,
  });

  const tz = tenant.timezone || 'America/Sao_Paulo';
  const { inicio, fim } = resolverPeriodo({ from, to }, tz);

  const [r, categorias] = await Promise.all([
    money.retrato(tenant.id, inicio, fim),
    money.gastosPorCategoria(tenant.id, inicio, fim),
  ]);

  const entrou = r.entrou || 0;
  const gastos = r.gastos || 0;

  return {
    periodo: { de: inicio.toISOString(), ate: fim.toISOString() },
    entrou: { valor: entrou, qtd: r.qtd_entrou },
    gastos: { valor: gastos, qtd: r.qtd_gastos, porCategoria: categorias },
    saldo: { valor: Number((entrou - gastos).toFixed(2)), positivo: entrou - gastos >= 0 },
    aReceber: { valor: r.a_receber || 0, qtd: r.qtd_a_receber },
    vencido: { valor: r.vencido || 0, qtd: r.qtd_vencido },
    caucaoEmMaos: { valor: r.caucao_em_maos || 0 },
    multasARepassar: { valor: r.multas_a_repassar || 0, qtd: r.qtd_multas },
  };
}

/** Monta todos os indicadores do painel para o período pedido. */
export async function getDashboard(tenant, filtros = {}) {
  const { from, to } = filtrosSchema.parse({
    from: filtros.from || undefined,
    to: filtros.to || undefined,
  });

  const tz = tenant.timezone || 'America/Sao_Paulo';
  const { inicio, fim, duracaoDias, inicioAnterior, fimAnterior } = resolverPeriodo(
    { from, to },
    tz
  );

  // Tudo em paralelo: são consultas independentes.
  const [
    atual,
    anterior,
    serie,
    frota,
    ocupados,
    status,
    top,
    conversas,
    pend,
    eventos,
    prevista,
  ] = await Promise.all([
    repo.resumoPeriodo(tenant.id, inicio, fim),
    repo.resumoPeriodo(tenant.id, inicioAnterior, fimAnterior),
    repo.serieDiaria(tenant.id, inicio, fim, tz),
    repo.frota(tenant.id),
    repo.diasOcupados(tenant.id, inicio, fim),
    repo.porStatus(tenant.id, inicio, fim),
    repo.topVeiculos(tenant.id, inicio, fim, 5),
    repo.conversasNoPeriodo(tenant.id, inicio, fim),
    repo.pendencias(tenant.id),
    repo.proximosEventos(tenant.id, 7),
    repo.receitaPrevista(tenant.id),
  ]);

  // Ocupação = dias-veículo alugados ÷ dias-veículo disponíveis na janela.
  const capacidade = (frota.total || 0) * duracaoDias;
  const ocupacao = capacidade > 0 ? Number(((ocupados / capacidade) * 100).toFixed(1)) : 0;

  // Funil: conversa no WhatsApp → pré-reserva criada → confirmada pelo dono.
  const mapaStatus = Object.fromEntries(status.map((s) => [s.status, s.total]));
  const criadas = status.reduce((soma, s) => soma + s.total, 0);
  const confirmadas =
    (mapaStatus.confirmada || 0) + (mapaStatus.em_andamento || 0) + (mapaStatus.finalizada || 0);

  return {
    periodo: {
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      dias: Math.round(duracaoDias),
      timezone: tz,
    },

    // Cartões do topo
    indicadores: {
      receita: { valor: atual.receita, variacao: variacao(atual.receita, anterior.receita) },
      reservas: { valor: atual.reservas, variacao: variacao(atual.reservas, anterior.reservas) },
      ticketMedio: {
        valor: atual.ticket_medio,
        variacao: variacao(atual.ticket_medio, anterior.ticket_medio),
      },
      ocupacao: { valor: ocupacao, diarias: atual.diarias },
      // Não entra na receita do período: é o que já está contratado e ainda
      // vai sair da garagem (retirada no futuro, reserva confirmada).
      previsto: { valor: prevista.valor, reservas: prevista.reservas },
    },

    serie,
    frota,
    funil: {
      conversas,
      criadas,
      emAnalise: mapaStatus.em_analise || 0,
      confirmadas,
      recusadas: (mapaStatus.recusada || 0) + (mapaStatus.cancelada || 0),
      expiradas: mapaStatus.expirada || 0,
      // Sem conversas no período não existe taxa: devolvemos null para a tela
      // mostrar "—" em vez de fingir 0%.
      conversao: conversas > 0 ? Number(((confirmadas / conversas) * 100).toFixed(1)) : null,
    },
    porStatus: status,
    topVeiculos: top,
    pendencias: pend,
    proximosEventos: eventos,
  };
}
