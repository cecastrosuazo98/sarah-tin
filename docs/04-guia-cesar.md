# Guía de administración (César)

## Qué se hace dónde
| En la **matriz (Google Sheets)** | En la **app** (Configuración) |
|---|---|
| Precios, productos, recetas y sus ingredientes, costos de ingredientes, minutos de trabajo, empaque | Sincronizar ahora / Preparar matriz |
| Listas: medios de pago, estados de pedido, canales, categorías, proveedores | Resolver conflictos |
| Parámetros (margen objetivo, redondeo, costo hora, cuándo descontar ingredientes, política de costo) | Dar acceso a personas |
| Metas mensuales y análisis (Resumen_Mensual, Rentabilidad, Por_Cobrar, Por_Pagar, Alertas) | Aportes y retiros (próximamente en pantalla; ya disponible en la base) |

La pestaña **Leer_Primero** de la matriz explica colores y reglas; **Diccionario** describe cada columna.

## Reglas de oro en la matriz
1. Edita solo columnas con encabezado de color. Las grises se recalculan y las que empiezan con `_` son técnicas.
2. No cambies los encabezados (fila 1).
3. Para dar de baja: desmarca **Activo**. No borres filas.
4. Para agregar: fila nueva al final con **ID vacío**.
5. Para relacionar (línea de receta → ingrediente, producto → receta) copia el **ID** de la otra pestaña.
6. Fechas `DD-MM-AAAA`, montos sin decimales, porcentajes `60%`.

## Columna `_estado_sync`
- `OK` sincronizado · `PENDIENTE` alta en curso · `ERROR: …` no se aplicó (corrige y se reintenta) · `CONFLICTO` cambió aquí y en la app a la vez.

## Conflictos
App → Configuración → *Conflictos por revisar*. Cada uno muestra los dos valores. **Usar valor de Sheets** lo aplica a la app; **Mantener valor de la app** reescribe la fila de la hoja. Mientras no se resuelve, ninguno de los dos valores se pierde.

## Costeo
- Costo de receta = ingredientes + (minutos ÷ 60 × costo hora) + otros costos del lote; costo unitario = ÷ rendimiento.
- Costo de producto = costo unitario de receta + empaque + otros costos por unidad.
- **Margen** = ganancia ÷ precio. **Markup** = ganancia ÷ costo. **Precio sugerido** = costo ÷ (1 − margen objetivo), redondeado.
- `Estado costeo`: `PENDIENTE DE COSTEO` (falta costo/ingredientes/rendimiento), `COSTO DESACTUALIZADO` (sin compra hace más de N días), `MARGEN BAJO OBJETIVO`, `PRECIO BAJO EL COSTO`.
- Cambiar costos **no altera ventas pasadas**: cada venta guardó su costo.

## Personas y permisos
Configuración → *Personas con acceso*: correo + rol (*Operación* o *Administración*). Luego crea el usuario en Supabase → Authentication → Users con ese correo (la contraseña la define la persona; nunca se escribe en la app ni en la matriz). Los permisos los aplica la base de datos: si alguien sin permiso intenta cambiar un precio, la base lo rechaza.

## Si algo falla
- Pestaña **Sync_Bitacora** o Configuración → Sincronización: última corrida y errores por hoja.
- "Los encabezados de X no coinciden": restaura el encabezado o usa **Preparar matriz**.
- **Restaurar fórmulas de análisis** vuelve a escribir las fórmulas del grupo C.
- Recuperación completa: `docs/07-respaldo-y-recuperacion.md`.
