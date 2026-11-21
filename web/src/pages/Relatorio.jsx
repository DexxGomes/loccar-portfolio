// ============================================================================
//  RELATÓRIO MENSAL
//  Fecha o mês em uma página: receita, reservas, ocupação, frota, funil e os
//  veículos que mais renderam. O botão "Imprimir / Salvar PDF" usa a impressão
//  do navegador — o menu e a barra somem (print:hidden) e sai um PDF limpo.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Printer,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  CalendarCheck,
  Receipt,
  Gauge,
  Car,
  ArrowUpRight,
} from 'lucide-react';
import { api } from '../api.js';
import { lerSessao } from '../sessao.js';
import { brl } from '../format.js';
import Logo from '../components/Logo.jsx';
import { Card, Button, ErrorBanner, Loading, EmptyState, cx } from '../components/ui.jsx';

/** "2026-07" do mês atual. */
function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Soma/subtrai meses de uma string "YYYY-MM". */
function deslocarMes(mes, delta) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Pílula de variação (+12% / −4%) ao lado de um indicador. */
function Variacao({ valor }) {
  if (valor == null) return null;
  const sobe = valor >= 0;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md',
        sobe
          ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15'
          : 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-500/15'
      )}
    >
      {sobe ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {sobe ? '+' : ''}
      {valor}%
    </span>
  );
}

/** Cartão de indicador do relatório. */
function Kpi({ icon: Icon, label, valor, variacao, rodape }) {
  return (
    <Card className="p-5 print-avoid-break">
      <div className="flex items-center justify-between">
        <span className="grid place-items-center w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400">
          <Icon size={18} strokeWidth={2.1} />
        </span>
        {variacao !== undefined && <Variacao valor={variacao} />}
      </div>
      <div className="mt-3 text-2xl font-bold text-conteudo tabular leading-none">{valor}</div>
      <div className="text-xs text-suave mt-1.5">{label}</div>
      {rodape && <div className="text-[11px] text-suave-2 mt-1">{rodape}</div>}
    </Card>
  );
}

/** Bloco "rótulo → valor" usado nos resumos de frota e funil. */
function Linha({ label, valor, cor }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-borda last:border-0">
      <span className="flex items-center gap-2 text-sm text-suave">
        {cor && <span className={cx('w-2 h-2 rounded-full', cor)} />}
        {label}
      </span>
      <span className="text-sm font-semibold text-conteudo tabular">{valor}</span>
    </div>
  );
}

export default function Relatorio() {
  const [mes, setMes] = useState(mesAtual());
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const tenant = useMemo(() => lerSessao('tenant'), []);

  // Intervalo do mês escolhido (início do mês → início do mês seguinte).
  const intervalo = useMemo(() => {
    const [a, m] = mes.split('-').map(Number);
    const inicio = new Date(a, m - 1, 1);
    const fim = new Date(a, m, 1);
    return { from: inicio.toISOString(), to: fim.toISOString(), inicio };
  }, [mes]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const q = new URLSearchParams({ from: intervalo.from, to: intervalo.to });
      setDados(await api.get(`/api/dashboard?${q.toString()}`));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [intervalo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const rotuloMes = intervalo.inicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const ehMesAtual = mes >= mesAtual();
  const geradoEm = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const ind = dados?.indicadores;
  const frota = dados?.frota;
  const funil = dados?.funil;
  const temMovimento =
    dados && (ind.reservas.valor > 0 || funil.conversas > 0 || (frota.total || 0) > 0);

  return (
    <div>
      {/* -------- Barra de controle (não sai na impressão) -------- */}
      <div
        data-no-print
        className="flex flex-wrap items-center justify-between gap-3 mb-6"
      >
        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/25">
            <FileText size={18} strokeWidth={2.2} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-conteudo">Relatório mensal</h1>
            <p className="text-xs text-suave">Escolha o mês e salve em PDF.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Navegação de mês */}
          <div className="flex items-center rounded-xl border border-borda bg-superficie">
            <button
              onClick={() => setMes((m) => deslocarMes(m, -1))}
              className="grid place-items-center w-9 h-9 text-suave hover:text-conteudo hover:bg-sutil rounded-l-xl transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft size={17} />
            </button>
            <input
              type="month"
              value={mes}
              max={mesAtual()}
              onChange={(e) => setMes(e.target.value || mesAtual())}
              className="bg-transparent text-sm font-medium text-conteudo px-2 py-2 outline-none w-[9.5rem] text-center [color-scheme:light] dark:[color-scheme:dark]"
            />
            <button
              onClick={() => setMes((m) => deslocarMes(m, +1))}
              disabled={ehMesAtual}
              className="grid place-items-center w-9 h-9 text-suave hover:text-conteudo hover:bg-sutil rounded-r-xl transition-colors disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Próximo mês"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <Button icon={Printer} onClick={() => window.print()} disabled={!temMovimento}>
            Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      <ErrorBanner onRetry={carregar}>{erro}</ErrorBanner>

      {carregando ? (
        <Loading label="Fechando o mês…" />
      ) : !temMovimento ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="Sem movimento nesse mês"
            hint={`Não há reservas nem conversas registradas em ${rotuloMes}. Escolha outro mês no seletor acima.`}
          />
        </Card>
      ) : (
        // -------- Folha do relatório (é o que vai para o PDF) --------
        <div className="bg-superficie sm:bg-transparent">
          {/* Cabeçalho do relatório */}
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 mb-6 border-b border-borda print-avoid-break">
            <div className="flex items-center gap-3">
              <Logo size={40} className="text-brand-600 shrink-0" />
              <div>
                <div className="text-lg font-extrabold tracking-tight leading-none">
                  <span className="text-conteudo">Loc</span>
                  <span className="text-brand-600">Car</span>
                </div>
                <div className="text-sm text-suave mt-1">{tenant.name || 'Sua locadora'}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest text-suave-2">Relatório mensal</div>
              <div className="text-base font-bold text-conteudo capitalize mt-0.5">{rotuloMes}</div>
              <div className="text-[11px] text-suave-2 mt-0.5">Gerado em {geradoEm}</div>
            </div>
          </div>

          {/* Indicadores */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <Kpi
              icon={Wallet}
              label="Receita do mês"
              valor={brl(ind.receita.valor)}
              variacao={ind.receita.variacao}
              rodape="vs. mês anterior"
            />
            <Kpi
              icon={CalendarCheck}
              label="Reservas"
              valor={ind.reservas.valor}
              variacao={ind.reservas.variacao}
            />
            <Kpi
              icon={Receipt}
              label="Ticket médio"
              valor={brl(ind.ticketMedio.valor)}
              variacao={ind.ticketMedio.variacao}
            />
            <Kpi
              icon={Gauge}
              label="Ocupação da frota"
              valor={`${ind.ocupacao.valor}%`}
              rodape={`${Math.round(ind.ocupacao.diarias || 0)} diária(s) no mês`}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            {/* Frota */}
            <Card className="p-5 print-avoid-break">
              <div className="flex items-center gap-2 mb-3">
                <Car size={16} className="text-suave" />
                <h2 className="text-sm font-semibold text-conteudo">Frota</h2>
                <span className="ml-auto text-xs text-suave">{frota.total} veículo(s)</span>
              </div>
              <Linha label="Disponíveis" valor={frota.disponiveis} cor="bg-emerald-500" />
              <Linha label="Alugados" valor={frota.alugados} cor="bg-brand-500" />
              <Linha label="Em manutenção" valor={frota.manutencao} cor="bg-amber-500" />
              <Linha label="Diária média" valor={brl(frota.diaria_media)} />
            </Card>

            {/* Funil */}
            <Card className="p-5 print-avoid-break">
              <div className="flex items-center gap-2 mb-3">
                <ArrowUpRight size={16} className="text-suave" />
                <h2 className="text-sm font-semibold text-conteudo">Funil do mês</h2>
                {funil.conversao != null && (
                  <span className="ml-auto text-xs font-semibold text-brand-600 dark:text-brand-400">
                    {funil.conversao}% de conversão
                  </span>
                )}
              </div>
              <Linha label="Conversas no WhatsApp" valor={funil.conversas} />
              <Linha label="Pré-reservas criadas" valor={funil.criadas} />
              <Linha label="Confirmadas" valor={funil.confirmadas} />
              <Linha label="Recusadas / canceladas" valor={funil.recusadas} />
            </Card>
          </div>

          {/* Receita prevista */}
          {ind.previsto.valor > 0 && (
            <Card className="p-5 mb-6 print-avoid-break bg-brand-50/50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/25">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-conteudo">Receita já contratada</div>
                  <div className="text-xs text-suave mt-0.5">
                    {ind.previsto.reservas} reserva(s) confirmada(s) com retirada futura — ainda não
                    entrou no mês.
                  </div>
                </div>
                <div className="text-xl font-bold text-brand-700 dark:text-brand-300 tabular shrink-0">
                  {brl(ind.previsto.valor)}
                </div>
              </div>
            </Card>
          )}

          {/* Top veículos */}
          {dados.topVeiculos?.some((v) => v.receita > 0) && (
            <Card className="print-avoid-break overflow-hidden">
              <div className="px-5 py-4 border-b border-borda">
                <h2 className="text-sm font-semibold text-conteudo">Veículos que mais renderam</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-suave-2 border-b border-borda">
                      <th className="px-5 py-2.5 font-semibold">Veículo</th>
                      <th className="px-5 py-2.5 font-semibold">Placa</th>
                      <th className="px-5 py-2.5 font-semibold text-right">Reservas</th>
                      <th className="px-5 py-2.5 font-semibold text-right">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.topVeiculos
                      .filter((v) => v.receita > 0)
                      .map((v) => (
                        <tr key={v.id} className="border-b border-borda last:border-0">
                          <td className="px-5 py-3 font-medium text-conteudo">{v.model}</td>
                          <td className="px-5 py-3 font-mono text-xs text-suave">{v.plate}</td>
                          <td className="px-5 py-3 text-right text-conteudo-2 tabular">{v.reservas}</td>
                          <td className="px-5 py-3 text-right font-semibold text-conteudo tabular">
                            {brl(v.receita)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Rodapé do relatório (aparece bem no PDF) */}
          <p className="text-center text-[11px] text-suave-2 mt-8">
            {tenant.name || 'LocCar'} · Relatório gerado pelo LocCar em {geradoEm}
          </p>
        </div>
      )}
    </div>
  );
}
