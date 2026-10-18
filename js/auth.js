/*
 * Contas (login, cadastro, senha) para a loja, a página Entrar e o painel.
 * Com Supabase configurado usa o Supabase Auth. Sem Supabase, roda em modo
 * demonstração: a conta fica salva só neste navegador.
 */
window.AGAuth = (function () {
  const cfg = (window.AG_CONFIG && window.AG_CONFIG.supabase) || {};
  const live = Boolean(cfg.url && cfg.anonKey && window.supabase && window.supabase.createClient);
  const client = live
    ? window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
      })
    : null;

  class AuthError extends Error {}

  const here = (file) => new URL(file, location.href).href.split("#")[0];

  // Mensagens do Supabase em português
  function translate(error) {
    const m = String((error && error.message) || "").toLowerCase();
    if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
    if (m.includes("email not confirmed")) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
    if (m.includes("already registered") || m.includes("already been registered")) return "Este e-mail já tem conta. Entre ou recupere a senha.";
    if (m.includes("at least 6") || m.includes("password should")) return "A senha precisa de pelo menos 6 caracteres.";
    if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
    if (m.includes("provider is not enabled") || m.includes("unsupported provider")) return "Este tipo de login ainda não foi ativado no Supabase.";
    if (m.includes("network") || m.includes("fetch")) return "Sem conexão. Verifique sua internet e tente de novo.";
    console.warn("[Adélia & Guga] auth:", error);
    return "Não foi possível concluir agora. Tente de novo em instantes.";
  }

  /* ---------- Modo demonstração ---------- */

  const DEMO_USERS = "ag-demo-users";
  const DEMO_SESSION = "ag-demo-session";
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };

  async function hash(text) {
    if (!(window.crypto && crypto.subtle)) return "plain:" + text;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const demoListeners = new Set();
  const demoEmit = (event) => demoListeners.forEach((fn) => fn(event));
  window.addEventListener("storage", (e) => { if (e.key === DEMO_SESSION) demoEmit("SESSION_CHANGED"); });

  /* ---------- API ---------- */

  let cachedUser;

  async function getUser({ fresh = false } = {}) {
    if (cachedUser !== undefined && !fresh) return cachedUser;
    if (live) {
      const { data } = await client.auth.getSession();
      const session = data && data.session;
      if (!session) return (cachedUser = null);
      const { data: profile } = await client.from("profiles")
        .select("full_name, phone, role").eq("id", session.user.id).maybeSingle();
      const meta = session.user.user_metadata || {};
      return (cachedUser = {
        id: session.user.id,
        email: session.user.email,
        name: (profile && profile.full_name) || meta.full_name || meta.name || "",
        phone: (profile && profile.phone) || meta.phone || "",
        role: (profile && profile.role) || "cliente",
      });
    }
    const email = read(DEMO_SESSION, null);
    const user = email && read(DEMO_USERS, []).find((u) => u.email === email);
    return (cachedUser = user ? { id: "demo-" + user.email, email: user.email, name: user.name, phone: user.phone, role: "cliente" } : null);
  }

  async function signIn(email, password) {
    email = String(email || "").trim().toLowerCase();
    if (live) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new AuthError(translate(error));
    } else {
      const user = read(DEMO_USERS, []).find((u) => u.email === email);
      if (!user || user.password !== (await hash(password))) throw new AuthError("E-mail ou senha incorretos.");
      write(DEMO_SESSION, email);
      demoEmit("SIGNED_IN");
    }
    cachedUser = undefined;
    return getUser();
  }

  async function signUp({ name, phone, email, password }) {
    email = String(email || "").trim().toLowerCase();
    if (live) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { full_name: name, phone }, emailRedirectTo: here("entrar.html") },
      });
      if (error) throw new AuthError(translate(error));
      cachedUser = undefined;
      return { needsConfirmation: !data.session };
    }
    const users = read(DEMO_USERS, []);
    if (users.some((u) => u.email === email)) throw new AuthError("Este e-mail já tem conta. Entre ou recupere a senha.");
    users.push({ name, phone, email, password: await hash(password) });
    write(DEMO_USERS, users);
    write(DEMO_SESSION, email);
    cachedUser = undefined;
    demoEmit("SIGNED_IN");
    return { needsConfirmation: false };
  }

  async function signOut() {
    if (live) await client.auth.signOut();
    else { try { localStorage.removeItem(DEMO_SESSION); } catch { /* ignora */ } demoEmit("SIGNED_OUT"); }
    cachedUser = null;
  }

  async function oauth(provider) {
    if (!live) throw new AuthError("Entrar com Google ou Microsoft funciona depois de conectar o Supabase.");
    const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: here("entrar.html") } });
    if (error) throw new AuthError(translate(error));
  }

  async function resetPassword(email) {
    if (!live) throw new AuthError("A recuperação de senha por e-mail funciona depois de conectar o Supabase.");
    const { error } = await client.auth.resetPasswordForEmail(String(email || "").trim(), { redirectTo: here("entrar.html?nova-senha=1") });
    if (error) throw new AuthError(translate(error));
  }

  async function updatePassword(password) {
    if (!live) throw new AuthError("Disponível depois de conectar o Supabase.");
    const { error } = await client.auth.updateUser({ password });
    if (error) throw new AuthError(translate(error));
  }

  async function updateProfile({ name, phone }) {
    if (!live) {
      const users = read(DEMO_USERS, []);
      const email = read(DEMO_SESSION, null);
      const u = users.find((x) => x.email === email);
      if (u) { u.name = name; u.phone = phone; write(DEMO_USERS, users); }
    } else {
      const user = await getUser();
      if (!user) return;
      const { error } = await client.from("profiles").update({ full_name: name, phone }).eq("id", user.id);
      if (error) throw new AuthError(translate(error));
    }
    cachedUser = undefined;
  }

  async function accessToken() {
    if (!live) return null;
    const { data } = await client.auth.getSession();
    return (data && data.session && data.session.access_token) || null;
  }

  // Pode abrir o painel? Com Supabase, o banco responde (is_admin); na demonstração, a lista do config.js
  async function isPanelUser() {
    const user = await getUser();
    if (!user) return false;
    if (live) {
      const { data, error } = await client.rpc("is_admin");
      return !error && data === true;
    }
    const allowed = ((window.AG_CONFIG.painel && window.AG_CONFIG.painel.emails) || []).map((e) => e.toLowerCase());
    return allowed.includes(String(user.email).toLowerCase());
  }

  // Só no modo demonstração: já existe conta com este e-mail neste navegador?
  function hasLocalAccount(email) {
    return read(DEMO_USERS, []).some((u) => u.email === String(email || "").trim().toLowerCase());
  }

  function onChange(fn) {
    if (live) {
      const { data } = client.auth.onAuthStateChange((event) => { cachedUser = undefined; fn(event); });
      return () => data.subscription.unsubscribe();
    }
    const wrapped = (event) => { cachedUser = undefined; fn(event); };
    demoListeners.add(wrapped);
    return () => demoListeners.delete(wrapped);
  }

  return { live, client, AuthError, getUser, signIn, signUp, signOut, oauth, resetPassword, updatePassword, updateProfile, accessToken, onChange, isPanelUser, hasLocalAccount };
})();
