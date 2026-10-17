# Inventario de funciones

## Completado y probado
- **Negocio compartido y roles** (admin / operador) aplicados en la base (RLS + funciones). Invitaciones por correo.
- **Operaciones atómicas e idempotentes** en la base: venta, cobro/abono/anticipo/reembolso (venta o pedido), anular venta, pedido nuevo (con cliente nuevo), cambio de estado (entregado genera la venta una sola vez), gasto, anular gasto, compra de insumos (con proveedor y saldo por pagar), pago a proveedor, producción, aporte/retiro, invitar.
- **Costo histórico** por venta y producción; historial de costos de ingredientes.
- **Costeo**: mano de obra, otros costos por lote, empaque, margen y markup, precio sugerido, estados de costeo (pendiente, desactualizado, margen bajo, bajo costo). Igual en app y base.
- **Matriz de Google Sheets** (34 pestañas: configuración, operación, análisis, conflictos, bitácora, guía, diccionario) generada desde la misma especificación que usa la sincronización.
- **Sincronización bidireccional** con huellas de 3 vías, conflictos, validación, altas sin duplicados, restauración de filas borradas, protección de encabezados, bitácora, reintentos, bloqueo de corridas simultáneas, cuota de Google cuidada. Disparo tras registros, manual y cada 10 minutos.
- **"Preparar matriz"**: formatos, casillas, protecciones con advertencia, fórmulas de análisis.
- **Interfaz de Camila**: inicio de 5 acciones, pedido paso a paso, "Registrar venta o cobro" con 4 opciones, gasto rápido, pedidos pendientes con siguiente acción y alertas, resumen del día, anulación con motivo, estado de sincronización visible, menú según rol, bloqueo de doble toque, formularios que no se borran ante error.
- **Panel de administración**: sincronización, conflictos, personas con acceso; panel de análisis anterior en `/panel`.
- **Migraciones con reversión** probadas (v1 → v2 → v1 → v2 sin pérdida).
- Respaldo en JSON (`npm run respaldo`) y guía de recuperación.

## Pendiente
| Pendiente | Motivo / siguiente paso |
|---|---|
| Pruebas en vivo con Google Sheets y Supabase reales | Requiere el acceso técnico (ver mensaje final y `docs/06-despliegue.md`) |
| Prueba de uso con Camila en su teléfono | Después de publicar la vista previa |
| Pantallas para **producción** y **aportes/retiros** | Las funciones de la base existen y están probadas (`rpc_register_production`, `rpc_owner_movement`); falta el formulario en la app |
| Pantalla de **pagos a proveedores** | Función `rpc_pay_supplier` lista; hoy la compra se marca pagada o pendiente al registrarla |
| Producción automática de stock por receta en modo "descontar en producción" | Lista en la base; probar con datos reales antes de activarla en Parametros |
| Elegir canal de venta en pedidos/ventas | Columna y tabla existen (Canales); falta el selector en los formularios |
| Edición de pedidos existentes en la app (agregar/quitar productos) | Hoy se corrigen fecha, hora y notas desde la matriz; cambios de productos = cancelar y crear otro |
