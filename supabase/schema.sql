-- ============================================================================
--  Sarah & Tin — Esquema de base de datos (Supabase / PostgreSQL)
--  Ejecuta este archivo completo en:  Supabase -> SQL Editor -> New query
--
--  Diseño: cada negocio es una cuenta (auth.users). Todas las tablas guardan
--  owner_id = auth.uid() y usan Row Level Security para que cada usuaria vea
--  únicamente sus propios datos.
--
--  Nota: esto es una herramienta de gestión interna, no contabilidad tributaria.
-- ============================================================================

-- ---------- Tipos (enums) ---------------------------------------------------
do $$ begin
  create type payment_method as enum ('efectivo','transferencia','debito','credito','fiado','otro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pagado','pendiente','abono');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('pendiente','confirmado','en_preparacion','listo','entregado','cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type movement_type as enum ('ingreso','egreso');
exception when duplicate_object then null; end $$;

do $$ begin
  create type inventory_movement_type as enum ('entrada','salida','ajuste');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_movement_type as enum ('cargo','abono');
exception when duplicate_object then null; end $$;

do $$ begin
  create type category_kind as enum ('producto','gasto','ingrediente');
exception when duplicate_object then null; end $$;

-- ---------- Utilidad: updated_at automático ---------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================================
--  Perfil y configuración del negocio
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Sarah & Tin',
  tagline text default 'Pastelería artesanal',
  logo_url text,
  currency text not null default 'CLP',
  target_margin numeric(5,4) not null default 0.60,
  rounding integer not null default 100,
  phone text,
  address text,
  product_categories text[] not null default '{}',
  expense_categories text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id)
);
-- Para instalaciones existentes (re-ejecutar el script es seguro):
alter table public.business_settings
  add column if not exists product_categories text[] not null default '{}';
alter table public.business_settings
  add column if not exists expense_categories text[] not null default '{}';

drop trigger if exists trg_business_updated on public.business_settings;
create trigger trg_business_updated before update on public.business_settings
  for each row execute function public.set_updated_at();

-- ============================================================================
--  Categorías, proveedores
-- ============================================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind category_kind not null default 'producto',
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================================
--  Ingredientes e inventario
-- ============================================================================
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,                                  -- categoría (texto libre)
  unit text not null default 'g',                 -- unidad base: g, ml, unidad
  stock numeric(12,3) not null default 0,
  min_stock numeric(12,3) not null default 0,
  cost_per_unit numeric(12,4) not null default 0, -- costo por unidad base
  supplier text,                                  -- proveedor (texto libre)
  last_purchase_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_ingredients_updated on public.ingredients;
create trigger trg_ingredients_updated before update on public.ingredients
  for each row execute function public.set_updated_at();

create table if not exists public.ingredient_purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity numeric(12,3) not null,        -- cantidad comprada (en unidad de compra)
  unit text not null,                     -- kg, l, unidad
  total_cost numeric(12,2) not null,
  unit_cost numeric(12,4) not null default 0,  -- costo por unidad base calculado
  supplier text,                          -- proveedor (texto libre)
  purchased_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  type inventory_movement_type not null,
  quantity numeric(12,3) not null,
  unit text not null,
  reason text,
  reference text,
  created_at timestamptz not null default now()
);

-- ============================================================================
--  Recetas
-- ============================================================================
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  yield_qty numeric(12,3) not null default 1,     -- rendimiento (unidades/porciones)
  yield_unit text not null default 'unidad',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_recipes_updated on public.recipes;
create trigger trg_recipes_updated before update on public.recipes
  for each row execute function public.set_updated_at();

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric(12,3) not null,        -- cantidad usada
  unit text not null                      -- unidad de la cantidad (g, ml, unidad)
);

-- ============================================================================
--  Productos y costos adicionales
-- ============================================================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  category text,                          -- categoría (texto libre)
  image_url text,
  sale_price numeric(12,2) not null default 0,
  recipe_id uuid references public.recipes(id) on delete set null,
  additional_cost numeric(12,2) not null default 0,
  stock numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();

create table if not exists public.product_costs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null,                    -- Envase, Caja, Mano de obra, Delivery...
  amount numeric(12,2) not null default 0
);

-- ============================================================================
--  Clientes, cuentas y pagos
-- ============================================================================
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================================
--  Ventas
-- ============================================================================
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  sale_date timestamptz not null default now(),
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  method payment_method not null default 'efectivo',
  status payment_status not null default 'pagado',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name_snapshot text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0
);

-- Movimientos de cuenta del cliente (deuda). Nunca se borra la deuda original.
create table if not exists public.customer_account_movements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  type account_movement_type not null,    -- cargo (aumenta deuda) / abono (paga)
  amount numeric(12,2) not null,
  balance_after numeric(12,2) not null default 0,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  sale_id uuid references public.sales(id) on delete set null,
  amount numeric(12,2) not null,
  method payment_method not null default 'efectivo',
  note text,
  paid_at timestamptz not null default now()
);

-- ============================================================================
--  Caja
-- ============================================================================
create table if not exists public.cash_registers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_balance numeric(12,2) not null default 0,
  closing_balance numeric(12,2),
  is_open boolean not null default true
);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  register_id uuid references public.cash_registers(id) on delete set null,
  type movement_type not null,
  category text,
  description text,
  amount numeric(12,2) not null,
  method payment_method not null default 'efectivo',
  reference text,
  created_at timestamptz not null default now()
);

-- ============================================================================
--  Gastos
-- ============================================================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  category text,                          -- categoría (texto libre)
  description text not null,
  amount numeric(12,2) not null,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ============================================================================
--  Pedidos
-- ============================================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text,
  customer_id uuid references public.customers(id) on delete set null,
  order_date date not null default current_date,
  order_time time,
  status order_status not null default 'pendiente',
  payment_status payment_status not null default 'pendiente',
  total numeric(12,2) not null default 0,
  deposit numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name_snapshot text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  details text
);

-- ============================================================================
--  Notificaciones
-- ============================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================================
--  Compatibilidad: si ya creaste las tablas con una versión anterior, estas
--  líneas agregan las columnas de texto que usa la app (seguro re-ejecutar).
-- ============================================================================
alter table public.ingredients add column if not exists category text;
alter table public.ingredients add column if not exists supplier text;
alter table public.ingredient_purchases add column if not exists supplier text;
alter table public.products add column if not exists category text;
alter table public.expenses add column if not exists category text;

-- ============================================================================
--  Índices útiles
-- ============================================================================
create index if not exists idx_ingredients_owner on public.ingredients(owner_id);
create index if not exists idx_products_owner on public.products(owner_id);
create index if not exists idx_sales_owner_date on public.sales(owner_id, sale_date);
create index if not exists idx_sale_items_sale on public.sale_items(sale_id);
create index if not exists idx_orders_owner_date on public.orders(owner_id, order_date);
create index if not exists idx_expenses_owner_date on public.expenses(owner_id, expense_date);
create index if not exists idx_cash_movements_owner on public.cash_movements(owner_id, created_at);
create index if not exists idx_account_mov_customer on public.customer_account_movements(customer_id);

-- ============================================================================
--  Row Level Security: cada usuaria solo ve y edita sus propios datos
-- ============================================================================
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
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "own_select" on public.%I;', t);
    execute format('drop policy if exists "own_insert" on public.%I;', t);
    execute format('drop policy if exists "own_update" on public.%I;', t);
    execute format('drop policy if exists "own_delete" on public.%I;', t);
    execute format('create policy "own_select" on public.%I for select using (owner_id = auth.uid());', t);
    execute format('create policy "own_insert" on public.%I for insert with check (owner_id = auth.uid());', t);
    execute format('create policy "own_update" on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());', t);
    execute format('create policy "own_delete" on public.%I for delete using (owner_id = auth.uid());', t);
  end loop;
end $$;

-- profiles: cada quien ve/edita su propia fila
alter table public.profiles enable row level security;
drop policy if exists "profile_select" on public.profiles;
drop policy if exists "profile_update" on public.profiles;
drop policy if exists "profile_insert" on public.profiles;
create policy "profile_select" on public.profiles for select using (id = auth.uid());
create policy "profile_update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profile_insert" on public.profiles for insert with check (id = auth.uid());

-- ============================================================================
--  Al registrarse un usuario: crear su perfil y su configuración de negocio
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Camila'))
  on conflict (id) do nothing;

  insert into public.business_settings (owner_id)
  values (new.id)
  on conflict (owner_id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
