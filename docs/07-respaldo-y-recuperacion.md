# Respaldo y recuperación

## 1. Respaldo antes de migrar (obligatorio)
Hacer **dos** respaldos:

**a) Respaldo completo con `pg_dump`** (la vía para restaurar):
```bash
pg_dump "$SUPABASE_DB_URL_DIRECTA" --schema=public --no-owner --format=custom --file=respaldo_antes_v2.dump
```
`SUPABASE_DB_URL_DIRECTA` = Supabase → Connect → *Session pooler* o *Direct connection* (no la de transacciones). Si no tienes `pg_dump`, Supabase → *Database → Backups* (plan Pro) o pide ayuda para instalar las herramientas de PostgreSQL.

**b) Copia legible en JSON** (para revisar o recuperar registros puntuales):
```bash
SUPABASE_DB_URL="..." npm run respaldo
```
Crea `respaldos/AAAA-MM-DD_HHMM/` con un archivo por tabla y `resumen.json` con el conteo de filas. La carpeta está en `.gitignore`: contiene datos reales.

Guarda ambos fuera del computador (Drive personal, disco externo).

## 2. Comprobación después de migrar
```sql
select 'ventas' t, count(*) from sales union all
select 'clientes', count(*) from customers union all
select 'productos', count(*) from products union all
select 'pedidos', count(*) from orders;
```
Los números deben coincidir con `resumen.json`. Ventas al contado antiguas ahora tienen su cobro:
```sql
select count(*) from payments where note = 'Cobro registrado por migración v2';
```

## 3. Revertir
Ordenado de menor a mayor impacto:

| Problema | Acción |
|---|---|
| La v2 publicada tiene un error | Netlify → Deploys → deploy anterior → *Publish deploy*. La base migrada sigue funcionando con la app anterior para la cuenta administradora. |
| La sincronización escribió algo mal en Sheets | Corregir en la app y *Sincronizar ahora* (la app manda en columnas calculadas). Google Sheets → *Archivo → Historial de versiones* para recuperar la matriz. |
| La sincronización escribió algo mal en la base | Buscar en `sync_log` / pestaña Sync_Bitacora qué registro y qué columna; corregir en Sheets o en la app. Cada cambio tiene `version`, `updated_source` y `updated_by`. |
| Hay que volver la base a v1 | SQL Editor: `002_v2_vistas_sync_down.sql` y luego `001_v2_down.sql`. No borra datos: las tablas nuevas quedan (la app v1 las ignora). Ojo: lo anulado en v2 se verá como normal en v1. |
| Pérdida o daño de datos | Restaurar el `pg_dump` del paso 1: `pg_restore --clean --if-exists --no-owner -d "$SUPABASE_DB_URL_DIRECTA" respaldo_antes_v2.dump` (borra y recrea las tablas de `public`: se pierde lo registrado después del respaldo). |

## 4. Rutina recomendada
- Mensual: `npm run respaldo` y guardar la carpeta.
- Google Sheets guarda historial de versiones de la matriz automáticamente.
- Revisar *Configuración → Sincronización* una vez por semana (conflictos y errores).
