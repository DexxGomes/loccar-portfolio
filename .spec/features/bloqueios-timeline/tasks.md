# Tasks: Bloqueios de manutenção e linha do tempo

> feature: bloqueios-timeline

## T-033 — Bloqueio de período por veículo [concluida]
- Refs: US-018, AC-094, AC-095, AC-096, AC-097, AC-098, AC-099, AC-100
- Arquivos: src/repositories/scheduleBlockRepository.js, src/services/scheduleBlockService.js, src/routes/scheduleBlocks.js
- Notas: a proteção é do banco (EXCLUDE + trigger). O serviço traduz 23P01 e P0001 em frases humanas.

## T-034 — Linha do tempo numa resposta só [concluida]
- Refs: US-019, AC-101, AC-102
- Arquivos: src/routes/timeline.js
- Notas: período, veículos, reservas e bloqueios juntos, para a tela não fazer três chamadas.

## T-035 — Tela da linha do tempo [concluida]
- Refs: US-019, AC-101
- Arquivos: web/src/pages/Timeline.jsx
- Notas: visão "Por dia" como padrão, calendário a um toque, e arrastar para criar bloqueio no computador.
