# O que você precisa conectar (APIs e credenciais)

Guia único das contas/chaves externas que o sistema usa. Cada uma vira uma
variável no arquivo `.env` (copie de `.env.example`). No fim há um checklist e a
ordem recomendada.

---

## Resumo — 4 serviços

| # | Serviço | Para quê | Custo |
|---|---------|----------|-------|
| 1 | **Supabase** | Banco de dados (PostgreSQL) + Storage privado dos documentos | Plano free serve para começar |
| 2 | **Meta WhatsApp Cloud API** | Enviar/receber mensagens no WhatsApp da locadora | Grátis dentro da janela de 24h; templates têm custo por conversa |
| 3 | **Anthropic (Claude)** | IA que conversa e conduz a reserva | Pago por uso (tokens) |
| 4 | **JWT** (segredo local) | Login do painel | Grátis (você mesmo gera) |

> A cobrança das assinaturas das locadoras (Asaas) é **manual no início** — não
> precisa integrar nada agora.

---

## 1) Supabase — banco + storage

1. Crie uma conta em <https://supabase.com> e um novo projeto.
   - **Escolha a região São Paulo** (importante para LGPD e latência).
2. Pegue as credenciais em **Project Settings**:
   - **Database → Connection string (URI)** → `DATABASE_URL`
     (use a string do *pooler* / porta 5432; contém a senha do banco).
   - **API → Project URL** → `SUPABASE_URL`
   - **API → Project API keys → `service_role`** → `SUPABASE_KEY`
     (⚠️ é a chave secreta; use **só no backend**, nunca no painel).
3. Em **Storage**, crie um bucket chamado **`documentos`** e deixe-o **privado**
   (não marque "public"). É onde ficam as fotos de CNH/comprovantes.
4. Aplique o banco: `npm run db:schema` e `npm run db:seed`.

```env
DATABASE_URL=postgresql://postgres:SENHA@db.xxxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=eyJhbGciOi...        # service_role
SUPABASE_STORAGE_BUCKET=documentos
```

### "Dá para usar um banco mais seguro que o Supabase?"

Sim, e o código já está preparado para isso:

- **O banco é portável.** Uso o driver `pg` padrão, então o `DATABASE_URL` pode
  apontar para **qualquer PostgreSQL** — AWS RDS em `sa-east-1` (São Paulo),
  Neon, Azure Database, ou um Postgres self-hosted — **sem mudar código**.
- **Só o storage é específico do Supabase**, e está isolado em
  [`src/services/storage.js`](../src/services/storage.js) (3 funções). Trocar por
  Amazon S3 depois é mudança localizada nesse arquivo.
- **Segurança de verdade** (que já está no projeto): bucket privado + URLs
  assinadas temporárias, service key só no backend, e rotina de exclusão LGPD.

**Recomendação:** comece com Supabase (São Paulo) pela velocidade; migre o banco
para RDS e o storage para S3 quando/se a conformidade exigir.

---

## 2) Meta WhatsApp Cloud API

Passo a passo completo (com ngrok) em [WHATSAPP_SETUP.md](WHATSAPP_SETUP.md).
Resumo das chaves:

1. Crie um app **Business** em <https://developers.facebook.com/> e adicione o
   produto **WhatsApp**.
2. Em **WhatsApp → API Setup**:
   - **Temporary access token** → `WHATSAPP_TOKEN`
     (o temporário expira em 24h; para produção gere um **System User token**
     permanente em Business Settings → System Users).
   - **Phone number ID** (do número de teste ou do número oficial) → `PHONE_NUMBER_ID`.
3. **Verify token**: você inventa uma frase e usa nos dois lados → `VERIFY_TOKEN`.
4. (Recomendado) **App secret** em Configurações → Básico → `WHATSAPP_APP_SECRET`
   (valida a assinatura do webhook).
5. Cadastre e aprove os **templates** dos lembretes (ver [TEMPLATES_WHATSAPP.md](TEMPLATES_WHATSAPP.md)).
6. No banco, ajuste o `phone_number_id` da locadora para o seu número real:

   ```sql
   UPDATE tenants SET phone_number_id = 'SEU_PHONE_NUMBER_ID'
   WHERE id = '00000000-0000-0000-0000-000000000001';
   ```

```env
WHATSAPP_TOKEN=EAAG...
PHONE_NUMBER_ID=1234567890
VERIFY_TOKEN=uma-frase-secreta-que-voce-inventa
WHATSAPP_API_VERSION=v21.0
WHATSAPP_APP_SECRET=...            # opcional, recomendado
REMINDER_PICKUP_TEMPLATE=lembrete_retirada
REMINDER_RETURN_TEMPLATE=lembrete_devolucao
REMINDER_TEMPLATE_LANG=pt_BR
```

> **Multi-tenant:** cada locadora terá seu próprio `phone_number_id` e token,
> guardados na tabela `tenants`. As variáveis do `.env` acima funcionam como
> padrão/atalho para a primeira locadora.

---

## 3) Anthropic (Claude)

1. Crie uma conta em <https://console.anthropic.com> e gere uma **API key**.
2. Adicione créditos (a cobrança é por uso/tokens).

```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-8    # padrão (mais capaz)
```

- **Modelo × custo:** o padrão `claude-opus-4-8` é o mais capaz. Como o bot roda
  a cada mensagem, para reduzir custo você pode trocar por `claude-sonnet-5`
  (bom equilíbrio) ou `claude-haiku-4-5` (mais barato) — é só mudar a variável.

---

## 4) JWT (segredo do login do painel)

Não é um serviço externo — você gera uma string longa e aleatória. Ex:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

```env
JWT_SECRET=cole-aqui-a-string-gerada
```

Depois crie o usuário dono:

```bash
npm run create:owner -- dono@locadora.com suaSenha "Nome do Dono"
```

---

## Preparado para o futuro (não precisa agora)

- **Verificação de CPF/CNH/antecedentes:** há uma tabela `verification_checks` e
  a estrutura pensada para plugar um provedor depois — sem uso no MVP.
- **Cobrança das locadoras (Asaas):** manual no início; nenhuma integração
  necessária agora.

---

## Checklist final

- [ ] Supabase: projeto criado (região São Paulo), `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`
- [ ] Supabase Storage: bucket **privado** `documentos` criado
- [ ] Banco aplicado: `npm run db:schema` + `npm run db:seed`
- [ ] Meta: `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`, `VERIFY_TOKEN` (+ `WHATSAPP_APP_SECRET`)
- [ ] Meta: `phone_number_id` do tenant atualizado no banco
- [ ] Meta: templates `lembrete_retirada` e `lembrete_devolucao` aprovados
- [ ] Anthropic: `ANTHROPIC_API_KEY` com créditos
- [ ] `JWT_SECRET` gerado e usuário dono criado (`npm run create:owner`)
- [ ] Webhook configurado no painel da Meta apontando para a URL do ngrok/produção

## Ordem recomendada

1. **Supabase** (banco + storage) → já dá para subir a API e usar o painel.
2. **JWT + usuário dono** → login no painel funciona.
3. **Anthropic** → a IA passa a responder.
4. **WhatsApp** (por último) → conecta o bot ao WhatsApp real.

---

## Como publicar (deploy)

Uma forma simples e barata de colocar o sistema no ar:

| Parte | Serviço sugerido | Configuração |
|---|---|---|
| Painel (site) | **Vercel** | pasta raiz `web` (o `web/vercel.json` já faz o roteamento da SPA) |
| API (backend) | **Render** ou **Railway** | build `npm install`, start `npm start`, variáveis do `.env` |
| Banco + Storage | **Supabase** | o mesmo projeto usado no desenvolvimento, ou um separado para produção |

**Como os dois se conectam:** o painel precisa saber o endereço da API. Isso é feito
pela variável **`VITE_API_URL`** nas *Environment Variables* da Vercel, com o
endereço da sua API (ex.: `https://sua-api.onrender.com`). Troque também esse
endereço no `connect-src` da política de segurança em `web/vercel.json`.

> ⚠️ Essa variável é gravada **no momento em que o site é construído**. Ao alterá-la,
> é preciso **reconstruir** o site na Vercel (Deployments → ⋯ → Redeploy), ou enviar
> um commit novo — só salvar não basta.

**Plano da API:** planos gratuitos costumam "dormir" a API depois de alguns minutos
sem uso, e o primeiro acesso demora até ~1 minuto. Para uso real, prefira um plano
sempre ligado — o webhook do WhatsApp e os lembretes agendados dependem disso.
