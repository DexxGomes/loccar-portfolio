# Tasks: Frota

> feature: frota

## T-020 — Cadastro e regras do veículo [concluida]
- Refs: US-010, AC-053, AC-054, AC-055, AC-056, AC-057, AC-058, AC-059
- Arquivos: src/services/vehicleService.js, src/repositories/vehicleRepository.js, src/routes/vehicles.js, src/utils/categorias.js
- Notas: categorias em fonte única (usada pela API e pelas ferramentas da IA). Placa única POR locadora.

## T-021 — Controle de manutenção e vencimentos [concluida]
- Refs: US-011, AC-060, AC-061, AC-062
- Arquivos: db/migrations/006_manutencao.sql, src/repositories/maintenanceRepository.js
- Notas: histórico por veículo; toda rota de manutenção confere antes se o veículo é da locadora.

## T-022 — Tela da frota [concluida]
- Refs: US-010, AC-053, AC-058, AC-060
- Arquivos: web/src/pages/Frota.jsx
- Notas: grade de cartões, modal de cadastro e campos de manutenção.
