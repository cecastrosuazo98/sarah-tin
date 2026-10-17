# Publicar Sarah & Tin 2.0 (paso a paso)

> La app publicada (rama `main`) **no se toca** hasta el último paso. Todo se prepara en la rama `v2-sheets`.
> Ninguna contraseña ni clave se escribe en el chat, en el código ni en la matriz: solo en los paneles de Supabase, Google Cloud y Netlify.

## 0. Antes de empezar
- Hacer el **respaldo** (docs/07-respaldo-y-recuperacion.md, paso 1). Sin respaldo no se migra.
- Elegir un momento sin ventas en curso (la migración tarda segundos).

## 1. Migrar la base (Supabase → SQL Editor)
1. New query → pegar **todo** `supabase/migrations/001_v2_negocio_roles_sync.sql` → Run.
2. New query → pegar `supabase/migrations/002_v2_vistas_sync.sql` → Run.
3. Verificar:
   ```sql
   select b.id, b.name, m.role from businesses b join business_members m on m.business_id = b.id;
   ```
   Debe aparecer el negocio con la cuenta actual como `admin`. **Copia el `id`**: es `SYNC_BUSINESS_ID`.

La migración es compatible con la app actual: mientras no se publique la v2, la app de `main` sigue funcionando con la cuenta administradora.

## 2. Cuenta de servicio de Google (una vez)
1. https://console.cloud.google.com → crear proyecto "Sarah y Tin".
2. *APIs y servicios → Biblioteca* → habilitar **Google Sheets API**.
3. *IAM → Cuentas de servicio → Crear* (nombre: `sync-matriz`). Sin roles adicionales.
4. En la cuenta creada → *Claves → Agregar clave → JSON*. Se descarga un archivo: **guárdalo en un lugar seguro, no lo subas a GitHub ni lo envíes por chat**.
5. Del JSON necesitarás `client_email` y `private_key`.

## 3. La matriz
1. Subir `docs/Matriz_Sarah_Tin.xlsx` a Google Drive → abrir con Google Sheets → *Archivo → Guardar como Hojas de cálculo de Google*.
   (Si ya tienes la versión creada desde Drive, usa esa.)
2. *Archivo → Configuración*: Configuración regional **Chile**, zona horaria **(GMT-03:00) Santiago**.
3. *Compartir* → agregar el `client_email` de la cuenta de servicio como **Editor**.
4. Copiar el ID de la URL: `https://docs.google.com/spreadsheets/d/`**`ESTE_ID`**`/edit`.

## 4. Variables de entorno en Netlify
*Site configuration → Environment variables* (las mismas de `.env.local.example`):

| Variable | Valor | Secreta |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ya existen | no |
| `SUPABASE_DB_URL` | Supabase → **Connect** → *Transaction pooler* (puerto 6543), con la contraseña de la base | **sí** |
| `SYNC_BUSINESS_ID` | el `id` del paso 1 | no |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` del JSON | no |
| `GOOGLE_PRIVATE_KEY` | `private_key` del JSON (completo, desde `-----BEGIN` hasta `END PRIVATE KEY-----\n`) | **sí** |
| `GOOGLE_SHEET_ID` | ID del paso 3 | no |
| `SYNC_CRON_SECRET` | texto aleatorio largo (p. ej. un generador de contraseñas, 40+ caracteres) | **sí** |

Marca las secretas como *Contains secret values*. Ninguna lleva prefijo `NEXT_PUBLIC_`, así nunca llegan al navegador.

## 5. Probar en una vista previa (sin tocar producción)
1. Netlify → *Deploys* → *Branch deploys*: activar para `v2-sheets` (o abrir un Pull Request: Netlify crea un *Deploy Preview*).
2. Entrar a la URL de la vista previa con la cuenta administradora.
3. *Configuración → Sincronización* → **Preparar matriz** (aplica formatos DD-MM-AAAA, $, %, casillas y protecciones) → **Sincronizar ahora**.
4. Revisar en la matriz: Productos, Ingredientes, Recetas, Clientes, Ventas con datos y `_estado_sync = OK`.
5. Hacer las pruebas de aceptación en vivo del informe (`docs/05-informe-pruebas.md`, sección "Pendiente en vivo").

## 6. Dar acceso a Camila
1. *Configuración → Personas con acceso*: su correo, rol **Operación**.
2. Supabase → *Authentication → Users → Invite user* con ese correo. Ella recibe un enlace y define su contraseña.
3. Al entrar verá solo las 5 acciones y las secciones de operación.

## 7. Publicar
Cuando la vista previa esté bien: unir `v2-sheets` en `main` (Pull Request → Merge). Netlify publica solo.
La función programada `sync-cron` queda activa (cada 10 minutos).

## Si algo sale mal
- App: Netlify → *Deploys* → elegir el deploy anterior → **Publish deploy** (vuelve en segundos).
- Base: `docs/07-respaldo-y-recuperacion.md`.
