/*
 * Rótulos e formatos de pedidos usados na página Entrar e no painel.
 */
window.AGPedidos = (function () {
  const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const KM = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const STATUS = {
    aguardando_pagamento: { label: "Aguardando Pix", tone: "wait" },
    pago: { label: "Pago", tone: "ok" },
    em_preparo: { label: "Em preparo", tone: "ok" },
    saiu_para_entrega: { label: "Saiu para entrega", tone: "ok" },
    pronto_para_retirada: { label: "Pronto para retirada", tone: "ok" },
    agendado: { label: "Horário confirmado", tone: "ok" },
    concluido: { label: "Concluído", tone: "done" },
    cancelado: { label: "Cancelado", tone: "off" },
  };

  const FULFILLMENT = { entrega: "Entrega", retirada: "Retirada no salão", servico: "Reserva de horário" };

  const money = (n) => BRL.format(Number(n) || 0);
  const km = (n) => KM.format(Number(n) || 0);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const status = (s) => STATUS[s] || { label: s, tone: "off" };

  function phone(d) {
    d = String(d || "").replace(/\D/g, "");
    if (d.startsWith("55") && d.length > 11) d = d.slice(2);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return d;
  }

  function waLink(d, text) {
    d = String(d || "").replace(/\D/g, "");
    if (!d.startsWith("55")) d = "55" + d;
    return `https://wa.me/${d}${text ? "?text=" + encodeURIComponent(text) : ""}`;
  }

  function dateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function ago(iso) {
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "agora";
    if (s < 3600) return `há ${Math.floor(s / 60)} min`;
    if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
    const days = Math.floor(s / 86400);
    return days === 1 ? "ontem" : `há ${days} dias`;
  }

  // "2026-10-20" → Date local (sem fuso deslocando o dia)
  const localDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };

  function dayLabel(iso) {
    const d = localDate(iso);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    const base = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
    if (diff === 0) return "Hoje · " + base;
    if (diff === 1) return "Amanhã · " + base;
    if (diff === -1) return "Ontem · " + base;
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  const hhmm = (t) => String(t || "").slice(0, 5);

  return { STATUS, FULFILLMENT, money, km, esc, status, phone, waLink, dateTime, ago, dayLabel, hhmm, localDate };
})();
