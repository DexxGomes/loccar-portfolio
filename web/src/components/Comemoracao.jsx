// ============================================================================
//  COMEMORAÇÃO
//  Papeizinhos coloridos quando você conclui algo que dá trabalho: aprovar uma
//  reserva, zerar as tarefas do dia, terminar a configuração.
//
//  Regras que mantêm isso agradável em vez de irritante:
//   - dura ~1,5s e some sozinha;
//   - não recebe clique (nunca atrapalha o que você ia fazer);
//   - não aparece para quem pediu menos animação no sistema;
//   - só toca em CONCLUSÃO de verdade, nunca em ação corriqueira.
// ============================================================================
import { useEffect, useRef, useState } from 'react';

// Cores da marca + verde de "deu certo". Nada de arco-íris.
const CORES = ['#2563EB', '#3B82F6', '#10B981', '#F59E0B', '#60A5FA'];
const QUANTIDADE = 26;
const DURACAO_MS = 1700;

/** Quem pediu menos animação no sistema não vê a comemoração. */
function querMenosAnimacao() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Mostra a comemoração quando `ativo` vira true.
 * @param {boolean} ativo
 * @param {() => void} [aoTerminar]
 */
export default function Comemoracao({ ativo, aoTerminar }) {
  const [tocando, setTocando] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (!ativo || querMenosAnimacao()) return;
    setTocando(true);
    timer.current = setTimeout(() => {
      setTocando(false);
      aoTerminar?.();
    }, DURACAO_MS);
    return () => clearTimeout(timer.current);
  }, [ativo, aoTerminar]);

  if (!tocando) return null;

  // Os papeizinhos são sorteados uma vez por rodada; posições diferentes a
  // cada comemoração deixam o efeito menos mecânico.
  const papeis = Array.from({ length: QUANTIDADE }, (_, i) => ({
    cor: CORES[i % CORES.length],
    x: `${(Math.random() - 0.5) * 90}vw`,
    giro: `${Math.round((Math.random() - 0.5) * 900)}deg`,
    atraso: `${Math.random() * 0.25}s`,
    largura: 7 + Math.random() * 6,
  }));

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[120] overflow-hidden"
    >
      {papeis.map((p, i) => (
        <span
          key={i}
          className="confete-particula"
          style={{
            background: p.cor,
            width: `${p.largura}px`,
            '--x': p.x,
            '--giro': p.giro,
            '--atraso': p.atraso,
          }}
        />
      ))}
    </div>
  );
}
