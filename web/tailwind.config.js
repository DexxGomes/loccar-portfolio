/** @type {import('tailwindcss').Config} */

// ============================================================================
//  TOKENS DE DESIGN DO LOCCAR (v2)
//  Tudo que define "a cara" do painel mora aqui: cores da marca, sombras,
//  curvas de animação e keyframes. As telas só consomem esses tokens —
//  assim o visual muda em um lugar só.
// ============================================================================
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // O tema escuro é ligado pela classe .dark no <html> (não pelo sistema
  // operacional direto), porque quem manda é a escolha do usuário.
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Pilha de fontes do sistema (zero download, carrega instantâneo).
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI Variable',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },

      colors: {
        // Azul da marca (mesma escala do blue do Tailwind, nomeada como "brand"
        // para deixar explícito o que é identidade e o que é neutro).
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172554',
        },
        // Grafite do menu lateral e das superfícies escuras.
        ink: {
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#080F1D',
        },

        // --------------------------------------------------------------
        //  CORES SEMÂNTICAS (claro e escuro no mesmo nome)
        //  As telas usam "bg-superficie" e "text-conteudo", nunca
        //  "bg-white" ou "text-slate-900". Os valores vêm das variáveis
        //  CSS em index.css, que trocam quando o <html> ganha .dark —
        //  por isso o painel inteiro vira de tema sem duplicar classe.
        // --------------------------------------------------------------
        fundo: 'rgb(var(--c-fundo) / <alpha-value>)', // fundo da página
        superficie: 'rgb(var(--c-superficie) / <alpha-value>)', // cartões
        elevado: 'rgb(var(--c-elevado) / <alpha-value>)', // faixas e cabeçalhos
        sutil: 'rgb(var(--c-sutil) / <alpha-value>)', // preenchimentos leves
        conteudo: 'rgb(var(--c-conteudo) / <alpha-value>)', // texto principal
        'conteudo-2': 'rgb(var(--c-conteudo-2) / <alpha-value>)', // texto de apoio
        suave: 'rgb(var(--c-suave) / <alpha-value>)', // rótulos
        'suave-2': 'rgb(var(--c-suave-2) / <alpha-value>)', // texto discreto
        borda: 'rgb(var(--c-borda) / <alpha-value>)',
        'borda-forte': 'rgb(var(--c-borda-forte) / <alpha-value>)',
      },

      boxShadow: {
        // Elevações discretas: o painel usa profundidade, não contorno pesado.
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        'card-hover': '0 4px 6px -1px rgb(15 23 42 / 0.07), 0 2px 4px -2px rgb(15 23 42 / 0.05)',
        lift: '0 10px 24px -6px rgb(15 23 42 / 0.12), 0 4px 8px -4px rgb(15 23 42 / 0.06)',
        pop: '0 16px 40px -12px rgb(15 23 42 / 0.28), 0 4px 12px -4px rgb(15 23 42 / 0.10)',
        rail: '1px 0 0 0 rgb(15 23 42 / 0.06)',
        'brand-glow': '0 8px 24px -8px rgb(37 99 235 / 0.55)',
      },

      borderRadius: {
        '4xl': '2rem',
      },

      transitionTimingFunction: {
        // Curva usada em todas as entradas/saídas (suave, sem elástico exagerado).
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },

      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-left': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgb(37 99 235 / 0.45)' },
          '70%': { boxShadow: '0 0 0 8px rgb(37 99 235 / 0)' },
          '100%': { boxShadow: '0 0 0 0 rgb(37 99 235 / 0)' },
        },
        'draw-line': {
          from: { strokeDashoffset: '1000' },
          to: { strokeDashoffset: '0' },
        },
      },

      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'fade-up': 'fade-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-left': 'slide-left 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-right': 'slide-in-right 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-left': 'slide-in-left 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
        'draw-line': 'draw-line 1.1s ease-out both',
      },
    },
  },
  plugins: [],
};
