import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const SOURCE_PNG = path.join(repoRoot, 'src', 'pwa', 'icononly_transparent_nobuffer.png');
const OUT_DIR = path.join(repoRoot, 'public', 'icons');

const BG = '#090909';

async function ensureSourceExists() {
  try {
    await fs.access(SOURCE_PNG);
  } catch {
    throw new Error(`Missing source icon at: ${SOURCE_PNG}`);
  }
}

async function writeAnyPng(size) {
  const outPath = path.join(OUT_DIR, `pwa-${size}.png`);
  await sharp(SOURCE_PNG)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
}

async function writeMaskablePng(size) {
  const inner = Math.round(size * 0.75);
  const pad = Math.floor((size - inner) / 2);
  const outPath = path.join(OUT_DIR, `pwa-maskable-${size}.png`);

  await sharp(SOURCE_PNG)
    .resize(inner, inner, { fit: 'contain', background: BG })
    .extend({
      top: pad,
      bottom: size - inner - pad,
      left: pad,
      right: size - inner - pad,
      background: BG,
    })
    .png()
    .toFile(outPath);
}

async function writeAppleTouchIcon() {
  const size = 180;
  const outPath = path.join(OUT_DIR, 'apple-touch-icon.png');

  await sharp(SOURCE_PNG)
    .resize(size, size, { fit: 'contain', background: BG })
    .flatten({ background: BG })
    .png()
    .toFile(outPath);
}

async function main() {
  await ensureSourceExists();
  await fs.mkdir(OUT_DIR, { recursive: true });

  await writeAnyPng(192);
  await writeAnyPng(512);

  await writeMaskablePng(192);
  await writeMaskablePng(512);

  await writeAppleTouchIcon();
}

await main();
