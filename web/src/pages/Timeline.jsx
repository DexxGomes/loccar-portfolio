// ============================================================================
//  LINHA DO TEMPO DA FROTA (Gantt)
//  Cada veículo é uma faixa; reservas e manutenções são barras sobre os dias.
//  Responde de bate-pronto: "que carro está livre no dia 12?".
//
//  No computador dá para ARRASTAR sobre uma faixa vazia para bloquear
//  manutenção. No celular (toque) o arrasto é do rolamento, então o caminho
//  é o botão "Bloquear manutenção".
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Plus,
  Trash2,
  ArrowRight,
  Info,
  CalendarDays,
  Car,
} from 'lucide-react';
import { api } from '../api.js';
import { dt, brl, telefone } from '../format.js';
import { useToast } from '../components/Toast.jsx';
import { Modal, useConfirm } from '../components/Modal.jsx';
import { Skeleton } from '../components/Skeleton.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import CalendarioMes from '../components/CalendarioMes.jsx';
import {
  PageHeader,
  Card,
  Button,
  IconButton,
  Segmented,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Select,
  Badge,
  Loading,
  cx,
} from '../components/ui.jsx';

// Situações que "ocupam" o veículo (para a visão por dia).
const STATUS_OCUPA = ['confirmada', 'em_andamento', 'pre_reserva', 'aguardando_documentos', 'em_analise'];

const DIA_MS = 86400000;

const JANELAS = [
  { value: 7, label: '7 dias' },
  { value: 14, label: '14 dias' },
  { value: 30, label: '30 dias' },
];

// Largura de cada dia conforme o zoom (no celular a tela rola na horizontal).
const LARGURA_DIA = { 7: 116, 14: 68, 30: 40 };

// Cor da barra por situação. Toda barra leva rótulo — a cor nunca é a única pista.
const COR_BARRA = {
  confirmada: 'bg-brand-600',
  em_andamento: 'bg-emerald-600',
  pre_reserva: 'bg-amber-500',
  aguardando_documentos: 'bg-amber-500',
  em_analise: 'bg-orange-500',
};

/** Meia-noite de hoje, no relógio de quem está olhando. */
function inicioDeHoje() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const somarDias = (data, n) => new Date(data.getTime() + n * DIA_MS);

export default function Timeline() {
  // No celular, a visão "Por dia" (lista simples) é o padrão — é mais fácil de ler
  // que o Gantt. No computador, o "Calendário" (Gantt) mostra o panorama.
  // A visão "Por dia" é a padrão para todo mundo: responde "o que tenho hoje?"
  // de bate-pronto. O calendário continua a um toque, para o panorama — e a
  // escolha de cada um fica guardada.
  const [modo, setModo] = useState(() => {
    try {
      // Padrão "mês": no celular é a visão que serve de manhã.
      return localStorage.getItem('timeline-modo') || 'mes';
    } catch {
      return 'dia';
    }
  });

  function escolherModo(novo) {
    setModo(novo);
    try {
      localStorage.setItem('timeline-modo', novo);
    } catch {
      /* modo anônimo: só não lembra */
    }
  }
  const [diaFoco, setDiaFoco] = useState(inicioDeHoje);
  const [dias, setDias] = useState(14);
  const [inicio, setInicio] = useState(inicioDeHoje);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [detalhe, setDetalhe] = useState(null); // barra clicada
  const [novoBloqueio, setNovoBloqueio] = useState(null); // formulário aberto
  const [salvando, setSalvando] = useState(false);
  const [arrasto, setArrasto] = useState(null); // seleção em andamento

  const nav = useNavigate();
  const toast = useToast();
  const confirmar = useConfirm();

  const fim = useMemo(() => somarDias(inicio, dias), [inicio, dias]);
  const totalMs = fim - inicio;

  // Mês mostrado na visão de calendário mensal, e o dia aberto embaixo dele.
  // Atenção: inicioDeHoje é FUNÇÃO (o useState abaixo a usa como inicializador
  // preguiçoso). Aqui precisa chamar.
  const [mesBase, setMesBase] = useState(() => {
    const hoje = inicioDeHoje();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  });
  const [diaEscolhido, setDiaEscolhido] = useState(inicioDeHoje);

  // Janela buscada muda com o modo:
  //   dia    -> só o dia em foco
  //   mês    -> o mês inteiro, com folga nas pontas (a grade mostra o fim do
  //             mês anterior e o começo do seguinte, e eles também têm marcação)
  //   faixas -> o período escolhido
  const janela = useMemo(() => {
    if (modo === 'dia') return { de: diaFoco, ate: somarDias(diaFoco, 1) };
    if (modo === 'mes') {
      const primeiro = new Date(mesBase.getFullYear(), mesBase.getMonth(), 1);
      return { de: somarDias(primeiro, -7), ate: somarDias(primeiro, 45) };
    }
    return { de: inicio, ate: fim };
  }, [modo, diaFoco, inicio, fim, mesBase]);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setDados(
        await api.get(`/api/timeline?from=${janela.de.toISOString()}&to=${janela.ate.toISOString()}`)
      );
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, diaFoco, inicio, dias, mesBase]);

  // ------------------------------------------------------------------ dados
  const colunas = useMemo(
    () => Array.from({ length: dias }, (_, i) => somarDias(inicio, i)),
    [inicio, dias]
  );

  /** Converte um período em posição/largura percentual dentro da janela. */
  function faixa(de, ate) {
    const ini = Math.max(new Date(de).getTime(), inicio.getTime());
    const f = Math.min(new Date(ate).getTime(), fim.getTime());
    const esquerda = ((ini - inicio.getTime()) / totalMs) * 100;
    const largura = Math.max(((f - ini) / totalMs) * 100, 1.2);
    return {
      left: `${esquerda}%`,
      width: `${Math.min(largura, 100 - esquerda)}%`,
      cortaInicio: new Date(de) < inicio,
      cortaFim: new Date(ate) > fim,
    };
  }

  const porVeiculo = useMemo(() => {
    if (!dados) return [];
    return dados.veiculos.map((v) => ({
      veiculo: v,
      reservas: dados.reservas.filter((r) => r.vehicle_id === v.id),
      bloqueios: dados.bloqueios.filter((b) => b.vehicle_id === v.id),
    }));
  }, [dados]);

  // Situação de cada veículo NO DIA em foco: livre, alugado ou em manutenção.
  const statusDia = useMemo(() => {
    const grupos = { livres: [], alugados: [], manutencao: [] };
    if (!dados) return grupos;
    const ini = diaFoco.getTime();
    const fimDia = somarDias(diaFoco, 1).getTime();
    const sobrepoe = (de, ate) => new Date(de).getTime() < fimDia && new Date(ate).getTime() > ini;
    for (const v of dados.veiculos) {
      const reserva = dados.reservas.find(
        (r) => r.vehicle_id === v.id && STATUS_OCUPA.includes(r.status) && sobrepoe(r.pickup_at, r.return_at)
      );
      const bloqueio = dados.bloqueios.find((b) => b.vehicle_id === v.id && sobrepoe(b.start_at, b.end_at));
      if (reserva) grupos.alugados.push({ v, reserva });
      else if (bloqueio) grupos.manutencao.push({ v, bloqueio });
      else grupos.livres.push({ v });
    }
    return grupos;
  }, [dados, diaFoco]);

  // Posição da linha "agora" (só aparece se o instante estiver na janela).
  const agora = Date.now();
  const mostrarAgora = agora >= inicio.getTime() && agora <= fim.getTime();
  const posAgora = ((agora - inicio.getTime()) / totalMs) * 100;

  // ------------------------------------------------------------- interação
  /** Início do arrasto sobre uma faixa vazia (só com mouse). */
  function aoPressionar(e, veiculo) {
    if (e.pointerType === 'touch') return; // no celular, o dedo rola a tela
    if (e.target.closest('[data-barra]')) return; // clicou numa barra
    const caixa = e.currentTarget.getBoundingClientRect();
    setArrasto({
      veiculo,
      caixa,
      x0: e.clientX - caixa.left,
      x1: e.clientX - caixa.left,
    });
  }

  function aoMover(e) {
    if (!arrasto) return;
    setArrasto((a) => ({ ...a, x1: e.clientX - a.caixa.left }));
  }

  function aoSoltar() {
    if (!arrasto) return;
    const { veiculo, caixa, x0, x1 } = arrasto;
    setArrasto(null);
    if (Math.abs(x1 - x0) < 6) return; // foi clique, não arrasto

    // Converte os dois pontos em dias inteiros (manutenção é por dia).
    const paraDia = (x) => Math.floor((Math.max(0, Math.min(x, caixa.width)) / caixa.width) * dias);
    const d1 = Math.min(paraDia(x0), paraDia(x1));
    const d2 = Math.max(paraDia(x0), paraDia(x1));

    abrirNovoBloqueio({
      vehicleId: veiculo.id,
      de: somarDias(inicio, d1),
      ate: somarDias(inicio, d2),
    });
  }

  const paraInput = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function abrirNovoBloqueio({ vehicleId, de, ate } = {}) {
    const base = de || inicioDeHoje();
    setNovoBloqueio({
      vehicleId: vehicleId || dados?.veiculos[0]?.id || '',
      de: paraInput(base),
      ate: paraInput(ate || base),
      reason: '',
      erro: '',
    });
  }

  async function salvarBloqueio(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      const [a1, m1, d1] = novoBloqueio.de.split('-').map(Number);
      const [a2, m2, d2] = novoBloqueio.ate.split('-').map(Number);
      // O bloqueio termina no fim do dia escolhido → meia-noite do dia seguinte.
      const startAt = new Date(a1, m1 - 1, d1, 0, 0, 0);
      const endAt = new Date(a2, m2 - 1, d2 + 1, 0, 0, 0);

      await api.post('/api/schedule-blocks', {
        vehicleId: novoBloqueio.vehicleId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        reason: novoBloqueio.reason.trim() || undefined,
      });
      toast.sucesso('Veículo bloqueado. A IA não vai mais oferecer esse período.');
      setNovoBloqueio(null);
      carregar();
    } catch (err) {
      setNovoBloqueio((n) => ({ ...n, erro: err.message }));
    } finally {
      setSalvando(false);
    }
  }

  async function removerBloqueio(bloqueio) {
    const ok = await confirmar({
      titulo: 'Liberar este período?',
      mensagem: 'O veículo volta a ficar disponível para reserva nessas datas.',
      confirmar: 'Liberar',
      tom: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(`/api/schedule-blocks/${bloqueio.id}`);
      toast.sucesso('Bloqueio removido.');
      setDetalhe(null);
      carregar();
    } catch (e) {
      toast.erro(e.message);
    }
  }

  const larguraDia = LARGURA_DIA[dias];
  const larguraGrade = dias * larguraDia;

  return (
    <div>
      <PageHeader
        icon={CalendarRange}
        title="Linha do tempo da frota"
        subtitle="Quem está reservado, quem está livre e o que está parado para manutenção."
      >
        <Segmented
          value={modo}
          onChange={escolherModo}
          options={[
            // "Mês" vem primeiro porque é a visão do dia a dia no celular:
            // responde "o que eu tenho pra fazer", que é a pergunta da manhã.
            { value: 'mes', label: 'Mês' },
            { value: 'dia', label: 'Por dia' },
            { value: 'calendario', label: 'Faixas' },
          ]}
        />
        {modo === 'calendario' && <Segmented value={dias} onChange={setDias} options={JANELAS} />}
        <Button
          icon={Wrench}
          variant="secondary"
          onClick={() => abrirNovoBloqueio()}
          disabled={!dados?.veiculos?.length}
        >
          Bloquear manutenção
        </Button>
      </PageHeader>

      <ErrorBanner onRetry={carregar}>{erro}</ErrorBanner>

      {/* ============================ VISÃO POR DIA (simples, ótima no celular) */}
      {modo === 'mes' && !carregando && (
        <CalendarioMes
          mesBase={mesBase}
          reservas={dados?.reservas || []}
          diaEscolhido={diaEscolhido}
          onEscolherDia={setDiaEscolhido}
          onTrocarMes={(delta) => {
            const novo = new Date(mesBase.getFullYear(), mesBase.getMonth() + delta, 1);
            setMesBase(novo);
            // Ao trocar de mês, abre o dia 1 — senão a lista de baixo continua
            // mostrando um dia que nem está mais na grade.
            setDiaEscolhido(novo);
          }}
        />
      )}

      {modo === 'dia' && (
        <>
          {/* Navegação do dia */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <IconButton icon={ChevronLeft} label="Dia anterior" onClick={() => setDiaFoco((d) => somarDias(d, -1))} />
            <Button size="sm" variant="secondary" onClick={() => setDiaFoco(inicioDeHoje())}>
              Hoje
            </Button>
            <IconButton icon={ChevronRight} label="Próximo dia" onClick={() => setDiaFoco((d) => somarDias(d, 1))} />
            <input
              type="date"
              value={paraInput(diaFoco)}
              onChange={(e) => {
                const [a, m, d] = e.target.value.split('-').map(Number);
                if (a) setDiaFoco(new Date(a, m - 1, d));
              }}
              className="bg-superficie border border-borda rounded-xl px-3 py-1.5 text-sm text-conteudo outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
            <span className="text-[13px] text-suave capitalize ml-1">
              {diaFoco.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </span>
          </div>

          {carregando ? (
            <Loading label="Carregando o dia…" />
          ) : !dados?.veiculos?.length ? (
            <Card>
              <EmptyState
                icon={Car}
                title="Nenhum veículo na frota"
                hint="Cadastre veículos para ver a agenda deles aqui."
                action={<Button onClick={() => nav('/frota')}>Ir para a frota</Button>}
              />
            </Card>
          ) : (
            <>
            {/* Resposta em uma frase — no celular as três colunas viram três
                blocos empilhados, e sem isso você teria que rolar para saber
                como está o dia. */}
            <div className="mb-4 rounded-2xl border border-borda bg-superficie px-4 py-3.5 text-[14px] text-conteudo-2 leading-relaxed">
              Neste dia:{' '}
              <b className="text-emerald-700 dark:text-emerald-400">
                {statusDia.livres.length} livre{statusDia.livres.length === 1 ? '' : 's'}
              </b>
              {' · '}
              <b className="text-brand-700 dark:text-brand-400">
                {statusDia.alugados.length} alugado{statusDia.alugados.length === 1 ? '' : 's'}
              </b>
              {' · '}
              <b className="text-conteudo">
                {statusDia.manutencao.length} em manutenção
              </b>
              {statusDia.livres.length === 0 && statusDia.alugados.length > 0 && (
                <span className="block text-[12.5px] text-suave mt-1">
                  Frota toda comprometida neste dia — não dá para prometer carro para hoje.
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <GrupoDia titulo="Livres" cor="emerald" contagem={statusDia.livres.length}>
                {statusDia.livres.length === 0 ? (
                  <VazioDia texto="Nenhum livre neste dia." />
                ) : (
                  statusDia.livres.map(({ v }) => (
                    <div key={v.id} className="flex items-center gap-2 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-conteudo truncate">{v.model}</div>
                        <div className="text-[11px] font-mono text-suave-2">{v.plate}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Wrench}
                        onClick={() => abrirNovoBloqueio({ vehicleId: v.id, de: diaFoco, ate: diaFoco })}
                      >
                        Bloquear
                      </Button>
                    </div>
                  ))
                )}
              </GrupoDia>

              <GrupoDia titulo="Alugados" cor="brand" contagem={statusDia.alugados.length}>
                {statusDia.alugados.length === 0 ? (
                  <VazioDia texto="Nenhum alugado neste dia." />
                ) : (
                  statusDia.alugados.map(({ v, reserva }) => (
                    <button
                      key={v.id}
                      onClick={() => setDetalhe({ tipo: 'reserva', dado: reserva })}
                      className="w-full text-left flex items-center gap-2 px-3 py-2.5 hover:bg-elevado transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-conteudo truncate">
                          {v.model} · {v.plate}
                        </div>
                        <div className="text-xs text-suave truncate">
                          {reserva.customer_name || telefone(reserva.customer_phone)}
                        </div>
                      </div>
                      <div className="text-[11px] text-suave-2 shrink-0 text-right leading-tight">
                        devolve
                        <br />
                        {dt(reserva.return_at)}
                      </div>
                    </button>
                  ))
                )}
              </GrupoDia>

              <GrupoDia titulo="Manutenção" cor="slate" contagem={statusDia.manutencao.length}>
                {statusDia.manutencao.length === 0 ? (
                  <VazioDia texto="Nenhum parado neste dia." />
                ) : (
                  statusDia.manutencao.map(({ v, bloqueio }) => (
                    <button
                      key={v.id}
                      onClick={() => setDetalhe({ tipo: 'bloqueio', dado: bloqueio })}
                      className="w-full text-left flex items-center gap-2 px-3 py-2.5 hover:bg-elevado transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-conteudo truncate">
                          {v.model} · {v.plate}
                        </div>
                        <div className="text-xs text-suave truncate">{bloqueio.reason || 'Manutenção'}</div>
                      </div>
                    </button>
                  ))
                )}
              </GrupoDia>
            </div>
            </>
          )}
        </>
      )}

      {/* ============================ VISÃO CALENDÁRIO (Gantt — panorama) */}
      {modo === 'calendario' && (
        <>
      {/* Navegação do período + legenda */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <IconButton
            icon={ChevronLeft}
            label="Período anterior"
            onClick={() => setInicio((d) => somarDias(d, -dias))}
          />
          <Button size="sm" variant="secondary" onClick={() => setInicio(inicioDeHoje())}>
            Hoje
          </Button>
          <IconButton
            icon={ChevronRight}
            label="Próximo período"
            onClick={() => setInicio((d) => somarDias(d, dias))}
          />
          <span className="ml-2 text-[13px] text-suave">
            {inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} —{' '}
            {somarDias(fim, -1).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
              year: '2-digit',
            })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-suave">
          <Legenda cor="bg-brand-600" texto="Confirmada" />
          <Legenda cor="bg-emerald-600" texto="Na rua" />
          <Legenda cor="bg-amber-500" texto="Aguardando" />
          <Legenda cor="bg-slate-400" texto="Manutenção" listrada />
        </div>
      </div>

      <Card className="overflow-hidden">
        {carregando ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-10 w-40 shrink-0" />
                <Skeleton className="h-10 flex-1" />
              </div>
            ))}
          </div>
        ) : porVeiculo.length === 0 ? (
          <EmptyState
            icon={Car}
            title="Nenhum veículo na frota"
            hint="Cadastre veículos para ver a agenda deles aqui."
            action={<Button onClick={() => nav('/frota')}>Ir para a frota</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: larguraGrade + 176 }}>
              {/* Cabeçalho dos dias */}
              <div className="flex sticky top-16 bg-superficie z-10 border-b border-borda">
                <div className="w-44 shrink-0 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-suave-2">
                  Veículo
                </div>
                <div className="flex-1 flex">
                  {colunas.map((d) => {
                    const fimDeSemana = d.getDay() === 0 || d.getDay() === 6;
                    const hoje = d.toDateString() === new Date().toDateString();
                    return (
                      <div
                        key={d.toISOString()}
                        className={cx(
                          'flex-1 text-center py-2 border-l border-borda',
                          fimDeSemana && 'bg-elevado/70'
                        )}
                      >
                        <div className="text-[10px] uppercase text-suave-2">
                          {d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)}
                        </div>
                        <div
                          className={cx(
                            'text-[12.5px] font-semibold',
                            hoje ? 'text-brand-700 dark:text-brand-300' : 'text-conteudo-2'
                          )}
                        >
                          {d.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Faixas dos veículos */}
              <div className="relative">
                {mostrarAgora && (
                  <div
                    aria-hidden="true"
                    className="absolute top-0 bottom-0 w-px bg-brand-500/70 z-20 pointer-events-none"
                    style={{ left: `calc(176px + (100% - 176px) * ${posAgora / 100})` }}
                  />
                )}

                {porVeiculo.map(({ veiculo, reservas, bloqueios }) => (
                  <div key={veiculo.id} className="flex border-b border-borda last:border-0">
                    {/* Identificação */}
                    <div className="w-44 shrink-0 px-4 py-3">
                      <div className="text-[13.5px] font-medium text-conteudo truncate">
                        {veiculo.model}
                      </div>
                      <div className="text-[11px] font-mono text-suave-2">{veiculo.plate}</div>
                    </div>

                    {/* Faixa de tempo */}
                    <div
                      className="flex-1 relative min-h-[58px] cursor-crosshair select-none"
                      onPointerDown={(e) => aoPressionar(e, veiculo)}
                      onPointerMove={aoMover}
                      onPointerUp={aoSoltar}
                      onPointerLeave={() => arrasto && setArrasto(null)}
                    >
                      {/* Grade de fundo */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {colunas.map((d) => (
                          <div
                            key={d.toISOString()}
                            className={cx(
                              'flex-1 border-l border-borda',
                              (d.getDay() === 0 || d.getDay() === 6) && 'bg-elevado/70'
                            )}
                          />
                        ))}
                      </div>

                      {/* Seleção sendo arrastada */}
                      {arrasto?.veiculo.id === veiculo.id && (
                        <div
                          className="absolute top-2 bottom-2 rounded-lg bg-brand-500/20 border-2 border-dashed border-brand-500 pointer-events-none"
                          style={{
                            left: Math.min(arrasto.x0, arrasto.x1),
                            width: Math.abs(arrasto.x1 - arrasto.x0),
                          }}
                        />
                      )}

                      {/* Manutenções */}
                      {bloqueios.map((b) => {
                        const pos = faixa(b.start_at, b.end_at);
                        return (
                          <button
                            key={b.id}
                            data-barra
                            onClick={() => setDetalhe({ tipo: 'bloqueio', dado: b })}
                            title={`Manutenção: ${b.reason || 'sem motivo'}`}
                            style={{ left: pos.left, width: pos.width }}
                            className="absolute top-2.5 h-[34px] rounded-lg bg-slate-400 text-white
                                       flex items-center gap-1.5 px-2 overflow-hidden
                                       hover:brightness-110 transition-all"
                          >
                            {/* listras: reforço visual além da cor */}
                            <span
                              aria-hidden="true"
                              className="absolute inset-0 opacity-40"
                              style={{
                                backgroundImage:
                                  'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,.55) 5px, rgba(255,255,255,.55) 10px)',
                              }}
                            />
                            <Wrench size={12} className="relative shrink-0" />
                            <span className="relative text-[11.5px] font-medium truncate">
                              Manutenção
                            </span>
                          </button>
                        );
                      })}

                      {/* Reservas */}
                      {reservas.map((r) => {
                        const pos = faixa(r.pickup_at, r.return_at);
                        return (
                          <button
                            key={r.id}
                            data-barra
                            onClick={() => setDetalhe({ tipo: 'reserva', dado: r })}
                            title={`${r.customer_name || 'Cliente'} · ${dt(r.pickup_at)} → ${dt(
                              r.return_at
                            )}`}
                            style={{ left: pos.left, width: pos.width }}
                            className={cx(
                              'absolute top-2.5 h-[34px] px-2 flex items-center text-white overflow-hidden',
                              'hover:brightness-110 transition-all shadow-sm',
                              COR_BARRA[r.status] || 'bg-elevado0',
                              // Ponta reta avisa que a locação continua fora da janela.
                              !pos.cortaInicio && 'rounded-l-lg',
                              !pos.cortaFim && 'rounded-r-lg'
                            )}
                          >
                            <span className="text-[11.5px] font-medium truncate">
                              {r.customer_name || telefone(r.customer_phone)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      <p className="mt-3 text-[12px] text-suave-2 hidden lg:flex items-center gap-1.5">
        <Info size={13} />
        Dica: arraste sobre um espaço livre da faixa para bloquear manutenção naquele veículo.
      </p>
        </>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Detalhe da barra                                                  */}
      {/* ---------------------------------------------------------------- */}
      <Modal
        open={!!detalhe}
        onClose={() => setDetalhe(null)}
        title={detalhe?.tipo === 'bloqueio' ? 'Manutenção' : 'Reserva'}
        icon={detalhe?.tipo === 'bloqueio' ? Wrench : CalendarDays}
        footer={
          detalhe?.tipo === 'bloqueio' ? (
            <>
              <Button variant="secondary" onClick={() => setDetalhe(null)}>
                Fechar
              </Button>
              <Button variant="danger" icon={Trash2} onClick={() => removerBloqueio(detalhe.dado)}>
                Liberar período
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setDetalhe(null)}>
                Fechar
              </Button>
              <Button onClick={() => nav('/agenda')}>
                Ver na agenda <ArrowRight size={15} />
              </Button>
            </>
          )
        }
      >
        {detalhe?.tipo === 'bloqueio' ? (
          <div className="space-y-3 text-sm">
            <Linha rotulo="Veículo" valor={`${detalhe.dado.vehicle_model} · ${detalhe.dado.vehicle_plate}`} />
            <Linha rotulo="Início" valor={dt(detalhe.dado.start_at)} />
            <Linha rotulo="Fim" valor={dt(detalhe.dado.end_at)} />
            <Linha rotulo="Motivo" valor={detalhe.dado.reason || 'Não informado'} />
          </div>
        ) : detalhe ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <StatusBadge status={detalhe.dado.status} />
              {detalhe.dado.late_return_flag && <Badge tone="red">devolução atrasada</Badge>}
            </div>
            <Linha rotulo="Cliente" valor={detalhe.dado.customer_name || '—'} />
            <Linha rotulo="Telefone" valor={telefone(detalhe.dado.customer_phone)} />
            <Linha
              rotulo="Veículo"
              valor={`${detalhe.dado.vehicle_model} · ${detalhe.dado.vehicle_plate}`}
            />
            <Linha rotulo="Retirada" valor={dt(detalhe.dado.pickup_at)} />
            <Linha rotulo="Devolução" valor={dt(detalhe.dado.return_at)} />
            <Linha
              rotulo="Valor"
              valor={`${detalhe.dado.days_count} diária(s) · ${brl(detalhe.dado.total_amount)}`}
            />
          </div>
        ) : null}
      </Modal>

      {/* ---------------------------------------------------------------- */}
      {/* Novo bloqueio                                                     */}
      {/* ---------------------------------------------------------------- */}
      <Modal
        open={!!novoBloqueio}
        onClose={() => setNovoBloqueio(null)}
        title="Bloquear manutenção"
        subtitle="O veículo some das opções da IA nesse período."
        icon={Wrench}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setNovoBloqueio(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-bloqueio" loading={salvando} icon={Plus}>
              Bloquear
            </Button>
          </>
        }
      >
        {novoBloqueio && (
          <form id="form-bloqueio" onSubmit={salvarBloqueio} className="space-y-4">
            <Field label="Veículo" required>
              <Select
                value={novoBloqueio.vehicleId}
                onChange={(e) => setNovoBloqueio({ ...novoBloqueio, vehicleId: e.target.value })}
                required
              >
                {dados?.veiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.model} · {v.plate}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Do dia" required>
                <Input
                  type="date"
                  value={novoBloqueio.de}
                  onChange={(e) => setNovoBloqueio({ ...novoBloqueio, de: e.target.value })}
                  required
                />
              </Field>
              <Field label="Até o dia" hint="Inclusive: o dia inteiro fica bloqueado." required>
                <Input
                  type="date"
                  value={novoBloqueio.ate}
                  min={novoBloqueio.de}
                  onChange={(e) => setNovoBloqueio({ ...novoBloqueio, ate: e.target.value })}
                  required
                />
              </Field>
            </div>

            <Field label="Motivo" hint="Aparece só para você.">
              <Input
                value={novoBloqueio.reason}
                onChange={(e) => setNovoBloqueio({ ...novoBloqueio, reason: e.target.value })}
                placeholder="Ex.: revisão dos 40 mil km"
              />
            </Field>

            {novoBloqueio.erro && (
              <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 rounded-xl px-3.5 py-2.5">
                {novoBloqueio.erro}
              </div>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}

/** Item da legenda de cores. */
function Legenda({ cor, texto, listrada = false }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cx('relative w-3 h-3 rounded overflow-hidden', cor)}>
        {listrada && (
          <span
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,.7) 2px, rgba(255,255,255,.7) 4px)',
            }}
          />
        )}
      </span>
      {texto}
    </span>
  );
}

/** Linha rótulo/valor dos detalhes. */
function Linha({ rotulo, valor }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-borda last:border-0">
      <span className="text-suave text-[13px]">{rotulo}</span>
      <span className="text-conteudo text-[13px] font-medium text-right">{valor}</span>
    </div>
  );
}

/** Coluna/grupo da visão "Por dia" (Livres, Alugados, Manutenção). */
function GrupoDia({ titulo, cor, contagem, children }) {
  const tons = {
    emerald: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15',
    brand: 'text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/15',
    slate: 'text-conteudo-2 bg-sutil',
  };
  return (
    <Card className="overflow-hidden">
      <div className={cx('flex items-center justify-between px-4 py-2.5 text-[13px] font-semibold', tons[cor])}>
        <span>{titulo}</span>
        <span className="tabular">{contagem}</span>
      </div>
      <div className="divide-y divide-borda">{children}</div>
    </Card>
  );
}

function VazioDia({ texto }) {
  return <p className="text-xs text-suave-2 px-3 py-5 text-center">{texto}</p>;
}
