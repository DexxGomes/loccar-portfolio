# Templates de mensagem do WhatsApp (lembretes)

Os lembretes de **retirada** e **devolução** são enviados como **mensagens de
template**, porque podem cair fora da janela de 24h (onde texto livre não é
permitido). Os templates precisam ser cadastrados e **aprovados** pela Meta
antes de usar.

## Onde cadastrar

WhatsApp Manager → **Modelos de mensagem** (Message Templates) → **Criar modelo**.
Categoria: **Utilidade** (Utility). Idioma: **Português (BR)**.

## Template 1 — Lembrete de retirada

- **Nome:** `lembrete_retirada` (igual ao `REMINDER_PICKUP_TEMPLATE` do `.env`)
- **Corpo:**

  ```
  Olá {{1}}, lembrete: a retirada do seu {{2}} está agendada para {{3}}. Podemos confirmar? Responda esta mensagem. 🚗
  ```

- Variáveis: `{{1}}` = nome, `{{2}}` = veículo, `{{3}}` = data/hora.

## Template 2 — Lembrete de devolução

- **Nome:** `lembrete_devolucao` (igual ao `REMINDER_RETURN_TEMPLATE` do `.env`)
- **Corpo:**

  ```
  Olá {{1}}, lembrete: a devolução do seu {{2}} está agendada para {{3}}. Qualquer dúvida, é só responder aqui. 🙂
  ```

- Variáveis: `{{1}}` = nome, `{{2}}` = veículo, `{{3}}` = data/hora.

## Template 3 — Aviso ao dono (opcional)

Avisa o **dono** no WhatsApp quando uma conversa precisa dele (transferida para
humano). Só é usado se você definir `OWNER_ALERT_TEMPLATE` e o telefone do dono
(`npm run set:owner-alert <telefone>`).

- **Nome:** o valor de `OWNER_ALERT_TEMPLATE` (ex.: `aviso_atendimento`)
- **Categoria:** Utilidade (Utility) · **Idioma:** Português (BR)
- **Corpo:**

  ```
  🔔 Um cliente precisa de você no LocCar: {{1}}. Motivo: {{2}}. Abra o painel para responder.
  ```

- Variáveis: `{{1}}` = nome do cliente, `{{2}}` = motivo. Exemplos para aprovação:
  `{{1}}` = `João`, `{{2}}` = `dúvida sobre seguro`.

## Como o sistema envia

O job `sendReminders` (a cada 5 min, configurável em `REMINDERS_CRON`) busca os
lembretes vencidos e envia o template preenchendo as três variáveis do corpo,
na ordem acima. O idioma usado é o `REMINDER_TEMPLATE_LANG` (padrão `pt_BR`).

## Testar

1. Cadastre e aguarde a aprovação dos dois templates (costuma ser rápido).
2. Confirme uma reserva no painel (isso agenda os lembretes 24h antes de cada data).
3. Para testar sem esperar, crie uma reserva com retirada em menos de 24h — o
   lembrete é agendado para "agora" e sai no próximo ciclo do job.
4. Acompanhe os logs: `📨 Lembretes processados: N`.

> Enquanto os templates não estiverem aprovados, os envios vão falhar e o
> lembrete fica com status `falhou` (com o erro salvo na coluna `error` da
> tabela `reminders`). É só reaprovar e o próximo ciclo tenta de novo? Não — o
> status `falhou` não é reprocessado automaticamente; nesse caso, atualize o
> lembrete para `pendente` ou reconfirme a reserva.
