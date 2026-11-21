# Cobrança PIX pelo Asaas (opcional)

O Financeiro funciona **sem nenhuma integração**: dá para registrar o que foi
combinado (dinheiro, cartão, PIX na mão) e acompanhar o que falta receber.

A integração serve para um passo a mais: gerar o PIX e **mandar o link ao
cliente pelo WhatsApp automaticamente**.

> **Estado:** o adaptador está escrito e isolado em `src/services/asaas.js`, mas
> **ainda não foi exercitado contra a API real** — isso depende de uma chave da
> conta da locadora. Faça o primeiro teste no ambiente **sandbox**.

## Passo a passo

1. Crie a conta em [asaas.com](https://www.asaas.com) (a conta sandbox é
   separada: [sandbox.asaas.com](https://sandbox.asaas.com)).
2. No painel do Asaas: **Integrações → API → Gerar chave**.
3. No **Render** (serviço da API), em *Environment*, adicione:

   | Variável | Valor |
   |---|---|
   | `ASAAS_API_KEY` | a chave copiada |
   | `ASAAS_ENV` | `sandbox` para testar, `production` quando for pra valer |

4. Salve — o Render reinicia sozinho. O botão **PIX** passa a aparecer na tela
   Financeiro (o painel pergunta isso em `GET /api/payments/integracao`).

## Como testar sem cobrar ninguém de verdade

1. Com `ASAAS_ENV=sandbox`, crie uma cobrança para um cliente **que tenha CPF
   cadastrado** (o Asaas exige CPF/CNPJ para emitir).
2. Clique em **PIX**. Deve aparecer o QR Code e o link da fatura.
3. No sandbox o pagamento é simulado pelo próprio painel do Asaas.

## O que ainda não está pronto

- **Baixa automática.** Hoje, quando o cliente paga, alguém precisa marcar
  "Recebi" no painel. Para dar baixa sozinho, falta um endpoint de webhook do
  Asaas (`payment.received`) — a tabela já está preparada: `payments` guarda
  `provider`, `external_id` e tem índice único por cobrança do provedor, para
  webhook repetido não duplicar lançamento.
- **Split de pagamento** (repasse automático para o dono) — existe no Asaas,
  mas não foi implementado.

## Se algo der errado

| Mensagem | O que costuma ser |
|---|---|
| `Cobrança por PIX não configurada` | falta `ASAAS_API_KEY` no servidor |
| `Para gerar o PIX, o cliente precisa ter CPF cadastrado` | o cliente veio do WhatsApp sem CPF; edite o cadastro |
| Erro 401 do Asaas | chave inválida, ou chave de sandbox usada em produção (e vice-versa) |
