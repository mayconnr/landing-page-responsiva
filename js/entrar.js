/*
 * Página Entrar / Criar conta.
 */
(function () {
  const A = window.AGAuth;
  const P = window.AGPedidos;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const digits = (v) => String(v || "").replace(/\D/g, "");

  const VIEWS = ["viewAuth", "forgotForm", "newPasswordForm", "viewMessage", "viewAccount"];
  const params = new URLSearchParams(location.search);
  // Depois de entrar, volta para onde a cliente estava (só caminhos do próprio site)
  const next = (() => {
    const n = params.get("voltar");
    return n && /^[\w\-./#?=&]+$/.test(n) && !n.includes("//") ? n : "index.html";
  })();

  function show(id) {
    VIEWS.forEach((v) => { $("#" + v).hidden = v !== id; });
    const first = $(`#${id} input, #${id} button`);
    if (first && id !== "viewAuth") first.focus({ preventScroll: true });
  }

  function setTab(signup) {
    $("#tabLogin").setAttribute("aria-selected", String(!signup));
    $("#tabSignup").setAttribute("aria-selected", String(signup));
    $(".auth__switch").classList.toggle("is-signup", signup);
    $("#loginForm").hidden = signup;
    $("#signupForm").hidden = !signup;
    $("#authTitle").textContent = signup ? "Criar conta" : "Entrar";
    document.title = `${signup ? "Criar conta" : "Entrar"} · Adélia & Guga Mega Hair`;
    $("#socialNotice").hidden = true;
  }

  function formError(form, msg) {
    const el = $(".form-error", form);
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  function fieldInvalid(input, bad) {
    if (bad) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
    return !bad;
  }

  function busy(form, on, label) {
    const btn = $("button[type=submit]", form);
    btn.disabled = on;
    btn.classList.toggle("is-loading", on);
    if (on && !$(".spinner", btn)) btn.insertAdjacentHTML("beforeend", '<span class="spinner" aria-hidden="true"></span>');
    if (!on) { const s = $(".spinner", btn); if (s) s.remove(); }
    if (label) $(".btn__label", btn).textContent = label;
  }

  const phoneFmt = (v) => {
    const d = digits(v).slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };
  const emailOk = (v) => /^\S+@\S+\.\S+$/.test(String(v).trim());

  /* ---------- Conta logada ---------- */

  async function loadOrders(user) {
    const list = $("#accountOrders");
    let orders = [];
    if (A.live) {
      const { data, error } = await A.client.from("orders")
        .select("code, status, total, created_at, fulfillment")
        .order("created_at", { ascending: false }).limit(20);
      if (!error) orders = data || [];
    } else {
      try {
        orders = JSON.parse(localStorage.getItem("ag-demo-orders") || "[]")
          .filter((o) => o.user_email === user.email)
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
      } catch { orders = []; }
    }
    list.innerHTML = orders.length
      ? orders.map((o) => {
          const s = P.status(o.status);
          return `<li class="account__order">
            <strong>${P.esc(o.code)}</strong>
            <span class="chip-status" data-tone="${s.tone}">${P.esc(s.label)}</span>
            <small>${P.esc(P.FULFILLMENT[o.fulfillment] || "")} · ${P.dateTime(o.created_at)}</small>
            <span class="total">${P.money(o.total)}</span>
          </li>`;
        }).join("")
      : `<li class="account__empty">Você ainda não fez pedidos com esta conta.</li>`;
  }

  async function showAccount(user) {
    $("#accountName").textContent = (user.name || user.email).split(" ")[0];
    $("#accountEmail").textContent = user.email;
    document.title = "Minha conta · Adélia & Guga Mega Hair";
    show("viewAccount");
    loadOrders(user);
    // Atalho para o painel, só para o e-mail autorizado
    $("#panelLink").hidden = true;
    A.isPanelUser().then((ok) => { $("#panelLink").hidden = !ok; }).catch(() => {});
  }

  /* ---------- Formulários ---------- */

  function initForms() {
    $("#tabLogin").addEventListener("click", () => setTab(false));
    $("#tabSignup").addEventListener("click", () => setTab(true));
    $(".auth__switch").addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const signup = e.key === "ArrowRight";
        setTab(signup);
        (signup ? $("#tabSignup") : $("#tabLogin")).focus();
      }
    });

    $$(".password__toggle").forEach((b) => b.addEventListener("click", () => {
      const input = b.previousElementSibling;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      b.setAttribute("aria-pressed", String(!showing));
      b.setAttribute("aria-label", showing ? "Mostrar senha" : "Esconder senha");
      $("use", b).setAttribute("href", showing ? "#i-eye" : "#i-eye-off");
    }));

    $("#signupPhone").addEventListener("input", (e) => { e.target.value = phoneFmt(e.target.value); });
    $$("[data-show]").forEach((b) => b.addEventListener("click", () => show(b.dataset.show)));
    $("#forgotLink").addEventListener("click", () => {
      $("#forgotEmail").value = $("#loginEmail").value;
      show("forgotForm");
    });

    $("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      formError(f);
      const ok = fieldInvalid(f.email, !emailOk(f.email.value)) & fieldInvalid(f.password, !f.password.value);
      if (!ok) return formError(f, "Preencha e-mail e senha.");
      busy(f, true);
      try {
        await A.signIn(f.email.value, f.password.value);
        location.href = next;
      } catch (err) {
        formError(f, err instanceof A.AuthError ? err.message : "Não foi possível entrar agora.");
        busy(f, false);
      }
    });

    $("#signupForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      formError(f);
      const phone = digits(f.phone.value);
      const checks = [
        fieldInvalid(f.name, f.name.value.trim().length < 2),
        fieldInvalid(f.phone, phone.length < 10 || phone.length > 11),
        fieldInvalid(f.email, !emailOk(f.email.value)),
        fieldInvalid(f.password, f.password.value.length < 6),
      ];
      if (checks.includes(false)) {
        return formError(f, f.password.value && f.password.value.length < 6
          ? "A senha precisa de pelo menos 6 caracteres."
          : "Confira os campos marcados.");
      }
      busy(f, true);
      try {
        const res = await A.signUp({ name: f.name.value.trim(), phone, email: f.email.value, password: f.password.value });
        if (res.needsConfirmation) {
          $("#messageTitle").textContent = "Confirme seu e-mail";
          $("#messageText").textContent = `Enviamos um link para ${f.email.value.trim()}. Abra o e-mail e toque no link para ativar sua conta.`;
          show("viewMessage");
        } else {
          location.href = next;
        }
      } catch (err) {
        formError(f, err instanceof A.AuthError ? err.message : "Não foi possível criar a conta agora.");
      } finally {
        busy(f, false);
      }
    });

    $("#forgotForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      formError(f);
      if (!fieldInvalid(f.email, !emailOk(f.email.value))) return formError(f, "Digite um e-mail válido.");
      busy(f, true);
      try {
        await A.resetPassword(f.email.value);
        $("#messageTitle").textContent = "Confira seu e-mail";
        $("#messageText").textContent = `Se existir uma conta com ${f.email.value.trim()}, você vai receber um link para criar uma senha nova.`;
        show("viewMessage");
      } catch (err) {
        formError(f, err instanceof A.AuthError ? err.message : "Não foi possível enviar agora.");
      } finally {
        busy(f, false);
      }
    });

    $("#newPasswordForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      formError(f);
      if (!fieldInvalid(f.password, f.password.value.length < 6)) return formError(f, "A senha precisa de pelo menos 6 caracteres.");
      busy(f, true);
      try {
        await A.updatePassword(f.password.value);
        const user = await A.getUser({ fresh: true });
        if (user) showAccount(user); else show("viewAuth");
      } catch (err) {
        formError(f, err instanceof A.AuthError ? err.message : "Não foi possível salvar agora.");
      } finally {
        busy(f, false);
      }
    });

    $$("[data-provider]").forEach((b) => b.addEventListener("click", async () => {
      const note = $("#socialNotice");
      note.hidden = true;
      try {
        await A.oauth(b.dataset.provider);
      } catch (err) {
        note.textContent = err instanceof A.AuthError ? err.message : "Não foi possível abrir o login agora.";
        note.hidden = false;
      }
    }));

    $("#logoutButton").addEventListener("click", async () => {
      await A.signOut();
      $("#panelLink").hidden = true;
      setTab(false);
      show("viewAuth");
      document.title = "Entrar · Adélia & Guga Mega Hair";
    });
  }

  /* ---------- Início ---------- */

  async function boot() {
    initForms();
    $("#authDemo").hidden = A.live;
    if (params.get("criar") !== null) setTab(true);
    const presetEmail = params.get("email");
    if (presetEmail) { $("#signupEmail").value = presetEmail; $("#loginEmail").value = presetEmail; }

    if (params.get("nova-senha") !== null) {
      show("newPasswordForm");
      return;
    }
    A.onChange((event) => { if (event === "PASSWORD_RECOVERY") show("newPasswordForm"); });

    const user = await A.getUser();
    if (user) showAccount(user);
    else show("viewAuth");
  }

  boot();
})();
