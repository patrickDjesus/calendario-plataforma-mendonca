/**
 * Trilha sonora do modo foco — arquivos do próprio usuário.
 *
 * Deliberadamente separado do `audioSynthesizer`, que é procedural: aqui entra
 * áudio de verdade, em arquivo. Nenhum bundled: o app não distribui música com
 * copyright. A origem do som é sempre do usuário — um MP3 que ele escolheu no
 * dispositivo, ou uma URL direta que ele colou.
 *
 * O `<audio>` é criado preguiçosamente e reaproveitado entre faixas, porque criar
 * um elemento novo a cada troca derruba o áudio em alguns navegadores mobile.
 *
 * Autoplay: o navegador só deixa tocar depois de um gesto do usuário. Por isso
 * `play()` só é chamado a partir de um clique, e falha de promessa vira estado
 * `blocked` em vez de exceção — quem chama mostra o aviso.
 */

export type MusicState = 'idle' | 'playing' | 'paused' | 'blocked' | 'error';

export interface TrackSource {
  id: string;
  label: string;
  url: string;
  /** true quando a URL é um objectURL criado a partir de um File local. */
  isLocal: boolean;
}

export class MusicPlayer {
  private el: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private _state: MusicState = 'idle';
  private _volume = 0.6;
  private _track: TrackSource | null = null;

  public onStateChange?: (state: MusicState) => void;

  private setState(s: MusicState): void {
    this._state = s;
    this.onStateChange?.(s);
  }

  public getState(): MusicState {
    return this._state;
  }

  public getTrack(): TrackSource | null {
    return this._track;
  }

  private ensureElement(): HTMLAudioElement {
    if (!this.el) {
      this.el = new Audio();
      this.el.loop = true; // trilha de foco é laço, não faixa com fim
      this.el.preload = 'auto';
      this.el.volume = this._volume;
    }
    return this.el;
  }

  private releaseObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  /**
   * File escolhido no dispositivo. O objectURL fica vivo enquanto a faixa toca e
   * só é liberado quando outra entra — revogar antes de tocar quebraria a fonte.
   */
  public async playFile(file: File): Promise<void> {
    this.releaseObjectUrl();
    this.objectUrl = URL.createObjectURL(file);
    const label = file.name.replace(/\.[^.]+$/, '');
    await this.load({ id: `local:${file.name}:${file.size}`, label, url: this.objectUrl, isLocal: true });
  }

  /** URL direta (.mp3/.ogg/.m4a). Exige CORS so quando vem de outro dominio. */
  public async playUrl(url: string, label?: string): Promise<void> {
    this.releaseObjectUrl();
    const clean = url.trim();
    const name = label?.trim() || clean.split('/').pop() || 'Trilha';
    await this.load({ id: `url:${clean}`, label: name.replace(/\.[^.]+$/, ''), url: clean, isLocal: false });
  }

  private async load(track: TrackSource): Promise<void> {
    const el = this.ensureElement();
    this._track = track;
    el.src = track.url;
    el.loop = true;
    el.volume = this._volume;
    try {
      await el.play();
      this.setState('playing');
    } catch (e) {
      // Codec sem suporte ou bloqueio de autoplay viram estado, nao crash.
      const err = e as DOMException;
      this.setState(err?.name === 'NotAllowedError' ? 'blocked' : 'error');
    }
  }

  public async toggle(): Promise<void> {
    const el = this.ensureElement();
    if (!this._track) return;
    if (this._state === 'playing') {
      el.pause();
      this.setState('paused');
    } else {
      try {
        await el.play();
        this.setState('playing');
      } catch {
        this.setState('blocked');
      }
    }
  }

  public stop(): void {
    if (this.el) {
      this.el.pause();
      this.el.removeAttribute('src');
      this.el.load();
    }
    this.releaseObjectUrl();
    this._track = null;
    this.setState('idle');
  }

  public setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(v, 1));
    if (this.el) this.el.volume = this._volume;
  }

  public getVolume(): number {
    return this._volume;
  }
}

export const musicPlayer = new MusicPlayer();

/** So aceita o que o navegador realmente toca, para nao oferecer arquivo inutil. */
export const AUDIO_ACCEPT = 'audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/webm';

export const isProbablyAudio = (file: File): boolean =>
  file.type.startsWith('audio/') || /\.(mp3|ogg|wav|m4a|aac|webm)$/i.test(file.name);
