# Tasks: Atendimento no WhatsApp

> feature: atendimento-whatsapp

## T-043 — Webhook da Meta: verificação, assinatura e resposta rápida [concluida]
- Refs: US-025, AC-119, AC-120, AC-121
- Arquivos: src/routes/webhook.js, src/middleware/whatsappSignature.js
- Notas: responde 200 na hora e processa depois. Em produção, sem a chave de assinatura, RECUSA em vez de aceitar sem conferir a origem.

## T-044 — Entrada de mensagem sem duplicar [concluida]
- Refs: US-025, AC-122
- Arquivos: src/services/inbound.js, src/repositories/conversationRepository.js
- Notas: idempotência por identificador do evento (índice único); a Meta reenvia por timeout.

## T-045 — Conversas no painel [concluida]
- Refs: US-026, AC-123, AC-124, AC-125
- Arquivos: src/routes/conversations.js, web/src/pages/Conversas.jsx
- Notas: a leitura de mensagens filtra por locadora na própria consulta.

## T-046 — Motor de risco objetivo [concluida]
- Refs: US-027, AC-126, AC-127, AC-128, AC-129
- Arquivos: src/services/riskService.js
- Notas: só sinais objetivos (blocklist, CNH, documentos, LGPD, histórico). Nunca aparência. Não decide — organiza fatos.

## T-047 — Agente de IA e ferramentas [concluida]
- Refs: US-025, AC-122
- Arquivos: src/services/ai/agent.js, src/services/ai/tools.js, src/services/ai/prompts.js, src/services/whatsapp.js, src/services/messaging.js, src/services/transcription.js, src/services/notify.js, src/services/documentService.js
- Notas: a IA nunca confirma reserva. O diálogo em si ainda não tem teste automatizado (ASM-038 em aberto).
