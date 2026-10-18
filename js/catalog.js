/*
 * Catálogo local usado no modo demonstração (sem Supabase configurado).
 * Espelha os DADOS INICIAIS de supabase/schema.sql.
 * Preços, durações e estoques são de EXEMPLO.
 */
(function () {
  const IG = "assets/instagram/";
  const ART = "assets/produtos/";

  const svc = (slug, category, name, price, duration, description = null, image = null, featured = false) => ({
    id: "local-" + slug, slug, category_slug: category, kind: "servico", name, description,
    price, deposit: 50, duration_min: duration, texture: null, tones: [], image_url: image,
    hover_image_url: null, featured, variants: [],
  });

  const prod = (slug, category, name, price, description, image, extra = {}) => ({
    id: "local-" + slug, slug, category_slug: category, kind: "produto", name, description,
    price, deposit: null, duration_min: null, texture: null, tones: [], tone_images: {}, image_url: image,
    hover_image_url: null, featured: false, variants: [], ...extra,
  });

  // Foto por tom; simulado = cor gerada digitalmente a partir de outra foto
  const real = (file) => ({ url: IG + file, simulado: false });
  const sim = (file) => ({ url: IG + "tons/" + file, simulado: true });

  const lengths = (code, prices) => [50, 60, 70].map((cm, i) => ({
    id: `local-${code}-${cm}`, sku: `${code}-${cm}`, label: `${cm} cm · 50 g`,
    length_cm: cm, grams: 50, price: prices[i], stock: null,
  }));

  window.AG_CATALOG = {
    categories: [
      { slug: "mechas", name: "Mechas", kind: "produto", sort: 1 },
      { slug: "kits", name: "Kits", kind: "produto", sort: 2 },
      { slug: "acessorios", name: "Acessórios", kind: "produto", sort: 3 },
      // Agenda: horários de hora em hora entre open_time e close_time, nos dias open_days (1 = segunda … 7 = domingo)
      { slug: "mega-hair", name: "Mega Hair", kind: "servico", sort: 10, open_time: "08:00", close_time: "18:00", open_days: [1, 2, 3, 4, 5, 6], slot_capacity: null },
      { slug: "cabelo", name: "Cabelo", kind: "servico", sort: 11, open_time: "08:00", close_time: "18:00", open_days: [1, 2, 3, 4, 5, 6], slot_capacity: null },
      { slug: "unhas", name: "Unhas", kind: "servico", sort: 12, open_time: "08:00", close_time: "18:00", open_days: [1, 2, 3, 4, 5, 6], slot_capacity: null },
    ],
    tones: [
      { slug: "castanho-escuro", name: "Castanho escuro", color_a: "#2b1a12", color_b: "#5a3a26" },
      { slug: "castanho-claro", name: "Castanho claro", color_a: "#5e3b22", color_b: "#9a6a3f" },
      { slug: "mel", name: "Mel", color_a: "#8a5a2b", color_b: "#d9a35b" },
      { slug: "loiro", name: "Loiro", color_a: "#c79a5c", color_b: "#f1d9a6" },
    ],
    products: [
      prod("mecha-lisa", "mechas", "Mecha lisa", 349,
        "Fios naturais lisos, prontos para aplicação fio a fio. Pacote de 50 g.",
        IG + "resultado-liso.jpg",
        {
          texture: "liso", tones: ["castanho-escuro", "castanho-claro", "mel", "loiro"], featured: true, variants: lengths("LISA", [349, 419, 499]),
          tone_images: {
            "castanho-escuro": sim("mecha-lisa-castanho-escuro.jpg"),
            "castanho-claro": real("resultado-liso.jpg"),
            mel: sim("mecha-lisa-mel.jpg"),
            loiro: real("manutencao-loiro.jpg"),
          },
        }),
      prod("mecha-ondulada", "mechas", "Mecha ondulada", 379,
        "Fios naturais com onda aberta e caimento leve. Pacote de 50 g.",
        IG + "resultado-ondulado.jpg",
        {
          texture: "ondulado", tones: ["castanho-claro", "mel", "loiro"], featured: true, variants: lengths("ONDULADA", [379, 449, 529]),
          tone_images: {
            "castanho-claro": sim("mecha-ondulada-castanho-claro.jpg"),
            mel: real("resultado-ondulado.jpg"),
            loiro: sim("mecha-ondulada-loiro.jpg"),
          },
        }),
      prod("mecha-cacheada", "mechas", "Mecha cacheada", 399,
        "Fios naturais cacheados, com cachos definidos do comprimento à ponta. Pacote de 50 g.",
        IG + "resultado-cacheado.jpg",
        {
          texture: "cacheado", tones: ["castanho-escuro", "mel", "loiro"], featured: true, variants: lengths("CACHEADA", [399, 469, 549]),
          tone_images: {
            "castanho-escuro": sim("mecha-cacheada-castanho-escuro.jpg"),
            mel: real("resultado-cacheado.jpg"),
            loiro: sim("mecha-cacheada-loiro.jpg"),
          },
        }),

      prod("kit-manutencao-em-casa", "kits", "Kit manutenção em casa", 189,
        "Shampoo suave, máscara de reconstrução e leave-in para lavar o mega hair sem embaraçar.", ART + "kit-manutencao.svg"),
      prod("kit-pos-aplicacao", "kits", "Kit pós-aplicação", 129,
        "Shampoo e condicionador sem sal para as primeiras semanas depois da aplicação.", ART + "kit-pos-aplicacao.svg"),
      prod("kit-cachos", "kits", "Kit cachos definidos", 159,
        "Creme de pentear e ativador para mega hair ondulado e cacheado.", ART + "kit-cachos.svg"),

      prod("escova-mega-hair", "acessorios", "Escova para mega hair", 69,
        "Cerdas macias com pontas protegidas, desembaraça sem puxar os pontos.", ART + "escova.svg"),
      prod("touca-cetim", "acessorios", "Touca de cetim", 49,
        "Para dormir sem frizz e sem embaraçar o comprimento.", ART + "touca.svg"),
      prod("fronha-cetim", "acessorios", "Fronha de cetim", 79,
        "Menos atrito no travesseiro, menos nós pela manhã.", ART + "fronha.svg"),
      prod("presilhas-profissionais", "acessorios", "Presilhas profissionais", 29,
        "Kit com 6 presilhas para separar mechas na finalização.", ART + "presilhas.svg"),

      svc("reserva-de-horario", "mega-hair", "Avaliação e reserva de horário", 0, 30,
        "Ainda não sabe o que fazer? Reserve o horário e a equipe avalia com você no salão.", IG + "equipe-salao.jpg", true),
      svc("aplicacao-mega-hair", "mega-hair", "Aplicação de mega hair fio a fio", 1200, 240,
        "Aplicação fio a fio com a técnica da casa, integrada aos seus fios.", IG + "aplicacao-cacheado.jpg", true),
      svc("manutencao-mega-hair", "mega-hair", "Manutenção de mega hair", 350, 180,
        "Reposicionamento dos pontos para manter a naturalidade.", IG + "manutencao-loiro.jpg"),
      svc("remocao-mega-hair", "mega-hair", "Remoção de mega hair", 150, 90,
        "Retirada cuidadosa, sem quebrar os seus fios."),
      svc("corte-feminino", "cabelo", "Corte feminino", 120, 60),
      svc("escova", "cabelo", "Escova", 70, 45),
      svc("hidratacao", "cabelo", "Hidratação e reconstrução", 110, 60),
      svc("coloracao", "cabelo", "Coloração", 180, 120),
      svc("luzes", "cabelo", "Luzes", 450, 240, null, IG + "tonalizacao-processo.jpg"),
      svc("progressiva", "cabelo", "Progressiva", 320, 180, null, IG + "resultado-liso.jpg"),
      svc("manicure", "unhas", "Manicure", 45, 45),
      svc("pedicure", "unhas", "Pedicure", 55, 50),
      svc("pe-e-mao", "unhas", "Pé e mão", 90, 90),
    ],
    // Só no modo demonstração: mostra como a seção fica. No Supabase, cadastre pares reais.
    transformations: [
      { id: "demo-1", title: "Manutenção e finalização em ondas", before_url: IG + "manutencao-loiro.jpg", after_url: IG + "resultado-ondulado.jpg" },
      { id: "demo-2", title: "Comprimento cacheado", before_url: IG + "aplicacao-cacheado.jpg", after_url: IG + "resultado-cacheado.jpg" },
    ],
    delivery: {
      origin_label: "Calçada Flor de Lótus, 9 · Centro Comercial de Alphaville · Barueri/SP",
      origin_cep: "06453016",
      origin_lat: -23.4967,
      origin_lng: -46.8532,
      base_fee: 8,
      base_km: 3,
      per_km: 2,
      max_km: 100,
      free_above: null,
      quote_ttl_min: 60,
    },
  };
})();
