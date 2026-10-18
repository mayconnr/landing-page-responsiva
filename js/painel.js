/*
 * Painel da equipe: pedidos e agenda.
 * Entrada escondida: 3 cliques no logo da loja (ou o endereço painel.html).
 * Com Supabase: só contas com role = 'admin' entram (protegido pelo banco).
 */
(function () {
  const A = window.AGAuth;
  const P = window.AGPedidos;
  const $ = (s, el = document) => el.querySelector(s);
  const icon = (id) => `<svg class="icon" aria-hidden="true"><use href="#i-${id}"/></svg>`;

  const state = { orders: [], tab: "pedidos", orderFilter: "abertos", agendaFilter: "proximos", timer: null };

  const OPEN = ["aguardando_pagamento", "pago", "em_preparo", "saiu_para_entrega", "pronto_para_retirada", "agendado"];
  const ORDER_FILTERS = [
    { id: "abertos", label: "Abertos", test: (o) => OPEN.includes(o.status) },
    { id: "aguardando", label: "Aguardando Pix", test: (o) => o.status === "aguardando_pagamento" },
    { id: "concluidos", label: "Concluídos", test: (o) => o.status === "concluido" || o.status === "cancelado" },
    { id: "todos", label: "Todos", test: () => true },
  ];

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.hidden = true; }, 2600);
  }

  /* ---------- Dados ---------- */

  const todayIso = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };

  function normalize(o) {
    const items = (o.order_items || o.items || []).map((i) => ({
      ...i,
      duration_min: i.duration_min || (i.products && i.products.duration_min) || 60,
    }));
    return { ...o, items, total: Number(o.total) };
  }

  async function fetchOrders() {
    if (A.live) {
      const { data, error } = await A.client.from("orders")
        .select("*, order_items(*, products(duration_min))")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data || []).map(normalize);
    }
    try { return JSON.parse(localStorage.getItem("ag-demo-orders") || "[]").map(normalize).sort((a, b) => b.created_at.localeCompare(a.created_at)); }
    catch { return []; }
  }

  async function setStatus(order, status) {
    const patch = { status };
    if (status === "pago" && !order.paid_at) patch.paid_at = new Date().toISOString();
    if (A.live) {
      const { error } = await A.client.from("orders").update(patch).eq("id", order.id);
      if (error) throw error;
    } else {
      const all = JSON.parse(localStorage.getItem("ag-demo-orders") || "[]");
      const o = all.find((x) => x.code === order.code);
      if (o) Object.assign(o, patch);
      localStorage.setItem("ag-demo-orders", JSON.stringify(all));
    }
    Object.assign(order, patch);
  }

  // Próximo passo natural de cada pedido
  function nextStep(o) {
    switch (o.status) {
      case "aguardando_pagamento": return { to: "pago", label: "Confirmar Pix" };
      case "pago":
        return o.fulfillment === "servico" ? { to: "agendado", label: "Confirmar horário" } : { to: "em_preparo", label: "Separar pedido" };
      case "em_preparo":
        return o.fulfillment === "entrega" ? { to: "saiu_para_entrega", label: "Saiu para entrega" } : { to: "pronto_para_retirada", label: "Pronto para retirada" };
      case "saiu_para_entrega":
      case "pronto_para_retirada":
      case "agendado": return { to: "concluido", label: "Concluir" };
      default: return null;
    }
  }

  /* ---------- Pedidos ---------- */

  function fulfillLine(o) {
    if (o.fulfillment === "entrega") {
      const addr = [o.street && `${o.street}, ${o.address_number || "s/n"}`, o.complement, o.district, o.city && `${o.city}/${o.state || ""}`].filter(Boolean).join(" · ");
      return `${icon("truck")}<span>Entrega · ${P.esc(addr || "endereço não informado")}${o.distance_km ? ` · ${P.km(o.distance_km)} km` : ""}</span>`;
    }
    if (o.fulfillment === "retirada") return `${icon("store")}<span>Retirada no salão</span>`;
    return `${icon("calendar")}<span>Reserva de horário</span>`;
  }

  function orderCard(o, i) {
    const s = P.status(o.status);
    const step = nextStep(o);
    const options = Object.entries(P.STATUS).map(([k, v]) => `<option value="${k}" ${k === o.status ? "selected" : ""}>${v.label}</option>`).join("");
    const wa = P.waLink(o.customer_phone, `Olá, ${o.customer_name.split(" ")[0]}! Aqui é do Adélia & Guga, sobre o seu pedido ${o.code}.`);
    return `
      <article class="pcard" data-code="${P.esc(o.code)}" style="animation-delay:${Math.min(i, 8) * 40}ms">
        <div class="pcard__head">
          <span class="pcard__code">${P.esc(o.code)}</span>
          <span class="pstatus" data-tone="${s.tone}">${P.esc(s.label)}</span>
          <span class="pcard__time" title="${P.dateTime(o.created_at)}">${P.ago(o.created_at)} · ${P.dateTime(o.created_at)}</span>
          <span class="pcard__total">${P.money(o.total)}</span>
        </div>
        <div class="pcard__who">
          <span>${P.esc(o.customer_name)}</span>
          <a href="${wa}" target="_blank" rel="noopener">${icon("wa")}${P.esc(P.phone(o.customer_phone))}</a>
          ${o.customer_email ? `<a href="mailto:${P.esc(o.customer_email)}">${P.esc(o.customer_email)}</a>` : ""}
        </div>
        <p class="pcard__fulfill">${fulfillLine(o)}</p>
        <ul class="pcard__items">${o.items.map((it) => `
          <li><div>${it.quantity}× ${P.esc(it.name)}${it.option_label ? `<small>${P.esc(it.option_label)}</small>` : ""}</div><span>${P.money(it.line_total)}</span></li>`).join("")}
          ${Number(o.delivery_fee) > 0 ? `<li><div>Entrega</div><span>${P.money(o.delivery_fee)}</span></li>` : ""}
        </ul>
        ${o.notes ? `<p class="pcard__notes">Obs.: ${P.esc(o.notes)}</p>` : ""}
        <div class="pcard__actions">
          ${step ? `<button class="pbtn pbtn--gold pbtn--sm" type="button" data-step="${step.to}">${icon("check")}${step.label}</button>` : ""}
          <label class="sr-only" for="st-${P.esc(o.code)}">Mudar status de ${P.esc(o.code)}</label>
          <select class="pselect" id="st-${P.esc(o.code)}" data-status>${options}</select>
        </div>
      </article>`;
  }

  function renderOrders() {
    const counts = Object.fromEntries(ORDER_FILTERS.map((f) => [f.id, state.orders.filter(f.test).length]));
    $("#orderFilters").innerHTML = ORDER_FILTERS.map((f) => `<button class="pchip" type="button" data-filter="${f.id}" aria-pressed="${state.orderFilter === f.id}">${f.label} <small>${counts[f.id]}</small></button>`).join("");
    $("#countPedidos").textContent = counts.abertos || "";
    const filter = ORDER_FILTERS.find((f) => f.id === state.orderFilter);
    const list = state.orders.filter(filter.test);
    $("#orderList").innerHTML = list.length
      ? list.map(orderCard).join("")
      : `<div class="pempty">${icon("coffee")}<strong>${state.orderFilter === "concluidos" ? "Nada concluído ainda" : "Nenhum pedido esperando"}</strong><p>Quando uma cliente comprar ou reservar um horário no site, o pedido aparece aqui.</p></div>`;
  }

  /* ---------- Agenda ---------- */

  function bookings() {
    const out = [];
    state.orders.forEach((o) => o.items.forEach((it) => {
      if (it.kind !== "servico" || !it.booking_date) return;
      out.push({ order: o, item: it, date: it.booking_date, time: P.hhmm(it.booking_time) || (it.booking_period === "tarde" ? "13:00" : "08:00") });
    }));
    return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }

  function endTime(time, min) {
    const [h, m] = time.split(":").map(Number);
    const t = h * 60 + m + min;
    return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }

  function slotRow(b, i) {
    const o = b.order, it = b.item;
    const s = P.status(o.status);
    const dur = it.duration_min || 60;
    const durLabel = dur >= 60 ? `${Math.floor(dur / 60)} h${dur % 60 ? " " + (dur % 60) : ""}` : `${dur} min`;
    const first = o.customer_name.split(" ")[0];
    const dateLabel = P.localDate(b.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const wa = P.waLink(o.customer_phone, `Olá, ${first}! Confirmando seu horário de ${it.name} em ${dateLabel} às ${b.time} no Adélia & Guga.`);
    const action = o.status === "pago"
      ? `<button class="pbtn pbtn--gold pbtn--sm" type="button" data-step="agendado">${icon("check")}Confirmar horário</button>`
      : o.status === "agendado"
        ? `<button class="pbtn pbtn--soft pbtn--sm" type="button" data-step="concluido">${icon("check")}Atendido</button>`
        : "";
    return `
      <div class="pslot" data-code="${P.esc(o.code)}" style="animation-delay:${Math.min(i, 8) * 40}ms">
        <p class="pslot__time">${b.time}<small>até ${endTime(b.time, dur)}</small></p>
        <div class="pslot__who">
          <strong>${P.esc(it.name)}</strong>
          <span>${P.esc(o.customer_name)} · ${P.esc(P.phone(o.customer_phone))}</span>
          <p class="pslot__meta">${icon("clock")}${durLabel} · ${P.esc(o.code)} <span class="pstatus" data-tone="${s.tone}">${o.status === "aguardando_pagamento" ? "Sinal pendente" : P.esc(s.label)}</span></p>
        </div>
        <div class="pslot__actions">
          ${action}
          <a class="pbtn pbtn--sm" href="${wa}" target="_blank" rel="noopener">${icon("wa")}WhatsApp</a>
        </div>
      </div>`;
  }

  function renderAgenda() {
    const today = todayIso();
    const all = bookings().filter((b) => b.order.status !== "cancelado");
    const groups = {
      proximos: all.filter((b) => b.date >= today),
      hoje: all.filter((b) => b.date === today),
      anteriores: all.filter((b) => b.date < today).reverse(),
    };
    const labels = { proximos: "Próximos", hoje: "Hoje", anteriores: "Anteriores" };
    $("#agendaFilters").innerHTML = Object.keys(groups).map((k) => `<button class="pchip" type="button" data-agenda="${k}" aria-pressed="${state.agendaFilter === k}">${labels[k]} <small>${groups[k].length}</small></button>`).join("");
    $("#countAgenda").textContent = groups.proximos.length || "";

    const list = groups[state.agendaFilter];
    if (!list.length) {
      $("#agendaList").innerHTML = `<div class="pempty">${icon("calendar")}<strong>${state.agendaFilter === "anteriores" ? "Nenhum horário anterior" : "Nenhum horário marcado"}</strong><p>Quando uma cliente escolher um horário no site, ele aparece aqui, por dia e hora.</p></div>`;
      return;
    }
    const byDay = {};
    list.forEach((b) => { (byDay[b.date] = byDay[b.date] || []).push(b); });
    let i = 0;
    $("#agendaList").innerHTML = Object.entries(byDay).map(([date, rows]) => `
      <section class="pday" aria-label="${P.esc(P.dayLabel(date))}">
        <h2 class="pday__title">${P.esc(P.dayLabel(date))} · ${rows.length} ${rows.length === 1 ? "horário" : "horários"}</h2>
        ${rows.map((b) => slotRow(b, i++)).join("")}
      </section>`).join("");
  }

  function render() {
    renderOrders();
    renderAgenda();
    $("#updatedAt").textContent = `Atualizado às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }

  async function refresh(manual) {
    const btn = $("#refreshButton");
    btn.classList.add("is-spinning");
    try {
      state.orders = await fetchOrders();
      render();
      if (manual) toast("Pedidos atualizados");
    } catch (err) {
      console.warn("[painel]", err);
      toast("Não foi possível carregar os pedidos. Confira a conexão.");
    } finally {
      setTimeout(() => btn.classList.remove("is-spinning"), 400);
    }
  }

  /* ---------- Interações ---------- */

  function setTab(tab) {
    state.tab = tab;
    $("#tabPedidos").setAttribute("aria-selected", String(tab === "pedidos"));
    $("#tabAgenda").setAttribute("aria-selected", String(tab === "agenda"));
    $(".ptabs").classList.toggle("is-agenda", tab === "agenda");
    $("#viewPedidos").hidden = tab !== "pedidos";
    $("#viewAgenda").hidden = tab !== "agenda";
  }

  function initBoard() {
    $("#tabPedidos").addEventListener("click", () => setTab("pedidos"));
    $("#tabAgenda").addEventListener("click", () => setTab("agenda"));
    $("#orderFilters").addEventListener("click", (e) => {
      const b = e.target.closest("[data-filter]");
      if (b) { state.orderFilter = b.dataset.filter; renderOrders(); }
    });
    $("#agendaFilters").addEventListener("click", (e) => {
      const b = e.target.closest("[data-agenda]");
      if (b) { state.agendaFilter = b.dataset.agenda; renderAgenda(); }
    });

    const change = async (code, status, btn) => {
      const o = state.orders.find((x) => x.code === code);
      if (!o || o.status === status) return;
      if (status === "cancelado" && !confirm(`Cancelar o pedido ${code}?`)) { render(); return; }
      if (btn) btn.disabled = true;
      try {
        await setStatus(o, status);
        toast(`${code}: ${P.status(status).label}`);
        render();
      } catch (err) {
        console.warn("[painel]", err);
        toast("Não foi possível mudar o status. Tente de novo.");
        if (btn) btn.disabled = false;
      }
    };
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-step]");
      if (b) change(b.closest("[data-code]").dataset.code, b.dataset.step, b);
    });
    document.addEventListener("change", (e) => {
      if (e.target.matches("[data-status]")) change(e.target.closest("[data-code]").dataset.code, e.target.value);
    });

    $("#refreshButton").addEventListener("click", () => refresh(true));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(false); });
    clearInterval(state.timer);
    state.timer = setInterval(() => { if (!document.hidden) refresh(false); }, 60000);
  }

  /* ---------- Acesso ---------- */

  function showGate(text, { form = true, logout = false } = {}) {
    $("#gate").hidden = false;
    $("#board").hidden = true;
    $("#refreshButton").hidden = true;
    $("#logoutButton").hidden = true;
    $("#gateText").textContent = text;
    $("#gateForm").hidden = !form;
    $("#gateLogout").hidden = !logout;
    if (form) $("#gateEmail").focus();
  }

  async function openBoard() {
    $("#gate").hidden = true;
    $("#board").hidden = false;
    $("#refreshButton").hidden = false;
    $("#logoutButton").hidden = false;
    await refresh(false);
  }

  // Só o e-mail autorizado entra (com Supabase, a regra é do banco: tabela painel_emails)
  async function checkAccess() {
    $("#panelDemo").hidden = A.live;
    const user = await A.getUser({ fresh: true });
    if (!user) return showGate("Acesso restrito. Entre com o e-mail e a senha autorizados.");
    if (!(await A.isPanelUser())) {
      return showGate(`A conta ${user.email} não tem acesso ao painel.`, { form: false, logout: true });
    }
    return openBoard();
  }

  const allowedDemo = (email) => ((window.AG_CONFIG.painel && window.AG_CONFIG.painel.emails) || [])
    .map((e) => e.toLowerCase()).includes(String(email).trim().toLowerCase());

  function initGate() {
    $("#gateForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const err = $(".perror", f);
      err.hidden = true;
      const fail = (html) => { err.innerHTML = html; err.hidden = false; };
      if (!f.email.value.trim() || !f.password.value) return fail("Preencha e-mail e senha.");

      // Modo demonstração: confere o e-mail antes, e orienta a criar a conta neste navegador
      if (!A.live) {
        if (!allowedDemo(f.email.value)) return fail("Este e-mail não tem acesso ao painel.");
        if (!A.hasLocalAccount(f.email.value)) {
          const link = `entrar.html?criar&email=${encodeURIComponent(f.email.value.trim())}&voltar=painel.html`;
          return fail(`Neste navegador ainda não existe conta com este e-mail. <a href="${link}">Crie a conta e a senha</a> (modo demonstração).`);
        }
      }

      const btn = $("button[type=submit]", f);
      btn.disabled = true;
      try {
        await A.signIn(f.email.value, f.password.value);
        f.reset();
        await checkAccess();
      } catch (ex) {
        fail(P.esc(ex instanceof A.AuthError ? ex.message : "Não foi possível entrar agora."));
      } finally {
        btn.disabled = false;
      }
    });
    const logout = async () => {
      await A.signOut();
      clearInterval(state.timer);
      showGate("Você saiu. Entre de novo para ver pedidos e agenda.");
    };
    $("#logoutButton").addEventListener("click", logout);
    $("#gateLogout").addEventListener("click", logout);
  }

  initBoard();
  initGate();
  checkAccess();
})();
