# Spec: Endereço do locatário no contrato

> feature: endereco-locatario
> status: implementada

## Contexto

O contrato de locação precisa qualificar as duas partes, e a do locatário
estava incompleta: o sistema guardava nome, CPF, CNH e telefone, mas nenhum
endereço. Sem endereço o contrato sai capenga justamente no documento que
protege a locadora. Esta feature guarda o endereço em partes (para preencher
pelo CEP e imprimir sempre igual), abre a edição do cliente no painel — que
não existia — e ensina a IA do WhatsApp a coletar o endereço na conversa.

## Histórias

### US-004 — Cadastrar o endereço sem digitar tudo

Como dono de locadora, quero digitar só o CEP e o número da casa, para que eu
não perca tempo escrevendo rua, bairro e cidade em cada cliente.

#### AC-013 — Salva o endereço completo do cliente

- **Dado** um cliente cadastrado
- **Quando** o dono salva CEP, rua, número, complemento, bairro, cidade e UF
- **Então** o cadastro guarda todos esses dados

#### AC-014 — Aceita o endereço do jeito que a pessoa digita

- **Dado** que o CEP aparece com traço na tela e a UF pode vir em minúscula
- **Quando** o dono salva `38.400-123` e `mg`
- **Então** o sistema guarda o CEP só com números e a UF em maiúsculas

#### AC-015 — CEP inválido é recusado

- **Dado** o dono preenchendo o cadastro
- **Quando** informa um CEP que não tem 8 números
- **Então** o sistema recusa e avisa

#### AC-016 — UF inválida é recusada

- **Dado** o dono preenchendo o cadastro
- **Quando** informa uma UF que não tem 2 letras
- **Então** o sistema recusa e avisa

#### AC-017 — CPF inválido é recusado

- **Dado** o dono preenchendo o cadastro
- **Quando** informa um CPF que não tem 11 números
- **Então** o sistema recusa e avisa

#### AC-018 — Apagar um campo limpa o dado, não guarda vazio

- **Dado** um cliente com complemento preenchido
- **Quando** o dono apaga o conteúdo do campo e salva
- **Então** o cadastro fica sem complemento (e não com um texto em branco)

#### AC-019 — Não edita cliente que não existe

- **Dado** um pedido de edição apontando para um cliente inexistente
- **Quando** o sistema recebe esse pedido
- **Então** responde que o cliente não foi encontrado

#### AC-020 — Não edita sem estar logado

- **Dado** alguém sem sessão no painel
- **Quando** tenta alterar o cadastro de um cliente
- **Então** o pedido é recusado

### US-005 — Contrato com o locatário qualificado

Como dono de locadora, quero o endereço do cliente impresso no contrato, para
que o documento identifique corretamente quem está levando o carro.

#### AC-021 — O contrato traz o endereço em uma linha

- **Dado** um cliente com endereço completo e uma reserva
- **Quando** o dono gera o contrato dessa reserva
- **Então** o endereço aparece no formato
  `Rua das Flores, 123, Apto 202 — Centro — Uberlândia/MG — CEP 38400-000`

#### AC-022 — Sem endereço, o contrato não quebra

- **Dado** um cliente que ainda não informou endereço
- **Quando** o dono gera o contrato
- **Então** o contrato é gerado normalmente, com o endereço vazio
- **E** a tela avisa o dono que falta cadastrar (o aviso não sai na impressão)

#### AC-023 — Endereço pela metade não deixa vírgula nem traço solto

- **Dado** um cliente com rua, número e bairro, mas sem cidade e sem CEP
- **Quando** o contrato é gerado
- **Então** sai `Alameda dos Ipês, 77 — Jardim`, sem pontuação sobrando

## Fora de escopo

- Validar se o endereço existe de verdade (só conferimos o formato).
- Endereço de cobrança separado do endereço de residência.
- Preencher o endereço a partir do comprovante de residência enviado.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-004 | Cidade e UF são necessárias no contrato, mesmo não tendo sido pedidas explicitamente | confirmada | Endereço sem cidade é ambíguo em documento legal, e o CEP já preenche os dois de graça |
| ASM-005 | O número da casa é texto, não número | confirmada | Existe `123A` e `S/N` — guardar como número perderia esses casos |
| ASM-006 | Buscar o CEP em serviço externo (ViaCEP) no navegador é aceitável | confirmada | Só o CEP sai do navegador — nenhum dado do cliente. Se o serviço cair, o dono digita à mão e nada trava. Em uso em produção desde 26/07/2026 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-002 | O endereço deve ser obrigatório para aprovar uma reserva? | respondida | Não: bloquearia locações de balcão. O contrato avisa quando falta, e o dono decide |
