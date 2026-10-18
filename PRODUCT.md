# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JS (user's choice) with Supabase for data (PostgreSQL + RLS), an Edge Function for delivery quotes, and Pix copia-e-cola for payment. No build step.

## Users

Women in Alphaville/Barueri and the São Paulo region who follow @adelia_cabelos on Instagram and want mega hair, salon services or hair-care products. They arrive mostly from Instagram, on the phone, deciding between buying extensions/kits and booking a salon slot.

## Product Purpose

Online store and booking entry for Adélia & Guga Mega Hair: sell natural-hair extensions, called "fios naturais" in all customer copy (by texture, tone and length), maintenance kits and accessories; take R$ 50 Pix deposits that hold a salon slot; quote delivery by driving distance from the salon.

## Positioning

A real salon in the Centro Comercial de Alphaville known for mega hair applied "fio a fio" so it blends with the client's own hair ("É o cabelo dela?"). The store is the salon itself: same team, same mirrors, same results shown on Instagram.

## Operating Context

- Address (user-confirmed, replaces the Calçada das Tulipas address from the Instagram caption): Calçada Flor de Lótus, 9 · Centro Comercial de Alphaville · Barueri/SP · CEP 06453-016 (origin of every delivery quote; lat -23.4967, lng -46.8532).
- Bookings already run through WhatsApp with a R$ 50 Pix deposit (from the Instagram caption of post DSPjt8YATY_).
- Delivery rule (user-confirmed): R$ 8,00 up to 3 km + R$ 2,00 per extra km, max radius 100 km (raised from 40 km on 2026-10-18); editable in `delivery_settings`.
- Accounts (user-confirmed): customer login and signup page (entrar.html) with e-mail/password, password recovery, optional Google and Microsoft; logged-in orders are linked to the account.
- Staff panel (user-confirmed): opened by triple-clicking the store logo (painel.html); lists all orders and the booking agenda; access restricted to the single e-mail mayconfdacosta@gmail.com (table painel_emails, confirmed e-mail required); the password lives only in Supabase Auth, never in site code.
- Booking (user-confirmed): hourly slots during business hours, 08:00–18:00 (manicure and pedicure explicitly), Monday–Saturday assumed; only slots where the full service duration fits are offered.
- Support: a WhatsApp support tab with preset topics (mechas, pedido, agenda, entrega, Pix) and free text.
- Tone photos: choosing a tone swaps the hair photo; colors without a real photo are digital simulations and are labeled "simulação".
- Checkout (user-confirmed): order saved in Supabase, then static Pix copia-e-cola with the order code as txid; staff confirms payment manually.

## Capabilities and Constraints

- Catalog (user-confirmed scope): natural-hair extensions ("fios naturais"), kits and accessories, common salon services (mega hair application/maintenance/removal, cut, blow-dry, hydration, coloring, highlights, progressive straightening, manicure, pedicure) and the R$ 50 booking deposit.
- Prices, durations and stock in the seed are examples until the salon sets real ones.
- Open decisions: Pix key; whether the R$ 50 deposit is deducted from the service price; salon opening hours; whether 11 96707-9499 is the customer WhatsApp.

## Brand Commitments

- Logo: gold woman silhouette with "Adélia & Guga · mega hair" on petrol green (#013437). Colors and identity derive from it (user instruction).
- Voice: warm, close, Portuguese of the salon's own captions ("deixar tudo certinho", "tomar um café conosco").
- Hero background: the salon interior photo with a sun-orange gradient at reduced opacity (user instruction).

## Evidence on Hand

- `assets/instagram/`: 12 public post covers from @adelia_cabelos (results, process, team, TV appearance), 360×640.
- `assets/salao.jpg`: salon interior photo supplied by the user (480×360, carries the ULHÔA interior-design watermark).
- Press: Adélia on "Momentos com Sonia Apolonio" (ComBrasil TV), from the account's own posts.
- Absent, must not be fabricated: real before/after pairs of the same client, product photos for kits and accessories, testimonials, opening hours.

## Product Principles

1. Show real results from the salon before asking for anything.
2. Every price the customer pays is computed on the server (order RPC + stored delivery quote).
3. Booking stays as simple as the WhatsApp flow it replaces: pick date and period, pay the deposit, staff confirms.
4. Phone first: most visitors come from Instagram.
