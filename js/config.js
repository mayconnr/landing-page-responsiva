/*
 * Configuração da loja Adélia & Guga.
 * Preencha os campos abaixo; o resto do site se ajusta sozinho.
 */
window.AG_CONFIG = {
  // Supabase > Project Settings > API. Deixe em branco para o modo demonstração
  // (catálogo local, frete calculado no navegador, pedidos só no navegador).
  supabase: {
    url: "",      // ex.: "https://abcdefgh.supabase.co"
    anonKey: "",  // chave pública "anon" ou "publishable"
  },

  // Pix copia-e-cola. key: CPF/CNPJ (só números), e-mail, celular (+5511...) ou chave aleatória.
  pix: {
    key: "",
    merchantName: "ADELIA E GUGA MEGA HAIR", // até 25 letras, sem acento
    city: "BARUERI",                         // até 15 letras, sem acento
  },

  // Painel da equipe: só este e-mail entra. A senha NÃO fica aqui.
  // Com Supabase, quem decide é o banco (tabela painel_emails) e a senha fica no Supabase Auth;
  // esta lista só vale para o modo demonstração.
  painel: {
    emails: ["mayconfdacosta@gmail.com"],
  },

  // Número que aparece no post "Estamos contratando" do Instagram. Confirme antes de publicar.
  whatsapp: "5511967079499",
  instagram: "adelia_cabelos",

  store: {
    name: "Adélia & Guga Mega Hair",
    address: "Calçada Flor de Lótus, 9 · Centro Comercial de Alphaville · Barueri/SP",
    cep: "06453-016",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Cal%C3%A7ada%20Flor%20de%20L%C3%B3tus%2C%209%20Alphaville%20Barueri%20SP",
  },
};
