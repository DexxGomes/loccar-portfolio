// ============================================================================
//  ESQUELETOS DE CARREGAMENTO
//  Em vez de uma roda girando, mostramos a "sombra" do conteúdo que está
//  chegando. A tela não pula quando os dados carregam.
// ============================================================================
import { cx } from './ui.jsx';

/** Bloco cinza com brilho passando (base de todos os esqueletos). */
export function Skeleton({ className = '' }) {
  return (
    <div className={cx('relative overflow-hidden rounded-lg bg-sutil', className)}>
      {/* No escuro o brilho precisa ser bem mais fraco: o mesmo branco a 70%
          viraria um flash a cada 1,6 s. */}
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 dark:via-white/[0.06] to-transparent" />
    </div>
  );
}

/** Esqueleto de tabela (desktop) / lista (celular). */
export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div className="p-5">
      <div className="hidden md:block">
        <Skeleton className="h-8 w-full mb-4" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 py-3 border-t border-borda">
            {Array.from({ length: cols }).map((__, j) => (
              <Skeleton key={j} className={cx('h-4', j === 0 ? 'w-1/4' : 'flex-1')} />
            ))}
          </div>
        ))}
      </div>
      <div className="md:hidden space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-xl border border-borda p-4 space-y-2.5">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Esqueleto de uma fileira de indicadores (dashboard). */
export function SkeletonStats({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-superficie border border-borda/80 rounded-2xl p-5 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Esqueleto de cartões (análise, conversas). */
export function SkeletonCards({ count = 2 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-superficie border border-borda/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}
