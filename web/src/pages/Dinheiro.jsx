// ============================================================================
//  DINHEIRO — RESUMO
//  A resposta para "como está o meu dinheiro?" numa tela só, em português de
//  dono de locadora: entrou, gastei, sobrou. Depois, o que ainda está em
//  aberto. Cada cartão leva para a tela onde se resolve aquilo.
//
//  Regra desta tela: nada de jargão contábil e nada de número sem legenda.
//  Se um valor precisa de explicação, a explicação vem embaixo dele.
// ============================================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Clock,
  ShieldCheck,
  Gavel,
  ArrowRight,
} from 'lucide-react';
import { api } from '../api.js';
import { brl } from '../format.js';
import { PageHeader, Card, Loading, ErrorBanner, Segmented, cx } from '../components/ui.jsx';

import { PERIODOS, intervaloDoPeriodo } from '../periodos.js';

/** Cartão grande dos três números da conta do mês. */
function Numerao({ icon: Icon, rotulo, valor, explicacao, tom }) {
  const TONS = {
    verde: {
      caixa: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      valor: 'text-emerald-700 dark:text-emerald-400',
    },
    vermelho: {
      caixa: 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400',
      valor: 'text-red-700 dark:text-red-400',
    },
    neutro: {
      caixa: 'bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400',
      valor: 'text-conteudo',
    },
  };
  const t = TONS[tom] || TONS.neutro;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5">
        <span className={cx('grid place-items-center w-9 h-9 rounded-xl shrink-0', t.caixa)}>
          <Icon size={17} strokeWidth={2.1} />
        </span>
        <span className="text-[13px] font-medium text-suave">{rotulo}</span>
      </div>
      <div className={cx('text-[28px] sm:text-[32px] font-extrabold tracking-tight mt-3 tabular', t.valor)}>
        {brl(valor)}
      </div>
      <p className="text-[12.5px] text-suave mt-1 leading-snug">{explicacao}</p>
    </Card>
  );
}

/** Linha do "ainda em aberto": valor, frase e o botão que resolve. */
function EmAberto({ icon: Icon, tom, titulo, valor, frase, acao, onAcao, alerta }) {
  const TONS = {
    vermelho: 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400',
    ambar: 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400',
    azul: 'bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400',
    cinza: 'bg-sutil text-suave',
  };

  return (
    <button
      onClick={onAcao}
      className={cx(
        'w-full text-left flex items-center gap-3.5 px-4 sm:px-5 py-4 transition-colors hover:bg-elevado',
        alerta && 'bg-red-50/40 dark:bg-red-500/[0.07]'
      )}
    >
      <span className={cx('grid place-items-center w-10 h-10 rounded-xl shrink-0', TONS[tom])}>
        <Icon size={18} strokeWidth={2.1} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-conteudo">{titulo}</div>
        <div className="text-[12.5px] text-suave mt-0.5">{frase}</div>
      </div>

      <div className="text-right shrink-0">
        <div className="text-[16px] font-bold text-conteudo tabular">{brl(valor)}</div>
        <div className="text-[11px] text-brand-600 dark:text-brand-400 font-medium inline-flex items-center gap-0.5">
          {acao} <ArrowRight size={12} />
        </div>
      </div>
    </button>
  );
}

export default function Dinheiro() {
  const nav = useNavigate();
  const [periodo, setPeriodo] = useState('mes');
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');

  async function carregar(opcao) {
    setD(null);
    setErro('');
    try {
      const { de, ate } = intervaloDoPeriodo(opcao);
      setD(await api.get(`/api/dashboard/dinheiro?from=${de}&to=${ate}`));
    } catch (e) {
      setErro(e.message);
    }
  }

  useEffect(() => {
    carregar(periodo);
  }, [periodo]);

  return (
    <div>
      <PageHeader
        icon={Wallet}
        title="Dinheiro"
        subtitle="O que entrou, o que saiu e o que ainda está em aberto."
      >
        <Segmented value={periodo} onChange={setPeriodo} options={PERIODOS} />
      </PageHeader>

      {erro && <ErrorBanner onRetry={() => carregar(periodo)}>{erro}</ErrorBanner>}

      {!d ? (
        <Card className="py-12">
          <Loading label="Somando tudo…" />
        </Card>
      ) : (
        <>
          {/* A conta do período: entrou − gastei = sobrou */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Numerao
              icon={TrendingUp}
              tom="verde"
              rotulo="Entrou"
              valor={d.entrou.valor}
              explicacao={`${d.entrou.qtd} pagamento(s) recebido(s) no período, sem contar caução.`}
            />
            <Numerao
              icon={TrendingDown}
              tom="vermelho"
              rotulo="Gastei"
              valor={d.gastos.valor}
              explicacao={`${d.gastos.qtd} despesa(s) lançada(s) no mesmo período.`}
            />
            <Numerao
              icon={Wallet}
              tom={d.saldo.positivo ? 'verde' : 'vermelho'}
              rotulo="Sobrou"
              valor={d.saldo.valor}
              explicacao={
                d.saldo.positivo
                  ? 'O que entrou menos o que você gastou. Está no azul.'
                  : 'Você gastou mais do que entrou neste período.'
              }
            />
          </div>

          {/* Onde o dinheiro foi parar */}
          {d.gastos.porCategoria?.length > 0 && (
            <Card className="mt-4 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-suave-2 mb-3">
                Para onde foram os gastos
              </div>
              <div className="space-y-2.5">
                {d.gastos.porCategoria.map((c) => {
                  const fatia = d.gastos.valor > 0 ? (c.total / d.gastos.valor) * 100 : 0;
                  return (
                    <div key={c.categoria} className="flex items-center gap-3">
                      <span className="text-[13px] text-conteudo-2 w-32 sm:w-40 shrink-0 truncate">
                        {c.categoria}
                      </span>
                      <span className="flex-1 h-2 rounded-full bg-sutil overflow-hidden">
                        <span
                          className="block h-full rounded-full bg-brand-500 transition-all duration-500"
                          style={{ width: `${Math.max(fatia, 2)}%` }}
                        />
                      </span>
                      <span className="text-[13px] font-semibold text-conteudo tabular shrink-0 w-24 text-right">
                        {brl(c.total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* O que ainda está em aberto (agora, não do período) */}
          <div className="text-[11px] font-semibold uppercase tracking-wider text-suave-2 mt-7 mb-2 px-1">
            Ainda em aberto — hoje
          </div>
          <Card className="overflow-hidden divide-y divide-borda">
            {d.vencido.valor > 0 && (
              <EmAberto
                icon={AlertCircle}
                tom="vermelho"
                alerta
                titulo="Passou do vencimento"
                frase={`${d.vencido.qtd} cobrança(s) que já venceram e ninguém pagou.`}
                valor={d.vencido.valor}
                acao="Cobrar"
                onAcao={() => nav('/financeiro')}
              />
            )}

            <EmAberto
              icon={Clock}
              tom="ambar"
              titulo="Falta receber"
              frase={
                d.aReceber.qtd > 0
                  ? `${d.aReceber.qtd} cobrança(s) em aberto, incluindo as que ainda não venceram.`
                  : 'Nada em aberto. Todo mundo em dia.'
              }
              valor={d.aReceber.valor}
              acao="Ver"
              onAcao={() => nav('/financeiro')}
            />

            <EmAberto
              icon={ShieldCheck}
              tom="azul"
              titulo="Caução em mãos"
              frase="Dinheiro do cliente que está com você e será devolvido na entrega."
              valor={d.caucaoEmMaos.valor}
              acao="Ver"
              onAcao={() => nav('/financeiro')}
            />

            <EmAberto
              icon={Gavel}
              tom={d.multasARepassar.valor > 0 ? 'ambar' : 'cinza'}
              titulo="Multas para repassar"
              frase={
                d.multasARepassar.qtd > 0
                  ? `${d.multasARepassar.qtd} multa(s) que você pagou e ainda não cobrou do locatário.`
                  : 'Nenhuma multa pendente de repasse.'
              }
              valor={d.multasARepassar.valor}
              acao="Ver"
              onAcao={() => nav('/multas')}
            />
          </Card>

          <p className="text-[12px] text-suave-2 mt-4 px-1">
            A caução não é sua receita — por isso ela não entra no “sobrou”.
          </p>
        </>
      )}
    </div>
  );
}
