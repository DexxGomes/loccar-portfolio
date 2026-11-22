// ============================================================================
//  PAINEL (dashboard executivo)
//  A tela que responde, em 5 segundos: quanto entrou, o que está por vir,
//  quanto da frota está rendendo e o que precisa de mim agora.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Wallet,
  CalendarCheck,
  Receipt,
  Gauge,
  Car,
  Trophy,
  Filter,
  ArrowRight,
  Clock,
  AlertTriangle,
  ClipboardCheck,
  MessageSquare,
  Table2,
  LineChart,
  CalendarClock,
} from 'lucide-react';
import { api } from '../api.js';
import { brl, brlCurto, diaExtenso, hora, telefone } from '../format.js';
import { SkeletonStats, Skeleton } from '../components/Skeleton.jsx';
import {
  GraficoArea,
  GraficoBarras,
  GraficoFunil,
  BarraComposicao,
  Medidor,
  CORES_FROTA,
} from '../components/charts.jsx';
import {
  PageHeader,
  Card,
  CardHeader,
  Button,
  Badge,
  Segmented,
  EmptyState,
  ErrorBanner,
  IconButton,
  cx,
} from '../components/ui.jsx';

const PERIODOS = [
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: 'mes', label: 'Este mês' },
];

/** 'YYYY-MM-DD' vira data LOCAL (new Date('2026-07-01') seria UTC e voltaria um dia). */
function diaLocal(texto) {
  const [a, m, d] = texto.split('-').map(Number);
  return new Date(a, m - 1, d);
}

/** Início do dia, N dias atrás. */
function inicioDeDiasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Variação percentual com seta e cor de direção. */
function Variacao({ valor, sufixo = 'vs. período anterior' }) {
  if (valor == null) return null;
  const neutro = Math.abs(valor) < 0.05;
  const sobe = valor > 0;
  const Icone = neutro ? Minus : sobe ? TrendingUp : TrendingDown;
  return (
    <div
      className={cx(
        'flex items-center gap-1 text-[11.5px] font-medium',
        neutro ? 'text-suave-2' : sobe ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      )}
    >
      <Icone size={13} strokeWidth={2.4} />
      {neutro ? 'estável' : `${sobe ? '+' : ''}${valor}%`}
      <span className="text-suave-2 font-normal">{sufixo}</span>
    </div>
  );
}

/**
 * Cartão de indicador do topo.
 *
 * O número se ajusta à LARGURA DO CARTÃO (container query, unidade cqi): com
 * tamanho fixo, "R$ 20.202,00" a 44px saía do cartão em 1280–1440px e era
 * cortado no celular. 12cqi faz até ~13 caracteres caberem; o clamp mantém o
 * destaque grande quando há espaço e um mínimo legível quando não há.
 */
function Indicador({ icon: Icon, rotulo, valor, hero = false, className, children }) {
  return (
    <Card className={cx('p-5 [container-type:inline-size]', className)} hover>
      <div className="flex items-center gap-2 text-[12px] text-suave mb-2.5">
        <Icon size={14} strokeWidth={2.2} />
        {rotulo}
      </div>
      <div
        className={cx(
          'font-bold text-conteudo leading-none whitespace-nowrap tabular-nums',
          hero ? 'text-[length:clamp(24px,12cqi,44px)]' : 'text-[length:clamp(18px,12cqi,26px)]'
        )}
        title={typeof valor === 'string' ? valor : undefined}
      >
        {valor}
      </div>
      <div className="mt-2.5">{children}</div>
    </Card>
  );
}

export default function Painel() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [periodo, setPeriodo] = useState('30');
  const [verTabela, setVerTabela] = useState(false);

  const nav = useNavigate();

  async function carregar(silencioso = false) {
    if (!silencioso) setCarregando(true);
    setErro('');
    try {
      let q = '';
      if (periodo === '7') q = `?from=${inicioDeDiasAtras(6).toISOString()}`;
      else if (periodo === 'mes') {
        const d = new Date();
        q = `?from=${new Date(d.getFullYear(), d.getMonth(), 1).toISOString()}`;
      }
      setDados(await api.get(`/api/dashboard${q}`));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  // ------------------------------------------------------------------ dados
  const serie = useMemo(
    () =>
      (dados?.serie || []).map((s) => ({
        x: s.dia,
        y: s.receita,
        extra: `${s.reservas} reserva${s.reservas === 1 ? '' : 's'}`,
      })),
    [dados]
  );

  const totalPendencias = dados
    ? dados.pendencias.em_analise + dados.pendencias.conversas + dados.pendencias.atrasadas
    : 0;

  if (carregando) {
    return (
      <div>
        <PageHeader icon={LayoutDashboard} title="Painel" subtitle="Carregando seus números…" />
        <SkeletonStats count={4} />
        <div className="grid lg:grid-cols-3 gap-4 mt-4">
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!dados) {
    return (
      <div>
        <PageHeader icon={LayoutDashboard} title="Painel" />
        <ErrorBanner onRetry={carregar}>{erro || 'Não foi possível carregar os números.'}</ErrorBanner>
      </div>
    );
  }

  const { indicadores, frota, funil, topVeiculos, pendencias, proximosEventos, periodo: janela } =
    dados;

  return (
    <div>
      <PageHeader
        icon={LayoutDashboard}
        title="Painel"
        subtitle={`Últimos ${janela.dias} dias · fuso ${janela.timezone}`}
      >
        <Segmented value={periodo} onChange={setPeriodo} options={PERIODOS} />
        <IconButton icon={RefreshCw} label="Atualizar" onClick={() => carregar(true)} />
      </PageHeader>

      <ErrorBanner onRetry={carregar}>{erro}</ErrorBanner>

      {/* ---------------------------------------------------------------- */}
      {/* Faixa de ação: só aparece quando existe algo esperando por você    */}
      {/* ---------------------------------------------------------------- */}
      {totalPendencias > 0 && (
        <Card className="p-4 mb-5 border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
              <AlertTriangle size={17} strokeWidth={2.2} />
            </span>
            <span className="text-[13.5px] text-amber-900 dark:text-amber-200 font-medium mr-auto">
              Você tem {totalPendencias} {totalPendencias === 1 ? 'pendência' : 'pendências'}.
            </span>
            <div className="flex flex-wrap gap-2">
              {pendencias.em_analise > 0 && (
                <Button size="sm" variant="secondary" icon={ClipboardCheck} onClick={() => nav('/analise')}>
                  {pendencias.em_analise} para analisar
                </Button>
              )}
              {pendencias.conversas > 0 && (
                <Button size="sm" variant="secondary" icon={MessageSquare} onClick={() => nav('/conversas')}>
                  {pendencias.conversas} no WhatsApp
                </Button>
              )}
              {pendencias.atrasadas > 0 && (
                <Button size="sm" variant="secondary" icon={Clock} onClick={() => nav('/agenda')}>
                  {pendencias.atrasadas} em atraso
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Indicadores                                                       */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* No celular a receita ocupa a linha toda: é o número que mais importa. */}
        <Indicador
          icon={Wallet}
          rotulo="Receita no período"
          valor={brl(indicadores.receita.valor)}
          hero
          className="col-span-2 lg:col-span-1"
        >
          <Variacao valor={indicadores.receita.variacao} />
        </Indicador>

        <Indicador icon={CalendarCheck} rotulo="Locações" valor={indicadores.reservas.valor}>
          <Variacao valor={indicadores.reservas.variacao} />
        </Indicador>

        <Indicador icon={Receipt} rotulo="Ticket médio" valor={brl(indicadores.ticketMedio.valor)}>
          <Variacao valor={indicadores.ticketMedio.variacao} />
        </Indicador>

        <Indicador
          icon={Gauge}
          rotulo="Ocupação da frota"
          valor={`${indicadores.ocupacao.valor}%`}
        >
          <Medidor valor={indicadores.ocupacao.valor} />
          <div className="text-[11.5px] text-suave-2 mt-2">
            {indicadores.ocupacao.diarias} diária(s) vendidas
          </div>
        </Indicador>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Receita no tempo + frota                                          */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader
            title="Receita por dia"
            subtitle="Cada dia soma as locações que começaram nele."
            icon={LineChart}
            action={
              <IconButton
                icon={verTabela ? LineChart : Table2}
                label={verTabela ? 'Ver gráfico' : 'Ver números'}
                onClick={() => setVerTabela((v) => !v)}
              />
            }
          />
          <div className="p-4">
            {verTabela ? (
              <div className="max-h-[260px] overflow-y-auto">
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-superficie">
                    <tr className="text-left text-[11px] uppercase tracking-wider text-suave-2">
                      <th className="py-2 font-semibold">Dia</th>
                      <th className="py-2 font-semibold text-right">Locações</th>
                      <th className="py-2 font-semibold text-right">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.serie.map((s) => (
                      <tr key={s.dia} className="border-t border-borda">
                        <td className="py-2 text-conteudo-2">{diaExtenso(diaLocal(s.dia))}</td>
                        <td className="py-2 text-right text-suave">{s.reservas}</td>
                        <td className="py-2 text-right font-medium text-conteudo">
                          {brl(s.receita)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <GraficoArea
                dados={serie}
                formatarValor={(v, eixo) => (eixo ? brlCurto(v) : brl(v))}
                formatarData={(iso, completo) =>
                  completo
                    ? diaExtenso(diaLocal(iso))
                    : diaLocal(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                }
              />
            )}
          </div>
        </Card>

        <div className="space-y-4">
          {/* Receita já contratada */}
          <Card className="p-5">
            <div className="flex items-center gap-2 text-[12px] text-suave mb-2.5">
              <CalendarClock size={14} strokeWidth={2.2} />
              Já contratado (a sair)
            </div>
            <div className="text-[26px] font-bold text-conteudo leading-none">
              {brl(indicadores.previsto.valor)}
            </div>
            <div className="text-[11.5px] text-suave-2 mt-2">
              {indicadores.previsto.reservas} reserva(s) confirmada(s) com retirada futura
            </div>
          </Card>

          {/* Frota */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-[12px] text-suave">
                <Car size={14} strokeWidth={2.2} />
                Frota ({frota.total} veículos)
              </div>
              <Badge tone="slate">diária média {brl(frota.diaria_media)}</Badge>
            </div>
            {frota.total === 0 ? (
              <p className="text-[13px] text-suave-2">Nenhum veículo cadastrado ainda.</p>
            ) : (
              <BarraComposicao
                total={frota.total}
                partes={[
                  { rotulo: 'Disponíveis', valor: frota.disponiveis, cor: CORES_FROTA.disponiveis },
                  { rotulo: 'Alugados', valor: frota.alugados, cor: CORES_FROTA.alugados },
                  { rotulo: 'Manutenção', valor: frota.manutencao, cor: CORES_FROTA.manutencao },
                ]}
              />
            )}
          </Card>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Funil + ranking                                                   */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHeader
            title="Do WhatsApp até a chave na mão"
            subtitle="Como as conversas viram locação no período."
            icon={Filter}
            action={
              <Badge tone={funil.conversao == null ? 'slate' : 'brand'}>
                {funil.conversao == null ? 'sem conversas' : `${funil.conversao}% de conversão`}
              </Badge>
            }
          />
          <div className="p-5">
            <GraficoFunil
              etapas={[
                { rotulo: 'Conversas iniciadas', valor: funil.conversas },
                { rotulo: 'Pré-reservas criadas', valor: funil.criadas },
                { rotulo: 'Enviaram documentos', valor: funil.emAnalise + funil.confirmadas },
                { rotulo: 'Aprovadas por você', valor: funil.confirmadas },
              ]}
            />
            {(funil.recusadas > 0 || funil.expiradas > 0) && (
              <div className="flex gap-4 mt-5 pt-4 border-t border-borda text-[12px] text-suave">
                <span>{funil.recusadas} recusada(s)/cancelada(s)</span>
                <span>{funil.expiradas} expirada(s) sem documento</span>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Veículos que mais faturaram"
            subtitle="Receita no período, do maior para o menor."
            icon={Trophy}
          />
          <div className="p-5">
            {topVeiculos.length === 0 ? (
              <EmptyState icon={Car} title="Sem dados ainda" hint="Cadastre veículos e receba as primeiras reservas." />
            ) : (
              <GraficoBarras
                dados={topVeiculos.map((v) => ({
                  id: v.id,
                  rotulo: v.model,
                  valor: v.receita,
                }))}
                formatarValor={(v) => brlCurto(v)}
              />
            )}
          </div>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Próximos dias                                                     */}
      {/* ---------------------------------------------------------------- */}
      <Card className="mt-4 overflow-hidden">
        <CardHeader
          title="Próximos 7 dias"
          subtitle="Retiradas e devoluções que já estão marcadas."
          icon={CalendarClock}
          action={
            <Button size="sm" variant="ghost" onClick={() => nav('/agenda')}>
              Ver agenda <ArrowRight size={14} />
            </Button>
          }
        />
        {proximosEventos.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Nada marcado para os próximos dias"
            hint="Assim que uma reserva for aprovada, a retirada aparece aqui."
          />
        ) : (
          <div className="divide-y divide-borda">
            {proximosEventos.map((e) => (
              <div key={`${e.tipo}-${e.id}`} className="flex items-center gap-3.5 px-5 py-3.5">
                <span
                  className={cx(
                    'grid place-items-center w-9 h-9 rounded-xl shrink-0',
                    e.tipo === 'retirada'
                      ? 'bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400'
                      : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  )}
                >
                  {e.tipo === 'retirada' ? <ArrowRight size={16} /> : <Car size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium text-conteudo truncate">
                    {e.tipo === 'retirada' ? 'Retirada' : 'Devolução'} · {e.vehicle_model}
                    <span className="text-suave-2 font-normal"> · {e.vehicle_plate}</span>
                  </div>
                  <div className="text-[12px] text-suave truncate">
                    {e.customer_name || telefone(e.customer_phone)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[13px] font-medium text-conteudo-2">
                    {diaExtenso(e.quando)}
                  </div>
                  <div className="text-[11.5px] text-suave-2">{hora(e.quando)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
