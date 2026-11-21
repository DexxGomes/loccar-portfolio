// ============================================================================
//  GRÁFICOS DO PAINEL — SVG desenhado à mão, sem biblioteca externa.
//
//  Regras seguidas em todos eles (não mudar sem motivo):
//   - Traço da linha 2px, ponto final com anel branco de 2px.
//   - Preenchimento de área a 10% da cor (é um véu, não um bloco).
//   - Grade em fio de 1px, cinza recessivo, nunca tracejada.
//   - Barras no máximo 24px de espessura, ponta arredondada em 4px e base reta.
//   - Segmentos encostados são separados por 2px da cor do fundo (não por borda).
//   - Rótulo direto só no que importa (topo/ponta); o resto fica no tooltip.
//   - Texto nunca usa a cor do dado — texto é cinza; a cor fica na marca.
//
//  Cores: azul da marca para magnitude. O degradê do funil foi validado para
//  ter passos visíveis e o tom mais claro ainda destacar do fundo branco.
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { cx } from './ui.jsx';
import { useTema } from '../hooks/useTema.jsx';

// O azul da série vem de uma variável CSS: no tema escuro ele clareia sozinho
// (blue-600 sobre grafite não separa o suficiente do fundo).
export const AZUL = 'rgb(var(--c-serie))';

// Cinzas do gráfico (grade, cursor) e a cor do cartão, usada como anel dos
// pontos para eles não se confundirem com a linha ao se cruzarem.
const GRADE = 'rgb(var(--c-borda))';
const CURSOR = 'rgb(var(--c-suave))';
const SUPERFICIE = 'rgb(var(--c-superficie))';

// Degradê ordinal (etapas do funil): claro → escuro, passos aprovados no
// validador de contraste. No tema escuro a ordem se inverte, senão a última
// etapa (azul quase preto) sumiria no fundo.
export const DEGRADE_FUNIL = ['#60A5FA', '#3B82F6', '#1D4ED8', '#1E3A8A'];
export const DEGRADE_FUNIL_ESCURO = ['#1D4ED8', '#2563EB', '#3B82F6', '#93C5FD'];

// Cores de estado da frota (sempre acompanhadas de rótulo e número).
export const CORES_FROTA = {
  disponiveis: '#10B981',
  alugados: 'rgb(var(--c-serie))',
  manutencao: '#F59E0B',
};

/** Mede a largura real do container: o SVG é desenhado em pixels, sem esticar. */
export function useLargura() {
  const ref = useRef(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observador = new ResizeObserver((entradas) => {
      setLargura(entradas[0].contentRect.width);
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);
  return [ref, largura];
}

/** Arredonda o topo do eixo para um número "redondo" (0, 500, 1.000, 2.000…). */
function tetoBonito(valor) {
  if (valor <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(valor));
  for (const passo of [1, 1.5, 2, 2.5, 5, 10]) {
    const candidato = magnitude * passo;
    if (candidato >= valor) return candidato;
  }
  return magnitude * 10;
}

/** Caminho de barra com a ponta arredondada e a base reta (horizontal). */
function barraHorizontal(x, y, largura, altura, raio = 4) {
  const r = Math.min(raio, largura, altura / 2);
  if (largura <= r) return `M${x},${y} h${largura} v${altura} h${-largura} Z`;
  return [
    `M${x},${y}`,
    `H${x + largura - r}`,
    `A${r},${r} 0 0 1 ${x + largura},${y + r}`,
    `V${y + altura - r}`,
    `A${r},${r} 0 0 1 ${x + largura - r},${y + altura}`,
    `H${x}`,
    'Z',
  ].join(' ');
}

// ----------------------------------------------------------------------------
// Gráfico de área — evolução da receita no tempo (uma série só, sem legenda)
// ----------------------------------------------------------------------------
export function GraficoArea({ dados, altura = 240, formatarValor, formatarData }) {
  const [ref, largura] = useLargura();
  const [ativo, setAtivo] = useState(null);

  // Sem pontos não há o que desenhar (e Math.max de lista vazia daria -Infinity).
  if (!dados || dados.length === 0) {
    return (
      <div className="grid place-items-center text-sm text-suave-2" style={{ height: altura }}>
        Sem dados no período.
      </div>
    );
  }

  const PAD = { topo: 16, direita: 12, baixo: 26, esquerda: 52 };
  const l = Math.max(largura, 320);
  const areaLargura = l - PAD.esquerda - PAD.direita;
  const areaAltura = altura - PAD.topo - PAD.baixo;

  const valores = dados.map((d) => d.y);
  const maximo = tetoBonito(Math.max(...valores, 0));
  const px = (i) => PAD.esquerda + (dados.length <= 1 ? 0 : (i / (dados.length - 1)) * areaLargura);
  const py = (v) => PAD.topo + areaAltura - (v / maximo) * areaAltura;

  const linha = dados.map((d, i) => `${i === 0 ? 'M' : 'L'}${px(i)},${py(d.y)}`).join(' ');
  const area = `${linha} L${px(dados.length - 1)},${PAD.topo + areaAltura} L${px(0)},${
    PAD.topo + areaAltura
  } Z`;

  // Marcas do eixo Y (4 faixas) e do eixo X (início, meio, fim).
  const marcasY = [0, 0.25, 0.5, 0.75, 1].map((f) => maximo * f);
  const indicesX = dados.length > 1 ? [0, Math.floor((dados.length - 1) / 2), dados.length - 1] : [0];

  // Ponto de maior receita: único rótulo direto do gráfico.
  const iPico = valores.indexOf(Math.max(...valores));
  const temDados = valores.some((v) => v > 0);

  function aoMover(e) {
    const caixa = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - caixa.left - PAD.esquerda;
    const passo = areaLargura / Math.max(dados.length - 1, 1);
    const i = Math.max(0, Math.min(dados.length - 1, Math.round(x / passo)));
    setAtivo(i);
  }

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={l}
        height={altura}
        className="max-w-full overflow-visible"
        onMouseMove={aoMover}
        onMouseLeave={() => setAtivo(null)}
        role="img"
        aria-label="Receita por dia no período"
      >
        {/* Grade */}
        {marcasY.map((v, i) => (
          <g key={i}>
            {/* As cores vêm por `style` (CSS), não por atributo: variável CSS
                não é resolvida dentro de atributo de SVG. */}
            <line
              x1={PAD.esquerda}
              x2={l - PAD.direita}
              y1={py(v)}
              y2={py(v)}
              style={{ stroke: GRADE }}
              strokeWidth="1"
            />
            <text
              x={PAD.esquerda - 10}
              y={py(v) + 4}
              textAnchor="end"
              className="fill-suave text-[10px] tabular"
            >
              {formatarValor ? formatarValor(v, true) : v}
            </text>
          </g>
        ))}

        {/* Véu + linha */}
        <defs>
          <linearGradient id="veu-receita" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: AZUL }} stopOpacity="0.16" />
            <stop offset="100%" style={{ stopColor: AZUL }} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#veu-receita)" />
        <path
          d={linha}
          fill="none"
          style={{ stroke: AZUL }}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Rótulo direto no pico (só ele) */}
        {temDados && (
          <>
            <circle
              cx={px(iPico)}
              cy={py(valores[iPico])}
              r="4.5"
              style={{ fill: AZUL, stroke: SUPERFICIE }}
              strokeWidth="2"
            />
            <text
              x={Math.min(Math.max(px(iPico), PAD.esquerda + 18), l - PAD.direita - 18)}
              y={Math.max(py(valores[iPico]) - 12, 12)}
              textAnchor="middle"
              className="fill-suave text-[10px] font-semibold tabular"
            >
              {formatarValor ? formatarValor(valores[iPico]) : valores[iPico]}
            </text>
          </>
        )}

        {/* Cursor de leitura */}
        {ativo != null && (
          <g>
            <line
              x1={px(ativo)}
              x2={px(ativo)}
              y1={PAD.topo}
              y2={PAD.topo + areaAltura}
              style={{ stroke: CURSOR }}
              strokeWidth="1"
            />
            <circle
              cx={px(ativo)}
              cy={py(dados[ativo].y)}
              r="4.5"
              style={{ fill: AZUL, stroke: SUPERFICIE }}
              strokeWidth="2"
            />
          </g>
        )}

        {/* Eixo X */}
        {indicesX.map((i) => (
          <text
            key={i}
            x={px(i)}
            y={altura - 6}
            textAnchor={i === 0 ? 'start' : i === dados.length - 1 ? 'end' : 'middle'}
            className="fill-suave text-[10px]"
          >
            {formatarData ? formatarData(dados[i].x) : dados[i].x}
          </text>
        ))}
      </svg>

      {/* Tooltip */}
      {ativo != null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full
                     bg-ink-900 text-white rounded-xl px-3 py-2 shadow-pop whitespace-nowrap"
          style={{
            left: Math.min(Math.max(px(ativo), 60), l - 60),
            top: Math.max(py(dados[ativo].y) - 10, 8),
          }}
        >
          <div className="text-[10px] text-suave-2">
            {formatarData ? formatarData(dados[ativo].x, true) : dados[ativo].x}
          </div>
          <div className="text-[13px] font-semibold tabular">
            {formatarValor ? formatarValor(dados[ativo].y) : dados[ativo].y}
          </div>
          {dados[ativo].extra != null && (
            <div className="text-[10.5px] text-suave-2">{dados[ativo].extra}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Barras horizontais — ranking (uma cor só: o comprimento já diz o valor)
// ----------------------------------------------------------------------------
export function GraficoBarras({ dados, formatarValor, alturaBarra = 22, espaco = 14 }) {
  const [ref, largura] = useLargura();

  if (!dados || dados.length === 0) {
    return <p className="text-sm text-suave-2 py-6 text-center">Sem dados no período.</p>;
  }

  const l = Math.max(largura, 280);
  const LARGURA_ROTULO = Math.min(150, Math.max(96, l * 0.32));
  const PAD_DIREITA = 64;
  const areaLargura = Math.max(l - LARGURA_ROTULO - PAD_DIREITA, 40);
  const maximo = Math.max(...dados.map((d) => d.valor), 1);
  const altura = dados.length * (alturaBarra + espaco);
  // Quantos caracteres cabem no espaço do rótulo (≈6.2px por letra em 11.5px).
  // Medir antes evita o pior dos mundos: texto cortado por cima da barra.
  const maxLetras = Math.max(8, Math.floor((LARGURA_ROTULO - 10) / 6.2));

  return (
    <div ref={ref} className="w-full">
      <svg width={l} height={altura} className="max-w-full" role="img" aria-label="Ranking">
        {dados.map((d, i) => {
          const y = i * (alturaBarra + espaco);
          const comprimento = Math.max((d.valor / maximo) * areaLargura, d.valor > 0 ? 3 : 0);
          return (
            <g key={d.id ?? d.rotulo}>
              <text
                x={0}
                y={y + alturaBarra / 2 + 4}
                className="fill-conteudo-2 text-[11.5px]"
              >
                {d.rotulo.length > maxLetras ? `${d.rotulo.slice(0, maxLetras - 1)}…` : d.rotulo}
              </text>
              {/* trilho */}
              <rect
                x={LARGURA_ROTULO}
                y={y}
                width={areaLargura}
                height={alturaBarra}
                rx="4"
                className="fill-sutil"
              />
              <path
                d={barraHorizontal(LARGURA_ROTULO, y, comprimento, alturaBarra)}
                style={{ fill: AZUL }}
              />
              <text
                x={LARGURA_ROTULO + areaLargura + 8}
                y={y + alturaBarra / 2 + 4}
                className="fill-conteudo-2 text-[11.5px] font-semibold tabular"
              >
                {formatarValor ? formatarValor(d.valor) : d.valor}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Funil — etapas em ordem (degradê de um tom só: a cor mostra a sequência)
// ----------------------------------------------------------------------------
export function GraficoFunil({ etapas, formatarValor }) {
  const { escuro } = useTema();
  // No claro o degradê escurece a cada etapa; no escuro ele CLAREIA, senão a
  // última etapa (azul quase preto) desapareceria no fundo.
  const degrade = escuro ? DEGRADE_FUNIL_ESCURO : DEGRADE_FUNIL;
  const maximo = Math.max(...etapas.map((e) => e.valor), 1);
  return (
    <div className="space-y-3">
      {etapas.map((e, i) => {
        const porcento = (e.valor / maximo) * 100;
        const cor = degrade[Math.min(i, degrade.length - 1)];
        return (
          <div key={e.rotulo}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className="text-[12.5px] text-conteudo-2">{e.rotulo}</span>
              <span className="text-[13px] font-semibold text-conteudo tabular">
                {formatarValor ? formatarValor(e.valor) : e.valor}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-sutil overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-smooth"
                style={{ width: `${Math.max(porcento, e.valor > 0 ? 2 : 0)}%`, backgroundColor: cor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Barra empilhada — composição da frota (com legenda e números visíveis)
// ----------------------------------------------------------------------------
export function BarraComposicao({ partes, total }) {
  const soma = total || partes.reduce((s, p) => s + p.valor, 0) || 1;
  return (
    <div>
      {/* A barra usa 2px de fundo entre os pedaços: é o vão que separa, não borda */}
      <div className="flex gap-0.5 h-3.5 rounded-full overflow-hidden bg-sutil">
        {partes.map((p) =>
          p.valor > 0 ? (
            <div
              key={p.rotulo}
              className="h-full transition-all duration-700 ease-smooth"
              style={{ width: `${(p.valor / soma) * 100}%`, backgroundColor: p.cor }}
              title={`${p.rotulo}: ${p.valor}`}
            />
          ) : null
        )}
      </div>

      {/* Legenda sempre presente: identidade nunca depende só da cor */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3.5">
        {partes.map((p) => (
          <div key={p.rotulo} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: p.cor }}
              aria-hidden="true"
            />
            <span className="text-[12px] text-suave">{p.rotulo}</span>
            <span className="text-[12px] font-semibold text-conteudo tabular">{p.valor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Medidor — uma razão contra um limite (trilho é um tom claro da mesma cor)
// ----------------------------------------------------------------------------
export function Medidor({ valor, className = '' }) {
  const preenchido = Math.min(Math.max(valor, 0), 100);
  return (
    <div
      className={cx(
        'h-2.5 w-full rounded-full bg-brand-100 dark:bg-brand-500/20 overflow-hidden',
        className
      )}
    >
      <div
        className="h-full rounded-full bg-brand-600 dark:bg-brand-400 transition-all duration-700 ease-smooth"
        style={{ width: `${preenchido}%` }}
      />
    </div>
  );
}
