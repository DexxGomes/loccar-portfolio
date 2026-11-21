import { STATUS } from '../format.js';

const PADRAO = { label: '—', cls: 'bg-sutil text-conteudo-2 ring-borda', dot: 'bg-suave-2' };

export default function StatusBadge({ status }) {
  const s = STATUS[status] || { ...PADRAO, label: status };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap ${s.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
