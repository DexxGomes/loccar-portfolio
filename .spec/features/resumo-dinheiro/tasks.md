# Tasks: Resumo do dinheiro

> feature: resumo-dinheiro

## T-011 — Retrato do dinheiro em uma consulta só [concluida]
- Refs: US-006, AC-024, AC-025, AC-026, AC-027, AC-028, AC-029, AC-030, AC-031
- Arquivos: src/repositories/moneyRepository.js, src/services/dashboardService.js, src/routes/dashboard.js
- Notas: a caução fica FORA de "entrou" (AC-024) — foi o erro de conta que o teste pegou.

## T-012 — Tela do resumo, em português de dono de locadora [concluida]
- Refs: US-006, AC-024, AC-026, AC-027, AC-030, AC-032
- Arquivos: web/src/pages/Dinheiro.jsx, web/src/App.jsx, web/src/components/Layout.jsx
- Notas: número grande com legenda embaixo; cada linha em aberto leva para a tela que resolve.

## T-017 — Período "Este mês" (mês fechado) [concluida]

- Refs: AC-050
- Arquivos: web/src/periodos.js, web/src/pages/Dinheiro.jsx
- Notas: cálculo de data saiu da tela para um arquivo próprio, porque é onde erro passa despercebido — agora tem teste. "Este mês" virou o padrão.
