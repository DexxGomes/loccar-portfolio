# Spec: Leads

> feature: leads
> status: implementada

## Contexto

Muita gente pede orçamento e não fecha na hora — e some. Sem um lugar para
guardar quem perguntou, a locadora perde negócio por esquecimento, não por
preço. Esta feature é um funil simples: novo → qualificado → negociação →
ganho ou perdido.

## Histórias

### US-017 — Não perder quem pediu orçamento

Como dono de locadora, quero guardar quem me procurou e em que pé está a
conversa, para que eu não perca negócio por esquecimento.

#### AC-088 — Registra um lead

- **Dado** alguém que pediu orçamento
- **Quando** o dono registra o nome
- **Então** o lead entra no funil como novo

#### AC-089 — Lead sem nome é recusado

- **Dado** o dono registrando um lead
- **Quando** deixa o nome em branco
- **Então** o sistema recusa e pede o nome

#### AC-090 — E-mail inválido é recusado

- **Dado** o dono registrando um lead
- **Quando** informa um e-mail malformado
- **Então** o sistema recusa e avisa

#### AC-091 — Move o lead pelo funil

- **Dado** um lead novo
- **Quando** o dono move para negociação e depois para ganho
- **Então** a situação muda em cada passo

#### AC-092 — Situação inválida é recusada

- **Dado** o dono movendo um lead
- **Quando** informa uma etapa que não existe no funil
- **Então** o sistema recusa

#### AC-093 — Uma locadora não vê o lead da outra

- **Dado** um lead registrado na locadora A
- **Quando** a locadora B lista seus leads
- **Então** o lead da locadora A não aparece

## Fora de escopo

- Disparo automático de mensagem para o lead.
- Pontuação/qualificação automática por comportamento.
- Origem da campanha (de onde veio o lead).

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-025 | Telefone e e-mail são opcionais no lead | confirmada | Às vezes só se tem o nome e o contato chega depois; exigir tudo faria o dono não registrar |
| ASM-026 | Lead e cliente são cadastros separados | confirmada | Lead ainda não alugou; misturar sujaria a base de clientes com quem nunca fechou |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-011 | Lead marcado como ganho deve virar cliente automaticamente? | respondida | Não: o cliente nasce quando existe reserva de verdade. Converter antes criaria cliente fantasma |
