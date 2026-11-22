// ============================================================================
//  CALENDÁRIO DO MÊS — retiradas e devoluções
//
//  As faixas de Gantt respondem "qual carro está livre". Esta tela responde a
//  outra pergunta, que é a que o dono faz de manhã: "o que eu tenho pra fazer
//  hoje?". Por isso o desenho é por DIA, não por veículo.
//
//  Feito para o celular primeiro: grade de mês que cabe no polegar em cima, e
//  a lista do dia escolhido logo abaixo — tudo numa rolagem só, sem navegar
//  para outra tela. No computador a mesma coisa ganha espaço.
//
//  ▲ retirada (carro sai)      ▼ devolução (carro volta)
// ============================================================================
import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  CalendarCheck,
} from 'lucide-react';
import { hora, telefone, maiusculaInicial } from '../format.js';
import { Card, Badge, EmptyState, cx } from './ui.jsx';

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Meia-noite local — comparar dia com dia, nunca instante com instante. */
function inicioDoDia(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const mesmoDia = (a, b) => inicioDoDia(a).getTime() === inicioDoDia(b).getTime();

/** Todas as células da grade: dias do mês + o resto da semana nas pontas. */
function gerarGrade(mesBase) {
  const primeiro = new Date(mesBase.getFullYear(), mesBase.getMonth(), 1);
  const comeco = new Date(primeiro);
  comeco.setDate(comeco.getDate() - comeco.getDay()); // volta pro domingo

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(comeco);
    d.setDate(comeco.getDate() + i);
    return d;
  });
}

/**
 * Uma locação está atrasada quando o carro ainda está na rua e a hora de
 * devolver já passou. É o único item da tela que precisa gritar.
 */
function estaAtrasada(r, agora) {
  return r.status === 'em_andamento' && new Date(r.return_at) < agora;
}

export default function CalendarioMes({ mesBase, reservas = [], diaEscolhido, onEscolherDia, onTrocarMes }) {
  const agora = useMemo(() => new Date(), []);
  const [hoje] = useState(() => inicioDoDia(new Date()));

  const grade = useMemo(() => gerarGrade(mesBase), [mesBase]);

  // Um índice por dia: quem sai, quem volta, quem está atrasado.
  const porDia = useMemo(() => {
    const mapa = new Map();
    const pegar = (data) => {
      const chave = inicioDoDia(data).getTime();
      if (!mapa.has(chave)) mapa.set(chave, { retiradas: [], devolucoes: [], atrasadas: [] });
      return mapa.get(chave);
    };

    for (const r of reservas) {
      // Reservas canceladas/recusadas não são tarefa de ninguém.
      if (['cancelada', 'recusada', 'expirada'].includes(r.status)) continue;

      if (r.pickup_at) pegar(r.pickup_at).retiradas.push(r);
      if (r.return_at) {
        pegar(r.return_at).devolucoes.push(r);
        if (estaAtrasada(r, agora)) pegar(r.return_at).atrasadas.push(r);
      }
    }
    return mapa;
  }, [reservas, agora]);

  const doDia = (d) =>
    porDia.get(inicioDoDia(d).getTime()) || { retiradas: [], devolucoes: [], atrasadas: [] };

  /**
   * Aperto: o carro volta e sai de novo com pouco tempo no meio. Não é erro do
   * sistema (o banco já impede sobreposição de verdade) — é aviso de que o dia
   * vai ser corrido e não dá para atrasar a limpeza.
   */
  const apertos = useMemo(() => {
    const porVeiculo = new Map();
    for (const r of reservas) {
      if (['cancelada', 'recusada', 'expirada'].includes(r.status)) continue;
      if (!porVeiculo.has(r.vehicle_id)) porVeiculo.set(r.vehicle_id, []);
      porVeiculo.get(r.vehicle_id).push(r);
    }

    const achados = new Set();
    for (const lista of porVeiculo.values()) {
      lista.sort((a, b) => new Date(a.pickup_at) - new Date(b.pickup_at));
      for (let i = 1; i < lista.length; i++) {
        const folga = new Date(lista[i].pickup_at) - new Date(lista[i - 1].return_at);
        // Menos de 2 horas entre devolver e sair de novo.
        if (folga >= 0 && folga < 2 * 60 * 60 * 1000) {
          achados.add(inicioDoDia(lista[i].pickup_at).getTime());
        }
      }
    }
    return achados;
  }, [reservas]);

  const rotuloMes = mesBase.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const detalhe = doDia(diaEscolhido);
  const temAperto = apertos.has(inicioDoDia(diaEscolhido).getTime());

  return (
    <div>
      {/* Navegação do mês — botões grandes, dá pra acertar com o polegar */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          onClick={() => onTrocarMes(-1)}
          aria-label="Mês anterior"
          className="grid place-items-center w-11 h-11 rounded-xl border border-borda text-suave
                     hover:text-conteudo hover:bg-sutil active:scale-95 transition-all"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-conteudo">{maiusculaInicial(rotuloMes)}</span>
        <button
          onClick={() => onTrocarMes(1)}
          aria-label="Próximo mês"
          className="grid place-items-center w-11 h-11 rounded-xl border border-borda text-suave
                     hover:text-conteudo hover:bg-sutil active:scale-95 transition-all"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Grade do mês */}
      <Card className="p-2 sm:p-3">
        <div className="grid grid-cols-7 mb-1">
          {DIAS_SEMANA.map((d, i) => (
            <div key={i} className="text-center text-[11px] font-semibold text-suave-2 py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {grade.map((d) => {
            const doMes = d.getMonth() === mesBase.getMonth();
            const ehHoje = mesmoDia(d, hoje);
            const escolhido = mesmoDia(d, diaEscolhido);
            const { retiradas, devolucoes, atrasadas } = doDia(d);
            const vazio = retiradas.length === 0 && devolucoes.length === 0;

            return (
              <button
                key={d.getTime()}
                onClick={() => onEscolherDia(d)}
                className={cx(
                  // min-h generoso: alvo de toque de dedo, não de mouse
                  'relative min-h-[52px] sm:min-h-[64px] rounded-lg p-1 flex flex-col items-center',
                  'transition-all active:scale-95',
                  !doMes && 'opacity-35',
                  escolhido
                    ? 'bg-brand-600 text-white'
                    : ehHoje
                    ? 'bg-brand-50 dark:bg-brand-500/15 ring-1 ring-inset ring-brand-400'
                    : 'hover:bg-sutil'
                )}
              >
                <span
                  className={cx(
                    'text-[13px] leading-none pt-1 tabular',
                    escolhido
                      ? 'font-bold'
                      : ehHoje
                      ? 'font-bold text-brand-700 dark:text-brand-300'
                      : 'font-medium text-conteudo'
                  )}
                >
                  {d.getDate()}
                </span>

                {/* Contagem do dia: o essencial em dois números */}
                {!vazio && (
                  <span className="mt-auto mb-0.5 flex items-center gap-1 text-[10px] font-semibold leading-none">
                    {retiradas.length > 0 && (
                      <span
                        className={cx(
                          'inline-flex items-center gap-0.5',
                          escolhido ? 'text-white' : 'text-brand-600 dark:text-brand-400'
                        )}
                      >
                        ▲{retiradas.length}
                      </span>
                    )}
                    {devolucoes.length > 0 && (
                      <span
                        className={cx(
                          'inline-flex items-center gap-0.5',
                          escolhido ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'
                        )}
                      >
                        ▼{devolucoes.length}
                      </span>
                    )}
                  </span>
                )}

                {/* Atraso é a única coisa que grita */}
                {atrasadas.length > 0 && (
                  <span
                    className={cx(
                      'absolute top-1 right-1 w-2 h-2 rounded-full',
                      escolhido ? 'bg-white' : 'bg-red-500'
                    )}
                    title="Tem devolução atrasada"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Legenda curta */}
        <div className="flex items-center justify-center gap-4 pt-2.5 mt-1 border-t border-borda text-[11px] text-suave">
          <span className="text-brand-600 dark:text-brand-400 font-semibold">▲ sai</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">▼ volta</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> atrasado
          </span>
        </div>
      </Card>

      {/* O dia escolhido, logo abaixo — no celular é só continuar rolando */}
      <div className="mt-5">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <h2 className="text-sm font-semibold text-conteudo">
            {maiusculaInicial(diaEscolhido.toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
            }))}
          </h2>
          {temAperto && (
            <Badge tone="amber" icon={AlertTriangle}>
              dia apertado
            </Badge>
          )}
        </div>

        {detalhe.retiradas.length === 0 && detalhe.devolucoes.length === 0 ? (
          <Card>
            <EmptyState
              icon={CalendarCheck}
              title="Nada marcado neste dia"
              hint="Nenhum carro sai nem volta. Toque em outro dia do calendário para ver."
            />
          </Card>
        ) : (
          <div className="space-y-2.5">
            {detalhe.retiradas.map((r) => (
              <LinhaDoDia key={`s-${r.id}`} r={r} tipo="retirada" agora={agora} />
            ))}
            {detalhe.devolucoes.map((r) => (
              <LinhaDoDia key={`v-${r.id}`} r={r} tipo="devolucao" agora={agora} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Uma tarefa do dia: sai ou volta, com hora, carro e cliente. */
function LinhaDoDia({ r, tipo, agora }) {
  const ehRetirada = tipo === 'retirada';
  const atrasada = !ehRetirada && estaAtrasada(r, agora);
  const quando = ehRetirada ? r.pickup_at : r.return_at;

  return (
    <Card
      className={cx(
        'p-3.5 flex items-start gap-3',
        atrasada && 'ring-1 ring-inset ring-red-300 dark:ring-red-500/40'
      )}
    >
      <span
        className={cx(
          'grid place-items-center w-10 h-10 rounded-xl shrink-0',
          atrasada
            ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400'
            : ehRetirada
            ? 'bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400'
            : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
        )}
      >
        {ehRetirada ? <ArrowUpRight size={19} /> : <ArrowDownLeft size={19} />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[15px] font-bold text-conteudo tabular">{hora(quando)}</span>
          <span className="text-[13px] font-medium text-conteudo-2">
            {ehRetirada ? 'sai' : 'volta'}
          </span>
          {atrasada && (
            <Badge tone="red" icon={AlertTriangle}>
              atrasado
            </Badge>
          )}
        </div>
        <div className="text-sm text-conteudo mt-1 truncate">
          {r.vehicle_model} <span className="text-suave-2 font-mono text-xs">{r.vehicle_plate}</span>
        </div>
        <div className="text-xs text-suave mt-0.5 truncate">
          {r.customer_name || 'Cliente sem nome'}
          {r.customer_phone ? ` · ${telefone(r.customer_phone)}` : ''}
        </div>
      </div>
    </Card>
  );
}
