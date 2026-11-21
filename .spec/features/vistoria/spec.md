# Spec: Vistoria digital

> feature: vistoria
> status: implementada

## Contexto

A discussão mais comum de locadora acontece na devolução: "esse risco já era
assim", "devolvi com o tanque igual". Sem prova, quem perde é o dono — ou o
cliente sai com razão sem ter. A vistoria registra quilometragem, combustível,
avarias marcadas no desenho do carro e fotos, na saída e na volta. O sistema
então diz sozinho o que mudou entre as duas.

## Histórias

### US-020 — Registrar o estado do carro na saída e na volta

Como dono de locadora, quero registrar o estado do carro com foto e medida,
para que a devolução não vire discussão sem prova.

#### AC-103 — Registra a vistoria de retirada

- **Dado** uma reserva confirmada
- **Quando** o dono registra a vistoria de retirada com quilometragem,
  combustível e avarias
- **Então** a vistoria fica guardada para aquela reserva

#### AC-104 — Uma vistoria de cada tipo por reserva

- **Dado** uma reserva que já tem vistoria de retirada
- **Quando** o dono tenta registrar outra vistoria de retirada
- **Então** o sistema recusa e avisa que já existe

#### AC-105 — O combustível é medido em oitavos

- **Dado** o dono registrando a vistoria
- **Quando** informa um nível fora da faixa de 0 a 8
- **Então** o sistema recusa

#### AC-106 — Não registra vistoria em reserva de outra locadora

- **Dado** uma reserva da locadora A
- **Quando** a locadora B tenta registrar vistoria nela
- **Então** recebe "reserva não encontrada"

#### AC-107 — A foto precisa ser imagem de verdade

- **Dado** o dono anexando uma foto à vistoria
- **Quando** o conteúdo não é uma imagem aceita
- **Então** o sistema recusa e explica

### US-021 — Saber o que mudou entre a saída e a volta

Como dono de locadora, quero que o sistema compare as duas vistorias, para que
eu não precise conferir foto por foto.

#### AC-108 — Compara quilometragem, combustível e avarias

- **Dado** uma reserva com vistoria de retirada e de devolução
- **Quando** o dono abre a vistoria
- **Então** vê quantos km rodou, quanto de combustível voltou a menos e
  quantas avarias são novas

#### AC-109 — Sem as duas vistorias, não há comparativo

- **Dado** uma reserva com apenas a vistoria de retirada
- **Quando** o dono abre a vistoria
- **Então** o comparativo não é apresentado (não dá para comparar com nada)

#### AC-110 — Sugere o km inicial pela última vistoria do veículo

- **Dado** um veículo que já teve vistoria registrada
- **Quando** o dono vai iniciar uma nova vistoria daquele carro
- **Então** o sistema sugere a última quilometragem conhecida

## Fora de escopo

- Reconhecer avaria automaticamente na foto.
- Assinatura do cliente na vistoria.
- Orçamento automático do reparo da avaria.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-029 | Combustível em oitavos (0 a 8) é melhor que porcentagem | confirmada | É como o ponteiro do painel mostra; ninguém olha o tanque e diz "37%" |
| ASM-030 | Avaria nova = quantidade a mais na devolução | confirmada | Aproximação ACEITA no MVP, com os olhos abertos: se uma avaria antiga sumir e outra surgir, a contagem não acusa. Vale porque a prova de verdade são as fotos lado a lado, e o número é só um atalho para o olho. Comparar posição a posição entra quando houver reclamação real |
| ASM-031 | O comparativo é calculado no servidor, não na tela | confirmada | Duas telas diferentes calculando a mesma coisa acabam divergindo |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-013 | Devolver com menos combustível deve gerar cobrança automática? | respondida | Não no MVP: o sistema mostra a diferença e o dono decide. Cobrança automática sem combinar gera atrito |
