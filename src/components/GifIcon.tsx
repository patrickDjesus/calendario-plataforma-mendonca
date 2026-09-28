import React, { useCallback, useEffect, useRef, useState } from 'react';

const GIF_DIR = '/gifs';
const STILL_DIR = '/gifs/still';

export const GIF_NAMES = [
  'inicio',
  'tarefas',
  'semana',
  'jornada',
  'nova-tarefa',
  'modo-foco',
  'finalizar-dia',
  'modelos-rotina',
  'revisao-espacada',
  'lixeira',
  'metas',
  'configuracao',
  'fogo-sequencia',
  'tempo-total-cronometrado',
  'experiencia-acumulada',
  'tarefas-concluidas',
  'dia-chuvoso',
  'tarefa-estudo',
  'tarefa-saude',
  'tarefa-trabalho',
  'avatar-homem',
  'avatar-mulher',
  'pessoal',
  'outros',
  'foguete',
] as const;

export type GifName = (typeof GIF_NAMES)[number];

/** Assets que são um PNG puro: não têm animação nem frame estático separado. */
const STATIC_ONLY: Partial<Record<GifName, true>> = { foguete: true };

/**
 * Assets cujo arquivo incorporate um fundo branco opaco (640x640, sem alfa).
 * Sobre cartão branco o `mix-blend-mode: multiply` faz o branco sumir sem
 * precisar de recorte. Em fundos escuros/coloridos isso escureceria tudo —
 * nesses hostis passe `blend={false}`.
 */
const WHITE_BACKDROP: Partial<Record<GifName, true>> = {
  'fogo-sequencia': true,
  'tempo-total-cronometrado': true,
  'experiencia-acumulada': true,
  'tarefas-concluidas': true,
  'dia-chuvoso': true,
};

/** Duração real de um ciclo de cada GIF, em ms (soma dos atrasos dos frames). */
export const LOOP_MS: Partial<Record<GifName, number>> = {
  'avatar-homem': 4110,
  'avatar-mulher': 4110,
  configuracao: 2420,
  'dia-chuvoso': 1500,
  'experiencia-acumulada': 3060,
  'finalizar-dia': 5280,
  'fogo-sequencia': 4560,
  inicio: 3100,
  jornada: 2300,
  lixeira: 1480,
  metas: 2020,
  'modelos-rotina': 4030,
  'modo-foco': 2420,
  'nova-tarefa': 4030,
  'revisao-espacada': 2020,
  semana: 2020,
  'tarefa-estudo': 4030,
  'tarefa-saude': 3230,
  'tarefa-trabalho': 3230,
  'tarefas-concluidas': 2160,
  tarefas: 5040,
  'tempo-total-cronometrado': 5430,
  pessoal: 1620,
  outros: 2420,
};

/**
 * Folga somada ao fim do ciclo. Cobre o atraso entre o ultimo frame pintado e o
 * disparo do timer, para o GIF nunca ser cortado no ultimo movimento.
 */
const LOOP_TAIL_MS = 80;

export const gifSrc = (name: GifName) =>
  `${GIF_DIR}/${name}.${STATIC_ONLY[name] ? 'png' : 'gif'}`;

export const gifStillSrc = (name: GifName) =>
  STATIC_ONLY[name] ? gifSrc(name) : `${STILL_DIR}/${name}.png`;

/** Elemento interativo que hospeda a ilustração e comanda a animação. */
const HOST_SELECTOR = 'button, a, [role="button"], [role="tab"], [data-gif-host]';

type IdleHandle = { cancel: () => void };

const onIdle = (fn: () => void): IdleHandle => {
  const ric = (
    window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  ).requestIdleCallback;

  if (typeof ric === 'function') {
    const id = ric(fn, { timeout: 4000 });
    return {
      cancel: () =>
        (window as unknown as { cancelIdleCallback: (i: number) => void }).cancelIdleCallback(id),
    };
  }
  const id = window.setTimeout(fn, 1200);
  return { cancel: () => window.clearTimeout(id) };
};

const preload = (src: string) => {
  const img = new Image();
  img.src = src;
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return reduced;
}

/** Só conta como "foco de teclado"; clique de mouse não deve deixar o GIF solto. */
const isKeyboardFocus = (el: Element | null): boolean => {
  if (!el || typeof el.matches !== 'function') return false;
  try {
    return el.matches(':focus-visible');
  } catch {
    return false;
  }
};

interface GifIconProps {
  name: GifName;
  /** Frame estático até o ponteiro entrar no hospedeiro (ou foco de teclado). */
  playOnHover?: boolean;
  className?: string;
  alt?: string;
  /** Desliga o lazy loading (ícones acima da dobra). */
  eager?: boolean;
  /**
   * Sobrescreve o blend automático. Use `false` quando a ilustração for
   * exibida sobre um fundo escuro ou colorido.
   */
  blend?: boolean;
}

/**
 * Renderiza uma ilustração do acervo.
 *
 * Por padrão (regra do app) mostra o frame estático até o ponteiro entrar em
 * QUALQUER parte do elemento interativo que a hospeda (botão, link, aba ou
 * um container marcado com `data-gif-host`) — não só sobre o desenho —,
 * trocando para o GIF na entrada. Na saída o GIF termina o ciclo que começou
 * e só então volta ao PNG (mesmo em hover longo, respeitando a fase do loop).
 * Passe `playOnHover={false}` para manter a animação contínua.
 */
export const GifIcon: React.FC<GifIconProps> = ({
  name,
  playOnHover = true,
  className = '',
  alt = '',
  eager = false,
  blend,
}) => {
  const reducedMotion = usePrefersReducedMotion();
  const boxRef = useRef<HTMLSpanElement>(null);
  const touchTimer = useRef<number | null>(null);
  const finishTimer = useRef<number | null>(null);
  /** Instante em que o GIF atual comecou a tocar (ancorado no load da img). */
  const cycleStart = useRef(0);
  /** O GIF esta montado e rodando (pode estar segurando o fim do ciclo). */
  const playing = useRef(false);
  /** Saiu do hospedeiro antes do GIF carregar: o corte fica pendente. */
  const pendingStop = useRef(false);
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);

  const isStatic = Boolean(STATIC_ONLY[name]) || reducedMotion;
  const animated = isStatic ? gifStillSrc(name) : gifSrc(name);
  const still = gifStillSrc(name);

  const showGif = useCallback((next: boolean) => {
    activeRef.current = next;
    setActive(next);
  }, []);

  const clearFinishTimer = useCallback(() => {
    if (finishTimer.current !== null) {
      window.clearTimeout(finishTimer.current);
      finishTimer.current = null;
    }
  }, []);

  const stopTouchTimer = useCallback(() => {
    if (touchTimer.current !== null) {
      window.clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
  }, []);

  /** Monta o GIF; o ciclo comeca a ser cronometrado no load da imagem. */
  const play = useCallback(() => {
    clearFinishTimer();
    pendingStop.current = false;
    showGif(true);
  }, [clearFinishTimer, showGif]);

  /** Corta a animacao na hora, ignorando o fim do ciclo. */
  const stop = useCallback(() => {
    clearFinishTimer();
    pendingStop.current = false;
    playing.current = false;
    showGif(false);
  }, [clearFinishTimer, showGif]);

  /**
   * Ao sair do hospedeiro o GIF continua rodando e so volta ao frame estatico
   * quando o ciclo que estava em curso fecha — o GIF nao "pula" o desenho no
   * meio de um gesto.
   *
   * A ancora e o comeco do PRIMEIRO ciclo, mas o GIF repete em loop: o que
   * importa e a fase atual (`resto da divisao pelo ciclo`). Sem isso, um hover
   * mais longo que um ciclo resultaria em "resto 0" e congelaria a imagem no
   * meio do desenho.
   */
  const finishCycle = useCallback(() => {
    if (!activeRef.current) return;
    if (!playing.current) {
      // O GIF ainda esta decodificando: o load ancora o ciclo e corta dali.
      pendingStop.current = true;
      return;
    }

    const loop = LOOP_MS[name] ?? 2000;
    const phase = (Date.now() - cycleStart.current) % loop;
    clearFinishTimer();
    finishTimer.current = window.setTimeout(() => {
      finishTimer.current = null;
      playing.current = false;
      showGif(false);
    }, loop - phase + LOOP_TAIL_MS);
  }, [clearFinishTimer, showGif, name]);

  /**
   * Ancora o ciclo no load (e nao no setState): o navegador ainda tem que
   * decodificar o GIF, e cronometrar antes disso encurtaria a animacao.
   */
  const handleLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      if (isStatic || !playOnHover) return;
      if (!event.currentTarget.currentSrc.endsWith(animated)) return;

      cycleStart.current = Date.now();
      playing.current = true;

      if (pendingStop.current) {
        pendingStop.current = false;
        finishCycle();
      }
    },
    [isStatic, playOnHover, animated, finishCycle]
  );

  // Pré-carrega o GIF enquanto o navegador está ocioso: evita o "piscar" no
  // hover sem competir com o first paint.
  useEffect(() => {
    if (isStatic || !playOnHover) return;
    const handle = onIdle(() => preload(animated));
    return () => handle.cancel();
  }, [isStatic, playOnHover, animated]);

  // Liga a animação no HOSPEDEIRO interativo, não no <span> da ilustração.
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !playOnHover || isStatic) return;

    const host = (box.closest(HOST_SELECTOR) as HTMLElement | null) ?? box;

    const handlePointerEnter = (event: Event) => {
      // Toque não tem hover: no mobile o disparo é feito no pointerdown.
      if ((event as PointerEvent).pointerType === 'touch') return;
      play();
    };

    const handlePointerLeave = (event: Event) => {
      if ((event as PointerEvent).pointerType === 'touch') return;
      finishCycle();
    };

    const handleFocusIn = (event: Event) => {
      if (!isKeyboardFocus(event.target as Element)) return;
      play();
    };

    // Tab entre dois elementos do MESMO card dispara focusout: sem esta
    // checagem o GIF congelaria no meio do ciclo com o foco ainda no card.
    const handleFocusOut = (event: Event) => {
      const next = (event as FocusEvent).relatedTarget as Node | null;
      if (next && host.contains(next)) return;
      finishCycle();
    };

    // Mobile: um toque reproduz aproximadamente um ciclo e volta ao estático.
    const handlePointerDown = (event: Event) => {
      if ((event as PointerEvent).pointerType !== 'touch') return;
      play();
      stopTouchTimer();
      touchTimer.current = window.setTimeout(stop, (LOOP_MS[name] ?? 2000) + 250);
    };

    host.addEventListener('pointerenter', handlePointerEnter);
    host.addEventListener('pointerleave', handlePointerLeave);
    host.addEventListener('focusin', handleFocusIn);
    host.addEventListener('focusout', handleFocusOut);
    host.addEventListener('pointerdown', handlePointerDown);

    return () => {
      host.removeEventListener('pointerenter', handlePointerEnter);
      host.removeEventListener('pointerleave', handlePointerLeave);
      host.removeEventListener('focusin', handleFocusIn);
      host.removeEventListener('focusout', handleFocusOut);
      host.removeEventListener('pointerdown', handlePointerDown);
      stopTouchTimer();
      clearFinishTimer();
      playing.current = false;
      pendingStop.current = false;
    };
  }, [playOnHover, isStatic, name, play, stop, finishCycle, stopTouchTimer, clearFinishTimer]);

  const src = !playOnHover || isStatic || active ? animated : still;
  const useBlend = blend ?? Boolean(WHITE_BACKDROP[name]);

  return (
    <span
      ref={boxRef}
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
    >
      <img
        src={src}
        alt={alt}
        onLoad={handleLoad}
        draggable={false}
        decoding="async"
        loading={eager || playOnHover ? 'eager' : 'lazy'}
        className={`w-full h-full object-contain pointer-events-none select-none ${
          useBlend ? 'mix-blend-multiply' : ''
        }`}
      />
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* Avatar                                                             */
/* ------------------------------------------------------------------ */

interface ProfileAvatarProps {
  /** Valor cru de UserProfile.avatar: chave de GIF ou emoji legado. */
  value?: string;
  className?: string;
  playOnHover?: boolean;
  eager?: boolean;
  blend?: boolean;
}

const AVATAR_GIF: Record<string, GifName> = {
  foguete: 'foguete',
  homem: 'avatar-homem',
  mulher: 'avatar-mulher',
  'avatar-homem': 'avatar-homem',
  'avatar-mulher': 'avatar-mulher',
};

/** Emojis que podem existir em bancos de usuários criados antes das ilustrações. */
const LEGACY_AVATAR_GIF: Record<string, GifName> = {
  '🎓': 'foguete',
  '🧠': 'tarefa-estudo',
  '🎯': 'experiencia-acumulada',
  '⚡': 'experiencia-acumulada',
  '🔥': 'fogo-sequencia',
  '🦉': 'tarefa-trabalho',
};

export const DEFAULT_AVATAR: GifName = 'avatar-homem';

export const AVATAR_OPTIONS: GifName[] = [
  'avatar-homem',
  'avatar-mulher',
  'foguete',
  'tarefa-estudo',
  'tarefa-saude',
  'tarefa-trabalho',
  'fogo-sequencia',
  'experiencia-acumulada',
];

export const resolveAvatarGif = (value?: string): GifName | null => {
  if (!value) return DEFAULT_AVATAR;
  return AVATAR_GIF[value] ?? LEGACY_AVATAR_GIF[value] ?? null;
};

/** Slot de avatar: cai para o texto original quando o valor é desconhecido. */
export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  value,
  className = '',
  playOnHover = true,
  eager = false,
  blend,
}) => {
  const gif = resolveAvatarGif(value);

  if (!gif) {
    return (
      <span className={`inline-flex items-center justify-center shrink-0 ${className}`}>
        {value}
      </span>
    );
  }

  return (
    <GifIcon name={gif} className={className} playOnHover={playOnHover} eager={eager} blend={blend} />
  );
};

/* ------------------------------------------------------------------ */
/* Badge de modo de estudo                                            */
/* ------------------------------------------------------------------ */

const BADGE_GIF: Record<string, GifName> = {
  '🔥': 'fogo-sequencia',
  '⚡': 'experiencia-acumulada',
};

/**
 * Converte STUDY_MODES[mode].badge em ilustração quando existe arte.
 * Com `animated={false}` devolve o emoji puro, sem GIF.
 */
export const StudyModeBadge: React.FC<{
  badge: string;
  className?: string;
  blend?: boolean;
  animated?: boolean;
}> = ({
  badge,
  className = 'w-5 h-5',
  blend,
  animated = true,
}) => {
  const gif = animated ? BADGE_GIF[badge] : undefined;
  if (!gif) {
    return (
      <span className={`inline-flex items-center justify-center shrink-0 ${className}`}>
        {badge}
      </span>
    );
  }
  return <GifIcon name={gif} className={className} blend={blend} />;
};
