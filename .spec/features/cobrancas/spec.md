# Spec: Cobranças e recebimentos

> feature: cobrancas
> status: em-implementacao

## Contexto

É o contas a receber da locadora: diárias, caução, sinal, extras e multas. Duas
decisões moldam tudo aqui. A primeira: **"vencido" não é gravado no banco** — é
derivado na leitura comparando o vencimento com hoje, para não depender de um
job rodar. A segunda: a caução é dinheiro do cliente que volta na entrega, então
é acompanhada à parte e nunca conta como receita.

## Histórias

### US-022 — Saber quem me deve e o que já venceu

Como dono de locadora, quero registrar e acompanhar as cobranças, para que eu
saiba quem está devendo sem depender da memória.

#### AC-111 — Registra uma cobrança

- **Dado** uma locação
- **Quando** o dono registra uma cobrança com tipo, valor e vencimento
- **Então** ela fica registrada como pendente

#### AC-112 — Cobrança pendente e vencida aparece como vencida

- **Dado** uma cobrança pendente cujo vencimento já passou
- **Quando** o dono abre a lista
- **Então** ela aparece como vencida (sem precisar de nenhum job rodar)

#### AC-113 — Cobrança pendente a vencer continua pendente

- **Dado** uma cobrança pendente com vencimento no futuro
- **Quando** o dono abre a lista
- **Então** ela aparece como pendente, não como vencida

#### AC-114 — Marca a cobrança como paga

- **Dado** uma cobrança pendente
- **Quando** o dono registra o pagamento
- **Então** ela passa a constar como paga

#### AC-115 — Uma locadora não vê a cobrança da outra

- **Dado** uma cobrança da locadora A
- **Quando** a locadora B lista as suas
- **Então** a cobrança da locadora A não aparece

### US-023 — Gerar as cobranças da locação sem digitar duas vezes

Como dono de locadora, quero gerar as cobranças a partir da reserva, para que
eu não redigite valores que o sistema já conhece.

#### AC-116 — Gera diárias e caução a partir da reserva

- **Dado** uma reserva com diárias e caução
- **Quando** o dono manda gerar as cobranças
- **Então** são criadas uma cobrança das diárias e uma da caução
- **E** com vencimento no dia da retirada

#### AC-117 — Não gera as cobranças duas vezes

- **Dado** uma reserva que já teve as cobranças geradas
- **Quando** o dono manda gerar de novo
- **Então** o sistema recusa e avisa que já existem cobranças

### US-024 — Cobrar por PIX sem sair do sistema

Como dono de locadora, quero mandar um PIX de cobrança, para que o cliente
pague na hora.

#### AC-118 — Sem a integração configurada, o sistema explica em vez de quebrar

- **Dado** um servidor sem a chave da cobrança por PIX configurada
- **Quando** o dono tenta gerar o PIX de uma cobrança
- **Então** recebe um aviso claro de que a cobrança por PIX não está ativada

## Fora de escopo

- Baixa automática quando o PIX cai (webhook do provedor) — ainda não existe.
- Cobrança recorrente/assinatura do locatário.
- Parcelamento no cartão.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-032 | "Vencido" deve ser derivado na leitura, não gravado | confirmada | Se dependesse de job, um dia sem rodar mostraria dívida vencida como se estivesse em dia |
| ASM-033 | O vencimento padrão das cobranças da reserva é o dia da retirada | confirmada | É quando o dinheiro costuma ser cobrado, na entrega do carro |
| ASM-034 | O caminho do Asaas funciona como implementado | aberta | **NUNCA foi testado contra a API real do Asaas** — só o caminho "sem chave configurada". Não prometer ao cliente antes de testar |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-014 | A caução devolvida deve virar um lançamento de saída? | respondida | Não: ela nunca entrou como receita (ver resumo do dinheiro), então devolver não é despesa |
