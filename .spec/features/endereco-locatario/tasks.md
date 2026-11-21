# Tasks: Endereço do locatário no contrato

> feature: endereco-locatario

## T-006 — Guardar o endereço em partes [concluida]

- Refs: US-004, AC-013
- Arquivos: db/migrations/010_endereco_cliente.sql, src/repositories/customerRepository.js
- Notas: em partes (e não num texto só) para preencher pelo CEP e imprimir sempre igual.

## T-007 — Abrir a edição do cliente na API, com validação [concluida]

- Refs: AC-013, AC-014, AC-015, AC-016, AC-017, AC-018, AC-019, AC-020
- Arquivos: src/routes/customers.js
- Notas: não existia rota de edição de cliente. Campo em branco vira nulo (AC-018).

## T-008 — Imprimir o endereço no contrato [concluida]

- Refs: US-005, AC-021, AC-022, AC-023
- Arquivos: src/services/contractService.js, src/repositories/reservationRepository.js, web/src/pages/Contrato.jsx
- Notas: monta a linha juntando só as partes preenchidas — é o que evita vírgula solta (AC-023).

## T-009 — Cadastro do cliente no painel com CEP automático [concluida]

- Refs: US-004, AC-013, AC-014
- Arquivos: web/src/pages/Clientes.jsx
- Notas: digita o CEP e rua/bairro/cidade/UF vêm sozinhos; teclado numérico no celular.

## T-010 — A IA também coleta o endereço no WhatsApp [concluida]

- Refs: US-004, AC-013
- Arquivos: src/services/ai/tools.js, src/services/ai/prompts.js
- Notas: pede uma única vez depois da pré-reserva; não insiste se o cliente não quiser.
