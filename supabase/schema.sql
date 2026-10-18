-- =====================================================================
--  Adélia & Guga · Mega Hair — banco de dados da loja (Supabase)
--
--  Como usar: Supabase > SQL Editor > New query > cole este arquivo
--  inteiro > RUN.
--
--  Pode rodar de novo quando quiser: cria só o que falta e NUNCA
--  sobrescreve preços, textos ou pedidos que vocês já editaram.
--
--  Atenção: os PREÇOS, DURAÇÕES e ESTOQUES do bloco "DADOS INICIAIS"
--  são de exemplo. Ajuste antes de publicar a loja.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. CATÁLOGO
-- ---------------------------------------------------------------------

create table if not exists public.categories (
  slug          text primary key,
  name          text not null,
  kind          text not null check (kind in ('produto', 'servico')),
  description   text,
  sort          int  not null default 0,
  active        boolean not null default true,
  -- Agenda (só para serviços): horários de hora em hora dentro deste intervalo
  open_time     time  not null default '08:00',
  close_time    time  not null default '18:00',
  open_days     int[] not null default '{1,2,3,4,5,6}',   -- 1 = segunda … 7 = domingo
  slot_capacity int check (slot_capacity > 0)            -- clientes ao mesmo tempo; null = sem limite
);

alter table public.categories add column if not exists open_time     time  not null default '08:00';
alter table public.categories add column if not exists close_time    time  not null default '18:00';
alter table public.categories add column if not exists open_days     int[] not null default '{1,2,3,4,5,6}';
alter table public.categories add column if not exists slot_capacity int check (slot_capacity > 0);

-- Tons das mechas (as duas cores desenham a amostra de fio no site)
create table if not exists public.tones (
  slug     text primary key,
  name     text not null,
  color_a  text not null,
  color_b  text not null,
  sort     int  not null default 0
);

create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  category_slug   text not null references public.categories(slug) on update cascade,
  kind            text not null check (kind in ('produto', 'servico')),
  name            text not null,
  description     text,
  -- produto: preço base · serviço: valor "a partir de" (pago no salão)
  price           numeric(10,2) not null check (price >= 0),
  -- serviço: sinal pago online via Pix para garantir o horário
  deposit         numeric(10,2) check (deposit >= 0),
  duration_min    int check (duration_min > 0),
  texture         text check (texture in ('liso', 'ondulado', 'cacheado')),
  tones           text[] not null default '{}',
  -- foto por tom: { "mel": { "url": "...", "simulado": false }, ... }
  -- "simulado": true = cor gerada digitalmente a partir de outra foto
  tone_images     jsonb not null default '{}'::jsonb,
  image_url       text,
  hover_image_url text,
  badge           text,
  stock           int check (stock >= 0),      -- null = sem controle de estoque
  featured        boolean not null default false,
  active          boolean not null default true,
  sort            int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.products add column if not exists tone_images jsonb not null default '{}'::jsonb;

create index if not exists products_category_idx on public.products (category_slug, sort);

-- Variações de produto (ex.: comprimento da mecha)
create table if not exists public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku        text unique not null,
  label      text not null,            -- "60 cm · 50 g"
  length_cm  int,
  grams      int,
  price      numeric(10,2) not null check (price >= 0),
  stock      int check (stock >= 0),   -- null = sem controle de estoque
  active     boolean not null default true,
  sort       int not null default 0
);

create index if not exists product_variants_product_idx on public.product_variants (product_id, sort);

-- Pares reais de antes & depois (a seção só aparece quando há pares ativos)
create table if not exists public.transformations (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  before_url text not null,
  after_url  text not null,
  active     boolean not null default true,
  sort       int not null default 0
);

-- ---------------------------------------------------------------------
-- 2. CONTAS (clientes e equipe)
-- ---------------------------------------------------------------------

-- Um perfil por conta do Supabase Auth (nome e WhatsApp da cliente).
-- O acesso ao painel NÃO depende de role: só dos e-mails em painel_emails.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  phone      text,
  role       text not null default 'cliente' check (role in ('cliente', 'admin')),
  created_at timestamptz not null default now()
);

-- Cria o perfil sozinho quando alguém se cadastra (e-mail, Google ou Microsoft)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Quem pode abrir o painel da equipe: SÓ os e-mails desta lista, e só com o
-- e-mail confirmado. A senha fica no Supabase Auth (criptografada), nunca no site.
create table if not exists public.painel_emails (
  email text primary key check (email = lower(email))
);
alter table public.painel_emails enable row level security;  -- sem políticas: o site não lê esta lista

insert into public.painel_emails (email) values ('mayconfdacosta@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from auth.users u
      join public.painel_emails p on p.email = lower(u.email)
     where u.id = auth.uid()
       and u.email_confirmed_at is not null
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. ENTREGA (taxa por km a partir do salão)
-- ---------------------------------------------------------------------

create table if not exists public.delivery_settings (
  id            int primary key default 1 check (id = 1),
  origin_label  text not null,
  origin_cep    text not null,
  origin_lat    double precision not null,
  origin_lng    double precision not null,
  base_fee      numeric(10,2) not null check (base_fee >= 0),  -- taxa fixa
  base_km       numeric(6,2)  not null check (base_km >= 0),   -- km incluídos na taxa fixa
  per_km        numeric(10,2) not null check (per_km >= 0),    -- valor por km extra
  max_km        numeric(6,2)  not null check (max_km > 0),     -- raio máximo de entrega
  free_above    numeric(10,2) check (free_above >= 0),         -- frete grátis a partir deste subtotal (null = desligado)
  quote_ttl_min int not null default 60,                       -- validade da cotação
  updated_at    timestamptz not null default now()
);

-- Cotações geradas pela Edge Function "calcular-frete".
-- Só o servidor grava aqui; o pedido usa a cotação gravada, nunca um
-- valor enviado pelo navegador.
create table if not exists public.delivery_quotes (
  id           uuid primary key default gen_random_uuid(),
  cep          text not null,
  street       text,
  district     text,
  city         text,
  state        text,
  lat          double precision,
  lng          double precision,
  distance_km  numeric(8,2) not null,
  duration_min numeric(8,1),
  method       text not null check (method in ('rota', 'linha_reta')),
  fee          numeric(10,2),
  within_area  boolean not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);

create index if not exists delivery_quotes_created_idx on public.delivery_quotes (created_at desc);

-- ---------------------------------------------------------------------
-- 4. PEDIDOS
-- ---------------------------------------------------------------------

create sequence if not exists public.order_number_seq start 1001;

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    int  not null unique default nextval('public.order_number_seq'),
  code            text generated always as ('AG' || order_number::text) stored,
  status          text not null default 'aguardando_pagamento' check (status in (
                    'aguardando_pagamento', 'pago', 'em_preparo', 'saiu_para_entrega',
                    'pronto_para_retirada', 'agendado', 'concluido', 'cancelado')),
  user_id         uuid references auth.users(id) on delete set null,
  customer_name   text not null,
  customer_phone  text not null,
  customer_email  text,
  fulfillment     text not null check (fulfillment in ('entrega', 'retirada', 'servico')),
  quote_id        uuid references public.delivery_quotes(id),
  cep             text,
  street          text,
  address_number  text,
  complement      text,
  district        text,
  city            text,
  state           text,
  distance_km     numeric(8,2),
  subtotal        numeric(10,2) not null default 0,
  delivery_fee    numeric(10,2) not null default 0,
  total           numeric(10,2) not null default 0,
  payment_method  text not null default 'pix',
  pix_txid        text,
  notes           text,
  paid_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists orders_status_idx on public.orders (status, created_at desc);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);

create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  product_id     uuid references public.products(id) on delete set null,
  variant_id     uuid references public.product_variants(id) on delete set null,
  kind           text not null check (kind in ('produto', 'servico')),
  name           text not null,
  option_label   text,
  tone           text,
  unit_price     numeric(10,2) not null,
  quantity       int not null check (quantity between 1 and 50),
  line_total     numeric(10,2) not null,
  booking_date   date,
  booking_time   time,
  booking_period text check (booking_period in ('manha', 'tarde', 'noite'))  -- legado (antes dos horários)
);

alter table public.order_items add column if not exists booking_time time;

create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_booking_idx on public.order_items (booking_date, booking_time);

-- ---------------------------------------------------------------------
-- 5. updated_at automático
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

drop trigger if exists delivery_settings_touch on public.delivery_settings;
create trigger delivery_settings_touch before update on public.delivery_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 6. AGENDA: ocupação por hora (sem dados pessoais)
-- Chamada pelo site: POST /rest/v1/rpc/horarios_ocupados
--   { "p_date": "2026-10-20", "p_category": "unhas" }
-- ---------------------------------------------------------------------

create or replace function public.horarios_ocupados(p_date date, p_category text)
returns table (hora time, ocupados int, capacidade int)
language sql
stable
security definer
set search_path = public
as $$
  select s.h::time,
         (select count(*)::int
            from public.order_items i
            join public.orders o   on o.id = i.order_id
            join public.products p on p.id = i.product_id
           where i.booking_date = p_date
             and i.booking_time is not null
             and p.category_slug = p_category
             and o.status <> 'cancelado'
             and (i.booking_date + i.booking_time) < s.h + interval '1 hour'
             and (i.booking_date + i.booking_time) + make_interval(mins => coalesce(p.duration_min, 60)) > s.h),
         c.slot_capacity
    from public.categories c
    cross join lateral generate_series(
      p_date + c.open_time,
      p_date + c.close_time - interval '1 hour',
      interval '1 hour'
    ) as s(h)
   where c.slug = p_category;
$$;

revoke all on function public.horarios_ocupados(date, text) from public;
grant execute on function public.horarios_ocupados(date, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. CRIAÇÃO DE PEDIDO (preços, frete e horários conferidos no servidor)
--
-- Chamada pelo site: POST /rest/v1/rpc/create_order  { "payload": {...} }
-- payload = {
--   customer_name, customer_phone, customer_email?,
--   fulfillment: 'entrega' | 'retirada',
--   quote_id?, cep?, street?, address_number?, complement?, district?, city?, state?,
--   notes?,
--   items: [{ product_id, variant_id?, tone?, quantity?, booking_date?, booking_time? }]
-- }
-- Se a cliente estiver logada, o pedido fica ligado à conta dela.
-- ---------------------------------------------------------------------

create or replace function public.create_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items       jsonb := coalesce(payload -> 'items', '[]'::jsonb);
  v_item        jsonb;
  v_settings    public.delivery_settings;
  v_quote       public.delivery_quotes;
  v_product     public.products;
  v_variant     public.product_variants;
  v_cat         public.categories;
  v_order       public.orders;
  v_qty         int;
  v_unit        numeric(10,2);
  v_label       text;
  v_tone        text;
  v_date        date;
  v_time        time;
  v_start       timestamp;
  v_end         timestamp;
  v_busy        int;
  v_now         timestamp := now() at time zone 'America/Sao_Paulo';
  v_has_goods   boolean := false;
  v_subtotal    numeric(10,2) := 0;
  v_fee         numeric(10,2) := 0;
  v_fulfillment text := coalesce(payload ->> 'fulfillment', 'retirada');
  v_phone       text := regexp_replace(coalesce(payload ->> 'customer_phone', ''), '\D', '', 'g');
  v_cep         text := regexp_replace(coalesce(payload ->> 'cep', ''), '\D', '', 'g');
begin
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'Seu carrinho está vazio.' using errcode = '22023';
  end if;
  if jsonb_array_length(v_items) > 30 then
    raise exception 'Pedido com itens demais. Fale com a gente pelo WhatsApp.' using errcode = '22023';
  end if;
  if length(trim(coalesce(payload ->> 'customer_name', ''))) < 2 then
    raise exception 'Informe seu nome.' using errcode = '22023';
  end if;
  if length(v_phone) not between 10 and 13 then
    raise exception 'Informe um WhatsApp com DDD.' using errcode = '22023';
  end if;

  -- Descobre se há produto físico (serviço não tem entrega)
  for v_item in select value from jsonb_array_elements(v_items) loop
    select * into v_product from public.products
     where id = (v_item ->> 'product_id')::uuid and active;
    if not found then
      raise exception 'Um item do carrinho não está mais disponível.' using errcode = '22023';
    end if;
    if v_product.kind = 'produto' then
      v_has_goods := true;
    end if;
  end loop;

  if not v_has_goods then
    v_fulfillment := 'servico';
  elsif v_fulfillment not in ('entrega', 'retirada') then
    raise exception 'Escolha entrega ou retirada no salão.' using errcode = '22023';
  end if;

  insert into public.orders (
    user_id, customer_name, customer_phone, customer_email, fulfillment,
    cep, street, address_number, complement, district, city, state, notes
  ) values (
    auth.uid(),
    trim(payload ->> 'customer_name'), v_phone, nullif(trim(coalesce(payload ->> 'customer_email', '')), ''),
    v_fulfillment,
    nullif(v_cep, ''),
    nullif(trim(coalesce(payload ->> 'street', '')), ''),
    nullif(trim(coalesce(payload ->> 'address_number', '')), ''),
    nullif(trim(coalesce(payload ->> 'complement', '')), ''),
    nullif(trim(coalesce(payload ->> 'district', '')), ''),
    nullif(trim(coalesce(payload ->> 'city', '')), ''),
    nullif(upper(trim(coalesce(payload ->> 'state', ''))), ''),
    left(nullif(trim(coalesce(payload ->> 'notes', '')), ''), 500)
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(v_items) loop
    select * into v_product from public.products where id = (v_item ->> 'product_id')::uuid;
    v_variant := null;
    v_label   := null;
    v_tone    := nullif(v_item ->> 'tone', '');
    v_date    := null;
    v_time    := null;

    if v_product.kind = 'servico' then
      select * into v_cat from public.categories where slug = v_product.category_slug;
      v_qty  := 1;
      v_unit := coalesce(v_product.deposit, 50);
      v_date := nullif(v_item ->> 'booking_date', '')::date;
      v_time := nullif(v_item ->> 'booking_time', '')::time;

      if v_date is null or v_date < v_now::date then
        raise exception 'Escolha uma data a partir de hoje para "%".', v_product.name using errcode = '22023';
      end if;
      if not (extract(isodow from v_date)::int = any (v_cat.open_days)) then
        raise exception 'O salão não atende "%" neste dia da semana.', v_product.name using errcode = '22023';
      end if;
      if v_time is null or extract(minute from v_time) <> 0 then
        raise exception 'Escolha um horário para "%".', v_product.name using errcode = '22023';
      end if;
      v_start := v_date + v_time;
      v_end   := v_start + make_interval(mins => coalesce(v_product.duration_min, 60));
      if v_time < v_cat.open_time or v_end > v_date + v_cat.close_time then
        raise exception '"%" é atendido das % às %. Escolha outro horário.',
          v_product.name, to_char(v_cat.open_time, 'HH24:MI'), to_char(v_cat.close_time, 'HH24:MI') using errcode = '22023';
      end if;
      if v_start <= v_now then
        raise exception 'O horário das % já passou. Escolha outro.', to_char(v_time, 'HH24:MI') using errcode = '22023';
      end if;

      if v_cat.slot_capacity is not null then
        -- uma reserva por vez para esta categoria e data (evita dois pedidos no mesmo segundo)
        perform pg_advisory_xact_lock(hashtext(v_cat.slug || v_date::text));
        select count(*) into v_busy
          from public.order_items i
          join public.orders o   on o.id = i.order_id
          join public.products p on p.id = i.product_id
         where i.booking_date = v_date
           and i.booking_time is not null
           and p.category_slug = v_cat.slug
           and o.status <> 'cancelado'
           and (i.booking_date + i.booking_time) < v_end
           and (i.booking_date + i.booking_time) + make_interval(mins => coalesce(p.duration_min, 60)) > v_start;
        if v_busy >= v_cat.slot_capacity then
          raise exception 'O horário das % de % acabou de ser reservado. Escolha outro.',
            to_char(v_time, 'HH24:MI'), to_char(v_date, 'DD/MM') using errcode = '22023';
        end if;
      end if;

      v_label := 'Sinal do horário · ' || to_char(v_date, 'DD/MM/YYYY') || ' · ' || to_char(v_time, 'HH24:MI');
      v_tone := null;
    else
      v_qty := greatest(1, least(50, coalesce((v_item ->> 'quantity')::int, 1)));

      if nullif(v_item ->> 'variant_id', '') is not null then
        select * into v_variant from public.product_variants
         where id = (v_item ->> 'variant_id')::uuid and product_id = v_product.id and active;
        if not found then
          raise exception 'A opção escolhida de "%" não está disponível.', v_product.name using errcode = '22023';
        end if;
        v_unit  := v_variant.price;
        v_label := v_variant.label;
        if v_variant.stock is not null then
          if v_variant.stock < v_qty then
            raise exception 'Só temos % unidade(s) de "% %".', v_variant.stock, v_product.name, v_variant.label using errcode = '22023';
          end if;
          update public.product_variants set stock = stock - v_qty where id = v_variant.id;
        end if;
      else
        if exists (select 1 from public.product_variants where product_id = v_product.id and active) then
          raise exception 'Escolha uma opção para "%".', v_product.name using errcode = '22023';
        end if;
        v_unit := v_product.price;
        if v_product.stock is not null then
          if v_product.stock < v_qty then
            raise exception 'Só temos % unidade(s) de "%".', v_product.stock, v_product.name using errcode = '22023';
          end if;
          update public.products set stock = stock - v_qty where id = v_product.id;
        end if;
      end if;

      if v_tone is not null and not (v_tone = any (v_product.tones)) then
        raise exception 'Tom indisponível para "%".', v_product.name using errcode = '22023';
      end if;
      if v_tone is null and cardinality(v_product.tones) > 0 then
        raise exception 'Escolha o tom de "%".', v_product.name using errcode = '22023';
      end if;
      if v_tone is not null then
        v_label := concat_ws(' · ', v_label, (select name from public.tones where slug = v_tone));
      end if;
    end if;

    insert into public.order_items (
      order_id, product_id, variant_id, kind, name, option_label, tone,
      unit_price, quantity, line_total, booking_date, booking_time
    ) values (
      v_order.id, v_product.id, v_variant.id, v_product.kind, v_product.name, v_label, v_tone,
      v_unit, v_qty, v_unit * v_qty, v_date, v_time
    );

    v_subtotal := v_subtotal + v_unit * v_qty;
  end loop;

  if v_fulfillment = 'entrega' then
    select * into v_settings from public.delivery_settings where id = 1;
    select * into v_quote from public.delivery_quotes
     where id = nullif(payload ->> 'quote_id', '')::uuid;
    if not found then
      raise exception 'Calcule o frete pelo CEP antes de finalizar.' using errcode = '22023';
    end if;
    if v_quote.expires_at < now() then
      raise exception 'A cotação de frete expirou. Calcule o frete novamente.' using errcode = '22023';
    end if;
    if not v_quote.within_area then
      raise exception 'Este CEP está fora da nossa área de entrega. Escolha retirar no salão.' using errcode = '22023';
    end if;
    if v_quote.cep <> v_cep then
      raise exception 'O CEP do endereço é diferente do CEP do frete. Calcule de novo.' using errcode = '22023';
    end if;
    v_fee := v_quote.fee;
    if v_settings.free_above is not null and v_subtotal >= v_settings.free_above then
      v_fee := 0;
    end if;
    if nullif(trim(coalesce(payload ->> 'address_number', '')), '') is null then
      raise exception 'Informe o número do endereço.' using errcode = '22023';
    end if;
  end if;

  update public.orders
     set subtotal     = v_subtotal,
         delivery_fee = v_fee,
         total        = v_subtotal + v_fee,
         quote_id     = case when v_fulfillment = 'entrega' then v_quote.id end,
         distance_km  = case when v_fulfillment = 'entrega' then v_quote.distance_km end,
         pix_txid     = code
   where id = v_order.id
   returning * into v_order;

  -- Completa o perfil da cliente logada com nome e WhatsApp, se faltarem
  if auth.uid() is not null then
    update public.profiles
       set full_name = coalesce(full_name, trim(payload ->> 'customer_name')),
           phone     = coalesce(phone, v_phone)
     where id = auth.uid();
  end if;

  return jsonb_build_object(
    'id',           v_order.id,
    'code',         v_order.code,
    'status',       v_order.status,
    'fulfillment',  v_order.fulfillment,
    'subtotal',     v_order.subtotal,
    'delivery_fee', v_order.delivery_fee,
    'total',        v_order.total,
    'pix_txid',     v_order.pix_txid
  );
end;
$$;

revoke all on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;

-- Consulta de status pelo cliente (código do pedido + WhatsApp usado na compra)
create or replace function public.order_status(p_code text, p_phone text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object('code', code, 'status', status, 'total', total, 'created_at', created_at)
    from public.orders
   where code = upper(trim(p_code))
     and customer_phone = regexp_replace(p_phone, '\D', '', 'g')
   limit 1;
$$;

revoke all on function public.order_status(text, text) from public;
grant execute on function public.order_status(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. SEGURANÇA (Row Level Security)
-- Catálogo: leitura pública.
-- Pedidos: a cliente vê os próprios; a equipe (role = 'admin') vê e
-- atualiza todos. Cotações: só pelo servidor.
-- ---------------------------------------------------------------------

alter table public.categories        enable row level security;
alter table public.tones             enable row level security;
alter table public.products          enable row level security;
alter table public.product_variants  enable row level security;
alter table public.transformations   enable row level security;
alter table public.delivery_settings enable row level security;
alter table public.delivery_quotes   enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.profiles          enable row level security;

drop policy if exists "categorias publicas" on public.categories;
create policy "categorias publicas" on public.categories
  for select to anon, authenticated using (active);

drop policy if exists "tons publicos" on public.tones;
create policy "tons publicos" on public.tones
  for select to anon, authenticated using (true);

drop policy if exists "produtos publicos" on public.products;
create policy "produtos publicos" on public.products
  for select to anon, authenticated using (active);

drop policy if exists "variacoes publicas" on public.product_variants;
create policy "variacoes publicas" on public.product_variants
  for select to anon, authenticated using (active);

drop policy if exists "antes e depois publicos" on public.transformations;
create policy "antes e depois publicos" on public.transformations
  for select to anon, authenticated using (active);

drop policy if exists "regras de frete publicas" on public.delivery_settings;
create policy "regras de frete publicas" on public.delivery_settings
  for select to anon, authenticated using (true);

drop policy if exists "pedidos da cliente ou da equipe" on public.orders;
create policy "pedidos da cliente ou da equipe" on public.orders
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "equipe atualiza pedidos" on public.orders;
create policy "equipe atualiza pedidos" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "itens da cliente ou da equipe" on public.order_items;
create policy "itens da cliente ou da equipe" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o
             where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
  );

drop policy if exists "perfil proprio ou equipe" on public.profiles;
create policy "perfil proprio ou equipe" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "editar perfil proprio" on public.profiles;
create policy "editar perfil proprio" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- A cliente só edita nome e WhatsApp; o papel (role) só muda pelo painel do Supabase
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- delivery_quotes fica sem política pública de propósito.

-- ---------------------------------------------------------------------
-- 9. STORAGE: bucket público para fotos dos produtos
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do nothing;

-- =====================================================================
-- DADOS INICIAIS (preços, durações e estoques de EXEMPLO)
-- Só entram se ainda não existirem: rodar de novo não apaga edições.
-- As imagens apontam para a pasta assets/ do site. Ao subir fotos no
-- bucket "produtos", troque image_url pela URL pública do arquivo.
-- =====================================================================

insert into public.delivery_settings
  (id, origin_label, origin_cep, origin_lat, origin_lng, base_fee, base_km, per_km, max_km, free_above, quote_ttl_min)
values
  (1, 'Calçada Flor de Lótus, 9 · Centro Comercial de Alphaville · Barueri/SP', '06453016',
   -23.4967, -46.8532, 8.00, 3, 2.00, 100, null, 60)
on conflict (id) do nothing;

insert into public.categories (slug, name, kind, description, sort, open_time, close_time, open_days) values
  ('mechas',     'Mechas de fios naturais', 'produto', 'Liso, ondulado e cacheado, por comprimento e tom.', 1, '08:00', '18:00', '{1,2,3,4,5,6}'),
  ('kits',       'Kits',                    'produto', 'Cuidados para o mega hair durar em casa.',          2, '08:00', '18:00', '{1,2,3,4,5,6}'),
  ('acessorios', 'Acessórios',              'produto', 'O que ajuda o fio a ficar no lugar.',              3, '08:00', '18:00', '{1,2,3,4,5,6}'),
  ('mega-hair',  'Mega Hair',               'servico', null, 10, '08:00', '18:00', '{1,2,3,4,5,6}'),
  ('cabelo',     'Cabelo',                  'servico', null, 11, '08:00', '18:00', '{1,2,3,4,5,6}'),
  ('unhas',      'Unhas',                   'servico', null, 12, '08:00', '18:00', '{1,2,3,4,5,6}')
on conflict (slug) do nothing;

insert into public.tones (slug, name, color_a, color_b, sort) values
  ('castanho-escuro', 'Castanho escuro', '#2b1a12', '#5a3a26', 1),
  ('castanho-claro',  'Castanho claro',  '#5e3b22', '#9a6a3f', 2),
  ('mel',             'Mel',             '#8a5a2b', '#d9a35b', 3),
  ('loiro',           'Loiro',           '#c79a5c', '#f1d9a6', 4)
on conflict (slug) do nothing;

insert into public.products
  (slug, category_slug, kind, name, description, price, deposit, duration_min, texture, tones, image_url, hover_image_url, badge, featured, sort)
values
  -- Mechas (o preço final vem da variação de comprimento)
  ('mecha-lisa', 'mechas', 'produto', 'Mecha lisa',
   'Fios naturais lisos, prontos para aplicação fio a fio. Pacote de 50 g.',
   349.00, null, null, 'liso', array['castanho-escuro','castanho-claro','mel','loiro'],
   'assets/instagram/resultado-liso.jpg', null, null, true, 1),
  ('mecha-ondulada', 'mechas', 'produto', 'Mecha ondulada',
   'Fios naturais com onda aberta e caimento leve. Pacote de 50 g.',
   379.00, null, null, 'ondulado', array['castanho-claro','mel','loiro'],
   'assets/instagram/resultado-ondulado.jpg', null, null, true, 2),
  ('mecha-cacheada', 'mechas', 'produto', 'Mecha cacheada',
   'Fios naturais cacheados, com cachos definidos do comprimento à ponta. Pacote de 50 g.',
   399.00, null, null, 'cacheado', array['castanho-escuro','mel','loiro'],
   'assets/instagram/resultado-cacheado.jpg', null, null, true, 3),

  -- Kits
  ('kit-manutencao-em-casa', 'kits', 'produto', 'Kit manutenção em casa',
   'Shampoo suave, máscara de reconstrução e leave-in para lavar o mega hair sem embaraçar.',
   189.00, null, null, null, '{}', 'assets/produtos/kit-manutencao.svg', null, null, false, 10),
  ('kit-pos-aplicacao', 'kits', 'produto', 'Kit pós-aplicação',
   'Shampoo e condicionador sem sal para as primeiras semanas depois da aplicação.',
   129.00, null, null, null, '{}', 'assets/produtos/kit-pos-aplicacao.svg', null, null, false, 11),
  ('kit-cachos', 'kits', 'produto', 'Kit cachos definidos',
   'Creme de pentear e ativador para mega hair ondulado e cacheado.',
   159.00, null, null, null, '{}', 'assets/produtos/kit-cachos.svg', null, null, false, 12),

  -- Acessórios
  ('escova-mega-hair', 'acessorios', 'produto', 'Escova para mega hair',
   'Cerdas macias com pontas protegidas, desembaraça sem puxar os pontos.',
   69.00, null, null, null, '{}', 'assets/produtos/escova.svg', null, null, false, 20),
  ('touca-cetim', 'acessorios', 'produto', 'Touca de cetim',
   'Para dormir sem frizz e sem embaraçar o comprimento.',
   49.00, null, null, null, '{}', 'assets/produtos/touca.svg', null, null, false, 21),
  ('fronha-cetim', 'acessorios', 'produto', 'Fronha de cetim',
   'Menos atrito no travesseiro, menos nós pela manhã.',
   79.00, null, null, null, '{}', 'assets/produtos/fronha.svg', null, null, false, 22),
  ('presilhas-profissionais', 'acessorios', 'produto', 'Presilhas profissionais',
   'Kit com 6 presilhas para separar mechas na finalização.',
   29.00, null, null, null, '{}', 'assets/produtos/presilhas.svg', null, null, false, 23),

  -- Serviços (price = "a partir de", pago no salão; deposit = sinal via Pix)
  ('reserva-de-horario', 'mega-hair', 'servico', 'Avaliação e reserva de horário',
   'Ainda não sabe o que fazer? Reserve o horário e a equipe avalia com você no salão.',
   0.00, 50.00, 30, null, '{}', 'assets/instagram/equipe-salao.jpg', null, null, true, 0),
  ('aplicacao-mega-hair', 'mega-hair', 'servico', 'Aplicação de mega hair fio a fio',
   'Aplicação fio a fio com a técnica da casa, integrada aos seus fios.',
   1200.00, 50.00, 240, null, '{}', 'assets/instagram/aplicacao-cacheado.jpg', null, null, true, 1),
  ('manutencao-mega-hair', 'mega-hair', 'servico', 'Manutenção de mega hair',
   'Reposicionamento dos pontos para manter a naturalidade.',
   350.00, 50.00, 180, null, '{}', 'assets/instagram/manutencao-loiro.jpg', null, null, false, 2),
  ('remocao-mega-hair', 'mega-hair', 'servico', 'Remoção de mega hair',
   'Retirada cuidadosa, sem quebrar os seus fios.',
   150.00, 50.00, 90, null, '{}', null, null, null, false, 3),
  ('corte-feminino', 'cabelo', 'servico', 'Corte feminino', null, 120.00, 50.00, 60,  null, '{}', null, null, null, false, 10),
  ('escova',         'cabelo', 'servico', 'Escova',          null, 70.00,  50.00, 45,  null, '{}', null, null, null, false, 11),
  ('hidratacao',     'cabelo', 'servico', 'Hidratação e reconstrução', null, 110.00, 50.00, 60, null, '{}', null, null, null, false, 12),
  ('coloracao',      'cabelo', 'servico', 'Coloração',       null, 180.00, 50.00, 120, null, '{}', null, null, null, false, 13),
  ('luzes',          'cabelo', 'servico', 'Luzes',           null, 450.00, 50.00, 240, null, '{}', 'assets/instagram/tonalizacao-processo.jpg', null, null, false, 14),
  ('progressiva',    'cabelo', 'servico', 'Progressiva',     null, 320.00, 50.00, 180, null, '{}', 'assets/instagram/resultado-liso.jpg', null, null, false, 15),
  ('manicure',       'unhas',  'servico', 'Manicure',        null, 45.00,  50.00, 45,  null, '{}', null, null, null, false, 20),
  ('pedicure',       'unhas',  'servico', 'Pedicure',        null, 55.00,  50.00, 50,  null, '{}', null, null, null, false, 21),
  ('pe-e-mao',       'unhas',  'servico', 'Pé e mão',        null, 90.00,  50.00, 90,  null, '{}', null, null, null, false, 22)
on conflict (slug) do nothing;

-- Variações de comprimento das mechas (pacote de 50 g)
insert into public.product_variants (product_id, sku, label, length_cm, grams, price, sort)
select p.id, v.sku, v.label, v.length_cm, 50, v.price, v.sort
  from (values
    ('mecha-lisa',     'LISA-50',     '50 cm · 50 g', 50, 349.00, 1),
    ('mecha-lisa',     'LISA-60',     '60 cm · 50 g', 60, 419.00, 2),
    ('mecha-lisa',     'LISA-70',     '70 cm · 50 g', 70, 499.00, 3),
    ('mecha-ondulada', 'ONDULADA-50', '50 cm · 50 g', 50, 379.00, 1),
    ('mecha-ondulada', 'ONDULADA-60', '60 cm · 50 g', 60, 449.00, 2),
    ('mecha-ondulada', 'ONDULADA-70', '70 cm · 50 g', 70, 529.00, 3),
    ('mecha-cacheada', 'CACHEADA-50', '50 cm · 50 g', 50, 399.00, 1),
    ('mecha-cacheada', 'CACHEADA-60', '60 cm · 50 g', 60, 469.00, 2),
    ('mecha-cacheada', 'CACHEADA-70', '70 cm · 50 g', 70, 549.00, 3)
  ) as v(product_slug, sku, label, length_cm, price, sort)
  join public.products p on p.slug = v.product_slug
on conflict (sku) do nothing;

-- Foto de cada tom das mechas. "simulado": true marca as cores geradas
-- digitalmente; troque por fotos reais quando tiver (e mude para false).
update public.products set tone_images = '{
  "castanho-escuro": {"url": "assets/instagram/tons/mecha-lisa-castanho-escuro.jpg", "simulado": true},
  "castanho-claro":  {"url": "assets/instagram/resultado-liso.jpg", "simulado": false},
  "mel":             {"url": "assets/instagram/tons/mecha-lisa-mel.jpg", "simulado": true},
  "loiro":           {"url": "assets/instagram/manutencao-loiro.jpg", "simulado": false}
}'::jsonb where slug = 'mecha-lisa' and tone_images = '{}'::jsonb;

update public.products set tone_images = '{
  "castanho-claro": {"url": "assets/instagram/tons/mecha-ondulada-castanho-claro.jpg", "simulado": true},
  "mel":            {"url": "assets/instagram/resultado-ondulado.jpg", "simulado": false},
  "loiro":          {"url": "assets/instagram/tons/mecha-ondulada-loiro.jpg", "simulado": true}
}'::jsonb where slug = 'mecha-ondulada' and tone_images = '{}'::jsonb;

update public.products set tone_images = '{
  "castanho-escuro": {"url": "assets/instagram/tons/mecha-cacheada-castanho-escuro.jpg", "simulado": true},
  "mel":             {"url": "assets/instagram/resultado-cacheado.jpg", "simulado": false},
  "loiro":           {"url": "assets/instagram/tons/mecha-cacheada-loiro.jpg", "simulado": true}
}'::jsonb where slug = 'mecha-cacheada' and tone_images = '{}'::jsonb;

-- Antes & depois: cadastre pares REAIS da mesma cliente, por exemplo:
-- insert into public.transformations (title, before_url, after_url, sort)
-- values ('Curto para longo cacheado', 'https://.../antes.jpg', 'https://.../depois.jpg', 1);

-- Painel da equipe: só mayconfdacosta@gmail.com (tabela painel_emails).
-- Crie esse usuário em Authentication > Users > Add user, com a senha
-- escolhida e "Auto Confirm User" marcado. Veja o passo 6 do guia.
