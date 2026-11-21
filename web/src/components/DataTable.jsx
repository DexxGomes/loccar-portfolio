// ============================================================================
//  TABELA DE DADOS RESPONSIVA
//  No computador vira tabela; no celular, cada linha vira um cartão legível
//  (o dono da locadora vive no celular — tabela espremida não serve).
//
//  columns: [{ key, header, render(row), align, className, hideOnMobile }]
// ============================================================================
import { SkeletonTable } from './Skeleton.jsx';
import { cx } from './ui.jsx';

export default function DataTable({
  columns,
  rows,
  keyField = 'id',
  loading = false,
  empty = null,
  actions,
  renderCard,
  onRowClick,
  className = '',
}) {
  if (loading) return <SkeletonTable cols={columns.length} />;
  if (!rows || rows.length === 0) return empty;

  const alinhamento = { right: 'text-right', center: 'text-center', left: 'text-left' };
  const valor = (col, row) => (col.render ? col.render(row) : row[col.key]);

  return (
    <div className={className}>
      {/* ---------------- Computador: tabela ---------------- */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-elevado/80 text-left text-[11px] uppercase tracking-wider text-suave">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cx('px-5 py-3 font-semibold', alinhamento[c.align] || 'text-left')}
                >
                  {c.header}
                </th>
              ))}
              {actions && <th className="px-5 py-3 font-semibold text-right">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row[keyField]}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cx(
                  'border-t border-borda transition-colors',
                  onRowClick ? 'cursor-pointer hover:bg-brand-50/40 dark:hover:bg-brand-500/10' : 'hover:bg-elevado/70'
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cx(
                      'px-5 py-3.5 align-middle',
                      alinhamento[c.align] || 'text-left',
                      c.className
                    )}
                  >
                    {valor(c, row)}
                  </td>
                ))}
                {actions && (
                  <td
                    className="px-5 py-3.5 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {actions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------------- Celular: cartões ---------------- */}
      <div className="md:hidden divide-y divide-borda stagger">
        {rows.map((row) => (
          <div
            key={row[keyField]}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cx('p-4', onRowClick && 'active:bg-elevado')}
          >
            {renderCard ? (
              renderCard(row)
            ) : (
              <>
                {/* Primeira coluna é o "título" do cartão */}
                <div className="font-medium text-conteudo mb-2.5">{valor(columns[0], row)}</div>
                <dl className="space-y-1.5">
                  {columns.slice(1).map(
                    (c) =>
                      !c.hideOnMobile && (
                        <div key={c.key} className="flex items-start justify-between gap-4 text-sm">
                          <dt className="text-suave-2 text-[13px]">{c.header}</dt>
                          <dd className="text-conteudo-2 text-right min-w-0">{valor(c, row)}</dd>
                        </div>
                      )
                  )}
                </dl>
              </>
            )}
            {actions && (
              <div
                className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-borda"
                onClick={(e) => e.stopPropagation()}
              >
                {actions(row)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
