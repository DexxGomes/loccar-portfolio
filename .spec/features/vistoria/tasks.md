# Tasks: Vistoria digital

> feature: vistoria

## T-036 — Vistoria de retirada e devolução [concluida]
- Refs: US-020, AC-103, AC-104, AC-105, AC-106, AC-107
- Arquivos: db/migrations/001_vistorias.sql, src/repositories/inspectionRepository.js, src/services/inspectionService.js, src/routes/inspections.js
- Notas: uma por reserva e tipo (índice único). Combustível em oitavos; avarias com posição no desenho do carro.

## T-037 — Comparativo entre as duas vistorias [concluida]
- Refs: US-021, AC-108, AC-109, AC-110
- Arquivos: src/services/inspectionService.js
- Notas: calculado no servidor para as telas não divergirem.

## T-038 — Tela da vistoria com o desenho do carro [concluida]
- Refs: US-020, AC-103, AC-107
- Arquivos: web/src/components/VistoriaModal.jsx, web/src/components/DiagramaCarro.jsx, web/src/utils/imagem.js
- Notas: toque marca a avaria no desenho; a foto é reduzida no painel antes de subir.
