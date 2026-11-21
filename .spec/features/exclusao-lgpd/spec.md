# Spec: Exclusão LGPD apaga tudo mesmo

> feature: exclusao-lgpd
> status: em-implementacao

## Contexto

O painel promete "apaga TODOS os dados e documentos deste cliente" quando o
titular exerce o direito ao esquecimento. As linhas do banco somem por cascata,
mas **arquivo guardado não tem cascata**: some só se alguém mandar apagar. A
lista de arquivos olhava apenas os documentos da reserva e deixava para trás,
para sempre, as imagens que o cliente mandou na conversa do WhatsApp e as fotos
das vistorias das locações dele. Ou seja: a promessa da tela era falsa. Esta
feature garante que a lista cubra as três origens.

## Histórias

### US-009 — Cumprir de verdade o direito ao esquecimento

Como responsável pela locadora, quero que a exclusão apague todos os arquivos do
cliente, para que a locadora cumpra a LGPD e não guarde foto de quem pediu para
ser esquecido.

#### AC-045 — Apaga o documento enviado para a reserva

- **Dado** um cliente que enviou CNH, comprovante ou selfie para uma reserva
- **Quando** a exclusão de dados dele é preparada
- **Então** esses arquivos entram na lista do que será apagado

#### AC-046 — Apaga a imagem enviada na conversa do WhatsApp

- **Dado** um cliente que mandou uma foto na conversa
- **Quando** a exclusão de dados dele é preparada
- **Então** essa imagem entra na lista do que será apagado

#### AC-047 — Apaga a foto da vistoria da locação dele

- **Dado** um cliente com fotos de vistoria nas locações que fez
- **Quando** a exclusão de dados dele é preparada
- **Então** essas fotos entram na lista do que será apagado

#### AC-048 — A lista não traz repetição nem caminho vazio

- **Dado** um cliente com arquivos nas três origens
- **Quando** a exclusão de dados dele é preparada
- **Então** nenhum arquivo aparece duas vezes
- **E** nenhum item da lista vem vazio

#### AC-049 — Não apaga arquivo de outro cliente

- **Dado** dois clientes com arquivos na mesma locadora
- **Quando** a exclusão é preparada para um deles
- **Então** nenhum arquivo do outro cliente entra na lista

#### AC-052 — Guarda o contrato da locação encerrada e apaga o resto

> AINDA NÃO IMPLEMENTADO. Depende de resolver a suposição ASM-015 (guardar o
> contrato é guardar dado pessoal — precisa de base legal).

- **Dado** um cliente com uma locação já encerrada que pede a exclusão dos dados
- **Quando** a exclusão é executada
- **Então** o contrato daquela locação fica arquivado como prova
- **E** os documentos pessoais (CNH, comprovante, selfie, fotos) são apagados
- **E** a tela deixa de prometer que apaga TUDO, e explica o que fica guardado

## Fora de escopo

- Apagar cópias que já tenham sido baixadas por alguém da locadora.
- Retenção automática por prazo (apagar sozinho depois de X meses).
- Exportar os dados do cliente antes de apagar (portabilidade).

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-013 | Apagar tem prioridade sobre guardar prova de contrato encerrado | invalidada | O dono do produto decidiu (28/07/2026) guardar o contrato da locação encerrada e apagar o resto. Virou o critério AC-052, ainda NÃO implementado |
| ASM-014 | Falha ao apagar um arquivo não deve impedir a exclusão dos demais | confirmada | Melhor apagar 9 de 10 e registrar a falha do que travar tudo |
| ASM-015 | Guardar o contrato significa guardar dado pessoal (nome, CPF, endereço do titular) | aberta | **Tensão real:** o contrato É dado pessoal. Guardá-lo depois do pedido de exclusão só se sustenta com base legal (exercício de direito em processo). Precisa de orientação jurídica ANTES de implementar o AC-052 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-006 | Por quanto tempo a locadora PODE guardar documentos de locação encerrada? | respondida | Documento pessoal: apaga no pedido do titular. Contrato de locação encerrada: fica arquivado como prova (André, 28/07/2026). O PRAZO dessa guarda continua sem definição — ver ASM-015 |
