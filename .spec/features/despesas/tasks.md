# Tasks: Despesas e fluxo de caixa

> feature: despesas

## T-027 — Registro de despesas por categoria e veículo [concluida]
- Refs: US-015, AC-076, AC-077, AC-078, AC-079, AC-080, AC-081
- Arquivos: db/migrations/008_despesas.sql, src/repositories/expenseRepository.js, src/services/expenseService.js, src/routes/expenses.js
- Notas: a despesa entra no caixa pela data informada, não pela data do lançamento.

## T-028 — Tela de despesas e caixa [concluida]
- Refs: US-015, AC-076, AC-079
- Arquivos: web/src/pages/Despesas.jsx
- Notas: mês a mês, com o que entra e o que sai.
