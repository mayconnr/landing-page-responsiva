// Edge Function: calcular-frete
// Calcula a taxa de entrega pelo CEP, medindo a distância de carro a partir
// do salão (Calçada Flor de Lótus, 9 · Alphaville · Barueri/SP). As coordenadas
// da origem vêm da tabela delivery_settings.
//
// POST /functions/v1/calcular-frete   body: { "cep": "06454-000" }
// GET  /functions/v1/calcular-frete?cep=06454000
//
// Regra (tabela delivery_settings): taxa fixa até base_km + per_km por km
// extra, até max_km. A cotação é gravada em delivery_quotes e o pedido usa
// o valor gravado, nunca um valor enviado pelo navegador.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const USER_AGENT = "AdeliaGugaLoja/1.0 (calculo de frete)";
const ROAD_FACTOR = 1.3; // linha reta -> estimativa de rota quando o roteador falha

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

type Settings = {
  origin_lat: number;
  origin_lng: number;
  base_fee: number;
  base_km: number;
  per_km: number;
  max_km: number;
  free_above: number | null;
  quote_ttl_min: number;
};

type Address = {
  street: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

async function getJson(url: string, timeoutMs = 7000): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const num = (v: unknown) => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : null;
};

// 1) Endereço (e às vezes coordenadas) a partir do CEP
async function lookupCep(cep: string): Promise<Address | null> {
  const b = await getJson(`https://brasilapi.com.br/api/cep/v2/${cep}`);
  if (b && b.city) {
    const c = b.location?.coordinates ?? {};
    return {
      street: b.street || null,
      district: b.neighborhood || null,
      city: b.city,
      state: b.state,
      lat: num(c.latitude),
      lng: num(c.longitude),
    };
  }
  const v = await getJson(`https://viacep.com.br/ws/${cep}/json/`);
  if (v && !v.erro && v.localidade) {
    return {
      street: v.logradouro || null,
      district: v.bairro || null,
      city: v.localidade,
      state: v.uf,
      lat: null,
      lng: null,
    };
  }
  return null;
}

// 2) Coordenadas pelo OpenStreetMap quando o CEP não trouxe
async function geocode(a: Address, cep: string): Promise<{ lat: number; lng: number } | null> {
  const base = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br";
  const tries = [
    a.street && `${base}&street=${encodeURIComponent(a.street)}&city=${encodeURIComponent(a.city ?? "")}&state=${encodeURIComponent(a.state ?? "")}`,
    `${base}&postalcode=${cep.slice(0, 5)}-${cep.slice(5)}`,
    a.district && `${base}&q=${encodeURIComponent(`${a.district}, ${a.city}, ${a.state}`)}`,
    `${base}&city=${encodeURIComponent(a.city ?? "")}&state=${encodeURIComponent(a.state ?? "")}`,
  ].filter(Boolean) as string[];

  for (const url of tries) {
    const r = await getJson(url);
    if (Array.isArray(r) && r[0]) {
      const lat = num(r[0].lat), lng = num(r[0].lon);
      if (lat !== null && lng !== null) return { lat, lng };
    }
  }
  return null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 3) Distância de carro (OSRM); se falhar, linha reta x fator de rota
async function distance(o: { lat: number; lng: number }, d: { lat: number; lng: number }) {
  const r = await getJson(
    `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=false`,
    8000,
  );
  const route = r?.routes?.[0];
  if (r?.code === "Ok" && route) {
    return { km: route.distance / 1000, min: route.duration / 60, method: "rota" as const };
  }
  const km = haversineKm(o.lat, o.lng, d.lat, d.lng) * ROAD_FACTOR;
  return { km, min: null, method: "linha_reta" as const };
}

const round = (n: number, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

function calcFee(km: number, s: Settings): number | null {
  if (km > Number(s.max_km)) return null;
  const extra = Math.max(0, km - Number(s.base_km));
  return round(Number(s.base_fee) + extra * Number(s.per_km));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let cepRaw = new URL(req.url).searchParams.get("cep") ?? "";
  if (req.method === "POST") {
    try {
      const body = await req.json();
      cepRaw = String(body?.cep ?? cepRaw);
    } catch {
      return json({ error: "Envie o CEP no corpo da requisição." }, 400);
    }
  }

  const cep = cepRaw.replace(/\D/g, "");
  if (cep.length !== 8) return json({ error: "CEP inválido. Use 8 números, como 06454-000." }, 400);

  const { data: settings, error: settingsError } = await supabase
    .from("delivery_settings")
    .select("*")
    .eq("id", 1)
    .single<Settings>();
  if (settingsError || !settings) {
    return json({ error: "Regras de frete não configuradas (tabela delivery_settings)." }, 500);
  }

  const address = await lookupCep(cep);
  if (!address) return json({ error: "Não encontramos esse CEP. Confira os números." }, 404);

  let point = address.lat !== null && address.lng !== null ? { lat: address.lat, lng: address.lng } : null;
  if (!point) point = await geocode(address, cep);
  if (!point) {
    return json({ error: "Não conseguimos localizar esse endereço agora. Tente de novo ou fale com a gente." }, 502);
  }

  const origin = { lat: Number(settings.origin_lat), lng: Number(settings.origin_lng) };
  const d = await distance(origin, point);
  const km = round(d.km, 1);
  const fee = calcFee(km, settings);
  const withinArea = fee !== null;
  const expiresAt = new Date(Date.now() + (settings.quote_ttl_min ?? 60) * 60_000).toISOString();

  const { data: quote, error: quoteError } = await supabase
    .from("delivery_quotes")
    .insert({
      cep,
      street: address.street,
      district: address.district,
      city: address.city,
      state: address.state,
      lat: point.lat,
      lng: point.lng,
      distance_km: km,
      duration_min: d.min === null ? null : round(d.min, 1),
      method: d.method,
      fee,
      within_area: withinArea,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (quoteError) return json({ error: "Não foi possível salvar a cotação." }, 500);

  return json({
    quote_id: quote.id,
    cep,
    address: {
      street: address.street,
      district: address.district,
      city: address.city,
      state: address.state,
    },
    // coordenadas aproximadas do CEP (centro da rua), usadas no mapa de raio do site
    point: { lat: round(point.lat, 4), lng: round(point.lng, 4) },
    origin,
    distance_km: km,
    duration_min: d.min === null ? null : Math.round(d.min),
    method: d.method,
    fee,
    within_area: withinArea,
    rule: {
      base_fee: Number(settings.base_fee),
      base_km: Number(settings.base_km),
      per_km: Number(settings.per_km),
      max_km: Number(settings.max_km),
      free_above: settings.free_above === null ? null : Number(settings.free_above),
    },
    expires_at: expiresAt,
  });
});
