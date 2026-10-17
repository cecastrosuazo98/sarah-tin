-- Reversión de 002: elimina solo las vistas y funciones de lectura (no hay datos).
begin;
do $$
declare v text;
begin
  for v in select table_name from information_schema.views where table_schema = 'public' and table_name like 'sync\_%' loop
    execute format('drop view if exists public.%I', v);
  end loop;
end $$;
drop function if exists public.recipe_cost_status(uuid);
drop function if exists public.ingredient_cost_status(public.ingredients);
drop function if exists public.round_up_to(numeric, numeric);
commit;
