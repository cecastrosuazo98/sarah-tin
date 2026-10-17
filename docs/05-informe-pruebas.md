# Informe de pruebas — Sarah & Tin 2.0

Fecha: 17-10-2026 · Rama `v2-sheets` · Comando: `npm test` (vitest) → **57 pruebas, 57 aprobadas**. Además: `tsc` sin errores, `next lint` sin advertencias, `next build` exitoso.

## Entornos usados (y qué NO son)
| Entorno | Qué es | Límite |
|---|---|---|
| **Postgres embebido (PGlite 0.2, PostgreSQL 16)** | Se ejecutan `schema.sql` actual + migraciones 001 y 002 **reales**, con un `auth` mínimo igual al de Supabase (`auth.uid()`, rol `authenticated`, RLS activo). | No es el proyecto Supabase real (PostgREST, pooler y Auth reales no participan). |
| **Google Sheets simulado** (`tests/sync/fake-sheets.ts`) | Misma interfaz que el cliente real (lectura en lote, escritura RAW, append). El motor, la base y las reglas de conflicto son los reales. | No ejecuta fórmulas ni la API real de Google. |
| **Cliente Google con `fetch` simulado** | Firma JWT verificada con una clave RSA de prueba generada en el momento; reintentos 429/503; mensaje de permiso 403. | No contacta a Google. |
| **Navegador (panel integrado, 375×812)** | App compilada en **modo demo** (localStorage), con URL de Supabase ficticia para no tocar producción. | No prueba la sesión real ni RLS desde el navegador; no la usó Camila. |

Credenciales de producción: **no se usaron** en ninguna prueba.

## Pruebas de aceptación (spec §13)

| # | Prueba | Cómo se ejecutó | Resultado esperado | Obtenido | Limitación |
|---|---|---|---|---|---|
| 1 | Producto creado en Sheets aparece en la app | `sync-e2e › P1`: fila nueva en Productos con ID vacío → sincronizar | Se crea con ID asignado; `updated_source = sheets`; la operadora lo ve (RLS) | ✅ Aprobada | Sheets simulado |
| 2 | Cambio de precio en Sheets → operaciones nuevas usan el precio nuevo | `sync-e2e › P2`: precio 2.000 → 2.500 en Sheets, luego `rpc_create_order` | Total del pedido = 2 × 2.500 | ✅ Aprobada | Sheets simulado |
| 3 | Pedido creado en la app aparece en Sheets con el mismo ID | `sync-e2e › P3` + navegador (asistente de pedido) | Fila en Pedidos y Pedido_Detalle con el mismo UUID y saldo correcto | ✅ Aprobada | Sheets simulado |
| 4 | Editar pedido desde Sheets se refleja en la app | `sync-e2e › P4`: fecha `05-11-2026` y notas | La base guarda `2026-11-05` y la nota; un cambio a "Total" (no editable) se revierte | ✅ Aprobada | Sheets simulado |
| 5 | Abono desde la app actualiza saldo sin duplicar venta | `sync-e2e › P5`, `migration › pedido con abono…` y navegador (abono, entrega, cobro del saldo) | Saldo baja; 0 ventas nuevas; al entregar 1 sola venta con el abono como cobrado | ✅ Aprobada | — |
| 6 | Gasto aparece en reportes financieros | `sync-e2e › P6` (llega a la hoja Gastos, origen del Resumen_Mensual); `costing-daily › resumen del día` | Fila con monto y "Anulado = FALSE"; el resumen del día lo suma | ✅ Aprobada (parcial) | Las fórmulas de Resumen_Mensual no se evaluaron en Google (pendiente en vivo) |
| 7 | Cambiar costo de ingrediente actualiza el costo actual sin alterar el histórico | `migration › subir el costo…`, `costing-daily › costo app = costo base` | `sale_items.unit_cost` de ventas anteriores no cambia; queda registro en `ingredient_cost_history`; costo TS = costo SQL (710) | ✅ Aprobada | — |
| 8 | La misma operación dos veces no se duplica | `migration › doble toque` (misma clave → `duplicate`), navegador: 3 toques instantáneos en "Crear pedido" | 1 pedido y 1 abono | ✅ Aprobada **después de corregir un error** encontrado en esta prueba (ver abajo) | — |
| 9 | Fallo de sincronización registrado y recuperable | `sync-e2e`: corte de red al fijar IDs, encabezados alterados, valor inválido; reintento sin duplicar | Error visible por hoja y en bitácora; la corrida siguiente completa sin duplicados | ✅ Aprobada | Fallo simulado |
| 10 | Conflicto por edición simultánea detectado y resuelto | `sync-e2e › cambio en ambos lados…` | `CONFLICTO` en la fila, ningún lado sobrescrito, 1 solo conflicto abierto; "usar Sheets" aplica el valor y deja la fila OK | ✅ Aprobada | — |
| 11 | Usuario sin permiso intenta función administrativa → el servidor rechaza | `migration › roles`: operadora cambia precio (0 filas), inserta medio de pago (rechazo RLS), aporte/retiro (RPC rechaza), borra venta (0 filas); usuario de otro negocio no ve ni usa datos ajenos | Rechazo en la base | ✅ Aprobada en la base | Las rutas `/api/sync/*` (rol admin) se revisaron y compilan, pero no se ejecutaron con sesión real |
| 12 | Camila completa operaciones desde el teléfono sin instrucciones | Navegador a 375 px: inicio con 5 acciones, pedido paso a paso, avance de estados, cobro, resumen del día, anulación | Flujo completo sin errores ni desbordes | ⚠️ Ejecutada por el desarrollo, **no por Camila** | Pendiente: prueba con Camila en su teléfono y con la base real |

## Errores encontrados y corregidos durante las pruebas
1. **Doble toque creaba pedidos duplicados en modo demo** (3 toques instantáneos → 3 pedidos). Causa: el estado "guardando" de React se aplica un dibujo después y la idempotencia local registraba la clave al terminar. Corrección: bloqueo inmediato en todos los formularios de dinero y registro de operaciones en curso. Retest: 1 pedido. (En Supabase la clave única de la base ya lo impedía.)
2. **La plantilla vacía habría borrado la configuración** en la primera sincronización (celdas "Valor" vacías se leían como cambio). Corrección: una fila sin historial de sincronización nunca sobrescribe la app. Prueba agregada.
3. Columnas calculadas negativas o > 100 % (margen, markup) se reescribían en cada corrida. Corregido; prueba "segunda corrida = 0 escrituras".
4. Cuota de Google: una corrida hacía ~60 lecturas. Ahora 2 lecturas en lote sin cambios (probado).
5. Botones de las tarjetas de pedido se salían de la pantalla a 375 px. Corregido y verificado.
6. Fechas "AAAA-MM-DD" se interpretaban en UTC (un gasto del día 17 caía el 16 en Chile). Corregido (`toDate`).

## Pendiente en vivo (requiere el acceso técnico)
Con la matriz real, la cuenta de servicio y la base migrada, repetir en la vista previa de Netlify: 1, 2, 3, 4, 6 (ver que Resumen_Mensual, Rentabilidad, Por_Cobrar calculan bien en Google), 9 (quitar el permiso de la cuenta de servicio → error visible → devolverlo → se recupera), 10, 11 (entrar como operadora y abrir `/productos` y `/api/sync/setup`), 12 con Camila.

## Bitácora de fases
| Fase | Cambió | Pendiente | Pruebas |
|---|---|---|---|
| 1 Auditoría | `docs/01-auditoria-y-plan.md` | — | — |
| 2 Diseño | `docs/02-diseno.md`, `lib/sync/sheet-schema.json` | — | setup (fórmulas xlsx = API) |
| 3 Integración | Migraciones 001/002 + reversión, motor de sincronización, cliente Google, API, cron | Credenciales reales | migración, reversión, sync e2e, cliente Google |
| 4 Interfaz Camila | Inicio de 5 acciones, pedido paso a paso, venta/cobro/abono/reembolso, pendientes con alertas, resumen del día, anulación, roles en menú | Pantallas de producción y aportes/retiros (funciones listas en la base) | navegador 375 px |
| 5 Validación financiera | Venta ≠ cobro, compras a inventario, costo histórico, costeo con mano de obra y empaque | — | costeo TS = SQL, resumen del día |
| 6 Pruebas | 57 automáticas + navegador | Pruebas en vivo | este informe |
| 7 Despliegue | `docs/06-despliegue.md`, variables, función programada | Ejecutar con acceso | — |
| 8 Documentación | Guías de Camila y César, respaldo, inventario | — | — |
