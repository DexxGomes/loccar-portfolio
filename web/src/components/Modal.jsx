// ============================================================================
//  JANELAS SOBREPOSTAS
//    - <Modal>          caixa central (no celular sobe de baixo, tipo app)
//    - <ConfirmProvider> + useConfirm()  substitui o confirm() do navegador
//
//  Uso da confirmação:
//    const confirmar = useConfirm();
//    if (await confirmar({ titulo: 'Remover veículo?', tom: 'danger' })) { … }
// ============================================================================
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { Button, cx } from './ui.jsx';

// ----------------------------------------------------------------------------
// Modal
// ----------------------------------------------------------------------------

const LARGURAS = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

// ----------------------------------------------------------------------------
// Trava da rolagem do fundo
//
// Existe janela SOBRE janela: a confirmação de "remover" abre por cima do
// cadastro que já estava aberto. Se cada uma guardasse por conta própria o
// estado anterior da rolagem, a de cima gravaria "hidden" (posto pela de
// baixo) e devolveria "hidden" ao fechar — a página ficava travada, sem
// rolagem, e só um F5 resolvia.
//
// Por isso a contagem é global: a rolagem só volta quando a ÚLTIMA janela
// fecha, e o valor original é lido uma única vez.
// ----------------------------------------------------------------------------
let janelasAbertas = 0;
let overflowOriginal = '';

function travarRolagem() {
  if (janelasAbertas === 0) {
    overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  janelasAbertas += 1;
}

function destravarRolagem() {
  janelasAbertas = Math.max(0, janelasAbertas - 1);
  if (janelasAbertas === 0) document.body.style.overflow = overflowOriginal;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  size = 'md',
  footer,
  children,
}) {
  // Trava a rolagem do fundo. Depende SÓ de `open`: se dependesse de `onClose`
  // (que é uma função nova a cada render da tela de trás), a trava seria solta
  // e refeita a cada re-render sem necessidade.
  useEffect(() => {
    if (!open) return;
    travarRolagem();
    return destravarRolagem;
  }, [open]);

  // Fecha com Esc.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Renderiza direto no <body>. Dentro da tela, qualquer ancestral com
  // `transform` (animação de entrada, cartão sendo arrastado, menu que abre
  // com escala) vira a referência do `position: fixed` e a janela sai do
  // lugar. Sem `document` (render no servidor dos testes) fica onde está.
  const janela = (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Fundo escurecido */}
      <div
        className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Caixa */}
      <div
        className={cx(
          'relative w-full bg-superficie shadow-pop flex flex-col max-h-[92vh]',
          'rounded-t-3xl sm:rounded-2xl animate-fade-up sm:animate-scale-in',
          LARGURAS[size]
        )}
      >
        {/* Puxador visual do "sobe de baixo" no celular */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {(title || onClose) && (
          <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-4 sm:pt-5 pb-4 border-b border-borda shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {Icon && (
                <span className="grid place-items-center w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 shrink-0">
                  <Icon size={19} strokeWidth={2.1} />
                </span>
              )}
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-conteudo truncate">{title}</h2>
                {subtitle && <p className="text-[13px] text-suave mt-0.5">{subtitle}</p>}
              </div>
            </div>
            {/* Sem `onClose` a janela é obrigatória (ex.: trocar a senha no
                primeiro acesso) — aí não mostra o X, que não fecharia nada. */}
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="shrink-0 p-1.5 rounded-lg text-suave-2 hover:bg-sutil hover:text-conteudo transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        <div className="px-5 sm:px-6 py-5 overflow-y-auto">{children}</div>

        {footer && (
          <div className="px-5 sm:px-6 py-4 border-t border-borda bg-elevado/70 rounded-b-2xl flex flex-col-reverse sm:flex-row sm:justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document === 'undefined' ? janela : createPortal(janela, document.body);
}

// ----------------------------------------------------------------------------
// Confirmação (promessa)
// ----------------------------------------------------------------------------

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [pedido, setPedido] = useState(null);
  const resolverRef = useRef(null);

  const confirmar = useCallback((opcoes = {}) => {
    setPedido({
      titulo: 'Tem certeza?',
      mensagem: '',
      confirmar: 'Confirmar',
      cancelar: 'Cancelar',
      tom: 'danger',
      ...opcoes,
    });
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  function responder(valor) {
    resolverRef.current?.(valor);
    resolverRef.current = null;
    setPedido(null);
  }

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}

      <Modal
        open={!!pedido}
        onClose={() => responder(false)}
        title={pedido?.titulo}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => responder(false)}>
              {pedido?.cancelar}
            </Button>
            <Button
              variant={pedido?.tom === 'danger' ? 'danger' : 'primary'}
              onClick={() => responder(true)}
            >
              {pedido?.confirmar}
            </Button>
          </>
        }
      >
        <div className="flex gap-4">
          <span
            className={cx(
              'grid place-items-center w-11 h-11 rounded-xl shrink-0',
              pedido?.tom === 'danger' ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300'
            )}
          >
            <AlertTriangle size={20} strokeWidth={2.1} />
          </span>
          <p className="text-sm text-conteudo-2 leading-relaxed pt-1.5">
            {pedido?.mensagem || 'Essa ação não pode ser desfeita.'}
          </p>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

/** Retorna uma função `confirmar(opcoes) => Promise<boolean>`. */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>.');
  return ctx;
}
