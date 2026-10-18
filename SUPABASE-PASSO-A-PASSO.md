# Como conectar a loja ao Supabase — passo a passo

Tempo estimado: 30 a 40 minutos (Google e Microsoft são opcionais e levam mais 15 min cada).
Os nomes dos menus do Supabase podem mudar um pouco com o tempo; procure pelo nome mais parecido.

---

## Passo 1 — Criar o projeto

1. Acesse **supabase.com** e clique em **Start your project**. Entre com sua conta do GitHub ou e-mail.
2. Clique em **New project**.
3. Preencha:
   - **Name:** `adelia-guga-loja`
   - **Database Password:** crie uma senha forte e **guarde** (não é a senha do site, é a do banco).
   - **Region:** `South America (São Paulo)`.
4. Clique em **Create new project** e espere 1 a 2 minutos até ficar pronto.

## Passo 2 — Criar o banco de dados

1. No menu da esquerda, abra **SQL Editor** e clique em **New query**.
2. Abra o arquivo `supabase/schema.sql` (no bloco de notas ou VS Code), copie **tudo** e cole no editor.
3. Clique em **Run** (ou Ctrl + Enter). Deve aparecer **Success. No rows returned**.
4. Confira em **Table Editor**: devem existir as tabelas `products`, `categories`, `orders`, `profiles` e outras.

> **Já tinha rodado uma versão anterior?** Rode o `schema.sql` de novo (é seguro: não apaga
> nem sobrescreve nada) e depois rode também `supabase/atualizacao.sql`.

## Passo 3 — Ligar o site ao projeto

1. Vá em **Project Settings** (ícone de engrenagem) → **API** (ou **Data API** / **API Keys**).
2. Copie:
   - **Project URL** — algo como `https://abcdefghij.supabase.co`
   - a chave pública: **anon public** ou **Publishable key** (`sb_publishable_...`).
     ⚠️ **Nunca** use a chave `service_role` / `secret` no site.
3. Abra `js/config.js` e preencha:

```js
supabase: {
  url: "https://abcdefghij.supabase.co",
  anonKey: "COLE_A_CHAVE_PUBLICA_AQUI",
},
```

4. Na mesma tela do `config.js`, preencha a **chave Pix** (`pix.key`) e confira o **WhatsApp**.
5. Abra o site: a faixa "Modo demonstração" some e o catálogo passa a vir do banco.

## Passo 4 — Publicar a API de frete (Edge Function)

1. No menu da esquerda, abra **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. **Nome da função:** `calcular-frete` (exatamente assim).
3. Apague o código de exemplo, cole todo o conteúdo de `supabase/functions/calcular-frete/index.ts` e clique em **Deploy**.
4. Abra a função → **Details / Settings** e **desligue "Enforce JWT verification"** (ou "Verify JWT"). Salve.
5. Teste no navegador (troque pelo seu endereço):
   `https://abcdefghij.supabase.co/functions/v1/calcular-frete?cep=06454000`
   Deve aparecer um texto com `"distance_km"` e `"fee"`.

> Pelo terminal também funciona: `supabase functions deploy calcular-frete --no-verify-jwt --project-ref abcdefghij`

## Passo 5 — Configurar o login (página Entrar)

1. Vá em **Authentication** → **URL Configuration**.
   - **Site URL:** o endereço do site publicado, por exemplo `https://adeliaeguga.com.br`.
   - **Redirect URLs** → **Add URL**: adicione
     - `https://adeliaeguga.com.br/entrar.html`
     - `http://localhost:5173/entrar.html` (só se for testar no computador)
2. Vá em **Authentication** → **Providers** (ou **Sign In / Providers**) → **Email**: deixe **ativado**.
   - **Confirm email ligado:** a cliente recebe um link e só entra depois de confirmar (mais seguro).
   - **Confirm email desligado:** a conta funciona na hora.
3. (Opcional) Em **Authentication** → **Emails / Templates**, traduza os textos dos e-mails de confirmação e de recuperação de senha.

### Passo 5a (opcional) — Entrar com Google

1. Acesse **console.cloud.google.com**, crie um projeto e vá em **APIs e serviços** → **Tela de consentimento OAuth**: preencha nome "Adélia & Guga" e e-mail de suporte.
2. **APIs e serviços** → **Credenciais** → **Criar credenciais** → **ID do cliente OAuth** → tipo **Aplicativo da Web**.
3. Em **URIs de redirecionamento autorizados**, adicione: `https://abcdefghij.supabase.co/auth/v1/callback`
4. Copie o **ID do cliente** e a **Chave secreta**.
5. No Supabase: **Authentication** → **Providers** → **Google** → ative, cole os dois valores → **Save**.

### Passo 5b (opcional) — Entrar com Microsoft

1. Acesse **portal.azure.com** → **Microsoft Entra ID** → **Registros de aplicativo** → **Novo registro**.
2. Tipos de conta: **Contas em qualquer diretório organizacional e contas pessoais da Microsoft**.
3. URI de redirecionamento (Web): `https://abcdefghij.supabase.co/auth/v1/callback` → **Registrar**.
4. Copie o **ID do aplicativo (cliente)**. Em **Certificados e segredos** → **Novo segredo do cliente**, copie o **Valor**.
5. No Supabase: **Authentication** → **Providers** → **Azure** → ative, cole o ID e o segredo; em **Azure Tenant URL** use `https://login.microsoftonline.com/common` → **Save**.

Se Google ou Microsoft não forem configurados, os botões mostram um aviso e o login por e-mail continua funcionando.

## Passo 6 — Criar o acesso do painel (só mayconfdacosta@gmail.com)

O painel só abre para **mayconfdacosta@gmail.com**, com o e-mail confirmado. Essa regra está
no banco (tabela `painel_emails`, criada pelo `schema.sql`), então ninguém consegue burlar
pelo navegador. A **senha não fica no código do site**: ela é guardada criptografada pelo
Supabase.

**Faça este passo logo depois do Passo 2, antes de publicar o site**, para que ninguém
consiga se cadastrar antes com esse e-mail.

1. No Supabase, vá em **Authentication** → **Users** → **Add user** → **Create new user**.
2. Preencha:
   - **Email:** `mayconfdacosta@gmail.com`
   - **Password:** a senha que você escolheu para o painel
   - marque **Auto Confirm User**
3. Clique em **Create user**.
4. Para abrir o painel: na loja, **clique 3 vezes seguidas no logo** do topo (ou acesse `seu-site/painel.html`) e entre com esse e-mail e senha.
5. Para trocar a senha depois: **Authentication** → **Users** → clique no usuário → **Send password recovery**, ou use "Esqueci minha senha" na página Entrar.

Qualquer outra conta, mesmo logada, vê "Esta conta não tem acesso ao painel".

> Precisa liberar outra pessoa no futuro? No SQL Editor:
> `insert into public.painel_emails (email) values ('outro-email@exemplo.com');`
> Para tirar: `delete from public.painel_emails where email = 'outro-email@exemplo.com';`

**No modo demonstração** (sem Supabase), o painel também só aceita esse e-mail: crie a conta
uma vez na página **Entrar → Criar conta** com esse e-mail e a sua senha. Ela fica salva só
naquele navegador, protegida por hash.

## Passo 7 — Ajustar horários e preços

Tudo em **Table Editor**:

| O que mudar | Onde |
|---|---|
| Preços, durações, estoque | tabela `products` e `product_variants` |
| Horário de atendimento (padrão 08:00–18:00) | tabela `categories`: `open_time` e `close_time` (Unhas, Cabelo, Mega Hair) |
| Dias de atendimento (padrão segunda a sábado) | `categories.open_days`: 1 = segunda … 7 = domingo. Ex.: `{2,3,4,5,6}` = terça a sábado |
| Quantas clientes ao mesmo tempo | `categories.slot_capacity`: vazio = sem limite; `1` = uma por horário (o site esconde horários lotados) |
| Regra do frete (R$ 8 até 3 km + R$ 2/km, até 100 km) | tabela `delivery_settings` |
| Fotos | Storage → bucket `produtos` → envie e cole a URL em `products.image_url` |

Os horários aparecem de hora em hora e só os que **cabem inteiros** no expediente: manicure (45 min) vai das 08:00 às 17:00; luzes (4 h) das 08:00 às 14:00.

## Passo 8 — Publicar o site

Mais simples: **Netlify Drop**.

1. Acesse **app.netlify.com/drop**.
2. Arraste a pasta do site (com `index.html`, `entrar.html`, `painel.html`, `css`, `js`, `assets`). A pasta `supabase` não precisa ir.
3. Pronto: o Netlify dá um endereço. Para usar um domínio próprio, vá em **Domain settings**.
4. Volte ao **Passo 5** e coloque esse endereço em **Site URL** e **Redirect URLs**.

## Passo 9 — Testar tudo (checklist)

- [ ] O catálogo abre sem a faixa "Modo demonstração".
- [ ] Frete: digite um CEP na seção Entrega e veja km e taxa.
- [ ] Crie uma conta em **Entrar** e veja seu nome no topo da loja.
- [ ] Reserve um horário de manicure, finalize e veja o Pix.
- [ ] Abra o painel (3 cliques no logo), veja o pedido em **Pedidos** e o horário em **Agenda**.
- [ ] Clique em **Confirmar Pix** e veja o status mudar. Na página **Entrar → Minha conta**, a cliente vê o status novo.

## Problemas comuns

| O que aparece | O que fazer |
|---|---|
| Faixa "Não conseguimos carregar o catálogo do Supabase" | Confira `url` e `anonKey` em `js/config.js` e se o `schema.sql` rodou sem erro. |
| "Não foi possível calcular o frete agora" | A função `calcular-frete` não foi publicada, tem outro nome ou está com "Verify JWT" ligado. |
| Login com Google volta para a página com erro | Falta a URL do site em **Redirect URLs** ou o callback no Google/Azure está diferente. |
| "Esta conta não tem acesso ao painel" | Só mayconfdacosta@gmail.com entra. Confira se o usuário foi criado com esse e-mail e com **Auto Confirm User** (Passo 6). |
| "Confirme seu e-mail..." | A cliente precisa clicar no link do e-mail, ou desligue **Confirm email** no Passo 5. |
| Horário sumiu da lista | Ele já passou, está fora do expediente ou atingiu o limite de `slot_capacity`. |
