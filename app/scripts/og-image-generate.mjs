import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, "..", "public", "og-image.svg");
const pngPath = join(__dirname, "..", "public", "og-image.png");

const svg = await readFile(svgPath);
const png = await sharp(svg, { density: 96 }).resize(1200, 630).png().toBuffer();
await writeFile(pngPath, png);
console.log(`Wrote ${pngPath} (${png.length} bytes)`);
