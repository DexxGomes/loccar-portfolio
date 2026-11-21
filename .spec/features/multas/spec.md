# Spec: Multas e repasse ao locatário

> feature: multas
> status: implementada

## Contexto

A multa chega semanas depois, no nome da locadora, e o dinheiro sai do bolso do
dono. O trabalho é lembrar de quem estava com o carro naquele dia e cobrar. Sem
controle, multa vira prejuízo silencioso. Esta feature registra a infração por
veículo e acompanha o repasse: pendente → repassada → paga.

## Histórias

### US-016 — Não pagar multa de cliente do próprio bolso

Como dono de locadora, quero registrar cada multa e acompanhar o repasse, para
que nenhuma infração de cliente fique por minha conta.

#### AC-082 — Registra uma multa

- **Dado** uma notificação de infração recebida
- **Quando** o dono registra descrição, valor, data e o veículo
- **Então** a multa é registrada como pendente de repasse

#### AC-083 — Multa sem descrição é recusada

- **Dado** o dono registrando uma multa
- **Quando** não descreve a infração
- **Então** o sistema recusa e pede a descrição

#### AC-084 — Acompanha o repasse até o fim

- **Dado** uma multa pendente
- **Quando** o dono marca como repassada e depois como paga
- **Então** a situação muda em cada passo

#### AC-085 — Situação inválida é recusada

- **Dado** o dono atualizando uma multa
- **Quando** informa uma situação que não existe
- **Então** o sistema recusa

#### AC-086 — Filtra as multas por situação

- **Dado** multas pendentes e pagas
- **Quando** o dono filtra por pendente
- **Então** vê apenas as que ainda não foram repassadas

#### AC-087 — Uma locadora não vê a multa da outra

- **Dado** uma multa registrada na locadora A
- **Quando** a locadora B lista suas multas
- **Então** a multa da locadora A não aparece

## Fora de escopo

- Consulta automática de multas nos órgãos de trânsito.
- Indicação de condutor junto ao Detran.
- Cobrança automática da multa junto com a locação.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-023 | Vincular a multa ao cliente é opcional | confirmada | Nem sempre dá para saber quem dirigia; o veículo e a data são o que sempre existe |
| ASM-024 | "Repassada" significa cobrada do cliente, não recebida | confirmada | Por isso existe "paga" como passo seguinte |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-010 | O sistema deve achar sozinho quem estava com o carro na data da infração? | respondida | Boa ideia e viável (a agenda tem o período de cada locação), mas fica para depois — hoje o dono escolhe o cliente |
