# 🍰 Sarah & Tin

App de gestión para la pastelería artesanal **Sarah & Tin**, hecha con cariño
para que Camila administre productos, recetas, costos, ventas, caja, clientes,
deudas, pedidos y reportes desde su teléfono o computador.

> Herramienta de **gestión interna**, no de contabilidad tributaria. Los
> cálculos usan términos como "ganancia estimada", "costos" y "resultado".

## 🧁 Stack

- **Next.js 14** (App Router) + **React** + **TypeScript**
- **Tailwind CSS** (paleta derivada del logo)
- **Supabase** (PostgreSQL + Auth + Row Level Security)
- **Lucide** para iconos

## 🚀 Cómo ejecutar

```bash
npm install
npm run dev
```

Luego abre http://localhost:3000

La app funciona de inmediato en **modo local** (con datos de ejemplo guardados
en el navegador), así puedes usarla enseguida sin configurar nada.

### 🔀 Modo local vs. Supabase (automático)

La app tiene una capa de datos con **dos adaptadores** tras una misma interfaz
(`lib/data/`):

- **Sin `.env.local`** → **modo local**: los datos se guardan en `localStorage`
  del dispositivo, con datos de ejemplo precargados. Ideal para probar.
- **Con `.env.local`** (credenciales de Supabase) → **modo Supabase**: los datos
  se guardan en la nube con Row Level Security, y la app pide iniciar sesión.

El cambio es **automático**: la app detecta si hay credenciales y elige el
adaptador. No hay que tocar código.

## 🎨 Tu logo

Guarda el logo oficial en `public/logo.png`. La app lo usará automáticamente.
Mientras tanto se muestra un emblema dibujado con los colores de la marca.
(Ver `public/LEEME-LOGO.txt`.)

## 🔐 Conectar Supabase (para guardar datos reales)

1. Crea un proyecto gratis en https://app.supabase.com
2. Ve a **SQL Editor → New query**, pega TODO el contenido de
   [`supabase/schema.sql`](supabase/schema.sql) y ejecútalo. Esto crea las
   tablas, los índices y las políticas de seguridad (RLS).
3. Copia el archivo de variables de entorno:

   ```bash
   cp .env.local.example .env.local
   ```

4. En Supabase, entra a **Settings → API** y copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Pégalos en `.env.local`. ⚠️ Nunca uses aquí la *service_role key*.

5. Crea tu usuaria en Supabase (**Authentication → Users → Add user**) con
   correo y contraseña. Al crearse, se generan automáticamente su perfil y la
   configuración del negocio.

6. Reinicia el servidor (`npm run dev`) e inicia sesión.

## 📁 Estructura

```
app/
  (auth)/login        Inicio de sesión
  (app)/              Área privada (dashboard + secciones)
components/
  brand/              Logo y emblema Sarah & Tin
  layout/             Sidebar (escritorio) y navegación móvil
  dashboard/          Tarjetas y gráfico del inicio
  ui/                 Componentes base (Button, Card)
  shared/             EmptyState, PlaceholderPage, DemoBanner
lib/
  supabase/           Clientes de Supabase (browser, server, middleware)
  actions/            Server actions (auth)
  format.ts           Moneda CLP, fechas, porcentajes
  constants.ts        Marca, categorías, métodos de pago
  navigation.ts       Menús (sidebar / bottom nav)
  demo-data.ts        Datos de ejemplo (Fase 1)
types/                Tipos de dominio
supabase/schema.sql   Esquema completo + RLS
```

## 🗺️ Roadmap por fases

- ✅ **Fase 1** — Configuración, identidad visual, layout, navegación, dashboard, auth.
- ✅ **Fase 2** — Ingredientes, productos, recetas, costeo automático, margen, precio sugerido.
- ✅ **Fase 3** — Clientes, ventas, deudas, pagos, recordatorio por WhatsApp.
- ✅ **Fase 4** — Caja (abrir/cerrar/movimientos), gastos, compras de insumos.
- ✅ **Fase 5** — Pedidos con estados y agenda por fecha.
- ✅ **Fase 6** — Inventario (stock bajo) y reportes de rentabilidad.
- ✅ **Fase 7** — Pulido, responsive, accesibilidad, configuración editable.

Todo interconectado: cambiar el costo de un ingrediente recalcula recetas y
productos; una venta paga entra a la caja; un pago abona la deuda del cliente
y entra a la caja; los reportes reflejan todo en tiempo real.

## 📱 Instalar como app (PWA)

Sarah & Tin es una **PWA**: se puede instalar en el teléfono y abrir como una app,
con ícono propio y pantalla completa. Funciona mejor con la app desplegada (HTTPS)
o con un build de producción (`npm run build` + `npm start`).

- **Android / Chrome de escritorio:** aparece la opción "Instalar app" (también en
  la sección **Configuración** de la app).
- **iPhone (Safari):** botón Compartir → "Agregar a inicio".

Los íconos se generan desde `public/logo.png` con:

```bash
node scripts/gen-icons.mjs
```

## ☁️ Despliegue

Compatible con **Vercel** y **Netlify**. Recuerda definir las mismas variables
de entorno (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) en el
panel del proveedor.
