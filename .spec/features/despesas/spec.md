# Spec: Despesas e fluxo de caixa

> feature: despesas
> status: implementada

## Contexto

Sem registrar o que sai, o "quanto faturei" engana: uma locadora pode faturar
bem e estar no vermelho por causa de manutenção, combustível e seguro. Esta
feature guarda as saídas por categoria e por veículo, e alimenta o saldo do
resumo do dinheiro.

## Histórias

### US-015 — Saber para onde vai o dinheiro

Como dono de locadora, quero lançar minhas despesas por categoria, para que eu
enxergue o que come o meu faturamento.

#### AC-076 — Lança uma despesa

- **Dado** o dono na tela de despesas
- **Quando** informa categoria, valor e data
- **Então** a despesa é registrada

#### AC-077 — Despesa sem categoria é recusada

- **Dado** o dono lançando uma despesa
- **Quando** deixa a categoria em branco
- **Então** o sistema recusa e pede a categoria

#### AC-078 — A despesa pode ser ligada a um veículo

- **Dado** uma manutenção de um carro específico
- **Quando** o dono lança a despesa apontando o veículo
- **Então** o gasto fica ligado àquele carro

#### AC-079 — Lista só as despesas do período pedido

- **Dado** despesas em meses diferentes
- **Quando** o dono filtra um intervalo de datas
- **Então** vê apenas as daquele intervalo

#### AC-080 — Excluir despesa que não existe avisa

- **Dado** um pedido de exclusão apontando para despesa inexistente
- **Quando** o sistema recebe
- **Então** responde que a despesa não foi encontrada

#### AC-081 — Uma locadora não vê a despesa da outra

- **Dado** uma despesa lançada na locadora A
- **Quando** a locadora B lista suas despesas
- **Então** a despesa da locadora A não aparece

## Fora de escopo

- Despesa recorrente lançada automaticamente todo mês.
- Anexar comprovante/nota à despesa.
- Rateio de uma despesa entre vários veículos.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-021 | Categoria é texto livre, não lista fechada | confirmada | Cada locadora organiza o gasto do seu jeito; lista fechada obrigaria a encaixar tudo em caixas nossas |
| ASM-022 | A despesa entra no caixa pela DATA informada, não pela data do lançamento | confirmada | O dono lança depois, mas o gasto pertence ao dia em que aconteceu |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-009 | Despesa fixa mensal deve se repetir sozinha? | respondida | Ainda não: repetição automática sem revisão vira lixo no caixa. Entra quando houver volume que justifique |
