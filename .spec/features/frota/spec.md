# Spec: Frota

> feature: frota
> status: implementada

## Contexto

A frota é a base de tudo: sem carro cadastrado a IA não tem o que oferecer, a
agenda não tem o que agendar e o contrato não tem o que descrever. Além do
cadastro, esta feature guarda o que faz um carro parar de render — quilometragem,
próxima revisão e os vencimentos de IPVA, licenciamento e seguro — e o histórico
de manutenções feitas.

## Histórias

### US-010 — Cadastrar e manter os carros

Como dono de locadora, quero cadastrar meus veículos com preço e categoria, para
que o sistema saiba o que oferecer e por quanto.

#### AC-053 — Cadastra um veículo com o essencial

- **Dado** o dono na tela da frota
- **Quando** informa modelo, placa, categoria e valor da diária
- **Então** o veículo entra na frota como disponível
- **E** a caução fica zerada se ele não informar

#### AC-054 — A categoria precisa ser uma das que existem

- **Dado** o dono cadastrando um veículo
- **Quando** informa uma categoria fora de hatch, sedan, SUV, picape ou minivan
- **Então** o cadastro é recusado e a mensagem lista as categorias aceitas

#### AC-055 — Duas locadoras podem ter a mesma placa

- **Dado** duas locadoras diferentes no sistema
- **Quando** cada uma cadastra um veículo com a mesma placa
- **Então** as duas conseguem (a placa é única dentro da locadora, não no sistema)

#### AC-056 — Uma locadora não enxerga o veículo da outra

- **Dado** um veículo cadastrado na locadora A
- **Quando** a locadora B pede esse veículo pelo identificador
- **Então** recebe "não encontrado"

#### AC-057 — Alterar o preço não muda locação já fechada

- **Dado** uma reserva já criada com a diária congelada
- **Quando** o dono aumenta o valor da diária do veículo
- **Então** a reserva antiga mantém o valor que foi combinado

#### AC-058 — Filtra a frota por situação

- **Dado** veículos disponíveis e em manutenção
- **Quando** o dono filtra por manutenção
- **Então** vê apenas os que estão parados

#### AC-059 — Veículo com locação não pode ser apagado

- **Dado** um veículo que já tem reserva registrada
- **Quando** o dono tenta excluí-lo
- **Então** o sistema recusa e explica que existem registros ligados a ele

### US-011 — Não perder prazo de documento nem revisão

Como dono de locadora, quero registrar quilometragem, revisão e vencimentos,
para que eu não seja pego por IPVA vencido ou revisão atrasada.

#### AC-060 — Guarda quilometragem, revisão e vencimentos

- **Dado** o dono editando um veículo
- **Quando** informa quilometragem, km da próxima revisão e as datas de IPVA,
  licenciamento e seguro
- **Então** o cadastro guarda todos esses dados

#### AC-061 — Registra uma manutenção no histórico do carro

- **Dado** um veículo da frota
- **Quando** o dono registra uma manutenção feita
- **Então** ela passa a aparecer no histórico daquele veículo

#### AC-062 — Não registra manutenção em veículo de outra locadora

- **Dado** um veículo da locadora A
- **Quando** a locadora B tenta registrar manutenção nele
- **Então** o pedido é recusado

## Fora de escopo

- Controle de pneus, peças e estoque de oficina.
- Integração com rastreamento veicular.
- Depreciação contábil do veículo.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-016 | A placa é única por locadora, não no sistema inteiro | confirmada | Locadoras diferentes são clientes diferentes; a placa de uma não interessa à outra |
| ASM-017 | Categoria é formato de carroceria, e um carro nunca pertence a duas | confirmada | Critério único evita ambiguidade quando a IA oferece o carro ao cliente |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-007 | O sistema deve avisar sozinho quando o IPVA está perto de vencer? | respondida | Por ora não: a data fica visível na frota. Aviso automático entra junto com a central de alertas, para não virar mais um canal solto |
