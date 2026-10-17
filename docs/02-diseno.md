# Sarah & Tin 2.0 — Fase 2: Diseño

## 1. Arquitectura

| Pieza | Rol |
|---|---|
| **Supabase (PostgreSQL)** | Fuente de verdad transaccional. Toda operación de dinero o stock es una función de la base (RPC) atómica e idempotente. |
| **App Next.js (Netlify)** | Operación diaria (Camila, celular) y administración (César). En el navegador solo viaja la clave pública *anon*. |
| **Google Sheets — "Matriz Sarah & Tin"** | Configuración (precios, recetas, costos, listas, parámetros) y análisis. Vista editable de las tablas autorizadas, no una segunda base. |
| **Motor de sincronización** (`lib/sync/*`, `/api/sync`) | Corre solo en el servidor. Credenciales de Google y de la base en variables de entorno. |

Disparadores de sincronización: 4 s después de cada registro en la app (agrupados), botón **Sincronizar ahora**, y la función programada de Netlify cada 10 minutos (`netlify/functions/sync-cron.mts`). Dos corridas no se ejecutan a la vez (bloqueo en la base, `sync_runs`).

## 2. Matriz maestra

Una sola especificación, `lib/sync/sheet-schema.json`, define pestañas, columnas, tipos, columnas editables y fórmulas de análisis. La usan el motor de sincronización, el generador de la planilla (`scripts/build-matrix.py`) y "Preparar matriz" (`lib/sync/setup.ts`). Una prueba verifica que las fórmulas del `.xlsx` y las de la API sean idénticas.

| Grupo | Pestañas | Quién edita |
|---|---|---|
| **A · Configuración** (rosado) | Parametros, Metodos_Pago, Estados_Pedido, Canales, Categorias, Proveedores, Ingredientes, Recetas, Receta_Detalle, Productos, Clientes, Metas | César. Se pueden agregar filas (ID vacío → la app asigna ID). |
| **B · Operación** (azul) | Pedidos, Pedido_Detalle, Ventas, Venta_Detalle, Cobros, Gastos, Compras, Compra_Detalle, Pagos_Proveedor, Produccion, Inventario_Mov, Aportes_Retiros | La app. Desde Sheets solo se corrigen notas/descripciones y fecha/hora de pedidos. Montos y estados solo desde la app. |
| **C · Análisis** (dorado) | Resumen_Mensual, Rentabilidad, Pedidos_Proximos, Por_Cobrar, Por_Pagar, Alertas, Conflictos, Sync_Bitacora | Nadie: fórmulas y registros automáticos. |
| Referencia | Leer_Primero, Diccionario | — |

Cada pestaña sincronizada termina con 4 columnas técnicas: `_versión`, `_huella`, `_estado_sync`, `_actualizado`. Columnas calculadas en gris; protección **con advertencia** (no bloquea, avisa) sobre encabezados, columnas calculadas y técnicas.

## 3. Reglas de sincronización y conflictos

Comparación de 3 vías por fila usando `_huella` (huella de las columnas editables al momento de la última sincronización):

| Sheets cambió | App cambió | Resultado |
|---|---|---|
| no | no | Nada (o se refrescan columnas calculadas) |
| no | sí | Se escribe la fila en Sheets |
| sí | no | Se valida y se actualiza la base (`updated_source = 'sheets'`) |
| sí | sí, mismo valor | Se refresca |
| sí | sí, distinto | **CONFLICTO**: no se toca ningún lado; queda en `sync_conflicts` y César elige en la app |

Otras reglas:
- **Sin bucles**: lo que escribe la sincronización actualiza la huella; la corrida siguiente no lo ve como cambio (probado: 0 escrituras en la 2.ª corrida).
- **Fila nunca sincronizada** con ID existente (p. ej. la plantilla vacía): manda la app (no se borran datos con celdas vacías).
- **Validación**: valores inválidos → `ERROR: motivo` en la fila, no se aplica nada; al corregir, se reintenta solo.
- **Altas desde Sheets**: primero se escribe el ID en la hoja y recién después se inserta (`on conflict do nothing`). Si algo falla entre medio, el reintento no duplica.
- **Filas borradas en Sheets**: se restauran (se desactiva con `Activo`, no se borra).
- **Encabezados alterados**: esa pestaña no se sincroniza (error visible); las demás siguen.
- **Concurrencia**: actualizaciones con control de versión (`where version = esperada`); antes de escribir se reubican las filas por ID por si alguien ordenó la hoja.
- **Reintentos**: llamadas a Google con reintento exponencial ante 429/5xx. Bitácora en `sync_runs` / `sync_log` y en la pestaña Sync_Bitacora.

## 4. Roles y permisos (aplicados en la base, no solo en la interfaz)

| Acción | Operación (Camila) | Administración (César) |
|---|---|---|
| Pedidos, ventas, cobros, abonos, reembolsos, gastos, compras, clientes | Sí (vía RPC) | Sí |
| Anular venta o gasto (con motivo, queda en `audit_log`) | Sí | Sí |
| Precios, recetas, ingredientes, productos, listas, parámetros | No (RLS) | Sí |
| Aportes y retiros | No (RPC exige admin) | Sí |
| Borrado físico | No | Solo admin (lo normal es anular) |
| Sincronización: preparar matriz, resolver conflictos, ver bitácora | No | Sí |
| Invitar personas | No | Sí (`rpc_invite_member`) |

Negocio compartido: `businesses` + `business_members(role)`. Al migrar, el negocio existente conserva el mismo id que la cuenta actual y esa cuenta queda como administradora.

## 5. Modelo financiero

- **Venta ≠ cobro**: la venta registra lo vendido; `payments` registra el dinero recibido con `kind` = cobro / abono / anticipo (pedido) / reembolso (negativo).
- **Compras de insumos** van a inventario y actualizan el costo (`politica_costo_compra`: último o promedio). No son gasto; su costo entra como *costo de lo vendido* al vender.
- **Costo histórico**: cada `sale_items.unit_cost` se fija al vender. Cambiar un ingrediente no recalcula el pasado (`ingredient_cost_history` guarda cada cambio).
- **Costeo**: ingredientes + minutos de trabajo × costo/hora + otros costos del lote, dividido por rendimiento; + empaque + otros por unidad. Margen = ganancia/precio; markup = ganancia/costo. "Pendiente de costeo" si falta costo, ingredientes o rendimiento. Mismo cálculo en SQL y TypeScript (probado).
- **Cuentas por cobrar/pagar**: vistas `v_receivables` / `v_payables` y pestañas Por_Cobrar / Por_Pagar.
- **Aportes/retiros** de las dueñas: `owner_movements`, fuera de ventas y gastos.
- **Correcciones trazables**: anular (con motivo) en vez de borrar; pedidos cancelados quedan en su lista.

## 6. Migraciones

| Archivo | Contenido | Reversión |
|---|---|---|
| `supabase/migrations/001_v2_negocio_roles_sync.sql` | Negocio y roles, tablas nuevas, versión/origen, RPC, RLS por rol, configuración inicial, cobros faltantes de ventas antiguas | `001_v2_down.sql` (vuelve a v1 sin borrar datos) |
| `supabase/migrations/002_v2_vistas_sync.sql` | Vistas por pestaña con columnas calculadas | `002_v2_vistas_sync_down.sql` |
