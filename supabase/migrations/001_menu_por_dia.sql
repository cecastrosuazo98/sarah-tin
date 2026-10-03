-- Menú por día de la semana.
-- Ejecutar una vez en Supabase (SQL Editor → New query → pegar y Run).
-- Guarda en cada producto los días en que se vende (0 = domingo … 6 = sábado).
alter table public.products
  add column if not exists sale_days smallint[] not null default '{}';
