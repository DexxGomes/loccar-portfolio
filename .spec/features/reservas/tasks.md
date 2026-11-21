# Tasks: Reservas — o ciclo da locação

> feature: reservas

## T-023 — Disponibilidade e cálculo de diárias [concluida]
- Refs: US-012, AC-063, AC-064, AC-065
- Arquivos: src/utils/dates.js, src/repositories/reservationRepository.js
- Notas: diária é bloco de 24h arredondado para cima, mínimo 1.

## T-024 — Pré-reserva com valores congelados e sem sobreposição [concluida]
- Refs: US-013, AC-066, AC-067, AC-068, AC-069
- Arquivos: src/services/reservationService.js, db/schema.sql
- Notas: a garantia contra sobreposição é a restrição EXCLUDE do banco — o serviço só traduz o erro para uma frase humana.

## T-025 — Ciclo de vida: aprovar, recusar, retirar, devolver [concluida]
- Refs: US-014, AC-070, AC-071, AC-072, AC-073, AC-074, AC-075
- Arquivos: src/services/reservationService.js, src/routes/reservations.js
- Notas: cada transição confere o status de origem; motivo da recusa é interno e nunca vai ao cliente.

## T-026 — Tela da agenda [concluida]
- Refs: US-014, AC-070, AC-073, AC-074
- Arquivos: web/src/pages/Agenda.jsx
- Notas: indicadores do dia, filtros e ações com confirmação.

## T-048 — Bloquear na recusa vira escolha do dono [concluida]

- Refs: AC-071, AC-130
- Arquivos: src/services/reservationService.js, src/routes/reservations.js, web/src/pages/Analise.jsx
- Notas: antes TODA recusa bloqueava o cliente para sempre — injusto quando a recusa é por documento ilegível ou carro indisponível. Agora é uma marcação explícita no modal de recusa.
