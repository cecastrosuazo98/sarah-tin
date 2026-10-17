-- ============================================================================
--  Sarah & Tin 2.0 — Migración 001
--  Negocio compartido + roles, versionado para sincronización con Google Sheets,
--  operaciones atómicas e idempotentes, costos históricos, compras, producción.
--
--  ANTES DE EJECUTAR: haz un respaldo (ver docs/07-respaldo-y-recuperacion.md).
--  Se ejecuta UNA vez sobre una base que ya tiene supabase/schema.sql.
--  Reversión: supabase/migrations/001_v2_down.sql
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Negocio y miembros
-- ---------------------------------------------------------------------------
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Sarah & Tin',
  created_at timestamptz not null default now()
);

create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'operador' check (role in ('admin','operador')),
  display_name text,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

-- Invitaciones: al crear un usuario con ese correo, entra al negocio con ese rol.
create table if not exists public.business_invites (
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  role text not null default 'operador' check (role in ('admin','operador')),
  display_name text,
  created_at timestamptz not null default now(),
  primary key (business_id, email)
);

-- Un negocio por cada dueño existente, con el mismo id (backfill trivial).
insert into public.businesses (id, name)
select distinct s.owner_id, coalesce(s.name, 'Sarah & Tin')
from public.business_settings s
on conflict (id) do nothing;

do $$
declare t text;
begin
  foreach t in array array['ingredients','products','recipes','customers','sales','expenses','orders']
  loop
    execute format(
      'insert into public.businesses (id) select distinct owner_id from public.%I where owner_id is not null on conflict (id) do nothing', t);
  end loop;
end $$;

insert into public.business_members (business_id, user_id, role)
select b.id, b.id, 'admin'
from public.businesses b
where exists (select 1 from auth.users u where u.id = b.id)
on conflict do nothing;

create or replace function public.current_business_id()
returns uuid language sql stable security definer set search_path = public as $$
  select business_id from public.business_members
  where user_id = auth.uid() order by created_at limit 1
$$;

create or replace function public.current_role_in_business()
returns text language sql stable security definer set search_path = public as $$
  select role from public.business_members
  where user_id = auth.uid() order by created_at limit 1
$$;

create or replace function public.is_member(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.business_members where business_id = b and user_id = auth.uid())
$$;

create or replace function public.is_admin(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.business_members
                 where business_id = b and user_id = auth.uid() and role = 'admin')
$$;

-- Exige ser miembro (y opcionalmente admin). Devuelve el negocio.
create or replace function public.require_member(p_role text default null)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare b uuid; r text;
begin
  select business_id, role into b, r from public.business_members
  where user_id = auth.uid() order by created_at limit 1;
  if b is null then
    raise exception 'Tu usuario no pertenece a ningún negocio. Pide a la administradora que te invite.' using errcode = '42501';
  end if;
  if p_role = 'admin' and r <> 'admin' then
    raise exception 'Esta acción requiere permisos de administración.' using errcode = '42501';
  end if;
  return b;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Tablas nuevas
-- ---------------------------------------------------------------------------
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null,
  label text not null,
  is_active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (business_id, code)
);

create table if not exists public.order_statuses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null,
  label text not null,
  sort integer not null default 0,
  is_active boolean not null default true,
  is_final boolean not null default false,
  created_at timestamptz not null default now(),
  unique (business_id, code)
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  sales_goal numeric(14,2) not null default 0,
  profit_goal numeric(14,2) not null default 0,
  orders_goal integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (business_id, month)
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  purchase_date date not null default current_date,
  total numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  status text not null default 'pendiente' check (status in ('pagada','parcial','pendiente')),
  notes text,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  unit text not null,
  line_total numeric(12,2) not null check (line_total >= 0),
  unit_cost_base numeric(14,6) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  purchase_id uuid references public.purchases(id) on delete set null,
  amount numeric(12,2) not null,
  method text not null default 'efectivo',
  paid_at timestamptz not null default now(),
  notes text,
  voided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.production (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  batches numeric(12,3) not null default 1 check (batches > 0),
  units numeric(12,3) not null check (units > 0),
  unit_cost numeric(14,4),
  produced_at timestamptz not null default now(),
  notes text,
  voided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.owner_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('aporte','retiro')),
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'efectivo',
  movement_date date not null default current_date,
  notes text,
  voided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ingredient_cost_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  old_cost numeric(14,6),
  new_cost numeric(14,6) not null,
  source text,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.idempotency_keys (
  business_id uuid not null references public.businesses(id) on delete cascade,
  key text not null,
  fn text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (business_id, key)
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  user_id uuid,
  action text not null,
  table_name text,
  record_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  trigger text not null default 'manual',
  status text not null default 'running' check (status in ('running','ok','partial','error')),
  stats jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sync_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  run_id uuid references public.sync_runs(id) on delete cascade,
  direction text not null check (direction in ('push','pull')),
  table_name text not null,
  record_id text,
  status text not null check (status in ('ok','error','conflict','skipped')),
  message text,
  created_at timestamptz not null default now()
);

create table if not exists public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  table_name text not null,
  record_id text not null,
  sheet_values jsonb not null,
  db_values jsonb not null,
  status text not null default 'abierto' check (status in ('abierto','resuelto')),
  resolution text check (resolution in ('sheets','app')),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_sync_conflict_open
  on public.sync_conflicts (business_id, table_name, record_id) where status = 'abierto';

-- ---------------------------------------------------------------------------
-- 3. Columnas nuevas en tablas existentes
-- ---------------------------------------------------------------------------
alter table public.business_settings add column if not exists params jsonb not null default '{}'::jsonb;
alter table public.categories add column if not exists is_active boolean not null default true;
alter table public.suppliers add column if not exists is_active boolean not null default true;
alter table public.ingredients add column if not exists is_active boolean not null default true;
alter table public.recipes add column if not exists labor_minutes numeric(10,2) not null default 0;
alter table public.recipes add column if not exists other_cost numeric(12,2) not null default 0;
alter table public.recipes add column if not exists is_active boolean not null default true;
alter table public.products add column if not exists packaging_cost numeric(12,2) not null default 0;
alter table public.products add column if not exists min_stock numeric(12,2) not null default 0;
alter table public.recipe_ingredients add column if not exists created_at timestamptz not null default now();

alter table public.sales add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.sales add column if not exists channel_id uuid references public.channels(id) on delete set null;
alter table public.sales add column if not exists voided_at timestamptz;
alter table public.sales add column if not exists void_reason text;
alter table public.sale_items add column if not exists unit_cost numeric(14,4);

alter table public.payments add column if not exists kind text not null default 'cobro';
alter table public.payments add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.payments add column if not exists voided_at timestamptz;
do $$ begin
  alter table public.payments add constraint payments_kind_check
    check (kind in ('cobro','abono','anticipo','reembolso'));
exception when duplicate_object then null; end $$;

alter table public.orders add column if not exists channel_id uuid references public.channels(id) on delete set null;
alter table public.orders add column if not exists sale_id uuid references public.sales(id) on delete set null;
alter table public.orders add column if not exists delivered_at timestamptz;

alter table public.expenses add column if not exists method text not null default 'efectivo';
alter table public.expenses add column if not exists receipt_url text;
alter table public.expenses add column if not exists notes text;
alter table public.expenses add column if not exists voided_at timestamptz;
alter table public.expenses add column if not exists void_reason text;

alter table public.inventory_movements alter column ingredient_id drop not null;
alter table public.inventory_movements add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.inventory_movements add column if not exists source_type text;
alter table public.inventory_movements add column if not exists source_id uuid;
alter table public.inventory_movements add column if not exists unit_cost numeric(14,6);

-- Métodos de pago y estados pasan de enum a texto (configurables desde Sheets).
alter table public.sales alter column method drop default;
alter table public.sales alter column method type text using method::text;
alter table public.sales alter column method set default 'efectivo';
alter table public.payments alter column method drop default;
alter table public.payments alter column method type text using method::text;
alter table public.payments alter column method set default 'efectivo';
alter table public.orders alter column status drop default;
alter table public.orders alter column status type text using status::text;
alter table public.orders alter column status set default 'pendiente';

-- ---------------------------------------------------------------------------
-- 4. business_id, versión y origen en todas las tablas de negocio
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'business_settings','categories','suppliers','ingredients','ingredient_purchases',
    'inventory_movements','recipes','recipe_ingredients','products','product_costs',
    'customers','sales','sale_items','customer_account_movements','payments',
    'cash_registers','cash_movements','expenses','orders','order_items','notifications'
  ]
  loop
    execute format('alter table public.%I add column if not exists business_id uuid references public.businesses(id) on delete cascade', t);
    execute format('update public.%I set business_id = owner_id where business_id is null', t);
    execute format('alter table public.%I alter column owner_id drop not null', t);
  end loop;
end $$;

-- business_settings: uno por negocio
create unique index if not exists uq_business_settings_business on public.business_settings(business_id);

-- Tablas sincronizables: version + updated_at + origen + autor.
do $$
declare t text;
begin
  foreach t in array array[
    'business_settings','categories','suppliers','ingredients','recipes','recipe_ingredients',
    'products','customers','sales','sale_items','payments','expenses','orders','order_items',
    'inventory_movements','payment_methods','order_statuses','channels','goals','purchases',
    'purchase_items','supplier_payments','production','owner_movements','ingredient_cost_history'
  ]
  loop
    execute format('alter table public.%I add column if not exists version integer not null default 1', t);
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', t);
    execute format('alter table public.%I add column if not exists updated_source text not null default ''app''', t);
    execute format('alter table public.%I add column if not exists updated_by uuid', t);
  end loop;
end $$;

-- Rellena negocio y autor al insertar.
create or replace function public.set_row_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.business_id is null then new.business_id := public.current_business_id(); end if;
  if new.business_id is null then
    raise exception 'No se pudo determinar el negocio del registro.' using errcode = '42501';
  end if;
  begin new.owner_id := coalesce(new.owner_id, auth.uid()); exception when undefined_column then null; end;
  begin new.updated_by := coalesce(new.updated_by, auth.uid()); exception when undefined_column then null; end;
  return new;
end $$;

-- Sube la versión cuando una fila cambia (el origen lo indica quien escribe).
create or replace function public.bump_version()
returns trigger language plpgsql as $$
begin
  if row(new.*) is distinct from row(old.*) then
    new.version := coalesce(old.version, 0) + 1;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  end if;
  return new;
end $$;

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
  ]
  loop
    execute format('drop trigger if exists trg_row_defaults on public.%I', t);
    execute format('create trigger trg_row_defaults before insert on public.%I for each row execute function public.set_row_defaults()', t);
  end loop;
end $$;

drop trigger if exists trg_business_updated on public.business_settings;
drop trigger if exists trg_ingredients_updated on public.ingredients;
drop trigger if exists trg_recipes_updated on public.recipes;
drop trigger if exists trg_products_updated on public.products;
drop trigger if exists trg_orders_updated on public.orders;

do $$
declare t text;
begin
  foreach t in array array[
    'business_settings','categories','suppliers','ingredients','recipes','recipe_ingredients',
    'products','customers','sales','sale_items','payments','expenses','orders','order_items',
    'inventory_movements','payment_methods','order_statuses','channels','goals','purchases',
    'purchase_items','supplier_payments','production','owner_movements','ingredient_cost_history'
  ]
  loop
    execute format('drop trigger if exists trg_bump_version on public.%I', t);
    execute format('create trigger trg_bump_version before update on public.%I for each row execute function public.bump_version()', t);
  end loop;
end $$;

-- Historial de costos de ingredientes (para no recalcular el pasado).
create or replace function public.log_ingredient_cost()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.cost_per_unit is distinct from old.cost_per_unit then
    insert into public.ingredient_cost_history (business_id, ingredient_id, old_cost, new_cost, source)
    values (new.business_id, new.id, case when tg_op = 'UPDATE' then old.cost_per_unit end,
            new.cost_per_unit, new.updated_source);
  end if;
  return new;
end $$;
drop trigger if exists trg_ingredient_cost on public.ingredients;
create trigger trg_ingredient_cost after insert or update of cost_per_unit on public.ingredients
  for each row execute function public.log_ingredient_cost();

-- ---------------------------------------------------------------------------
-- 5. Configuración por defecto de cada negocio
-- ---------------------------------------------------------------------------
create or replace function public.seed_business_defaults(b uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.payment_methods (business_id, code, label, sort, is_active) values
    (b,'efectivo','Efectivo',1,true), (b,'transferencia','Transferencia',2,true),
    (b,'debito','Débito',3,true), (b,'credito','Crédito',4,true), (b,'otro','Otro',5,true),
    (b,'fiado','Fiado (registro antiguo)',9,false)
  on conflict (business_id, code) do nothing;

  insert into public.order_statuses (business_id, code, label, sort, is_final) values
    (b,'pendiente','Pendiente',1,false), (b,'confirmado','Confirmado',2,false),
    (b,'en_preparacion','En preparación',3,false), (b,'listo','Listo',4,false),
    (b,'entregado','Entregado',5,true), (b,'cancelado','Cancelado',6,true)
  on conflict (business_id, code) do nothing;

  if not exists (select 1 from public.channels where business_id = b) then
    insert into public.channels (business_id, name) values (b, 'Directo');
  end if;

  insert into public.business_settings (business_id, owner_id, name)
  values (b, null, 'Sarah & Tin')
  on conflict do nothing;

  update public.business_settings set params = jsonb_build_object(
      'descontar_ingredientes_en', 'venta',
      'politica_costo_compra', 'ultimo',
      'abono_minimo_pct', 0,
      'dias_alerta_pedido', 2,
      'costo_mano_obra_hora', 0,
      'dias_costo_desactualizado', 90,
      'estado_inicial_pedido', 'pendiente'
    ) || params
  where business_id = b;

  -- Categorías: se copian las listas antiguas a la tabla categories.
  insert into public.categories (business_id, name, kind)
  select b, c, 'producto'::category_kind
  from public.business_settings s,
       jsonb_array_elements_text(coalesce(to_jsonb(s.product_categories), '[]'::jsonb)) c
  where s.business_id = b
    and not exists (select 1 from public.categories x where x.business_id = b and x.kind = 'producto' and x.name = c);
  insert into public.categories (business_id, name, kind)
  select b, c, 'gasto'::category_kind
  from public.business_settings s,
       jsonb_array_elements_text(coalesce(to_jsonb(s.expense_categories), '[]'::jsonb)) c
  where s.business_id = b
    and not exists (select 1 from public.categories x where x.business_id = b and x.kind = 'gasto' and x.name = c);
end $$;

do $$
declare b uuid;
begin
  for b in select id from public.businesses loop
    perform public.seed_business_defaults(b);
  end loop;
end $$;

-- Ventas antiguas pagadas al contado: se crea el cobro que faltaba (una sola vez).
insert into public.payments (business_id, owner_id, customer_id, sale_id, amount, method, kind, paid_at, note)
select s.business_id, s.owner_id, s.customer_id, s.id, s.paid_amount, s.method, 'cobro', s.sale_date,
       'Cobro registrado por migración v2'
from public.sales s
where s.method <> 'fiado' and s.paid_amount > 0
  and not exists (select 1 from public.payments p where p.sale_id = s.id);

-- Nuevos usuarios: entran al negocio que los invitó, o crean uno propio.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv record; b uuid;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  select * into inv from public.business_invites where lower(email) = lower(new.email) limit 1;
  if found then
    insert into public.business_members (business_id, user_id, role, display_name)
    values (inv.business_id, new.id, inv.role, inv.display_name) on conflict do nothing;
    delete from public.business_invites where business_id = inv.business_id and lower(email) = lower(new.email);
  else
    insert into public.businesses (id) values (new.id) returning id into b;
    insert into public.business_members (business_id, user_id, role) values (b, new.id, 'admin');
    insert into public.business_settings (business_id, owner_id) values (b, new.id) on conflict do nothing;
    perform public.seed_business_defaults(b);
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Costeo en la base (mismo cálculo que lib/domain/costing.ts)
-- ---------------------------------------------------------------------------
create or replace function public.base_qty(q numeric, u text)
returns numeric language sql immutable as $$
  select q * case u when 'kg' then 1000 when 'l' then 1000 else 1 end
$$;

create or replace function public.business_param(b uuid, k text)
returns text language sql stable security definer set search_path = public as $$
  select nullif(params->>k, '') from public.business_settings where business_id = b
$$;

create or replace function public.recipe_unit_cost(p_recipe uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((
    select (coalesce(sum(public.base_qty(ri.quantity, ri.unit) * i.cost_per_unit), 0)
            + r.labor_minutes / 60.0 * coalesce(public.business_param(r.business_id, 'costo_mano_obra_hora')::numeric, 0)
            + r.other_cost) / nullif(r.yield_qty, 0)
    from public.recipes r
    left join public.recipe_ingredients ri on ri.recipe_id = r.id
    left join public.ingredients i on i.id = ri.ingredient_id
    where r.id = p_recipe
    group by r.id, r.labor_minutes, r.other_cost, r.yield_qty, r.business_id
  ), 0)
$$;

create or replace function public.product_unit_cost(p_product uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(case when p.recipe_id is not null then public.recipe_unit_cost(p.recipe_id) else 0 end, 0)
         + p.additional_cost + p.packaging_cost
  from public.products p where p.id = p_product
$$;

-- ---------------------------------------------------------------------------
-- 7. Operaciones atómicas (RPC). Todas validan negocio y permisos en el servidor.
-- ---------------------------------------------------------------------------

-- Idempotencia: reclama la clave; si ya existía devuelve el resultado anterior.
create or replace function public.claim_idempotency(b uuid, p_key text, p_fn text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if p_key is null or p_key = '' then return null; end if;
  begin
    insert into public.idempotency_keys (business_id, key, fn) values (b, p_key, p_fn);
    return null;
  exception when unique_violation then
    select result into r from public.idempotency_keys where business_id = b and key = p_key;
    return coalesce(r, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end;
end $$;

create or replace function public.finish_idempotency(b uuid, p_key text, p_result jsonb)
returns void language sql security definer set search_path = public as $$
  update public.idempotency_keys set result = p_result where business_id = b and key = p_key
$$;

create or replace function public.audit(b uuid, p_action text, p_table text, p_id uuid, p_details jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (business_id, user_id, action, table_name, record_id, details)
  values (b, auth.uid(), p_action, p_table, p_id, p_details)
$$;

-- Mueve stock de un producto y (según la regla) de sus ingredientes.
create or replace function public.move_product_stock(
  b uuid, p_product uuid, p_qty numeric, p_sign integer,
  p_source text, p_source_id uuid, p_consume_ingredients boolean)
returns void language plpgsql security definer set search_path = public as $$
declare pr record; ri record; v_yield numeric;
begin
  select * into pr from public.products where id = p_product and business_id = b;
  if not found then return; end if;

  update public.products set stock = stock + p_sign * p_qty where id = p_product;
  insert into public.inventory_movements (business_id, product_id, type, quantity, unit, reason, source_type, source_id)
  values (b, p_product, case when p_sign > 0 then 'entrada' else 'salida' end::inventory_movement_type,
          p_qty, 'unidad', p_source, p_source, p_source_id);

  if p_consume_ingredients and pr.recipe_id is not null then
    select yield_qty into v_yield from public.recipes where id = pr.recipe_id;
    if coalesce(v_yield, 0) > 0 then
      for ri in select x.ingredient_id, public.base_qty(x.quantity, x.unit) as bq, i.cost_per_unit
                from public.recipe_ingredients x join public.ingredients i on i.id = x.ingredient_id
                where x.recipe_id = pr.recipe_id loop
        update public.ingredients set stock = stock + p_sign * ri.bq * p_qty / v_yield where id = ri.ingredient_id;
        insert into public.inventory_movements (business_id, ingredient_id, type, quantity, unit, reason, source_type, source_id, unit_cost)
        values (b, ri.ingredient_id, case when p_sign > 0 then 'entrada' else 'salida' end::inventory_movement_type,
                ri.bq * p_qty / v_yield, 'base', p_source, p_source, p_source_id, ri.cost_per_unit);
      end loop;
    end if;
  end if;
end $$;

-- Crea una venta (con cobro si corresponde). p: {idempotency_key, customer_id, status,
-- method, paid_amount, notes, channel_id, sale_date, items:[{product_id,name,quantity,unit_price}]}
create or replace function public.rpc_create_sale(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b uuid := public.require_member();
  dup jsonb; it jsonb; v_sale public.sales; v_total numeric := 0; v_paid numeric;
  v_status text := coalesce(p->>'status', 'pagado'); v_method text := coalesce(p->>'method', 'efectivo');
  v_pid uuid; v_name text; v_consume boolean; v_result jsonb;
begin
  dup := public.claim_idempotency(b, p->>'idempotency_key', 'rpc_create_sale');
  if dup is not null then return dup; end if;

  if jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then
    raise exception 'Agrega al menos un producto a la venta.';
  end if;
  if v_status not in ('pagado','pendiente','abono') then raise exception 'Estado de pago inválido.'; end if;
  if v_status <> 'pagado' and nullif(p->>'customer_id','') is null then
    raise exception 'Para dejar saldo pendiente elige un cliente.';
  end if;

  for it in select * from jsonb_array_elements(p->'items') loop
    if coalesce((it->>'quantity')::numeric, 0) <= 0 then raise exception 'Hay una cantidad en cero o negativa.'; end if;
    if coalesce((it->>'unit_price')::numeric, -1) < 0 then raise exception 'Hay un precio inválido.'; end if;
    v_total := v_total + (it->>'quantity')::numeric * (it->>'unit_price')::numeric;
  end loop;

  v_paid := case v_status when 'pagado' then v_total
                          when 'abono' then least(greatest(coalesce((p->>'paid_amount')::numeric, 0), 0), v_total)
                          else 0 end;
  if v_status = 'abono' and v_paid >= v_total then v_status := 'pagado'; end if;

  insert into public.sales (business_id, customer_id, sale_date, subtotal, total, paid_amount, method, status,
                            notes, channel_id, order_id, updated_source)
  values (b, nullif(p->>'customer_id','')::uuid, coalesce((p->>'sale_date')::timestamptz, now()), v_total, v_total,
          v_paid, v_method,
          v_status::payment_status, nullif(p->>'notes',''), nullif(p->>'channel_id','')::uuid, nullif(p->>'order_id','')::uuid, 'app')
  returning * into v_sale;

  v_consume := coalesce(public.business_param(b, 'descontar_ingredientes_en'), 'venta') = 'venta';
  for it in select * from jsonb_array_elements(p->'items') loop
    v_pid := nullif(it->>'product_id','')::uuid;
    v_name := coalesce(nullif(it->>'name',''), (select name from public.products where id = v_pid), 'Producto');
    insert into public.sale_items (business_id, sale_id, product_id, name_snapshot, quantity, unit_price, line_total, unit_cost)
    values (b, v_sale.id, v_pid, v_name, (it->>'quantity')::numeric, (it->>'unit_price')::numeric,
            (it->>'quantity')::numeric * (it->>'unit_price')::numeric,
            case when v_pid is not null then public.product_unit_cost(v_pid) end);
    if v_pid is not null then
      perform public.move_product_stock(b, v_pid, (it->>'quantity')::numeric, -1, 'venta', v_sale.id, v_consume);
    end if;
  end loop;

  if v_paid > 0 then
    insert into public.payments (business_id, customer_id, sale_id, amount, method, kind, paid_at)
    values (b, v_sale.customer_id, v_sale.id, v_paid, v_method, 'cobro', v_sale.sale_date);
  end if;

  v_result := jsonb_build_object('id', v_sale.id, 'total', v_total, 'paid_amount', v_paid, 'status', v_status);
  perform public.finish_idempotency(b, p->>'idempotency_key', v_result);
  return v_result;
end $$;

-- Cobro / abono / reembolso. p: {idempotency_key, kind, amount, method, note,
-- customer_id?, sale_id?, order_id?}
create or replace function public.rpc_register_payment(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b uuid := public.require_member();
  dup jsonb; v_kind text := coalesce(p->>'kind', 'abono'); v_amount numeric := (p->>'amount')::numeric;
  v_method text := coalesce(nullif(p->>'method',''), 'efectivo'); v_remaining numeric; v_applied numeric;
  s record; v_order public.orders; v_debt numeric; v_result jsonb; v_count integer := 0;
begin
  dup := public.claim_idempotency(b, p->>'idempotency_key', 'rpc_register_payment');
  if dup is not null then return dup; end if;
  if coalesce(v_amount, 0) <= 0 then raise exception 'El monto debe ser mayor a cero.'; end if;

  if v_kind = 'reembolso' and nullif(p->>'order_id','') is not null then
    -- Devolución del abono de un pedido que no se entregó (por ejemplo, cancelado).
    select * into v_order from public.orders where id = (p->>'order_id')::uuid and business_id = b for update;
    if not found then raise exception 'Pedido no encontrado.'; end if;
    if v_order.sale_id is not null then raise exception 'Este pedido ya se entregó: el reembolso se hace sobre su venta.'; end if;
    if v_amount > v_order.deposit then
      raise exception 'El reembolso (%) supera lo abonado al pedido (%).', v_amount, v_order.deposit;
    end if;
    update public.orders set deposit = deposit - v_amount,
      payment_status = case when deposit - v_amount <= 0 then 'pendiente' else 'abono' end::payment_status
    where id = v_order.id;
    insert into public.payments (business_id, customer_id, order_id, amount, method, kind, note)
    values (b, v_order.customer_id, v_order.id, -v_amount, v_method, 'reembolso', nullif(p->>'note',''));
    perform public.audit(b, 'reembolso', 'orders', v_order.id, jsonb_build_object('monto', v_amount));
    v_result := jsonb_build_object('applied', v_amount, 'kind', 'reembolso');

  elsif v_kind = 'reembolso' then
    select * into s from public.sales where id = (p->>'sale_id')::uuid and business_id = b and voided_at is null;
    if not found then raise exception 'Elige la venta a reembolsar.'; end if;
    if v_amount > s.paid_amount then
      raise exception 'El reembolso (%) supera lo cobrado en esa venta (%).', v_amount, s.paid_amount;
    end if;
    update public.sales set paid_amount = paid_amount - v_amount,
      status = case when paid_amount - v_amount <= 0 then 'pendiente' else 'abono' end::payment_status
    where id = s.id;
    insert into public.payments (business_id, customer_id, sale_id, amount, method, kind, note)
    values (b, s.customer_id, s.id, -v_amount, v_method, 'reembolso', nullif(p->>'note',''));
    perform public.audit(b, 'reembolso', 'sales', s.id, jsonb_build_object('monto', v_amount));
    v_result := jsonb_build_object('applied', v_amount, 'kind', 'reembolso');

  elsif nullif(p->>'order_id','') is not null then
    select * into v_order from public.orders where id = (p->>'order_id')::uuid and business_id = b;
    if not found then raise exception 'Pedido no encontrado.'; end if;
    if v_order.sale_id is not null then
      -- Pedido ya entregado: el abono va a su venta.
      v_result := public.rpc_register_payment((p - 'order_id' - 'idempotency_key')
                  || jsonb_build_object('sale_id', v_order.sale_id, 'kind', 'abono'));
      perform public.finish_idempotency(b, p->>'idempotency_key', v_result);
      return v_result;
    end if;
    if v_amount > v_order.total - v_order.deposit then
      raise exception 'El abono supera el saldo del pedido (%).', v_order.total - v_order.deposit;
    end if;
    update public.orders set deposit = deposit + v_amount,
      payment_status = case when deposit + v_amount >= total then 'pagado' else 'abono' end::payment_status
    where id = v_order.id;
    insert into public.payments (business_id, customer_id, order_id, amount, method, kind, note)
    values (b, v_order.customer_id, v_order.id, v_amount, v_method, 'anticipo', nullif(p->>'note',''));
    v_result := jsonb_build_object('applied', v_amount, 'kind', 'anticipo');

  else
    select coalesce(sum(total - paid_amount), 0) into v_debt from public.sales
    where business_id = b and voided_at is null and status <> 'pagado'
      and (customer_id = nullif(p->>'customer_id','')::uuid or id = nullif(p->>'sale_id','')::uuid);
    if v_debt <= 0 then raise exception 'No hay saldo pendiente que cobrar.'; end if;
    if v_amount > v_debt then raise exception 'El pago (%) supera la deuda pendiente (%).', v_amount, v_debt; end if;

    v_remaining := v_amount;
    for s in select * from public.sales
             where business_id = b and voided_at is null and status <> 'pagado'
               and (customer_id = nullif(p->>'customer_id','')::uuid or id = nullif(p->>'sale_id','')::uuid)
             order by sale_date, created_at loop
      exit when v_remaining <= 0;
      v_applied := least(s.total - s.paid_amount, v_remaining);
      update public.sales set paid_amount = paid_amount + v_applied,
        status = case when paid_amount + v_applied >= total then 'pagado' else 'abono' end::payment_status
      where id = s.id;
      insert into public.payments (business_id, customer_id, sale_id, amount, method, kind, note)
      values (b, s.customer_id, s.id, v_applied, v_method, v_kind, nullif(p->>'note',''));
      v_remaining := v_remaining - v_applied;
      v_count := v_count + 1;
    end loop;
    v_result := jsonb_build_object('applied', v_amount, 'sales', v_count, 'kind', v_kind);
  end if;

  perform public.finish_idempotency(b, p->>'idempotency_key', v_result);
  return v_result;
end $$;

-- Anula una venta: repone stock, anula sus cobros y deja rastro.
create or replace function public.rpc_void_sale(p_sale uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b uuid := public.require_member(); s public.sales; it record; v_consume boolean;
begin
  select * into s from public.sales where id = p_sale and business_id = b for update;
  if not found then raise exception 'Venta no encontrada.'; end if;
  if s.voided_at is not null then return jsonb_build_object('id', s.id, 'already', true); end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Indica el motivo de la anulación.'; end if;

  v_consume := coalesce(public.business_param(b, 'descontar_ingredientes_en'), 'venta') = 'venta';
  for it in select product_id, quantity from public.sale_items where sale_id = s.id and product_id is not null loop
    perform public.move_product_stock(b, it.product_id, it.quantity, 1, 'anulacion_venta', s.id, v_consume);
  end loop;
  update public.sales set voided_at = now(), void_reason = p_reason where id = s.id;
  update public.payments set voided_at = now() where sale_id = s.id and voided_at is null;
  update public.orders set sale_id = null, status = 'listo', delivered_at = null where sale_id = s.id;
  update public.payments set sale_id = null, voided_at = null
    where order_id is not null and kind = 'anticipo' and sale_id = s.id;
  perform public.audit(b, 'anular_venta', 'sales', s.id, jsonb_build_object('motivo', p_reason, 'total', s.total));
  return jsonb_build_object('id', s.id, 'voided', true);
end $$;

-- Pedido nuevo. p: {idempotency_key, customer_id? | new_customer:{name,phone},
-- order_date, order_time, notes, channel_id, deposit, method,
-- items:[{product_id?, name?, unit_price?, quantity, details}]}
create or replace function public.rpc_create_order(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b uuid := public.require_member(); dup jsonb; it jsonb; pr public.products; v_order public.orders;
  v_customer uuid := nullif(p->>'customer_id','')::uuid; v_total numeric := 0; v_price numeric; v_name text;
  v_code text; v_deposit numeric := coalesce((p->>'deposit')::numeric, 0); v_result jsonb;
begin
  dup := public.claim_idempotency(b, p->>'idempotency_key', 'rpc_create_order');
  if dup is not null then return dup; end if;
  if jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then raise exception 'Agrega al menos un producto al pedido.'; end if;
  if nullif(p->>'order_date','') is null then raise exception 'Indica la fecha de entrega.'; end if;

  if v_customer is null and p ? 'new_customer' and coalesce(trim(p->'new_customer'->>'name'), '') <> '' then
    insert into public.customers (business_id, name, phone)
    values (b, trim(p->'new_customer'->>'name'), nullif(trim(p->'new_customer'->>'phone'), ''))
    returning id into v_customer;
  end if;

  select '#' || (coalesce(max(nullif(regexp_replace(code, '\D', '', 'g'), '')::int), 1000) + 1)
    into v_code from public.orders where business_id = b;

  insert into public.orders (business_id, code, customer_id, order_date, order_time, status, payment_status,
                             total, deposit, notes, channel_id, updated_source)
  values (b, v_code, v_customer, (p->>'order_date')::date, nullif(p->>'order_time','')::time,
          coalesce(public.business_param(b, 'estado_inicial_pedido'), 'pendiente'), 'pendiente',
          0, 0, nullif(p->>'notes',''), nullif(p->>'channel_id','')::uuid, 'app')
  returning * into v_order;

  for it in select * from jsonb_array_elements(p->'items') loop
    if coalesce((it->>'quantity')::numeric, 0) <= 0 then raise exception 'Hay una cantidad en cero o negativa.'; end if;
    if nullif(it->>'product_id','') is not null then
      select * into pr from public.products where id = (it->>'product_id')::uuid and business_id = b;
      if not found then raise exception 'Un producto del pedido no existe.'; end if;
      if not pr.is_active then raise exception 'El producto "%" está inactivo y no se puede pedir.', pr.name; end if;
      v_price := pr.sale_price; v_name := pr.name;
    else
      v_price := coalesce((it->>'unit_price')::numeric, -1);
      v_name := nullif(trim(it->>'name'), '');
      if v_name is null or v_price < 0 then raise exception 'Un producto personalizado necesita nombre y precio.'; end if;
    end if;
    insert into public.order_items (business_id, order_id, product_id, name_snapshot, quantity, unit_price, line_total, details)
    values (b, v_order.id, nullif(it->>'product_id','')::uuid, v_name, (it->>'quantity')::numeric, v_price,
            (it->>'quantity')::numeric * v_price, nullif(it->>'details',''));
    v_total := v_total + (it->>'quantity')::numeric * v_price;
  end loop;

  if v_deposit < 0 or v_deposit > v_total then raise exception 'El abono debe estar entre 0 y el total del pedido.'; end if;
  update public.orders set total = v_total, deposit = v_deposit,
    payment_status = case when v_deposit <= 0 then 'pendiente' when v_deposit >= v_total then 'pagado' else 'abono' end::payment_status
  where id = v_order.id;

  if v_deposit > 0 then
    insert into public.payments (business_id, customer_id, order_id, amount, method, kind)
    values (b, v_customer, v_order.id, v_deposit, coalesce(nullif(p->>'method',''), 'efectivo'), 'anticipo');
  end if;

  v_result := jsonb_build_object('id', v_order.id, 'code', v_code, 'total', v_total, 'customer_id', v_customer);
  perform public.finish_idempotency(b, p->>'idempotency_key', v_result);
  return v_result;
end $$;

-- Cambia el estado. "entregado" genera la venta (una sola vez) y traspasa los anticipos.
create or replace function public.rpc_set_order_status(p_order uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b uuid := public.require_member(); o public.orders; v_sale uuid; v_cost numeric; it record; v_consume boolean;
begin
  select * into o from public.orders where id = p_order and business_id = b for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;
  if not exists (select 1 from public.order_statuses where business_id = b and code = p_status and is_active) then
    raise exception 'El estado "%" no existe o está inactivo.', p_status;
  end if;
  if o.status = p_status then return jsonb_build_object('id', o.id, 'status', p_status, 'unchanged', true); end if;
  if o.sale_id is not null and p_status <> 'entregado' then
    raise exception 'Este pedido ya generó una venta. Para revertirlo, anula la venta.';
  end if;

  if p_status = 'entregado' and o.sale_id is null then
    insert into public.sales (business_id, customer_id, sale_date, subtotal, total, paid_amount, method, status,
                              notes, channel_id, order_id, updated_source)
    values (b, o.customer_id, now(), o.total, o.total, o.deposit, 'efectivo',
            case when o.deposit >= o.total then 'pagado' when o.deposit > 0 then 'abono' else 'pendiente' end::payment_status,
            'Pedido ' || coalesce(o.code, ''), o.channel_id, o.id, 'app')
    returning id into v_sale;
    v_consume := coalesce(public.business_param(b, 'descontar_ingredientes_en'), 'venta') = 'venta';
    for it in select * from public.order_items where order_id = o.id loop
      v_cost := case when it.product_id is not null then public.product_unit_cost(it.product_id) end;
      insert into public.sale_items (business_id, sale_id, product_id, name_snapshot, quantity, unit_price, line_total, unit_cost)
      values (b, v_sale, it.product_id, it.name_snapshot, it.quantity, it.unit_price, it.line_total, v_cost);
      if it.product_id is not null then
        perform public.move_product_stock(b, it.product_id, it.quantity, -1, 'venta', v_sale, v_consume);
      end if;
    end loop;
    update public.payments set sale_id = v_sale where order_id = o.id and kind = 'anticipo' and voided_at is null;
    update public.orders set status = p_status, sale_id = v_sale, delivered_at = now() where id = o.id;
    return jsonb_build_object('id', o.id, 'status', p_status, 'sale_id', v_sale);
  end if;

  update public.orders set status = p_status where id = o.id;
  return jsonb_build_object('id', o.id, 'status', p_status,
    'warning', case when p_status = 'cancelado' and o.deposit > 0
                    then 'El pedido tenía un abono: si lo devuelves, regístralo como reembolso.' end);
end $$;

-- Gasto operativo (no compras de inventario).
create or replace function public.rpc_add_expense(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b uuid := public.require_member(); dup jsonb; v_id uuid; v_result jsonb;
begin
  dup := public.claim_idempotency(b, p->>'idempotency_key', 'rpc_add_expense');
  if dup is not null then return dup; end if;
  if coalesce((p->>'amount')::numeric, 0) <= 0 then raise exception 'El monto debe ser mayor a cero.'; end if;
  if coalesce(trim(p->>'description'), '') = '' then raise exception 'Escribe una descripción del gasto.'; end if;
  insert into public.expenses (business_id, category, description, amount, expense_date, method, notes, receipt_url, updated_source)
  values (b, nullif(p->>'category',''), trim(p->>'description'), (p->>'amount')::numeric,
          coalesce(nullif(p->>'expense_date','')::date, current_date), coalesce(nullif(p->>'method',''), 'efectivo'),
          nullif(p->>'notes',''), nullif(p->>'receipt_url',''), 'app')
  returning id into v_id;
  v_result := jsonb_build_object('id', v_id);
  perform public.finish_idempotency(b, p->>'idempotency_key', v_result);
  return v_result;
end $$;

create or replace function public.rpc_void_expense(p_expense uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b uuid := public.require_member(); e public.expenses;
begin
  select * into e from public.expenses where id = p_expense and business_id = b;
  if not found then raise exception 'Gasto no encontrado.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Indica el motivo de la anulación.'; end if;
  update public.expenses set voided_at = now(), void_reason = p_reason where id = e.id and voided_at is null;
  perform public.audit(b, 'anular_gasto', 'expenses', e.id, jsonb_build_object('motivo', p_reason, 'monto', e.amount));
  return jsonb_build_object('id', e.id, 'voided', true);
end $$;

-- Compra de insumos: entra a inventario (no es gasto) y actualiza el costo.
-- p: {idempotency_key, supplier_id, purchase_date, notes, paid_amount, method,
--     items:[{ingredient_id, quantity, unit, line_total}]}
create or replace function public.rpc_register_purchase(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b uuid := public.require_member(); dup jsonb; it jsonb; v_id uuid; v_total numeric := 0; v_bq numeric;
  v_paid numeric := coalesce((p->>'paid_amount')::numeric, 0); ing public.ingredients; v_new_cost numeric;
  v_policy text; v_result jsonb; v_supplier uuid := nullif(p->>'supplier_id','')::uuid;
begin
  dup := public.claim_idempotency(b, p->>'idempotency_key', 'rpc_register_purchase');
  if dup is not null then return dup; end if;
  if jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then raise exception 'Agrega al menos un insumo.'; end if;
  v_policy := coalesce(public.business_param(b, 'politica_costo_compra'), 'ultimo');

  -- Proveedor por nombre (la app lo escribe como texto): se busca o se crea.
  if v_supplier is null and coalesce(trim(p->>'supplier_name'), '') <> '' then
    select id into v_supplier from public.suppliers
    where business_id = b and lower(name) = lower(trim(p->>'supplier_name')) limit 1;
    if v_supplier is null then
      insert into public.suppliers (business_id, name) values (b, trim(p->>'supplier_name')) returning id into v_supplier;
    end if;
  end if;
  p := p || jsonb_build_object('supplier_id', v_supplier);

  insert into public.purchases (business_id, supplier_id, purchase_date, notes, updated_source)
  values (b, v_supplier, coalesce(nullif(p->>'purchase_date','')::date, current_date),
          nullif(p->>'notes',''), 'app')
  returning id into v_id;

  for it in select * from jsonb_array_elements(p->'items') loop
    select * into ing from public.ingredients where id = (it->>'ingredient_id')::uuid and business_id = b for update;
    if not found then raise exception 'Un insumo de la compra no existe.'; end if;
    if coalesce((it->>'quantity')::numeric, 0) <= 0 or coalesce((it->>'line_total')::numeric, -1) < 0 then
      raise exception 'Revisa cantidades y montos de la compra.';
    end if;
    v_bq := public.base_qty((it->>'quantity')::numeric, it->>'unit');
    v_new_cost := case
      when v_policy = 'promedio' and ing.stock > 0
        then (ing.stock * ing.cost_per_unit + (it->>'line_total')::numeric) / (ing.stock + v_bq)
      else (it->>'line_total')::numeric / v_bq end;
    insert into public.purchase_items (business_id, purchase_id, ingredient_id, quantity, unit, line_total, unit_cost_base)
    values (b, v_id, ing.id, (it->>'quantity')::numeric, it->>'unit', (it->>'line_total')::numeric,
            (it->>'line_total')::numeric / v_bq);
    update public.ingredients set stock = stock + v_bq, cost_per_unit = v_new_cost, last_purchase_at = now(),
      supplier = coalesce((select name from public.suppliers where id = nullif(p->>'supplier_id','')::uuid), supplier),
      updated_source = 'app'
    where id = ing.id;
    insert into public.inventory_movements (business_id, ingredient_id, type, quantity, unit, reason, source_type, source_id, unit_cost)
    values (b, ing.id, 'entrada', v_bq, 'base', 'compra', 'compra', v_id, (it->>'line_total')::numeric / v_bq);
    v_total := v_total + (it->>'line_total')::numeric;
  end loop;

  if v_paid < 0 or v_paid > v_total then raise exception 'El monto pagado debe estar entre 0 y el total.'; end if;
  update public.purchases set total = v_total, paid_amount = v_paid,
    status = case when v_paid >= v_total then 'pagada' when v_paid > 0 then 'parcial' else 'pendiente' end
  where id = v_id;
  if v_paid > 0 then
    insert into public.supplier_payments (business_id, supplier_id, purchase_id, amount, method)
    values (b, nullif(p->>'supplier_id','')::uuid, v_id, v_paid, coalesce(nullif(p->>'method',''), 'efectivo'));
  end if;
  v_result := jsonb_build_object('id', v_id, 'total', v_total);
  perform public.finish_idempotency(b, p->>'idempotency_key', v_result);
  return v_result;
end $$;

-- Pago a proveedor de una compra pendiente.
create or replace function public.rpc_pay_supplier(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b uuid := public.require_member(); dup jsonb; pu public.purchases; v_amount numeric := (p->>'amount')::numeric;
begin
  dup := public.claim_idempotency(b, p->>'idempotency_key', 'rpc_pay_supplier');
  if dup is not null then return dup; end if;
  select * into pu from public.purchases where id = (p->>'purchase_id')::uuid and business_id = b and voided_at is null for update;
  if not found then raise exception 'Compra no encontrada.'; end if;
  if coalesce(v_amount, 0) <= 0 or v_amount > pu.total - pu.paid_amount then
    raise exception 'El pago debe ser mayor a cero y no superar el saldo (%).', pu.total - pu.paid_amount;
  end if;
  update public.purchases set paid_amount = paid_amount + v_amount,
    status = case when paid_amount + v_amount >= total then 'pagada' else 'parcial' end where id = pu.id;
  insert into public.supplier_payments (business_id, supplier_id, purchase_id, amount, method)
  values (b, pu.supplier_id, pu.id, v_amount, coalesce(nullif(p->>'method',''), 'efectivo'));
  perform public.finish_idempotency(b, p->>'idempotency_key', jsonb_build_object('id', pu.id));
  return jsonb_build_object('id', pu.id, 'paid', v_amount);
end $$;

-- Producción: suma unidades del producto y (si la regla lo indica) consume ingredientes.
create or replace function public.rpc_register_production(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b uuid := public.require_member(); dup jsonb; r public.recipes; v_product uuid := nullif(p->>'product_id','')::uuid;
  v_batches numeric := coalesce((p->>'batches')::numeric, 1); v_units numeric; v_id uuid; ri record; v_consume boolean;
begin
  dup := public.claim_idempotency(b, p->>'idempotency_key', 'rpc_register_production');
  if dup is not null then return dup; end if;
  select * into r from public.recipes where id = (p->>'recipe_id')::uuid and business_id = b;
  if not found then raise exception 'Elige la receta producida.'; end if;
  if v_batches <= 0 then raise exception 'La cantidad de lotes debe ser mayor a cero.'; end if;
  v_units := coalesce(nullif(p->>'units','')::numeric, v_batches * r.yield_qty);
  v_consume := coalesce(public.business_param(b, 'descontar_ingredientes_en'), 'venta') = 'produccion';

  insert into public.production (business_id, recipe_id, product_id, batches, units, unit_cost, produced_at, notes, updated_source)
  values (b, r.id, v_product, v_batches, v_units, public.recipe_unit_cost(r.id),
          coalesce(nullif(p->>'produced_at','')::timestamptz, now()), nullif(p->>'notes',''), 'app')
  returning id into v_id;

  if v_consume then
    for ri in select x.ingredient_id, public.base_qty(x.quantity, x.unit) as bq
              from public.recipe_ingredients x where x.recipe_id = r.id loop
      update public.ingredients set stock = stock - ri.bq * v_batches where id = ri.ingredient_id;
      insert into public.inventory_movements (business_id, ingredient_id, type, quantity, unit, reason, source_type, source_id)
      values (b, ri.ingredient_id, 'salida', ri.bq * v_batches, 'base', 'produccion', 'produccion', v_id);
    end loop;
  end if;
  if v_product is not null then
    update public.products set stock = stock + v_units where id = v_product and business_id = b;
    insert into public.inventory_movements (business_id, product_id, type, quantity, unit, reason, source_type, source_id)
    values (b, v_product, 'entrada', v_units, 'unidad', 'produccion', 'produccion', v_id);
  end if;
  perform public.finish_idempotency(b, p->>'idempotency_key', jsonb_build_object('id', v_id));
  return jsonb_build_object('id', v_id, 'units', v_units);
end $$;

create or replace function public.rpc_owner_movement(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b uuid := public.require_member('admin'); dup jsonb; v_id uuid;
begin
  dup := public.claim_idempotency(b, p->>'idempotency_key', 'rpc_owner_movement');
  if dup is not null then return dup; end if;
  if p->>'kind' not in ('aporte','retiro') then raise exception 'Tipo inválido: aporte o retiro.'; end if;
  insert into public.owner_movements (business_id, kind, amount, method, movement_date, notes, updated_source)
  values (b, p->>'kind', (p->>'amount')::numeric, coalesce(nullif(p->>'method',''), 'efectivo'),
          coalesce(nullif(p->>'movement_date','')::date, current_date), nullif(p->>'notes',''), 'app')
  returning id into v_id;
  perform public.audit(b, p->>'kind', 'owner_movements', v_id, p - 'idempotency_key');
  perform public.finish_idempotency(b, p->>'idempotency_key', jsonb_build_object('id', v_id));
  return jsonb_build_object('id', v_id);
end $$;

-- Invitar a una persona (solo admin). Luego se crea su usuario en Supabase Auth.
create or replace function public.rpc_invite_member(p_email text, p_role text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b uuid := public.require_member('admin'); u uuid;
begin
  if p_role not in ('admin','operador') then raise exception 'Rol inválido.'; end if;
  select id into u from auth.users where lower(email) = lower(p_email);
  if u is not null then
    insert into public.business_members (business_id, user_id, role, display_name) values (b, u, p_role, p_name)
    on conflict (business_id, user_id) do update set role = excluded.role, display_name = excluded.display_name;
  else
    insert into public.business_invites (business_id, email, role, display_name) values (b, lower(p_email), p_role, p_name)
    on conflict (business_id, email) do update set role = excluded.role, display_name = excluded.display_name;
  end if;
  perform public.audit(b, 'invitar_miembro', 'business_members', u, jsonb_build_object('email', p_email, 'rol', p_role));
  return jsonb_build_object('email', p_email, 'role', p_role, 'existing_user', u is not null);
end $$;

-- ---------------------------------------------------------------------------
-- 8. Vistas de cuentas por cobrar / pagar (respetan RLS)
-- ---------------------------------------------------------------------------
create or replace view public.v_receivables with (security_invoker = true) as
select s.business_id, s.customer_id, c.name as customer_name,
       count(*) as sales_count, sum(s.total - s.paid_amount) as balance, min(s.sale_date) as oldest
from public.sales s left join public.customers c on c.id = s.customer_id
where s.voided_at is null and s.status <> 'pagado'
group by s.business_id, s.customer_id, c.name;

create or replace view public.v_payables with (security_invoker = true) as
select pu.business_id, pu.supplier_id, su.name as supplier_name,
       count(*) as purchases_count, sum(pu.total - pu.paid_amount) as balance, min(pu.purchase_date) as oldest
from public.purchases pu left join public.suppliers su on su.id = pu.supplier_id
where pu.voided_at is null and pu.status <> 'pagada'
group by pu.business_id, pu.supplier_id, su.name;

-- ---------------------------------------------------------------------------
-- 9. Row Level Security por negocio y rol
--    Lectura: miembros. Escritura de configuración: admin. Operación: miembros.
--    Borrado físico: solo admin (lo normal es anular).
-- ---------------------------------------------------------------------------
do $$
declare t text; pol record;
begin
  -- Configuración: leen todos, escribe admin.
  foreach t in array array[
    'business_settings','categories','suppliers','ingredients','recipes','recipe_ingredients',
    'products','payment_methods','order_statuses','channels','goals','product_costs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    execute format('create policy biz_select on public.%I for select using (public.is_member(business_id))', t);
    execute format('create policy biz_insert on public.%I for insert with check (public.is_admin(coalesce(business_id, public.current_business_id())))', t);
    execute format('create policy biz_update on public.%I for update using (public.is_admin(business_id)) with check (public.is_admin(business_id))', t);
    execute format('create policy biz_delete on public.%I for delete using (public.is_admin(business_id))', t);
  end loop;

  -- Operación: leen y escriben miembros; borra admin.
  foreach t in array array[
    'customers','sales','sale_items','payments','expenses','orders','order_items',
    'inventory_movements','purchases','purchase_items','supplier_payments','production',
    'ingredient_purchases','customer_account_movements','cash_registers','cash_movements','notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    execute format('create policy biz_select on public.%I for select using (public.is_member(business_id))', t);
    execute format('create policy biz_insert on public.%I for insert with check (public.is_member(coalesce(business_id, public.current_business_id())))', t);
    execute format('create policy biz_update on public.%I for update using (public.is_member(business_id)) with check (public.is_member(business_id))', t);
    execute format('create policy biz_delete on public.%I for delete using (public.is_admin(business_id))', t);
  end loop;

  -- Solo lectura para miembros; escritura únicamente vía funciones/servidor.
  foreach t in array array[
    'owner_movements','ingredient_cost_history','audit_log','idempotency_keys',
    'sync_runs','sync_log','sync_conflicts'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    execute format('create policy biz_select on public.%I for select using (public.is_admin(business_id))', t);
  end loop;
end $$;

-- owner_movements lo ven ambos (es información del negocio), lo crea solo admin por RPC.
drop policy if exists biz_select on public.owner_movements;
create policy biz_select on public.owner_movements for select using (public.is_member(business_id));

alter table public.businesses enable row level security;
drop policy if exists biz_select on public.businesses;
create policy biz_select on public.businesses for select using (public.is_member(id));
drop policy if exists biz_update on public.businesses;
create policy biz_update on public.businesses for update using (public.is_admin(id)) with check (public.is_admin(id));

alter table public.business_members enable row level security;
drop policy if exists members_select on public.business_members;
create policy members_select on public.business_members for select using (public.is_member(business_id));

alter table public.business_invites enable row level security;
drop policy if exists invites_select on public.business_invites;
create policy invites_select on public.business_invites for select using (public.is_admin(business_id));

-- Las funciones RPC las puede llamar un usuario autenticado; no los anónimos.
do $$
declare f text;
begin
  foreach f in array array[
    'rpc_create_sale(jsonb)','rpc_register_payment(jsonb)','rpc_void_sale(uuid,text)',
    'rpc_create_order(jsonb)','rpc_set_order_status(uuid,text)','rpc_add_expense(jsonb)',
    'rpc_void_expense(uuid,text)','rpc_register_purchase(jsonb)','rpc_pay_supplier(jsonb)',
    'rpc_register_production(jsonb)','rpc_owner_movement(jsonb)','rpc_invite_member(text,text,text)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    begin execute format('grant execute on function public.%s to authenticated', f);
    exception when undefined_object then null; end;
  end loop;
end $$;

-- Índices
create index if not exists idx_sales_business_date on public.sales(business_id, sale_date);
create index if not exists idx_payments_business_date on public.payments(business_id, paid_at);
create index if not exists idx_orders_business_date on public.orders(business_id, order_date);
create index if not exists idx_expenses_business_date on public.expenses(business_id, expense_date);
create index if not exists idx_products_business on public.products(business_id);
create index if not exists idx_ingredients_business on public.ingredients(business_id);
create index if not exists idx_sync_log_business on public.sync_log(business_id, created_at);

commit;
