/*
 * Interface da loja Adélia & Guga.
 */
(function () {
  document.documentElement.classList.add("js");

  const S = window.AGStore;
  const CFG = window.AG_CONFIG;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const KM = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const money = (n) => BRL.format(Number(n) || 0);
  // Respeita "reduzir movimento" do sistema; ?movimento=1 força as animações para conferência
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const forceMotion = document.documentElement.classList.contains("force-motion");
  const reduceMotion = { get matches() { return reduceQuery.matches && !forceMotion; } };
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const icon = (id, cls = "icon") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const cepFmt = (v) => { const d = S.digits(v).slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
  const phoneFmt = (v) => {
    const d = S.digits(v).slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };
  const duration = (min) => {
    if (!min) return "";
    const h = Math.floor(min / 60), m = min % 60;
    return h ? `${h} h${m ? " " + m : ""}` : `${m} min`;
  };
  const todayIso = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };

  const TEXTURES = { liso: "Liso", ondulado: "Ondulado", cacheado: "Cacheado" };
  const state = { category: "todos", texture: null, view: "cart", order: null, baIndex: 0, booking: null };

  /* ---------------- Avisos ---------------- */

  function toast(message, iconId = "check") {
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `${icon(iconId)}<span>${esc(message)}</span>`;
    // Diálogos modais ficam na camada superior: o aviso precisa morar dentro do que estiver aberto
    const box = $("#toasts");
    const host = $$("dialog[open]").pop() || document.body;
    if (box.parentElement !== host) host.append(box);
    box.append(el);
    setTimeout(() => {
      el.classList.add("is-leaving");
      el.addEventListener("animationend", () => el.remove(), { once: true });
      if (reduceMotion.matches) el.remove();
    }, 3200);
  }

  /* ---------------- Topo e navegação ---------------- */

  function initTopbar() {
    const bar = $("#topbar");
    const menu = $("#menuButton");
    const nav = $("#nav");
    const onScroll = () => bar.classList.toggle("is-solid", window.scrollY > 24 || nav.classList.contains("is-open"));
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    menu.addEventListener("click", () => {
      const open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      menu.setAttribute("aria-expanded", String(open));
      menu.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
      onScroll();
    });
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) {
        nav.classList.remove("is-open");
        menu.setAttribute("aria-expanded", "false");
        onScroll();
      }
    });

    const links = $$("a", nav);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + entry.target.id)));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    ["loja", "servicos", "entrega", "instagram"].forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });

    $("#year").textContent = new Date().getFullYear();
    $("#mapsLink").href = CFG.store.mapsUrl;
    $("#waLink").href = whatsappUrl("Olá! Vim pelo site da Adélia & Guga.");

    // Entrada escondida do painel da equipe: 3 cliques seguidos no logo
    let taps = [];
    $(".brand").addEventListener("click", (e) => {
      const now = Date.now();
      taps = taps.filter((t) => now - t < 900);
      taps.push(now);
      if (taps.length >= 3) {
        e.preventDefault();
        taps = [];
        location.href = "painel.html";
      }
    });
  }

  /* ---------------- Conta ---------------- */

  async function initAccount() {
    const A = window.AGAuth;
    const btn = $("#accountButton");
    if (!A) { btn.hidden = true; return; }
    const update = async () => {
      const user = await A.getUser().catch(() => null);
      state.user = user;
      if (user) {
        const first = (user.name || user.email).split(" ")[0];
        $("#accountLabel").textContent = first;
        btn.setAttribute("aria-label", `Minha conta, ${first}`);
        btn.classList.add("is-logged");
      } else {
        $("#accountLabel").textContent = "Entrar";
        btn.setAttribute("aria-label", "Entrar ou criar conta");
        btn.classList.remove("is-logged");
      }
    };
    await update();
    A.onChange(update);
  }

  function whatsappUrl(text) {
    return `https://wa.me/${S.digits(CFG.whatsapp)}?text=${encodeURIComponent(text)}`;
  }

  /* ---------------- Hero ---------------- */

  function initHero() {
    const box = $("#heroMirrors");
    $$(".mirror", box).forEach((m) => m.addEventListener("click", () => {
      setFilter("mechas", m.dataset.texture);
      scrollToSection(document.getElementById("loja"));
    }));

    const area = $(".hero__inner");
    area.addEventListener("pointermove", (e) => {
      if (!finePointer.matches || reduceMotion.matches) return;
      const r = box.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / r.width;
      const y = (e.clientY - (r.top + r.height / 2)) / r.height;
      box.style.setProperty("--ty", `${(x * 8).toFixed(2)}deg`);
      box.style.setProperty("--tx", `${(-y * 6).toFixed(2)}deg`);
    });
    area.addEventListener("pointerleave", () => {
      box.style.setProperty("--ty", "0deg");
      box.style.setProperty("--tx", "0deg");
    });
  }

  /* ---------------- Rolagem até as seções ---------------- */

  let glide = null;

  // Rolagem com aceleração suave; a usuária pode interromper com a roda, toque ou teclado
  function scrollToSection(section, after) {
    if (!section) return;
    if (glide) glide.stop();
    const offset = () => $("#topbar").offsetHeight + 8;
    const dest = () => Math.max(0, Math.min(
      section.getBoundingClientRect().top + window.scrollY - offset(),
      document.documentElement.scrollHeight - window.innerHeight,
    ));
    if (reduceMotion.matches) {
      window.scrollTo({ top: dest(), behavior: "instant" });
      arrive(section, after);
      return;
    }
    const start = window.scrollY;
    const duration = Math.min(1500, Math.max(700, Math.abs(dest() - start) * 0.38));
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const html = document.documentElement;
    let t0 = null, stopped = false;
    const events = ["wheel", "touchstart", "keydown"];
    const stop = () => {
      stopped = true;
      events.forEach((ev) => window.removeEventListener(ev, stop));
      html.classList.remove("is-gliding");
      glide = null;
    };
    events.forEach((ev) => window.addEventListener(ev, stop, { passive: true }));
    html.classList.add("is-gliding");
    glide = { stop };
    const step = (now) => {
      if (stopped) return;
      if (t0 === null) t0 = now;
      const p = Math.min(1, (now - t0) / duration);
      window.scrollTo({ top: start + (dest() - start) * ease(p), behavior: "instant" });
      if (p < 1) return requestAnimationFrame(step);
      stop();
      arrive(section, after);
    };
    requestAnimationFrame(step);
  }

  // Chegada: o conteúdo da seção surge em fade e o título ganha um traço dourado
  function arrive(section, after) {
    section.classList.remove("is-arriving");
    void section.offsetWidth;
    section.classList.add("is-arriving");
    clearTimeout(section._arrive);
    section._arrive = setTimeout(() => section.classList.remove("is-arriving"), 1300);
    const head = $(".display", section);
    if (head) {
      head.classList.remove("is-spot");
      void head.offsetWidth;
      head.classList.add("is-spot");
      clearTimeout(head._spot);
      head._spot = setTimeout(() => head.classList.remove("is-spot"), 2000);
    }
    if (!section.hasAttribute("tabindex")) section.setAttribute("tabindex", "-1");
    section.focus({ preventScroll: true });
    if (after) after();
  }

  function spotlightBooking() {
    const btn = $(".salon__intro [data-book]");
    if (!btn) return;
    btn.classList.remove("is-spot-btn");
    void btn.offsetWidth;
    btn.classList.add("is-spot-btn");
    setTimeout(() => btn.classList.remove("is-spot-btn"), 2600);
  }

  function initScroll() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const id = decodeURIComponent(a.getAttribute("href").slice(1));
      const target = id && document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      if (location.hash !== "#" + id) history.pushState(null, "", "#" + id);
      if (a.classList.contains("path")) {
        a.classList.add("is-pressed");
        setTimeout(() => a.classList.remove("is-pressed"), 380);
      }
      scrollToSection(target, a.dataset.spotlight === "book" ? spotlightBooking : null);
    });
  }

  /* ---------------- Revelação de listas ---------------- */

  const revealIO = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-in"); revealIO.unobserve(e.target); }
      }), { rootMargin: "0px 0px -8% 0px" })
    : null;
  const reveal = (root) => $$("[data-reveal]", root).forEach((el) => (revealIO ? revealIO.observe(el) : el.classList.add("is-in")));

  /* ---------------- Loja ---------------- */

  const goods = () => S.catalog.products.filter((p) => p.kind === "produto");

  function renderFilters() {
    const cats = S.catalog.categories.filter((c) => c.kind === "produto");
    const all = goods();
    const seg = $("#categoryFilter");
    seg.innerHTML = `<span class="segmented__thumb" aria-hidden="true"></span>` +
      [{ slug: "todos", name: "Tudo" }, ...cats].map((c) => {
        const n = c.slug === "todos" ? all.length : all.filter((p) => p.category_slug === c.slug).length;
        return `<button type="button" data-cat="${esc(c.slug)}" aria-pressed="${state.category === c.slug}">${esc(c.name)} <small>${n}</small></button>`;
      }).join("");

    const textures = [...new Set(all.map((p) => p.texture).filter(Boolean))];
    const chips = $("#textureFilter");
    chips.hidden = !(state.category === "todos" || state.category === "mechas") || !textures.length;
    chips.innerHTML = [`<button class="chip" type="button" data-texture="" aria-pressed="${!state.texture}">Todas as texturas</button>`,
      ...textures.map((t) => `<button class="chip" type="button" data-texture="${t}" aria-pressed="${state.texture === t}">${TEXTURES[t] || t}</button>`)].join("");
    requestAnimationFrame(moveThumb);
  }

  function moveThumb() {
    const seg = $("#categoryFilter");
    const active = $('button[aria-pressed="true"]', seg);
    if (!active) return;
    seg.style.setProperty("--tx", `${active.offsetLeft}px`);
    seg.style.setProperty("--tw", `${active.offsetWidth}px`);
  }

  function setFilter(category, texture = null) {
    state.category = category;
    state.texture = texture || null;
    renderFilters();
    renderGrid();
  }

  const toneLabel = (t, img) => `${esc(t ? t.name : "")}${img.simulado ? ` <small class="sim" title="Cor gerada digitalmente a partir de uma foto real do salão">simulação</small>` : ""}`;
  const toneAlt = (p, t, img) => t ? `${p.name} no tom ${t.name}${img.simulado ? " (simulação digital da cor)" : ""}` : p.name;

  function cardHTML(p, i) {
    const art = /\.svg($|\?)/.test(p.image_url || "");
    const v0 = p.variants[0];
    const slug0 = S.defaultTone(p);
    const t0 = slug0 && S.tone(slug0);
    const img0 = S.toneImage(p, slug0);
    const price = v0 ? v0.price : p.price;
    const tones = p.tones.length ? `
      <fieldset class="opt">
        <legend class="opt__legend">Tom <output>${toneLabel(t0, img0)}</output></legend>
        <div class="tones">${p.tones.map((slug) => {
          const t = S.tone(slug);
          if (!t) return "";
          return `<label class="tone" title="${esc(t.name)}"><input type="radio" name="tone-${esc(p.slug)}" value="${esc(slug)}" ${slug === slug0 ? "checked" : ""} aria-label="${esc(t.name)}"><span style="--a:${esc(t.color_a)};--b:${esc(t.color_b)}"></span></label>`;
        }).join("")}</div>
      </fieldset>` : "";
    const lengths = p.variants.length ? `
      <fieldset class="opt">
        <legend class="opt__legend">Comprimento</legend>
        <div class="lengths">${p.variants.map((v, k) => `<label class="length"><input type="radio" name="len-${esc(p.slug)}" value="${esc(v.id)}" ${k === 0 ? "checked" : ""}><span>${v.length_cm ? v.length_cm + " cm" : esc(v.label)}</span></label>`).join("")}</div>
      </fieldset>` : "";

    return `
      <article class="card" data-id="${esc(p.id)}" data-reveal style="--d:${i % 8}">
        <div class="arch${art ? " arch--art" : ""}">
          <img class="arch__img" src="${esc(img0.url)}" alt="${esc(toneAlt(p, t0, img0))}" loading="lazy" decoding="async">
          ${p.hover_image_url ? `<img class="arch__alt" src="${esc(p.hover_image_url)}" alt="" loading="lazy" decoding="async">` : ""}
          ${p.texture ? `<span class="arch__tag">${TEXTURES[p.texture]}</span>` : ""}
        </div>
        <div class="card__body">
          <h3 class="card__title">${esc(p.name)}</h3>
          ${p.description ? `<p class="card__desc">${esc(p.description)}</p>` : ""}
          ${tones}
          ${lengths}
          <div class="card__foot">
            <p class="price">${p.variants.length ? "<small>pacote 50 g</small>" : ""}<span data-price>${money(price)}</span></p>
            <button class="btn-add" type="button" data-add aria-label="Adicionar ${esc(p.name)} à sacola">
              <span class="btn-add__label">${icon("plus")}Adicionar</span>
              <span class="btn-add__done" aria-hidden="true">${icon("check")}Na sacola</span>
            </button>
          </div>
        </div>
      </article>`;
  }

  function renderGrid() {
    let list = goods();
    if (state.category !== "todos") list = list.filter((p) => p.category_slug === state.category);
    if (state.texture) list = list.filter((p) => p.texture === state.texture);
    const grid = $("#productGrid");
    grid.innerHTML = list.length
      ? list.map(cardHTML).join("")
      : `<p class="empty">Nenhum produto com esse filtro. <button class="link-btn" type="button" data-cat-reset>Ver todos</button></p>`;
    $("#shopStatus").textContent = `${list.length} ${list.length === 1 ? "produto" : "produtos"}`;
    reveal(grid);
    // Deixa as fotos dos outros tons prontas para a troca ser instantânea
    setTimeout(() => list.forEach((p) => p.tones.forEach((slug) => { new Image().src = S.toneImage(p, slug).url; })), 1500);
  }

  // Troca a foto do cabelo pelo tom escolhido, com transição entre as duas fotos
  function swapTone(card, p, slug) {
    const arch = $(".arch", card);
    const img = S.toneImage(p, slug);
    const t = S.tone(slug);
    $(".opt__legend output", card).innerHTML = toneLabel(t, img);
    const current = $(".arch__img:not(.is-leaving)", arch);
    if (!current || current.getAttribute("src") === img.url) return;
    const next = document.createElement("img");
    next.className = "arch__img is-entering";
    next.alt = toneAlt(p, t, img);
    next.decoding = "async";
    const show = () => {
      if (!current.isConnected) return;
      $$(".arch__img.is-leaving", arch).forEach((el) => el.remove());
      current.after(next);
      current.classList.add("is-leaving");
      requestAnimationFrame(() => requestAnimationFrame(() => next.classList.remove("is-entering")));
      setTimeout(() => current.remove(), 900);
    };
    next.addEventListener("load", show, { once: true });
    next.addEventListener("error", show, { once: true });
    next.src = img.url;
  }

  function initShop() {
    $("#categoryFilter").addEventListener("click", (e) => {
      const b = e.target.closest("[data-cat]");
      if (b) setFilter(b.dataset.cat, b.dataset.cat === "mechas" || b.dataset.cat === "todos" ? state.texture : null);
    });
    $("#textureFilter").addEventListener("click", (e) => {
      const b = e.target.closest("[data-texture]");
      if (b) setFilter(state.category, b.dataset.texture);
    });
    window.addEventListener("resize", moveThumb, { passive: true });

    const grid = $("#productGrid");
    grid.addEventListener("click", (e) => {
      if (e.target.closest("[data-cat-reset]")) return setFilter("todos");
      const btn = e.target.closest("[data-add]");
      if (!btn) return;
      const card = btn.closest(".card");
      const p = S.product(card.dataset.id);
      const variant = $(`input[name="len-${p.slug}"]:checked`, card);
      const tone = $(`input[name="tone-${p.slug}"]:checked`, card);
      S.add({ product_id: p.id, variant_id: variant ? variant.value : null, tone: tone ? tone.value : null, quantity: 1 });
      btn.classList.add("is-added");
      clearTimeout(btn._t);
      btn._t = setTimeout(() => btn.classList.remove("is-added"), 1800);
      flyToCart(btn);
      const t = tone && S.tone(tone.value);
      toast(`${p.name}${t ? " · " + t.name : ""} na sacola`, "bag");
    });
    grid.addEventListener("change", (e) => {
      const card = e.target.closest(".card");
      if (!card) return;
      const p = S.product(card.dataset.id);
      if (e.target.name.startsWith("tone-")) swapTone(card, p, e.target.value);
      if (e.target.name.startsWith("len-")) {
        const v = p.variants.find((x) => x.id === e.target.value);
        const price = $("[data-price]", card);
        price.textContent = money(v ? v.price : p.price);
        const box = price.parentElement;
        box.classList.remove("is-changing");
        void box.offsetWidth;
        box.classList.add("is-changing");
      }
    });
    grid.addEventListener("pointermove", (e) => {
      const b = e.target.closest(".btn-add");
      if (!b) return;
      const r = b.getBoundingClientRect();
      b.style.setProperty("--mx", `${e.clientX - r.left}px`);
      b.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  }

  function flyToCart(from) {
    const cart = $("#cartButton");
    cart.classList.remove("is-bump");
    if (reduceMotion.matches || !from.animate) {
      void cart.offsetWidth;
      cart.classList.add("is-bump");
      return;
    }
    const a = from.getBoundingClientRect();
    const b = cart.getBoundingClientRect();
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
    const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
    const dot = document.createElement("span");
    dot.className = "fly-dot";
    document.body.append(dot);
    const anim = dot.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 1 },
      { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 140}px) scale(1.25)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${x1}px, ${y1}px) scale(0.35)`, opacity: 0.4 },
    ], { duration: 780, easing: "cubic-bezier(0.45, 0, 0.25, 1)" });
    anim.onfinish = () => {
      dot.remove();
      void cart.offsetWidth;
      cart.classList.add("is-bump");
    };
  }

  /* ---------------- Serviços ---------------- */

  function renderServices() {
    const cats = S.catalog.categories.filter((c) => c.kind === "servico");
    const services = S.catalog.products.filter((p) => p.kind === "servico");
    $("#serviceMenu").innerHTML = cats.map((c) => {
      const rows = services.filter((s) => s.category_slug === c.slug);
      if (!rows.length) return "";
      return `
        <section class="menu-group" aria-labelledby="grp-${esc(c.slug)}">
          <h3 class="menu-group__title" id="grp-${esc(c.slug)}">${esc(c.name)}</h3>
          <ul>${rows.map((s, i) => `
            <li class="menu-row" data-reveal style="--d:${i}">
              <div>
                <h4 class="menu-row__name">${esc(s.name)}</h4>
                ${s.description ? `<p class="menu-row__desc">${esc(s.description)}</p>` : ""}
                <p class="menu-row__meta">
                  ${s.duration_min ? `<span>${icon("clock")}${duration(s.duration_min)}</span>` : ""}
                  <span>Sinal ${money(s.deposit ?? 50)} via Pix</span>
                </p>
              </div>
              <p class="menu-row__price">${s.price > 0 ? `<small>a partir de</small>${money(s.price)}` : `<small>sinal</small>${money(s.deposit ?? 50)}`}</p>
              <button class="btn-book" type="button" data-book="${esc(s.slug)}" aria-label="Reservar ${esc(s.name)}">Reservar ${icon("arrow")}</button>
            </li>`).join("")}
          </ul>
        </section>`;
    }).join("");
    reveal($("#serviceMenu"));
  }

  /* ---------------- Reserva (diálogo) ---------------- */

  const DAY_NAMES = ["", "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
  function daysLabel(days) {
    const d = [...days].sort((a, b) => a - b);
    const contiguous = d.every((v, i) => i === 0 || v === d[i - 1] + 1);
    if (contiguous && d.length > 2) return `de ${DAY_NAMES[d[0]]} a ${DAY_NAMES[d[d.length - 1]]}`;
    return d.map((n) => DAY_NAMES[n]).join(", ");
  }
  const hourLabel = (t) => t.endsWith(":00") ? `${Number(t.slice(0, 2))}h` : t;

  // Primeiro dia (a partir de hoje) com algum horário livre
  function firstOpenDate(p) {
    for (let i = 0; i < 21; i++) {
      const iso = todayIso(i);
      const info = S.slotsFor(p, iso);
      if (!info.closed && info.slots.some((s) => !s.past)) return iso;
    }
    return todayIso(1);
  }

  let slotsRun = 0;
  async function renderSlots() {
    const run = ++slotsRun;
    const p = state.booking;
    const date = $("#bookDate").value;
    const box = $("#bookSlots");
    const note = $("#bookSlotsNote");
    if (!date) { box.innerHTML = ""; note.textContent = "Escolha a data para ver os horários."; return; }
    const info = S.slotsFor(p, date);
    $("#bookHours").textContent = `· ${hourLabel(info.open)} às ${hourLabel(info.close)}`;
    if (info.closed) {
      box.innerHTML = "";
      note.textContent = `Atendemos ${daysLabel(info.days)}. Escolha outra data.`;
      return;
    }
    let occ = {};
    if (info.capacity) {
      box.classList.add("is-loading");
      occ = await S.occupancy(p.category_slug, date);
      box.classList.remove("is-loading");
      if (run !== slotsRun) return;
    }
    const dur = p.duration_min || 60;
    const span = Math.ceil(dur / 60);
    const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const at = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    let free = 0;
    box.innerHTML = info.slots.map((s) => {
      let full = false;
      for (let k = 0; k < span; k++) {
        const o = occ[at(toMin(s.time) + k * 60)];
        if (o && o.capacity && o.busy >= o.capacity) full = true;
      }
      const off = s.past || full;
      if (!off) free++;
      const why = s.past ? "já passou" : full ? "lotado" : "";
      return `<label class="slot${off ? " is-off" : ""}"${why ? ` title="Horário ${why}"` : ""}>
        <input type="radio" name="time" value="${s.time}" ${off ? "disabled" : ""} ${!off && state.bookTime === s.time ? "checked" : ""} aria-label="${s.time}${why ? ", " + why : ""}">
        <span>${s.time}</span>
      </label>`;
    }).join("");
    note.textContent = free
      ? `Duração média: ${duration(dur)}. O horário fica garantido com o sinal via Pix.`
      : "Não há horários livres nesta data. Escolha outro dia.";
  }

  function openBooking(slug) {
    const p = S.catalog.products.find((x) => x.slug === slug && x.kind === "servico");
    if (!p) return;
    state.booking = p;
    state.bookTime = null;
    const dlg = $("#bookDialog");
    $("#bookService").innerHTML = `${esc(p.name)}<small>${p.price > 0 ? `A partir de ${money(p.price)} no salão` : "Avaliação no salão"}${p.duration_min ? ` · ${duration(p.duration_min)}` : ""}</small>`;
    $("#bookDeposit").textContent = money(p.deposit ?? 50);
    const date = $("#bookDate");
    date.min = todayIso(0);
    date.value = firstOpenDate(p);
    date.removeAttribute("aria-invalid");
    $("#bookError").hidden = true;
    renderSlots();
    openDialog(dlg);
  }

  function initBooking() {
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-book]");
      if (!b) return;
      e.preventDefault();
      openBooking(b.dataset.book);
    });
    $("#bookDate").addEventListener("change", () => { $("#bookError").hidden = true; renderSlots(); });
    $("#bookSlots").addEventListener("change", (e) => { state.bookTime = e.target.value; $("#bookError").hidden = true; });
    $("#bookForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const date = $("#bookDate");
      const err = $("#bookError");
      const fail = (msg, focusEl) => {
        err.textContent = msg;
        err.hidden = false;
        if (focusEl) focusEl.focus();
      };
      if (!date.value || date.value < date.min) {
        date.setAttribute("aria-invalid", "true");
        return fail("Escolha uma data a partir de hoje.", date);
      }
      date.removeAttribute("aria-invalid");
      if (S.slotsFor(state.booking, date.value).closed) return fail("O salão não atende nesse dia. Escolha outra data.", date);
      const picked = $('input[name="time"]:checked', e.target);
      if (!picked) return fail("Escolha um horário.", $('#bookSlots input:not([disabled])'));
      S.add({ product_id: state.booking.id, booking_date: date.value, booking_time: picked.value, quantity: 1 });
      closeDialog($("#bookDialog"), () => {
        toast(`Reserva de ${state.booking.name} às ${picked.value} na sacola`, "calendar");
        openDrawer("cart");
      });
    });
  }

  /* ---------------- Antes & depois ---------------- */

  function initBeforeAfter() {
    const list = S.catalog.transformations;
    const section = $("#antes-depois");
    if (!list.length) { section.hidden = true; return; }
    section.hidden = false;
    const stage = $("#baStage");
    const range = $("#baRange");

    const show = (i) => {
      state.baIndex = (i + list.length) % list.length;
      const t = list[state.baIndex];
      $("#baBefore").src = t.before_url;
      $("#baBefore").alt = `Antes: ${t.title}`;
      $("#baAfter").src = t.after_url;
      $("#baAfter").alt = `Depois: ${t.title}`;
      $("#baCaption").textContent = t.title;
      $("#baCount").textContent = `${String(state.baIndex + 1).padStart(2, "0")} — ${String(list.length).padStart(2, "0")}`;
      stage.classList.remove("is-swapping");
      void stage.offsetWidth;
      stage.classList.add("is-swapping");
    };
    range.addEventListener("input", () => stage.style.setProperty("--pos", range.value + "%"));
    $("#baPrev").addEventListener("click", () => show(state.baIndex - 1));
    $("#baNext").addEventListener("click", () => show(state.baIndex + 1));
    $("#baPrev").disabled = $("#baNext").disabled = list.length < 2;
    show(0);
  }

  /* ---------------- Entrega e radar ---------------- */

  const RADAR_R = 190;
  const radarScale = (km) => RADAR_R * Math.sqrt(Math.min(km, S.catalog.delivery.max_km) / S.catalog.delivery.max_km);

  function renderRule() {
    const d = S.catalog.delivery;
    $("#freightRule").innerHTML = `
      <div><dt>Taxa fixa</dt><dd>${money(d.base_fee)} até ${KM.format(d.base_km).replace(",0", "")} km</dd></div>
      <div><dt>Por km extra</dt><dd>${money(d.per_km)}</dd></div>
      <div><dt>Raio de entrega</dt><dd>até ${KM.format(d.max_km).replace(",0", "")} km</dd></div>`;

    const steps = [10, 25, 50, 100, 150, 200, 300].filter((k) => k > d.base_km && k < d.max_km);
    const rings = [...new Set([d.base_km, ...steps.slice(-3), d.max_km])].filter((k) => k > 0).sort((a, b) => a - b);
    const ang = (-58 * Math.PI) / 180;
    $("#radarRings").innerHTML = rings.map((k) => {
      const r = radarScale(k);
      const cls = k === d.base_km ? "is-base" : k === d.max_km ? "is-max" : "";
      return `<circle r="${r.toFixed(1)}" class="${cls}"/><text x="${(Math.cos(ang) * r + 6).toFixed(1)}" y="${(Math.sin(ang) * r - 4).toFixed(1)}">${KM.format(k).replace(",0", "")} km</text>`;
    }).join("");
  }

  function bearing(o, p) {
    const rad = (x) => (x * Math.PI) / 180;
    const dl = rad(p.lng - o.lng);
    const y = Math.sin(dl) * Math.cos(rad(p.lat));
    const x = Math.cos(rad(o.lat)) * Math.sin(rad(p.lat)) - Math.sin(rad(o.lat)) * Math.cos(rad(p.lat)) * Math.cos(dl);
    return Math.atan2(y, x);
  }

  function drawRoute(q) {
    const g = $("#radarRoute");
    const radar = $("#radar");
    if (!q || !q.point) { g.innerHTML = ""; return; }
    const origin = q.origin || { lat: S.catalog.delivery.origin_lat, lng: S.catalog.delivery.origin_lng };
    const th = bearing(origin, q.point);
    const r = q.within_area ? Math.max(14, radarScale(q.distance_km)) : RADAR_R + 4;
    const x = Math.sin(th) * r, y = -Math.cos(th) * r;
    // Rótulo ao lado do ponto, do lado oposto ao centro (não cobre a linha nem o "N")
    const lx = x + (x >= 0 ? 14 : -14), ly = y + 5;
    g.innerHTML = `
      <line x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>
      <circle class="dest-pulse" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10"/>
      <circle class="dest" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8"/>
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${x >= 0 ? "start" : "end"}">${KM.format(q.distance_km)} km</text>`;
    radar.setAttribute("aria-label", `Mapa de raio: seu CEP fica a ${KM.format(q.distance_km)} km do salão${q.within_area ? "" : ", fora do raio de entrega"}.`);
    if (!reduceMotion.matches && g.firstElementChild.animate) {
      const len = Math.hypot(x, y);
      g.querySelector("line").animate([{ strokeDasharray: `${len}`, strokeDashoffset: len }, { strokeDasharray: `${len}`, strokeDashoffset: 0 }], { duration: 900, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
      g.querySelector(".dest").animate([{ opacity: 0 }, { opacity: 0, offset: 0.7 }, { opacity: 1 }], { duration: 1000 });
      g.querySelector("text").animate([{ opacity: 0 }, { opacity: 0, offset: 0.75 }, { opacity: 1 }], { duration: 1100 });
    }
  }

  function quoteHTML(q) {
    const d = S.catalog.delivery;
    const a = q.address || {};
    const place = [a.district, a.city && `${a.city}/${a.state}`].filter(Boolean).join(", ");
    const head = `<div class="quote__addr">${icon("pin")}<div>${esc(a.street || place || "CEP " + cepFmt(q.cep))}<small>${esc(a.street ? place + " · " : "")}CEP ${cepFmt(q.cep)}</small></div></div>`;
    if (!q.within_area) {
      return `<div class="quote quote--out">${head}
        <div class="quote__nums"><div><p>Esse CEP fica a ${KM.format(q.distance_km)} km do salão, fora do raio de ${KM.format(d.max_km).replace(",0", "")} km.</p>
        <p>Você pode comprar e retirar no salão, ou <a href="${whatsappUrl(`Olá! Meu CEP é ${cepFmt(q.cep)}. Vocês entregam aqui?`)}" target="_blank" rel="noopener">falar com a gente no WhatsApp</a>.</p></div></div></div>`;
    }
    const note = q.method === "linha_reta"
      ? "Distância estimada: o serviço de rotas não respondeu agora."
      : q.duration_min ? `Rota de cerca de ${q.duration_min} min de carro saindo do salão.` : "";
    const free = d.free_above !== null ? ` Frete grátis em compras a partir de ${money(d.free_above)}.` : "";
    return `<div class="quote">${head}
      <div class="quote__nums">
        <p class="quote__km">Rota de carro<strong>${KM.format(q.distance_km)} km</strong></p>
        <p class="quote__fee">Taxa de entrega<strong>${money(q.fee)}</strong></p>
      </div>
      <p class="quote__note">${esc(note)}${esc(free)}${S.totals().goods ? " Frete salvo na sua sacola." : ""}</p>
    </div>`;
  }

  async function runQuote(cep, { onStart, onDone } = {}) {
    const radar = $("#radar");
    radar.classList.add("is-searching");
    onStart && onStart();
    try {
      const q = await S.quoteFreight(cep);
      drawRoute(q);
      onDone && onDone(q, null);
      return q;
    } catch (err) {
      const msg = err instanceof S.UserError ? err.message : "Não foi possível calcular o frete agora. Tente de novo.";
      onDone && onDone(null, msg);
      return null;
    } finally {
      radar.classList.remove("is-searching");
    }
  }

  function initFreight() {
    renderRule();
    const form = $("#freightForm");
    const input = $("#freightCep");
    const out = $("#freightResult");
    input.addEventListener("input", () => { input.value = cepFmt(input.value); input.removeAttribute("aria-invalid"); });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (S.digits(input.value).length !== 8) {
        input.setAttribute("aria-invalid", "true");
        out.innerHTML = `<div class="quote quote--error"><p>Digite os 8 números do CEP, como 06454-000.</p></div>`;
        input.focus();
        return;
      }
      const btn = $("button[type=submit]", form);
      await runQuote(input.value, {
        onStart: () => {
          setLoading(btn, true);
          out.innerHTML = `<div class="quote quote--loading"><span class="spinner" aria-hidden="true"></span>Medindo a rota até o seu CEP…</div>`;
        },
        onDone: (q, msg) => {
          setLoading(btn, false);
          out.innerHTML = q ? quoteHTML(q) : `<div class="quote quote--error"><p>${esc(msg)}</p></div>`;
        },
      });
    });

    const q = S.cart.quote;
    if (q && q.cep) {
      input.value = cepFmt(q.cep);
      out.innerHTML = quoteHTML(q);
      drawRoute(q);
    }
  }

  function setLoading(btn, on) {
    btn.classList.toggle("is-loading", on);
    btn.disabled = on;
    let sp = $(".spinner", btn);
    if (on && !sp) btn.insertAdjacentHTML("beforeend", `<span class="spinner" aria-hidden="true"></span>`);
    if (!on && sp) sp.remove();
  }

  /* ---------------- Instagram ---------------- */

  function renderInsta() {
    const base = "assets/instagram/";
    const items = [
      ["resultado-cacheado.jpg", "Mega hair cacheado mel finalizado"],
      ["equipe-salao.jpg", "Equipe e clientes no salão"],
      ["resultado-liso.jpg", "Mega hair liso castanho com pontas claras"],
      ["cliente-sorrindo.jpg", "Cliente sorrindo com o cabeleireiro no salão"],
      ["aplicacao-cacheado.jpg", "Aplicação de mega hair cacheado em andamento"],
      ["mvinnya-reel.jpg", "Cabeleireiro da equipe no reel do salão"],
      ["resultado-ondulado.jpg", "Mega hair ondulado loiro mel"],
      ["manutencao-loiro.jpg", "Manutenção de mega hair loiro com prancha"],
      ["tonalizacao-processo.jpg", "Tonalização de luzes em andamento"],
      ["convite-momentos.jpg", "Convite para o programa Momentos com Sonia Apolonio"],
    ];
    const url = `https://www.instagram.com/${CFG.instagram}/`;
    const li = (hidden) => items.map(([f, alt]) => `
      <li class="marquee__item"${hidden ? ' aria-hidden="true"' : ""}>
        <a href="${url}" target="_blank" rel="noopener"${hidden ? ' tabindex="-1"' : ""}>
          <img src="${base + f}" alt="${hidden ? "" : esc(alt) + " (abre o Instagram)"}" loading="lazy" decoding="async" width="360" height="640">
        </a>
      </li>`).join("");
    $("#instaTrack").innerHTML = li(false) + (reduceMotion.matches ? "" : li(true));
  }

  /* ---------------- Diálogos ---------------- */

  function openDialog(dlg) {
    if (dlg.open) return;
    dlg.classList.remove("is-closing");
    dlg.showModal();
    document.body.classList.add("is-locked");
  }

  function closeDialog(dlg, after) {
    if (!dlg.open) return after && after();
    const done = () => {
      dlg.classList.remove("is-closing");
      dlg.close();
      if (!$$("dialog[open]").length) document.body.classList.remove("is-locked");
      after && after();
    };
    if (reduceMotion.matches) return done();
    dlg.classList.add("is-closing");
    dlg.addEventListener("animationend", done, { once: true });
  }

  function initDialogs() {
    $$("dialog").forEach((dlg) => {
      dlg.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog(dlg); });
      dlg.addEventListener("click", (e) => {
        if (e.target.closest("[data-close]")) return closeDialog(dlg);
        if (e.target === dlg) {
          const r = dlg.getBoundingClientRect();
          const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          if (!inside) closeDialog(dlg);
        }
      });
    });
  }

  /* ---------------- Sacola ---------------- */

  function updateCount() {
    const { count } = S.totals();
    const el = $("#cartCount");
    el.textContent = count;
    el.classList.toggle("has-items", count > 0);
    $("#cartButton").setAttribute("aria-label", `Abrir sacola, ${count} ${count === 1 ? "item" : "itens"}`);
  }

  function openDrawer(view = "cart") {
    state.view = view;
    renderDrawer();
    openDialog($("#cartDialog"));
  }

  const STEP_ORDER = ["cart", "checkout", "pix"];
  const TITLES = { cart: "Sua sacola", checkout: "Seus dados", pix: "Pagamento" };

  function renderDrawer() {
    const body = $("#drawerBody");
    const active = document.activeElement;
    const focusKey = active && body.contains(active) ? active.dataset.key : null;

    $("#drawerTitle").textContent = TITLES[state.view];
    $("#drawerBack").hidden = state.view !== "checkout";
    const idx = STEP_ORDER.indexOf(state.view);
    $$(".steps li").forEach((li, i) => {
      li.classList.toggle("is-current", i === idx);
      li.classList.toggle("is-done", i < idx);
      if (i === idx) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });

    if (state.view === "cart") body.innerHTML = cartView();
    else if (state.view === "checkout") body.innerHTML = checkoutView();
    else body.innerHTML = pixView();

    if (state.view === "pix") mountQr();
    if (focusKey) {
      const el = body.querySelector(`[data-key="${focusKey}"]`);
      if (el) el.focus();
    }
  }

  function lineHTML(l) {
    const p = l.product;
    const art = /\.svg($|\?)/.test(p.image_url || "");
    const thumb = p.kind === "servico"
      ? `<div class="line__thumb is-service">${icon("calendar")}</div>`
      : `<div class="line__thumb${art ? " is-art" : ""}"><img src="${esc(l.image)}" alt=""></div>`;
    const ctrl = p.kind === "produto"
      ? `<div class="stepper" role="group" aria-label="Quantidade de ${esc(p.name)}">
           <button type="button" data-dec="${l.index}" data-key="dec-${l.index}" aria-label="Diminuir">${icon("minus")}</button>
           <output aria-live="polite">${l.item.quantity}</output>
           <button type="button" data-inc="${l.index}" data-key="inc-${l.index}" aria-label="Aumentar">${icon("plus")}</button>
         </div>`
      : "";
    return `
      <li class="line">
        ${thumb}
        <div>
          <p class="line__name">${esc(p.name)}</p>
          ${l.option ? `<p class="line__opt">${esc(l.option)}</p>` : ""}
          <div class="line__ctrl">${ctrl}<button class="link-btn" type="button" data-remove="${l.index}">${icon("trash")}Remover</button></div>
        </div>
        <div class="line__right"><p class="line__total">${money(l.total)}</p></div>
      </li>`;
  }

  function feeText(t) {
    switch (t.feeState) {
      case "pickup": return "Grátis · retirada";
      case "pending": return "Calcule pelo CEP";
      case "out": return "Fora da área";
      case "free": return "Grátis";
      case "ok": return money(t.fee);
      default: return "";
    }
  }

  function summaryHTML(t) {
    return `<dl class="summary">
      <div><dt>Subtotal</dt><dd>${money(t.subtotal)}</dd></div>
      ${t.goods ? `<div><dt>Entrega</dt><dd>${feeText(t)}</dd></div>` : ""}
      <div class="is-total"><dt>Total</dt><dd>${money(t.total)}</dd></div>
    </dl>`;
  }

  function cartView() {
    const ls = S.lines();
    if (!ls.length) {
      return `<div class="view cart-empty">
        <span class="cart-empty__icon">${icon("bag")}</span>
        <h3>Sua sacola está vazia</h3>
        <p>Comece pelas mechas ou reserve um horário no salão.</p>
        <a class="btn btn--gold" href="#loja" data-close><span class="btn__label">Ver mechas</span><span class="btn__icon">${icon("arrow")}</span></a>
        <a class="btn btn--outline" href="#servicos" data-close><span class="btn__label">Reservar horário</span></a>
      </div>`;
    }
    const t = S.totals();
    const q = S.cart.quote;
    let delivery = "";
    if (t.goods) {
      const entrega = S.cart.fulfillment !== "retirada";
      let mini = "";
      if (entrega) {
        let status = `<p class="mini-quote">Digite o CEP de entrega para calcular a taxa.</p>`;
        if (q && q.within_area) status = `<p class="mini-quote"><strong>${KM.format(q.distance_km)} km</strong> do salão · taxa <strong>${money(q.fee)}</strong>${q.address && q.address.city ? ` · ${esc(q.address.city)}/${esc(q.address.state)}` : ""}</p>`;
        if (q && !q.within_area) status = `<p class="mini-quote is-error">CEP a ${KM.format(q.distance_km)} km, fora do raio de entrega. Escolha retirar no salão.</p>`;
        if (state.quoteError) status = `<p class="mini-quote is-error">${esc(state.quoteError)}</p>`;
        mini = `
          <div class="field">
            <label class="field-label" for="drawerCep">CEP de entrega</label>
            <div class="cep-field">
              <input class="input" id="drawerCep" data-key="cep" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" maxlength="9" value="${q ? cepFmt(q.cep) : ""}">
              <button class="btn btn--petrol" type="button" data-quote data-key="quote"><span class="btn__label">Calcular</span></button>
            </div>
            ${status}
          </div>`;
      }
      delivery = `
        <fieldset class="fulfill">
          <legend class="field-label">Como você quer receber?</legend>
          <label><input type="radio" name="fulfill" value="entrega" data-key="f-entrega" ${entrega ? "checked" : ""}><span>${icon("truck")}Entrega<small>Taxa por km a partir de Alphaville</small></span></label>
          <label><input type="radio" name="fulfill" value="retirada" data-key="f-retirada" ${!entrega ? "checked" : ""}><span>${icon("store")}Retirar no salão<small>Calçada Flor de Lótus, 9 · grátis</small></span></label>
        </fieldset>
        ${mini}`;
    }
    const blocked = t.goods && S.cart.fulfillment !== "retirada" && !S.quoteValid();
    const services = ls.some((l) => l.product.kind === "servico");
    return `<div class="view">
      <ul class="lines">${ls.map(lineHTML).join("")}</ul>
      ${delivery}
      ${summaryHTML(t)}
      ${services ? `<p class="summary-note">Serviços: você paga agora só o sinal. O restante é acertado no salão.</p>` : ""}
      <button class="btn btn--gold btn--lg btn--block" type="button" data-next data-key="next" ${blocked ? 'aria-disabled="true"' : ""}>
        <span class="btn__label">Continuar</span><span class="btn__icon">${icon("arrow")}</span>
      </button>
      ${blocked ? `<p class="summary-note">Calcule o frete pelo CEP ou escolha retirar no salão para continuar.</p>` : ""}
    </div>`;
  }

  // Dados para preencher o checkout: conta logada primeiro, depois a última compra neste navegador
  function savedCustomer() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem("ag-customer") || "{}"); } catch { /* ignora */ }
    const u = state.user;
    if (!u) return saved;
    return { name: u.name || saved.name, phone: u.phone ? phoneFmt(u.phone) : saved.phone, email: u.email || saved.email };
  }

  function checkoutView() {
    const t = S.totals();
    const c = savedCustomer();
    const entrega = t.goods && S.cart.fulfillment !== "retirada";
    const q = S.cart.quote || {};
    const a = q.address || {};
    const address = entrega ? `
      <div class="field"><label class="field-label" for="coCep">CEP</label><input class="input" id="coCep" value="${cepFmt(q.cep)}" readonly aria-describedby="coCepHelp"><p class="field-help" id="coCepHelp"><button class="link-btn" type="button" data-back>Alterar CEP</button></p></div>
      <div class="field"><label class="field-label" for="coNumber">Número</label><input class="input" id="coNumber" name="address_number" autocomplete="address-line2" required></div>
      <div class="field span-2"><label class="field-label" for="coStreet">Rua</label><input class="input" id="coStreet" name="street" value="${esc(a.street || "")}" autocomplete="address-line1" required></div>
      <div class="field"><label class="field-label" for="coComp">Complemento <small>(opcional)</small></label><input class="input" id="coComp" name="complement"></div>
      <div class="field"><label class="field-label" for="coDistrict">Bairro</label><input class="input" id="coDistrict" name="district" value="${esc(a.district || "")}"></div>
      <div class="field span-2"><label class="field-label" for="coCity">Cidade</label><input class="input" id="coCity" name="city" value="${esc(a.city ? `${a.city}/${a.state}` : "")}" readonly></div>` : "";
    return `<form class="view" id="checkoutForm" novalidate>
      ${state.user
        ? `<p class="summary-note checkout-who">Comprando como <strong>${esc(state.user.name || state.user.email)}</strong>. O pedido fica salvo na sua conta.</p>`
        : `<p class="summary-note checkout-who">Tem conta? <a href="entrar.html?voltar=index.html">Entre</a> para acompanhar seus pedidos. Ou continue sem conta.</p>`}
      <div class="form-grid">
        <div class="field span-2"><label class="field-label" for="coName">Nome</label><input class="input" id="coName" name="customer_name" autocomplete="name" value="${esc(c.name || "")}" required></div>
        <div class="field"><label class="field-label" for="coPhone">WhatsApp</label><input class="input" id="coPhone" name="customer_phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(11) 90000-0000" value="${esc(c.phone || "")}" required></div>
        <div class="field"><label class="field-label" for="coEmail">E-mail <small>(opcional)</small></label><input class="input" id="coEmail" name="customer_email" type="email" autocomplete="email" value="${esc(c.email || "")}"></div>
        ${address}
        <div class="field span-2"><label class="field-label" for="coNotes">Observações <small>(opcional)</small></label><textarea class="input" id="coNotes" name="notes" maxlength="500" placeholder="Ponto de referência, melhor horário para receber…"></textarea></div>
      </div>
      ${summaryHTML(t)}
      <p class="form-error" id="checkoutError" role="alert" hidden></p>
      <button class="btn btn--gold btn--lg btn--block" type="submit">
        <span class="btn__label">Gerar Pix · ${money(t.total)}</span><span class="btn__icon">${icon("arrow")}</span>
      </button>
    </form>`;
  }

  function fieldError(input, msg) {
    const id = input.id + "Err";
    let el = document.getElementById(id);
    if (!msg) {
      input.removeAttribute("aria-invalid");
      if (el) el.remove();
      return true;
    }
    input.setAttribute("aria-invalid", "true");
    if (!el) {
      el = document.createElement("p");
      el.className = "field-error";
      el.id = id;
      input.after(el);
    }
    el.textContent = msg;
    input.setAttribute("aria-describedby", id);
    return false;
  }

  async function submitCheckout(form) {
    const err = $("#checkoutError");
    err.hidden = true;
    const f = (n) => form.elements[n];
    let ok = true;
    ok = fieldError(f("customer_name"), f("customer_name").value.trim().length < 2 ? "Informe seu nome." : "") && ok;
    const phone = S.digits(f("customer_phone").value);
    ok = fieldError(f("customer_phone"), phone.length < 10 || phone.length > 11 ? "Informe o WhatsApp com DDD." : "") && ok;
    const email = f("customer_email").value.trim();
    ok = fieldError(f("customer_email"), email && !/^\S+@\S+\.\S+$/.test(email) ? "Confira o e-mail." : "") && ok;
    if (f("address_number")) {
      ok = fieldError(f("street"), f("street").value.trim() ? "" : "Informe a rua.") && ok;
      ok = fieldError(f("address_number"), f("address_number").value.trim() ? "" : "Informe o número.") && ok;
    }
    if (!ok) { $("[aria-invalid=true]", form).focus(); return; }

    const btn = $("button[type=submit]", form);
    setLoading(btn, true);
    try {
      const t = S.totals();
      if (t.goods && S.cart.fulfillment !== "retirada" && !S.quoteValid() && S.cart.quote) {
        await S.quoteFreight(S.cart.quote.cep);
      }
      const q = S.cart.quote || {};
      const a = q.address || {};
      const customer = {
        customer_name: f("customer_name").value.trim(),
        customer_phone: phone,
        customer_email: email || null,
        notes: f("notes").value.trim() || null,
      };
      if (f("address_number")) {
        Object.assign(customer, {
          cep: q.cep, street: f("street").value.trim(), address_number: f("address_number").value.trim(),
          complement: f("complement").value.trim() || null, district: f("district").value.trim() || null,
          city: a.city || null, state: a.state || null,
        });
      }
      const order = await S.createOrder(customer);
      try { localStorage.setItem("ag-customer", JSON.stringify({ name: customer.customer_name, phone: phoneFmt(phone), email })); } catch { /* sem armazenamento */ }
      state.order = {
        ...order,
        customer,
        km: q.distance_km,
        street: customer.street ? `${customer.street}, ${customer.address_number}` : null,
      };
      S.clear();
      state.view = "pix";
      renderDrawer();
      $("#drawerBody").scrollTop = 0;
    } catch (e) {
      err.textContent = e instanceof S.UserError ? e.message : "Não foi possível registrar o pedido agora. Seu carrinho continua salvo.";
      err.hidden = false;
      setLoading(btn, false);
    }
  }

  function pixPayload(order) {
    const key = (CFG.pix && CFG.pix.key) || "";
    return {
      sample: !key,
      code: window.AGPix.payload({
        key: key || "chave-pix-nao-configurada",
        name: CFG.pix.merchantName,
        city: CFG.pix.city,
        amount: order.total,
        txid: order.pix_txid || order.code,
      }),
    };
  }

  function pixView() {
    const o = state.order;
    if (!o) { state.view = "cart"; return cartView(); }
    const pix = pixPayload(o);
    o._pix = pix;
    const how = o.fulfillment === "entrega"
      ? `Entrega em ${o.street || "seu endereço"}${o.km ? ` · ${KM.format(o.km)} km` : ""}`
      : o.fulfillment === "retirada" ? "Retirada no salão · Calçada Flor de Lótus, 9" : "Reserva de horário · a equipe confirma pelo WhatsApp";
    const wa = whatsappUrl(`Olá! Fiz o pedido ${o.code} no site, total ${money(o.total)}. Segue o comprovante do Pix.`);
    return `<div class="view pix">
      <span class="pix__ok">${icon("check")}</span>
      <p class="pix__title">Pedido ${esc(o.code)} registrado<small>${esc(how)}</small></p>
      <p class="pix__amount">${money(o.total)}</p>
      <div class="pix__qr${pix.sample ? " is-sample" : ""}" id="pixQr" aria-label="QR Code Pix">
        ${pix.sample ? `<p class="pix__qr-note"><span>Exemplo · configure a chave Pix em js/config.js</span></p>` : ""}
      </div>
      <div class="pix__code">
        <label class="field-label" for="pixCode">Pix copia e cola</label>
        <textarea class="input" id="pixCode" readonly rows="3">${esc(pix.code)}</textarea>
        <button class="btn btn--gold btn--block btn-copy" type="button" data-copy ${pix.sample ? 'aria-disabled="true"' : ""}>
          <span class="btn__label">Copiar código Pix</span><span class="btn__icon">${icon("copy")}</span>
        </button>
      </div>
      <ol class="pix__steps">
        <li>Abra o app do seu banco e escolha Pix copia e cola, ou leia o QR Code.</li>
        <li>Confira o recebedor ${esc(CFG.pix.merchantName)} e o valor de ${money(o.total)}.</li>
        <li>Envie o comprovante no WhatsApp com o número do pedido ${esc(o.code)}.</li>
      </ol>
      <div class="pix__actions">
        <a class="btn btn--petrol btn--block" href="${wa}" target="_blank" rel="noopener"><span class="btn__label">Enviar comprovante no WhatsApp</span><span class="btn__icon">${icon("chat")}</span></a>
        <button class="btn btn--outline btn--block" type="button" data-close><span class="btn__label">Voltar à loja</span></button>
      </div>
      ${o.demo ? `<p class="summary-note">Pedido de demonstração: fica salvo só neste navegador até o Supabase ser conectado.</p>` : ""}
    </div>`;
  }

  function mountQr() {
    const box = $("#pixQr");
    const o = state.order;
    if (!box || !o || !o._pix) return;
    if (typeof window.qrcode !== "function") {
      box.insertAdjacentHTML("afterbegin", `<p class="pix__qr-note"><span>QR Code indisponível sem internet. Use o copia e cola.</span></p>`);
      return;
    }
    const qr = window.qrcode(0, "M");
    qr.addData(o._pix.code);
    qr.make();
    box.insertAdjacentHTML("afterbegin", qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }));
  }

  async function copyPix(btn) {
    const ta = $("#pixCode");
    try {
      await navigator.clipboard.writeText(ta.value);
    } catch {
      ta.select();
      document.execCommand("copy");
    }
    btn.classList.add("is-copied");
    $(".btn__label", btn).textContent = "Código copiado";
    $(".btn__icon", btn).innerHTML = icon("check");
    toast("Código Pix copiado");
    setTimeout(() => {
      btn.classList.remove("is-copied");
      $(".btn__label", btn).textContent = "Copiar código Pix";
      $(".btn__icon", btn).innerHTML = icon("copy");
    }, 2400);
  }

  function initCart() {
    // Sacola com itens abre a sacola; vazia e com pedido recém-feito, reabre o Pix desse pedido
    $("#cartButton").addEventListener("click", () => openDrawer(!S.cart.items.length && state.order ? "pix" : "cart"));
    $("#drawerBack").addEventListener("click", () => { state.view = "cart"; renderDrawer(); });

    const body = $("#drawerBody");
    body.addEventListener("click", async (e) => {
      const t = e.target;
      const inc = t.closest("[data-inc]"), dec = t.closest("[data-dec]"), rem = t.closest("[data-remove]");
      if (inc) { const i = +inc.dataset.inc; S.setQty(i, S.cart.items[i].quantity + 1); return; }
      if (dec) { const i = +dec.dataset.dec; S.setQty(i, S.cart.items[i].quantity - 1); return; }
      if (rem) { S.remove(+rem.dataset.remove); toast("Item removido", "trash"); return; }
      if (t.closest("[data-back]")) { state.view = "cart"; renderDrawer(); return; }
      if (t.closest("[data-copy]")) { const b = t.closest("[data-copy]"); if (b.getAttribute("aria-disabled") !== "true") copyPix(b); return; }
      if (t.closest("[data-next]")) {
        const b = t.closest("[data-next]");
        if (b.getAttribute("aria-disabled") === "true") {
          const cep = $("#drawerCep");
          if (cep) cep.focus();
          return;
        }
        state.view = "checkout";
        renderDrawer();
        const first = $("#coName");
        if (first) first.focus();
        return;
      }
      if (t.closest("[data-quote]")) {
        const input = $("#drawerCep");
        const btn = t.closest("[data-quote]");
        state.quoteError = null;
        if (S.digits(input.value).length !== 8) {
          state.quoteError = "Digite os 8 números do CEP.";
          renderDrawer();
          return;
        }
        await runQuote(input.value, {
          onStart: () => setLoading(btn, true),
          onDone: (q, msg) => {
            state.quoteError = msg;
            if (q) {
              $("#freightCep").value = cepFmt(q.cep);
              $("#freightResult").innerHTML = quoteHTML(q);
            }
            renderDrawer();
          },
        });
      }
    });
    body.addEventListener("change", (e) => {
      if (e.target.name === "fulfill") { state.quoteError = null; S.setFulfillment(e.target.value); }
    });
    body.addEventListener("input", (e) => {
      if (e.target.id === "drawerCep" || e.target.id === "coCep") e.target.value = cepFmt(e.target.value);
      if (e.target.id === "coPhone") e.target.value = phoneFmt(e.target.value);
    });
    body.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.id === "drawerCep") { e.preventDefault(); $("[data-quote]", body).click(); }
    });
    body.addEventListener("submit", (e) => {
      if (e.target.id === "checkoutForm") { e.preventDefault(); submitCheckout(e.target); }
    });

    S.subscribe(() => {
      updateCount();
      if ($("#cartDialog").open && state.view === "cart") renderDrawer();
    });
    updateCount();
  }

  /* ---------------- Suporte via WhatsApp ---------------- */

  function initSupport() {
    const root = $("#support");
    const toggle = $("#supportToggle");
    const panel = $("#supportPanel");
    const msg = $("#supportMsg");
    const err = $("#supportErr");
    const topics = {
      mechas: () => "Olá! Tenho uma dúvida sobre as mechas (tom, comprimento ou quantidade de pacotes).",
      pedido: () => state.order ? `Olá! Quero acompanhar o pedido ${state.order.code}.` : "Olá! Quero acompanhar meu pedido. O número é: ",
      agenda: () => "Olá! Quero agendar (ou remarcar) um horário no salão.",
      entrega: () => "Olá! Tenho uma dúvida sobre a entrega e o frete.",
      pix: () => "Olá! Tenho uma dúvida sobre o pagamento via Pix.",
    };

    const setOpen = (open) => {
      panel.hidden = !open;
      root.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Fechar suporte" : "Abrir suporte pelo WhatsApp");
      if (open) {
        $$("[data-topic]", panel).forEach((a) => { a.href = whatsappUrl(topics[a.dataset.topic]()); });
        $("[data-topic]", panel).focus();
      }
    };

    toggle.addEventListener("click", () => setOpen(panel.hidden));
    $("#supportClose").addEventListener("click", () => { setOpen(false); toggle.focus(); });
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener("click", (e) => {
      if (!panel.hidden && !root.contains(e.target)) setOpen(false);
    });
    panel.addEventListener("click", (e) => {
      if (e.target.closest("[data-topic]")) setTimeout(() => setOpen(false), 150);
    });
    msg.addEventListener("input", () => { err.hidden = true; msg.removeAttribute("aria-invalid"); });
    $("#supportForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const text = msg.value.trim();
      if (!text) {
        err.hidden = false;
        msg.setAttribute("aria-invalid", "true");
        msg.setAttribute("aria-describedby", "supportErr");
        msg.focus();
        return;
      }
      window.open(whatsappUrl(text), "_blank", "noopener");
      msg.value = "";
      setOpen(false);
    });
  }

  /* ---------------- Caminhos ---------------- */

  function initPaths() {
    $$(".path[data-filter]").forEach((a) => a.addEventListener("click", () => setFilter(a.dataset.filter)));

    // Fade-in dos cards quando entram na tela
    const paths = $(".paths");
    if (!("IntersectionObserver" in window)) { paths.classList.add("is-in"); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { paths.classList.add("is-in"); io.disconnect(); }
    }, { rootMargin: "0px 0px -6% 0px" });
    io.observe(paths);
  }

  /* ---------------- Início ---------------- */

  async function boot() {
    initTopbar();
    initScroll();
    initHero();
    initDialogs();
    initPaths();
    initSupport();
    renderInsta();
    initAccount();
    await S.loadCatalog();

    if (S.demo) {
      $("#demoBar").hidden = false;
      if (S.demoReason === "offline") $("#demoBarText").textContent = "Não conseguimos carregar o catálogo do Supabase agora; exibindo dados de exemplo.";
    }

    renderFilters();
    renderGrid();
    initShop();
    renderServices();
    initBooking();
    initBeforeAfter();
    initFreight();
    initCart();
  }

  boot();
})();
