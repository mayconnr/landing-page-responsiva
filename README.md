# Adélia & Guga Mega Hair · Loja online

Loja e agenda do salão (Calçada Flor de Lótus, 9 · Centro Comercial de Alphaville · Barueri/SP · CEP 06453-016):
mechas de fios naturais, kits, acessórios, reserva de serviços com sinal de R$ 50,
frete calculado por km a partir do salão e pagamento via Pix copia e cola.

Site em HTML, CSS e JavaScript puro, sem build. Banco, login e API no Supabase.

**➜ Para conectar ao Supabase, siga o [SUPABASE-PASSO-A-PASSO.md](SUPABASE-PASSO-A-PASSO.md).**

```
index.html                      página da loja
entrar.html                     Entrar / Criar conta / Minha conta (pedidos da cliente)
painel.html                     painel da equipe: pedidos e agenda (3 cliques no logo da loja)
css/styles.css                  visual da loja (cores, espelhos, animações)
css/entrar.css · css/painel.css visual das páginas de login e do painel
js/config.js                    ← você preenche: Supabase, chave Pix, WhatsApp
js/catalog.js                   catálogo de exemplo (modo demonstração)
js/store.js                     catálogo, frete, horários, sacola e pedidos
js/auth.js                      contas (Supabase Auth ou demonstração)
js/pix.js                       gera o código Pix (padrão Banco Central)
js/app.js · js/entrar.js · js/painel.js   interfaces
assets/                         logo, foto do salão, fotos do Instagram, artes dos kits
assets/instagram/tons/          fotos das mechas em outros tons (simulações)
supabase/schema.sql             banco de dados completo (pode rodar de novo com segurança)
supabase/atualizacao.sql        só para quem já tinha rodado uma versão anterior
supabase/functions/calcular-frete/index.ts   API de frete por CEP
SUPABASE-PASSO-A-PASSO.md       guia de conexão, login, painel e publicação
```

## Contas, painel e agenda

- **Entrar / Criar conta** (`entrar.html`): botão "Entrar" no topo da loja. E-mail e senha, recuperação de senha por e-mail e, se configurados, Google e Microsoft. Logada, a cliente vê "Minha conta" com os pedidos dela, e o checkout já vem preenchido.
- **Painel da equipe** (`painel.html`): clique **3 vezes seguidas no logo** da loja. Aba **Pedidos** (filtros, status com um clique, WhatsApp da cliente) e aba **Agenda** (horários por dia). Só o e-mail **mayconfdacosta@gmail.com** (confirmado) entra; a regra está no banco (tabela `painel_emails`) e a senha fica no Supabase Auth, nunca no código.
- **Agenda de hora em hora**: das 08:00 às 18:00, segunda a sábado, só horários em que o serviço cabe inteiro. Ajustável por categoria em `categories` (`open_time`, `close_time`, `open_days`, `slot_capacity`).

## 1. Ver funcionando agora (modo demonstração)

Abra o `index.html` no navegador, ou sirva a pasta com qualquer servidor estático.
Sem o Supabase configurado, o site usa o catálogo de exemplo, calcula o frete direto
no navegador e guarda os pedidos só no próprio navegador. Uma faixa dourada no topo
avisa que é demonstração.

## 2. Banco de dados no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Vá em **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
   Isso cria as tabelas, as regras de segurança (RLS), a função de pedido, o bucket de fotos e os dados iniciais.
3. Em **Table Editor**, ajuste os **preços, durações e estoques** (os que vêm no arquivo são de exemplo).

**Já tinha rodado uma versão anterior?** Rode o `schema.sql` de novo (não apaga nem
sobrescreve nada) e depois `supabase/atualizacao.sql`: ele muda o endereço de origem
do frete para a Calçada Flor de Lótus, 9, aumenta o raio para 100 km, troca "cabelo
humano" por "fios naturais", cria as fotos por tom e define o horário 08:00–18:00.

Tabelas principais:

| Tabela | Para que serve |
|---|---|
| `categories` | Mechas, Kits, Acessórios, Mega Hair, Cabelo, Unhas |
| `products` | Produtos (`kind = produto`) e serviços (`kind = servico`, com `deposit` = sinal) |
| `product_variants` | Comprimentos das mechas, cada um com seu preço e estoque |
| `tones` | Tons das mechas e as cores da amostra no site |
| `transformations` | Pares de antes & depois (a seção só aparece quando existir algum) |
| `delivery_settings` | Regra do frete: R$ 8,00 até 3 km + R$ 2,00 por km extra, até 100 km |
| `delivery_quotes` | Cotações de frete geradas pela API |
| `orders` / `order_items` | Pedidos e reservas (data e hora). Acompanhe pelo painel |
| `profiles` | Uma linha por conta: nome e WhatsApp da cliente |
| `painel_emails` | E-mails que podem abrir o painel (hoje só mayconfdacosta@gmail.com) |

Segurança: o navegador só **lê** o catálogo. Pedidos são criados pela função
`create_order`, que recalcula preços, frete e confere o horário no servidor, então
ninguém consegue alterar valores pelo navegador. A cliente só vê os próprios pedidos;
a conta do painel vê e atualiza todos; visitantes sem conta não veem nenhum.

## 3. API de frete (Edge Function `calcular-frete`)

Recebe um CEP, encontra o endereço (BrasilAPI / ViaCEP), as coordenadas
(OpenStreetMap), mede a **rota de carro** a partir do salão (OSRM) e aplica a regra
de `delivery_settings`. A cotação fica salva por 60 minutos e o pedido usa esse valor.

**Pelo painel:** Edge Functions → Deploy a new function → Via Editor → nome
`calcular-frete` → cole `supabase/functions/calcular-frete/index.ts` → Deploy.
Depois, nas configurações da função, **desligue "Verify JWT"**.

**Pelo terminal (Supabase CLI):**

```bash
supabase functions deploy calcular-frete --no-verify-jwt --project-ref SEU_PROJECT_REF
```

Teste:

```bash
curl "https://SEU_PROJETO.supabase.co/functions/v1/calcular-frete?cep=06454000"
```

Resposta (resumo): `distance_km`, `fee`, `within_area`, `address`, `quote_id`.

Para mudar a regra do frete, edite a linha da tabela `delivery_settings`
(taxa fixa, km incluídos, valor por km, raio máximo, frete grátis acima de um valor).

## 4. Conectar o site

Edite `js/config.js`:

```js
supabase: {
  url: "https://SEU_PROJETO.supabase.co",
  anonKey: "SUA_CHAVE_PUBLICA",   // Project Settings → API → anon/publishable
},
pix: {
  key: "sua-chave-pix",            // CPF/CNPJ só números, e-mail, +5511... ou chave aleatória
  merchantName: "ADELIA E GUGA MEGA HAIR",
  city: "BARUERI",
},
whatsapp: "5511967079499",         // confirme o número
```

Com isso a faixa de demonstração some, o catálogo vem do banco, o frete passa pela
Edge Function e cada pedido gera o Pix com o valor exato e o código do pedido
(ex.: `AG1001`) como identificador.

O Pix copia e cola é estático: a confirmação do pagamento é feita pela equipe
(comprovante pelo WhatsApp → botão **Confirmar Pix** no painel).

## 5. Fotos dos produtos

As fotos atuais vêm do Instagram @adelia_cabelos (resoluções de 360×640) e as artes
dos kits/acessórios são ilustrações provisórias. Para trocar:

1. Storage → bucket `produtos` → envie as fotos.
2. Copie a URL pública e cole em `products.image_url` (e `hover_image_url`, se quiser a troca de foto ao passar o mouse).

### Foto por tom (mechas)

Ao escolher o tom, a foto do cabelo muda. Cada mecha tem o campo `tone_images`:

```json
{
  "mel":   { "url": "https://.../mecha-ondulada-mel.jpg", "simulado": false },
  "loiro": { "url": "https://.../mecha-ondulada-loiro.jpg", "simulado": true }
}
```

- `simulado: false` = foto real naquele tom.
- `simulado: true` = cor gerada digitalmente a partir de uma foto real (o site mostra a etiqueta "simulação" ao lado do tom).

Hoje são fotos reais: liso castanho claro e loiro; ondulado mel; cacheado mel.
As demais (pasta `assets/instagram/tons/`) são simulações. Ao fotografar as mechas
nesses tons, troque a `url` e mude `simulado` para `false`.

### Fotos dos cards de entrada

- **Salão:** foto real do Instagram (tonalização na cadeira).
- **Agenda:** foto do Unsplash (licença gratuita, uso comercial permitido), carregada direto do Unsplash pelo link no `index.html`. Se preferir uma foto da recepção de vocês, troque a `src` da imagem do card "Agenda".

## 6. Suporte pelo WhatsApp

O botão **Suporte** (canto inferior direito) abre um painel com assuntos prontos
(mechas, pedido, agenda, entrega, Pix) e um campo de mensagem livre. Tudo abre o
WhatsApp do número em `js/config.js` com a mensagem já escrita; se a cliente acabou
de fazer um pedido, o número do pedido vai junto.

## 7. Animações e "reduzir movimento"

O site respeita a opção de acessibilidade "reduzir movimento" do aparelho: quem
ativou vê a versão calma (sem rolagem animada, sem fotos se movendo). No Windows ela
fica em **Configurações → Acessibilidade → Efeitos visuais → Efeitos de animação**.
Para conferir todas as animações mesmo com essa opção ligada, abra o site com
`?movimento=1` no final do endereço (ex.: `index.html?movimento=1`).

## 8. Publicar

Qualquer hospedagem estática serve: Netlify, Vercel, Cloudflare Pages, Hostinger,
GitHub Pages. Envie a pasta inteira (menos `supabase/`, que fica só no Supabase).
Depois coloque o endereço publicado em **Authentication → URL Configuration** no Supabase
(passo 5 do guia), senão o login com link por e-mail, Google e Microsoft não volta para o site.

## O que trocar antes de publicar

- [ ] Preços, durações e estoques (tabelas `products` e `product_variants`)
- [ ] Chave Pix em `js/config.js`
- [ ] Confirmar o WhatsApp `11 96707-9499` (tirado do post "Estamos contratando")
- [ ] Fotos reais dos kits e acessórios (as atuais são ilustrações)
- [ ] Fotos reais das mechas nos tons que hoje são simulação (`tone_images`)
- [ ] Pares reais de antes & depois da mesma cliente (`transformations`)
- [ ] Foto do salão do hero em alta resolução, de preferência sem a marca d'água (a atual tem 480 px de largura e a assinatura da ULHÔA)
- [ ] Confirmar se o sinal de R$ 50 é abatido do valor do serviço e, se for, dizer isso no site
- [ ] Confirmar o horário de atendimento (08:00–18:00, segunda a sábado) e quantas clientes por horário (`slot_capacity`)
- [ ] Criar o usuário mayconfdacosta@gmail.com no Supabase com a senha do painel (passo 6 do guia), antes de publicar
