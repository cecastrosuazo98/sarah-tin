# Sarah & Tin 2.0 — Fase 1: Auditoría y plan

Fecha: 17-10-2026 · Rama de trabajo: `v2-sheets` (no se toca `main`, que Netlify publica automáticamente).

## 1. Estado actual

| Punto | Hallazgo |
|---|---|
| Framework | Next.js 14.2.15 (App Router), React 18.3, TypeScript 5, Tailwind 3.4, Lucide. Dependencias mínimas (`@supabase/ssr`, `@supabase/supabase-js`, `sharp`, `clsx`, `tailwind-merge`, `cva`). |
| Carpetas | `app/(auth)/login`, `app/(app)/*` (inicio, ventas, productos, recetas, ingredientes, clientes, gastos, pedidos, reportes, configuración), `components/{ui,features,layout,shared,brand,pwa}`, `lib/{data,domain,supabase,actions}`, `supabase/schema.sql`, `scripts/`. |
| Base de datos | Supabase/PostgreSQL. 23 tablas en `supabase/schema.sql`. Usadas por la app: `ingredients, ingredient_purchases, recipes, recipe_ingredients, products, customers, sales, sale_items, payments, expenses, orders, order_items, business_settings`. Sin uso: `categories, suppliers, product_costs, customer_account_movements, cash_registers, cash_movements (caja eliminada), inventory_movements, notifications`. |
| Relaciones | FK correctas en general. `recipe_ingredients.ingredient_id` con `on delete restrict` (la app ya lo maneja). Los ítems guardan `name_snapshot` y `unit_price` (precio histórico OK). |
| Autenticación | Supabase Auth con correo/contraseña (`/login`). Middleware protege rutas. Sin registro público. |
| Usuarios y permisos | **Un usuario = un negocio.** RLS: `owner_id = auth.uid()`. Si Camila y César entran con cuentas distintas **ven datos distintos**. No existen roles. |
| Integraciones | Ninguna (ni Sheets ni otra). PWA con service worker propio. |
| Variables de entorno | Solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (públicas). No hay clave de servicio ni backend propio. |
| Capa de datos | Dos adaptadores (localStorage para demo, Supabase para producción) detrás de `lib/data/client.ts`. Las operaciones de negocio (`lib/data/repo.ts`) se ejecutan **en el navegador** como varias llamadas seguidas. |

## 2. Problemas encontrados

### Integridad y datos
1. **Operaciones no atómicas.** Registrar una venta son 5–20 llamadas HTTP (venta, ítems, stock de producto, stock de ingredientes). Si la red falla a mitad, queda una venta sin ítems o sin descuento de stock.
2. **Sin protección contra duplicados.** Un doble toque en "Registrar venta" crea dos ventas.
3. **Costo histórico no se guarda.** La rentabilidad usa el costo *actual* del producto: si sube la harina, cambia la utilidad de ventas pasadas.
4. **Ventas y cobros mezclados.** Una venta pagada al contado no genera un registro de cobro; "dinero cobrado" no se puede calcular de forma fiable.
5. **Compras registradas como gasto.** Comprar harina crea un gasto "Compra: Harina": el inventario se cuenta como gasto y luego otra vez como costo de venta.
6. **Borrado físico de registros financieros.** Ventas, gastos y pedidos se eliminan sin rastro.
7. **Pedidos desconectados de ventas.** Un pedido entregado no genera venta; el abono de un pedido no queda como cobro.
8. Lógica de permisos solo en la interfaz (no hay roles en la base).

### Usabilidad (por qué Camila no la usa)
1. Inicio con 4 tarjetas de cifras + 6 acciones + gráfico + 4 listas: demasiada información para un uso rápido.
2. 10 secciones en el menú, todas al mismo nivel; las de configuración (recetas, ingredientes, costos) están junto a las del día a día.
3. "Nuevo pedido" es un formulario largo en una sola pantalla; los productos del pedido se escriben a mano (sin precio automático).
4. No hay una vista de "qué tengo que hacer hoy" (pedidos por preparar, entregas, abonos faltantes).
5. "Venta", "pago" y "abono" están en pantallas diferentes sin explicar la diferencia.

### Funciones duplicadas o sobrantes
- Tablas sin uso (ver arriba). `lib/demo-data.ts` y `types/index.ts` obsoletos.
- Categorías guardadas como listas en `business_settings` en vez de usar la tabla `categories`.

## 3. Riesgos de pérdida de datos

| Riesgo | Mitigación en el plan |
|---|---|
| Migración de RLS deja a la usuaria sin acceso | La migración crea el negocio con `id = owner_id` y la membresía como administradora **antes** de cambiar políticas; se prueba en una base de prueba (PGlite) y trae script de reversión. |
| Cambiar enums a texto | Conversión con `USING col::text`; reversible. |
| Errores de sincronización sobrescriben datos | Reglas de conflicto por hash: nunca se sobrescribe un dato que cambió en ambos lados; queda como conflicto pendiente. |
| Publicar sin migrar | La rama no se mezcla con `main` hasta ejecutar respaldo + migración. |

## 4. Reutilización
Se conserva: identidad visual, componentes UI (`Modal`, `SearchSelect`, `MoneyInput`…), motor de costeo, búsqueda, PWA, autenticación y el modo demo.

## 5. Arquitectura elegida

```
 Camila (celular)  ─┐                         ┌─ César (Sheets: configuración y análisis)
                    ▼                         ▼
          App Next.js (Netlify)        Google Sheets "Matriz Sarah & Tin"
                    │  RPC atómicas            ▲   │
                    ▼                          │   │ Sheets API (cuenta de servicio)
          Supabase PostgreSQL  ◄──── Motor de sincronización (servidor Next.js)
          (fuente transaccional)       push: BD → Sheets · pull: Sheets → BD
                                       hashes por fila, conflictos, bitácora
```

- **Fuente de verdad:** Supabase (transaccional, con RLS y roles). Sheets no es una segunda base: es una vista editable de las tablas autorizadas.
- **Sincronización:** endpoint de servidor (`/api/sync`) con credenciales solo en variables de entorno. Se dispara al registrar algo en la app, con el botón "Sincronizar ahora" y cada 10 min (función programada de Netlify).
- **Detección de cambios:** cada fila sincronizada lleva en Sheets `ID`, `_version`, `_hash` (huella de las columnas editables en la última sincronización) y `_estado_sync`. Así se sabe quién cambió qué sin bucles: lo que escribe la sincronización actualiza el `_hash`, por lo que no se vuelve a leer como cambio.

## 6. Plan por fases
1. Auditoría (este documento).
2. Diseño: esquema de la matriz (`lib/sync/sheet-schema.json`, única fuente para la app y para Sheets), roles y reglas de conflicto (`docs/02-diseno.md`).
3. Integración: migración SQL (negocio compartido, roles, versiones, RPC atómicas, tablas nuevas), cliente Sheets API, motor de sincronización, endpoints y función programada.
4. Interfaz de Camila: inicio con 5 acciones, pedido guiado, venta/cobro diferenciados, pendientes con alertas, resumen del día.
5. Validación financiera: ventas ≠ cobros, compras a inventario, costo de venta histórico.
6. Pruebas: unitarias (motor de sincronización y costeo), migración y RLS en Postgres embebido, interfaz en el navegador; pruebas en vivo que requieren credenciales quedan con guion listo.
7. Despliegue: variables, respaldo, migración, reversión.
8. Documentación: guía de Camila, guía de César, informe de pruebas.

## 7. Acceso técnico que falta (lo pido al final, no contraseñas)
1. Una **cuenta de servicio de Google** con la API de Sheets habilitada (correo de la cuenta + clave JSON), compartida como Editor en la matriz.
2. La **cadena de conexión de la base** (Supabase → Connect → Transaction pooler) cargada como variable de entorno `SUPABASE_DB_URL` en Netlify (nunca en el chat ni en el código). *Actualización: se eligió esta vía en vez de la clave `service_role` porque permite transacciones y probar el motor contra Postgres real.*
3. Ejecutar la migración en el SQL Editor de Supabase después de hacer el respaldo.
