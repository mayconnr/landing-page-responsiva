-- =====================================================================
--  Atualização para quem JÁ tinha rodado uma versão anterior do banco.
--  Instalação nova: rode só o schema.sql.
--
--  Ordem: 1) rode o schema.sql de novo (é seguro, não apaga nada)
--         2) rode este arquivo
--  Pode rodar mais de uma vez.
-- =====================================================================

-- Endereço do salão (origem do frete) e raio de entrega de 100 km
update public.delivery_settings
   set max_km       = 100,
       origin_label = 'Calçada Flor de Lótus, 9 · Centro Comercial de Alphaville · Barueri/SP',
       origin_cep   = '06453016',
       origin_lat   = -23.4967,
       origin_lng   = -46.8532
 where id = 1;

-- "cabelo humano" passa a se chamar "fios naturais"
update public.categories set name = 'Mechas de fios naturais' where slug = 'mechas';
update public.products set description = 'Fios naturais lisos, prontos para aplicação fio a fio. Pacote de 50 g.' where slug = 'mecha-lisa';
update public.products set description = 'Fios naturais com onda aberta e caimento leve. Pacote de 50 g.' where slug = 'mecha-ondulada';
update public.products set description = 'Fios naturais cacheados, com cachos definidos do comprimento à ponta. Pacote de 50 g.' where slug = 'mecha-cacheada';

-- Fotos por tom (a troca de tom muda a foto) e fim da foto alternativa no hover
update public.products set tone_images = '{
  "castanho-escuro": {"url": "assets/instagram/tons/mecha-lisa-castanho-escuro.jpg", "simulado": true},
  "castanho-claro":  {"url": "assets/instagram/resultado-liso.jpg", "simulado": false},
  "mel":             {"url": "assets/instagram/tons/mecha-lisa-mel.jpg", "simulado": true},
  "loiro":           {"url": "assets/instagram/manutencao-loiro.jpg", "simulado": false}
}'::jsonb, hover_image_url = null where slug = 'mecha-lisa';

update public.products set tone_images = '{
  "castanho-claro": {"url": "assets/instagram/tons/mecha-ondulada-castanho-claro.jpg", "simulado": true},
  "mel":            {"url": "assets/instagram/resultado-ondulado.jpg", "simulado": false},
  "loiro":          {"url": "assets/instagram/tons/mecha-ondulada-loiro.jpg", "simulado": true}
}'::jsonb, hover_image_url = null where slug = 'mecha-ondulada';

update public.products set tone_images = '{
  "castanho-escuro": {"url": "assets/instagram/tons/mecha-cacheada-castanho-escuro.jpg", "simulado": true},
  "mel":             {"url": "assets/instagram/resultado-cacheado.jpg", "simulado": false},
  "loiro":           {"url": "assets/instagram/tons/mecha-cacheada-loiro.jpg", "simulado": true}
}'::jsonb, hover_image_url = null where slug = 'mecha-cacheada';

-- Horário de atendimento de hora em hora (08:00 às 18:00, segunda a sábado)
update public.categories
   set open_time = '08:00', close_time = '18:00', open_days = '{1,2,3,4,5,6}'
 where kind = 'servico';
