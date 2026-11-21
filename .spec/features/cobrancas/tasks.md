# Tasks: Cobranças e recebimentos

> feature: cobrancas

## T-039 — Contas a receber com vencido derivado [concluida]
- Refs: US-022, AC-111, AC-112, AC-113, AC-114, AC-115
- Arquivos: db/migrations/002_financeiro.sql, src/repositories/paymentRepository.js, src/services/paymentService.js, src/routes/payments.js
- Notas: "vencido" sai de um CASE na leitura, nunca gravado — assim não depende de job.

## T-040 — Gerar as cobranças a partir da reserva [concluida]
- Refs: US-023, AC-116, AC-117
- Arquivos: src/services/paymentService.js
- Notas: diárias + caução com vencimento no dia da retirada; recusa se já existirem.

## T-041 — Cobrança por PIX (adaptador Asaas) [concluida]
- Refs: US-024, AC-118
- Arquivos: src/services/asaas.js, docs/ASAAS_PIX.md
- Notas: isolado num adaptador. Sem chave, responde com aviso claro. O caminho COM chave nunca foi testado contra a API real.

## T-042 — Tela do financeiro [concluida]
- Refs: US-022, AC-111, AC-112, AC-114
- Arquivos: web/src/pages/Financeiro.jsx
- Notas: recebido, a receber, vencido e caução em mãos.
