# Spec: Guia de primeiros passos

> feature: primeiros-passos
> status: implementada

## Contexto

Uma locadora que acabou de assinar abre um painel vazio e não sabe por onde
começar. Este guia mostra o que falta para o sistema rodar sozinho — cadastrar
a frota, completar os dados do contrato, conectar o WhatsApp — e cada passo se
marca **sozinho** quando a condição acontece. Não existe botão de "concluí":
lista de tarefas que a pessoa marca à mão vira mentira em uma semana. Quando o
que é obrigatório termina, o guia some da tela.

## Histórias

### US-007 — Saber o que falta para o sistema funcionar

Como dono de locadora recém-assinante, quero ver o que ainda falta configurar,
para que eu não descubra pelo cliente reclamando que ninguém respondeu.

#### AC-033 — Mostra os passos e o quanto já foi feito

- **Dado** um dono logado no painel
- **Quando** ele abre a tela inicial
- **Então** vê a lista de passos e quantos já estão prontos
- **E** o contador bate com os passos marcados

#### AC-034 — O passo se marca sozinho quando o cadastro fica completo

- **Dado** a locadora sem razão social, CNPJ e endereço
- **Quando** o dono preenche os três
- **Então** o passo dos dados do contrato aparece como pronto, sem ninguém marcar

#### AC-035 — Preencher pela metade não marca o passo

- **Dado** a locadora com só a razão social preenchida
- **Quando** o guia é consultado
- **Então** o passo dos dados do contrato continua em aberto

#### AC-036 — O aviso no celular é opcional e não segura o guia

- **Dado** o passo de receber aviso no WhatsApp do dono
- **Quando** o guia é consultado
- **Então** esse passo é marcado como opcional
- **E** não impede o guia de ser considerado concluído

#### AC-037 — O passo da frota reflete os veículos cadastrados

- **Dado** uma locadora com veículos cadastrados
- **Quando** o guia é consultado
- **Então** o passo da frota aparece como pronto e informa quantos veículos existem

#### AC-038 — Todo passo diz por que existe e para onde ir

- **Dado** qualquer passo do guia
- **Quando** o guia é consultado
- **Então** cada passo traz título, o motivo de existir, o destino e o texto do botão

## Fora de escopo

- Tutorial passo a passo dentro das telas (tour guiado).
- Bloquear o uso do sistema enquanto a configuração não terminar.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-009 | A locadora considera a configuração "pronta" mesmo sem o aviso no celular | confirmada | É conveniência do dono, não requisito para atender cliente |
| ASM-010 | O guia pode ser dispensado pelo dono, mesmo incompleto | confirmada | Quem não quer o guia não deveria ser obrigado a olhar para ele todo dia |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-004 | O guia deve voltar a aparecer se um passo "desconfigurar" (ex.: WhatsApp cair)? | respondida | Não: caiu integração é problema de operação, e o lugar disso é o alerta, não o guia de estreia |
