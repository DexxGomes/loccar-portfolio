# Configurar o WhatsApp Cloud API para testar localmente

Guia da **Etapa 2b**. Objetivo: receber e responder mensagens no seu WhatsApp
usando o número de teste da Meta + ngrok apontando para a API local.

## Visão geral do fluxo

```
Seu celular (WhatsApp)  ->  Número de teste da Meta  ->  ngrok  ->  http://localhost:3000/webhook
```

## 1. Criar o app na Meta

1. Acesse <https://developers.facebook.com/> e crie um app do tipo **Business**.
2. No painel do app, adicione o produto **WhatsApp**.
3. Em **WhatsApp > API Setup** (Configuração da API) você verá:
   - **Temporary access token** → vai no `.env` como `WHATSAPP_TOKEN`
     (esse token expira em 24h; para produção use um *System User token* permanente).
   - **Phone number ID** (do número de teste) → `.env` como `PHONE_NUMBER_ID`.
   - **Test number**: adicione o SEU número em "To" para poder receber mensagens
     (a Meta exige cadastrar os destinatários no modo de teste).
4. (Opcional, recomendado) Em **Configurações > Básico**, copie a **Chave secreta
   do app** → `.env` como `WHATSAPP_APP_SECRET` (valida a assinatura do webhook).

## 2. Preencher o `.env`

```env
WHATSAPP_TOKEN=EAAG...            # token temporário da tela API Setup
PHONE_NUMBER_ID=1234567890        # phone number ID do número de teste
VERIFY_TOKEN=escolha-uma-frase    # VOCÊ inventa; usaremos no passo 4
WHATSAPP_API_VERSION=v21.0
WHATSAPP_APP_SECRET=...           # opcional
```

> No banco: o seed cria a "Locadora Demo" com `phone_number_id = PHONE_NUMBER_ID_DEMO`.
> Para o webhook encontrar o tenant, **atualize** esse valor para o seu Phone
> number ID real:
>
> ```sql
> UPDATE tenants
> SET phone_number_id = '1234567890'   -- seu Phone number ID
> WHERE id = '00000000-0000-0000-0000-000000000001';
> ```

## 3. Subir a API e o ngrok

```bash
npm run dev                 # sobe em http://localhost:3000
```

Em outro terminal, exponha a porta 3000 com o **ngrok**:

```bash
# instale em https://ngrok.com/download e autentique com seu token
ngrok http 3000
```

O ngrok mostra uma URL pública, ex: `https://abcd-1234.ngrok-free.app`.
Coloque-a no `.env` como `APP_BASE_URL` (útil nas próximas etapas).

## 4. Configurar o webhook na Meta

1. Em **WhatsApp > Configuration > Webhook**, clique em **Edit**.
2. **Callback URL**: `https://SUA-URL-ngrok.ngrok-free.app/webhook`
3. **Verify token**: exatamente o mesmo valor do `VERIFY_TOKEN` do `.env`.
4. Clique em **Verify and save**. A Meta chamará `GET /webhook`; se o token bater,
   aparece verde. (Nos logs da API você verá a requisição.)
5. Em **Webhook fields**, assine o campo **messages**.

## 5. Testar

1. No **API Setup**, envie a mensagem de template inicial para o seu número (ou
   mande você mesmo uma mensagem para o número de teste).
2. Responda pelo seu WhatsApp: "Olá".
3. A API deve:
   - receber o `POST /webhook`,
   - salvar cliente/conversa/mensagem no banco,
   - responder automaticamente (nesta etapa, uma resposta fixa de placeholder).

### Conferir no banco

```sql
select * from conversations order by created_at desc limit 5;
select * from messages order by created_at desc limit 10;
```

## Dicas de problemas comuns

- **"Verify and save" falha**: `VERIFY_TOKEN` do `.env` diferente do digitado na Meta,
  ou a API/ngrok não está no ar.
- **Recebe mas não responde**: token expirado (gere outro em API Setup) ou o seu
  número não está cadastrado na lista de destinatários de teste.
- **Webhook para phone_number_id desconhecido** (log): o `phone_number_id` do
  tenant no banco não bate com o do número de teste (ver passo 2).
- **Imagens não baixam**: confirme `SUPABASE_URL`/`SUPABASE_KEY` e o bucket privado
  `documentos` criado no Supabase Storage.
