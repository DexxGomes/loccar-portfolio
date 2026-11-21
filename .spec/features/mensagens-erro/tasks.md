# Tasks: Mensagens de erro que dizem o que corrigir

> feature: mensagens-erro

## T-015 — Traduzir erro técnico em frase de gente [concluida]
- Refs: US-008, AC-039, AC-040, AC-041, AC-042, AC-043, AC-044
- Arquivos: src/middleware/errorHandler.js
- Notas: rótulo por campo, tradução das mensagens em inglês do validador, e frase certa por índice violado (placa, CPF, telefone). "Falta preencher: X" evita erro de concordância.

## T-018 — Destacar em vermelho o campo recusado [concluida]

- Refs: AC-051
- Arquivos: web/src/api.js, web/src/pages/Frota.jsx
- Notas: a API já dizia quais campos falharam; o painel descartava. Agora o erro carrega os campos e o formulário da frota marca cada um.
