# Tasks: Exclusão LGPD apaga tudo mesmo

> feature: exclusao-lgpd

## T-016 — Juntar os arquivos do cliente das três origens [concluida]
- Refs: US-009, AC-045, AC-046, AC-047, AC-048, AC-049
- Arquivos: src/repositories/documentRepository.js
- Notas: documentos da reserva + mídia das mensagens + fotos de vistoria, com UNION (que já remove repetição — AC-048).

## T-019 — Arquivar o contrato da locação encerrada antes de apagar [pendente]

- Refs: AC-052
- Arquivos: src/services/lgpdService.js
- Notas: BLOQUEADA pela suposição ASM-015 — guardar o contrato é guardar dado pessoal, e isso precisa de base legal definida. Não implementar antes de resolver.
