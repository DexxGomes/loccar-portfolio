// ============================================================================
//  BUSCA DE COMANDOS (⌘K / Ctrl+K)
//  Atalho de teclado para ir a qualquer tela ou disparar uma ação sem tirar
//  a mão do teclado — o tipo de detalhe que faz o painel parecer profissional.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { Kbd, cx } from './ui.jsx';

export default function CommandPalette({ open, onClose, comandos }) {
  const [busca, setBusca] = useState('');
  const [indice, setIndice] = useState(0);
  const inputRef = useRef(null);
  const nav = useNavigate();

  // Filtra por rótulo, grupo e palavras-chave.
  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return comandos;
    return comandos.filter((c) =>
      `${c.label} ${c.grupo || ''} ${(c.chaves || []).join(' ')}`.toLowerCase().includes(t)
    );
  }, [busca, comandos]);

  useEffect(() => {
    if (open) {
      setBusca('');
      setIndice(0);
      // Espera a caixa aparecer para focar o campo.
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => setIndice(0), [busca]);

  function executar(cmd) {
    onClose();
    if (cmd.to) nav(cmd.to);
    else cmd.acao?.();
  }

  function aoTeclar(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndice((i) => (i + 1) % Math.max(filtrados.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndice((i) => (i - 1 + filtrados.length) % Math.max(filtrados.length, 1));
    } else if (e.key === 'Enter' && filtrados[indice]) {
      e.preventDefault();
      executar(filtrados[indice]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-superficie rounded-2xl shadow-pop overflow-hidden animate-scale-in">
        {/* Campo de busca */}
        <div className="flex items-center gap-3 px-4 border-b border-borda">
          <Search size={18} className="text-suave-2 shrink-0" />
          <input
            ref={inputRef}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={aoTeclar}
            placeholder="Buscar telas e ações…"
            className="flex-1 py-4 text-[15px] outline-none placeholder:text-suave-2"
          />
          <Kbd>Esc</Kbd>
        </div>

        {/* Resultados */}
        <div className="max-h-[52vh] overflow-y-auto py-2">
          {filtrados.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-suave-2">
              Nada encontrado para “{busca}”.
            </p>
          ) : (
            filtrados.map((c, i) => {
              const Icone = c.icon;
              const ativo = i === indice;
              return (
                <button
                  key={c.id}
                  onMouseEnter={() => setIndice(i)}
                  onClick={() => executar(c)}
                  className={cx(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    ativo ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-elevado'
                  )}
                >
                  <span
                    className={cx(
                      'grid place-items-center w-8 h-8 rounded-lg shrink-0',
                      ativo ? 'bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300' : 'bg-sutil text-suave'
                    )}
                  >
                    {Icone && <Icone size={16} strokeWidth={2.1} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-conteudo truncate">
                      {c.label}
                    </span>
                    {c.grupo && <span className="block text-xs text-suave-2">{c.grupo}</span>}
                  </span>
                  {ativo && <CornerDownLeft size={14} className="text-brand-500 shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        {/* Rodapé com as teclas */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-borda bg-elevado/70 text-[11px] text-suave-2">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navegar
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> abrir
          </span>
        </div>
      </div>
    </div>
  );
}
