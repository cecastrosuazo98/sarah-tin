-- ============================================================================
--  Sarah & Tin 2.0 — Migración 002: vistas para la matriz de Google Sheets
--  Cada vista entrega las columnas de una hoja (mismas claves que
--  lib/sync/sheet-schema.json), incluidas las calculadas. Solo lectura.
--  Reversión: 002_v2_vistas_sync_down.sql
-- ============================================================================

begin;

alter table public.sync_conflicts add column if not exists summary text;

-- Bases creadas con una versión antigua del esquema pueden no tener created_at
-- en algunas tablas; las vistas lo usan para ordenar.
do $$
declare t text;
begin
  foreach t in array array[
    'business_settings','categories','suppliers','ingredients','ingredient_purchases','inventory_movements',
    'recipes','recipe_ingredients','products','product_costs','customers','sales','sale_items','payments',
    'expenses','orders','order_items','notifications','customer_account_movements'
  ] loop
    execute format('alter table public.%I add column if not exists created_at timestamptz not null default now()', t);
  end loop;
end $$;

-- Costos y estado de costeo -------------------------------------------------
create or replace function public.ingredient_cost_status(i public.ingredients)
returns text language sql stable security definer set search_path = public as $$
  select case
    when coalesce(i.cost_per_unit, 0) <= 0 then 'PENDIENTE DE COSTEO'
    when i.last_purchase_at is not null and i.last_purchase_at <
         now() - make_interval(days => coalesce(public.business_param(i.business_id, 'dias_costo_desactualizado')::int, 90))
      then 'COSTO DESACTUALIZADO'
    else 'OK' end
$$;

create or replace function public.recipe_cost_status(p_recipe uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when r.yield_qty <= 0 then 'PENDIENTE: rendimiento en cero'
    when not exists (select 1 from public.recipe_ingredients x where x.recipe_id = r.id) then 'PENDIENTE: sin ingredientes'
    when exists (select 1 from public.recipe_ingredients x join public.ingredients i on i.id = x.ingredient_id
                 where x.recipe_id = r.id and coalesce(i.cost_per_unit, 0) <= 0) then 'PENDIENTE DE COSTEO'
    when exists (select 1 from public.recipe_ingredients x join public.ingredients i on i.id = x.ingredient_id
                 where x.recipe_id = r.id and public.ingredient_cost_status(i) = 'COSTO DESACTUALIZADO') then 'COSTO DESACTUALIZADO'
    else 'OK' end
  from public.recipes r where r.id = p_recipe
$$;

create or replace function public.round_up_to(v numeric, step numeric)
returns numeric language sql immutable as $$
  select case when coalesce(step, 0) <= 0 then round(v) else ceil(v / step) * step end
$$;

-- Vistas por hoja --------------------------------------------------------------
create or replace view public.sync_ingredients with (security_invoker = true) as
select i.id, i.business_id, i.created_at, i.version, i.name, i.category, i.unit, i.cost_per_unit, i.min_stock, i.supplier,
       i.is_active, i.stock, i.last_purchase_at, public.ingredient_cost_status(i) as cost_status
from public.ingredients i;

create or replace view public.sync_recipes with (security_invoker = true) as
select r.id, r.business_id, r.created_at, r.version, r.name, r.yield_qty, r.yield_unit, r.labor_minutes, r.other_cost, r.notes, r.is_active,
       c.ing as ingredients_cost,
       c.ing + r.labor_minutes / 60.0 * coalesce(public.business_param(r.business_id, 'costo_mano_obra_hora')::numeric, 0) + r.other_cost as batch_cost,
       public.recipe_unit_cost(r.id) as unit_cost,
       public.recipe_cost_status(r.id) as cost_status
from public.recipes r
cross join lateral (
  select coalesce(sum(public.base_qty(x.quantity, x.unit) * i.cost_per_unit), 0) as ing
  from public.recipe_ingredients x join public.ingredients i on i.id = x.ingredient_id
  where x.recipe_id = r.id
) c;

create or replace view public.sync_recipe_ingredients with (security_invoker = true) as
select x.id, x.business_id, x.created_at, x.version, x.recipe_id, r.name as recipe_name, x.ingredient_id, i.name as ingredient_name,
       x.quantity, x.unit, public.base_qty(x.quantity, x.unit) * i.cost_per_unit as line_cost
from public.recipe_ingredients x
left join public.recipes r on r.id = x.recipe_id
left join public.ingredients i on i.id = x.ingredient_id;

create or replace view public.sync_products with (security_invoker = true) as
select p.id, p.business_id, p.created_at, p.version, p.name, p.category, p.sale_price, p.recipe_id, p.additional_cost, p.packaging_cost,
       p.min_stock, p.is_active, r.name as recipe_name, p.stock,
       k.cost as unit_cost,
       p.sale_price - k.cost as profit,
       case when p.sale_price > 0 then (p.sale_price - k.cost) / p.sale_price end as margin,
       case when k.cost > 0 then (p.sale_price - k.cost) / k.cost end as markup,
       public.round_up_to(k.cost / (1 - least(greatest(coalesce(s.target_margin, 0.6), 0), 0.95)), s.rounding) as suggested_price,
       case
         when p.recipe_id is null and p.additional_cost + p.packaging_cost <= 0 then 'PENDIENTE DE COSTEO'
         when p.recipe_id is not null and public.recipe_cost_status(p.recipe_id) <> 'OK' then public.recipe_cost_status(p.recipe_id)
         when p.sale_price <= 0 then 'SIN PRECIO'
         when p.sale_price < k.cost then 'PRECIO BAJO EL COSTO'
         when s.target_margin is not null and p.sale_price > 0 and (p.sale_price - k.cost) / p.sale_price < s.target_margin then 'MARGEN BAJO OBJETIVO'
         else 'OK' end as cost_status
from public.products p
left join public.recipes r on r.id = p.recipe_id
left join public.business_settings s on s.business_id = p.business_id
cross join lateral (select public.product_unit_cost(p.id) as cost) k;

create or replace view public.sync_customers with (security_invoker = true) as
select c.id, c.business_id, c.version, c.name, c.phone, c.email, c.address, c.notes, c.created_at,
       coalesce((select sum(s.total - s.paid_amount) from public.sales s
                 where s.customer_id = c.id and s.voided_at is null and s.status <> 'pagado'), 0) as balance
from public.customers c;

create or replace view public.sync_orders with (security_invoker = true) as
select o.id, o.business_id, o.version, o.code, cu.name as customer_name, o.order_date, o.order_time, o.status,
       o.total, o.deposit, o.total - o.deposit as balance, ch.name as channel_name, o.notes, o.sale_id, o.created_at
from public.orders o
left join public.customers cu on cu.id = o.customer_id
left join public.channels ch on ch.id = o.channel_id;

create or replace view public.sync_order_items with (security_invoker = true) as
select x.id, x.business_id, x.created_at, x.version, x.order_id, o.code as order_code, x.name_snapshot, x.quantity, x.unit_price,
       x.line_total, x.details
from public.order_items x left join public.orders o on o.id = x.order_id;

create or replace view public.sync_sales with (security_invoker = true) as
select s.id, s.business_id, s.created_at, s.version, s.sale_date, cu.name as customer_name, s.total, s.paid_amount,
       s.total - s.paid_amount as balance, s.status::text as status,
       (select sum(x.quantity * x.unit_cost) from public.sale_items x where x.sale_id = s.id) as cost,
       o.code as order_code, ch.name as channel_name, s.voided_at is not null as voided, s.void_reason, s.notes
from public.sales s
left join public.customers cu on cu.id = s.customer_id
left join public.orders o on o.id = s.order_id
left join public.channels ch on ch.id = s.channel_id;

create or replace view public.sync_sale_items with (security_invoker = true) as
select x.id, x.business_id, x.created_at, x.version, x.sale_id, s.sale_date, x.product_id, x.name_snapshot, x.quantity, x.unit_price,
       x.line_total, x.unit_cost, x.quantity * x.unit_cost as line_cost, s.voided_at is not null as voided
from public.sale_items x join public.sales s on s.id = x.sale_id;

create or replace view public.sync_payments with (security_invoker = true) as
select p.id, p.business_id, p.created_at, p.version, p.paid_at, p.kind, cu.name as customer_name, p.amount, p.method,
       p.sale_id, p.order_id, p.voided_at is not null as voided, p.note
from public.payments p left join public.customers cu on cu.id = p.customer_id;

create or replace view public.sync_expenses with (security_invoker = true) as
select e.id, e.business_id, e.created_at, e.version, e.expense_date, e.category, e.description, e.amount, e.method,
       e.voided_at is not null as voided, e.void_reason, e.notes
from public.expenses e;

create or replace view public.sync_purchases with (security_invoker = true) as
select pu.id, pu.business_id, pu.created_at, pu.version, pu.purchase_date, su.name as supplier_name, pu.total, pu.paid_amount,
       pu.total - pu.paid_amount as balance, pu.status, pu.voided_at is not null as voided, pu.notes
from public.purchases pu left join public.suppliers su on su.id = pu.supplier_id;

create or replace view public.sync_purchase_items with (security_invoker = true) as
select x.id, x.business_id, x.created_at, x.version, x.purchase_id, pu.purchase_date, i.name as ingredient_name, x.quantity, x.unit,
       x.line_total, x.unit_cost_base
from public.purchase_items x
join public.purchases pu on pu.id = x.purchase_id
left join public.ingredients i on i.id = x.ingredient_id;

create or replace view public.sync_supplier_payments with (security_invoker = true) as
select sp.id, sp.business_id, sp.created_at, sp.version, sp.paid_at, su.name as supplier_name, sp.purchase_id, sp.amount, sp.method,
       sp.voided_at is not null as voided, sp.notes
from public.supplier_payments sp left join public.suppliers su on su.id = sp.supplier_id;

create or replace view public.sync_production with (security_invoker = true) as
select pr.id, pr.business_id, pr.created_at, pr.version, pr.produced_at, r.name as recipe_name, p.name as product_name, pr.batches,
       pr.units, pr.unit_cost, pr.voided_at is not null as voided, pr.notes
from public.production pr
left join public.recipes r on r.id = pr.recipe_id
left join public.products p on p.id = pr.product_id;

create or replace view public.sync_inventory_movements with (security_invoker = true) as
select m.id, m.business_id, m.version, m.created_at, coalesce(i.name, p.name) as item_name,
       case when m.product_id is not null then 'producto' else 'ingrediente' end as item_kind,
       m.type::text as type, m.quantity, case when m.unit = 'base' then coalesce(i.unit, 'unidad') else m.unit end as unit,
       m.reason, m.source_id::text as source_id
from public.inventory_movements m
left join public.ingredients i on i.id = m.ingredient_id
left join public.products p on p.id = m.product_id;

create or replace view public.sync_owner_movements with (security_invoker = true) as
select m.id, m.business_id, m.created_at, m.version, m.movement_date, m.kind, m.amount, m.method,
       m.voided_at is not null as voided, m.notes
from public.owner_movements m;

create or replace view public.sync_sync_conflicts with (security_invoker = true) as
select c.id, c.business_id, 1 as version, c.created_at, c.table_name as table_label, c.record_id, c.summary,
       c.status, c.resolution
from public.sync_conflicts c;

create or replace view public.sync_sync_log with (security_invoker = true) as
select l.id, l.business_id, 1 as version, l.created_at, l.direction, l.table_name, l.record_id, l.status, l.message
from public.sync_log l;

commit;
