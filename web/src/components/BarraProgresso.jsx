// ============================================================================
//  BARRA DE CARREGAMENTO GLOBAL
//
//  Fica no rodapé da tela e acende sozinha sempre que o painel está falando
//  com o servidor — inclusive no login, que é onde a espera mais assusta.
//
//  Por que ela existe: a API pode demorar a responder na PRIMEIRA chamada do
//  dia (o servidor hiberna quando ninguém usa e leva alguns segundos para
//  acordar). Sem sinal de vida, a pessoa acha que o sistema travou, clica de
//  novo, desiste. A barra responde "estou trabalhando" antes de a pergunta
//  aparecer na cabeça dela.
//
//  Ela nunca chega a 100% antes da resposta: uma barra que enche e para é pior
//  do que barra nenhuma, porque mente.
// ============================================================================
import { useEffect, useState } from 'react';
import { observarRede } from '../api.js';

// Depois disto, além da barra, explicamos por escrito o que está acontecendo.
const AVISO_DEMORA_MS = 4000;

export default function BarraProgresso() {
  const [ocupado, setOcupado] = useState(false); // há chamadas no ar?
  const [visivel, setVisivel] = useState(false); // a barra está na tela?
  const [progresso, setProgresso] = useState(0);
  const [demorando, setDemorando] = useState(false);

  // Liga no cliente HTTP: qualquer api.get/post do sistema passa por aqui.
  useEffect(() => observarRede((chamadas) => setOcupado(chamadas > 0)), []);

  useEffect(() => {
    if (ocupado) {
      setVisivel(true);
      setProgresso(8);
      setDemorando(false);

      // Avança e vai freando: quanto mais perto de 90%, menor o passo. Dá a
      // sensação de progresso real sem prometer um fim que não controlamos.
      const passo = setInterval(() => {
        setProgresso((p) => (p >= 90 ? p : p + Math.max(0.5, (90 - p) / 20)));
      }, 200);
      const aviso = setTimeout(() => setDemorando(true), AVISO_DEMORA_MS);

      return () => {
        clearInterval(passo);
        clearTimeout(aviso);
      };
    }

    if (!visivel) return;

    // Terminou: fecha em 100% e some. O pulinho final é o que dá a sensação
    // de "pronto" — sumir no meio do caminho parece falha.
    setProgresso(100);
    setDemorando(false);
    const sumir = setTimeout(() => {
      setVisivel(false);
      setProgresso(0);
    }, 400);
    return () => clearTimeout(sumir);
    // `visivel` de propósito fora das dependências: ele é consequência deste
    // efeito, não gatilho. Incluí-lo faria o efeito rodar de novo ao sumir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocupado]);

  if (!visivel) return null;

  return (
    <>
      {/* A barrinha */}
      <div
        className="fixed inset-x-0 bottom-0 z-[120] h-[3px] pointer-events-none print:hidden"
        role="progressbar"
        aria-label="Carregando"
        aria-busy="true"
      >
        <div
          className="h-full rounded-r-full bg-brand-600 dark:bg-brand-400 shadow-brand-glow
                     transition-[width,opacity] duration-200 ease-smooth"
          style={{ width: `${progresso}%`, opacity: progresso >= 100 ? 0 : 1 }}
        />
      </div>

      {/* Só quando passa do normal: explica, para ninguém achar que travou. */}
      {demorando && (
        <div className="fixed inset-x-0 bottom-3.5 z-[120] flex justify-center px-4 pointer-events-none print:hidden">
          <span
            role="status"
            className="rounded-full bg-ink-900/90 dark:bg-slate-200/95 text-white dark:text-ink-900
                       text-[12px] font-medium leading-snug text-center px-3.5 py-2
                       shadow-pop backdrop-blur-sm animate-fade-up"
          >
            Acordando o servidor… a primeira entrada do dia pode levar até 1 minuto.
          </span>
        </div>
      )}
    </>
  );
}
