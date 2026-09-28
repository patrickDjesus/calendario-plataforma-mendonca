/**
 * Acelera/desacelera GIFs sem re-encode, multiplicando o field "delay"
 * (centessimos de segundo) de cada Graphic Control Extension. Só 2 bytes por
 * frame mudam: LZW, paleta, alfa e tamanho permanecem intactos.
 *
 * Uso:  node scripts/gif-slow.mjs
 *
 * Idempotente: grava os delays virgens em scripts/gif-delays.orig.json no
 * primeiro run e sempre recalcula a partir deles. Para mudar o fator, edite
 * FACTOR e rode de novo.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const GIF_DIR = path.join(ROOT, 'public', 'gifs');
const MANIFEST = path.join(ROOT, 'scripts', 'gif-delays.orig.json');

/**
 * Fator de velocidade (multiplicado em TODOS os frames do asset). 0.5 = 2x mais
 * rapido. 0.8 = 1.25x mais rapido, que e o ritmo atual: bem mais vivo que o
 * original, sem carregar o GIF ate o corte de animacao.
 */
const FACTOR = 0.8;

/**
 * Piso do atraso. Navegadores tratam delay 0 ou 1 como 10 centessimos (100ms),
 * ou seja, um frame "acelerado" demais vira um frame lento de 100ms. 2cs
 * (20ms) e o menor valor que o formato entrega de verdade.
 * So vale ao ACELERAR: com FACTOR >= 1 o arquivo original e devolvido byte a
 * byte, sem piso algum.
 */
const MIN_DELAY_CS = 2;

/** Assets que ficam no ritmo original, fora do FACTOR. Vazio = todos aceleram. */
const KEEP = new Set([
]);

/** Caminha pela estrutura do GIF chamando onGce(offsetDoDelay, delayAtual). */
function walkGif(buf, onGce) {
  let p = 6;
  if (buf.length < 13) throw new Error('Arquivo menor que o header mínimo');
  const packed = buf[p + 4];
  p += 7;
  if (packed & 0x80) p += 3 * (1 << ((packed & 7) + 1));

  let gce = 0;
  let img = 0;
  let trailer = -1;
  let truncated = false;

  outer: while (p < buf.length) {
    const b = buf[p];
    if (b === 0x3b) { trailer = p; break; }

    if (b === 0x21) {
      const label = buf[p + 1];
      p += 2;
      if (label === 0xf9) {
        const size = buf[p];
        if (size !== 4) throw new Error(`GCE com size inesperado ${size} em ${p}`);
        const off = p + 2;
        onGce(off, buf.readUInt16LE(off));
        gce++;
        p += size + 2;
        if (buf[p - 1] !== 0) throw new Error(`GCE sem terminador em ${p - 1}`);
        continue;
      }
      let size = buf[p];
      while (size !== 0) {
        if (p + 1 + size > buf.length) { truncated = true; break outer; }
        p += size + 1; size = buf[p];
      }
      p += 1;
      continue;
    }

    if (b === 0x2c) {
      const ip = buf[p + 9];
      p += 10;
      if (ip & 0x80) p += 3 * (1 << ((ip & 7) + 1));
      p += 1;
      let size = buf[p];
      while (size !== 0) {
        if (p + 1 + size > buf.length) { truncated = true; break outer; }
        p += size + 1; size = buf[p];
      }
      p += 1;
      img++;
      continue;
    }

    throw new Error(`Byte inesperado 0x${b.toString(16)} em ${p}`);
  }

  return { gce, img, trailer, truncated };
}

function listGifs() {
  return fs.readdirSync(GIF_DIR).filter((f) => f.endsWith('.gif')).sort();
}

/**
 * Estrutura consistente: arquivo intacto (gce==img e trailer no fim) OU
 * truncado no ultimo frame (gce==img ou img==gce-1), o que preserva todos
 * os delays, que vivem antes dos dados do ultimo frame.
 */
function isStructurallyValid({ gce, img, trailer, truncated }, len) {
  if (gce === 0 || img === 0) return false;
  if (truncated) return img === gce || img === gce - 1;
  return gce === img && trailer === len - 1;
}

function ensureManifest(gifs) {
  let manifest = {};
  let missing = gifs;
  if (fs.existsSync(MANIFEST)) {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    missing = gifs.filter((f) => !Array.isArray(manifest[f]));
  }
  if (missing.length === 0) return manifest;

  for (const file of gifs) {
    if (Array.isArray(manifest[file])) continue;
    const buf = fs.readFileSync(path.join(GIF_DIR, file));
    const delays = [];
    const info = walkGif(buf, (off, d) => delays.push(d));
    if (delays.length === 0 || !isStructurallyValid(info, buf.length)) {
      const { gce, img, truncated } = info;
      throw new Error(`Estrutura inválida em ${file} (gce=${gce} img=${img} trunc=${truncated})`);
    }
    if (info.truncated) console.log(`   [atencao] ${file} termina truncado (ultimo frame incompleto)`);
    manifest[file] = delays;
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

function sum(delays) {
  return delays.reduce((a, b) => a + b, 0) / 100;
}

const gifs = listGifs();
const manifest = ensureManifest(gifs);
let changed = 0;

for (const file of gifs) {
  const fsPath = path.join(GIF_DIR, file);
  const original = fs.readFileSync(fsPath);
  const pristine = manifest[file];

  const entries = [];
  walkGif(original, (off, d) => entries.push({ off, d }));

  if (entries.length !== pristine.length) {
    throw new Error(`${file}: numero de frames mudou (${entries.length} vs ${pristine.length})`);
  }

  const isKept = KEEP.has(file);
  const floor = FACTOR < 1 ? MIN_DELAY_CS : 1;
  const target = entries.map((e, i) =>
    isKept ? pristine[i] : Math.max(floor, Math.round(pristine[i] * FACTOR))
  );
  const clamped = target.map((t) => Math.min(65535, Math.max(floor, t)));

  if (!clamped.every((t, i) => t === entries[i].d)) {
    const out = Buffer.from(original);
    entries.forEach((e, i) => out.writeUInt16LE(clamped[i], e.off));
    fs.writeFileSync(fsPath, out);
    if (out.length !== original.length) {
      throw new Error(`${file}: tamanho mudou (${original.length} -> ${out.length})`);
    }
    const check = [];
    const info = walkGif(out, (off, d) => check.push(d));
    if (check.length !== pristine.length || !isStructurallyValid(info, out.length)) {
      throw new Error(`${file}: estrutura corrompida apos o patch`);
    }
    if (!check.every((t, i) => t === clamped[i])) {
      throw new Error(`${file}: atrasos nao aplicados corretamente`);
    }
    changed++;
  }

  const before = sum(pristine);
  const now = sum(clamped);
  console.log(
    `${file.padEnd(28)} frames=${String(entries.length).padStart(4)}  ` +
      `${isKept ? '1x  ' : FACTOR + 'x '}loop ${before.toFixed(2).padStart(6)}s -> ${now.toFixed(2).padStart(6)}s` +
      `  (${(before / now).toFixed(2)}x mais rapido)`
  );
}

console.log(
  `\n${changed}/${gifs.length} arquivos alterados (fator ${FACTOR}x, piso ${MIN_DELAY_CS}cs, ` +
    `${KEEP.size} no ritmo original).`
);
if (changed === 0) console.log('Nada a fazer: atrasos ja estao no fator desejado.');