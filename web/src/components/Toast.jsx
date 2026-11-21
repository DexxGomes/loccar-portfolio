// ============================================================================
//  AVISOS FLUTUANTES (TOASTS)
//  Substituem o alert() do navegador. Aparecem no canto, sozinhos somem.
//
//  Uso:
//    const toast = useToast();
//    toast.sucesso('Veículo salvo!');
//    toast.erro('Não foi possível salvar.');
// ============================================================================
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cx } from './ui.jsx';

const ToastContext = createContext(null);

const ESTILOS = {
  sucesso: {
    icon: CheckCircle2,
    barra: 'bg-emerald-500',
    cor: 'text-emerald-600 dark:text-emerald-400',
    anel: 'ring-emerald-100',
  },
  erro: { icon: XCircle, barra: 'bg-red-500', cor: 'text-red-600 dark:text-red-400', anel: 'ring-red-100' },
  aviso: { icon: AlertTriangle, barra: 'bg-amber-500', cor: 'text-amber-600 dark:text-amber-400', anel: 'ring-amber-100' },
  info: { icon: Info, barra: 'bg-brand-600', cor: 'text-brand-600 dark:text-brand-400', anel: 'ring-brand-100' },
};

export function ToastProvider({ children }) {
  const [itens, setItens] = useState([]);

  const remover = useCallback((id) => {
    setItens((atuais) => atuais.filter((t) => t.id !== id));
  }, []);

  const mostrar = useCallback(
    (tipo, mensagem, opcoes = {}) => {
      const id = Math.random().toString(36).slice(2);
      const duracao = opcoes.duracao ?? (tipo === 'erro' ? 7000 : 4000);
      setItens((atuais) => [...atuais, { id, tipo, mensagem, titulo: opcoes.titulo }]);
      if (duracao > 0) setTimeout(() => remover(id), duracao);
      return id;
    },
    [remover]
  );

  const api = useMemo(
    () => ({
      sucesso: (msg, op) => mostrar('sucesso', msg, op),
      erro: (msg, op) => mostrar('erro', msg, op),
      aviso: (msg, op) => mostrar('aviso', msg, op),
      info: (msg, op) => mostrar('info', msg, op),
    }),
    [mostrar]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Pilha de avisos: em cima no celular, canto inferior direito no desktop */}
      <div className="fixed z-[100] inset-x-4 top-4 sm:inset-x-auto sm:top-auto sm:bottom-6 sm:right-6 flex flex-col gap-2.5 pointer-events-none sm:w-[380px]">
        {itens.map((t) => {
          const e = ESTILOS[t.tipo];
          const Icone = e.icon;
          return (
            <div
              key={t.id}
              role="status"
              className={cx(
                'pointer-events-auto relative flex items-start gap-3 overflow-hidden',
                'bg-superficie rounded-2xl shadow-pop ring-1 ring-borda pl-4 pr-3 py-3.5',
                'animate-slide-left'
              )}
            >
              <span className={cx('absolute left-0 inset-y-0 w-1', e.barra)} />
              <Icone size={19} className={cx('shrink-0 mt-0.5', e.cor)} strokeWidth={2.2} />
              <div className="flex-1 min-w-0">
                {t.titulo && (
                  <div className="text-sm font-semibold text-conteudo mb-0.5">{t.titulo}</div>
                )}
                <div className="text-sm text-conteudo-2 leading-snug break-words">{t.mensagem}</div>
              </div>
              <button
                onClick={() => remover(t.id)}
                aria-label="Fechar aviso"
                className="shrink-0 p-1 rounded-lg text-suave-2 hover:text-conteudo hover:bg-sutil transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** Acesso aos avisos dentro de qualquer componente. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  return ctx;
}
