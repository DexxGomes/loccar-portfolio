# Spec: Atendimento no WhatsApp

> feature: atendimento-whatsapp
> status: em-implementacao

## Contexto

É a porta de entrada do produto: o cliente conversa no WhatsApp da locadora, a
IA entende, mostra os carros livres e monta a **pré-reserva** — sem nunca
confirmar sozinha. O dono lê tudo no painel e assume quando quiser. Esta
especificação cobre o caminho da mensagem (webhook → conversa → painel) e a
análise de risco que ajuda o dono a decidir.

**Estado:** a estrutura está pronta e testada; a IA em si depende de uma chave
de API que ainda não está configurada em produção, então o trecho que fala com
o modelo não é exercitado pelos testes (ver a suposição ASM-038).

## Histórias

### US-025 — Receber mensagem sem perder e sem duplicar

Como dono de locadora, quero que toda mensagem entre exatamente uma vez, para
que nenhum cliente fique sem resposta nem receba resposta repetida.

#### AC-119 — O handshake da Meta é respondido com o desafio

- **Dado** a Meta verificando o endereço do webhook
- **Quando** ela chama com o token de verificação correto
- **Então** o sistema devolve o desafio recebido

#### AC-120 — Handshake com token errado é recusado

- **Dado** alguém tentando registrar um webhook falso
- **Quando** chama com token de verificação errado
- **Então** o acesso é negado

#### AC-121 — Em produção, mensagem sem assinatura é recusada

- **Dado** o servidor em produção sem a chave de assinatura configurada
- **Quando** chega uma entrega de mensagem no webhook
- **Então** o sistema recusa em vez de aceitar sem conferir a origem

#### AC-122 — A mesma mensagem não é processada duas vezes

- **Dado** uma mensagem já processada
- **Quando** a Meta reenvia o mesmo evento
- **Então** o sistema reconhece como repetido e não processa de novo

### US-026 — Ler e assumir a conversa no painel

Como dono de locadora, quero ler as conversas e assumir quando precisar, para
que eu não perca o contato com o cliente.

#### AC-123 — Lista as conversas que precisam de atendimento humano

- **Dado** conversas marcadas para atendimento humano e conversas normais
- **Quando** o dono filtra por "precisam de você"
- **Então** vê apenas as que a IA transferiu

#### AC-124 — Uma locadora não lê a conversa da outra

- **Dado** uma conversa da locadora A
- **Quando** a locadora B tenta abrir as mensagens dela
- **Então** recebe "conversa não encontrada"

#### AC-125 — Resolver a conversa devolve o atendimento à IA

- **Dado** uma conversa marcada como "precisa de humano"
- **Quando** o dono marca como resolvida
- **Então** a conversa deixa de exigir atendimento humano

### US-027 — Decidir com fatos, não com impressão

Como dono de locadora, quero ver os sinais objetivos do cliente antes de
aprovar, para que a recusa seja defensável e a aprovação, consciente.

#### AC-126 — Aponta documentação incompleta

- **Dado** uma pré-reserva sem os documentos esperados
- **Quando** o dono abre a análise de risco
- **Então** vê que a documentação está incompleta e quais documentos faltam

#### AC-127 — Aponta CNH vencida como risco alto

- **Dado** um cliente com CNH vencida
- **Quando** o dono abre a análise de risco
- **Então** o nível geral é alto e o motivo aparece descrito

#### AC-128 — Aponta cliente na blocklist

- **Dado** um cliente que está na blocklist da locadora
- **Quando** o dono abre a análise de risco de uma reserva dele
- **Então** o sistema sinaliza o bloqueio como risco alto

#### AC-129 — Cliente novo é informado, não penalizado

- **Dado** um cliente sem histórico na locadora
- **Quando** o dono abre a análise de risco
- **Então** vê a informação de que é a primeira reserva dele, como aviso neutro

## Fora de escopo

- Consulta externa de CPF/CNH em órgão oficial (não existe).
- Atendimento por voz/ligação.
- Cobrança dentro da conversa.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-035 | Responder 200 imediatamente e processar depois é o certo | confirmada | A Meta reenvia por timeout; responder rápido evita a enxurrada de repetições |
| ASM-036 | A deduplicação por identificador do evento basta | confirmada | Índice único no identificador da mensagem torna o reenvio inofensivo |
| ASM-037 | A IA nunca confirma reserva, só cria pré-reserva | confirmada | É a regra de ouro do produto: a decisão é sempre do dono |
| ASM-038 | O diálogo da IA em si não é coberto por teste automatizado | aberta | Depende de chave de API e de resposta de modelo. O caminho da mensagem, a deduplicação e o risco são testados; o miolo da conversa, não |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-015 | Como testar o diálogo da IA sem depender da API real? | aberta | — |
