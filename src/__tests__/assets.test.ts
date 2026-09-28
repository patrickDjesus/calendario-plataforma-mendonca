/**
 * Trava de integridade do acervo de GIFs. Um `GifName` novo sem arquivo em
 * public/ só apareceria como imagem quebrada em runtime (e foi exatamente o
 * que aconteceu com pessoal/outros ao copiar arquivos para a pasta errada).
 */

import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { GIF_NAMES, LOOP_MS, gifSrc, gifStillSrc } from '../components/GifIcon';

const raiz = join(process.cwd(), 'public');
const emDisco = (urlPath: string) => join(raiz, urlPath.replace(/^\//, ''));

describe('acervo de GIFs', () => {
  it('tem arquivo para cada GifName declarado no codigo', () => {
    const faltando = GIF_NAMES.filter((name) => !existsSync(emDisco(gifSrc(name)))).map(gifSrc);
    expect(faltando).toEqual([]);
  });

  it('tem frame estatico para cada GIF animado', () => {
    const faltando = GIF_NAMES
      .filter((name) => gifStillSrc(name) !== gifSrc(name))
      .filter((name) => !existsSync(emDisco(gifStillSrc(name))))
      .map(gifStillSrc);
    expect(faltando).toEqual([]);
  });

  it('nao tem frame estatico vazio', () => {
    const vazios = GIF_NAMES
      .filter((name) => existsSync(emDisco(gifStillSrc(name))))
      .filter((name) => statSync(emDisco(gifStillSrc(name))).size < 512);
    expect(vazios).toEqual([]);
  });

  it('foguete e PNG puro e por isso nao tem arquivo .gif', () => {
    expect(gifSrc('foguete')).toBe('/gifs/foguete.png');
    expect(gifStillSrc('foguete')).toBe(gifSrc('foguete'));
  });

  it('todo GIF animado tem duracao de ciclo declarada (evita o fallback de 2000ms)', () => {
    const semDuracao = GIF_NAMES.filter(
      (name) => !gifStillSrc(name).endsWith('.png') && !LOOP_MS[name]
    );
    expect(semDuracao).toEqual([]);
  });

  it('toda duracao declarada pertence a um GIF que existe', () => {
    const orfaos = Object.keys(LOOP_MS).filter(
      (name) => !GIF_NAMES.includes(name as (typeof GIF_NAMES)[number])
    );
    expect(orfaos).toEqual([]);
  });

  it('nenhuma duracao de ciclo esta zerada ou absurda', () => {
    const invalidas = Object.entries(LOOP_MS)
      .filter(([, ms]) => typeof ms !== 'number' || (ms as number) < 400 || (ms as number) > 20000)
      .map(([name]) => name);
    expect(invalidas).toEqual([]);
  });
});
