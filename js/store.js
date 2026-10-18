/*
 * Dados da loja: catálogo, frete por CEP, carrinho e pedidos.
 * Com Supabase configurado, tudo passa pelo banco e pela Edge Function.
 * Sem Supabase, roda em modo demonstração com o catálogo local.
 */
window.AGStore = (function () {
  const cfg = window.AG_CONFIG;
  const sb = cfg.supabase || {};
  const hasSupabase = Boolean(sb.url && sb.anonKey);
  const baseUrl = String(sb.url || "").replace(/\/+$/, "");

  class UserError extends Error {}

  const digits = (v) => String(v || "").replace(/\D/g, "");
  const round = (n, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

  /* ---------- Supabase (REST, sem SDK) ---------- */

  function headers(token) {
    const h = { apikey: sb.anonKey, "Content-Type": "application/json" };
    if (token) h.Authorization = "Bearer " + token;
    else if (String(sb.anonKey).startsWith("eyJ")) h.Authorization = "Bearer " + sb.anonKey;
    return h;
  }

  // Token da cliente logada (o pedido fica ligado à conta dela)
  async function userToken() {
    try { return window.AGAuth ? await window.AGAuth.accessToken() : null; } catch { return null; }
  }

  async function rest(path) {
    const res = await fetch(`${baseUrl}/rest/v1/${path}`, { headers: headers() });
    if (!res.ok) throw new Error(`Supabase ${res.status} em ${path}`);
    return res.json();
  }

  /* ---------- Catálogo ---------- */

  let demo = !hasSupabase;
  let demoReason = hasSupabase ? null : "config";
  let catalog = null;

  function normalize(raw) {
    const products = raw.products.map((p) => ({
      ...p,
      price: Number(p.price),
      deposit: p.deposit === null || p.deposit === undefined ? null : Number(p.deposit),
      tones: p.tones || [],
      tone_images: p.tone_images && typeof p.tone_images === "object" ? p.tone_images : {},
      variants: (p.variants || p.product_variants || [])
        .filter((v) => v.active !== false)
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.price - b.price)
        .map((v) => ({ ...v, price: Number(v.price) })),
    }));
    const d = raw.delivery;
    return {
      categories: raw.categories,
      tones: raw.tones,
      products,
      transformations: raw.transformations || [],
      delivery: {
        ...d,
        base_fee: Number(d.base_fee),
        base_km: Number(d.base_km),
        per_km: Number(d.per_km),
        max_km: Number(d.max_km),
        free_above: d.free_above === null || d.free_above === undefined ? null : Number(d.free_above),
        origin_lat: Number(d.origin_lat),
        origin_lng: Number(d.origin_lng),
      },
    };
  }

  async function loadCatalog() {
    if (hasSupabase) {
      try {
        const [categories, tones, products, transformations, delivery] = await Promise.all([
          rest("categories?select=*&order=sort.asc"),
          rest("tones?select=*&order=sort.asc"),
          rest("products?select=*,product_variants(*)&order=sort.asc"),
          rest("transformations?select=*&order=sort.asc"),
          rest("delivery_settings?select=*&id=eq.1"),
        ]);
        if (!delivery[0]) throw new Error("delivery_settings vazio");
        catalog = normalize({ categories, tones, products, transformations, delivery: delivery[0] });
        dropStaleBookings();
        return catalog;
      } catch (err) {
        console.warn("[Adélia & Guga] Supabase indisponível, usando catálogo de exemplo.", err);
        demo = true;
        demoReason = "offline";
      }
    }
    catalog = normalize(window.AG_CATALOG);
    if (!hasSupabase) catalog.transformations = window.AG_CATALOG.transformations;
    dropStaleBookings();
    return catalog;
  }

  // Reservas salvas antes dos horários de hora em hora não têm horário: saem da sacola
  function dropStaleBookings() {
    const before = cart.items.length;
    cart.items = cart.items.filter((i) => {
      const p = product(i.product_id);
      return p && (p.kind !== "servico" || i.booking_time);
    });
    if (cart.items.length !== before) save();
  }

  /* ---------- Agenda ---------- */

  const category = (slug) => catalog.categories.find((c) => c.slug === slug);
  const toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
  const fromMin = (n) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

  // Horários de hora em hora em que o serviço cabe inteiro dentro do atendimento
  function slotsFor(p, isoDate) {
    const c = category(p.category_slug) || {};
    const open = toMin(c.open_time || "08:00");
    const close = toMin(c.close_time || "18:00");
    const days = c.open_days || [1, 2, 3, 4, 5, 6];
    const [y, mo, d] = isoDate.split("-").map(Number);
    const dow = ((new Date(y, mo - 1, d).getDay() + 6) % 7) + 1; // 1 = segunda … 7 = domingo
    const dur = p.duration_min || 60;
    const info = { open: fromMin(open), close: fromMin(close), days, closed: !days.includes(dow), capacity: c.slot_capacity || null, slots: [] };
    if (info.closed) return info;
    const now = new Date();
    const isToday = now.getFullYear() === y && now.getMonth() === mo - 1 && now.getDate() === d;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (let t = open; t + dur <= close; t += 60) {
      info.slots.push({ time: fromMin(t), past: isToday && t <= nowMin });
    }
    return info;
  }

  // Ocupação por hora (só quando a categoria tem limite de clientes)
  async function occupancy(categorySlug, isoDate) {
    if (demo) return {};
    try {
      const res = await fetch(`${baseUrl}/rest/v1/rpc/horarios_ocupados`, {
        method: "POST", headers: headers(), body: JSON.stringify({ p_date: isoDate, p_category: categorySlug }),
      });
      if (!res.ok) return {};
      const rows = await res.json();
      return Object.fromEntries(rows.map((r) => [String(r.hora).slice(0, 5), { busy: r.ocupados, capacity: r.capacidade }]));
    } catch {
      return {};
    }
  }

  const product = (id) => catalog.products.find((p) => p.id === id);
  const tone = (slug) => catalog.tones.find((t) => t.slug === slug);

  // Foto do produto no tom escolhido. Aceita { url, simulado } ou só a URL (foto real).
  function toneImage(p, slug) {
    const v = slug && p.tone_images ? p.tone_images[slug] : null;
    if (!v) return { url: p.image_url, simulado: false };
    return typeof v === "string" ? { url: v, simulado: false } : { url: v.url || p.image_url, simulado: Boolean(v.simulado) };
  }

  // Tom que abre selecionado: o da foto principal, se houver; senão o primeiro
  function defaultTone(p) {
    const match = p.tones.find((slug) => toneImage(p, slug).url === p.image_url && !toneImage(p, slug).simulado);
    return match || p.tones[0] || null;
  }

  /* ---------- Frete ---------- */

  function feeFor(km, rule) {
    if (km > rule.max_km) return null;
    return round(rule.base_fee + Math.max(0, km - rule.base_km) * rule.per_km);
  }

  async function getJson(url, ms = 8000) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function lookupCep(cep) {
    const b = await getJson(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    if (b && b.city) {
      const c = (b.location && b.location.coordinates) || {};
      return {
        street: b.street || null, district: b.neighborhood || null, city: b.city, state: b.state,
        lat: parseFloat(c.latitude) || null, lng: parseFloat(c.longitude) || null,
      };
    }
    const v = await getJson(`https://viacep.com.br/ws/${cep}/json/`);
    if (v && !v.erro && v.localidade) {
      return { street: v.logradouro || null, district: v.bairro || null, city: v.localidade, state: v.uf, lat: null, lng: null };
    }
    return null;
  }

  async function geocode(a, cep) {
    const base = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br";
    const tries = [
      a.street && `${base}&street=${encodeURIComponent(a.street)}&city=${encodeURIComponent(a.city)}&state=${encodeURIComponent(a.state)}`,
      `${base}&postalcode=${cep.slice(0, 5)}-${cep.slice(5)}`,
      a.district && `${base}&q=${encodeURIComponent(`${a.district}, ${a.city}, ${a.state}`)}`,
      `${base}&city=${encodeURIComponent(a.city)}&state=${encodeURIComponent(a.state)}`,
    ].filter(Boolean);
    for (const url of tries) {
      const r = await getJson(url);
      if (Array.isArray(r) && r[0]) return { lat: parseFloat(r[0].lat), lng: parseFloat(r[0].lon) };
    }
    return null;
  }

  function haversineKm(a, b) {
    const rad = (d) => (d * Math.PI) / 180;
    const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }

  // Mesmo cálculo da Edge Function, para o modo demonstração
  async function localQuote(cep) {
    const rule = catalog.delivery;
    const address = await lookupCep(cep);
    if (!address) throw new UserError("Não encontramos esse CEP. Confira os números.");
    let point = address.lat && address.lng ? { lat: address.lat, lng: address.lng } : await geocode(address, cep);
    if (!point) throw new UserError("Não conseguimos localizar esse endereço agora. Tente de novo em instantes.");
    const origin = { lat: rule.origin_lat, lng: rule.origin_lng };
    const r = await getJson(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${point.lng},${point.lat}?overview=false`);
    const route = r && r.code === "Ok" && r.routes && r.routes[0];
    const km = round(route ? route.distance / 1000 : haversineKm(origin, point) * 1.3, 1);
    const fee = feeFor(km, rule);
    return {
      quote_id: "local-" + Date.now(),
      cep,
      address: { street: address.street, district: address.district, city: address.city, state: address.state },
      point, origin,
      distance_km: km,
      duration_min: route ? Math.round(route.duration / 60) : null,
      method: route ? "rota" : "linha_reta",
      fee,
      within_area: fee !== null,
      rule: { base_fee: rule.base_fee, base_km: rule.base_km, per_km: rule.per_km, max_km: rule.max_km, free_above: rule.free_above },
      expires_at: new Date(Date.now() + (rule.quote_ttl_min || 60) * 60000).toISOString(),
    };
  }

  async function quoteFreight(cepInput) {
    const cep = digits(cepInput);
    if (cep.length !== 8) throw new UserError("Digite os 8 números do CEP, como 06454-000.");
    let quote;
    if (!demo) {
      let res;
      try {
        res = await fetch(`${baseUrl}/functions/v1/calcular-frete`, {
          method: "POST", headers: headers(), body: JSON.stringify({ cep }),
        });
      } catch {
        throw new UserError("Sem conexão com o servidor de frete. Verifique sua internet e tente de novo.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new UserError(data.error || "Não foi possível calcular o frete agora.");
      quote = data;
    } else {
      quote = await localQuote(cep);
    }
    cart.quote = quote;
    save();
    return quote;
  }

  /* ---------- Carrinho ---------- */

  const CART_KEY = "ag-cart-v1";
  const cart = load();
  const listeners = new Set();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || "null");
      if (raw && Array.isArray(raw.items)) return { fulfillment: "entrega", quote: null, ...raw };
    } catch { /* armazenamento indisponível */ }
    return { items: [], fulfillment: "entrega", quote: null };
  }

  function save() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* modo privado */ }
    listeners.forEach((fn) => fn(cart));
  }

  const lineKey = (i) => [i.product_id, i.variant_id, i.tone, i.booking_date, i.booking_time].join("|");

  function add(item) {
    const p = product(item.product_id);
    if (!p) return;
    const entry = { quantity: 1, ...item };
    if (p.kind === "servico") entry.quantity = 1;
    const key = lineKey(entry);
    const found = cart.items.find((i) => lineKey(i) === key);
    if (found && p.kind === "produto") found.quantity = Math.min(50, found.quantity + entry.quantity);
    else if (!found) cart.items.push(entry);
    save();
  }

  function setQty(index, qty) {
    const item = cart.items[index];
    if (!item) return;
    if (qty <= 0) cart.items.splice(index, 1);
    else item.quantity = Math.min(50, qty);
    save();
  }

  function remove(index) {
    cart.items.splice(index, 1);
    save();
  }

  function setFulfillment(mode) {
    cart.fulfillment = mode;
    save();
  }

  function clear() {
    cart.items = [];
    save();
  }

  // Linhas do carrinho com preço e rótulo resolvidos a partir do catálogo
  function lines() {
    return cart.items
      .map((item, index) => {
        const p = product(item.product_id);
        if (!p) return null;
        const v = p.variants.find((x) => x.id === item.variant_id);
        const t = item.tone ? tone(item.tone) : null;
        const unit = p.kind === "servico" ? p.deposit ?? 50 : v ? v.price : p.price;
        let option = [v && v.label, t && t.name].filter(Boolean).join(" · ");
        if (p.kind === "servico") option = `Sinal do horário · ${formatDate(item.booking_date)} · ${item.booking_time || ""}`;
        const image = toneImage(p, item.tone).url;
        return { index, item, product: p, variant: v, tone: t, unit, option, image, total: unit * item.quantity };
      })
      .filter(Boolean);
  }

  function formatDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  function hasGoods() {
    return lines().some((l) => l.product.kind === "produto");
  }

  function quoteValid() {
    return Boolean(cart.quote && cart.quote.within_area && new Date(cart.quote.expires_at) > new Date());
  }

  function totals() {
    const ls = lines();
    const subtotal = round(ls.reduce((s, l) => s + l.total, 0));
    const goods = ls.some((l) => l.product.kind === "produto");
    let fee = 0;
    let feeState = "none"; // none | pickup | pending | ok | free | out
    if (goods && cart.fulfillment === "retirada") feeState = "pickup";
    else if (goods) {
      if (!cart.quote) feeState = "pending";
      else if (!cart.quote.within_area) feeState = "out";
      else {
        fee = cart.quote.fee;
        feeState = "ok";
        const freeAbove = catalog.delivery.free_above;
        if (freeAbove !== null && subtotal >= freeAbove) { fee = 0; feeState = "free"; }
      }
    }
    return { subtotal, fee, total: round(subtotal + fee), goods, feeState, count: ls.reduce((s, l) => s + l.item.quantity, 0) };
  }

  /* ---------- Pedido ---------- */

  async function createOrder(customer) {
    const t = totals();
    const fulfillment = t.goods ? cart.fulfillment : "servico";
    const payload = {
      ...customer,
      fulfillment,
      quote_id: fulfillment === "entrega" && cart.quote ? cart.quote.quote_id : null,
      items: cart.items.map((i) => ({
        product_id: i.product_id,
        variant_id: i.variant_id || null,
        tone: i.tone || null,
        quantity: i.quantity,
        booking_date: i.booking_date || null,
        booking_time: i.booking_time || null,
      })),
    };

    if (fulfillment === "entrega" && !quoteValid()) {
      throw new UserError("Calcule o frete pelo CEP antes de finalizar.");
    }

    if (!demo) {
      let res;
      try {
        res = await fetch(`${baseUrl}/rest/v1/rpc/create_order`, {
          method: "POST", headers: headers(await userToken()), body: JSON.stringify({ payload }),
        });
      } catch {
        throw new UserError("Sem conexão. Seu carrinho continua salvo; tente de novo.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new UserError(data.message || "Não foi possível registrar o pedido.");
      return { ...data, total: Number(data.total), subtotal: Number(data.subtotal), delivery_fee: Number(data.delivery_fee) };
    }

    // Modo demonstração: pedido salvo só neste navegador (o painel lê daqui)
    let n = 1001;
    try { n = Number(localStorage.getItem("ag-demo-order") || 1000) + 1; localStorage.setItem("ag-demo-order", String(n)); } catch { /* ignora */ }
    const code = "AG" + n;
    const user = window.AGAuth ? await window.AGAuth.getUser().catch(() => null) : null;
    const q = cart.quote || {};
    const record = {
      id: "demo-" + code,
      code,
      pix_txid: code,
      status: "aguardando_pagamento",
      fulfillment,
      created_at: new Date().toISOString(),
      user_email: user ? user.email : null,
      customer_name: customer.customer_name,
      customer_phone: customer.customer_phone,
      customer_email: customer.customer_email || null,
      cep: customer.cep || null,
      street: customer.street || null,
      address_number: customer.address_number || null,
      complement: customer.complement || null,
      district: customer.district || null,
      city: customer.city || null,
      state: customer.state || null,
      notes: customer.notes || null,
      distance_km: fulfillment === "entrega" ? q.distance_km : null,
      subtotal: t.subtotal,
      delivery_fee: t.fee,
      total: t.total,
      items: lines().map((l) => ({
        kind: l.product.kind,
        name: l.product.name,
        option_label: l.option,
        quantity: l.item.quantity,
        line_total: l.total,
        booking_date: l.item.booking_date || null,
        booking_time: l.item.booking_time || null,
        duration_min: l.product.duration_min || null,
      })),
    };
    try {
      const all = JSON.parse(localStorage.getItem("ag-demo-orders") || "[]");
      all.push(record);
      localStorage.setItem("ag-demo-orders", JSON.stringify(all.slice(-200)));
    } catch { /* sem armazenamento */ }
    return { ...record, demo: true };
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return {
    get demo() { return demo; },
    get demoReason() { return demoReason; },
    get catalog() { return catalog; },
    cart,
    UserError,
    digits,
    loadCatalog,
    product,
    tone,
    category,
    slotsFor,
    occupancy,
    toneImage,
    defaultTone,
    feeFor,
    quoteFreight,
    quoteValid,
    lookupCep,
    add,
    setQty,
    remove,
    setFulfillment,
    clear,
    lines,
    totals,
    createOrder,
    subscribe,
    formatDate,
  };
})();
