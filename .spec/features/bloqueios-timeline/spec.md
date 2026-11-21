# Spec: Bloqueios de manutenção e linha do tempo

> feature: bloqueios-timeline
> status: implementada

## Contexto

Carro parado para manutenção não pode ser alugado — e o sistema precisa saber
disso, senão a IA oferece um carro que está na oficina. O bloqueio é uma barra
na agenda do veículo, e a proteção contra conflito vive no **banco**: bloqueio
não entra em cima de reserva ativa, e reserva não entra em cima de bloqueio.
A linha do tempo é a leitura disso tudo: quem está reservado, livre e parado.

## Histórias

### US-018 — Tirar um carro de circulação sem risco de conflito

Como dono de locadora, quero bloquear um veículo por um período, para que ele
não seja oferecido nem reservado enquanto está parado.

#### AC-094 — Cria um bloqueio de manutenção

- **Dado** um veículo da frota
- **Quando** o dono bloqueia um período informando o motivo
- **Então** o bloqueio é registrado para aquele veículo

#### AC-095 — Bloqueio sobre bloqueio é recusado

- **Dado** um veículo já bloqueado num período
- **Quando** o dono tenta bloquear o mesmo veículo em período que se sobrepõe
- **Então** o sistema recusa e explica que já existe bloqueio nesse período

#### AC-096 — O mesmo período em outro veículo é permitido

- **Dado** um veículo bloqueado num período
- **Quando** o dono bloqueia OUTRO veículo no mesmo período
- **Então** o bloqueio é aceito

#### AC-097 — Reserva em cima de bloqueio é barrada pelo banco

- **Dado** um veículo bloqueado para manutenção num período
- **Quando** alguém tenta reservar esse veículo no mesmo período
- **Então** o sistema recusa

#### AC-098 — Datas invertidas no bloqueio são recusadas

- **Dado** o dono criando um bloqueio
- **Quando** a data final é anterior à inicial
- **Então** o sistema recusa

#### AC-099 — Não bloqueia veículo de outra locadora

- **Dado** um veículo da locadora A
- **Quando** a locadora B tenta bloqueá-lo
- **Então** recebe "veículo não encontrado"

#### AC-100 — Liberar o período remove o bloqueio

- **Dado** um bloqueio existente
- **Quando** o dono libera aquele período
- **Então** o bloqueio deixa de existir e o veículo volta a ser reservável

### US-019 — Enxergar a frota inteira no tempo

Como dono de locadora, quero ver num lugar só o que está reservado, livre e
parado, para que eu saiba o que posso prometer a um cliente.

#### AC-101 — A linha do tempo devolve veículos, reservas e bloqueios juntos

- **Dado** uma frota com reserva e bloqueio no período
- **Quando** o dono abre a linha do tempo
- **Então** recebe numa resposta só o período consultado, os veículos, as
  reservas e os bloqueios

#### AC-102 — A linha do tempo respeita a janela pedida

- **Dado** uma reserva fora da janela consultada
- **Quando** o dono abre a linha do tempo de um período que não a inclui
- **Então** aquela reserva não aparece

## Fora de escopo

- Agendar manutenção recorrente (a cada X km ou meses).
- Avisar a oficina automaticamente.
- Prever quando o carro vai voltar da manutenção.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-027 | O conflito entre reserva e bloqueio tem que ser barrado pelo BANCO | confirmada | Trigger e restrição EXCLUDE garantem mesmo em condição de corrida; checar antes não bastaria |
| ASM-028 | O dia final do bloqueio é inclusive (o dia inteiro fica bloqueado) | confirmada | É como o dono pensa: "está parado até sexta" significa sexta inteira |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-012 | Bloqueio deve mudar a situação do veículo para "manutenção" automaticamente? | respondida | Não: o bloqueio é de PERÍODO e a situação do veículo é de AGORA. Um carro pode estar rodando hoje e bloqueado só no mês que vem |
