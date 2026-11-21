# Spec: Reservas — o ciclo da locação

> feature: reservas
> status: implementada

## Contexto

É o coração do sistema. Uma locação nasce como **pré-reserva** (a IA nunca
confirma sozinha), o dono aprova ou recusa, o carro sai, o carro volta. Duas
regras dominam tudo: **nunca alugar o mesmo carro duas vezes no mesmo período**
— garantido pelo banco, não pela tela — e **valores congelados na reserva**, para
que mudança de preço não altere o que foi combinado com o cliente.

## Histórias

### US-012 — Oferecer só o que está realmente livre

Como cliente, quero ver os carros disponíveis para as minhas datas com o preço
total, para que eu escolha sem descobrir depois que já estava alugado.

#### AC-063 — Mostra os carros livres no período, com o total

- **Dado** uma frota com carros livres
- **Quando** alguém consulta a disponibilidade para um período
- **Então** vê os carros livres, com o número de diárias e o total estimado

#### AC-064 — Carro já reservado some da lista

- **Dado** um carro com reserva confirmada num período
- **Quando** alguém consulta a disponibilidade no mesmo período
- **Então** aquele carro não aparece

#### AC-065 — A diária conta período de 24h, arredondando para cima

- **Dado** uma retirada e uma devolução com 26 horas de diferença
- **Quando** o sistema calcula o período
- **Então** cobra 2 diárias (e nunca menos de 1)

### US-013 — Criar a pré-reserva sem risco de conflito

Como dono de locadora, quero que o sistema recuse sozinho qualquer sobreposição,
para que eu nunca alugue o mesmo carro duas vezes.

#### AC-066 — Cria a pré-reserva com os valores congelados

- **Dado** um carro disponível
- **Quando** a pré-reserva é criada
- **Então** ela nasce como pré-reserva, com diária, caução e total congelados
- **E** ganha um prazo de expiração

#### AC-067 — Sobreposição de período é recusada

- **Dado** um carro já reservado num período
- **Quando** alguém tenta reservar o mesmo carro com datas que se sobrepõem
- **Então** o sistema recusa e explica que o veículo está indisponível

#### AC-068 — Datas invertidas são recusadas

- **Dado** alguém montando uma reserva
- **Quando** a devolução é antes da retirada
- **Então** o sistema recusa e explica

#### AC-069 — Carro em manutenção não pode ser reservado

- **Dado** um veículo marcado como em manutenção
- **Quando** alguém tenta reservá-lo
- **Então** o sistema recusa dizendo que está em manutenção

### US-014 — Decidir e tocar a locação

Como dono de locadora, quero aprovar, recusar e acompanhar a locação, para que
nada saia da garagem sem a minha decisão.

#### AC-070 — Aprovar confirma a reserva

- **Dado** uma pré-reserva aguardando decisão
- **Quando** o dono aprova
- **Então** a reserva fica confirmada

#### AC-071 — Recusar guarda o motivo internamente, sem bloquear o cliente

- **Dado** uma pré-reserva em análise
- **Quando** o dono recusa informando o motivo, sem pedir para bloquear
- **Então** a reserva fica recusada
- **E** o motivo fica registrado só internamente
- **E** o cliente NÃO entra na blocklist

#### AC-130 — Bloquear na recusa é escolha do dono

- **Dado** uma pré-reserva em análise de um cliente que não deve mais alugar
- **Quando** o dono recusa marcando a opção de bloquear
- **Então** o cliente entra na blocklist da locadora (CPF e telefone)

#### AC-072 — O carro só sai depois de confirmado

- **Dado** uma reserva ainda não confirmada
- **Quando** o dono tenta registrar a retirada
- **Então** o sistema recusa

#### AC-073 — Registrar a retirada põe a locação em andamento

- **Dado** uma reserva confirmada
- **Quando** o dono registra a retirada
- **Então** a locação passa a estar em andamento

#### AC-074 — Devolução atrasada é sinalizada

- **Dado** uma locação em andamento cujo prazo de devolução já passou
- **Quando** o dono registra a devolução
- **Então** a locação é finalizada
- **E** fica marcada como devolvida com atraso

#### AC-075 — Remarcar recalcula o período e o valor

- **Dado** uma pré-reserva de 2 diárias
- **Quando** o dono remarca para um período de 3 diárias
- **Então** o número de diárias e o total são recalculados

## Fora de escopo

- Cobrança automática por atraso na devolução (hoje só sinaliza).
- Reserva de categoria (sem escolher o carro específico).
- Lista de espera quando não há carro livre.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-018 | A garantia contra sobreposição tem que estar no BANCO, não na lógica | confirmada | Duas pessoas clicando no mesmo instante passariam por qualquer checagem feita antes do INSERT |
| ASM-019 | Diária é bloco de 24h arredondado para cima, mínimo 1 | confirmada | É como a locadora cobra; 26h são 2 diárias |
| ASM-020 | Recusar sempre põe o cliente na blocklist | invalidada | Estava errado e o dono do produto decidiu mudar (28/07/2026): bloquear virou ESCOLHA na hora de recusar. Recusa por documento ilegível ou carro indisponível não queima mais o cliente para sempre. Virou o critério AC-130 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-008 | Devolução atrasada deve gerar cobrança automática de diária extra? | respondida | Não no MVP: só sinaliza. Cobrar automaticamente sem combinar gera briga com o cliente; o dono decide caso a caso |
