#!/usr/bin/env node
/** Regenerate deployed brand assets; optionally export the marketing kit. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import sharp from "sharp";

const { values } = parseArgs({ options: { "brand-kit": { type: "boolean", default: false } } });
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");
const mark = JSON.parse(await readFile(join(root, "src/lib/brand-mark.json"), "utf8"));
const colors = { void: "#07090a", accent: "#46d39a", text: "#f5f7f3", muted: "#9aa394" };
const symbol = `<path d="${mark.path}" fill="none" stroke="${colors.accent}" stroke-width="${mark.strokeWidth}" stroke-linejoin="round"/>`;
const title = "<title>OMA — Open Model Access</title>";
const svg = (width, height, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${title}${body}</svg>\n`;
const text = (x, y, size, value, color = colors.text, extra = "") => `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="600" ${extra}>${value}</text>`;
const background = (width, height, radius = 0) => `<rect width="${width}" height="${height}" rx="${radius}" fill="${colors.void}"/>`;
const icon = svg(100, 100, background(100, 100, 22) + `<g transform="translate(15 14) scale(.7)">${symbol}</g>`);
const favicon = svg(100, 100, background(100, 100, 22) + `<g transform="translate(10 9) scale(.8)">${symbol}</g>`);
// Maskable icon geometry fits entirely inside the central 80% safe circle.
const maskable = svg(100, 100, background(100, 100) + `<g transform="translate(22 20) scale(.56)">${symbol}</g>`);
const lockup = svg(480, 120, background(480, 120, 16) + `<g transform="translate(24 20) scale(.8)">${symbol}</g>` + text(132, 67, 44, "OMA", colors.text, 'letter-spacing="2"') + text(134, 93, 12, "OPEN MODEL ACCESS", colors.accent, 'letter-spacing="2.2"'));
const card = svg(1200, 630, background(1200, 630) + `<g transform="translate(500 100) scale(2)">${symbol}</g>` + text(600, 392, 76, "OMA", colors.text, 'text-anchor="middle" letter-spacing="5"') + text(600, 445, 18, "OPEN MODEL ACCESS", colors.accent, 'text-anchor="middle" letter-spacing="4"') + text(600, 536, 22, "One gateway. Every model. No lock-in.", colors.muted, 'text-anchor="middle"'));
const og = svg(1280, 720, background(1280, 720) + `<g transform="translate(76 70) scale(.8)">${symbol}</g>` + text(183, 131, 48, "OMA", colors.text, 'letter-spacing="3"') + text(80, 324, 70, "One gateway.") + text(80, 410, 70, "Every model.", colors.accent) + text(82, 488, 34, "No lock-in.", colors.muted) + text(82, 641, 19, "OPEN MODEL ACCESS", colors.muted, 'letter-spacing="3"') + `<g transform="translate(854 254) scale(3)">${symbol}</g>`);

await mkdir(join(pub, "logos"), { recursive: true });
for (const [path, content] of Object.entries({
  "favicon.svg": favicon,
  "logos/oma-mark.svg": svg(100, 100, symbol),
  "logos/oma-icon.svg": icon,
  "logos/oma-logo.svg": lockup,
  "logos/oma-wordmark.svg": lockup,
  "logos/oma-brand-card.svg": card,
})) await writeFile(join(pub, path), content);

async function png(source, path, width, height = width, outputDir = pub) {
  const buffer = await sharp(Buffer.from(source)).resize(width, height).png().toBuffer();
  await writeFile(join(outputDir, path), buffer);
  return buffer;
}
const iconImages = [];
for (const size of [16, 32, 48]) {
  const buffer = await sharp(Buffer.from(favicon)).resize(size, size).png().toBuffer();
  if (size !== 48) await writeFile(join(pub, `favicon-${size}x${size}.png`), buffer);
  iconImages.push({ size, buffer });
}
// A real ICO directory with three PNG payloads, rather than a renamed PNG.
const header = Buffer.alloc(6 + 16 * iconImages.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(iconImages.length, 4);
let offset = header.length;
iconImages.forEach(({ size, buffer }, index) => {
  const entry = 6 + index * 16;
  header[entry] = size;
  header[entry + 1] = size;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(buffer.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += buffer.length;
});
await writeFile(join(pub, "favicon.ico"), Buffer.concat([header, ...iconImages.map(({ buffer }) => buffer)]));
await png(icon, "apple-touch-icon.png", 180);
for (const size of [192, 512, 1024]) await png(icon, `logos/oma-icon-${size}.png`, size);
await png(maskable, "logos/oma-icon-maskable-512.png", 512);
await png(lockup, "logos/oma-wordmark.png", 960, 240);
await png(card, "logos/oma-brand-card.png", 1200, 630);
await png(og, "og-image.png", 1280, 720);
console.log("Regenerated OMA SVGs, PNGs, ICO, app icons and social cards.");

// Promotional exports are optional build artifacts, not deployed website assets.
if (values["brand-kit"]) {
  const marketingDir = join(root, "..", "artifacts", "brand-kit");
  await mkdir(marketingDir, { recursive: true });
  await png(card, "oma-brand-card.png", 2400, 1260, marketingDir);
  await png(lockup, "oma-lockup-horizontal.png", 1440, 360, marketingDir);
  await sharp(Buffer.from(lockup)).resize(1440, 360).jpeg({ quality: 92 }).toFile(join(marketingDir, "oma-lockup-horizontal.jpg"));
  await sharp(Buffer.from(icon)).resize(1024, 1024).flatten({ background: colors.void }).jpeg({ quality: 92 }).toFile(join(marketingDir, "oma-icon-promo.jpg"));
  console.log(`Exported optional marketing kit to ${marketingDir}.`);
}
