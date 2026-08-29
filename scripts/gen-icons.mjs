// Genera los iconos de la PWA a partir de public/logo.png
// Uso: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "public/logo.png";
const OUT = "public/icons";
const PEACH = { r: 0xf7, g: 0xe0, b: 0xc3, alpha: 1 };

await mkdir(OUT, { recursive: true });

// Iconos "any" (transparencia permitida)
await sharp(SRC).resize(192, 192).png().toFile(`${OUT}/icon-192.png`);
await sharp(SRC).resize(512, 512).png().toFile(`${OUT}/icon-512.png`);

// Icono "maskable": logo centrado sobre fondo durazno (zona segura ~82%)
async function maskable(size, ratio, file) {
  const inner = Math.round(size * ratio);
  const logo = await sharp(SRC).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: PEACH } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(`${OUT}/${file}`);
}
await maskable(512, 0.8, "maskable-512.png");
await maskable(192, 0.8, "maskable-192.png");

// Apple touch icon (iOS no usa transparencia): fondo durazno
await maskable(180, 0.86, "apple-touch-180.png");

console.log("Iconos generados en public/icons ✓");
