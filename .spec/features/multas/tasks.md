# Tasks: Multas e repasse ao locatário

> feature: multas

## T-029 — Registro de multas e controle do repasse [concluida]
- Refs: US-016, AC-082, AC-083, AC-084, AC-085, AC-086, AC-087
- Arquivos: db/migrations/007_multas.sql, src/repositories/fineRepository.js, src/services/fineService.js, src/routes/fines.js
- Notas: pendente → repassada → paga. Vincular ao cliente é opcional.

## T-030 — Tela de multas [concluida]
- Refs: US-016, AC-082, AC-084, AC-086
- Arquivos: web/src/pages/Multas.jsx
- Notas: infrações por veículo com a situação do repasse.
