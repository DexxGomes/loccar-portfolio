# Spec: Resumo do dinheiro

> feature: resumo-dinheiro
> status: implementada

## Contexto

O dinheiro da locadora estava espalhado em três telas (a receber, despesas e
multas) e nenhuma delas respondia a pergunta que o dono realmente faz: "como
está o meu dinheiro este mês?". Esta feature junta tudo em uma conta que se lê
em voz alta — **entrou, gastei, sobrou** — e separa o que continua em aberto
hoje. O ponto mais delicado é a caução: ela entra no caixa mas **não é receita**
(volta ao cliente na entrega), e tratá-la como lucro mostra um resultado que
não existe.

## Histórias

### US-006 — Saber como está o meu dinheiro sem abrir três telas

Como dono de locadora, quero uma tela que me diga o que entrou, o que gastei e
o que sobrou, para que eu saiba se o mês está indo bem sem juntar números na
mão.

#### AC-024 — A caução não conta como receita

- **Dado** que no período foram pagas as diárias e também a caução
- **Quando** o dono abre o resumo do dinheiro
- **Então** o valor "entrou" mostra só as diárias, sem a caução

#### AC-025 — Soma o que foi gasto no período

- **Dado** despesas lançadas no período
- **Quando** o dono abre o resumo
- **Então** o valor "gastei" é a soma dessas despesas

#### AC-026 — O saldo é o que entrou menos o que saiu

- **Dado** um período com entradas e gastos
- **Quando** o dono abre o resumo
- **Então** "sobrou" é entrou menos gastei
- **E** a caução não infla esse resultado

#### AC-027 — Separa o que falta receber do que já venceu

- **Dado** cobranças em aberto, algumas já vencidas
- **Quando** o dono abre o resumo
- **Então** vê o total a receber
- **E** vê, destacado, só o que já passou do vencimento

#### AC-028 — Mostra a caução que está em mãos

- **Dado** cauções recebidas e ainda não devolvidas
- **Quando** o dono abre o resumo
- **Então** vê quanto de dinheiro do cliente está com ele

#### AC-029 — Mostra as multas ainda não repassadas

- **Dado** multas registradas e pendentes de repasse
- **Quando** o dono abre o resumo
- **Então** vê quanto ele pagou de multa e ainda não cobrou do locatário

#### AC-030 — Explica para onde foram os gastos

- **Dado** despesas de categorias diferentes no período
- **Quando** o dono abre o resumo
- **Então** vê os gastos agrupados por categoria, do maior para o menor

#### AC-031 — Período sem movimento não quebra a tela

- **Dado** um período antigo, sem nenhuma movimentação
- **Quando** o dono abre o resumo desse período
- **Então** todos os valores aparecem zerados, sem erro

#### AC-032 — O resumo exige login

- **Dado** alguém sem sessão no painel
- **Quando** tenta abrir o resumo do dinheiro
- **Então** o pedido é recusado

#### AC-050 — Dá para ver o mês fechado, do dia 1 até hoje

- **Dado** o dono querendo fechar o caixa do mês com o contador
- **Quando** ele escolhe o período "Este mês"
- **Então** o resumo considera do dia 1 do mês corrente até hoje

## Fora de escopo

- Conciliação bancária e importação de extrato.
- Regime de competência (o resumo é caixa: conta quando o dinheiro entra/sai).
- Projeção de faturamento futuro.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-007 | "Entrou" e "gastei" olham o período escolhido; "a receber", "vencido" e "caução" são saldos de HOJE | confirmada | Misturar as duas coisas confundiria: dívida em aberto não pertence a um mês |
| ASM-008 | Períodos de 30 dias, 3 meses e 1 ano bastam | invalidada | O dono do produto pediu o mês fechado (28/07/2026): é como ele fecha o caixa e conversa com o contador. Virou o critério AC-050 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-003 | A caução devolvida deve aparecer como saída no fluxo? | respondida | Não por ora: ela nunca entrou como receita, então devolver não é despesa. Fica só no saldo "caução em mãos" |
