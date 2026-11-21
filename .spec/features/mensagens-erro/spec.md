# Spec: Mensagens de erro que dizem o que corrigir

> feature: mensagens-erro
> status: implementada

## Contexto

O painel mostra apenas UMA frase quando algo dá errado: o campo `error` da
resposta. Essa frase vinha genérica — "Dados inválidos." sem dizer qual campo,
e "Registro duplicado (um valor único já existe)", que é jargão de banco de
dados. Para um dono de locadora que não é de tecnologia, isso é um beco sem
saída. Esta feature faz a frase nomear o campo e o problema, em português de
gente. **Mensagem de erro é parte da interface, não detalhe técnico.**

## Histórias

### US-008 — Entender o que corrigir sem chamar suporte

Como dono de locadora, quero que o sistema me diga exatamente o que está errado
no formulário, para que eu resolva sozinho em vez de ficar tentando.

#### AC-039 — Campo faltando: a mensagem diz qual

- **Dado** o dono cadastrando um veículo sem informar a placa
- **Quando** ele salva
- **Então** a mensagem cita a placa
- **E** não contém jargão técnico nem palavra em inglês

#### AC-040 — Vários campos faltando: avisa quantos

- **Dado** o dono cadastrando um veículo com quase nada preenchido
- **Quando** ele salva
- **Então** a mensagem nomeia o primeiro problema e avisa quantos campos ainda faltam

#### AC-041 — Valor que devia ser número explica isso

- **Dado** o dono digitando "cento e cinquenta" no valor da diária
- **Quando** ele salva
- **Então** a mensagem diz que a diária precisa ser um número

#### AC-042 — Categoria inexistente mostra as que existem

- **Dado** o dono informando uma categoria de veículo que não existe
- **Quando** ele salva
- **Então** a mensagem indica as categorias aceitas, sem jargão

#### AC-043 — Placa repetida fala de placa, não de "registro duplicado"

- **Dado** um veículo já cadastrado com uma placa
- **Quando** o dono tenta cadastrar outro com a mesma placa
- **Então** a mensagem diz que já existe um veículo com essa placa

#### AC-044 — Link quebrado não fala de banco de dados

- **Dado** um endereço com identificador inválido
- **Quando** o painel tenta abrir
- **Então** a mensagem explica em português comum, sem termo técnico

#### AC-051 — A resposta diz QUAL campo falhou, para a tela poder destacar

- **Dado** um formulário enviado com mais de um campo errado
- **Quando** o sistema recusa
- **Então** além da frase principal, a resposta identifica cada campo com problema
- **E** a tela consegue marcar esses campos em vermelho

## Fora de escopo

- Traduzir mensagens para outros idiomas.
- Mostrar erro por campo no formulário (hoje é uma frase principal + detalhes).

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-011 | Nomear o primeiro campo com problema e contar os demais é melhor que listar todos | confirmada | A pessoa corrige um por vez de qualquer jeito; a contagem evita o vaivém de descobrir de um em um |
| ASM-012 | Mensagem que já escrevemos em português deve passar intacta | confirmada | Só traduzimos o que o validador gera em inglês |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-005 | O painel deveria destacar o campo com erro além da frase? | respondida | Sim (dono do produto, 28/07/2026): em formulário grande, a frase sozinha faz caçar o campo. Virou o critério AC-051 |
