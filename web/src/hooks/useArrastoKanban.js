// ============================================================================
//  ARRASTAR CARTÃO NO DEDO (e no mouse também)
//
//  O arraste nativo do HTML (draggable + dataTransfer) simplesmente NÃO existe
//  no celular. Como o celular é a prioridade aqui, este gancho refaz o arraste
//  com Pointer Events, que valem para dedo, mouse e caneta igual.
//
//  DECISÃO IMPORTANTE — arrasta pela ALÇA, não pelo cartão inteiro.
//  Se o cartão todo pegasse o toque, o dedo não conseguiria mais rolar a lista:
//  todo movimento vertical viraria arraste. Com a alça, o polegar rola o funil
//  normalmente e só arrasta quando agarra de propósito. É o que os aplicativos
//  bons de kanban fazem, e é por isso que a alça agora aparece sempre no
//  celular (antes só surgia ao passar o mouse — ou seja, nunca, num telefone).
//
//  Uso:
//    const arrasto = useArrastoKanban({ onSoltar: (item, coluna) => ... });
//    <span {...arrasto.propsDaAlca(lead)}>alça</span>
//    <div data-coluna="novo"> ... </div>
//    {arrasto.fantasma && <div style={arrasto.estiloDoFantasma}>...</div>}
// ============================================================================
import { useCallback, useRef, useState } from 'react';

// Enquanto o dedo não andar isto, ainda é toque parado — evita disparar
// arraste em quem só encostou no cartão.
const FOLGA_PX = 6;

export function useArrastoKanban({ onSoltar }) {
  const [item, setItem] = useState(null); // o que está sendo arrastado
  const [ponto, setPonto] = useState({ x: 0, y: 0 });
  const [colunaAlvo, setColunaAlvo] = useState(null);
  // Estado de verdade (não ref): o fantasma só aparece depois que o dedo andou
  // além da folga, e isso precisa redesenhar a tela.
  const [arrastando, setArrastando] = useState(false);

  // Em ref fica só o que não deve provocar redesenho.
  const estado = useRef({ passouDaFolga: false, inicio: null });

  const encerrar = useCallback(() => {
    setItem(null);
    setColunaAlvo(null);
    setArrastando(false);
    estado.current = { passouDaFolga: false, inicio: null };
  }, []);

  /** Qual coluna está debaixo do dedo agora? */
  function colunaSob(x, y) {
    const alvo = document.elementFromPoint(x, y);
    const coluna = alvo?.closest?.('[data-coluna]');
    return coluna?.getAttribute('data-coluna') || null;
  }

  const propsDaAlca = useCallback(
    (dado) => ({
      // touch-action none SÓ na alça: é o que impede o navegador de rolar a
      // página quando o dedo agarra aqui. No resto do cartão a rolagem segue.
      style: { touchAction: 'none', cursor: 'grab' },

      onPointerDown: (e) => {
        // Botão direito / secundário não arrasta.
        if (e.button != null && e.button !== 0) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        estado.current = { passouDaFolga: false, inicio: { x: e.clientX, y: e.clientY } };
        setItem(dado);
        setPonto({ x: e.clientX, y: e.clientY });
      },

      onPointerMove: (e) => {
        if (!estado.current.inicio) return;
        const { x: x0, y: y0 } = estado.current.inicio;
        const andou = Math.hypot(e.clientX - x0, e.clientY - y0);
        if (!estado.current.passouDaFolga && andou < FOLGA_PX) return;
        if (!estado.current.passouDaFolga) {
          estado.current.passouDaFolga = true;
          setArrastando(true);
        }

        setPonto({ x: e.clientX, y: e.clientY });
        setColunaAlvo(colunaSob(e.clientX, e.clientY));
      },

      onPointerUp: (e) => {
        const alvo = estado.current.passouDaFolga ? colunaSob(e.clientX, e.clientY) : null;
        if (alvo && item) onSoltar(item, alvo);
        encerrar();
      },

      // Dedo saiu da tela, ligação caiu, sistema cancelou: solta sem mover nada.
      onPointerCancel: encerrar,
    }),
    [item, onSoltar, encerrar]
  );

  return {
    /** O item em movimento (null quando não há arraste). */
    fantasma: arrastando ? item : null,
    colunaAlvo,
    propsDaAlca,
    /** Posição do fantasma: segue o dedo, sem capturar toque. */
    estiloDoFantasma: {
      position: 'fixed',
      left: ponto.x,
      top: ponto.y,
      transform: 'translate(-50%, -50%) rotate(2deg)',
      pointerEvents: 'none',
      zIndex: 130,
    },
  };
}
