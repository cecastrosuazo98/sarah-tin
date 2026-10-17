/**
 * Respaldo de la base en archivos JSON (una carpeta por respaldo).
 *
 * Uso:  SUPABASE_DB_URL="postgres://..." node scripts/backup-db.mjs
 * Salida: respaldos/AAAA-MM-DD_HHMM/<tabla>.json + resumen.json
 *
 * La carpeta respaldos/ está en .gitignore: contiene datos reales del negocio,
 * no la subas a GitHub ni la compartas. Este respaldo complementa (no reemplaza)
 * el de Supabase; antes de migrar sigue docs/07-respaldo-y-recuperacion.md.
 */
import postgres from "postgres";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Falta SUPABASE_DB_URL (cadena de conexión de la base). No se escribe en la consola ni en el código.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false, ssl: "require" });
const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "");
const dir = join(process.cwd(), "respaldos", stamp);
mkdirSync(dir, { recursive: true });

try {
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`;
  const summary = { created_at: new Date().toISOString(), tables: {} };
  for (const { table_name } of tables) {
    const rows = await sql.unsafe(`select * from public."${table_name}"`);
    writeFileSync(join(dir, `${table_name}.json`), JSON.stringify(rows, null, 1));
    summary.tables[table_name] = rows.length;
    console.log(`${table_name}: ${rows.length} filas`);
  }
  writeFileSync(join(dir, "resumen.json"), JSON.stringify(summary, null, 2));
  console.log(`\nRespaldo listo en ${dir}`);
} finally {
  await sql.end();
}
