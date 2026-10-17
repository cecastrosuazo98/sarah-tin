-- ============================================================================
--  Sarah & Tin 2.0 — Reversión de la migración 001
--
--  Devuelve la base al comportamiento de la app v1 (un usuario = un negocio)
--  SIN borrar información: las tablas y columnas nuevas se conservan (la app v1
--  las ignora) para poder volver a aplicar la v2 sin pérdida.
--
--  Importante: los registros anulados en v2 (voided_at) aparecerán como normales
--  en la app v1. Revisa docs/07-respaldo-y-recuperacion.md antes de usarla; si
--  tienes un respaldo reciente, restaurarlo es la vía preferida.
-- ============================================================================

begin;

-- 0. Vistas de la migración 002 (si no se revirtió antes).
do $$
declare v text;
begin
  for v in select table_name from information_schema.views where table_schema = 'public' and table_name like 'sync\_%' loop
    execute format('drop view if exists public.%I', v);
  end loop;
end $$;

-- 1. Todo registro vuelve a pertenecer a la dueña del negocio (id del negocio = id de la dueña).
do $$
declare t text;
begin
  foreach t in array array[
    'business_settings','categories','suppliers','ingredients','ingredient_purchases',
    'inventory_movements','recipes','recipe_ingredients','products','product_costs',
    'customers','sales','sale_items','customer_account_movements','payments',
    'cash_registers','cash_movements','expenses','orders','order_items','notifications'
  ] loop
    execute format('update public.%I set owner_id = business_id where business_id is not null and owner_id is distinct from business_id and exists (select 1 from auth.users u where u.id = business_id)', t);
  end loop;
end $$;

-- 2. Quitar triggers v2.
do $$
declare t text;
begin
  foreach t in array array[
    'business_settings','categories','suppliers','ingredients','ingredient_purchases',
    'inventory_movements','recipes','recipe_ingredients','products','product_costs',
    'customers','sales','sale_items','customer_account_movements','payments',
    'cash_registers','cash_movements','expenses','orders','order_items','notifications',
    'payment_methods','order_statuses','channels','goals','purchases','purchase_items',
    'supplier_payments','production','owner_movements','ingredient_cost_history',
    'audit_log','idempotency_keys','sync_runs','sync_log','sync_conflicts'
  ] loop
    execute format('drop trigger if exists trg_row_defaults on public.%I', t);
    execute format('drop trigger if exists trg_bump_version on public.%I', t);
  end loop;
end $$;
drop trigger if exists trg_ingredient_cost on public.ingredients;

-- Triggers updated_at originales.
create trigger trg_business_updated before update on public.business_settings for each row execute function public.set_updated_at();
create trigger trg_ingredients_updated before update on public.ingredients for each row execute function public.set_updated_at();
create trigger trg_recipes_updated before update on public.recipes for each row execute function public.set_updated_at();
create trigger trg_products_updated before update on public.products for each row execute function public.set_updated_at();
create trigger trg_orders_updated before update on public.orders for each row execute function public.set_updated_at();

-- owner_id lo rellenaba el trigger; en v1 lo envía la app. Default por si acaso.
do $$
declare t text;
begin
  foreach t in array array[
    'business_settings','categories','suppliers','ingredients','ingredient_purchases',
    'inventory_movements','recipes','recipe_ingredients','products','product_costs',
    'customers','sales','sale_items','customer_account_movements','payments',
    'cash_registers','cash_movements','expenses','orders','order_items','notifications'
  ] loop
    execute format('alter table public.%I alter column owner_id set default auth.uid()', t);
    execute format('update public.%I set owner_id = business_id where owner_id is null', t);
  end loop;
end $$;

-- 3. Columnas de texto vuelven a enum (valores nuevos → equivalente más cercano).
drop view if exists public.v_receivables;
drop view if exists public.v_payables;
alter table public.sales alter column method drop default;
alter table public.sales alter column method type payment_method using
  (case when method in ('efectivo','transferencia','debito','credito','fiado','otro') then method else 'otro' end)::payment_method;
alter table public.sales alter column method set default 'efectivo';
alter table public.payments alter column method drop default;
alter table public.payments alter column method type payment_method using
  (case when method in ('efectivo','transferencia','debito','credito','fiado','otro') then method else 'otro' end)::payment_method;
alter table public.payments alter column method set default 'efectivo';
alter table public.orders alter column status drop default;
alter table public.orders alter column status type order_status using
  (case when status in ('pendiente','confirmado','en_preparacion','listo','entregado','cancelado') then status else 'pendiente' end)::order_status;
alter table public.orders alter column status set default 'pendiente';

-- 4. Políticas v1: cada usuaria ve lo suyo.
do $$
declare t text; pol record;
begin
  foreach t in array array[
    'business_settings','categories','suppliers','ingredients','ingredient_purchases',
    'inventory_movements','recipes','recipe_ingredients','products','product_costs',
    'customers','sales','sale_items','customer_account_movements','payments',
    'cash_registers','cash_movements','expenses','orders','order_items','notifications'
  ] loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    execute format('create policy "own_select" on public.%I for select using (owner_id = auth.uid())', t);
    execute format('create policy "own_insert" on public.%I for insert with check (owner_id = auth.uid())', t);
    execute format('create policy "own_update" on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
    execute format('create policy "own_delete" on public.%I for delete using (owner_id = auth.uid())', t);
  end loop;
end $$;

-- 5. Alta de usuarios como en v1.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Camila'))
  on conflict (id) do nothing;
  insert into public.business_settings (owner_id, business_id)
  values (new.id, null)
  on conflict (owner_id) do nothing;
  return new;
end $$;

-- 6. Funciones RPC fuera de servicio (los datos quedan).
do $$
declare f text;
begin
  foreach f in array array[
    'rpc_create_sale(jsonb)','rpc_register_payment(jsonb)','rpc_void_sale(uuid,text)',
    'rpc_create_order(jsonb)','rpc_set_order_status(uuid,text)','rpc_add_expense(jsonb)',
    'rpc_void_expense(uuid,text)','rpc_register_purchase(jsonb)','rpc_pay_supplier(jsonb)',
    'rpc_register_production(jsonb)','rpc_owner_movement(jsonb)','rpc_invite_member(text,text,text)'
  ] loop
    execute format('drop function if exists public.%s', f);
  end loop;
end $$;

commit;
