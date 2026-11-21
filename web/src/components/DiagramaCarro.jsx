// ============================================================================
//  DIAGRAMA DO CARRO (vista de cima) PARA MARCAR AVARIAS
//
//  Toque/clique no desenho cria um marcador; clique no marcador remove.
//  As coordenadas são guardadas em PERCENTUAL da figura, então a marca fica
//  no mesmo ponto do carro em qualquer tamanho de tela.
// ============================================================================
import { cx } from './ui.jsx';

// Cor por gravidade — o marcador também mostra o número, então a cor nunca é
// a única informação.
export const COR_GRAVIDADE = {
  leve: '#F59E0B',
  media: '#EA580C',
  grave: '#DC2626',
};

export const ROTULO_GRAVIDADE = { leve: 'Leve', media: 'Média', grave: 'Grave' };

/** Descobre a região do carro pelo ponto, para nomear a avaria sozinho. */
export function parteDoCarro(x, y) {
  const faixa = y < 22 ? 'dianteira' : y > 78 ? 'traseira' : 'central';
  const lado = x < 33 ? 'esquerda' : x > 67 ? 'direita' : 'centro';
  if (faixa === 'dianteira') return lado === 'centro' ? 'Capô / frente' : `Farol ${lado}`;
  if (faixa === 'traseira') return lado === 'centro' ? 'Porta-malas' : `Lanterna ${lado}`;
  if (lado === 'centro') return 'Teto';
  return `Lateral ${lado}`;
}

export default function DiagramaCarro({ avarias = [], onAdicionar, onRemover, somenteLeitura }) {
  function aoClicar(e) {
    if (somenteLeitura || !onAdicionar) return;
    const caixa = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - caixa.left) / caixa.width) * 100;
    const y = ((e.clientY - caixa.top) / caixa.height) * 100;
    onAdicionar({ x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), parte: parteDoCarro(x, y) });
  }

  return (
    <div
      onClick={aoClicar}
      className={cx(
        'relative mx-auto w-full max-w-[220px] select-none',
        !somenteLeitura && 'cursor-crosshair'
      )}
    >
      <svg viewBox="0 0 200 380" className="w-full" aria-label="Desenho do carro visto de cima">
        {/* rodas */}
        <rect x="14" y="70" width="18" height="46" rx="7" className="fill-borda-forte" />
        <rect x="168" y="70" width="18" height="46" rx="7" className="fill-borda-forte" />
        <rect x="14" y="266" width="18" height="46" rx="7" className="fill-borda-forte" />
        <rect x="168" y="266" width="18" height="46" rx="7" className="fill-borda-forte" />

        {/* carroceria */}
        <rect
          x="26"
          y="8"
          width="148"
          height="364"
          rx="52"
          className="fill-sutil stroke-borda-forte"
          strokeWidth="2"
        />

        {/* para-brisa e vidro traseiro */}
        <path d="M52 118 Q100 96 148 118 L140 152 Q100 140 60 152 Z" className="fill-borda" />
        <path d="M60 236 Q100 224 140 236 L148 268 Q100 288 52 268 Z" className="fill-borda" />

        {/* teto */}
        <rect x="56" y="156" width="88" height="76" rx="14" className="fill-borda/70" />

        {/* retrovisores */}
        <rect x="18" y="150" width="12" height="20" rx="5" className="fill-borda-forte" />
        <rect x="170" y="150" width="12" height="20" rx="5" className="fill-borda-forte" />

        {/* faróis e lanternas */}
        <rect x="44" y="16" width="34" height="12" rx="6" className="fill-borda-forte" />
        <rect x="122" y="16" width="34" height="12" rx="6" className="fill-borda-forte" />
        <rect x="44" y="352" width="34" height="12" rx="6" className="fill-borda-forte" />
        <rect x="122" y="352" width="34" height="12" rx="6" className="fill-borda-forte" />

        {/* orientação */}
        <text x="100" y="60" textAnchor="middle" className="fill-suave text-[11px]">
          FRENTE
        </text>
        <text x="100" y="330" textAnchor="middle" className="fill-suave text-[11px]">
          TRASEIRA
        </text>
      </svg>

      {/* Marcadores das avarias */}
      {avarias.map((a, i) => (
        <button
          key={i}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!somenteLeitura) onRemover?.(i);
          }}
          title={`${a.parte || 'Avaria'}${a.descricao ? ` — ${a.descricao}` : ''} (${
            ROTULO_GRAVIDADE[a.gravidade] || 'Leve'
          })`}
          style={{
            left: `${a.x}%`,
            top: `${a.y}%`,
            backgroundColor: COR_GRAVIDADE[a.gravidade] || COR_GRAVIDADE.leve,
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full
                     text-white text-[11px] font-bold grid place-items-center
                     ring-2 ring-white shadow-md hover:scale-110 transition-transform"
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}
