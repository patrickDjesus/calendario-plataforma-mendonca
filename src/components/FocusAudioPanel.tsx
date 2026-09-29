/**
 * Painel de som do modo foco.
 *
 * Duas fontes independentes, de proposito:
 *  - AMBIENTE: som sintetizado na hora (chuva, cafe, ruido). Usa um AudioContext
 *    local, nunca passa pelo gate de Aviso Sonoro e para quando o painel desmonta.
 *  - MUSICA: video do YouTube escolhido pelo proprio usuario. Nada e empacotado
 *    no app — a licenca do conteudo e de quem o fornece. O player fica escondido
 *    (iframe 1x1), mas mantem volume e play/pause controlaveis.
 *
 * O audio para quando o painel desmonta: sair do modo foco encerra o som, senao
 * a trilha continuaria tocando na tela principal.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Music4, CloudRain, Coffee, Waves, Radio, Youtube, Play, Pause, Loader2 } from 'lucide-react';
import { audioSynthesizer } from '../services/audioSynthesizer';

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
  ytUrl: string;
}

const readPrefs = (): Prefs => {
  const fallback: Prefs = { ambient: 'none', ambientVolume: 0.5, musicVolume: 0.6, ytUrl: '' };
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return fallback;
  }
};

/** Extrai o id do video de qualquer formato comum de URL do YouTube. */
const parseYouTubeId = (url: string): string | null => {
  const u = url.trim();
  const match = u.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return match ? match[1] : null;
};

declare global {
  interface Window {
    YT?: {
      Player: new (id: string, opts: Record<string, unknown>) => {
        destroy: () => void;
        playVideo: () => void;
        pauseVideo: () => void;
        setVolume: (v: number) => void;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;
/** Carrega a API do YouTube uma vez so, e devolve quando ela estiver pronta. */
const ensureYouTubeApi = (): Promise<void> => {
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return ytApiPromise;
};

interface YTPlayerHandle {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (v: number) => void;
}

export const FocusAudioPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [url, setUrl] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const playerRef = useRef<YTPlayerHandle | null>(null);
  const ytHostId = useRef(`yt-host-${Math.random().toString(36).slice(2)}`);

  // A escolha do ambiente e volume fica para a proxima sessao de foco.
  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {}
  }, [prefs]);

  // Ambiente: inicia/para de acordo com a escolha. Precisa rodar a cada troca,
  // nao so no mount — antes, clicar em "Chuva" nao iniciava nada.
  useEffect(() => {
    audioSynthesizer.setAmbientSound(prefs.ambient, prefs.ambientVolume);
    return () => audioSynthesizer.stopAmbient();
  }, [prefs.ambient, prefs.ambientVolume]);

  // Arranca sozinho quando o painel monta? Sim, se ja havia URL salva: o abrir
  // do modo foco ja e o gesto do navegador que libera autoplay de video.
  useEffect(() => {
    if (prefs.ytUrl) {
      const id = parseYouTubeId(prefs.ytUrl);
      if (id) setVideoId(id);
    }
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  // Player do YouTube para o video escolhido. Trocar de video destroi e recria.
  useEffect(() => {
    if (!videoId) return;
    let disposed = false;
    playerRef.current?.destroy();
    playerRef.current = null;
    setLoading(true);
    setErro(null);

    ensureYouTubeApi()
      .then(() => {
        if (disposed || !window.YT?.Player) return;
        const player = new window.YT.Player(ytHostId.current, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 1, loop: 1, playlist: videoId, controls: 0, rel: 0, playsinline: 1 },
          events: {
            onReady: () => {
              if (disposed) return;
              playerRef.current = player;
              player.setVolume(Math.round(prefs.musicVolume * 100));
              setLoading(false);
              setPlaying(true);
            },
          },
        });
      })
      .catch(() => {
        if (disposed) return;
        setLoading(false);
        setErro('Não consegui carregar o player do YouTube. Confira a conexão.');
      });

    return () => {
      disposed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId]);

  // Volume da trilha vai para o player a cada mudanca.
  useEffect(() => {
    playerRef.current?.setVolume(Math.round(prefs.musicVolume * 100));
  }, [prefs.musicVolume]);

  const tocarYouTube = async () => {
    const id = parseYouTubeId(url);
    if (!id) {
      setErro('Essa URL não parece um link do YouTube.');
      return;
    }
    setUrl('');
    setPrefs(p => ({ ...p, ytUrl: url.trim() }));
    setVideoId(id);
  };

  const alternar = () => {
    const player = playerRef.current;
    if (!player) return;
    if (playing) {
      player.pauseVideo();
      setPlaying(false);
    } else {
      player.playVideo();
      setPlaying(true);
    }
  };

  const tirar = () => {
    playerRef.current?.destroy();
    playerRef.current = null;
    setVideoId(null);
    setPlaying(false);
    setPrefs(p => ({ ...p, ytUrl: '' }));
  };

  const ambienteAtivo = audioSynthesizer.getActiveAmbient();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Som ambiente e trilha"
        className={`h-9 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
          ambienteAtivo !== 'none' || playing
            ? 'bg-blue-500 text-white shadow-xs'
            : 'bg-white hover:bg-black/5 text-slate-600 border border-black/10'
        }`}
      >
        <Volume2 className="w-3.5 h-3.5" />
        <span>Som</span>
      </button>

      {/* Host escondido do player do YouTube: sempre no DOM para o player
          conseguir montar mesmo com o menu fechado. */}
      {videoId && (
        <div aria-hidden className="fixed top-0 left-0 w-px h-px overflow-hidden opacity-0 pointer-events-none">
          <div id={ytHostId.current} />
        </div>
      )}

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

          {/* Musica (YouTube) */}
          <div className="pt-3 border-t border-black/10">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Sua trilha (YouTube)
            </div>

            <div className="flex gap-1.5">
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void tocarYouTube(); }}
                placeholder="cole a URL do vídeo (youtu.be/...)"
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-black/10 bg-slate-50 text-[11px] text-slate-700 focus:outline-none focus:border-blue-400"
              />
              <button
                type="button"
                onClick={() => void tocarYouTube()}
                title="Tocar no YouTube"
                className="px-2.5 rounded-lg bg-slate-50 border border-black/10 text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <Youtube className="w-3.5 h-3.5" />
              </button>
            </div>

            {videoId && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={alternar}
                  disabled={loading || !playerRef.current}
                  className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-default"
                  title={loading ? 'Carregando...' : playing ? 'Pausar' : 'Tocar'}
                >
                  {loading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : playing
                      ? <Pause className="w-3.5 h-3.5 fill-current" />
                      : <Play className="w-3.5 h-3.5 fill-current" />}
                </button>
                <span className="text-[11px] font-semibold text-slate-600 truncate flex-1">
                  YouTube · {videoId}
                </span>
                <button
                  type="button"
                  onClick={tirar}
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
            O app não distribui música. Cole um vídeo do YouTube que você tenha
            direito de ouvir enquanto estuda.
          </p>
        </div>
      )}
    </div>
  );
};