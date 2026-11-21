# Constituição — v1.1.0

<!--
  Princípios inegociáveis do projeto. Não são estilo: são restrições.
  P-xxx = princípio (código de rastreio, como US/AC/T).
  Níveis: [DEVE] obrigatório · [RECOMENDADO] forte · [PODE] permitido/explícito.
  Todo [DEVE] precisa de verificação executável — senão o audit acusa
  "princípio sem verificação" (PRINCIPIO_SEM_VERIFICACAO). Formatos:
    - verificação(gate): satisfeita pelo próprio audit (só p/ princípios "meta")
    - verificação(teste): @principle:P-xxx
    - verificação(proibido): `regex` em `glob`
    - verificação(obrigatório): `regex` em `glob`
-->

## P-001 [DEVE] Todo requisito tem prova executável

Nenhuma feature é declarada pronta sem o audit em modo CI sair limpo (exit 0).
Este princípio é verificado pelo próprio mecanismo do audit (AC_SEM_TESTE,
AC_SEM_PROVA, TASK_CONCLUIDA_SEM_PROVA) — não precisa de teste extra seu.

- verificação(gate): intrínseca ao audit

## P-002 [RECOMENDADO] Segredos nunca em código

Chaves e senhas vêm de variáveis de ambiente, nunca hard-coded.

- verificação(proibido): `(api[_-]?key|senha|password)\s*[:=]\s*['"][^'"]{8,}` em `src/**/*.js`

## P-003 [DEVE] Erro que o usuário lê é escrito para gente

O painel mostra apenas o campo `error` da resposta. Ele precisa nomear o campo
e o problema em português — nunca jargão de banco de dados nem palavra em
inglês vazada do validador. Mensagem de erro é interface, não detalhe técnico.

- verificação(teste): @principle:P-003

## P-004 [DEVE] Tela nunca usa cor sólida fixa

Cores vêm dos tokens semânticos (`bg-superficie`, `text-conteudo`, `border-borda`).
Escrever `bg-white` ou `text-slate-900` numa tela quebra o tema escuro
silenciosamente — aparece certo no claro e ilegível no escuro.
Transparências sobre o menu grafite (`bg-white/[0.06]`) são permitidas: não são
cor sólida.

- verificação(proibido): `bg-white['"\s]|text-slate-900` em `web/src/pages/*.jsx`
