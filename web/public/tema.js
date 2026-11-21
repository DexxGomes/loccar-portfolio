// ============================================================================
//  Aplica o tema ANTES de qualquer pixel aparecer.
//  Sem isto, quem usa o tema escuro vê um flash branco a cada carregamento.
//
//  Por que este script mora num ARQUIVO e não solto dentro do index.html:
//  a política de segurança do painel (CSP) só deixa rodar script vindo da
//  própria origem. Script solto na página seria bloqueado, e o flash voltaria
//  sem ninguém entender por quê. Carregado sem defer/async no <head>, ele roda
//  antes da primeira pintura do mesmo jeito.
// ============================================================================
(function () {
  try {
    var salvo = localStorage.getItem('tema');
    var escuro =
      salvo === 'escuro' ||
      (!salvo && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (escuro) document.documentElement.classList.add('dark');
  } catch (e) {
    /* navegador sem localStorage: segue no claro */
  }
})();
