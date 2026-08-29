// Genera los iconos de la PWA a partir de public/logo.png,
// recortados a los dos niños (igual que el emblema de la app).
// Uso: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "public/logo.png";
const OUT = "public/icons";
const PEACH = { r: 0xf7, g: 0xe0, b: 0xc3, alpha: 1 };

// Recorte que enfoca a los dos niños. Equivale al zoom del emblema
// (scale 2.4, transform-origin 50% 11%) sobre el logo de 1181x1181.
const CROP = { left: 344, top: 76, width: 492, height: 492 };

await mkdir(OUT, { recursive: true });

// Buffer recortado a los niños (se reutiliza en todos los tamaños).
const kids = await sharp(SRC).extract(CROP).png().toBuffer();

// Iconos "any" (recorte a los niños, a sangre completa)
await sharp(kids).resize(192, 192).png().toFile(`${OUT}/icon-192.png`);
await sharp(kids).resize(512, 512).png().toFile(`${OUT}/icon-512.png`);

// Icono "maskable": niños centrados sobre fondo durazno (zona segura)
async function maskable(size, ratio, file) {
  const inner = Math.round(size * ratio);
  const logo = await sharp(kids).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: PEACH } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(`${OUT}/${file}`);
}
await maskable(512, 0.82, "maskable-512.png");
await maskable(192, 0.82, "maskable-192.png");

// Apple touch icon (iOS, sin transparencia): niños sobre fondo durazno
await maskable(180, 0.9, "apple-touch-180.png");

console.log("Iconos (recortados a los niños) generados en public/icons ✓");
