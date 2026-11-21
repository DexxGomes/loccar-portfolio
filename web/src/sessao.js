// ============================================================================
//  SESSÃO GUARDADA NO NAVEGADOR
//
//  Por que existe: `JSON.parse(localStorage.getItem(...))` estoura se o valor
//  estiver corrompido (escrita pela metade, formato antigo, alguém mexendo no
//  navegador). Se isso acontece dentro do Layout, o painel INTEIRO não
//  renderiza — tela branca, e a pessoa nem consegue clicar em "Sair" para se
//  recuperar.
//
//  Aqui a leitura nunca quebra: no pior caso devolve vazio e a tela abre.
// ============================================================================

/** Lê um objeto guardado na sessão. Nunca lança; devolve {} se der errado. */
export function lerSessao(chave) {
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return {};
    const valor = JSON.parse(bruto);
    // Só objeto serve aqui; string ou número guardados por engano viram {}.
    return valor && typeof valor === 'object' ? valor : {};
  } catch {
    return {};
  }
}

/** Guarda um objeto na sessão. */
export function guardarSessao(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* navegador sem espaço ou em modo restrito: seguir sem guardar */
  }
}
