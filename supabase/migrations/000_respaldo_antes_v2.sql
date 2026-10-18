-- ============================================================================
--  Respaldo DENTRO de la base antes de migrar a v2 (ejecutar primero).
--  Copia cada tabla de "public" a un esquema aparte "respaldo_v1".
--  No modifica nada de public. Restaurar una tabla:
--    truncate public.sales cascade; insert into public.sales select * from respaldo_v1.sales;
--  (solo si la tabla no cambió de columnas; ver docs/07-respaldo-y-recuperacion.md)
-- ============================================================================
create schema if not exists respaldo_v1;

do $$
declare t text;
begin
  for t in select table_name from information_schema.tables
           where table_schema = 'public' and table_type = 'BASE TABLE' loop
    execute format('drop table if exists respaldo_v1.%I', t);
    execute format('create table respaldo_v1.%I as table public.%I', t, t);
  end loop;
end $$;

-- El esquema de respaldo no se expone a la API ni a los usuarios.
revoke all on schema respaldo_v1 from public;

-- Conteo para comparar después de migrar.
select table_name,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from respaldo_v1.%I', table_name), false, true, '')))[1]::text::int as filas
from information_schema.tables where table_schema = 'respaldo_v1' order by table_name;
