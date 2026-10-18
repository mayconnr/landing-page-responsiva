---
name: Adélia & Guga Mega Hair
description: Salon store where every photo and product sits inside the salon's own LED-rimmed oval mirror.
colors:
  petrol: "#013437"
  petrol-deep: "#01262a"
  petrol-ink: "#00191c"
  petrol-700: "#0c4a4c"
  mint: "#a8dccf"
  mint-300: "#9fd3c7"
  mint-200: "#cfe9e1"
  mint-100: "#e5f3ee"
  mint-50: "#f3faf7"
  led: "#c4f5ea"
  gold-200: "#f6e3ae"
  gold-300: "#ecd08a"
  gold-400: "#d9b665"
  gold-500: "#c09445"
  gold-600: "#96702b"
  sun-500: "#ff8a1a"
  sun-600: "#e86b0c"
  ember: "#5a1f06"
  ivory: "#fbf6ec"
  ink: "#062b2d"
  ink-soft: "#2f5557"
  error: "#a3360c"
typography:
  display:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4.2vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.02em"
  hero:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "clamp(2.9rem, 5.6vw, 4.6rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "0.78125rem"
    fontWeight: 700
    letterSpacing: "0.07em"
rounded:
  s: "10px"
  m: "18px"
  l: "28px"
  pill: "999px"
spacing:
  gutter: "clamp(16px, 4vw, 40px)"
  section: "clamp(72px, 9vw, 128px)"
  maxw: "1240px"
components:
  button-gold:
    textColor: "{colors.petrol-ink}"
    rounded: "{rounded.pill}"
    height: "48px"
    padding: "0 8px 0 24px"
  button-petrol:
    backgroundColor: "{colors.petrol}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.pill}"
    height: "48px"
  button-ghost:
    textColor: "{colors.ivory}"
    rounded: "{rounded.pill}"
    height: "48px"
  button-add:
    backgroundColor: "{colors.petrol}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.pill}"
    height: "46px"
  card-product:
    backgroundColor: "{colors.mint-50}"
    rounded: "{rounded.l}"
    padding: "10px 10px 18px"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "14px"
    height: "52px"
---

# Design System: Adélia & Guga Mega Hair

## Overview

**Creative North Star: "O espelho do salão"**

The store is the salon floor. Every photo in the salon's Instagram shows the same objects: oval mirrors with a cool LED rim, mint-teal walls, bottle-green leather chairs and the gold logo on petrol green. The interface is built from those objects, so a visitor who already follows @adelia_cabelos recognizes the place before reading a word.

Petrol green from the logo is the ground of the dark sections; the salon's mint walls carry the light sections; metallic gold is reserved for type, hairlines and the primary action. The hero shows the salon photo in its real colors, slightly blurred under a neutral petrol-ink shade (the client removed the earlier orange tint on 2026-10-18); sun orange survives only as a small signal color. One family, Montserrat (the client's choice), carries everything: extra-bold capitals with tight tracking for headlines, regular weight for calm, legible body copy.

**Key Characteristics:**
- Stadium and arch frames (the oval mirror) around every photo and product.
- Thin LED rim in `led` mint on the hero mirrors, traced once on arrival.
- Gold-foil primary buttons with a glint on hover; petrol secondary buttons with a gold sweep.
- Two-tone display headlines: ivory or petrol line, gold line.
- Real salon photos from Instagram; illustrated product art only where no photo exists.

## Colors

A petrol-and-gold brand palette from the logo, opened up by the salon's mint walls and lit by one sun-orange gradient.

### Primary
- **Logo Petrol** (#013437): dark section grounds, primary text color on light sections, petrol buttons, selected states.
- **Metallic Gold** (#d9b665 / #ecd08a): display headings on petrol, prices on petrol, primary buttons (as the `gold-foil` gradient), focus color on dark surfaces.

### Secondary
- **Salon Mint** (#e5f3ee / #cfe9e1 / #a8dccf): light section grounds and the inside of product arches.
- **LED Mint** (#c4f5ea): the mirror rim light only.

### Tertiary
- **Sol** (#ff8a1a): the cart count badge, the input caret and the customer's dot on the delivery radar. Not used in the hero.

### Neutral
- **Ivory** (#fbf6ec): text on petrol and on the hero.
- **Ink** (#062b2d) and **Ink Soft** (#2f5557): body and secondary text on mint.
- **Petrol Ink** (#00191c): footer, text on gold, mirror bezels.

### Named Rules
**The Signal Orange Rule.** Orange marks the customer (their position on the radar, their cart count). It never tints a photo, becomes a section ground or a button color.

**The Real Salon Rule.** The hero photo keeps its real colors: only a slight blur and a neutral petrol-ink shade behind the text, never a color wash.

**The Gold Means Act Rule.** Gold fills belong to the primary action in each region; elsewhere gold is type or a 1px line.

## Typography

**Font:** Montserrat variable, 400–900 (fallback system-ui), for display, text and labels alike. Chosen by the client on 2026-10-18; it replaced Anton + Archivo.

**Character:** wide geometric capitals at 800 with slightly negative tracking give the headlines weight without condensing; the same family at 400–500 keeps body copy open and friendly.

### Hierarchy
- **Hero** (800, clamp(2.9rem, 5.6vw, 4.6rem), 0.98, -0.025em, uppercase): the first viewport headline only, two lines, second line gold.
- **Display** (800, clamp(2rem, 4.2vw, 3.5rem), 1.04, -0.02em, uppercase): section headings.
- **Path title** (800, clamp(1.9rem, 3vw, 2.6rem), uppercase): path cards. **Group title** (800, 1.35–1.75rem, uppercase): service groups.
- **Title** (700, 1.0625rem): product and service names.
- **Body** (400, 1rem, 1.65): copy, max ~58ch.
- **Label** (700, 0.75–0.8125rem, 0.06–0.1em tracking, uppercase): buttons, chips, option legends, tags.

Because Montserrat is wide, headline sizes are capped lower than a condensed face would allow; check long words ("ACESSÓRIOS", "SERVIÇOS E VALORES") at 320px width before raising them.

### Named Rules
**The No Eyebrow Rule.** Headings stand alone; no small label sits above a heading.

## Layout

Centered 1240px container with a fluid gutter (16–40px) and section padding of 72–128px. The hero is full-bleed and pulls up under the sticky header; the three path cards overlap its lower edge by ~118px. Two-column split sections (services, before & after, delivery) align their copy column to the center seam and collapse to one column under 860px. The product grid auto-fills at 268px minimum and becomes two compact columns under 640px. Path cards become a horizontal snap row on small screens.

## Elevation & Depth

Depth comes from the mirror bezel (dark gradient frame plus a 1px gold hairline) and soft, offset shadows: `0 1px 2px rgba(0,25,28,.1), 0 10px 24px -14px rgba(0,25,28,.35)` at rest, `0 2px 6px rgba(0,25,28,.12), 0 28px 48px -22px rgba(0,25,28,.55)` when lifted. Cards rise 5px on hover. The only glow is the LED rim, because it is the material being depicted.

## Shapes

- **Mirror stadium** (`border-radius: 999px`): hero mirrors.
- **Arch** (`50% 50% 18px 18px / 40% 40% 18px 18px`): product media, salon and press frames, Instagram covers (alternating with 28px rectangles).
- **Pill**: every button, chip and segmented control.
- Radii scale: 10 / 18 / 28px for panels and cards.

## Components

### Buttons
- **Gold** (primary): gold-foil gradient, petrol-ink label, round petrol icon disc on the right; hover shifts the foil and runs a white glint across.
- **Petrol** (secondary on light): petrol fill, ivory label; hover sweeps gold in from the left.
- **Ghost** (secondary on dark): 1.5px ivory ring; hover fills ivory.
- **Outline** (tertiary on light): petrol ring; hover fills petrol with gold label.
- **Adicionar** (product): petrol pill; gold fills from the pointer position on hover; on add, the label slides up, a check draws in and a gold dot flies to the bag, which bumps.
- **Round arrow**: 46px gold disc on path cards, rotates 45° on hover.

### Chips and segmented controls
- Category filter: white pill track with a sliding petrol thumb; active label gold.
- Texture chips: outlined pills; active is gold fill.

### Cards / Containers
- **Product card**: mint-50 panel, 28px radius, arch media with an inner gold hairline, tone swatches drawn as hair strands, length segments, price with tabular numerals.
- **Menu row** (services): name, duration and deposit on the left, "a partir de" price in gold, outlined "Reservar"; a gold rule sweeps along the bottom on hover.

### Inputs / Fields
- White, 52px, 14px radius, 1.5px petrol border at 24%; focus is a petrol border plus a 4px gold ring; caret in sun orange; errors in brick red with a message under the field.

### Navigation
- Sticky header, transparent over the hero, solid petrol after 24px of scroll. Links are uppercase labels with a gold underline that draws on hover and marks the current section. Under 1080px the links move into a petrol dropdown.

### Mirror (signature)
- Stadium frame with a dark bezel, gold hairline and an inner LED ring that traces itself once via a conic-gradient sweep. Three mirrors fan out in the hero (cacheado, ondulado, liso) and act as texture filters for the shop.

### Delivery radar (signature)
- Petrol disc with gold distance rings on a square-root scale (3 km base ring filled, intermediate rings at 10/25/50 km, the 100 km limit ring solid), a slow gold sweep, the salon at the center and the customer's CEP plotted at its real bearing and road distance in sun orange, labeled beside the dot.

### Tone swap (mechas)
- Choosing a tone swaps the arch photo: the new photo enters blurred and slightly enlarged and settles over the old one (0.6–0.9s). Simulated colors carry a small mint "simulação" pill next to the tone name.

### Section arrival
- Internal links glide with an ease-in-out scroll (0.7–1.5s, interruptible by wheel, touch or keys). On arrival the section's display heading rises and draws a gold-foil underline that fades out; the Agenda path also rings the "Reservar avaliação" button.

### Login page (entrar.html)
- Client reference: split layout on desktop (mint-50 form panel left, layered paper-cut waves in four mint tints with soft offset shadows revealing a dark palm-leaf photo on the right, plus a corner wave bottom-right); on phones the leaves fill the screen and the form sits on a translucent mint card (the one place glass is used, because the reference asks for it). Pill inputs, petrol pill primary button, Google/Microsoft pill buttons with their own brand marks.

### Staff panel (painel.html)
- Client reference: dark petrol-black ground (#071413), header with logo, refresh and "Sair"; a pill tab switch whose active side is gold foil (the brand's answer to the reference's yellow); dashed empty state with a gold coffee icon. Order cards and agenda rows on #0d1e1d surfaces with gold hairlines; status chips in amber (waiting), mint (in progress), grey (done), coral (cancelled).

### Booking slots
- Hour chips in a grid, mint at rest, petrol with gold text when selected (same language as the old period segmented control); unavailable hours are struck through at 40% opacity.

### Support tab
- Fixed bottom-right pill (petrol-ink, gold-foil icon disc, "Suporte" label; icon-only on phones). Opens a mint panel with a petrol header, five preset WhatsApp topics and a free-text field; the icon morphs into a close mark while open.

## Do's and Don'ts

### Do:
- **Do** frame every photo in a stadium or arch; the mirror is the brand.
- **Do** keep sun orange to the cart count, the caret and the radar dot.
- **Do** compute prices and delivery fees on the server (order RPC + stored quote).
- **Do** use real salon photos; mark illustrated product art as temporary until real photos exist.

### Don't:
- **Don't** put an eyebrow or kicker above a heading.
- **Don't** use gradient-filled text; gold headings are solid `gold-300`/`gold-400`.
- **Don't** show before & after pairs that are not the same client.
- **Don't** use emoji or text glyphs as icons; icons come from the inline SVG sprite (1.8 stroke).
