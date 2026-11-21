// ============================================================================
//  KIT DE COMPONENTES DO PAINEL (v2)
//
//  Todas as telas montam a interface a partir daqui. A regra é simples:
//  se um acabamento (cor, raio, sombra, espaçamento) aparece em duas telas,
//  ele vira um componente neste arquivo.
//
//  CORES: use sempre os nomes semânticos (superficie, conteudo, borda…).
//  Eles já trocam sozinhos entre o tema claro e o escuro — escrever
//  "bg-white" ou "text-slate-900" quebra o modo escuro.
// ============================================================================
import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

/** Junta classes ignorando valores vazios/falsos. */
export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

// ----------------------------------------------------------------------------
// Cabeçalho de página
// ----------------------------------------------------------------------------

/** Título da tela, descrição e área de ações à direita. */
export function PageHeader({ title, subtitle, icon: Icon, children, className = '' }) {
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-4 mb-6', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/25">
              <Icon size={18} strokeWidth={2.2} />
            </span>
          )}
          <h1 className="text-[22px] sm:text-2xl font-bold tracking-tight text-conteudo truncate">
            {title}
          </h1>
        </div>
        {subtitle && <p className="text-sm text-suave mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Título de seção dentro de uma tela. */
export function SectionTitle({ children, hint, action }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-3">
      <div>
        <h2 className="text-sm font-semibold text-conteudo">{children}</h2>
        {hint && <p className="text-xs text-suave mt-0.5">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Superfícies
// ----------------------------------------------------------------------------

/** Superfície de cartão com borda suave e sombra discreta. */
export function Card({ className = '', hover = false, children, ...props }) {
  return (
    <div
      className={cx(
        'bg-superficie border border-borda rounded-2xl shadow-card dark:shadow-none',
        hover && 'transition-all duration-200 hover:shadow-card-hover hover:border-borda-forte',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Faixa de topo de um Card (título + ação). */
export function CardHeader({ title, subtitle, icon: Icon, action, className = '' }) {
  return (
    <div
      className={cx(
        'flex items-center justify-between gap-4 px-5 py-4 border-b border-borda',
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-sutil text-suave shrink-0">
            <Icon size={16} strokeWidth={2.2} />
          </span>
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-conteudo truncate">{title}</div>
          {subtitle && <div className="text-xs text-suave mt-0.5 truncate">{subtitle}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Linha divisória. */
export function Divider({ className = '' }) {
  return <div className={cx('h-px bg-borda', className)} />;
}

// ----------------------------------------------------------------------------
// Botões
// ----------------------------------------------------------------------------

const VARIANTES = {
  primary:
    'bg-brand-700 text-white shadow-sm hover:bg-brand-800 hover:shadow-brand-glow active:bg-brand-900 dark:bg-brand-600 dark:hover:bg-brand-500',
  secondary:
    'bg-superficie border border-borda-forte text-conteudo-2 shadow-sm hover:bg-elevado hover:border-suave-2 active:bg-sutil',
  ghost: 'text-conteudo-2 hover:bg-sutil hover:text-conteudo',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800',
  'danger-soft':
    'border border-red-200 text-red-600 bg-superficie hover:bg-red-50 hover:border-red-300 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10',
  success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800',
  dark: 'bg-ink-900 text-white shadow-sm hover:bg-ink-800 dark:bg-white dark:text-ink-900 dark:hover:bg-slate-200',
};

const TAMANHOS = {
  sm: 'px-3 py-1.5 text-[13px] gap-1.5 rounded-lg',
  md: 'px-4 py-2.5 text-sm gap-2 rounded-xl',
  lg: 'px-5 py-3 text-[15px] gap-2 rounded-xl',
};

/** Botão padrão do painel (com estado de carregamento embutido). */
export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  block = false,
  className = '',
  children,
  disabled,
  ...props
}) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center font-medium whitespace-nowrap',
        'transition-all duration-150 active:scale-[0.98]',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANTES[variant],
        TAMANHOS[size],
        block && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" />
      ) : (
        Icon && <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2.2} />
      )}
      {children}
    </button>
  );
}

/** Botão só de ícone (barra de topo, fechar modal, etc.). */
export function IconButton({ icon: Icon, label, size = 18, className = '', ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'grid place-items-center w-9 h-9 rounded-xl text-suave',
        'hover:bg-sutil hover:text-conteudo transition-colors active:scale-95',
        className
      )}
      {...props}
    >
      <Icon size={size} strokeWidth={2} />
    </button>
  );
}

/** Ação discreta dentro de tabelas (Editar, Remover…). */
export function LinkAction({ tone = 'blue', icon: Icon, className = '', children, ...props }) {
  const cores = {
    blue: 'text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15',
    red: 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/15',
    green: 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/15',
    slate: 'text-conteudo-2 hover:bg-sutil',
  };
  return (
    <button
      className={cx(
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
        cores[tone],
        className
      )}
      {...props}
    >
      {Icon && <Icon size={14} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

/** Tecla de atalho renderizada (⌘K, Esc…). */
export function Kbd({ children }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded-md border border-borda-forte bg-elevado text-[10px] font-sans font-medium text-suave">
      {children}
    </kbd>
  );
}

// ----------------------------------------------------------------------------
// Formulário
// ----------------------------------------------------------------------------

/** Estilo padrão de input/select (exportado para casos fora do componente). */
export const inputCls =
  'w-full bg-superficie border border-borda-forte rounded-xl px-3.5 py-2.5 text-sm text-conteudo ' +
  'placeholder:text-suave-2 outline-none transition-all ' +
  'focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 ' +
  'disabled:bg-elevado disabled:text-suave-2';

/** Campo com rótulo, dica e mensagem de erro. */
export function Field({ label, hint, error, required, className = '', children }) {
  return (
    <div className={className}>
      {label && (
        <label className="flex items-center gap-1 text-xs font-semibold text-conteudo-2 mb-1.5">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{error}</p>
      ) : (
        hint && <p className="text-xs text-suave-2 mt-1.5">{hint}</p>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} className={cx(inputCls, className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className = '', ...props }, ref) {
  return <textarea ref={ref} className={cx(inputCls, 'resize-y min-h-[84px]', className)} {...props} />;
});

export const Select = forwardRef(function Select({ className = '', children, ...props }, ref) {
  return (
    <select ref={ref} className={cx(inputCls, 'pr-9 appearance-none cursor-pointer', className)} {...props}>
      {children}
    </select>
  );
});

/** Grupo de opções em pílula (filtros rápidos). */
export function Segmented({ value, onChange, options, className = '' }) {
  return (
    <div
      className={cx(
        'inline-flex items-center gap-0.5 p-1 rounded-xl bg-sutil border border-borda',
        className
      )}
    >
      {options.map((o) => {
        const ativo = o.value === value;
        return (
          <button
            key={o.value ?? 'todos'}
            type="button"
            onClick={() => onChange(o.value)}
            className={cx(
              'px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap',
              ativo
                ? 'bg-superficie text-conteudo shadow-sm'
                : 'text-suave hover:text-conteudo hover:bg-superficie/60'
            )}
          >
            {o.label}
            {o.count != null && (
              <span
                className={cx(
                  'ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold',
                  ativo
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
                    : 'bg-borda text-suave'
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Indicadores
// ----------------------------------------------------------------------------

// No escuro os fundos claros viram um véu da própria cor (bem mais legível
// do que clarear o tom, que faria a etiqueta brilhar).
const TONS_BADGE = {
  slate: 'bg-sutil text-conteudo-2 ring-borda',
  brand:
    'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30',
  green:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
  amber:
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  red: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30',
  violet:
    'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30',
};

/** Etiqueta pequena (categoria, contagem, marcador). */
export function Badge({ tone = 'slate', icon: Icon, className = '', children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold',
        'ring-1 ring-inset whitespace-nowrap',
        TONS_BADGE[tone],
        className
      )}
    >
      {Icon && <Icon size={12} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

/** Barra de progresso (ocupação, checklist, upload). */
export function Progress({ value = 0, tone = 'brand', className = '' }) {
  const cores = {
    brand: 'bg-brand-600 dark:bg-brand-400',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };
  return (
    <div className={cx('h-1.5 w-full rounded-full bg-sutil overflow-hidden', className)}>
      <div
        className={cx('h-full rounded-full transition-all duration-700 ease-smooth', cores[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/** Avatar com as iniciais do nome. */
export function Avatar({ name = '', size = 36, className = '' }) {
  const iniciais = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  return (
    <span
      className={cx(
        'grid place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700',
        'text-white font-semibold shrink-0 select-none',
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {iniciais || '?'}
    </span>
  );
}

/** Dica ao passar o mouse (sem dependência externa). */
export function Tooltip({ label, side = 'top', children, className = '' }) {
  const pos = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };
  return (
    <span className={cx('relative inline-flex group', className)}>
      {children}
      <span
        role="tooltip"
        className={cx(
          'pointer-events-none absolute z-50 px-2 py-1 rounded-lg bg-ink-900 text-white',
          'dark:bg-slate-200 dark:text-ink-900',
          'text-[11px] font-medium whitespace-nowrap shadow-pop',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
          pos[side]
        )}
      >
        {label}
      </span>
    </span>
  );
}

// ----------------------------------------------------------------------------
// Estados
// ----------------------------------------------------------------------------

/** Roda de carregamento. */
export function Spinner({ size = 16, className = '' }) {
  return <Loader2 size={size} className={cx('animate-spin text-brand-600 dark:text-brand-400', className)} />;
}

/** Bloco de carregamento centralizado. */
export function Loading({ label = 'Carregando…', className = '' }) {
  return (
    <div className={cx('flex items-center justify-center gap-3 py-16 text-suave text-sm', className)}>
      <Spinner size={18} />
      {label}
    </div>
  );
}

/** Nada para mostrar ainda (com ação opcional). */
export function EmptyState({ icon: Icon, title, hint, action, className = '' }) {
  return (
    <div className={cx('flex flex-col items-center justify-center text-center py-16 px-6', className)}>
      {Icon && (
        <div className="relative mb-4">
          <div className="absolute inset-0 -m-4 rounded-full glow-brand opacity-70" />
          <div className="relative grid place-items-center w-14 h-14 rounded-2xl bg-superficie border border-borda shadow-card dark:shadow-none">
            <Icon size={24} className="text-brand-600 dark:text-brand-400" strokeWidth={1.8} />
          </div>
        </div>
      )}
      <p className="text-[15px] font-semibold text-conteudo">{title}</p>
      {hint && <p className="text-sm text-suave mt-1.5 max-w-sm leading-relaxed">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Faixa de erro padronizada. */
export function ErrorBanner({ children, onRetry }) {
  if (!children) return null;
  return (
    <div className="mb-4 flex items-start justify-between gap-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 animate-fade-in dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
      <span>{children}</span>
      {onRetry && (
        <button onClick={onRetry} className="font-semibold underline shrink-0 hover:text-red-800 dark:hover:text-red-200">
          Tentar de novo
        </button>
      )}
    </div>
  );
}
