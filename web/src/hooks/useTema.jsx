// ============================================================================
//  TEMA CLARO / ESCURO
//
//  Duas opções, como pedido: claro e escuro. Na primeira visita seguimos a
//  preferência do aparelho (quem usa o celular no escuro já abre no escuro);
//  a partir da primeira troca, vale sempre a escolha do usuário, guardada no
//  navegador.
//
//  A classe .dark é aplicada no <html>. O index.html também aplica o tema
//  ANTES do React montar — sem isso, a tela pisca branca ao abrir no escuro.
// ============================================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CHAVE = 'tema'; // 'claro' | 'escuro'
const TemaContext = createContext(null);

/** Lê a escolha salva; sem escolha, pergunta ao aparelho. */
function temaInicial() {
  const salvo = localStorage.getItem(CHAVE);
  if (salvo === 'claro' || salvo === 'escuro') return salvo;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

export function TemaProvider({ children }) {
  const [tema, definirTema] = useState(temaInicial);

  // Aplica no documento e guarda a escolha.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro');
    localStorage.setItem(CHAVE, tema);
  }, [tema]);

  // Se o usuário ainda não escolheu nada, acompanha o aparelho em tempo real.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const aoMudar = (e) => {
      if (!localStorage.getItem(CHAVE)) definirTema(e.matches ? 'escuro' : 'claro');
    };
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  }, []);

  const alternar = useCallback(
    () => definirTema((t) => (t === 'escuro' ? 'claro' : 'escuro')),
    []
  );

  const valor = useMemo(
    () => ({ tema, escuro: tema === 'escuro', definirTema, alternar }),
    [tema, alternar]
  );

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

export function useTema() {
  const ctx = useContext(TemaContext);
  if (!ctx) throw new Error('useTema precisa estar dentro de <TemaProvider>.');
  return ctx;
}
