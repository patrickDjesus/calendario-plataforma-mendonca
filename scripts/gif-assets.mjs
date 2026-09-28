/**
 * Pipeline de assets das ilustrações.
 *
 *   node scripts/gif-assets.mjs
 *
 * 1. Verifica se cada GIF do acervo tem fundo branco puro em TODOS os frames
 *    (borda externa de 3px). O resultado define quais recebem
 *    `mix-blend-mode: multiply` em GifIcon.tsx em vez de recorte/colorkey.
 * 2. Mede a duração real de um ciclo de cada GIF (soma dos atrasos dos frames),
 *    usada para o "anima ~1 ciclo" no toque em GifIcon.tsx.
 * 3. Regenera os frames estáticos em public/gifs/still/ (primeiro frame).
 *
 * Requer as devDependencies do projeto (sharp), rodando dentro do repo:
 *   npm install --legacy-peer-deps
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const GIF_DIR = path.join(ROOT, 'public', 'gifs');
const STILL_DIR = path.join(GIF_DIR, 'still');

/* ------------------------------------------------------------------ */
/* 1. Fundo branco por frame                                          */
/* ------------------------------------------------------------------ */

/** Domina a cor do anel externo de `margin` pixels. */
async function borderColor(gifPath, page, margin = 3) {
  const { data, info } = await sharp(gifPath, { page }).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const at = (x, y) => {
    const o = (y * width + x) * channels;
    return [data[o], data[o + 1], data[o + 2]];
  };

  const counts = new Map();
  let total = 0;
  for (let x = 0; x < width; x++) {
    for (const y of [0, 1, 2, height - 3, height - 2, height - 1]) {
      total++;
      const k = at(x, y).join(',');
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, 1, 2, width - 3, width - 2, width - 1]) {
      total++;
      const k = at(x, y).join(',');
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }

  const [dom, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const [r, g, b] = dom.split(',').map(Number);
  return { rgb: [r, g, b], share: count / total, isWhite: r === 255 && g === 255 && b === 255 };
}

async function reportBackground(gifPath) {
  const meta = await sharp(gifPath, { animated: true, pages: -1 }).metadata();
  const pages = meta.pages ?? 1;

  // Amostragem: início, transição e fim de cada faixa de tempo.
  const picks = [...new Set([0, 1, 2, Math.floor(pages / 2), pages - 2, pages - 1])]
    .filter((p) => p >= 0 && p < pages);

  const samples = [];
  for (const p of picks) samples.push(await borderColor(gifPath, p));

  const worst = samples.reduce((acc, s) => (s.share < acc.share ? s : acc), samples[0]);
  return {
    pages,
    solidWhite: samples.every((s) => s.isWhite && s.share === 1),
    worst,
  };
}

/* ------------------------------------------------------------------ */
/* 2. Duração do ciclo (Graphic Control Extension)                    */
/* ------------------------------------------------------------------ */

/** Soma os atrasos, em centésimos de segundo, de cada frame do GIF. */
function loopDurationMs(buf) {
  if (buf.slice(0, 3).toString('latin1') !== 'GIF') return null;
  let i = 6;

  const flags = buf[10];
  if (flags & 0x80) i += 3 * (2 ** ((flags & 0x07) + 1));

  let ms = 0;
  let frames = 0;

  while (i < buf.length) {
    const marker = buf[i];

    if (marker === 0x3b) break; // trailer
    if (marker === 0x21) {
      // Graphic Control Extension: guarda o atraso daquele frame.
      if (buf[i + 1] === 0xf9 && buf[i + 2] === 0x04) {
        const delayCs = buf[i + 4] | (buf[i + 5] << 8);
        // Navegadores tratam 0 e 1 como 100ms.
        ms += (delayCs <= 1 ? 10 : delayCs) * 10;
        frames++;
      }
      i += 2; // pula rótulo + tamanho até o terminador 0x00
      while (i < buf.length && buf[i] !== 0) i += buf[i] + 1;
      i += 1;
    } else if (marker === 0x2c) {
      // Image Descriptor + Local Color Table + LZW + sub-blocos
      const lflags = buf[i + 9];
      i += 10;
      if (lflags & 0x80) i += 3 * (2 ** ((lflags & 0x07) + 1));
      i += 1;
      while (i < buf.length && buf[i] !== 0) i += buf[i] + 1;
      i += 1;
    } else {
      i += 1;
    }
  }

  return { ms, frames };
}

/* ------------------------------------------------------------------ */
/* main                                                               */
/* ------------------------------------------------------------------ */

const files = (await readdir(GIF_DIR))
  .filter((f) => f.toLowerCase().endsWith('.gif'))
  .sort();

await mkdir(STILL_DIR, { recursive: true });

const whiteBackdrop = [];
const loopTable = [];

for (const file of files) {
  const gifPath = path.join(GIF_DIR, file);
  const name = path.basename(file, '.gif');

  const bg = await reportBackground(gifPath);
  if (bg.solidWhite) whiteBackdrop.push(name);

  const loop = loopDurationMs(await readFile(gifPath));
  loopTable.push([name, loop.ms]);

  // Frame estático = primeiro frame do GIF.
  await sharp(gifPath, { page: 0 }).png().toFile(path.join(STILL_DIR, `${name}.png`));

  console.log(
    `${name.padEnd(26)} frames=${String(bg.pages).padStart(4)}  loop=${String(loop.ms).padStart(6)}ms  ` +
      `fundoBranco=${bg.solidWhite ? 'SIM (multiply)' : 'nao (usar PNG com alfa)'}`
  );
}

console.log(`\nstill/ regravado com ${files.length} frames em ${path.relative(ROOT, STILL_DIR)}`);
console.log(`\n1) WHITE_BACKDROP em GifIcon.tsx (mix-blend-mode: multiply):`);
console.log(whiteBackdrop.map((n) => `  '${n}': true,`).join('\n'));
console.log(`\n2) LOOP_MS em GifIcon.tsx:`);
console.log(loopTable.map(([n, ms]) => `  '${n}': ${ms},`).join('\n'));
