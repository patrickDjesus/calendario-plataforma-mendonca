/**
 * Painel de som do modo foco.
 *
 * Duas fontes independentes, de proposito:
 *  - AMBIENTE: som sintetizado na hora (chuva, cafe, ruido). Nao usa arquivo,
 *    nao tem custo de download e nunca para.
 *  - MUSICA: arquivo do usuario, por escolha ou URL. Aqui nao entra nada
 *    empacotado no app — a licenca do som e de quem traz o arquivo.
 *
 * Os dois tem volume proprio. Um ambiente de chuva nao deve ser silenciado
 * junto com a trilha, nem o contrario.
 *
 * O audio para quando o painel desmonta: sair do modo foco encerra o som, senao
 * a trilha continuaria tocando na tela principal.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Music4, CloudRain, Coffee, Waves, Radio, Link2, Upload, Play, Pause } from 'lucide-react';
import { audioSynthesizer } from '../services/audioSynthesizer';
import { musicPlayer, AUDIO_ACCEPT, isProbablyAudio, type MusicState } from '../services/musicPlayer';

type AmbientType = 'none' | 'chuva' | 'cafe' | 'ruido_marrom' | 'ruido_branco' | 'binaural';

const AMBIENTS: { value: AmbientType; label: string; icon: React.ReactNode }[] = [
  { value: 'none', label: 'Silêncio', icon: <VolumeX className="w-3.5 h-3.5" /> },
  { value: 'chuva', label: 'Chuva', icon: <CloudRain className="w-3.5 h-3.5" /> },
  { value: 'cafe', label: 'Café', icon: <Coffee className="w-3.5 h-3.5" /> },
  { value: 'ruido_marrom', label: 'Ruído grave', icon: <Waves className="w-3.5 h-3.5" /> },
  { value: 'ruido_branco', label: 'Ruído', icon: <Radio className="w-3.5 h-3.5" /> },
  { value: 'binaural', label: 'Binaural', icon: <Music4 className="w-3.5 h-3.5" /> },
];

const PREF_KEY = 'focosemanal_focus_audio';

interface Prefs {
  ambient: AmbientType;
  ambientVolume: number;
  musicVolume: number;
}

const readPrefs = (): Prefs => {
  const fallback: Prefs = { ambient: 'none', ambientVolume: 0.5, musicVolume: 0.6 };
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return fallback;
  }
};

export const FocusAudioPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [musicState, setMusicState] = useState<MusicState>(musicPlayer.getState());
  const [trackLabel, setTrackLabel] = useState<string | null>(musicPlayer.getTrack()?.label ?? null);
  const [url, setUrl] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // A escolha do ambiente e volumes fica para a proxima sessao de foco.
  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {}
  }, [prefs]);

  // Ambiente comeca junto com o painel: o clique em abrir ja e o gesto exigido
  // pelo navegador para tocar audio.
  useEffect(() => {
    audioSynthesizer.setAmbientSound(prefs.ambient, prefs.ambientVolume);
    return () => audioSynthesizer.stopAmbient();
  }, []);

  useEffect(() => {
    audioSynthesizer.setAmbientVolume(prefs.ambientVolume);
  }, [prefs.ambientVolume]);

  useEffect(() => {
    musicPlayer.setVolume(prefs.musicVolume);
  }, [prefs.musicVolume]);

  useEffect(() => {
    musicPlayer.onStateChange = (s) => {
      setMusicState(s);
      if (s === 'blocked') setErro('O navegador bloqueou o autoplay. Clique em tocar de novo.');
      if (s === 'error') setErro('Nao consegui tocar esse arquivo. Confira se a URL aponta direto para um audio.');
      if (s === 'playing' || s === 'paused') setErro(null);
    };
    return () => { musicPlayer.onStateChange = undefined; };
  }, []);

  // Sair do modo foco encerra a trilha tambem.
  useEffect(() => () => {
    musicPlayer.stop();
  }, []);

  const escolherArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isProbablyAudio(file)) {
      setErro('Esse arquivo nao parece ser audio.');
      return;
    }
    await musicPlayer.playFile(file);
    setTrackLabel(musicPlayer.getTrack()?.label ?? null);
    e.target.value = '';
  };

  const tocarUrl = async () => {
    if (!url.trim()) return;
    await musicPlayer.playUrl(url);
    setTrackLabel(musicPlayer.getTrack()?.label ?? null);
  };

  const pararTudo = () => {
    musicPlayer.stop();
    setTrackLabel(null);
    setErro(null);
  };

  const ambienteAtivo = audioSynthesizer.getActiveAmbient();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Som ambiente e trilha"
        className={`h-9 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
          ambienteAtivo !== 'none' || musicState === 'playing'
            ? 'bg-blue-500 text-white shadow-xs'
            : 'bg-white hover:bg-black/5 text-slate-600 border border-black/10'
        }`}
      >
        <Volume2 className="w-3.5 h-3.5" />
        <span>Som</span>
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-30 w-72 rounded-2xl bg-white border border-black/10 shadow-xl p-4 space-y-4 text-left">
          {/* Ambiente */}
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Ambiente
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {AMBIENTS.map(a => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setPrefs(p => ({ ...p, ambient: a.value }))}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-bold transition-colors cursor-pointer ${
                    prefs.ambient === a.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {a.icon}
                  {a.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 mt-3">
              <span className="text-[10px] font-semibold text-slate-500 w-14">Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(prefs.ambientVolume * 100)}
                onChange={e => setPrefs(p => ({ ...p, ambientVolume: Number(e.target.value) / 100 }))}
                className="flex-1 accent-blue-500"
              />
            </label>
          </div>

          {/* Musica */}
          <div className="pt-3 border-t border-black/10">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Sua trilha
            </div>

            <input
              ref={fileRef}
              type="file"
              accept={AUDIO_ACCEPT}
              onChange={escolherArquivo}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Escolher arquivo no dispositivo
            </button>

            <div className="flex gap-1.5 mt-2">
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void tocarUrl(); }}
                placeholder="ou cole a URL do audio"
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-black/10 bg-slate-50 text-[11px] text-slate-700 focus:outline-none focus:border-blue-400"
              />
              <button
                type="button"
                onClick={tocarUrl}
                title="Tocar a URL"
                className="px-2.5 rounded-lg bg-slate-50 border border-black/10 text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {trackLabel && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void musicPlayer.toggle()}
                  className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center cursor-pointer hover:opacity-90"
                  title={musicState === 'playing' ? 'Pausar' : 'Tocar'}
                >
                  {musicState === 'playing'
                    ? <Pause className="w-3.5 h-3.5 fill-current" />
                    : <Play className="w-3.5 h-3.5 fill-current" />}
                </button>
                <span className="text-[11px] font-semibold text-slate-600 truncate flex-1">{trackLabel}</span>
                <button
                  type="button"
                  onClick={pararTudo}
                  className="text-[10px] font-bold text-slate-400 hover:text-rose-500 cursor-pointer"
                >
                  Tirar
                </button>
              </div>
            )}

            <label className="flex items-center gap-2 mt-2.5">
              <span className="text-[10px] font-semibold text-slate-500 w-14">Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(prefs.musicVolume * 100)}
                onChange={e => setPrefs(p => ({ ...p, musicVolume: Number(e.target.value) / 100 }))}
                className="flex-1 accent-blue-500"
              />
            </label>
          </div>

          {erro && (
            <p className="text-[10px] text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2 leading-relaxed">
              {erro}
            </p>
          )}

          <p className="text-[10px] text-slate-400 leading-relaxed">
            O app nao distribui musica. Use um arquivo seu ou uma URL que voce
            tenha direito de ouvir.
          </p>
        </div>
      )}
    </div>
  );
};
