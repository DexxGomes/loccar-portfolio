// ============================================================================
//  PRIMEIROS PASSOS
//  Guia curto que mostra o que falta para o sistema rodar sozinho. Cada passo
//  se marca SOZINHO quando a condição acontece (cadastrou carro, conectou o
//  WhatsApp…) — não existe botão de "marcar como feito".
//
//  Quando tudo o que é obrigatório fica pronto, o guia SOME da tela: guia
//  concluído vira poluição.
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Rocket, ChevronRight, X } from 'lucide-react';
import { api } from '../api.js';
import Comemoracao from './Comemoracao.jsx';
import { Card, Button, cx } from './ui.jsx';

const ESCONDIDO = 'primeiros-passos-escondido';
// Marca que a festa de "configuração concluída" já aconteceu — ela é uma vez
// na vida da locadora, não a cada vez que a tela abre.
const JA_FESTEJOU = 'primeiros-passos-festejado';

export default function PrimeirosPassos() {
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [comemorar, setComemorar] = useState(false);
  const [escondido, setEscondido] = useState(
    () => localStorage.getItem(ESCONDIDO) === 'sim'
  );
  const contagemAnterior = useRef(null);

  useEffect(() => {
    api
      .get('/api/dashboard/primeiros-passos')
      .then((novo) => {
        setD(novo);
        // Terminou a configuração agora, com a tela aberta? Festa (uma vez só).
        const antes = contagemAnterior.current;
        if (
          novo?.pronto &&
          antes !== null &&
          antes < novo.concluidos &&
          localStorage.getItem(JA_FESTEJOU) !== 'sim'
        ) {
          localStorage.setItem(JA_FESTEJOU, 'sim');
          setComemorar(true);
        }
        contagemAnterior.current = novo?.concluidos ?? null;
      })
      .catch(() => setD(false));
  }, []);

  if (comemorar) {
    return <Comemoracao ativo aoTerminar={() => setComemorar(false)} />;
  }

  // Sem dados, tudo pronto, ou dispensado pelo dono: não aparece.
  if (!d || d.pronto || escondido) return null;

  const pct = Math.round((d.concluidos / d.total) * 100);
  const proximo = d.passos.find((p) => !p.feito);

  function dispensar() {
    localStorage.setItem(ESCONDIDO, 'sim');
    setEscondido(true);
  }

  return (
    <Card className="mb-6 overflow-hidden animate-fade-up">
      <div className="p-5 pb-4">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 shrink-0">
            <Rocket size={19} strokeWidth={2.1} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-conteudo">
              Falta pouco para tudo funcionar sozinho
            </div>
            <p className="text-[13px] text-suave mt-0.5">
              {d.concluidos} de {d.total} prontos
              {proximo ? ` · o próximo é ${proximo.titulo.toLowerCase()}` : ''}
            </p>
          </div>
          <button
            onClick={dispensar}
            aria-label="Dispensar o guia"
            title="Dispensar"
            className="shrink-0 p-1.5 rounded-lg text-suave-2 hover:bg-sutil hover:text-conteudo transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progresso */}
        <div className="mt-4 h-2 rounded-full bg-sutil overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-700 ease-smooth"
            style={{ width: `${Math.max(pct, 3)}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-borda border-t border-borda">
        {d.passos.map((p) => (
          <div
            key={p.id}
            className={cx(
              'flex items-center gap-3.5 px-4 sm:px-5 py-3.5',
              p.feito ? 'opacity-60' : 'hover:bg-elevado transition-colors'
            )}
          >
            {/* Marcador: check verde quando pronto, círculo vazio quando falta */}
            <span
              className={cx(
                'grid place-items-center w-6 h-6 rounded-full shrink-0 transition-colors',
                p.feito
                  ? 'bg-emerald-500 text-white'
                  : 'border-2 border-borda-forte text-transparent'
              )}
            >
              <Check size={13} strokeWidth={3} />
            </span>

            <div className="min-w-0 flex-1">
              <div
                className={cx(
                  'text-[14px] text-conteudo',
                  p.feito ? 'line-through decoration-1' : 'font-medium'
                )}
              >
                {p.titulo}
                {p.opcional && !p.feito && (
                  <span className="ml-2 text-[11px] font-normal text-suave-2">opcional</span>
                )}
              </div>
              <div className="text-[12.5px] text-suave mt-0.5">
                {p.feito && p.detalhe ? p.detalhe : p.porque}
              </div>
            </div>

            {!p.feito && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => nav(p.para)}
                  className="shrink-0 hidden sm:inline-flex"
                >
                  {p.acao}
                </Button>
                <button
                  onClick={() => nav(p.para)}
                  aria-label={p.acao}
                  className="sm:hidden shrink-0 grid place-items-center w-9 h-9 rounded-xl text-suave hover:bg-sutil hover:text-conteudo transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
