// ============================================================================
//  HOJE
//  A primeira tela depois do login. Não é um painel de números: é a lista do
//  que precisa da sua mão AGORA, em ordem de urgência, cada item já com o
//  botão que resolve. Quando não há nada, ela diz isso com todas as letras.
//
//  Regra desta tela: nada aqui é decorativo. Se um item aparece, é porque
//  existe uma ação a tomar.
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun,
  ClipboardCheck,
  MessageSquare,
  ArrowUpRight,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Wallet,
  Car,
} from 'lucide-react';
import { api } from '../api.js';
import { lerSessao } from '../sessao.js';
import usePendencias from '../hooks/usePendencias.js';
import PrimeirosPassos from '../components/PrimeirosPassos.jsx';
import Comemoracao from '../components/Comemoracao.jsx';
import { hora, brlCurto } from '../format.js';
import { Card, Button, Loading, cx } from '../components/ui.jsx';

/** Saudação pelo horário — dá o tom de "bom dia, é isso que te espera". */
function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Uma tarefa da lista.
 * `tom` define a urgência: vermelho (atrasado), âmbar (decisão sua),
 * azul (acontece hoje).
 */
function Tarefa({ icon: Icon, tom, titulo, detalhe, acao, onAcao, destaque }) {
  const TONS = {
    vermelho: 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400',
    ambar: 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400',
    azul: 'bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400',
    verde: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  };

  return (
    <div
      className={cx(
        'flex items-center gap-3.5 px-4 sm:px-5 py-3.5 transition-colors hover:bg-elevado',
        destaque && 'bg-red-50/40 dark:bg-red-500/[0.07]'
      )}
    >
      <span className={cx('grid place-items-center w-10 h-10 rounded-xl shrink-0', TONS[tom])}>
        <Icon size={18} strokeWidth={2.1} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-conteudo leading-snug">{titulo}</div>
        {detalhe && <div className="text-[12.5px] text-suave mt-0.5 truncate">{detalhe}</div>}
      </div>

      {/* No celular o botão vira só a seta, para o texto do item ter espaço. */}
      <Button variant="secondary" onClick={onAcao} className="shrink-0 hidden sm:inline-flex">
        {acao}
      </Button>
      <button
        onClick={onAcao}
        aria-label={acao}
        className="sm:hidden shrink-0 grid place-items-center w-9 h-9 rounded-xl text-suave hover:bg-sutil hover:text-conteudo transition-colors"
      >
        <ArrowRight size={18} />
      </button>
    </div>
  );
}

export default function Hoje() {
  const nav = useNavigate();
  const pendencias = usePendencias();
  const [resumo, setResumo] = useState(null);
  const usuario = lerSessao('user');
  const primeiroNome = (usuario.name || '').split(' ')[0];

  // Números do mês — contexto, não tarefa. Ficam discretos no rodapé.
  useEffect(() => {
    api
      .get('/api/dashboard')
      .then(setResumo)
      .catch(() => setResumo(false));
  }, []);

  const { hoje, analise, conversas } = pendencias;
  const eventos = hoje?.eventos || [];
  const atrasadas = eventos.filter((e) => e.atrasada);
  const retiradas = eventos.filter((e) => !e.atrasada && e.tipo === 'retirada');
  const devolucoes = eventos.filter((e) => !e.atrasada && e.tipo === 'devolucao');

  const totalTarefas = atrasadas.length + analise + conversas + retiradas.length + devolucoes.length;
  const carregando = !hoje;

  // Comemora quando a lista ZERA com você olhando — não quando a tela abre já
  // vazia (aí não houve conquista nenhuma, seria festa por nada).
  const [comemorar, setComemorar] = useState(false);
  const tinhaTarefa = useRef(false);
  useEffect(() => {
    if (carregando) return;
    if (totalTarefas > 0) {
      tinhaTarefa.current = true;
    } else if (tinhaTarefa.current) {
      tinhaTarefa.current = false;
      setComemorar(true);
    }
  }, [totalTarefas, carregando]);

  return (
    <div>
      <Comemoracao ativo={comemorar} aoTerminar={() => setComemorar(false)} />

      {/* Cabeçalho: quem é você, que dia é hoje e quanto tem pra fazer. */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[13px] text-suave">
          <Sun size={15} />
          {new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
          })}
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-conteudo mt-1.5">
          {saudacao()}
          {primeiroNome ? `, ${primeiroNome}` : ''}.
        </h1>
        <p className="text-[15px] text-suave mt-1">
          {carregando
            ? 'Vendo o que te espera…'
            : totalTarefas === 0
            ? 'Nada precisa de você agora.'
            : totalTarefas === 1
            ? '1 coisa precisa de você.'
            : `${totalTarefas} coisas precisam de você.`}
        </p>
      </div>

      {/* Guia de configuração — some sozinho quando tudo estiver pronto. */}
      <PrimeirosPassos />

      {carregando ? (
        <Card className="py-10">
          <Loading label="Carregando o seu dia…" />
        </Card>
      ) : totalTarefas === 0 ? (
        // Dia limpo: fala claro e oferece o passo seguinte, sem enfeite vazio.
        <Card className="px-6 py-12 text-center">
          <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mb-4">
            <CheckCircle2 size={26} strokeWidth={2.1} />
          </span>
          <div className="text-lg font-semibold text-conteudo">Tudo em dia.</div>
          <p className="text-sm text-suave mt-1.5 max-w-sm mx-auto">
            Nenhuma retirada, devolução ou decisão esperando por você. A IA segue atendendo no
            WhatsApp e te chama se precisar.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            <Button variant="secondary" icon={Car} onClick={() => nav('/frota')}>
              Ver a frota
            </Button>
            <Button variant="secondary" icon={Wallet} onClick={() => nav('/financeiro')}>
              Ver o financeiro
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden divide-y divide-borda">
          {/* 1. Atrasado — o que dói primeiro */}
          {atrasadas.map((ev) => (
            <Tarefa
              key={`atraso-${ev.id}`}
              icon={AlertTriangle}
              tom="vermelho"
              destaque
              titulo={`Devolução atrasada — ${ev.customer_name || 'Cliente'}`}
              detalhe={`${ev.vehicle_model} · era para voltar às ${hora(ev.quando)}`}
              acao="Resolver"
              onAcao={() => nav('/agenda')}
            />
          ))}

          {/* 2. Decisões suas — a IA não decide sozinha */}
          {analise > 0 && (
            <Tarefa
              icon={ClipboardCheck}
              tom="ambar"
              titulo={
                analise === 1
                  ? '1 pré-reserva esperando sua aprovação'
                  : `${analise} pré-reservas esperando sua aprovação`
              }
              detalhe="Documentos enviados pelo cliente, prontos para conferir"
              acao="Analisar"
              onAcao={() => nav('/analise')}
            />
          )}

          {conversas > 0 && (
            <Tarefa
              icon={MessageSquare}
              tom="ambar"
              titulo={
                conversas === 1
                  ? '1 conversa precisa de você'
                  : `${conversas} conversas precisam de você`
              }
              detalhe="A IA transferiu porque saiu do que ela resolve"
              acao="Responder"
              onAcao={() => nav('/conversas')}
            />
          )}

          {/* 3. O que acontece hoje */}
          {retiradas.map((ev) => (
            <Tarefa
              key={`ret-${ev.id}`}
              icon={ArrowUpRight}
              tom="azul"
              titulo={`Retirada às ${hora(ev.quando)} — ${ev.customer_name || 'Cliente'}`}
              detalhe={`${ev.vehicle_model} · faça a vistoria na entrega`}
              acao="Abrir"
              onAcao={() => nav('/agenda')}
            />
          ))}

          {devolucoes.map((ev) => (
            <Tarefa
              key={`dev-${ev.id}`}
              icon={CalendarClock}
              tom="verde"
              titulo={`Devolução às ${hora(ev.quando)} — ${ev.customer_name || 'Cliente'}`}
              detalhe={`${ev.vehicle_model} · vistoria de devolução`}
              acao="Abrir"
              onAcao={() => nav('/agenda')}
            />
          ))}
        </Card>
      )}

      {/* Contexto do mês — discreto de propósito: não é tarefa. */}
      {resumo && resumo.indicadores && (
        <button
          onClick={() => nav('/painel')}
          className="mt-5 w-full flex flex-wrap items-center gap-x-6 gap-y-2 px-4 sm:px-5 py-3.5 rounded-2xl
                     bg-superficie border border-borda text-left hover:border-borda-forte transition-colors"
        >
          <span className="text-[12px] text-suave-2 uppercase tracking-wider font-semibold">
            No período
          </span>
          <span className="text-[13px] text-conteudo-2">
            Receita{' '}
            <b className="text-conteudo tabular">{brlCurto(resumo.indicadores.receita?.valor)}</b>
          </span>
          <span className="text-[13px] text-conteudo-2">
            Locações{' '}
            <b className="text-conteudo tabular">{resumo.indicadores.reservas?.valor ?? 0}</b>
          </span>
          <span className="text-[13px] text-conteudo-2">
            Ocupação{' '}
            <b className="text-conteudo tabular">{resumo.indicadores.ocupacao?.valor ?? 0}%</b>
          </span>
          <span className="ml-auto text-[13px] text-brand-600 dark:text-brand-400 font-medium inline-flex items-center gap-1">
            Ver os números <ArrowRight size={14} />
          </span>
        </button>
      )}
    </div>
  );
}
